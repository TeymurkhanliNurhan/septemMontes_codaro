# Septem Montes booking frontend

The consumer-facing booking app: pick an organization, a service, a time, and
book with a name and an email — no account, no login. SvelteKit 2, Svelte 5
runes, Tailwind CSS v4, DaisyUI 5.

## Prerequisites

- The backend on `http://localhost:3005` (see `backend/README.md`):
  - migrations run (`npm run migration:run`)
  - demo data seeded (`npm run seed:demo` — creates the `demo` org with two
    services and two rooms)
- Node 20+

## Running

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, enter `demo` as the organization, and book away.
`VITE_API_URL` (see `.env.example`) points at the backend.

## Routes

| Route | Page |
|-------|------|
| `/` | Slug entry |
| `/{slug}` | Organization shell and service list |
| `/{slug}/{serviceId}` | Resource picker, week pager, slot grid, confirm form |
| `/{slug}/booking/{id}` | Confirmation |

The only data the app touches comes from the five unauthenticated routes under
`/public` — the OpenAPI schema for them is generated into
`src/lib/api/types.ts`.

## API types

`src/lib/api/types.ts` is **generated** — do not hand-edit it. Regenerate with:

```bash
npm run gen:api   # needs the backend running on :3005
```

Hand-written aliases over the generated schema live in `src/lib/api/schemas.ts`.

## Tests

```bash
npm test                 # vitest once
npx vitest               # vitest in watch mode
npm run check            # svelte-check
npm run lint             # prettier + eslint
```

## Later

- **Admin routes must set `ssr = false`.** The staff API is cookie-based, and
  the admin panel will read its own session state, which does not belong in
  SSR data.
- **The API client will need `credentials: 'include'`** for cookie auth. It is
  deliberately absent today — every route the consumer app calls is public.
