import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Booking } from '../booking/entities/booking.entity';
import { ResourceStatus } from '../common/enums/resource-status.enum';
import { Resource } from '../resource/entities/resource.entity';
import { ResourceService } from '../resource/resource.service';
import { ServiceResource } from '../service-resource/entities/service-resource.entity';
import { Service } from './entities/service.entity';
import { ServiceService } from './service.service';

describe('ServiceService', () => {
  let service: ServiceService;

  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';
  const serviceId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const resourceId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const resourceId2 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  const now = new Date('2026-08-20T10:00:00.000Z');

  const makeService = (overrides: Partial<Service> = {}): Service =>
    ({
      id: serviceId,
      organizationId: orgA,
      name: '60 Minute Consultation',
      description: 'Standard consultation',
      durationMinutes: 60,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 15,
      isActive: true,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }) as Service;

  const makeResource = (overrides: Partial<Resource> = {}): Resource =>
    ({
      id: resourceId,
      organizationId: orgA,
      name: 'Doctor A',
      resourceType: 'doctor',
      status: ResourceStatus.ACTIVE,
      metadata: {},
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

  const serviceResourceRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const bookingRepo = {
    count: jest.fn(),
  };

  const resourceService = {
    findResourceForOrganization: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceService,
        { provide: getRepositoryToken(Service), useValue: repo },
        {
          provide: getRepositoryToken(ServiceResource),
          useValue: serviceResourceRepo,
        },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: ResourceService, useValue: resourceService },
      ],
    }).compile();

    service = module.get(ServiceService);
  });

  describe('create', () => {
    it('OWNER/ADMIN path: creates service scoped to JWT organization', async () => {
      const entity = makeService();
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      const result = await service.create(
        {
          name: '  60 Minute Consultation  ',
          description: 'Standard consultation',
          durationMinutes: 60,
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 15,
          metadata: {},
        },
        orgA,
      );

      expect(repo.create).toHaveBeenCalledWith({
        name: '  60 Minute Consultation  ',
        description: 'Standard consultation',
        durationMinutes: 60,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 15,
        metadata: {},
        isActive: true,
        organizationId: orgA,
      });
      expect(result.id).toBe(serviceId);
      expect(result.isActive).toBe(true);
    });

    it('cannot assign another organization via create payload', async () => {
      const entity = makeService({ organizationId: orgA });
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      await service.create(
        {
          name: 'Consultation',
          durationMinutes: 60,
          // @ts-expect-error intentionally probing rejected client fields
          organizationId: orgB,
        },
        orgA,
      );

      expect(repo.create.mock.calls[0][0].organizationId).toBe(orgA);
      expect(repo.create.mock.calls[0][0].organizationId).not.toBe(orgB);
    });

    it('rejects missing organization context', async () => {
      await expect(
        service.create({ name: 'Consultation', durationMinutes: 60 }, ''),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('updates only provided fields for own organization', async () => {
      const entity = makeService();
      repo.findOne.mockResolvedValue(entity);
      repo.save.mockImplementation(async (value: Service) => value);

      const result = await service.update(
        { id: serviceId, name: '90 Minute Consultation', durationMinutes: 90 },
        orgA,
      );

      expect(result.name).toBe('90 Minute Consultation');
      expect(result.durationMinutes).toBe(90);
      expect(result.isActive).toBe(true);
    });

    it('rejects cross-organization update with 404', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update({ id: serviceId, name: 'Hacked' }, orgB),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('activates via isActive idempotently', async () => {
      const entity = makeService({ isActive: false });
      repo.findOne.mockResolvedValue(entity);
      repo.save.mockImplementation(async (value: Service) => value);

      const first = await service.update(
        { id: serviceId, isActive: true },
        orgA,
      );
      const second = await service.update(
        { id: serviceId, isActive: true },
        orgA,
      );

      expect(first.isActive).toBe(true);
      expect(second.isActive).toBe(true);
    });

    it('deactivates via isActive without deleting booking history', async () => {
      const entity = makeService();
      repo.findOne.mockResolvedValue(entity);
      repo.save.mockImplementation(async (value: Service) => value);

      const result = await service.update(
        { id: serviceId, isActive: false },
        orgA,
      );

      expect(result.isActive).toBe(false);
      expect(repo.delete).not.toHaveBeenCalled();
      expect(bookingRepo.count).not.toHaveBeenCalled();
      expect(serviceResourceRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('hard-deletes when no booking links exist', async () => {
      repo.findOne.mockResolvedValue(makeService());
      bookingRepo.count.mockResolvedValue(0);
      repo.delete.mockResolvedValue({ affected: 1 });

      await service.remove(serviceId, orgA);

      expect(repo.delete).toHaveBeenCalledWith(serviceId);
    });

    it('returns conflict when booking links exist', async () => {
      repo.findOne.mockResolvedValue(makeService());
      bookingRepo.count.mockResolvedValue(2);

      await expect(service.remove(serviceId, orgA)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('assertUsableForNewBooking', () => {
    it('allows ACTIVE services', async () => {
      repo.findOne.mockResolvedValue(makeService());

      await expect(
        service.assertUsableForNewBooking(serviceId, orgA),
      ).resolves.toMatchObject({ id: serviceId, isActive: true });
    });

    it('rejects INACTIVE services for new bookings', async () => {
      repo.findOne.mockResolvedValue(makeService({ isActive: false }));

      await expect(
        service.assertUsableForNewBooking(serviceId, orgA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('preserves historical booking links conceptually on deactivate', async () => {
      const entity = makeService();
      repo.findOne.mockResolvedValue(entity);
      repo.save.mockResolvedValue({ ...entity, isActive: false });

      await service.update({ id: serviceId, isActive: false }, orgA);

      expect(bookingRepo.count).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('service-resource relationships', () => {
    it('replaces linked resources via resourceIds on update', async () => {
      repo.findOne.mockResolvedValue(makeService());
      repo.save.mockImplementation(async (value: Service) => value);
      resourceService.findResourceForOrganization.mockResolvedValue(
        makeResource(),
      );
      serviceResourceRepo.find.mockResolvedValue([]);
      serviceResourceRepo.create.mockImplementation(
        (value: { serviceId: string; resourceId: string }) => value,
      );
      serviceResourceRepo.save.mockResolvedValue([]);

      await service.update({ id: serviceId, resourceIds: [resourceId] }, orgA);

      expect(resourceService.findResourceForOrganization).toHaveBeenCalledWith(
        resourceId,
        orgA,
      );
      expect(serviceResourceRepo.create).toHaveBeenCalledWith({
        serviceId,
        resourceId,
      });
      expect(serviceResourceRepo.save).toHaveBeenCalled();
    });

    it('rejects cross-organization resource in resourceIds', async () => {
      repo.findOne.mockResolvedValue(makeService());
      repo.save.mockImplementation(async (value: Service) => value);
      resourceService.findResourceForOrganization.mockRejectedValue(
        new NotFoundException(`Resource ${resourceId} not found`),
      );

      await expect(
        service.update({ id: serviceId, resourceIds: [resourceId] }, orgA),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('detaches resources not present in resourceIds without deleting resources', async () => {
      repo.findOne.mockResolvedValue(makeService());
      repo.save.mockImplementation(async (value: Service) => value);
      resourceService.findResourceForOrganization.mockResolvedValue(
        makeResource({ id: resourceId2 }),
      );
      serviceResourceRepo.find.mockResolvedValue([
        { serviceId, resourceId },
        { serviceId, resourceId: resourceId2 },
      ]);
      serviceResourceRepo.delete.mockResolvedValue({ affected: 1 });

      await service.update(
        { id: serviceId, resourceIds: [resourceId2] },
        orgA,
      );

      expect(serviceResourceRepo.delete).toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('lists only linked resources for the organization', async () => {
      repo.findOne.mockResolvedValue(makeService());
      serviceResourceRepo.find.mockResolvedValue([
        {
          serviceId,
          resourceId,
          resource: makeResource(),
        },
      ]);

      const result = await service.listResources(serviceId, orgA);

      expect(result.data).toEqual([
        {
          id: resourceId,
          name: 'Doctor A',
          resourceType: 'doctor',
          status: ResourceStatus.ACTIVE,
        },
      ]);
    });
  });

  describe('query', () => {
    it('returns single service when id is provided', async () => {
      repo.findOne.mockResolvedValue(makeService());

      const result = await service.query(orgA, { id: serviceId });

      expect(result).toEqual({
        data: expect.objectContaining({ id: serviceId }),
      });
    });

    it('returns linked resources when id and include=resources', async () => {
      repo.findOne.mockResolvedValue(makeService());
      serviceResourceRepo.find.mockResolvedValue([
        { serviceId, resourceId, resource: makeResource() },
      ]);

      const result = await service.query(orgA, {
        id: serviceId,
        include: 'resources',
      });

      expect(result).toEqual({
        data: [
          expect.objectContaining({
            id: resourceId,
            name: 'Doctor A',
          }),
        ],
      });
    });

    it('filters, paginates, and returns meta for list mode', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[makeService()], 1]),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.query(orgA, {
        search: 'Consult',
        status: 'ACTIVE',
        page: 1,
        limit: 20,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(qb.where).toHaveBeenCalledWith(
        'service.organizationId = :organizationId',
        { organizationId: orgA },
      );
      expect('meta' in result && result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('findOne', () => {
    it('scopes lookup by organization', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne(serviceId, orgB)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: serviceId, organizationId: orgB },
      });
    });
  });
});
