# Pythia Bookshop

*Your oracle of stories*

An online bookshop built with Node.js, Express and PostgreSQL.

**Live site:** https://pythia-bookshop.onrender.com

---

## Features

- Book catalogue with search, genre filters, price/year/sort
- Real book covers via Open Library
- Ratings and comments per book
- Favorites (requires login)
- Cart and checkout with order history
- Community chat
- User roles: client, seller, admin
- Discount code `BOOK10` for 10% off
- Free shipping over 40 EUR
- Extra 5% discount over 50 EUR
- JWT authentication, bcrypt passwords, rate limiting, XSS protection

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS, HTML, CSS |
| Backend | Node.js + Express |
| Database | PostgreSQL (Supabase) |
| Hosting | Render |

---

## Run locally

```bash
git clone https://github.com/vaYordanova2005/pythia-bookshop.git
cd pythia-bookshop
npm install
cp .env.example .env
node seed_pg.js
npm start
```

Open `http://localhost:5173`

---

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@pythia.test | admin123 |
| Seller | seller@pythia.test | seller123 |
| Client | reader@pythia.test | reader123 |
