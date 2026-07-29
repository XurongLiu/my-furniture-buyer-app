# Furniture Buyer App

A small hackathon web app: log in, browse a furniture catalogue, and place
orders against a personal budget. See [CLAUDE.md](./CLAUDE.md) for the full
project rundown (tech stack, folder structure, data model).

## Getting started

```bash
npm install
npm run db:migrate      # creates the SQLite database
npm run db:seed         # creates a demo account
npm run import:catalog  # loads the real product catalog (needs MONGODB_URI in .env)
npm run dev              # starts the app at http://localhost:3000
```

Demo login: `demo@example.com` / `password123`

## Sharing it publicly (ngrok)

How this works, for next time:

```bash
npm run dev              # if it's not already running
ngrok http 3000          # in a separate terminal
```

Check `http://127.0.0.1:4040/api/tunnels` for the assigned public URL. If
it's a new random subdomain (free-tier ngrok doesn't always reuse the last
one), update `next.config.js`'s `allowedDevOrigins` and `.env`'s
`NEXTAUTH_URL` to match, then restart `npm run dev` — see
[CLAUDE.md](./CLAUDE.md) for why both of those matter. First-time visitors
will see ngrok's one-time "you are about to visit..." warning page; that's
expected, just click **Visit Site**.
