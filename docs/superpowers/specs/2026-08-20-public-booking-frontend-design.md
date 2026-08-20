# Public Booking Flow — Design

**Date:** 2026-08-20
**Status:** Approved for planning

## Goal

Let an end consumer book an appointment without an account: pick a service, pick
a time, confirm with a name and an email. Two halves — a public booking API that
does not exist yet, and a barebone SvelteKit app that consumes it.

## Why this needs backend work first

Every business controller in `backend/src` is gated to `OWNER | ADMIN | STAFF`.
The `CUSTOMER` role reaches nothing but `/auth/*`, and `customers` is a table
unrelated to `users`. Separately, `availability_rules` and
`availability_exceptions` are stored but nothing reads them: `BookingService.create`
inserts a row without checking for a conflict. A consumer-facing frontend has
nothing to call until that changes.

## Decisions

| Question | Decision |
|---|---|
| Who books | End consumers, as guests. No accounts, no login in this flow. |
| Identity | The confirm step collects name, email, phone. The API upserts a `customers` row on `(organizationId, email)`. |
| Timezone | Compute and display in the organization's timezone, labelled on screen. Store UTC. |
| Resource choice | Per-service, set by staff. A new `resource_selection_mode` column. |
| Slot engine | Built in full, reading the real availability tables. |
| Rendering | SSR on. These routes are unauthenticated, so there is no cookie to forward. |

## Scope boundary

Out of scope: consumer accounts, cancellation or rescheduling by the consumer,
payment, notification email, an org directory, and the admin panel. The admin
panel is a later session and will add routes to the same SvelteKit app.

---

## Part 1 — Backend

### 1.1 Migration

One column:

```
services.resource_selection_mode  varchar(50) NOT NULL DEFAULT 'AUTO'
```

Values are `AUTO` and `CUSTOMER_CHOICE`, as a new
`common/enums/resource-selection-mode.enum.ts`. The default backfills existing
rows to `AUTO`, so nothing already in the database changes behaviour.

- `AUTO` — the slot list is the union of free times across every capable
  resource. The API assigns a free resource when the booking is created.
- `CUSTOMER_CHOICE` — the app additionally shows a resource picker with an
  "Any available" option. Choosing that option falls back to auto-assignment,
  so one code path serves both modes.

### 1.2 Module layout

```
src/public-booking/
  public-booking.module.ts
  public-booking.controller.ts        thin, every route @Public()
  availability/
    slot-math.ts                      pure functions, no DB and no Nest
    slot-math.spec.ts
    availability.service.ts           loads rows, delegates to slot-math
  booking/
    public-booking.service.ts         transactional create
    public-booking.service.spec.ts
  dto/
```

The split matters. `slot-math.ts` takes plain UTC-epoch intervals and returns
plain UTC-epoch intervals, so every edge case is testable without a database or
a Nest testing module. `availability.service.ts` owns the impure part: querying
rows and converting local wall-clock times to instants.

### 1.3 Endpoints

All routes carry `@Public()`, which `SessionAuthGuard` already honours, and all
are scoped by organization slug.

| Route | Response |
|---|---|
| `GET /public/orgs/:slug` | `{ id, name, slug, timezone }` |
| `GET /public/orgs/:slug/services` | Active services: `{ id, name, description, durationMinutes, resourceSelectionMode }` |
| `GET /public/orgs/:slug/services/:serviceId/resources` | `[{ id, name, resourceType }]`. Returns `404` unless the service is `CUSTOMER_CHOICE`. |
| `GET /public/orgs/:slug/services/:serviceId/slots?from&to&resourceId?` | `[{ startsAt, endsAt, resourceIds[] }]`, ISO-8601 UTC |
| `POST /public/orgs/:slug/bookings` | `{ bookingId, startsAt, endsAt, status, serviceName, resourceName }` |

`from` and `to` are `YYYY-MM-DD` local dates in the organization's timezone. The
range is capped at 31 days; a wider range is a `400`.

**Never exposed:** other bookings, customer records, staff users, and every
`metadata` column. Response DTOs are explicit allow-lists, not entity
pass-through — unlike the existing `toDto()` mappers, which return the entity.

Inactive services and `INACTIVE` resources are invisible to all five routes.

### 1.4 Rate limiting

A third throttler joins the existing `default` (300/min) and `login` (10/min):

```
{ name: 'publicWrite', ttl: 60_000, limit: 10 }
```

It applies to `POST /public/orgs/:slug/bookings`. The read routes stay on
`default`.

### 1.5 The slot engine

For a service `S` in organization `O` across local dates `from..to`:

1. Resolve capable resources — `service_resources` joined to `resources`, keeping
   only `status = 'ACTIVE'`. When `resourceId` is supplied, narrow to that one and
   `404` if it is not capable.
2. For each resource and each local date, collect base windows from
   `availability_rules` where `day_of_week` matches and `is_active` is true.
3. Apply exceptions for that date: subtract every `UNAVAILABLE` interval, then
   union in every `AVAILABLE` interval. Subtraction runs first, so an explicit
   `AVAILABLE` window always wins.
4. Subtract busy intervals: existing bookings on that resource, via
   `booking_resources`, whose status is not `CANCELLED`. Each busy interval is
   widened by the service's `bufferBeforeMinutes` and `bufferAfterMinutes`.
5. Step through each surviving window from its start in `durationMinutes`
   increments, emitting a slot wherever `[start, start + duration]` fits entirely
   within the window.
6. Union the slots across resources, keyed by start instant. A slot free on three
   resources appears once, carrying all three ids.
7. Drop any slot starting in the past.

**Day-of-week convention.** `chk_availability_day` permits 0–6 but pins no
meaning. This spec fixes **0 = Sunday**, matching both Postgres `EXTRACT(DOW)`
and JavaScript `Date.getDay()`. Record it in the backend README, since the admin
panel's availability editor must agree.

**Timezone handling.** A rule's effective zone is `rule.timezone ?? org.timezone`.
Converting a local wall-clock time on a given date to a UTC instant needs a real
IANA database, so the engine takes a dependency on **luxon**. Conversion happens
only in `availability.service.ts`; `slot-math.ts` sees nothing but numbers.

DST is a genuine hazard here. On a spring-forward date a 09:00–17:00 rule yields
seven hours, not eight, and 02:30 may not exist at all. The conversion layer must
resolve non-existent and ambiguous local times explicitly rather than accept
luxon's default.

### 1.6 Creating a booking

`POST /public/orgs/:slug/bookings` takes
`{ serviceId, startsAt, resourceId?, customer: { name, email, phone? }, notes? }`
and runs one transaction:

1. Resolve the organization by slug and the service within it; reject an inactive
   service.
2. Pick the target resource — the supplied `resourceId`, or the first free
   capable resource.
3. `SELECT … FOR UPDATE` on that resource row, serialising concurrent bookings
   against the same resource.
4. Re-derive availability for that instant. If the slot is no longer free,
   `409 Conflict`. Under `AUTO`, first try the other capable resources before
   giving up.
5. Upsert the customer on `(organizationId, email)`, updating name and phone.
6. Insert the booking with `status = 'PENDING'` and `created_by_user_id = NULL`.
7. Insert the `booking_resources` row.
8. Insert a `booking_events` row with `event_type = 'CREATED'`.

Step 4 is the reason for the transaction. Without the re-check, two consumers
loading the same slot list both succeed and the resource is double-booked.

A Postgres exclusion constraint over `(resource_id, tstzrange(starts_at, ends_at))`
would enforce this at the storage layer regardless of application code. It is
deliberately deferred — the row lock is sufficient for now — and recorded here as
the hardening step.

### 1.7 Validation

`main.ts` already installs `whitelist` and `forbidNonWhitelisted`, so unknown
body keys are rejected. `organizationId` never appears in a public DTO; it is
always derived from the slug. `startsAt` must be a valid ISO-8601 instant and
must match a slot exactly, not merely fall inside a free window.

---

## Part 2 — Frontend

### 2.1 Stack

- SvelteKit 2, Svelte 5 runes, TypeScript, scaffolded with `npx sv create`
- **Tailwind CSS v4 + DaisyUI 5** for styling
- `openapi-typescript` generating `lib/api/types.ts` from `http://localhost:3005/api-json`
- `@lucide/svelte` for icons
- Lives in `frontend/`, a sibling of `backend/`

DaisyUI is a Tailwind plugin — two lines of CSS, then semantic classes like
`btn btn-primary` and `card`. No component runtime, no component API to track,
themes included. Because it is Tailwind underneath, shadcn-svelte can be added
later for bespoke admin components without removing anything.

SSR stays on. Every route here is unauthenticated, so there is no session cookie
to forward from a `load` function, and server rendering costs nothing. When the
admin panel arrives it sets `ssr = false` on its own routes, where the httpOnly
cookie does need to reach the browser directly.

`CORS_ORIGINS` already defaults to `http://localhost:5173`, so the dev server
works unmodified.

### 2.2 Routes

```
src/routes/
  +layout.svelte                    theme, header, footer
  +page.svelte                      slug entry
  [slug]/+layout.ts                 loads the org; error(404) on unknown slug
  [slug]/+page.svelte               org name and service cards
  [slug]/[serviceId]/+page.svelte   resource picker, date pager, slot grid, confirm form
  [slug]/booking/[id]/+page.svelte  confirmation
src/lib/
  api/client.ts                     fetch wrapper, typed errors
  api/types.ts                      generated
  components/                       ServiceCard, ResourcePicker, DatePager, SlotGrid, BookingForm
```

Three screens for the consumer: pick service, pick slot, confirm. The resource
picker renders inline on screen two, and only when the service is
`CUSTOMER_CHOICE`.

The slot grid shows one week at a time with a date pager, and displays the
organization's timezone as literal text — "All times in Europe/Istanbul" — so a
consumer in another zone is never misled.

### 2.3 Error handling

| Case | Behaviour |
|---|---|
| Unknown or inactive slug | SvelteKit `error(404)` |
| Inactive or missing service | `error(404)` |
| No slots in range | Empty state offering the next week, not a spinner |
| `409` on confirm | Inline message plus an automatic slot refresh, so the taken slot visibly disappears |
| `400` validation | Field-level messages on the confirm form |
| API unreachable | Route-level error boundary with a retry |

The `409` path matters most. It is the one error a consumer will actually hit,
and it must resolve into a usable state rather than a dead end.

---

## Testing

**Backend.** The effort concentrates on `slot-math.spec.ts`, because that is
where correctness is genuinely at risk:

- A window shorter than the service duration yields nothing
- Buffers overlapping the window edge
- Back-to-back bookings leaving an exact-fit gap
- `UNAVAILABLE` splitting one window into two
- `AVAILABLE` restoring time inside an `UNAVAILABLE` span
- A rule crossing a DST boundary in both directions
- Multiple resources merging into one deduplicated slot list
- No rules at all for a weekday

Plus `public-booking.service.spec.ts` covering the conflict path: a booking
against a slot already taken returns `409`, and under `AUTO` a taken resource
falls through to the next capable one.

**Frontend.** A unit test on the date-range helper. No Playwright — out of scope
for a barebone build.

## Open items

Recorded, not built:

1. Exclusion constraint on `booking_resources` as defence in depth
2. CSRF tokens before the frontend and API move to different domains, as the
   backend README already flags
3. Consumer-facing cancellation, which needs a booking token or accounts
4. Confirmation email on `CREATED`
5. `resources` requires both `organization_id` and `organizations_id`, an ERD
   quirk that the admin panel's resource form will have to handle
