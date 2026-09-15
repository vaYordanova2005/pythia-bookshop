# Database

PostgreSQL. Schema lives in [`BE/pythia_pg.sql`](../BE/pythia_pg.sql) (schema +
first 8 books), extended by [`BE/seed_books.sql`](../BE/seed_books.sql) (34 more
books, safe to re-run — nothing duplicates) and [`BE/seed_pg.js`](../BE/seed_pg.js)
(demo users and reviews).

`BE/database/library_shop.sql` and `BE/bibliotheca.sql` are earlier/alternate
schema files from before the project moved to Postgres on Neon (it started on
Supabase, then local Postgres, then Neon). `pythia_pg.sql` is the one actually
used to provision the database today (`setup-db.ps1` runs it).

## Tables

| Table | Purpose | Key relationships |
|---|---|---|
| `users` | Accounts | `role` is `client` \| `seller` \| `admin` |
| `books` | Catalogue | → `publishers`, → `genres`, → `users` (`added_by`) |
| `authors` | Author names | via `book_authors` (many-to-many) |
| `publishers` | Publisher names | referenced by `books.publisher_id` |
| `genres` | Genre names | referenced by `books.genre_id` |
| `book_authors` | Book↔author join table | composite PK |
| `tags` | Free-form tags | via `book_tags` (many-to-many) |
| `book_tags` | Book↔tag join table | composite PK |
| `reviews` | Ratings/comments | one per `(user_id, book_id)` — unique constraint |
| `favorites` | Saved books | composite PK `(user_id, book_id)` |
| `orders` | Checkout records | `user_id` nullable — guest checkout allowed |
| `order_items` | Line items per order | → `orders`, → `books` |
| `promo_codes` | Discount codes | e.g. `BOOK10` = 10% off |

## Notable constraints

- `books.price > 0`, `books.stock >= 0`, `books.pages > 0` — enforced with `CHECK`.
- `reviews.rating` is 1–5, and `UNIQUE(user_id, book_id)` stops duplicate reviews.
- `users.role` is constrained to `'client' | 'seller' | 'admin'`.
- `books.is_visible` is a soft-delete flag — sellers/admins hide rather than
  hard-delete listings that have existing orders.
- Order money fields (`subtotal`, `promo_discount`, `threshold_disc`, `shipping`,
  `total`) are all stored on the `orders` row itself rather than recomputed from
  `order_items` later, since prices and promos can change after the fact.

## Relationships (simplified)

```
users ──< reviews >── books ──< book_authors >── authors
  │                     │  │
  │                     │  └──< book_tags >── tags
  │                     │
  ├──< favorites >──────┘
  │                     │
  └──< orders ──< order_items >──┘
                     genres ──< books
                  publishers ──< books
```

## Seed data

- 9 genres, 9 publishers, 14 authors, 12 tags, 2 promo codes (`BOOK10`, `WELCOME5`)
  from `pythia_pg.sql`.
- 8 books in `pythia_pg.sql`, 34 more in `seed_books.sql` — 42 total, matching
  the README's catalogue count.
- Demo users (admin / seller / client) and sample reviews come from `seed_pg.js`
  (see [local-setup.md](local-setup.md) for credentials).

## Windows note

`psql.exe` hangs against Neon (or any cloud Postgres) unless `gssencmode=disable`
is added to the connection string — see `?gssencmode=disable` usage if you run
manual `psql` commands against the hosted DB on Windows.
