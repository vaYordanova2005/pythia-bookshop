# Local setup & deployment

## Requirements

- Node.js 18+
- A local PostgreSQL server (or point `DATABASE_URL` at a hosted one, e.g. Neon)

## Quick start (Windows)

```bash
git clone https://github.com/vaYordanova2005/pythia-bookshop.git
cd pythia-bookshop
npm install
```

```powershell
powershell -ExecutionPolicy Bypass -File .\BE\setup-db.ps1
```

`setup-db.ps1` asks for your postgres password, creates the `pythia` database,
loads the schema + first 8 books, seeds the rest of the catalogue and the demo
users, and writes `DATABASE_URL` into `BE/.env`.

```bash
npm start
```

Open `http://localhost:5173`.

## Quick start (any platform, manual)

```bash
psql -U postgres -c "CREATE DATABASE pythia"
psql -U postgres -d pythia -f BE/pythia_pg.sql    # schema + 8 books
psql -U postgres -d pythia -f BE/seed_books.sql   # 34 more books
node BE/seed_pg.js                                # demo users, reviews
cp BE/.env.example BE/.env                        # then fill in DATABASE_URL
npm start
```

## Environment variables (`BE/.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Unset defaults to `postgresql://postgres@localhost:5432/pythia`. SSL is auto-negotiated for any non-localhost host. |
| `PORT` | Server port (default `5173`). |
| `JWT_SECRET` | Required — server refuses to start without it. Any long random string; generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`. |
| `ALLOWED_ORIGINS` | Comma-separated CORS allow-list. Defaults to `http://localhost:<PORT>` if unset. |

## npm scripts

| Script | Runs |
|---|---|
| `npm start` | `node BE/server.js` |
| `npm run dev` | `nodemon BE/server.js` (auto-restart) |
| `npm run seed` | `node BE/seed.js` |

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Seller | seller@pythia.test | seller123 |
| Client | reader@pythia.test | reader123 |

## Windows: psql against a hosted DB hangs

If you run manual `psql` commands against Neon (or any cloud Postgres) on
Windows, `psql.exe` can hang indefinitely during connection negotiation. Add
`?gssencmode=disable` to the connection string/URL to fix it — this is a
Windows-specific GSSAPI quirk, not a Neon issue.

## Deployment (Render)

- **Live URL:** https://pythia-bookshop.onrender.com
- **Repo:** https://github.com/vaYordanova2005/pythia-bookshop
- **Process:** `Procfile` → `web: node BE/server.js`
- **Database:** Neon (console.neon.tech, project "pythia")

Render environment variables that matter:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon connection string — must include `?sslmode=require`. The only one that changes if the DB backend changes. |
| `JWT_SECRET` | Any long random value, managed by Render, unrelated to the DB. |
| `ALLOWED_ORIGINS` | **Must** be set to `https://pythia-bookshop.onrender.com`. If unset, CORS defaults to localhost-only and the live site's own frontend gets rejected by its own backend. |
| `NODE_ENV`, `PORT` | Standard server config. |

GitHub Pages was considered and rejected as a host: it only serves static
files, and this app has ~20 API endpoints plus a Postgres DB behind them, so
Pages alone would serve the UI but 404 on everything data-driven.
