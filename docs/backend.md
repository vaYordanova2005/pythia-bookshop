# Backend

Everything lives in one file, [`BE/server.js`](../BE/server.js) (~500 lines):
Express app setup, middleware, and every route.

## Startup

- Loads `BE/.env` via `dotenv`.
- Refuses to start without `JWT_SECRET` (no guessable default).
- Connects to Postgres via `pg.Pool`, using `DATABASE_URL`. SSL is only negotiated
  for non-localhost hosts (a local Postgres has no SSL listener).
- Neon (the production DB) suspends its compute after a few idle minutes; the
  `query()` helper retries once on `ECONNRESET` to absorb the wake-up failure.
- Every route handler is auto-wrapped to catch rejected promises (Express 4
  doesn't do this itself), so a failed query returns a 500 instead of crashing
  the process.

## Middleware

| Middleware | Purpose |
|---|---|
| `helmet` | Security headers (CSP disabled — the frontend is inline-script-free but this wasn't tightened further) |
| `cors` | Origin allow-list from `ALLOWED_ORIGINS` env var |
| `express.json({ limit: "50kb" })` | Body parsing with a small size cap |
| `express.static("../FE")` | Serves the frontend |
| Rate limiters | Applied per-route (see below) on auth and write endpoints |
| `auth` | Verifies the `Authorization: Bearer <jwt>` header, sets `req.user` |
| `requireRole(...roles)` | 403s unless `req.user.role` is in the allowed list |
| `validate` | Runs `express-validator` checks, 400s with the first error message |

Roles are `client`, `seller`, `admin` (see [database.md](database.md#users)).

## API routes

All routes are prefixed `/api`.

### Auth
| Method & path | Auth | Notes |
|---|---|---|
| `POST /auth/signup` | — | Rate-limited, validated, bcrypt-hashes password |
| `POST /auth/signin` | — | Rate-limited, returns a signed JWT |
| `GET /auth/me` | JWT | Returns the current user |

### Books
| Method & path | Auth | Notes |
|---|---|---|
| `GET /books` | — | List with filters (genre, price, year, search, sort) |
| `GET /books/:id` | — | Single book detail |
| `POST /books` | seller/admin | Create a listing |
| `DELETE /books/:id` | admin | Remove a listing |
| `GET /genres` | — | Genre list for filters |

### Reviews
| Method & path | Auth | Notes |
|---|---|---|
| `GET /books/:id/reviews` | — | List reviews for a book |
| `POST /books/:id/reviews` | JWT | One review per user per book (`UNIQUE(user_id, book_id)`) |
| `DELETE /reviews/:id` | admin | Moderation |

### Favorites
| Method & path | Auth | Notes |
|---|---|---|
| `GET /favorites` | JWT | Current user's favorited books |
| `POST /favorites/:bookId` | JWT | Add |
| `DELETE /favorites/:bookId` | JWT | Remove |

### Orders
| Method & path | Auth | Notes |
|---|---|---|
| `POST /orders` | optional JWT | Checkout — accepts guest or logged-in orders; server recomputes totals (promo discount, free-shipping threshold) rather than trusting client-sent prices |
| `GET /orders` | JWT | Current user's order history |

### Admin
| Method & path | Auth | Notes |
|---|---|---|
| `GET /admin/users` | admin | List all users |
| `PATCH /admin/users/:id` | admin | Update a user (e.g. activate/deactivate, change role) |

### Promo
| Method & path | Auth | Notes |
|---|---|---|
| `GET /promo/:code` | — | Look up a discount code (e.g. `BOOK10`) |

## Security notes

- Passwords hashed with `bcrypt`.
- JWTs signed with `JWT_SECRET`, 7-day expiry, carry `{ id, username, role }`.
- Order totals (subtotal, promo discount, free-shipping threshold, shipping,
  final total) are computed server-side in `POST /orders`, not trusted from the
  client — see commit `aa4c988` ("Fix XSS, auth, and order-integrity security issues").
- `POST /orders` runs in a DB transaction: it `SELECT ... FOR UPDATE`-locks the
  ordered books' rows before checking stock, so two concurrent checkouts can't
  both oversell the same copy. Stock is decremented and the order is written in
  the same transaction; any failure (missing book, insufficient stock) rolls
  back everything.
- Rate limiting is applied to auth and write-heavy routes to slow down abuse.
