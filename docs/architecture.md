# Architecture

Pythia Bookshop is a small full-stack app: a no-build vanilla JS frontend served
as static files by an Express backend, backed by a single PostgreSQL database.

```
Browser
  │  fetch("/api/...")
  ▼
Express server (BE/server.js)
  │  pg.Pool
  ▼
PostgreSQL (Neon in production, local Postgres in dev)
```

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS, HTML, CSS — no framework, no build step |
| Backend | Node.js + Express (ESM) |
| Database | PostgreSQL (Neon in production) |
| Auth | JWT (7-day expiry) + bcrypt password hashes |
| Hosting | Render (`Procfile`: `web: node BE/server.js`) |

## Request flow

1. `BE/server.js` serves the static files in `FE/` and exposes a REST API under `/api/*`.
2. `FE/app.js` is a single file that does client-side routing (show/hide `<section>`
   pages), keeps app state in one `state` object, and talks to the API through a
   small `api()` fetch wrapper (`FE/app.js:59`).
3. The API validates/authorizes each request (JWT bearer token + role checks) and
   runs parameterized SQL against Postgres via a `pg.Pool`.

See [backend.md](backend.md), [frontend.md](frontend.md), and [database.md](database.md)
for the details of each layer, and [local-setup.md](local-setup.md) to run it all
on your machine.

## Repo layout

| Path | Purpose |
|------|---------|
| `BE/server.js` | Express app: middleware, all API routes |
| `BE/pythia_pg.sql` | Schema + initial seed (8 books) |
| `BE/seed_books.sql` | Rest of the catalogue (34 more books), idempotent |
| `BE/seed_pg.js` | Demo users and reviews |
| `BE/setup-db.ps1` | One-shot local DB setup script (Windows) |
| `FE/index.html` | Page markup — one `<section>` per route |
| `FE/app.js` | All frontend logic: routing, state, rendering, API calls |
| `FE/styles.css` | All styling |
| `Procfile` | Render process definition |

## History: the WebGL interface

An earlier version of this project had a WebGL animation layer (`fx.css`/`fx.js` —
a hand-written GLSL backdrop shader, 3D card tilt, kinetic wordmark). Commit
`b347f62` ("Revert to pre-3D design, reorganize into BE/FE/docs") deliberately
pulled that layer out into a separate game-design project and reverted the UI
to the plain `styles.css`/`app.js` design that predates it — it wasn't dropped
by accident. `FE/` has contained only `index.html`, `app.js`, and `styles.css`
since.
