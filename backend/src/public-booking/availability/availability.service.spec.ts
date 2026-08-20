import { Repository } from 'typeorm';
import { AvailabilityException } from '../../availability-exception/entities/availability-exception.entity';
import { AvailabilityRule } from '../../availability-rule/entities/availability-rule.entity';
import { BookingResource } from '../../booking-resource/entities/booking-resource.entity';
import { Resource } from '../../resource/entities/resource.entity';
import { Service } from '../../service/entities/service.entity';
import { ServiceResource } from '../../service-resource/entities/service-resource.entity';
import { AvailabilityService, SlotSearch } from './availability.service';

// The rest of AvailabilityService is deliberately untested at the unit
// level (see the plan) -- it is thin orchestration over three modules
// already tested hard, and exercising it properly needs a database (Task 9
// covers that path with an end-to-end walk). This one guard is different:
// it must short-circuit *before* any repository is touched, so it can be
// pinned without a database by proving the repositories are never called.

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
