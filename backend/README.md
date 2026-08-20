# Septem Montes Booking API

NestJS 11 + PostgreSQL + TypeORM backend scaffolded from `hackathonFromSql_create.sql`.

## Quick start

```bash
cd backend
cp .env.example .env
# edit DB_* and set SESSION_PEPPER (openssl rand -base64 48)

npm run migration:run
npm run auth:set-password -- berkay@example.com 'berkay123' \
  --create --org septem-montes --name "Berkay Bayar" --role OWNER
npm run start:dev
```

- API: `http://localhost:3005`
- Swagger: `http://localhost:3005/api` (development only; disabled when `NODE_ENV=production`)
- Sign-in: `http://localhost:3005/signin.html`
- Sign-up (workers): `http://localhost:3005/signup.html`
- Resources admin: `http://localhost:3005/resources.html`
- Health: `GET /health` (public)

## Logging

Daily log files are written to `backend/logs/`:

| File pattern | Contents |
|--------------|----------|
| `app-YYYY-MM-DD.log` | info and above |
| `warn-YYYY-MM-DD.log` | warn and above |
| `error-YYYY-MM-DD.log` | errors only |

Use `AppLogger` (`logger.log` / `warn` / `error` / `debug` / `verbose`) anywhere via DI.

## Auth

Session-based, with an httpOnly cookie. There is no token in JavaScript's reach
and nothing for the frontend to store or refresh.

### How it works

1. `POST /auth/login` with `{ email, password }`.
2. The server verifies the bcrypt hash, mints a 256-bit random opaque token,
   stores only `HMAC-SHA256(token, SESSION_PEPPER)` in `sessions`, and returns
   the token in an `httpOnly; SameSite=Lax` cookie. The response body carries
   the user, never the token.
3. Every later request authenticates from that cookie. Role and organization
   are read from the `users` row on each request, so a demotion or deletion
   takes effect immediately.

Sessions slide: a request more than `SESSION_TOUCH_INTERVAL` (1h) after the
last one pushes the deadline out another `SESSION_SLIDING_WINDOW` (30d) and
re-sends the cookie. Active users are never signed out. `SESSION_ABSOLUTE_MAX`
(90d) is a ceiling that is never extended.

Tokens are hashed, not encrypted. The server only ever needs to compare one,
so there is no decryptable session material anywhere — and the pepper means a
database dump alone cannot be replayed.

### Endpoints

| Route | Purpose |
|-------|---------|
| `POST /auth/login` | Sign in; sets the session cookie. Rate limited to 10/min. |
| `POST /auth/register` | Public register into `septem_montes` |
| `POST /auth/logout` | Revoke the current session, clear the cookie |
| `POST /auth/logout-all` | Revoke every session for this user |
| `GET /auth/me` | The signed-in user |
| `GET /auth/sessions` | Active sessions, with device and last-used time |
| `DELETE /auth/sessions?id=` | Revoke one session |
| `POST /auth/change-password` | Change your own password; signs other devices out |

`GET /health`, `POST /auth/login`, `POST /auth/register`, and the `/public/*`
booking routes (below) are the only public routes.

### Creating the first user

A fresh database has no accounts. Bootstrap an organization and its owner:

```bash
npm run auth:set-password -- berkay@example.com 'berkay123' \
  --create --org septem-montes --name "Berkay Bayar" --role OWNER
```

Or use public registration into the seeded `septem_montes` org:

```http
POST /auth/register
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "SecurePass123!",
  "role": "STAFF"
}
```

Re-run `auth:set-password` without `--create` to reset any existing user's
password (which also revokes their sessions). Owners and admins can also create
colleagues through `POST /users` with an optional `password` field.

An email is unique per organization, not globally. Login is email + password;
if the same address exists in several organizations and the password matches
more than one, the API answers `409` with the list and you retry including
`organizationId`.

### Frontend notes

Send credentials on every call — the cookie is invisible to JS by design:

```ts
fetch(`${API}/auth/me`, { credentials: 'include' })
```

Add the frontend's origin to `CORS_ORIGINS`. There is no CSRF token: on
localhost the frontend and API are same-site, so `SameSite=Lax` covers it.
**Before deploying across real domains, add double-submit CSRF tokens** to the
state-changing routes.

### Authorization

`@Roles()` gates routes by `OWNER > ADMIN > STAFF > CUSTOMER`. Beyond that,
nobody may grant a role above their own, modify a user ranked above them,
change their own role, or delete their own account. Every write is scoped to
the caller's organization — the organization is taken from the session and is
rejected if it appears in a request body.

## Public booking

The only unauthenticated **business** routes, all under `/public` and scoped by
organization slug. Every other business route sits behind the session guard.

| Route | Purpose |
|-------|---------|
| `GET /public/orgs/:slug` | Organization name, slug, and timezone |
| `GET /public/orgs/:slug/services` | Active bookable services |
| `GET /public/orgs/:slug/services/:serviceId/resources` | Choosable resources; **404 unless the service is `CUSTOMER_CHOICE`**, so staff names never leak for `AUTO` services |
| `GET /public/orgs/:slug/services/:serviceId/slots?from=&to=&resourceId=` | Free slots for a 1–31 day date range |
| `POST /public/orgs/:slug/bookings` | Book a slot as a guest; rate limited to 10/min/IP (`publicWrite` throttler; the read routes use the 300/min default) |

Booking is transactional: the candidate resource rows are locked
(`SELECT … FOR UPDATE`, id order), availability is re-derived on that snapshot,
and the guest gets a `201` or a `409` — two simultaneous posts for one slot can
never both succeed. Guest-created bookings are `PENDING` with no creator user.

**Timezones.** `from`/`to` are calendar dates in the **organization's**
timezone; slot instants come back as UTC ISO-8601 strings. An availability rule
may override the zone with its own `timezone` column; exceptions always resolve
in the organization's zone. DST gaps and overlaps are resolved deliberately
(spring-forward shifts past the gap, fall-back spans the repeated hour).

**`resource_selection_mode`.** `AUTO` — the system assigns a resource, and
guests neither see nor choose one (`/resources` 404s). `CUSTOMER_CHOICE` —
guests pick from `/resources` and may send that `resourceId` with the booking;
under `AUTO` a sent `resourceId` is merely a preference with fallback.

**Day-of-week convention.** `availability_rules.day_of_week` is **0 = Sunday
through 6 = Saturday**, matching Postgres `EXTRACT(DOW)` and JavaScript
`getDay()`. The admin panel's availability editor must use the same convention
or weekly rules silently land one day off.

```bash
npm run seed:demo   # demo org (Europe/Istanbul), 2 rooms, 2 services, weekday rules
```

## Modules (dependency order)

| Module | Route | Table |
|--------|-------|-------|
| `organization` | `/organizations` | `organizations` |
| `user` | `/users` | `users` |
| `auth` | `/auth` | — |
| `customer` | `/customers` | `customers` |
| `resource` | `/resources` | `resources` |
| `service` | `/services` | `services` |
| `availability-rule` | `/availability-rules` | `availability_rules` |
| `availability-exception` | `/availability-exceptions` | `availability_exceptions` |
| `booking` | `/bookings` | `bookings` |
| `booking-event` | `/booking-events` | `booking_events` |
| `booking-participant` | `/booking-participants` | `booking_participants` |
| `booking-resource` | `/booking-resources` | `booking_resources` |
| `service-resource` | `/service-resources` | `service_resources` |
| `public-booking` | `/public` | — (reuses the tables above) |

## Enums

| Table | Column | Values |
|-------|--------|--------|
| `users` | `role` | `OWNER`, `ADMIN`, `STAFF`, `CUSTOMER` |
| `resources` | `status` | `ACTIVE`, `INACTIVE` |
| `availability_exceptions` | `exception_type` | `UNAVAILABLE`, `AVAILABLE` |
| `bookings` | `status` | `PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`, `NO_SHOW` |
| `booking_events` | `event_type` | `CREATED`, `CONFIRMED`, `CANCELLED`, `RESCHEDULED`, `COMPLETED`, `NO_SHOW` |

## Migrations

```bash
npm run migration:run
npm run migration:revert
npm run migration:generate   # after entity changes
```

- `src/migrations/20260820000000-InitialSchema.ts` — tables from the ERD
- `src/migrations/20260820120000-AuthSessions.ts` — `users.password_hash` + `sessions`
- `src/migrations/20260820140000-SeedSeptemMontesOrgAndNullableUserUpdatedAt.ts` — seed org + nullable `users.updated_at`
- `src/migrations/20260821000000-ResourceSelectionMode.ts` — `services.resource_selection_mode` + CHECK
- `src/migrations/20260821120000-ResourceOrganizationCheck.ts` — forces `resources.organization_id = organizations_id`

## Notes

- Table names match the SQL ERD exactly (`snake_case`).
- `resources` has both `organization_id` and `organizations_id` per the ERD;
  a CHECK constraint forces them equal.
- Global guards: throttle, then session auth, then role-based `@Roles()`.
- Throttler buckets are opt-in (`login`, `publicWrite`): the module defaults
  must stay effectively unlimited, because every named throttler applies to
  every route and `@Throttle` only overrides where it appears.
- The exclusion constraint that would make `booking_resources` double-booking
  impossible at the DB level is deliberately deferred — the guest booking path
  already serializes on a row lock, and the staff path needs the same treatment
  first (see the plan's "deliberately not built" list).
- Services return response DTOs; extend `toDto()` mappers as you flesh out business logic.
