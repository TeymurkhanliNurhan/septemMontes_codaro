import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AvailabilityExceptionType } from '../common/enums/availability-exception-type.enum';
import { ResourceService } from '../resource/resource.service';
import { AvailabilityException } from './entities/availability-exception.entity';
import { AvailabilityExceptionService } from './availability-exception.service';

describe('AvailabilityExceptionService', () => {
  let service: AvailabilityExceptionService;

  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';
  const resourceId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const exceptionId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const now = new Date('2026-08-20T10:00:00.000Z');

  const makeException = (
    overrides: Partial<AvailabilityException> = {},
  ): AvailabilityException =>
    ({
      id: exceptionId,
      resourceId,
      exceptionDate: '2026-08-25',
      startTime: '12:00:00',
      endTime: '18:00:00',
      exceptionType: AvailabilityExceptionType.UNAVAILABLE,
      reason: 'Maintenance',
      metadata: {},
      createdAt: now,
      ...overrides,
    }) as AvailabilityException;

  const repo = {
    findOne: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const resourceService = {
    findResourceForOrganization: jest.fn(),
  };

  const txManager = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    getRepository: jest.fn(),
  };

  const dataSource = {
    transaction: jest.fn(async (cb: (manager: typeof txManager) => unknown) =>
      cb(txManager),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    resourceService.findResourceForOrganization.mockResolvedValue({
      id: resourceId,
      organizationId: orgA,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityExceptionService,
        {
          provide: getRepositoryToken(AvailabilityException),
          useValue: repo,
        },
        { provide: ResourceService, useValue: resourceService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(AvailabilityExceptionService);
  });

  describe('create', () => {
    it('creates UNAVAILABLE exception for organization resource', async () => {
      const entity = makeException();
      const overlapQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      txManager.getRepository.mockReturnValue({
        createQueryBuilder: () => overlapQb,
      });
      txManager.create.mockReturnValue(entity);
      txManager.save.mockResolvedValue(entity);

      const result = await service.create(
        resourceId,
        {
          exceptionDate: '2026-08-25',
          startTime: '12:00',
          endTime: '18:00',
          exceptionType: AvailabilityExceptionType.UNAVAILABLE,
          reason: 'Maintenance',
        },
        orgA,
      );

      expect(result.exceptionType).toBe(AvailabilityExceptionType.UNAVAILABLE);
      expect(result.startTime).toBe('12:00');
    });

    it('accepts AVAILABLE exception type', async () => {
      const entity = makeException({
        exceptionType: AvailabilityExceptionType.AVAILABLE,
        reason: 'Special event',
        startTime: '10:00:00',
        endTime: '14:00:00',
      });
      const overlapQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      txManager.getRepository.mockReturnValue({
        createQueryBuilder: () => overlapQb,
      });
      txManager.create.mockReturnValue(entity);
      txManager.save.mockResolvedValue(entity);

      const result = await service.create(
        resourceId,
        {
          exceptionDate: '2026-08-29',
          startTime: '10:00',
          endTime: '14:00',
          exceptionType: AvailabilityExceptionType.AVAILABLE,
          reason: 'Special event',
        },
        orgA,
      );

      expect(result.exceptionType).toBe(AvailabilityExceptionType.AVAILABLE);
    });

    it('rejects overlapping exceptions on the same date', async () => {
      const overlapQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([
            makeException({ startTime: '12:00:00', endTime: '15:00:00' }),
          ]),
      };
      txManager.getRepository.mockReturnValue({
        createQueryBuilder: () => overlapQb,
      });

      await expect(
        service.create(
          resourceId,
          {
            exceptionDate: '2026-08-25',
            startTime: '14:00',
            endTime: '16:00',
            exceptionType: AvailabilityExceptionType.AVAILABLE,
          },
          orgA,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows non-overlapping exceptions on the same date', async () => {
      const entity = makeException({
        startTime: '14:00:00',
        endTime: '16:00:00',
      });
      const overlapQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([
            makeException({
              id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
              startTime: '09:00:00',
              endTime: '12:00:00',
            }),
          ]),
      };
      txManager.getRepository.mockReturnValue({
        createQueryBuilder: () => overlapQb,
      });
      txManager.create.mockReturnValue(entity);
      txManager.save.mockResolvedValue(entity);

      await expect(
        service.create(
          resourceId,
          {
            exceptionDate: '2026-08-25',
            startTime: '14:00',
            endTime: '16:00',
            exceptionType: AvailabilityExceptionType.UNAVAILABLE,
          },
          orgA,
        ),
      ).resolves.toMatchObject({ startTime: '14:00', endTime: '16:00' });
    });

    it('rejects startTime >= endTime', async () => {
      await expect(
        service.create(
          resourceId,
          {
            exceptionDate: '2026-08-25',
            startTime: '18:00',
            endTime: '12:00',
            exceptionType: AvailabilityExceptionType.UNAVAILABLE,
          },
          orgA,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects cross-organization access with 404', async () => {
      resourceService.findResourceForOrganization.mockRejectedValue(
        new NotFoundException(`Resource ${resourceId} not found`),
      );

      await expect(
        service.create(
          resourceId,
          {
            exceptionDate: '2026-08-25',
            startTime: '12:00',
            endTime: '18:00',
            exceptionType: AvailabilityExceptionType.UNAVAILABLE,
          },
          orgB,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update / remove', () => {
    it('updates provided fields', async () => {
      const entity = makeException();
      txManager.findOne.mockResolvedValue(entity);
      const overlapQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      txManager.getRepository.mockReturnValue({
        createQueryBuilder: () => overlapQb,
      });
      txManager.save.mockImplementation(
        async (value: AvailabilityException) => value,
      );

      const result = await service.update(
        resourceId,
        exceptionId,
        { reason: 'Maintenance extended', startTime: '13:00' },
        orgA,
      );

      expect(result.reason).toBe('Maintenance extended');
      expect(result.startTime).toBe('13:00');
    });

    it('hard-deletes an exception', async () => {
      repo.findOne.mockResolvedValue(makeException());
      repo.delete.mockResolvedValue({ affected: 1 });

      await service.remove(resourceId, exceptionId, orgA);
      expect(repo.delete).toHaveBeenCalledWith(exceptionId);
    });
  });

  describe('findAll', () => {
    it('filters by from/to/exceptionType', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([makeException()]),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(resourceId, orgA, {
        from: '2026-08-01',
        to: '2026-08-31',
        exceptionType: AvailabilityExceptionType.UNAVAILABLE,
      });

      expect(qb.andWhere).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
    });
  });
});
