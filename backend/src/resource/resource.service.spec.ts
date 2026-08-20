import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ResourceStatus } from '../common/enums/resource-status.enum';
import { BookingResource } from '../booking-resource/entities/booking-resource.entity';
import { Resource } from './entities/resource.entity';
import { ResourceService } from './resource.service';

describe('ResourceService', () => {
  let service: ResourceService;

  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';
  const resourceId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const now = new Date('2026-08-20T10:00:00.000Z');

  const makeResource = (
    overrides: Partial<Resource> = {},
  ): Resource =>
    ({
      id: resourceId,
      organizationId: orgA,
      organizationsId: orgA,
      name: 'Room A',
      resourceType: 'meeting_room',
      status: ResourceStatus.ACTIVE,
      metadata: { capacity: 8 },
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }) as Resource;

  const repo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const bookingResourceRepo = {
    count: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourceService,
        { provide: getRepositoryToken(Resource), useValue: repo },
        {
          provide: getRepositoryToken(BookingResource),
          useValue: bookingResourceRepo,
        },
      ],
    }).compile();

    service = module.get(ResourceService);
  });

  describe('create', () => {
    it('OWNER/ADMIN path: creates resource scoped to JWT organization', async () => {
      const entity = makeResource();
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      const result = await service.create(
        {
          name: '  Room A  ',
          resourceType: 'meeting_room',
          metadata: { capacity: 8 },
        },
        orgA,
      );

      expect(repo.create).toHaveBeenCalledWith({
        name: '  Room A  ',
        resourceType: 'meeting_room',
        metadata: { capacity: 8 },
        status: ResourceStatus.ACTIVE,
        organizationId: orgA,
        organizationsId: orgA,
      });
      expect(result).toEqual({
        id: resourceId,
        name: 'Room A',
        resourceType: 'meeting_room',
        status: ResourceStatus.ACTIVE,
        metadata: { capacity: 8 },
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    });

    it('cannot assign another organization via create payload', async () => {
      const entity = makeResource({ organizationId: orgA });
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      await service.create(
        {
          name: 'Room A',
          // @ts-expect-error intentionally probing rejected client fields
          organizationId: orgB,
        },
        orgA,
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgA,
          organizationsId: orgA,
        }),
      );
      expect(repo.create.mock.calls[0][0].organizationId).not.toBe(orgB);
    });

    it('rejects missing organization context', async () => {
      await expect(
        service.create({ name: 'Room A' }, ''),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('updates only provided fields for own organization', async () => {
      const entity = makeResource();
      repo.findOne.mockResolvedValue(entity);
      repo.save.mockImplementation(async (value: Resource) => value);

      const result = await service.update(
        resourceId,
        { name: 'Room A - Large' },
        orgA,
      );

      expect(result.name).toBe('Room A - Large');
      expect(result.status).toBe(ResourceStatus.ACTIVE);
    });

    it('rejects cross-organization update with 404', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update(resourceId, { name: 'Hacked' }, orgB),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('activates via status field idempotently', async () => {
      const entity = makeResource({ status: ResourceStatus.INACTIVE });
      repo.findOne.mockResolvedValue(entity);
      repo.save.mockImplementation(async (value: Resource) => value);

      const first = await service.update(
        resourceId,
        { status: ResourceStatus.ACTIVE },
        orgA,
      );
      const second = await service.update(
        resourceId,
        { status: ResourceStatus.ACTIVE },
        orgA,
      );

      expect(first.status).toBe(ResourceStatus.ACTIVE);
      expect(second.status).toBe(ResourceStatus.ACTIVE);
    });

    it('deactivates via status without deleting booking history links', async () => {
      const entity = makeResource();
      repo.findOne.mockResolvedValue(entity);
      repo.save.mockImplementation(async (value: Resource) => value);

      const result = await service.update(
        resourceId,
        { status: ResourceStatus.INACTIVE },
        orgA,
      );

      expect(result.status).toBe(ResourceStatus.INACTIVE);
      expect(repo.delete).not.toHaveBeenCalled();
      expect(bookingResourceRepo.count).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('hard-deletes when no booking links exist', async () => {
      repo.findOne.mockResolvedValue(makeResource());
      bookingResourceRepo.count.mockResolvedValue(0);
      repo.delete.mockResolvedValue({ affected: 1 });

      await service.remove(resourceId, orgA);

      expect(repo.delete).toHaveBeenCalledWith(resourceId);
    });

    it('returns conflict when booking links exist', async () => {
      repo.findOne.mockResolvedValue(makeResource());
      bookingResourceRepo.count.mockResolvedValue(2);

      await expect(service.remove(resourceId, orgA)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('assertUsableForNewBooking', () => {
    it('allows ACTIVE resources', async () => {
      repo.findOne.mockResolvedValue(makeResource());

      await expect(
        service.assertUsableForNewBooking(resourceId, orgA),
      ).resolves.toMatchObject({ id: resourceId, status: ResourceStatus.ACTIVE });
    });

    it('rejects INACTIVE resources for new bookings', async () => {
      repo.findOne.mockResolvedValue(
        makeResource({ status: ResourceStatus.INACTIVE }),
      );

      await expect(
        service.assertUsableForNewBooking(resourceId, orgA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('preserves historical booking links conceptually on deactivate', async () => {
      const entity = makeResource();
      repo.findOne.mockResolvedValue(entity);
      repo.save.mockResolvedValue({
        ...entity,
        status: ResourceStatus.INACTIVE,
      });

      await service.update(
        resourceId,
        { status: ResourceStatus.INACTIVE },
        orgA,
      );

      expect(bookingResourceRepo.count).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('filters, paginates, and returns meta', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest
          .fn()
          .mockResolvedValue([[makeResource()], 1]),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(orgA, {
        search: 'Room',
        status: ResourceStatus.ACTIVE,
        page: 1,
        limit: 20,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(qb.where).toHaveBeenCalledWith(
        'resource.organizationId = :organizationId',
        { organizationId: orgA },
      );
      expect(qb.andWhere).toHaveBeenCalled();
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('scopes lookup by organization', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne(resourceId, orgB)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: resourceId, organizationId: orgB },
      });
    });
  });
});
