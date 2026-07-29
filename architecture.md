# Architecture

How the Furniture Buyer app is built. See [requirements.md](./requirements.md)
for what it needs to do.

## Overview

Furniture Buyer is a single Next.js application (App Router) that serves
both the UI and its own backend API routes — there's no separate
frontend/backend deployment to manage. Data lives in a single SQLite file,
accessed through Prisma.

```
Browser
  │  HTTP (pages + fetch calls)
  ▼
Next.js app (single process)
  ├─ Server Components (app/**/page.js)  ── read data directly via Prisma
  ├─ Client Components ("use client")     ── forms, cart state, fetch()
  └─ API routes (app/api/**/route.js)     ── auth, register, place order
        │
        ▼
   lib/prisma.js (Prisma Client singleton)
        │
        ▼
   prisma/dev.db (SQLite file)
```

## Tech stack

| Layer | Choice | Version | Why |
|---|---|---|---|
| Framework | Next.js (App Router, plain JS) | 16.2.12 | One project for UI + API; huge community docs |
| UI runtime | React | 19.2.8 | Ships with Next 16 |
| Styling | Tailwind CSS | 4.3.3 | CSS-first config (`@import "tailwindcss"` in `app/globals.css` + `@tailwindcss/postcss`) — no `tailwind.config.js` needed |
| Database | SQLite | — | Single file, zero setup, no separate server |
| ORM | Prisma | 6.19.3 (pinned) | Pinned below the 7.x line deliberately — Prisma 7 made driver adapters mandatory even for SQLite, adding a config file and adapter package with no benefit for a local single-file database |
| Auth | next-auth | 4.24.15 (pinned) | Pinned to the v4 line deliberately — confirmed via the npm registry that v4 is still the `latest`-tagged, genuinely stable release; the rewritten "Auth.js v5" most current tutorials show is still published only under the `beta` tag |
| Password hashing | bcryptjs | 3.0.3 | Pure JS, no native build step required |

## Data model

- **User** — `name`, `email` (unique), `passwordHash`, `budget`, has many `orders`.
- **Product** — `name` (unique), `description`, `price`, `emoji` (placeholder art), `category`.
- **Order** — belongs to a `User`, has a `total`, has many `items`.
- **OrderItem** — links an `Order` to a `Product`, with `quantity` and
  `unitPrice` (the product's price *at the time of purchase*).

A user's **remaining budget** is never stored — it's computed on every
request as `budget - sum(order.total for that user's orders)`. That avoids
the number ever drifting out of sync with the underlying orders.
`OrderItem.unitPrice` snapshots price at purchase time, so a later catalogue
price change doesn't rewrite the total of a past order.

Full field list: [prisma/schema.prisma](./prisma/schema.prisma).

## Authentication

- **Strategy:** NextAuth's Credentials provider with **JWT sessions** — no
  NextAuth database adapter, so no `Account`/`Session`/`VerificationToken`
  tables. That's the simplest option for a plain email/password login.
- **Sign-up** (`POST /api/register`) is hand-rolled: it hashes the password
  with bcrypt and creates a `User` row. NextAuth's Credentials provider only
  handles *logging in*, not account creation.
- **Login** happens through NextAuth's `authorize()` callback in
  `lib/auth.js`: look up the user by email, `bcrypt.compare()` the
  password, return the user if it matches.
- **Route protection:** no `middleware.js`/`proxy.js` file. Next.js 16
  renamed that file convention (`middleware` → `proxy`), and layering an
  older, deliberately-stable auth library on top of a brand-new
  framework-level rename was an avoidable risk. Instead, each protected page
  (`app/catalogue/page.js`, `app/orders/page.js`) is a server component that
  calls `getServerSession()` itself and redirects to `/login` if there's no
  session.

## Request flows

**Sign up** — `register/page.js` (client) → `POST /api/register` (hashes
password, creates `User`) → on success, immediately calls NextAuth's
`signIn("credentials", …)` → redirected to `/catalogue`.

**Browsing + ordering** — `catalogue/page.js` (server component) reads the
session, then queries `Product.findMany`, the user's `budget`, and an
`Order.aggregate` sum in parallel, and hands that data to
`CatalogueClient.js` (client component), which owns the cart/quantity state
and calls `POST /api/orders` when the user submits.

**Order validation** — `app/api/orders/route.js` re-checks the session
server-side, re-fetches current product prices from the database (it never
trusts prices sent from the browser), computes the order total, re-computes
remaining budget from the database, and only creates the `Order` +
`OrderItem` rows if the total fits. This is what makes budget enforcement
tamper-proof — a user can't place an over-budget order by editing the page
or calling the API directly with a fake total.

## Folder structure

```
prisma/
  schema.prisma        data model
  seed.js               sample furniture + demo login
app/
  layout.js             root layout, nav bar, session provider
  page.js               home page
  login/, register/      auth forms
  catalogue/             browse + place an order
  orders/page.js          order history
  api/
    auth/[...nextauth]/route.js
    register/route.js
    orders/route.js
components/             Navbar, SessionProvider wrapper
lib/
  prisma.js             Prisma client singleton
  auth.js               NextAuth config
```

## Local development

```bash
npm install
npm run db:migrate   # create/update the SQLite database from schema.prisma
npm run db:seed      # load sample products + a demo account
npm run dev            # http://localhost:3000
```
