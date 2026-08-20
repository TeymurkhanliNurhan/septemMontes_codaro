import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ResourceService } from '../resource/resource.service';
import { AvailabilityRule } from './entities/availability-rule.entity';
import { AvailabilityRuleService } from './availability-rule.service';

describe('AvailabilityRuleService', () => {
  let service: AvailabilityRuleService;

  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';
  const resourceId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ruleId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const now = new Date('2026-08-20T10:00:00.000Z');

  const makeRule = (
    overrides: Partial<AvailabilityRule> = {},
  ): AvailabilityRule =>
    ({
      id: ruleId,
      resourceId,
      dayOfWeek: 1,
      startTime: '09:00:00',
      endTime: '18:00:00',
      timezone: 'Europe/Warsaw',
      isActive: true,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }) as AvailabilityRule;

  const repo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
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
        AvailabilityRuleService,
        { provide: getRepositoryToken(AvailabilityRule), useValue: repo },
        { provide: ResourceService, useValue: resourceService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(AvailabilityRuleService);
  });

  describe('create', () => {
    it('OWNER/ADMIN path: creates rule scoped to resource organization', async () => {
      const entity = makeRule();
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
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '18:00',
          timezone: 'Europe/Warsaw',
          metadata: {},
        },
        orgA,
      );

      expect(resourceService.findResourceForOrganization).toHaveBeenCalledWith(
        resourceId,
        orgA,
      );
      expect(txManager.create).toHaveBeenCalledWith(
        AvailabilityRule,
        expect.objectContaining({
          resourceId,
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '18:00',
          isActive: true,
        }),
      );
      expect(result).toEqual({
        id: ruleId,
        resourceId,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '18:00',
        timezone: 'Europe/Warsaw',
        isActive: true,
        metadata: {},
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    });

    it('rejects overlapping active rules', async () => {
      const overlapQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([
            makeRule({ startTime: '09:00:00', endTime: '12:00:00' }),
          ]),
      };
      txManager.getRepository.mockReturnValue({
        createQueryBuilder: () => overlapQb,
      });

      await expect(
        service.create(
          resourceId,
          {
            dayOfWeek: 1,
            startTime: '11:00',
            endTime: '15:00',
          },
          orgA,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows split schedules on the same day', async () => {
      const entity = makeRule({
        startTime: '13:00:00',
        endTime: '18:00:00',
      });
      const overlapQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([
            makeRule({
              id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
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
            dayOfWeek: 1,
            startTime: '13:00',
            endTime: '18:00',
          },
          orgA,
        ),
      ).resolves.toMatchObject({
        startTime: '13:00',
        endTime: '18:00',
      });
    });

    it('rejects startTime >= endTime', async () => {
      await expect(
        service.create(
          resourceId,
          {
            dayOfWeek: 1,
            startTime: '18:00',
            endTime: '09:00',
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
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '18:00',
          },
          orgB,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates provided fields and rechecks overlap', async () => {
      const entity = makeRule();
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
      txManager.save.mockImplementation(async (value: AvailabilityRule) => value);

      const result = await service.update(
        resourceId,
        ruleId,
        { startTime: '10:00' },
        orgA,
      );

      expect(result.startTime).toBe('10:00');
    });
  });

  describe('activate / deactivate / remove', () => {
    it('activates after overlap check', async () => {
      const entity = makeRule({ isActive: false });
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
      txManager.save.mockResolvedValue({ ...entity, isActive: true });

      const result = await service.activate(resourceId, ruleId, orgA);
      expect(result).toEqual({ id: ruleId, isActive: true });
    });

    it('deactivates without deleting', async () => {
      const entity = makeRule();
      repo.findOne.mockResolvedValue(entity);
      repo.save.mockResolvedValue({ ...entity, isActive: false });

      const result = await service.deactivate(resourceId, ruleId, orgA);
      expect(result.isActive).toBe(false);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('hard-deletes a rule for the scoped resource', async () => {
      repo.findOne.mockResolvedValue(makeRule());
      repo.delete.mockResolvedValue({ affected: 1 });

      await service.remove(resourceId, ruleId, orgA);
      expect(repo.delete).toHaveBeenCalledWith(ruleId);
    });
  });

  describe('findAll / findOne', () => {
    it('lists rules ordered for organization resource', async () => {
      repo.find.mockResolvedValue([makeRule()]);

      const result = await service.findAll(resourceId, orgA);
      expect(repo.find).toHaveBeenCalledWith({
        where: { resourceId },
        order: { dayOfWeek: 'ASC', startTime: 'ASC' },
      });
      expect(result.data).toHaveLength(1);
    });

    it('rejects finding rule for another organization resource', async () => {
      resourceService.findResourceForOrganization.mockRejectedValue(
        new NotFoundException(`Resource ${resourceId} not found`),
      );

      await expect(
        service.findOne(resourceId, ruleId, orgB),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
