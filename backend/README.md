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

`GET /health`, `POST /auth/login`, and `POST /auth/register` are public.

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

## Notes

- Table names match the SQL ERD exactly (`snake_case`).
- `resources` has both `organization_id` and `organizations_id` per the ERD.
- Global guards: throttle, then session auth, then role-based `@Roles()`.
- Services return response DTOs; extend `toDto()` mappers as you flesh out business logic.
