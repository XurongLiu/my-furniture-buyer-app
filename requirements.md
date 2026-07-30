# Requirements

What the Furniture Buyer app needs to do. See [architecture.md](./architecture.md)
for how it's built.

## Purpose

A one-day hackathon web app for a furniture shop. A buyer creates an
account, browses a catalogue of furniture, and places orders — but only up
to a personal spending budget the system enforces.

## User

Single role: **Buyer**. No admin/staff role, no multi-tenant concept, no
shop-owner management screen — this is a buyer-facing app only.

## Functional requirements

### 1. Accounts & authentication

- FR1.1 A visitor can create an account with name, email, password, and an
  optional starting budget (defaults to $1000 if left blank). This stored
  number is no longer used to gate spending (see FR3.1) — it's a leftover
  from before the real-balance integration, kept only because removing the
  field wasn't part of this change.
- FR1.2 Email must be unique; sign-up fails with a clear error if the email
  is already registered.
- FR1.3 Password must be at least 6 characters.
- FR1.4 A registered user can log in with email + password.
- FR1.5 A logged-in user can log out.
- FR1.6 Pages that show personal data (catalogue with budget, order
  history) require a logged-in session; an unauthenticated visitor is
  redirected to the login page.

### 2. Product catalogue

- FR2.1 Any logged-in user can view the full product catalogue.
- FR2.2 Each product shows a name, description, price, and category.
- FR2.3 The catalogue is shared — all users see the same products (no
  per-user inventory).

### 3. Budget tracking

- FR3.1 The spending limit is the buyer's **real balance from the hackathon's
  Product Search / Order / Balance API** (`GET /users/{id}`), fetched live —
  not a number tracked locally per app-account. Every buyer logged into this
  app currently sees the same real balance, since the hackathon API only
  knows about one account (the credentials in `.env`), not our app's
  individual sign-ups. See architecture.md for the full rationale.
- FR3.2 The app also tracks how much a buyer has spent *through this app*,
  computed as the sum of their placed orders — shown alongside the real
  balance for reference, but no longer subtracted from it locally.
- FR3.3 The real balance is always visible on the catalogue page; if it
  can't be fetched, the app says so and disables ordering rather than
  guessing or falling back to a stale number.

### 4. Placing orders

- FR4.1 A user picks a quantity and clicks **Buy** on one product at a
  time — not a multi-item cart checkout.
- FR4.2 Buying places a **real order through the hackathon's own API**
  (`POST /orders`), which genuinely debits the real, event-tracked balance
  and creates a real order on their side.
- FR4.3 If an order is rejected for costing more than the real balance, the
  buyer sees a clear "you don't have enough balance" message (with the
  actual order cost and available balance), not a generic error. If a
  product is no longer available for real purchase — whether it's been
  removed from the real catalogue, or the local product record is gone —
  the buyer sees a friendly "this item is no longer available" message.
  Neither failure crashes the page or leaves anything stuck; nothing is
  recorded locally for a failed attempt.
- FR4.4 A successful real order is also recorded in this app's own order
  history immediately (for "My Orders"), including the real order id for
  traceability.
- FR4.5 After a successful purchase, the user sees a confirmation (item,
  quantity, amount, real order id) and the catalogue's displayed real
  balance updates immediately to the new value the hackathon API returned.
- FR4.6 Retrying the same buy action (e.g. an accidental double-click) is
  safe — it won't place or charge for a second order.
- FR4.7 Price is locked in at the time of purchase (later catalogue price
  changes don't retroactively change past orders' recorded totals).

### 5. Order history

- FR5.1 A user can view a list of their own past orders, most recent first.
- FR5.2 Each past order shows the date, total, and itemized line items
  (product, quantity, price at purchase).
- FR5.3 A user only ever sees their own orders, never another user's.
- FR5.4 For an order placed through the real hackathon API, the user can
  download the real PDF invoice the hackathon API generated for it. A user
  can never download another user's invoice, even by guessing/incrementing
  an order id — attempting to do so looks identical to the order not
  existing at all.

### 6. Shopping assistant

- FR6.1 A logged-in user can type a plain-English request into a chat
  interface (`/assistant`) instead of browsing the catalogue manually.
- FR6.2 The assistant can search the catalogue (via retrieval over a local,
  pre-built embedding index — see architecture.md — not a live API call
  per search), check the real balance, and place a real order.
- FR6.3 For anything retrieval can't do on its own (matching by price
  rather than by topic, or filtering by colour, which isn't present in
  this data source at all), the assistant applies that judgment itself
  over the retrieved candidates' price/name/category fields — and says so,
  rather than implying the search already filtered on it.
- FR6.4 The assistant never places a real order without the user's
  explicit confirmation. Even if it decides to attempt one, the app pauses
  for an explicit human confirmation click before anything is actually
  charged — this doesn't depend on the assistant remembering to ask.
- FR6.5 A confirmed purchase through the assistant behaves identically to
  one made via the catalogue's Buy button (real order, recorded locally,
  balance updates, friendly errors) — it reuses the same order-placement
  path rather than a separate one.
- FR6.6 If a confirmed purchase fails — not enough real balance, or the
  item is no longer available — the assistant explains why in plain
  language and suggests something concrete to try instead (a smaller
  quantity, a cheaper item, searching again), rather than showing the raw
  error as-is. A successful purchase doesn't need this — the confirmation
  is already clear on its own.

## Non-functional requirements

- NFR1 — The running app itself needs no cloud accounts or paid APIs — data
  lives in one local SQLite file. Populating the catalogue is a one-off
  import from an external source (see architecture.md); the app doesn't
  stay connected to it afterward.
- NFR2 — Passwords are never stored in plain text (hashed with bcrypt).
- NFR3 — Budget/order validation happens on the server, not just in the
  browser, so it can't be bypassed by editing page content or calling the
  API directly.
- NFR4 — Products show a real photo when the source catalog provides one;
  emoji placeholder art is a fallback for items that don't have one.
- NFR5 — The whole app starts with two commands (`npm install`,
  `npm run dev`) plus one-time database setup (`npm run db:migrate`,
  `npm run db:seed`).

## Out of scope (not built)

- Admin/staff tooling to add, edit, or remove products (the catalogue is
  seeded via a script, not a UI).
- Payment processing — "placing an order" just records it against the
  budget; no real payment is taken.
- Inventory/stock limits — quantities aren't capped by stock on hand.
- Editing or cancelling an order after it's placed.
- Password reset / "forgot password" flow.
- A shopping cart persisted across sessions — the cart lives only in the
  browser until submitted.
- Multiple currencies — all prices are in a single unlabeled currency
  (assumed USD).
