# Public Booking Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an end consumer pick a service, pick a time, and book it with a name and an email — no account, no login.

**Architecture:** A new `public-booking` Nest module holds the only unauthenticated business routes in the API, prefixed `/public` and scoped by organization slug. Its core is a slot engine split in two: `slot-math.ts` is pure arithmetic over UTC-epoch intervals with no database and no Nest, and `availability.service.ts` handles the impure work of loading rows and converting local wall-clock times to instants. A barebone SvelteKit app in `frontend/` consumes those routes and nothing else.

**Tech Stack:** NestJS 11, TypeORM 0.3, PostgreSQL, luxon (new), Jest. SvelteKit 2, Svelte 5 runes, Tailwind CSS v4, DaisyUI 5, openapi-typescript.

**Spec:** `docs/superpowers/specs/2026-08-20-public-booking-frontend-design.md`

---

## Working agreements

Read these once before Task 1.

- **Backend tests live beside their source.** Jest is configured with `rootDir: src` and `testRegex: .*\.spec\.ts$`, so `slot-math.spec.ts` sits next to `slot-math.ts`. There is no `tests/` tree.
- **Run backend tests** from `backend/` with `npx jest <path>`. Run the whole suite with `npm test`.
- **Lint is strict.** `typescript-eslint` runs `recommendedTypeChecked`, and `prettier/prettier` is an **error**, not a warning. Run `npm run lint` before every commit — it autofixes formatting.
- **`strictNullChecks` is on** but `strict` is not. Be explicit about `null` and `undefined` anyway; the existing code is.
- **Follow the existing module shape**: `X.module.ts`, `X.controller.ts`, `X.service.ts`, `dto/`, `entities/`. See `src/service/service.module.ts` for the canonical example.
- **Never return an entity from a public route.** The existing `toDto()` mappers return the entity directly (`src/booking/booking.service.ts:60`). That is acceptable behind auth and unacceptable on `/public`, where it would leak `metadata` and customer rows. Public DTOs are explicit allow-lists.
- **Commit after every task.** The plan says exactly what to stage.

---

## File structure

### Backend — created

```
src/common/enums/resource-selection-mode.enum.ts   AUTO | CUSTOMER_CHOICE
src/migrations/20260821000000-ResourceSelectionMode.ts

src/public-booking/
  public-booking.module.ts
  public-booking.controller.ts        thin; every route @Public()
  public-booking.constants.ts         rate-limit constant
  availability/
    interval.ts                       Interval type + subtract/merge/expand
    interval.spec.ts
    slot-math.ts                      windows + busy -> slots; cross-resource merge
    slot-math.spec.ts
    time-zone.ts                      luxon boundary; local wall time -> instant
    time-zone.spec.ts
    availability.service.ts           loads rows, orchestrates the three above
  booking/
    public-booking.service.ts         transactional create
    public-booking.service.spec.ts
  dto/
    public-organization.dto.ts
    public-service.dto.ts
    public-resource.dto.ts
    public-slot.dto.ts
    slot-query.dto.ts
    create-public-booking.dto.ts
    public-booking-response.dto.ts
```

### Backend — modified

```
src/service/entities/service.entity.ts       + resourceSelectionMode column
src/service/dto/create-service.dto.ts        + optional resourceSelectionMode
src/service/dto/update-service.dto.ts        + optional resourceSelectionMode
src/service/dto/service-response.dto.ts      + resourceSelectionMode
src/app.module.ts                            + PublicBookingModule, + publicWrite throttler
backend/README.md                            + public routes, day-of-week convention
```

Splitting `interval.ts` from `slot-math.ts` from `time-zone.ts` is deliberate. Interval arithmetic is where off-by-one bugs live and it deserves tests that construct nothing but numbers. Timezone handling is where DST bugs live and it needs luxon. Keeping them apart means neither test file has to set up the other's concerns.

### Frontend — created

```
frontend/
  src/routes/
    +layout.svelte                    theme, header, footer
    +page.svelte                      slug entry
    [slug]/+layout.ts                 loads org; error(404) on unknown slug
    [slug]/+layout.svelte             org header shell
    [slug]/+page.svelte               service cards
    [slug]/[serviceId]/+page.ts       loads service + resources
    [slug]/[serviceId]/+page.svelte   resource picker, date pager, slot grid, confirm form
    [slug]/booking/[id]/+page.svelte  confirmation
  src/lib/
    api/client.ts                     fetch wrapper, ApiError
    api/types.ts                      GENERATED — do not hand-edit
    time.ts                           date-range helpers
    time.spec.ts
    components/
      ServiceCard.svelte
      ResourcePicker.svelte
      DatePager.svelte
      SlotGrid.svelte
      BookingForm.svelte
  src/app.css                         tailwind + daisyui
```

---

# Part 1 — Backend

At the end of Part 1 the API is complete and testable with curl. Part 2 needs nothing from Part 1 except a running server.

---

### Task 1: The `resource_selection_mode` column

**Files:**
- Create: `backend/src/common/enums/resource-selection-mode.enum.ts`
- Create: `backend/src/migrations/20260821000000-ResourceSelectionMode.ts`
- Modify: `backend/src/service/entities/service.entity.ts`
- Modify: `backend/src/service/dto/create-service.dto.ts`, `update-service.dto.ts`, `service-response.dto.ts`

- [ ] **Step 1: Create the enum**

`backend/src/common/enums/resource-selection-mode.enum.ts`:

```ts
export enum ResourceSelectionMode {
  AUTO = 'AUTO',
  CUSTOMER_CHOICE = 'CUSTOMER_CHOICE',
}
```

- [ ] **Step 2: Write the migration**

Follow the style of `src/migrations/20260820120000-AuthSessions.ts` — raw SQL, `IF NOT EXISTS`, class name suffixed with the timestamp.

`backend/src/migrations/20260821000000-ResourceSelectionMode.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResourceSelectionMode20260821000000 implements MigrationInterface {
  name = 'ResourceSelectionMode20260821000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE services ADD COLUMN IF NOT EXISTS resource_selection_mode
        varchar(50) NOT NULL DEFAULT 'AUTO';
    `);

    await queryRunner.query(`
      ALTER TABLE services DROP CONSTRAINT IF EXISTS chk_service_resource_selection_mode;
    `);
    await queryRunner.query(`
      ALTER TABLE services ADD CONSTRAINT chk_service_resource_selection_mode
        CHECK (resource_selection_mode IN ('AUTO', 'CUSTOMER_CHOICE'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE services DROP CONSTRAINT IF EXISTS chk_service_resource_selection_mode;
    `);
    await queryRunner.query(`
      ALTER TABLE services DROP COLUMN IF EXISTS resource_selection_mode;
    `);
  }
}
```

The CHECK constraint mirrors how the source ERD guards every other enum column (see `chk_service_duration` in `hackathonFromSql_create.sql:183`).

- [ ] **Step 3: Add the entity column**

In `service.entity.ts`, import the enum and add after `isActive`:

```ts
  @Column({
    type: 'varchar',
    length: 50,
    name: 'resource_selection_mode',
    default: ResourceSelectionMode.AUTO,
  })
  resourceSelectionMode: ResourceSelectionMode;
```

- [ ] **Step 4: Expose it on the staff DTOs**

The admin panel will need to set this, so add it now. In `create-service.dto.ts` and `update-service.dto.ts`:

```ts
  @ApiPropertyOptional({ enum: ResourceSelectionMode })
  @IsOptional()
  @IsEnum(ResourceSelectionMode)
  resourceSelectionMode?: ResourceSelectionMode;
```

And a matching required `@ApiProperty({ enum: ResourceSelectionMode })` field on `service-response.dto.ts`.

- [ ] **Step 5: Run the migration**

```bash
cd backend && npm run migration:run
```

Expected: a log line for `ResourceSelectionMode20260821000000`. Verify:

```bash
psql -h localhost -U root -d septem_montes -c "\d services" | grep resource_selection_mode
```

Expected: `resource_selection_mode | character varying(50) | not null | 'AUTO'::character varying`

> The local Postgres container uses `root`/`root`, not the credentials in `.env.example`.

- [ ] **Step 6: Lint and commit**

```bash
cd backend && npm run lint
git add src/common/enums/resource-selection-mode.enum.ts src/migrations/ src/service/
git commit -m "feat(service): add resource_selection_mode so staff choose who picks the resource"
```

---

### Task 2: Interval arithmetic

The foundation. No database, no Nest, no luxon — just numbers.

**Files:**
- Create: `backend/src/public-booking/availability/interval.ts`
- Test: `backend/src/public-booking/availability/interval.spec.ts`

- [ ] **Step 1: Write the failing tests**

`interval.spec.ts`:

```ts
import { expandInterval, mergeIntervals, subtractIntervals } from './interval';

const at = (h: number, m = 0) => Date.UTC(2026, 7, 24, h, m);
const iv = (sh: number, eh: number) => ({ start: at(sh), end: at(eh) });

describe('mergeIntervals', () => {
  it('returns an empty array unchanged', () => {
    expect(mergeIntervals([])).toEqual([]);
  });

  it('sorts and coalesces overlapping intervals', () => {
    expect(mergeIntervals([iv(13, 15), iv(9, 12), iv(11, 14)])).toEqual([
      iv(9, 15),
    ]);
  });

  it('coalesces intervals that merely touch', () => {
    expect(mergeIntervals([iv(9, 12), iv(12, 14)])).toEqual([iv(9, 14)]);
  });

  it('keeps disjoint intervals separate', () => {
    expect(mergeIntervals([iv(9, 10), iv(13, 14)])).toEqual([
      iv(9, 10),
      iv(13, 14),
    ]);
  });
});

describe('subtractIntervals', () => {
  it('returns the base untouched when nothing overlaps', () => {
    expect(subtractIntervals([iv(9, 17)], [iv(18, 19)])).toEqual([iv(9, 17)]);
  });

  it('splits a window when a cut lands in the middle', () => {
    expect(subtractIntervals([iv(9, 17)], [iv(12, 13)])).toEqual([
      iv(9, 12),
      iv(13, 17),
    ]);
  });

  it('trims the leading edge', () => {
    expect(subtractIntervals([iv(9, 17)], [iv(8, 10)])).toEqual([iv(10, 17)]);
  });

  it('trims the trailing edge', () => {
    expect(subtractIntervals([iv(9, 17)], [iv(16, 20)])).toEqual([iv(9, 16)]);
  });

  it('removes a window swallowed whole', () => {
    expect(subtractIntervals([iv(9, 17)], [iv(8, 18)])).toEqual([]);
  });

  it('drops zero-length remnants', () => {
    expect(subtractIntervals([iv(9, 17)], [iv(9, 17)])).toEqual([]);
  });

  it('applies several cuts to several windows', () => {
    expect(
      subtractIntervals([iv(9, 12), iv(13, 17)], [iv(10, 11), iv(14, 16)]),
    ).toEqual([iv(9, 10), iv(11, 12), iv(13, 14), iv(16, 17)]);
  });
});

describe('expandInterval', () => {
  it('widens an interval on both sides', () => {
    const minute = 60_000;
    expect(expandInterval(iv(10, 11), 15 * minute, 30 * minute)).toEqual({
      start: at(9, 45),
      end: at(11, 30),
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && npx jest src/public-booking/availability/interval.spec.ts
```

Expected: FAIL — `Cannot find module './interval'`.

- [ ] **Step 3: Implement**

`interval.ts`:

```ts
/** A half-open interval [start, end) in UTC epoch milliseconds. */
export interface Interval {
  start: number;
  end: number;
}

/** Sorts by start and coalesces anything overlapping or touching. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  // Degenerate intervals are filtered at the root so both callers are covered.
  // They are reachable from valid data: on a DST spring-forward day an
  // UNAVAILABLE 02:00-03:00 exception resolves to the same instant twice.
  const sorted = intervals
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);

  // Checked after filtering: a non-empty all-degenerate input leaves this
  // empty, and `{ ...sorted[0] }` on undefined would silently yield {}.
  if (sorted.length === 0) return [];

  const merged: Interval[] = [{ ...sorted[0] }];

  for (const current of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/**
 * Removes every part of `cuts` from `base`. A cut landing inside a base
 * interval splits it in two. Zero-length remnants are discarded.
 */
export function subtractIntervals(
  base: Interval[],
  cuts: Interval[],
): Interval[] {
  const collapsed = mergeIntervals(cuts);
  let remaining = mergeIntervals(base);

  for (const cut of collapsed) {
    const next: Interval[] = [];

    for (const window of remaining) {
      if (cut.end <= window.start || cut.start >= window.end) {
        next.push(window);
        continue;
      }
      if (window.start < cut.start) {
        next.push({ start: window.start, end: cut.start });
      }
      if (cut.end < window.end) {
        next.push({ start: cut.end, end: window.end });
      }
    }

    remaining = next;
  }

  return remaining.filter((window) => window.end > window.start);
}

/** Widens an interval, used to apply a service's before/after buffers. */
export function expandInterval(
  interval: Interval,
  beforeMs: number,
  afterMs: number,
): Interval {
  return {
    start: interval.start - beforeMs,
    end: interval.end + afterMs,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd backend && npx jest src/public-booking/availability/interval.spec.ts
```

Expected: PASS, 12 tests.

- [ ] **Step 5: Lint and commit**

```bash
cd backend && npm run lint
git add src/public-booking/availability/interval.ts src/public-booking/availability/interval.spec.ts
git commit -m "feat(availability): interval arithmetic for the slot engine"
```

---

### Task 3: Slot generation and cross-resource merge

**Files:**
- Create: `backend/src/public-booking/availability/slot-math.ts`
- Test: `backend/src/public-booking/availability/slot-math.spec.ts`

- [ ] **Step 1: Write the failing tests**

`slot-math.spec.ts`:

```ts
import { computeSlots, mergeResourceSlots } from './slot-math';

const at = (h: number, m = 0) => Date.UTC(2026, 7, 24, h, m);
const iv = (sh: number, eh: number) => ({ start: at(sh), end: at(eh) });
const MIN = 60_000;

describe('computeSlots', () => {
  it('steps a window into back-to-back slots', () => {
    const slots = computeSlots({
      windows: [iv(9, 12)],
      busy: [],
      durationMs: 60 * MIN,
      bufferBeforeMs: 0,
      bufferAfterMs: 0,
      notBefore: 0,
    });

    expect(slots).toEqual([iv(9, 10), iv(10, 11), iv(11, 12)]);
  });

  it('yields nothing when the window is shorter than the duration', () => {
    expect(
      computeSlots({
        windows: [iv(9, 10)],
        busy: [],
        durationMs: 90 * MIN,
        bufferBeforeMs: 0,
        bufferAfterMs: 0,
        notBefore: 0,
      }),
    ).toEqual([]);
  });

  it('drops the partial tail of a window', () => {
    const slots = computeSlots({
      windows: [{ start: at(9), end: at(10, 30) }],
      busy: [],
      durationMs: 60 * MIN,
      bufferBeforeMs: 0,
      bufferAfterMs: 0,
      notBefore: 0,
    });

    expect(slots).toEqual([iv(9, 10)]);
  });

  it('removes slots colliding with a booking', () => {
    const slots = computeSlots({
      windows: [iv(9, 12)],
      busy: [iv(10, 11)],
      durationMs: 60 * MIN,
      bufferBeforeMs: 0,
      bufferAfterMs: 0,
      notBefore: 0,
    });

    expect(slots).toEqual([iv(9, 10), iv(11, 12)]);
  });

  it('widens a booking by the service buffers', () => {
    const slots = computeSlots({
      windows: [iv(9, 12)],
      busy: [iv(10, 11)],
      durationMs: 60 * MIN,
      bufferBeforeMs: 15 * MIN,
      bufferAfterMs: 15 * MIN,
      notBefore: 0,
    });

    // 09:45-11:15 is blocked, so neither the 09:00 nor the 11:00 slot fits.
    expect(slots).toEqual([]);
  });

  it('keeps an exact-fit gap between two bookings', () => {
    const slots = computeSlots({
      windows: [iv(9, 13)],
      busy: [iv(9, 10), iv(11, 13)],
      durationMs: 60 * MIN,
      bufferBeforeMs: 0,
      bufferAfterMs: 0,
      notBefore: 0,
    });

    expect(slots).toEqual([iv(10, 11)]);
  });

  it('steps each surviving window from its own start', () => {
    const slots = computeSlots({
      windows: [iv(9, 11), iv(14, 16)],
      busy: [],
      durationMs: 60 * MIN,
      bufferBeforeMs: 0,
      bufferAfterMs: 0,
      notBefore: 0,
    });

    expect(slots).toEqual([iv(9, 10), iv(10, 11), iv(14, 15), iv(15, 16)]);
  });

  it('drops slots starting before notBefore', () => {
    const slots = computeSlots({
      windows: [iv(9, 12)],
      busy: [],
      durationMs: 60 * MIN,
      bufferBeforeMs: 0,
      bufferAfterMs: 0,
      notBefore: at(10, 30),
    });

    expect(slots).toEqual([iv(11, 12)]);
  });
});

describe('mergeResourceSlots', () => {
  it('collapses a slot free on two resources into one entry', () => {
    const merged = mergeResourceSlots([
      { resourceId: 'r1', slots: [iv(9, 10), iv(10, 11)] },
      { resourceId: 'r2', slots: [iv(10, 11)] },
    ]);

    expect(merged).toEqual([
      { start: at(9), end: at(10), resourceIds: ['r1'] },
      { start: at(10), end: at(11), resourceIds: ['r1', 'r2'] },
    ]);
  });

  it('returns results sorted by start time', () => {
    const merged = mergeResourceSlots([
      { resourceId: 'r1', slots: [iv(14, 15)] },
      { resourceId: 'r2', slots: [iv(9, 10)] },
    ]);

    expect(merged.map((slot) => slot.start)).toEqual([at(9), at(14)]);
  });

  it('handles a resource with no free slots', () => {
    expect(
      mergeResourceSlots([
        { resourceId: 'r1', slots: [] },
        { resourceId: 'r2', slots: [iv(9, 10)] },
      ]),
    ).toEqual([{ start: at(9), end: at(10), resourceIds: ['r2'] }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && npx jest src/public-booking/availability/slot-math.spec.ts
```

Expected: FAIL — `Cannot find module './slot-math'`.

- [ ] **Step 3: Implement**

`slot-math.ts`:

```ts
import {
  expandInterval,
  Interval,
  mergeIntervals,
  subtractIntervals,
} from './interval';

export interface SlotInput {
  /** Availability windows, already resolved against rules and exceptions. */
  windows: Interval[];
  /** Raw busy intervals from existing bookings, before buffers. */
  busy: Interval[];
  durationMs: number;
  bufferBeforeMs: number;
  bufferAfterMs: number;
  /** Slots starting before this instant are discarded. */
  notBefore: number;
}

export interface MergedSlot {
  start: number;
  end: number;
  resourceIds: string[];
}

/**
 * Turns availability windows into bookable slots for a single resource.
 * Busy intervals are widened by the service buffers before being removed, so
 * a booking blocks the padding around it as well as its own span.
 */
export function computeSlots(input: SlotInput): Interval[] {
  // Without this, durationMs <= 0 makes the stepping loop below never advance
  // and it allocates until the process dies (verified: heap OOM at ~4GB).
  // chk_service_duration guards the DB today, but no entity declares @Check,
  // so a SYNCHRONIZE=true run would drop it. The layer owning the loop owns
  // the guard. Return empty rather than throw: a misconfigured service shows
  // no availability instead of 500-ing a public endpoint for everyone.
  if (input.durationMs <= 0) return [];

  const blocked = input.busy.map((interval) =>
    expandInterval(interval, input.bufferBeforeMs, input.bufferAfterMs),
  );

  const free = subtractIntervals(mergeIntervals(input.windows), blocked);
  const slots: Interval[] = [];

  for (const window of free) {
    for (
      let start = window.start;
      start + input.durationMs <= window.end;
      start += input.durationMs
    ) {
      if (start >= input.notBefore) {
        slots.push({ start, end: start + input.durationMs });
      }
    }
  }

  return slots.sort((a, b) => a.start - b.start);
}

/**
 * Collapses per-resource slot lists into one list keyed by start instant.
 * A slot free on three resources appears once, carrying all three ids, so the
 * consumer sees availability rather than inventory.
 */
export function mergeResourceSlots(
  perResource: Array<{ resourceId: string; slots: Interval[] }>,
): MergedSlot[] {
  const byStart = new Map<number, MergedSlot>();

  for (const { resourceId, slots } of perResource) {
    for (const slot of slots) {
      const existing = byStart.get(slot.start);
      if (existing) {
        if (!existing.resourceIds.includes(resourceId)) {
          existing.resourceIds.push(resourceId);
        }
      } else {
        byStart.set(slot.start, {
          start: slot.start,
          end: slot.end,
          resourceIds: [resourceId],
        });
      }
    }
  }

  return [...byStart.values()].sort((a, b) => a.start - b.start);
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd backend && npx jest src/public-booking/availability/slot-math.spec.ts
```

Expected: PASS, 11 tests.

- [ ] **Step 5: Lint and commit**

```bash
cd backend && npm run lint
git add src/public-booking/availability/slot-math.ts src/public-booking/availability/slot-math.spec.ts
git commit -m "feat(availability): generate slots from windows and merge across resources"
```

---

### Task 4: Timezone boundary

The only file that knows about luxon or about wall-clock time. Everything downstream sees epoch milliseconds.

**Files:**
- Create: `backend/src/public-booking/availability/time-zone.ts`
- Test: `backend/src/public-booking/availability/time-zone.spec.ts`
- Modify: `backend/package.json` (add luxon)

- [ ] **Step 1: Install luxon**

```bash
cd backend && npm install luxon && npm install --save-dev @types/luxon
```

- [ ] **Step 2: Write the failing tests**

These pin the two DST behaviours the spec calls out. Europe/Istanbul has been UTC+3 year-round since 2016, so the DST cases use **Europe/Berlin**, which springs forward 02:00→03:00 on 2026-03-29 and falls back 03:00→02:00 on 2026-10-25.

`time-zone.spec.ts`:

```ts
import { eachLocalDate, localDayOfWeek, resolveLocal } from './time-zone';

describe('localDayOfWeek', () => {
  it('returns 0 for Sunday', () => {
    expect(localDayOfWeek('2026-08-23')).toBe(0);
  });

  it('returns 6 for Saturday', () => {
    expect(localDayOfWeek('2026-08-22')).toBe(6);
  });

  it('returns 1 for Monday', () => {
    expect(localDayOfWeek('2026-08-24')).toBe(1);
  });
});

describe('eachLocalDate', () => {
  it('enumerates an inclusive range', () => {
    expect(eachLocalDate('2026-08-24', '2026-08-26')).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
    ]);
  });

  it('returns a single date when from equals to', () => {
    expect(eachLocalDate('2026-08-24', '2026-08-24')).toEqual(['2026-08-24']);
  });

  it('returns empty when to precedes from', () => {
    expect(eachLocalDate('2026-08-26', '2026-08-24')).toEqual([]);
  });

  it('crosses a month boundary', () => {
    expect(eachLocalDate('2026-08-30', '2026-09-01')).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
    ]);
  });
});

describe('resolveLocal', () => {
  it('converts a plain local time to the right instant', () => {
    const millis = resolveLocal('2026-08-24', '09:00:00', 'Europe/Istanbul');
    expect(new Date(millis).toISOString()).toBe('2026-08-24T06:00:00.000Z');
  });

  it('honours a different zone for the same wall time', () => {
    const millis = resolveLocal('2026-08-24', '09:00:00', 'UTC');
    expect(new Date(millis).toISOString()).toBe('2026-08-24T09:00:00.000Z');
  });

  it('shifts a non-existent spring-forward time past the gap', () => {
    // 02:30 never happens on 2026-03-29 in Berlin: the clock jumps 02:00 to
    // 03:00. Luxon moves it forward by the offset, landing on 03:30 local.
    // This expectation was verified against luxon, not assumed.
    const millis = resolveLocal('2026-03-29', '02:30:00', 'Europe/Berlin');
    expect(new Date(millis).toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });

  it('picks the earlier occurrence of an ambiguous time by default', () => {
    // 02:30 happens twice on 2026-10-25 in Berlin.
    const millis = resolveLocal('2026-10-25', '02:30:00', 'Europe/Berlin');
    expect(new Date(millis).toISOString()).toBe('2026-10-25T00:30:00.000Z');
  });

  it('picks the later occurrence when asked', () => {
    const millis = resolveLocal(
      '2026-10-25',
      '02:30:00',
      'Europe/Berlin',
      'latest',
    );
    expect(new Date(millis).toISOString()).toBe('2026-10-25T01:30:00.000Z');
  });

  it('is unaffected by prefer on an unambiguous time', () => {
    expect(resolveLocal('2026-08-24', '09:00:00', 'UTC', 'latest')).toBe(
      resolveLocal('2026-08-24', '09:00:00', 'UTC', 'earliest'),
    );
  });

  it('throws on an unknown zone', () => {
    expect(() => resolveLocal('2026-08-24', '09:00:00', 'Mars/Olympus')).toThrow(
      /Mars\/Olympus/,
    );
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
cd backend && npx jest src/public-booking/availability/time-zone.spec.ts
```

Expected: FAIL — `Cannot find module './time-zone'`.

- [ ] **Step 4: Implement**

`time-zone.ts`:

```ts
import { DateTime, IANAZone } from 'luxon';

/** How to resolve a local time that occurs twice on a DST fall-back day. */
export type AmbiguityPreference = 'earliest' | 'latest';

const LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm:ss";
const DAY_MS = 86_400_000;

/**
 * Day of week for a calendar date, 0 = Sunday through 6 = Saturday.
 *
 * `chk_availability_day` permits 0-6 without pinning a meaning. This project
 * fixes 0 = Sunday, matching Postgres EXTRACT(DOW) and JavaScript getDay().
 * The admin panel's availability editor must agree.
 */
export function localDayOfWeek(date: string): number {
  const parsed = DateTime.fromISO(date, { zone: 'utc' });
  if (!parsed.isValid) throw new Error(`Invalid date: ${date}`);
  // Luxon numbers weekdays 1 = Monday through 7 = Sunday.
  return parsed.weekday % 7;
}

/** Every calendar date from `from` to `to`, inclusive. Empty if reversed. */
export function eachLocalDate(from: string, to: string): string[] {
  const start = DateTime.fromISO(from, { zone: 'utc' });
  const end = DateTime.fromISO(to, { zone: 'utc' });
  if (!start.isValid) throw new Error(`Invalid date: ${from}`);
  if (!end.isValid) throw new Error(`Invalid date: ${to}`);

  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = cursor.plus({ days: 1 })) {
    dates.push(cursor.toFormat('yyyy-MM-dd'));
  }
  return dates;
}

/**
 * Converts a local wall-clock time on a calendar date into a UTC instant.
 *
 * Two DST cases are resolved deliberately rather than left to library default:
 *
 * - **Non-existent** (spring forward). 02:30 does not occur on a day the clock
 *   jumps 02:00 to 03:00. Luxon shifts such a time forward by the offset, so
 *   02:30 resolves to 03:30 local. A window boundary therefore survives the
 *   gap rather than vanishing. Only a business open across 02:00 can reach
 *   this case at all. Pinned by test rather than assumed.
 * - **Ambiguous** (fall back). 02:30 occurs twice. Luxon publishes NO
 *   disambiguation guarantee: it lands on the earlier occurrence in northern
 *   zones and the LATER one in ~13 southern ones (Sydney, Auckland, Lord
 *   Howe, Santiago...). So both directions are probed explicitly. Callers
 *   pass 'latest' for a window's *end* so a 09:00-17:00 rule spans the
 *   repeated hour instead of closing early.
 */
export function resolveLocal(
  date: string,
  time: string,
  zone: string,
  prefer: AmbiguityPreference = 'earliest',
): number {
  // Luxon accepts 'local' and 'system' as zone names and silently resolves
  // them to the API SERVER's timezone. IANAZone.isValidZone rejects both
  // while still accepting 'utc', the organizations.timezone column default.
  if (!IANAZone.isValidZone(zone)) {
    throw new Error(`Unsupported timezone: ${zone}`);
  }

  const local = `${date}T${normalizeTime(time)}`;
  const parsed = DateTime.fromISO(local, { zone });

  if (!parsed.isValid) {
    throw new Error(
      `Cannot resolve ${local} in zone ${zone}: ${parsed.invalidReason ?? 'unknown'}`,
    );
  }

  const wall = parsed.toFormat(LOCAL_FORMAT);
  const millis = parsed.toMillis();

  // Probe BOTH directions -- luxon's choice is zone-dependent, so 'earliest'
  // cannot just return what it gave us. Compare against the resolved wall
  // clock rather than the raw input, so a HH:mm:ss.SSS input still matches.
  // [30, 60, 120] is the complete set of tzdb transition sizes for 2026-2035
  // (30 = Lord Howe, 60 = the world, 120 = Antarctica/Troll).
  const direction = prefer === 'latest' ? 1 : -1;
  for (const deltaMinutes of [30, 60, 120]) {
    const candidate = millis + direction * deltaMinutes * 60_000;
    if (DateTime.fromMillis(candidate, { zone }).toFormat(LOCAL_FORMAT) === wall) {
      return candidate;
    }
  }

  return millis;
}

/** Midnight-to-midnight bounds of a local date, as UTC instants. */
export function localDayBounds(
  date: string,
  zone: string,
): { start: number; end: number } {
  const start = resolveLocal(date, '00:00:00', zone, 'earliest');
  const next = DateTime.fromISO(date, { zone: 'utc' })
    .plus({ days: 1 })
    .toFormat('yyyy-MM-dd');
  return { start, end: resolveLocal(next, '00:00:00', zone, 'earliest') };
}

/** Postgres `time` columns arrive as HH:mm:ss; tolerate HH:mm too. */
function normalizeTime(time: string): string {
  const parts = time.split(':');
  if (parts.length === 2) return `${time}:00`;
  return time;
}

export { DAY_MS };
```

> `resolveLocal` throws on an unknown zone because luxon marks the DateTime
> invalid with `unsupported zone`. The test asserts the zone name appears in the
> message, which the template above satisfies.

- [ ] **Step 5: Run to verify it passes**

```bash
cd backend && npx jest src/public-booking/availability/time-zone.spec.ts
```

Expected: PASS, 14 tests.

The Berlin and Istanbul fixtures were verified against luxon before this plan
was written. **That verification was too narrow.** Berlin is a northern
60-minute zone, and testing only northern zones hid a real defect: luxon
returns the *later* occurrence for ambiguous times in 13 southern zones, so an
unprobed `'earliest'` silently returned the wrong instant there. Add at least
one southern-hemisphere and one 30-minute-shift assertion. To re-confirm any
fixture: 

```bash
cd backend && npx ts-node -e "const {DateTime}=require('luxon'); for (const d of ['2026-03-29T01:30','2026-03-29T03:30','2026-10-25T01:30','2026-10-25T03:30']) console.log(d, DateTime.fromISO(d,{zone:'Europe/Berlin'}).toISO());"
```

- [ ] **Step 6: Lint and commit**

```bash
cd backend && npm run lint
git add package.json package-lock.json src/public-booking/availability/time-zone.ts src/public-booking/availability/time-zone.spec.ts
git commit -m "feat(availability): timezone boundary with explicit DST resolution"
```

---

### Task 5: The availability service

Loads rows and orchestrates the three pure modules. This is the first file that touches the database.

**Files:**
- Create: `backend/src/public-booking/availability/availability.service.ts`

- [ ] **Step 1: Write the service**

No unit test for this one. It is thin orchestration over three modules that are already tested hard, and testing it properly means a database. Task 8 covers the integration path through the booking service.

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AvailabilityException } from '../../availability-exception/entities/availability-exception.entity';
import { AvailabilityRule } from '../../availability-rule/entities/availability-rule.entity';
import { Booking } from '../../booking/entities/booking.entity';
import { BookingResource } from '../../booking-resource/entities/booking-resource.entity';
import { AvailabilityExceptionType } from '../../common/enums/availability-exception-type.enum';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { ResourceStatus } from '../../common/enums/resource-status.enum';
import { Resource } from '../../resource/entities/resource.entity';
import { Service } from '../../service/entities/service.entity';
import { ServiceResource } from '../../service-resource/entities/service-resource.entity';
import { Interval, mergeIntervals, subtractIntervals } from './interval';
import { computeSlots, MergedSlot, mergeResourceSlots } from './slot-math';
import { eachLocalDate, localDayOfWeek, resolveLocal } from './time-zone';

const MINUTE_MS = 60_000;

export interface SlotSearch {
  service: Service;
  organizationTimezone: string;
  from: string;
  to: string;
  resourceId?: string;
  now: number;
}

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(Resource)
    private readonly resources: Repository<Resource>,
    @InjectRepository(ServiceResource)
    private readonly serviceResources: Repository<ServiceResource>,
    @InjectRepository(AvailabilityRule)
    private readonly rules: Repository<AvailabilityRule>,
    @InjectRepository(AvailabilityException)
    private readonly exceptions: Repository<AvailabilityException>,
    @InjectRepository(BookingResource)
    private readonly bookingResources: Repository<BookingResource>,
  ) {}

  /** ACTIVE resources capable of performing this service. */
  async capableResources(serviceId: string): Promise<Resource[]> {
    const links = await this.serviceResources.find({ where: { serviceId } });
    if (links.length === 0) return [];

    return this.resources.find({
      where: {
        id: In(links.map((link) => link.resourceId)),
        status: ResourceStatus.ACTIVE,
      },
      order: { name: 'ASC' },
    });
  }

  async findSlots(search: SlotSearch): Promise<MergedSlot[]> {
    const resources = await this.resolveResources(search);
    if (resources.length === 0) return [];

    const perResource = await Promise.all(
      resources.map(async (resource) => ({
        resourceId: resource.id,
        slots: await this.slotsForResource(resource, search),
      })),
    );

    return mergeResourceSlots(perResource);
  }

  /** True when this exact instant is still bookable on this resource. */
  async isSlotFree(
    resourceId: string,
    startsAt: number,
    search: SlotSearch,
  ): Promise<boolean> {
    const resource = await this.resources.findOne({
      where: { id: resourceId, status: ResourceStatus.ACTIVE },
    });
    if (!resource) return false;

    const slots = await this.slotsForResource(resource, search);
    return slots.some((slot) => slot.start === startsAt);
  }

  private async resolveResources(search: SlotSearch): Promise<Resource[]> {
    const capable = await this.capableResources(search.service.id);
    if (!search.resourceId) return capable;
    return capable.filter((resource) => resource.id === search.resourceId);
  }

  private async slotsForResource(
    resource: Resource,
    search: SlotSearch,
  ): Promise<Interval[]> {
    const windows = await this.windowsForResource(resource, search);
    if (windows.length === 0) return [];

    const busy = await this.busyForResource(resource.id, windows);

    return computeSlots({
      windows,
      busy,
      durationMs: search.service.durationMinutes * MINUTE_MS,
      bufferBeforeMs: search.service.bufferBeforeMinutes * MINUTE_MS,
      bufferAfterMs: search.service.bufferAfterMinutes * MINUTE_MS,
      notBefore: search.now,
    });
  }

  /**
   * Availability windows for one resource across the requested dates.
   * UNAVAILABLE exceptions are subtracted first and AVAILABLE ones unioned
   * after, so an explicit opening always beats an overlapping block.
   */
  private async windowsForResource(
    resource: Resource,
    search: SlotSearch,
  ): Promise<Interval[]> {
    const dates = eachLocalDate(search.from, search.to);
    if (dates.length === 0) return [];

    const [rules, exceptions] = await Promise.all([
      this.rules.find({ where: { resourceId: resource.id, isActive: true } }),
      this.exceptions.find({
        where: { resourceId: resource.id, exceptionDate: In(dates) },
      }),
    ]);

    let windows: Interval[] = [];
    const blocks: Interval[] = [];
    const openings: Interval[] = [];

    for (const date of dates) {
      const weekday = localDayOfWeek(date);

      for (const rule of rules) {
        if (rule.dayOfWeek !== weekday) continue;
        const zone = rule.timezone ?? search.organizationTimezone;
        windows.push({
          start: resolveLocal(date, rule.startTime, zone, 'earliest'),
          end: resolveLocal(date, rule.endTime, zone, 'latest'),
        });
      }

      for (const exception of exceptions) {
        if (exception.exceptionDate !== date) continue;
        const zone = search.organizationTimezone;
        const interval = {
          start: resolveLocal(date, exception.startTime, zone, 'earliest'),
          end: resolveLocal(date, exception.endTime, zone, 'latest'),
        };
        if (exception.exceptionType === AvailabilityExceptionType.UNAVAILABLE) {
          blocks.push(interval);
        } else {
          openings.push(interval);
        }
      }
    }

    windows = subtractIntervals(windows, blocks);
    return mergeIntervals([...windows, ...openings]);
  }

  /** Non-cancelled bookings occupying this resource inside the search range. */
  private async busyForResource(
    resourceId: string,
    windows: Interval[],
  ): Promise<Interval[]> {
    const rangeStart = Math.min(...windows.map((w) => w.start));
    const rangeEnd = Math.max(...windows.map((w) => w.end));

    const rows = await this.bookingResources
      .createQueryBuilder('br')
      .innerJoinAndSelect('br.booking', 'booking')
      .where('br.resource_id = :resourceId', { resourceId })
      .andWhere('booking.status != :cancelled', {
        cancelled: BookingStatus.CANCELLED,
      })
      .andWhere('booking.starts_at < :rangeEnd', {
        rangeEnd: new Date(rangeEnd),
      })
      .andWhere('booking.ends_at > :rangeStart', {
        rangeStart: new Date(rangeStart),
      })
      .getMany();

    return rows
      .map((row) => row.booking)
      .filter((booking): booking is Booking => Boolean(booking))
      .map((booking) => ({
        start: booking.startsAt.getTime(),
        end: booking.endsAt.getTime(),
      }));
  }
}
```

> Note the buffer asymmetry: buffers widen *existing bookings* when subtracting
> them, which is what stops a new booking landing inside another's padding. The
> new booking's own padding is applied by the same rule when the *next* consumer
> searches.

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 3: Lint and commit**

```bash
cd backend && npm run lint
git add src/public-booking/availability/availability.service.ts
git commit -m "feat(availability): load rules, exceptions and bookings into the slot engine"
```

---

### Task 6: Public DTOs

Explicit allow-lists. Nothing here passes an entity through.

**Files:**
- Create: all seven files under `backend/src/public-booking/dto/`

- [ ] **Step 1: Write the response DTOs**

Each is a class with `@ApiProperty` decorators so Swagger documents `/public`, and each lists fields explicitly. `public-organization.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';

export class PublicOrganizationDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty({ example: 'Europe/Istanbul' }) timezone: string;
}
```

`public-service.dto.ts` — `id`, `name`, `description` (nullable), `durationMinutes`, `resourceSelectionMode`.

`public-resource.dto.ts` — `id`, `name`, `resourceType` (nullable). Nothing else; `metadata` stays private.

`public-slot.dto.ts` — `startsAt` and `endsAt` as ISO-8601 UTC strings, plus `resourceIds: string[]`.

`public-booking-response.dto.ts` — `bookingId`, `startsAt`, `endsAt`, `status`, `serviceName`, `resourceName`.

- [ ] **Step 2: Write the request DTOs**

`slot-query.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class SlotQueryDto {
  @ApiProperty({ example: '2026-08-24', description: 'Local date in the org timezone' })
  @Matches(ISO_DATE, { message: 'from must be YYYY-MM-DD' })
  from: string;

  @ApiProperty({ example: '2026-08-30' })
  @Matches(ISO_DATE, { message: 'to must be YYYY-MM-DD' })
  to: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  resourceId?: string;
}
```

`create-public-booking.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PublicCustomerDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  phone?: string;
}

export class CreatePublicBookingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  serviceId: string;

  @ApiProperty({ description: 'Must match a slot start exactly' })
  @IsDateString()
  startsAt: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @ApiProperty({ type: PublicCustomerDto })
  @ValidateNested()
  @Type(() => PublicCustomerDto)
  customer: PublicCustomerDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
```

`organizationId` is deliberately absent — it comes from the slug. `main.ts` sets `forbidNonWhitelisted`, so a client sending it gets a 400 rather than silently having it ignored.

- [ ] **Step 3: Lint and commit**

```bash
cd backend && npm run lint
git add src/public-booking/dto/
git commit -m "feat(public-booking): request and response DTOs as explicit allow-lists"
```

---

### Task 7: Transactional booking creation

The riskiest code in the backend. Tested first.

**Files:**
- Create: `backend/src/public-booking/booking/public-booking.service.ts`
- Test: `backend/src/public-booking/booking/public-booking.service.spec.ts`
- Create: `backend/src/public-booking/public-booking.constants.ts`

- [ ] **Step 1: Write the failing tests**

Mock the repositories and the `DataSource` transaction. The point is the conflict logic, not TypeORM.

```ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { ResourceSelectionMode } from '../../common/enums/resource-selection-mode.enum';
import { PublicBookingService } from './public-booking.service';

// See the implementation step for the exact collaborator shape. Build a
// helper that returns { service, availability, manager } doubles so each test
// states only what it changes.

describe('PublicBookingService.create', () => {
  it('creates a PENDING booking on the first free resource', async () => {
    // availability.isSlotFree -> true for r1
    // expect: booking saved with status PENDING, created_by_user_id null,
    //         one booking_resources row for r1, one CREATED booking_event
  });

  it('returns 409 when the chosen resource is taken', async () => {
    // mode CUSTOMER_CHOICE, resourceId r1, isSlotFree -> false
    // expect: rejects with ConflictException
  });

  it('falls through to the next capable resource under AUTO', async () => {
    // mode AUTO, capable [r1, r2], isSlotFree false for r1 and true for r2
    // expect: booking_resources row for r2
  });

  it('returns 409 under AUTO when every resource is taken', async () => {
    // mode AUTO, capable [r1, r2], isSlotFree -> false for both
    // expect: rejects with ConflictException
  });

  it('reuses an existing customer with the same org and email', async () => {
    // customers.findOne -> existing row
    // expect: no insert, name and phone updated on the existing row
  });

  it('creates a customer when the email is new to the org', async () => {
    // customers.findOne -> null
    // expect: insert with the org id from the slug
  });

  it('rejects an inactive service', async () => {
    // service.isActive false -> NotFoundException
  });

  it('rejects a resourceId that cannot perform the service', async () => {
    // capableResources does not include the requested id -> NotFoundException
  });
});
```

Fill each body in following the shape of `src/user/user-access.policy.spec.ts` — small typed builders at the top, one assertion per test.

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && npx jest src/public-booking/booking/public-booking.service.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`public-booking.constants.ts`:

```ts
export const PUBLIC_BOOKING_RATE_LIMIT = { limit: 10, ttl: 60_000 };
/** Widest slot search a single request may ask for. */
export const MAX_SLOT_RANGE_DAYS = 31;
```

`public-booking.service.ts` runs this sequence inside `dataSource.transaction`:

1. Resolve the organization by slug; `NotFoundException` if missing.
2. Resolve the service within that organization; `NotFoundException` if missing or `isActive` is false.
3. Build the candidate resource list. Under `CUSTOMER_CHOICE` with a `resourceId`, that is the single resource, and a `NotFoundException` if it is not capable. Otherwise every capable resource, in name order.
4. For each candidate, in order:
   - `SELECT … FOR UPDATE` the resource row through the transaction manager:
     ```ts
     await manager
       .createQueryBuilder(Resource, 'resource')
       .setLock('pessimistic_write')
       .where('resource.id = :id', { id: candidate.id })
       .getOne();
     ```
   - Re-derive availability for that instant via `availability.isSlotFree`.
   - Take the first that is still free. If none is, throw `ConflictException('That time was just taken')`.
5. Upsert the customer on `(organizationId, email)` — lowercase the email before matching, since the repo already normalises emails elsewhere. Update `name` and `phone` on an existing row.
6. Insert the booking: `status = PENDING`, `createdByUserId = null`, `endsAt = startsAt + durationMinutes`, `title = service.name`.
7. Insert the `booking_resources` row for the winning resource.
8. Insert a `booking_events` row with `eventType = CREATED`.
9. Return a `PublicBookingResponseDto`.

Step 4 is the whole point. Without the lock and the re-check, two consumers holding the same slot list both pass validation and the resource is double-booked.

- [ ] **Step 4: Run to verify it passes**

```bash
cd backend && npx jest src/public-booking/booking/public-booking.service.spec.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Lint and commit**

```bash
cd backend && npm run lint
git add src/public-booking/booking/ src/public-booking/public-booking.constants.ts
git commit -m "feat(public-booking): transactional create with per-resource lock and re-check"
```

---

### Task 8: Controller and module wiring

**Files:**
- Create: `backend/src/public-booking/public-booking.controller.ts`, `public-booking.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Write the controller**

Thin — resolve, delegate, map. Every route carries `@Public()`, and the class carries `@ApiTags('Public booking')`. Mirror the `@Throttle` pattern from `src/auth/auth.controller.ts:45`.

```ts
@Public()
@Post('orgs/:slug/bookings')
@HttpCode(HttpStatus.CREATED)
@Throttle({ publicWrite: PUBLIC_BOOKING_RATE_LIMIT })
@ApiOperation({ summary: 'Book a slot as a guest' })
@ApiResponse({ status: HttpStatus.CREATED, type: PublicBookingResponseDto })
@ApiResponse({ status: HttpStatus.CONFLICT, description: 'Slot already taken' })
create(
  @Param('slug') slug: string,
  @Body() dto: CreatePublicBookingDto,
): Promise<PublicBookingResponseDto> {
  return this.bookings.create(slug, dto);
}
```

The four read routes stay on the `default` throttler and need no `@Throttle`.

The slots route validates the range before doing any work:

```ts
const dates = eachLocalDate(query.from, query.to);
if (dates.length === 0 || dates.length > MAX_SLOT_RANGE_DAYS) {
  throw new BadRequestException(
    `Date range must cover 1 to ${MAX_SLOT_RANGE_DAYS} days`,
  );
}
```

The resources route returns `404` unless the service is `CUSTOMER_CHOICE`, so an `AUTO` service never leaks staff names.

- [ ] **Step 2: Write the module**

Follow `src/service/service.module.ts`. `TypeOrmModule.forFeature` needs: `Organization`, `Service`, `Resource`, `ServiceResource`, `AvailabilityRule`, `AvailabilityException`, `Booking`, `BookingResource`, `BookingEvent`, `Customer`.

- [ ] **Step 3: Register the module and the throttler**

In `app.module.ts`, add `PublicBookingModule` to `imports`, and a third throttler alongside the existing two:

```ts
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60_000, limit: 300 },
        { name: 'login', ttl: 60_000, limit: 10 },
        { name: 'publicWrite', ttl: 60_000, limit: 10 },
      ],
    }),
```

- [ ] **Step 4: Verify the guard actually lets these through**

Start the server and confirm both the public path and the still-protected path:

```bash
cd backend && npm run start:dev
```

In another shell:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3005/public/orgs/septem-montes
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3005/services
```

Expected: `200` then `401`. The second matters as much as the first — it proves `@Public()` was scoped to the new controller and did not leak onto the staff routes.

- [ ] **Step 5: Commit**

```bash
cd backend && npm run lint && npm test
git add src/public-booking/ src/app.module.ts
git commit -m "feat(public-booking): expose the guest booking API under /public"
```

---

### Task 9: Seed data and an end-to-end curl pass

Nothing so far has proved the engine works against real rows.

**Files:**
- Create: `backend/scripts/seed-demo.ts`
- Create: `backend/src/migrations/20260821120000-ResourceOrganizationCheck.ts`

- [ ] **Step 0: Close the duplicate-organization-column hole**

`resources` carries **both** `organization_id` and `organizations_id` as NOT NULL
foreign keys to `organizations`, with nothing forcing them equal:

```
"fk_resources_organization"  FOREIGN KEY (organization_id)  REFERENCES organizations(id) ON DELETE CASCADE
"resources_organizations"    FOREIGN KEY (organizations_id) REFERENCES organizations(id)
```

The public booking service scopes its tenant check on `organization_id`, so a row
where the two disagree is a second door on the tenant boundary. Nothing has
diverged yet — the table is empty — which is exactly why the constraint is cheap
to add now:

```sql
ALTER TABLE resources DROP CONSTRAINT IF EXISTS chk_resources_organization_match;
ALTER TABLE resources ADD CONSTRAINT chk_resources_organization_match
  CHECK (organization_id = organizations_id);
```

Dropping the redundant column would be cleaner, but it exists in the source ERD
and the staff-side code writes it, so the constraint is the contained fix. The
seed script below must set both columns to the same value.

- [ ] **Step 1: Write a seed script**

Follow the shape of `scripts/set-password.ts`. It creates, idempotently: an organization `demo` with timezone `Europe/Istanbul`; two resources (`Room A`, `Room B`, both ACTIVE, setting **both** `organization_id` and `organizations_id` — the ERD quirk noted in the backend README); `availability_rules` for weekdays 1–5, 09:00–17:00 on both; one service `Consultation` at 60 minutes with `AUTO`; one service `Haircut` at 30 minutes with `CUSTOMER_CHOICE`; and `service_resources` linking both services to both resources.

Add to `package.json` scripts:

```json
"seed:demo": "ts-node ./scripts/seed-demo.ts"
```

- [ ] **Step 2: Run it**

```bash
cd backend && npm run seed:demo
```

- [ ] **Step 3: Walk the whole flow with curl**

```bash
curl -s http://localhost:3005/public/orgs/demo | jq
curl -s http://localhost:3005/public/orgs/demo/services | jq
SERVICE=$(curl -s http://localhost:3005/public/orgs/demo/services | jq -r '.[0].id')
curl -s "http://localhost:3005/public/orgs/demo/services/$SERVICE/slots?from=2026-08-24&to=2026-08-28" | jq '.[0:3]'
```

Expected: slots on the hour from `06:00:00.000Z` (09:00 Istanbul), each carrying two `resourceIds`.

- [ ] **Step 4: Book one, then prove it disappeared**

```bash
SLOT=$(curl -s "http://localhost:3005/public/orgs/demo/services/$SERVICE/slots?from=2026-08-24&to=2026-08-24" | jq -r '.[0].startsAt')

curl -s -X POST http://localhost:3005/public/orgs/demo/bookings \
  -H 'Content-Type: application/json' \
  -d "{\"serviceId\":\"$SERVICE\",\"startsAt\":\"$SLOT\",\"customer\":{\"name\":\"Test Guest\",\"email\":\"guest@example.com\"}}" | jq
```

Expected: `201` with a `bookingId` and `status: "PENDING"`.

Book the same slot twice more. The second call should succeed on the other resource; the third should return **409**. That single sequence exercises auto-assignment, fall-through, and exhaustion together.

- [ ] **Step 5: Confirm the range cap**

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  "http://localhost:3005/public/orgs/demo/services/$SERVICE/slots?from=2026-08-01&to=2026-12-01"
```

Expected: `400`.

- [ ] **Step 6: Commit**

```bash
cd backend && npm run lint
git add scripts/seed-demo.ts package.json
git commit -m "chore(backend): demo seed script for the public booking flow"
```

---

### Task 10: Document the backend

**Files:**
- Modify: `backend/README.md`

- [ ] **Step 1: Add a "Public booking" section**

Place it after the Auth section. Cover: the five routes in a table; that these are the only unauthenticated business routes; the org-timezone rule; the `resource_selection_mode` semantics; and the **day-of-week convention (0 = Sunday)**, which the admin panel must match.

- [ ] **Step 2: Add the two new items to Notes**

The `publicWrite` throttler, and the deferred exclusion constraint on `booking_resources`.

- [ ] **Step 3: Commit**

```bash
git add backend/README.md
git commit -m "docs(backend): document the public booking API and the day-of-week convention"
```

**Checkpoint.** The backend is complete. `npm test` passes, the flow works via curl, and Part 2 needs nothing further from it.

---

# Part 2 — Frontend

---

### Task 11: Scaffold SvelteKit with Tailwind and DaisyUI

**Files:**
- Create: `frontend/` (generated), `frontend/src/app.css`

- [ ] **Step 1: Scaffold**

From the repository root:

```bash
npx sv create frontend
```

Choose: **SvelteKit minimal**, **TypeScript**, and add **prettier**, **eslint**, **vitest**, **tailwindcss**. Decline the rest.

```bash
cd frontend && npm install
```

- [ ] **Step 2: Add DaisyUI**

```bash
cd frontend && npm install -D daisyui@latest
```

In `src/app.css`, below the Tailwind import:

```css
@import 'tailwindcss';
@plugin 'daisyui' {
  themes: light --default, dark --prefersdark;
}
```

Tailwind v4 takes plugins through CSS, so there is no `tailwind.config.js` to edit.

- [ ] **Step 3: Prove it renders**

Put a DaisyUI component in `src/routes/+page.svelte`:

```svelte
<button class="btn btn-primary">Styled</button>
```

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`. Expected: a filled, rounded primary button — not an unstyled one. An unstyled button means the `@plugin` line did not take.

- [ ] **Step 4: Commit**

```bash
git add frontend/
git commit -m "chore(frontend): scaffold SvelteKit with Tailwind v4 and DaisyUI"
```

> `CORS_ORIGINS` already defaults to `http://localhost:5173`, so no backend change is needed.

---

### Task 12: API client and generated types

**Files:**
- Create: `frontend/src/lib/api/client.ts`
- Generate: `frontend/src/lib/api/types.ts`

- [ ] **Step 1: Generate the types**

With the backend running:

```bash
cd frontend && npm install -D openapi-typescript
npx openapi-typescript http://localhost:3005/api-json -o src/lib/api/types.ts
```

Add to `package.json` scripts so it is repeatable:

```json
"gen:api": "openapi-typescript http://localhost:3005/api-json -o src/lib/api/types.ts"
```

Add a header comment to the generated file noting it is generated and how.

- [ ] **Step 2: Write the client**

`src/lib/api/client.ts` exports an `ApiError` carrying `status` and the parsed body, and an `api()` helper. It takes SvelteKit's `fetch` as its first argument so `load` functions pass theirs, which is what makes SSR work.

```ts
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3005';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(
  fetchFn: typeof fetch,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetchFn(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new ApiError(response.status, body, extractMessage(body, response));
  }

  return response.json() as Promise<T>;
}
```

`extractMessage` unwraps the shape `AllExceptionsFilter` produces —
`{ statusCode, timestamp, path, message }`, where `message` is either a string
or a `class-validator` array. Return a joined string in both cases.

Note there is no `credentials: 'include'` here. These routes are unauthenticated
by design. Add it when the admin panel arrives.

- [ ] **Step 3: Add the env file**

`frontend/.env`:

```
VITE_API_URL=http://localhost:3005
```

Confirm `.env` is gitignored, and commit a `.env.example` alongside it.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api/ frontend/package.json frontend/.env.example
git commit -m "feat(frontend): typed API client generated from the OpenAPI schema"
```

---

### Task 13: Date helpers

The one piece of frontend logic worth a test.

**Files:**
- Create: `frontend/src/lib/time.ts`
- Test: `frontend/src/lib/time.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { formatInZone, groupSlotsByLocalDay, weekFrom } from './time';

describe('weekFrom', () => {
  it('returns seven consecutive dates', () => {
    expect(weekFrom('2026-08-24')).toEqual({
      from: '2026-08-24',
      to: '2026-08-30',
    });
  });

  it('crosses a month boundary', () => {
    expect(weekFrom('2026-08-30')).toEqual({
      from: '2026-08-30',
      to: '2026-09-05',
    });
  });
});

describe('formatInZone', () => {
  it('renders a UTC instant in the org timezone', () => {
    expect(formatInZone('2026-08-24T06:00:00.000Z', 'Europe/Istanbul')).toBe(
      '09:00',
    );
  });
});

describe('groupSlotsByLocalDay', () => {
  it('buckets slots by their date in the org timezone', () => {
    const slots = [
      { startsAt: '2026-08-24T06:00:00.000Z', endsAt: '', resourceIds: [] },
      { startsAt: '2026-08-24T07:00:00.000Z', endsAt: '', resourceIds: [] },
      { startsAt: '2026-08-25T06:00:00.000Z', endsAt: '', resourceIds: [] },
    ];

    const grouped = groupSlotsByLocalDay(slots, 'Europe/Istanbul');
    expect([...grouped.keys()]).toEqual(['2026-08-24', '2026-08-25']);
    expect(grouped.get('2026-08-24')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend && npx vitest run src/lib/time.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Use `Intl.DateTimeFormat` with the `timeZone` option. No luxon on the frontend — the backend already did the hard conversion, and the frontend only formats instants it was given.

- [ ] **Step 4: Run to verify it passes, then commit**

```bash
cd frontend && npx vitest run src/lib/time.spec.ts
git add frontend/src/lib/time.ts frontend/src/lib/time.spec.ts
git commit -m "feat(frontend): date-range and timezone formatting helpers"
```

---

### Task 14: Organization shell and service list

**Files:**
- Create: `frontend/src/routes/[slug]/+layout.ts`, `+layout.svelte`, `+page.svelte`
- Create: `frontend/src/lib/components/ServiceCard.svelte`
- Modify: `frontend/src/routes/+layout.svelte`, `+page.svelte`

- [ ] **Step 1: Load the organization**

`[slug]/+layout.ts`:

```ts
import { error } from '@sveltejs/kit';
import { api, ApiError } from '$lib/api/client';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ fetch, params }) => {
  try {
    const organization = await api<PublicOrganization>(
      fetch,
      `/public/orgs/${params.slug}`,
    );
    return { organization };
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) {
      error(404, 'We could not find that organization');
    }
    throw cause;
  }
};
```

- [ ] **Step 2: Build the shell and the list**

`[slug]/+layout.svelte` renders the org name in a DaisyUI `navbar` and slots the page beneath. `[slug]/+page.svelte` loads services in its own `+page.ts` and renders a `ServiceCard` grid — DaisyUI `card` with name, description, and a duration `badge`, linking to `/{slug}/{serviceId}`.

Add an empty state for an org with no active services. Do not leave a bare page.

- [ ] **Step 3: Verify both paths in the browser**

Visit `/demo` — expect two service cards. Visit `/nope` — expect the 404 page, not a crash or a blank screen.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/ frontend/src/lib/components/
git commit -m "feat(frontend): organization shell and service list"
```

---

### Task 15: Slot picker

The screen that carries the feature.

**Files:**
- Create: `frontend/src/routes/[slug]/[serviceId]/+page.ts`, `+page.svelte`
- Create: `frontend/src/lib/components/DatePager.svelte`, `SlotGrid.svelte`, `ResourcePicker.svelte`

- [ ] **Step 1: Load the service, and resources when relevant**

`+page.ts` fetches the service, and fetches `/resources` **only** when `resourceSelectionMode === 'CUSTOMER_CHOICE'`. Under `AUTO` that endpoint returns 404, so calling it unconditionally would surface a spurious error.

- [ ] **Step 2: Build the picker**

State with Svelte 5 runes:

```svelte
<script lang="ts">
  let { data } = $props();
  let weekStart = $state(todayInZone(data.organization.timezone));
  let selectedResourceId = $state<string | undefined>(undefined);
  let selectedSlot = $state<PublicSlot | undefined>(undefined);
</script>
```

Slots reload whenever `weekStart` or `selectedResourceId` changes, via `$derived` over an async fetch or an explicit `$effect`. Keep the fetch in one function so the `409` handler in Task 16 can call it to refresh.

Components:
- `ResourcePicker` — DaisyUI `join` of radio buttons, with **"Any available"** first, bound to `selectedResourceId` as `undefined`. Renders only under `CUSTOMER_CHOICE`.
- `DatePager` — previous and next week buttons plus the visible range. Disable "previous" when it would page before today.
- `SlotGrid` — one column per day, slots as `btn btn-outline`, the selected one as `btn-primary`. Uses `groupSlotsByLocalDay`.

- [ ] **Step 3: Show the timezone**

Render the organization's timezone as literal text near the grid — "All times in Europe/Istanbul". This is a correctness requirement from the spec, not decoration: without it a consumer in another zone is actively misled.

- [ ] **Step 4: Handle the empty week**

When a week has no slots, show a message and a button jumping to the next week. Never an endless spinner.

- [ ] **Step 5: Verify**

Against the seed data: `Consultation` (AUTO) shows no resource picker; `Haircut` (CUSTOMER_CHOICE) shows one with "Any available" preselected. Choosing `Room A` narrows the grid.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/ frontend/src/lib/components/
git commit -m "feat(frontend): slot picker with week paging and conditional resource choice"
```

---

### Task 16: Confirm form and confirmation page

**Files:**
- Create: `frontend/src/lib/components/BookingForm.svelte`
- Create: `frontend/src/routes/[slug]/booking/[id]/+page.svelte`
- Modify: `frontend/src/routes/[slug]/[serviceId]/+page.svelte`

- [ ] **Step 1: Build the form**

Appears once a slot is selected. DaisyUI `card` with `input input-bordered` fields for name, email, and optional phone, plus a `textarea` for notes. Show the chosen slot in the organization's timezone above the fields, so the consumer confirms against what they picked.

- [ ] **Step 2: Submit and handle every failure**

```ts
async function submit() {
  submitting = true;
  formError = undefined;
  try {
    const booking = await api<PublicBookingResponse>(
      fetch,
      `/public/orgs/${slug}/bookings`,
      {
        method: 'POST',
        body: JSON.stringify({
          serviceId,
          startsAt: selectedSlot.startsAt,
          resourceId: selectedResourceId,
          customer: { name, email, phone: phone || undefined },
          notes: notes || undefined,
        }),
      },
    );
    await goto(`/${slug}/booking/${booking.bookingId}`);
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 409) {
      formError = 'Someone just took that time. Here are the times still open.';
      selectedSlot = undefined;
      await reloadSlots();
    } else if (cause instanceof ApiError && cause.status === 400) {
      formError = cause.message;
    } else {
      formError = 'Something went wrong. Please try again.';
    }
  } finally {
    submitting = false;
  }
}
```

The `409` branch is the one that matters. Clearing the selection and reloading means the consumer *sees* the taken slot vanish and can pick another without a reload — the difference between a recoverable error and a dead end.

Disable the submit button while `submitting` so a double-click cannot create two bookings.

- [ ] **Step 3: Build the confirmation page**

`[slug]/booking/[id]/+page.svelte` reads the booking returned by the POST. There is no public GET for a booking by id — deliberately, since that would let anyone enumerate bookings — so pass the response through navigation state rather than refetching. Show service name, resource name, the time in the org timezone, and that the status is `PENDING` pending confirmation.

- [ ] **Step 4: Verify the conflict path end to end**

Open the same slot in two browser windows. Submit in the first. Submit in the second, and confirm you get the inline message, a refreshed grid, and no crash. Under `AUTO` with two resources you will need three windows to exhaust them, matching the curl sequence from Task 9.

- [ ] **Step 5: Full verification**

```bash
cd backend && npm run lint && npm test
cd ../frontend && npm run lint && npx vitest run && npm run build
```

Expected: all green, and a clean production build.

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): guest confirm form with recoverable slot-conflict handling"
```

---

### Task 17: Frontend README

**Files:**
- Create: `frontend/README.md`

- [ ] **Step 1: Write it**

Cover: prerequisites (backend on 3005, migrations run, `npm run seed:demo`); `npm run dev`; that `npm run gen:api` regenerates types and needs the backend running; the routing scheme `/{slug}` and `/{slug}/{serviceId}`; and a **Later** section noting that admin routes must set `ssr = false` and that the API client will need `credentials: 'include'` for cookie auth.

- [ ] **Step 2: Commit**

```bash
git add frontend/README.md
git commit -m "docs(frontend): how to run the consumer booking app"
```

---

## Done when

- [ ] `cd backend && npm test` passes, including 35+ tests across the four availability and booking spec files
- [ ] `cd backend && npm run lint` is clean
- [ ] `cd frontend && npm run build` succeeds
- [ ] A guest can complete a booking end to end in the browser without logging in
- [ ] `curl http://localhost:3005/services` still returns **401** — the staff API never opened up
- [ ] Booking the same slot until resources run out returns 409, and the UI recovers from it
- [ ] `backend/README.md` records the day-of-week convention

## Amendments applied after code review

Both were defects in this plan, not implementation drift — the committed code
was byte-identical to what was specified here. The code blocks above now carry
the corrections; this records why.

**Task 2 — degenerate intervals (commit `8e6e95e`).** `mergeIntervals` did not
filter intervals where `end <= start`, so a zero-length cut fragmented a window
into two and an inverted cut produced overlapping output, breaking the
disjointness guarantee callers rely on. Reachable from valid data via DST. The
empty-check had to move below the filter to avoid spreading `undefined`. Seven
tests added, including the containment case for `Math.max`, which mutation
testing proved was unguarded — the branch whose failure mode is bookable slots
inside a blocked period.

**Task 3 — non-positive duration (commit `f1544e0`).** `computeSlots` looped
forever on `durationMs <= 0`, crashing the process rather than returning a bad
answer, on a route that is `@Public()`. Six tests added, including two
asymmetric buffer cases: the original buffer test used equal before/after
values, so transposing the two arguments of `expandInterval` was invisible to
the entire suite.

## Deliberately not built

Carried over from the spec, and out of scope here:

1. Exclusion constraint on `booking_resources`
2. CSRF tokens for cross-domain deploys
3. Consumer-facing cancellation or rescheduling
4. Confirmation email
5. The admin panel
