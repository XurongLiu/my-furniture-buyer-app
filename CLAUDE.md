# Furniture Buyer App

See [requirements.md](./requirements.md) for the full feature scope and
[architecture.md](./architecture.md) for the full system design — this file
stays focused on conventions and commands for working in the codebase.

A hackathon (Day 1) web app for a furniture shop. A user creates an account,
logs in, browses a product catalogue, and places orders against a personal
spending budget. Orders that would exceed the user's remaining budget are
rejected server-side.

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

- `User` — name, email, password hash, `budget` (starting spending limit).
- `Product` — name, description, price, category, plus `imageData`/
  `imageMimeType` (real product photo, when the source has one),
  `emoji` (fallback placeholder art), `externalId`/`sourceUrl` (provenance
  back to the source catalog). `name` is **not** unique — the real catalog
  has colour variants sharing a name.
- `Order` — belongs to a `User`, has a `total`, has many `OrderItem`s.
- `OrderItem` — links an `Order` to a `Product`, with quantity and the price
  at the time of purchase (so later price changes don't rewrite history).

A user's remaining budget = `budget` − sum of their past orders' totals.
This is computed on the fly, not stored.

Products are loaded from a real external catalog (762 IKEA items from
MongoDB), not hand-written — see "Product catalog source" in
[architecture.md](./architecture.md) for the import script, field-mapping
quirks, and why images are served through `/api/products/[id]/image`
instead of being inlined into the page.

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

## Conventions

- Plain JavaScript, no TypeScript.
- No comments explaining *what* code does — only for non-obvious *why*.
- Session strategy is JWT-based (no NextAuth database adapter, no
  Account/Session/VerificationToken tables) — simplest option for a
  credentials-only (email/password) login.
