# Pythia Bookshop

*Δελφοί · the oracle of stories*

An online bookshop built with Node.js, Express and PostgreSQL.

**Live:** https://pythia-bookshop.onrender.com

---

## Features

- Catalogue of 42 books across 9 genres, with search, genre / price / year filters and sorting
- Real book covers from Open Library
- Ratings and comments per book
- Favorites (requires login)
- Cart and checkout with order history
- User roles: client, seller, admin
- Discount code `BOOK10` for 10% off
- Free shipping over 40 EUR, extra 5% over 50 EUR
- JWT authentication, bcrypt passwords, rate limiting, XSS protection

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS, HTML, CSS |
| Backend | Node.js + Express |
| Database | PostgreSQL (Neon) |
| Hosting | Render |

No build step and no frontend dependencies — the browser loads the source files directly.

---

## Run locally

Requires Node.js 18+ and a local PostgreSQL server.

```bash
git clone https://github.com/vaYordanova2005/pythia-bookshop.git
cd pythia-bookshop
npm install
```

Then set up the database. On Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\BE\setup-db.ps1
```

The script asks for your postgres password, creates the `pythia` database, loads
the schema and books, seeds the demo users and writes `DATABASE_URL` into `BE/.env`.

Manually, on any platform:

```bash
psql -U postgres -c "CREATE DATABASE pythia"
psql -U postgres -d pythia -f BE/pythia_pg.sql    # schema + 8 books
psql -U postgres -d pythia -f BE/seed_books.sql   # 34 more books
node BE/seed_pg.js                                # demo users, reviews
cp BE/.env.example BE/.env                        # then fill in DATABASE_URL
npm start
```

Open `http://localhost:5173`

---

## Files

| File | Purpose |
|------|---------|
| `BE/server.js` | Express API and static file server |
| `FE/app.js` | Frontend logic — routing, cart, auth, rendering |
| `FE/styles.css` | Base layout and components |
| `BE/pythia_pg.sql` | Schema and initial seed |
| `BE/seed_books.sql` | The rest of the catalogue — re-runnable, nothing duplicates |
| `BE/seed_pg.js` | Demo users and reviews |
| `BE/setup-db.ps1` | One-shot local database setup |

See [docs/](docs/) for architecture, API, database and local-setup details.

---

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Seller | seller@pythia.test | seller123 |
| Client | reader@pythia.test | reader123 |
