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
  optional starting budget (defaults to $1000 if left blank).
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

- FR3.1 Each user has a total budget (set at sign-up).
- FR3.2 The system tracks how much of that budget has been spent, computed
  as the sum of the user's placed orders.
- FR3.3 Remaining budget = total budget − spent so far, always visible on
  the catalogue page.

### 4. Placing orders

- FR4.1 A user can choose a quantity for one or more products and submit
  them together as a single order.
- FR4.2 An order's total is the sum of (price × quantity) across its items.
- FR4.3 An order is rejected if its total would exceed the user's remaining
  budget; the user sees a clear error stating the order total and their
  remaining budget.
- FR4.4 An order that fits within budget is saved immediately and reflected
  in the remaining budget shown on screen.
- FR4.5 Price is locked in at the time of purchase (later catalogue price
  changes don't retroactively change past orders' recorded totals).

### 5. Order history

- FR5.1 A user can view a list of their own past orders, most recent first.
- FR5.2 Each past order shows the date, total, and itemized line items
  (product, quantity, price at purchase).
- FR5.3 A user only ever sees their own orders, never another user's.

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
