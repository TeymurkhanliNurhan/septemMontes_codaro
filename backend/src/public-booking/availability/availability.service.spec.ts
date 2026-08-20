import {
  FindManyOptions,
  FindOperator,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { AvailabilityException } from '../../availability-exception/entities/availability-exception.entity';
import { AvailabilityRule } from '../../availability-rule/entities/availability-rule.entity';
import { BookingResource } from '../../booking-resource/entities/booking-resource.entity';
import { ResourceStatus } from '../../common/enums/resource-status.enum';
import { Resource } from '../../resource/entities/resource.entity';
import { Service } from '../../service/entities/service.entity';
import { ServiceResource } from '../../service-resource/entities/service-resource.entity';
import { AvailabilityService, SlotSearch } from './availability.service';

// The rest of AvailabilityService is deliberately untested at the unit
// level (see the plan) -- it is thin orchestration over modules already
// tested hard, and exercising it properly needs a database (Task 9 covers
// that path with an end-to-end walk). Two narrow pieces are different:
// the isSlotFree guards must short-circuit *before* any repository is
// touched, so they can be pinned without a database by proving the
// repositories are never called -- and capableResources carries the tenant
// boundary in its where clause, so that gets pinned too.

/** A repository double that fails the test if any method on it is invoked. */
function unqueriedRepository<T extends object>(): Repository<T> {
  const fail = (method: string) => () => {
    throw new Error(
      `isSlotFree should return before ${method}() is ever called for a non-positive duration`,
    );
  };
  return {
    find: jest.fn(fail('find')),
    findOne: jest.fn(fail('findOne')),
    createQueryBuilder: jest.fn(fail('createQueryBuilder')),
  } as unknown as Repository<T>;
}

function buildAvailabilityService(): AvailabilityService {
  return new AvailabilityService(
    unqueriedRepository<Resource>(),
    unqueriedRepository<ServiceResource>(),
    unqueriedRepository<AvailabilityRule>(),
    unqueriedRepository<AvailabilityException>(),
    unqueriedRepository<BookingResource>(),
  );
}

function buildService(overrides: Partial<Service> = {}): Service {
  return {
    id: 'svc-1',
    organizationId: 'org-1',
    name: 'Haircut',
    durationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    ...overrides,
  } as Service;
}

describe('AvailabilityService.capableResources', () => {
  // service_resources has no cross-org constraint and
  // ServiceResourceService.create validates nothing, so a row can link a
  // service to another organization's resource. The tenant boundary is this
  // where clause: scoping in JS after an unscoped query would over-fetch the
  // other organization's row and depend on every caller remembering to
  // discard it. This pins the scope where it lives.
  it('scopes the resource lookup to the organization id', async () => {
    const serviceResourceFind = jest
      .fn()
      .mockResolvedValue([{ resourceId: 'r-1' }, { resourceId: 'r-2' }]);
    const resourceFind = jest.fn<
      Promise<Resource[]>,
      [FindManyOptions<Resource>]
    >();

    const service = new AvailabilityService(
      { find: resourceFind } as unknown as Repository<Resource>,
      {
        find: serviceResourceFind,
      } as unknown as Repository<ServiceResource>,
      {} as Repository<AvailabilityRule>,
      {} as Repository<AvailabilityException>,
      {} as Repository<BookingResource>,
    );

    await service.capableResources('svc-1', 'org-1');

    expect(resourceFind).toHaveBeenCalledTimes(1);
    const where = resourceFind.mock.calls[0][0]
      .where as FindOptionsWhere<Resource>;
    expect(where.organizationId).toBe('org-1');
    expect(where.status).toBe(ResourceStatus.ACTIVE);
    // `In([...])` on a string column is FindOperator<string>; the value
    // carries the array at runtime.
    expect((where.id as FindOperator<string>).value as unknown).toEqual([
      'r-1',
      'r-2',
    ]);
  });

  it('returns nothing when the service has no resource links', async () => {
    const service = new AvailabilityService(
      {} as Repository<Resource>,
      {
        find: jest.fn().mockResolvedValue([]),
      } as unknown as Repository<ServiceResource>,
      {} as Repository<AvailabilityRule>,
      {} as Repository<AvailabilityException>,
      {} as Repository<BookingResource>,
    );

    await expect(service.capableResources('svc-1', 'org-1')).resolves.toEqual(
      [],
    );
  });
});

describe('AvailabilityService.isSlotFree', () => {
  // computeSlots guards durationMs <= 0 and findSlots inherits that guard
  // for free by routing through it. isSlotFree stopped routing through
  // computeSlots when it became a direct containment check, so it must
  // repeat the guard itself -- otherwise durationMinutes=0 degenerates the
  // containment test to "is startsAt inside any free interval", which is
  // true almost everywhere, the opposite of findSlots advertising nothing.
  it.each([0, -30])(
    'rejects a service with durationMinutes=%i without querying anything',
    async (durationMinutes) => {
      const service = buildAvailabilityService();
      const search: SlotSearch = {
        service: buildService({ durationMinutes }),
        organizationId: 'org-1',
        organizationTimezone: 'UTC',
        from: '2026-08-01',
        to: '2026-08-31',
        now: Date.now(),
      };

      await expect(
        service.isSlotFree('resource-1', Date.now(), search),
      ).resolves.toBe(false);
    },
  );

  it('rejects an instant before "now" without querying anything', async () => {
    const service = buildAvailabilityService();
    const now = Date.now();
    const search: SlotSearch = {
      service: buildService(),
      organizationId: 'org-1',
      organizationTimezone: 'UTC',
      from: '2026-08-01',
      to: '2026-08-31',
      now,
    };

    await expect(
      service.isSlotFree('resource-1', now - 1, search),
    ).resolves.toBe(false);
  });
});
