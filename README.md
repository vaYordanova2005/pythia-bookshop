# Pythia Bookshop

*Δελφοί · the oracle of stories*

An online bookshop built with Node.js, Express and PostgreSQL, with an animated
WebGL interface.

**Live:** https://pythia-bookshop.onrender.com

---

## Features

- Catalogue of 42 books across 9 genres, with search, genre / price / year filters and sorting
- Real book covers from Open Library
- Ratings and comments per book
- Favorites (requires login)
- Cart and checkout with order history
- Community chat
- User roles: client, seller, admin
- Discount code `BOOK10` for 10% off
- Free shipping over 40 EUR, extra 5% over 50 EUR
- JWT authentication, bcrypt passwords, rate limiting, XSS protection

## Interface

- Site-wide animated backdrop — a hand-written GLSL fragment shader (domain-warped
  fbm smoke with gold veins) that reacts to the cursor. No 3D libraries.
- Kinetic wordmark: letters fly in one by one and shy away from the pointer
- Book cards with cursor-tracked 3D tilt, depth layers and a glare sweep
- Curtain wipe between pages, scroll progress bar, custom cursor
- Falls back to an animated CSS gradient without WebGL, and to a static layout
  under `prefers-reduced-motion`

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS, HTML, CSS, raw WebGL |
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
powershell -ExecutionPolicy Bypass -File .\setup-db.ps1
```

The script asks for your postgres password, creates the `pythia` database, loads
the schema and books, seeds the demo users and writes `DATABASE_URL` into `.env`.

Manually, on any platform:

```bash
psql -U postgres -c "CREATE DATABASE pythia"
psql -U postgres -d pythia -f pythia_pg.sql    # schema + 8 books
psql -U postgres -d pythia -f seed_books.sql   # 34 more books
node seed_pg.js                                # demo users, reviews, chat
cp .env.example .env                           # then fill in DATABASE_URL
npm start
```

Open `http://localhost:5173`

---

## Files

| File | Purpose |
|------|---------|
| `server.js` | Express API and static file server |
| `app.js` | Frontend logic — routing, cart, auth, rendering |
| `styles.css` | Base layout and components |
| `fx.css` / `fx.js` | Animation layer: WebGL backdrop, dark glass surfaces, 3D cards |
| `pythia_pg.sql` | Schema and initial seed |
| `seed_books.sql` | The rest of the catalogue — re-runnable, nothing duplicates |
| `seed_pg.js` | Demo users, reviews and chat messages |
| `setup-db.ps1` | One-shot local database setup |

---

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@pythia.test | admin123 |
| Seller | seller@pythia.test | seller123 |
| Client | reader@pythia.test | reader123 |
