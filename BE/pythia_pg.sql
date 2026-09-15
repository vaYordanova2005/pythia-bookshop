-- Pythia Bookshop — PostgreSQL schema + seed data

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  username   VARCHAR(60)  NOT NULL UNIQUE,
  full_name  VARCHAR(120) NOT NULL,
  email      VARCHAR(255) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  role       VARCHAR(20)  NOT NULL DEFAULT 'client' CHECK (role IN ('client','seller','admin')),
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

-- AUTHORS
CREATE TABLE IF NOT EXISTS authors (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
);

-- PUBLISHERS
CREATE TABLE IF NOT EXISTS publishers (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
);

-- GENRES
CREATE TABLE IF NOT EXISTS genres (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

-- BOOKS
CREATE TABLE IF NOT EXISTS books (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  pages        INT          NOT NULL DEFAULT 200 CHECK (pages > 0),
  year         INT          NOT NULL,
  price        NUMERIC(8,2) NOT NULL CHECK (price > 0),
  stock        INT          NOT NULL DEFAULT 1 CHECK (stock >= 0),
  cover_color  VARCHAR(20)  DEFAULT '#2c4a2c',
  cover_url    VARCHAR(500),
  publisher_id INT          NOT NULL REFERENCES publishers(id),
  genre_id     INT          NOT NULL REFERENCES genres(id),
  added_by     INT          REFERENCES users(id) ON DELETE SET NULL,
  is_visible   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- BOOK <-> AUTHORS
CREATE TABLE IF NOT EXISTS book_authors (
  book_id   INT NOT NULL REFERENCES books(id)   ON DELETE CASCADE,
  author_id INT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, author_id)
);

-- TAGS
CREATE TABLE IF NOT EXISTS tags (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS book_tags (
  book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  tag_id  INT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (book_id, tag_id)
);

-- REVIEWS
CREATE TABLE IF NOT EXISTS reviews (
  id         SERIAL PRIMARY KEY,
  user_id    INT      NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  book_id    INT      NOT NULL REFERENCES books(id)  ON DELETE CASCADE,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, book_id)
);

-- FAVORITES
CREATE TABLE IF NOT EXISTS favorites (
  user_id    INT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  book_id    INT NOT NULL REFERENCES books(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, book_id)
);

-- ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id              SERIAL PRIMARY KEY,
  user_id         INT          REFERENCES users(id) ON DELETE SET NULL,
  full_name       VARCHAR(120) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  city            VARCHAR(100) NOT NULL,
  street          VARCHAR(200) NOT NULL,
  number          VARCHAR(20)  NOT NULL,
  payment_method  VARCHAR(30)  NOT NULL,
  needs_invoice   BOOLEAN      NOT NULL DEFAULT FALSE,
  promo_code      VARCHAR(40),
  subtotal        NUMERIC(8,2) NOT NULL,
  promo_discount  NUMERIC(8,2) NOT NULL DEFAULT 0,
  threshold_disc  NUMERIC(8,2) NOT NULL DEFAULT 0,
  shipping        NUMERIC(8,2) NOT NULL DEFAULT 0,
  total           NUMERIC(8,2) NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
  id         SERIAL PRIMARY KEY,
  order_id   INT          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  book_id    INT          NOT NULL REFERENCES books(id),
  quantity   INT          NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(8,2) NOT NULL
);

-- PROMO CODES
CREATE TABLE IF NOT EXISTS promo_codes (
  id           SERIAL PRIMARY KEY,
  code         VARCHAR(40)  NOT NULL UNIQUE,
  discount_pct SMALLINT     NOT NULL CHECK (discount_pct BETWEEN 1 AND 100),
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  expires_at   TIMESTAMPTZ
);

-- ═══════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════

INSERT INTO genres (name) VALUES
  ('Science Fiction'),('Fantasy'),('Horror'),('Classic'),
  ('Mystery'),('Romance'),('History'),('Science'),('Comedy')
ON CONFLICT DO NOTHING;

INSERT INTO publishers (name) VALUES
  ('Secker & Warburg'),('Bloomsbury'),('Doubleday'),('Gnome Press'),
  ('Chilton Books'),('Arkham House'),('Pan Books'),('Penguin Books'),('Bard')
ON CONFLICT DO NOTHING;

INSERT INTO authors (name) VALUES
  ('George Orwell'),('J.K. Rowling'),('Stephen King'),('Isaac Asimov'),
  ('Frank Herbert'),('H.P. Lovecraft'),('Douglas Adams'),('Neil Gaiman'),
  ('Terry Pratchett'),('Bram Stoker'),('Leo Tolstoy'),('Gabriel Garcia Marquez'),
  ('Carl Sagan'),('Arthur Conan Doyle')
ON CONFLICT DO NOTHING;

INSERT INTO tags (name) VALUES
  ('Classic'),('Dystopia'),('Epic'),('Magic'),('Gothic'),('Detective'),
  ('Space'),('Philosophical'),('Magical realism'),('Family'),('Desert'),('Universe')
ON CONFLICT DO NOTHING;

INSERT INTO promo_codes (code, discount_pct, is_active) VALUES
  ('BOOK10', 10, TRUE), ('WELCOME5', 5, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO books (title, description, pages, year, price, stock, cover_color, cover_url, publisher_id, genre_id) VALUES
  ('1984',                          'A chilling dystopian novel about surveillance and power.',     328,  1949, 15.50, 5, '#1a1a3a', 'https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg', 1, 4),
  ('Dune',                          'Epic survival story on the desert world Arrakis.',             412,  1965, 18.99, 7, '#2c4a2c', 'https://covers.openlibrary.org/b/isbn/9780441013593-L.jpg', 5, 1),
  ('Dracula',                       'The gothic tale of Count Dracula.',                            418,  1897, 14.50, 4, '#4a1a1a', 'https://covers.openlibrary.org/b/isbn/9780486411095-L.jpg', 9, 3),
  ('War and Peace',                 'Napoleon-era Russia through the eyes of noble families.',      1225, 1869, 22.00, 5, '#1a2a4a', 'https://covers.openlibrary.org/b/isbn/9781400079988-L.jpg', 8, 4),
  ('Sherlock Holmes',               'Collected mysteries featuring the brilliant detective.',        307,  2024, 12.99, 9, '#3a2a1a', 'https://covers.openlibrary.org/b/isbn/9781503280125-L.jpg', 8, 5),
  ('One Hundred Years of Solitude', 'The magical story of the Buendia family in Macondo.',          417,  1967, 19.90, 3, '#2a1a3a', 'https://covers.openlibrary.org/b/isbn/9780060883287-L.jpg', 9, 6),
  ('Cosmos',                        'A lucid exploration of the universe and our place in it.',     365,  1980, 16.90, 8, '#0a2840', 'https://covers.openlibrary.org/b/isbn/9780345539434-L.jpg', 8, 8),
  ('The Hitchhiker''s Guide',       'The funniest book in the universe — or any other.',            224,  1979, 13.50, 6, '#1a3a2a', 'https://covers.openlibrary.org/b/isbn/9780345391803-L.jpg', 7, 9)
ON CONFLICT DO NOTHING;

-- Link books to authors (by position in inserts above)
DO $$
DECLARE
  b1 INT; b2 INT; b3 INT; b4 INT; b5 INT; b6 INT; b7 INT; b8 INT;
  a1 INT; a5 INT; a10 INT; a11 INT; a13 INT; a14 INT; a12 INT; a7 INT;
BEGIN
  SELECT id INTO b1 FROM books WHERE title='1984';
  SELECT id INTO b2 FROM books WHERE title='Dune';
  SELECT id INTO b3 FROM books WHERE title='Dracula';
  SELECT id INTO b4 FROM books WHERE title='War and Peace';
  SELECT id INTO b5 FROM books WHERE title='Sherlock Holmes';
  SELECT id INTO b6 FROM books WHERE title='One Hundred Years of Solitude';
  SELECT id INTO b7 FROM books WHERE title='Cosmos';
  SELECT id INTO b8 FROM books WHERE title='The Hitchhiker''s Guide';

  SELECT id INTO a1  FROM authors WHERE name='George Orwell';
  SELECT id INTO a5  FROM authors WHERE name='Frank Herbert';
  SELECT id INTO a10 FROM authors WHERE name='Bram Stoker';
  SELECT id INTO a11 FROM authors WHERE name='Leo Tolstoy';
  SELECT id INTO a14 FROM authors WHERE name='Arthur Conan Doyle';
  SELECT id INTO a12 FROM authors WHERE name='Gabriel Garcia Marquez';
  SELECT id INTO a13 FROM authors WHERE name='Carl Sagan';
  SELECT id INTO a7  FROM authors WHERE name='Douglas Adams';

  INSERT INTO book_authors VALUES (b1,a1),(b2,a5),(b3,a10),(b4,a11),(b5,a14),(b6,a12),(b7,a13),(b8,a7)
  ON CONFLICT DO NOTHING;
END $$;
