# Furniture Buyer App

See [requirements.md](./requirements.md) for the full feature scope and
[architecture.md](./architecture.md) for the full system design — this file
stays focused on conventions and commands for working in the codebase.

A hackathon (Day 1) web app for a furniture shop. A user creates an account,
logs in, browses a product catalogue, and places orders against a real
balance fetched live from the hackathon's own API. Orders that would exceed
that balance are rejected server-side.

## Tech stack

- **Next.js** (App Router, plain JavaScript, no TypeScript) — frontend and
  backend live in one project.
- **SQLite** — a single database file (`prisma/dev.db`), no separate DB server.
- **Prisma** — ORM used to define the data model and query the database.
  Pinned to the 6.x line deliberately: Prisma 7 made driver adapters
  mandatory even for SQLite, which adds setup complexity with no benefit for
  a local single-file database. 6.x keeps the classic, simple
  `datasource { url = env("DATABASE_URL") }` setup.
- **NextAuth v4** (`next-auth@4`) — handles login sessions and password
  checking. Pinned to v4 deliberately: the npm registry's `latest` tag is
  still 4.x; the rewritten v5 ("Auth.js") is still published under the
  `beta` tag. v4 is used here because it's the actually-stable release.
- **bcryptjs** — password hashing (pure JS, no native build step required).
- **Tailwind CSS v4** — styling. v4 uses CSS-first config: no
  `tailwind.config.js`; Tailwind is enabled via `@tailwindcss/postcss` in
  `postcss.config.mjs` and `@import "tailwindcss";` in `app/globals.css`.

No auth middleware/`proxy.js` file is used. Next.js 16 renamed the
`middleware.js` convention to `proxy.js` (with a differently-named exported
function), and mixing that framework-level rename with an auth library that
predates it was an unnecessary risk. Instead, each protected page
(`app/catalogue`, `app/orders`) checks the session itself via
`getServerSession` and redirects to `/login` if there isn't one.

## Data model (`prisma/schema.prisma`)

- `User` — name, email, password hash, `budget` (collected at sign-up, no
  longer used to gate spending — see below).
- `Product` — name, description, price, category, plus `imageData`/
  `imageMimeType` (real product photo, when the source has one),
  `emoji` (fallback placeholder art), `externalId`/`sourceUrl` (provenance
  back to the source catalog). `name` is **not** unique — the real catalog
  has colour variants sharing a name.
- `Order` — belongs to a `User`, has a `total`, has many `OrderItem`s.
- `OrderItem` — links an `Order` to a `Product`, with quantity and the price
  at the time of purchase (so later price changes don't rewrite history).

Products are loaded from a real external catalog (762 IKEA items from
MongoDB), not hand-written — see "Product catalog source" in
[architecture.md](./architecture.md) for the import script, field-mapping
quirks, and why images are served through `/api/products/[id]/image`
instead of being inlined into the page.

The home page (`app/page.js`) is separate: it calls the hackathon's own
live API (`HACKATHON_API_BASE_URL`'s `/catalogue/search-index`) on every
request, not the local database — see "Home page: live hackathon API
integration" in [architecture.md](./architecture.md).

**Buying a product places a real order through the hackathon API — this is
not a simulation.** `POST /api/orders` calls `lib/hackathonApi.js`'s
`placeHackathonOrder()`, which hits the real `POST /orders` with
`{user_id, items: [{item_id, quantity}]}` and an `Idempotency-Key` header
(so a double-click can't double-charge). This genuinely debits the real,
event-tracked balance shown on the catalogue page (from `GET /users/{id}`)
and creates a real order + invoice on the hackathon's side. A local `Order`
row is also created on success (storing the real `order_id` in
`externalOrderId`) so "My Orders" keeps working. Insufficient-balance (402)
and product-not-found (404, or a locally-missing product) both get their
own specific, friendly messages rather than the API's raw `{"detail":
...}` text — see `ORDER_ERROR_MESSAGES` / `NOT_AVAILABLE` — and
`app/api/orders/route.js`'s whole handler plus the client's `handleBuy()`
are both wrapped in try/catch so nothing here can crash the page. See
"Catalogue page: real balance, and real order placement" in
[architecture.md](./architecture.md)
— including the one-balance-for-every-local-buyer caveat, and a real
discrepancy between the Participant Guide's example request and the API's
actual schema that's worth knowing about before touching this code again.

## Folder structure

```
prisma/
  schema.prisma       data model
  seed.js             demo login only (demo@example.com / password123) — no products
scripts/
  import-catalog.mjs   loads the real catalog from MongoDB (npm run import:catalog)
app/
  layout.js           root layout, nav bar, wraps children in the session provider
  page.js             home page (redirects to /catalogue if already logged in)
  login/page.js        login form
  register/page.js     sign-up form (creates a user, then logs them in)
  catalogue/           browse products + place an order (checked against budget)
  orders/page.js        past order history
  api/
    auth/[...nextauth]/route.js   NextAuth handler
    register/route.js             creates a new user (hashes password)
    orders/route.js                validates + creates an order
    products/[id]/image/route.js   streams one product's photo
components/           Navbar, SessionProvider wrapper
lib/
  prisma.js           Prisma client singleton
  auth.js             NextAuth config (authOptions)
```

## Commands

- `npm run dev` — start the app at http://localhost:3000
- `npm run db:migrate` — apply schema changes to the SQLite database
- `npm run db:seed` — create the demo account
- `npm run import:catalog` — load the real product catalog (needs
  `MONGODB_URI` in `.env`; never hardcode that connection string)
- `npm run db:studio` — open a browser-based table view of the database

## Exposing the app publicly (e.g. for a phone demo)

Useful for showing the app to judges or testing on a real phone over
mobile data, not just localhost. Two Next.js/NextAuth-specific gotchas,
beyond just running `ngrok http 3000`:

1. **`next.config.js`'s `allowedDevOrigins`** must list the tunnel's
   hostname, or the dev server rejects the requests as cross-origin. The
   value has to be updated each time (free-tier ngrok assigns a new random
   `*.ngrok-free.dev` subdomain per session).
2. **`.env`'s `NEXTAUTH_URL`** must match the current public URL (also
   updated per session), and `lib/auth.js` sets `trustHost: true` — without
   both, login redirects bounce back to `localhost` instead of the tunnel.

Both require restarting `npm run dev` to take effect (next.config.js and
.env are only read at startup).

Free-tier ngrok also shows a one-time "you are about to visit..." warning
interstitial (`ERR_NGROK_6024`) to browser visitors — expected, not a bug;
click "Visit Site" once to get through to the actual app.

## Conventions

- Plain JavaScript, no TypeScript.
- No comments explaining *what* code does — only for non-obvious *why*.
- Session strategy is JWT-based (no NextAuth database adapter, no
  Account/Session/VerificationToken tables) — simplest option for a
  credentials-only (email/password) login.
