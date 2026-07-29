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
