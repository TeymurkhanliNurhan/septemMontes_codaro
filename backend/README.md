# Septem Montes Booking API

NestJS 11 + PostgreSQL + TypeORM backend scaffolded from `hackathonFromSql_create.sql`.

## Quick start

```bash
cd backend
cp .env.example .env
# edit DB_* and JWT_SECRET

npm run migration:run
npm run start:dev
```

- API: `http://localhost:3005`
- Swagger: `http://localhost:3005/api`
- Health: `GET /health` (public)

## Auth (dev stub)

The ERD has no password column on `users`. Login is email + organization lookup:

```http
POST /auth/login
{ "organizationId": "<uuid>", "email": "jane@example.com" }
```

Returns a JWT. All other routes require `Authorization: Bearer <token>`.

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

Initial migration: `src/migrations/20260820000000-InitialSchema.ts`

## Notes

- Table names match the SQL ERD exactly (`snake_case`).
- `resources` has both `organization_id` and `organizations_id` per the ERD.
- Global guards: JWT + role-based `@Roles()` decorator.
- Services return response DTOs; extend `toDto()` mappers as you flesh out business logic.
