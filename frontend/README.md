# Septem Funeral

A funeral home's booking front end. The person the booking is for is deceased,
someone else is paying, and neither of them gets to choose the date — so this
is not a calendar with an appointment on it.

Three things follow from that, and they are what the app is:

- **The date is derived, not picked.** `src/lib/funeral/constraints.ts` turns
  the facts of a death — when it happened, whether a coroner has released the
  body, what the family's tradition asks, when a relative can land — into a
  feasible window, and keeps every constraint it considered so the UI can show
  its reasoning instead of asserting a date.
- **A funeral is a chain, not an appointment.** `src/lib/funeral/chain.ts`
  solves five dependent steps (preparation, viewing, service, transport,
  committal) across six kinds of resource, against the availability the API
  actually advertises. Where the window is too narrow for all of it — an
  Islamic burial with an afternoon coroner release — it falls back to a
  shortened arrangement and says what it left out.
- **Some resources are held, not booked.** A chapel is busy for an hour; a cold
  storage bay is occupied for days. The timeline draws both, and the director's
  console tracks the bay as the resource that actually runs out.

Three parties, never conflated: the **deceased** (subject, never a user), the
**arranger** (decides), and the **payer** (settles the account, and is usually
neither of the other two).

SvelteKit 2, Svelte 5 runes, Tailwind CSS v4, DaisyUI 5.

## Prerequisites

- The backend on `http://localhost:3005` (see `backend/README.md`):
  - migrations run (`npm run migration:run`)
  - the home seeded (`npm run seed:funeral` — creates the `septem` org, its
    eleven resources and the five chain steps, available every day 07:00–21:00)
- Node 20+

## Running

```bash
npm install
npm run dev
```

Open `http://localhost:5173` and begin an arrangement. `VITE_API_URL` (see
`.env.example`) points at the backend.

## Routes

| Route                    | Page                                                           |
| ------------------------ | -------------------------------------------------------------- |
| `/`                      | What the home is for                                           |
| `/{slug}`                | Intake — the deceased, the tradition, the coroner, the parties |
| `/{slug}/arrangements`   | The window, its constraints, and the plans that fit inside it  |
| `/{slug}/confirmed`      | The held arrangement                                           |
| `/{slug}/director`       | The home's own board: cold storage, cases, third-party slots   |
| `/{slug}/director/login` | Staff sign-in                                                  |

The only data the app touches comes from the five unauthenticated routes under
`/public` — the OpenAPI schema for them is generated into
`src/lib/api/types.ts`. Confirming a plan is five ordinary `POST`s against the
same slots it was solved from; there is no bespoke endpoint behind it, and no
migration was needed to build any of this.

The console is staff-only. It guards itself in the browser rather than on the
server, because the session is an httpOnly cookie scoped to the API's origin
and SvelteKit's server-side `fetch` will not forward a cookie across origins —
so `ssr` is off for that route and the guard calls `GET /auth/me`. Nothing a
family can reach links to it.

Staff sign-in resolves against the organization named by the backend's
`DEFAULT_ORG_SLUG`, which must match a row in `organizations.slug` or every
login answers 404. Give an account a password with
`npm run auth:set-password -- <email> <password>` in `backend/`.

An arrangement in progress lives in `sessionStorage` and goes with the tab — a
family fills it in over twenty minutes on the worst day of their life, and
losing it to a refresh is not acceptable, but it is also not ours to keep. The
director's board is `localStorage`, because it is the home's own screen.

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
