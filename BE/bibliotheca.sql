DROP DATABASE IF EXISTS bibliotheca;
CREATE DATABASE bibliotheca CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bibliotheca;

-- ─────────────────────────────────────────
-- 1. USERS  (client / seller / admin)
-- ─────────────────────────────────────────
CREATE TABLE users (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    username     VARCHAR(60)  NOT NULL UNIQUE,
    full_name    VARCHAR(120) NOT NULL,
    email        VARCHAR(255) NOT NULL UNIQUE,
    password     VARCHAR(255) NOT NULL,          -- bcrypt hash
    role         ENUM('client','seller','admin') NOT NULL DEFAULT 'client',
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 2. AUTHORS
-- ─────────────────────────────────────────
CREATE TABLE authors (
    id   INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 3. PUBLISHERS
-- ─────────────────────────────────────────
CREATE TABLE publishers (
    id   INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 4. GENRES
-- ─────────────────────────────────────────
CREATE TABLE genres (
    id   INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 5. BOOKS
-- ─────────────────────────────────────────
CREATE TABLE books (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    title          VARCHAR(255) NOT NULL,
    description    TEXT,
    pages          INT          NOT NULL CHECK (pages > 0),
    year           INT          NOT NULL,
    price          DECIMAL(8,2) NOT NULL CHECK (price > 0),
    stock          INT          NOT NULL DEFAULT 1 CHECK (stock >= 0),
    cover_color    VARCHAR(20)  DEFAULT '#2c4a2c',   -- hex colour for UI
    cover_url      VARCHAR(500) NULL,                 -- optional image URL
    publisher_id   INT          NOT NULL,
    genre_id       INT          NOT NULL,
    added_by       INT          NULL,                 -- seller/admin user id
    is_visible     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (publisher_id) REFERENCES publishers(id),
    FOREIGN KEY (genre_id)     REFERENCES genres(id),
    FOREIGN KEY (added_by)     REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 6. BOOK ↔ AUTHORS  (many-to-many)
-- ─────────────────────────────────────────
CREATE TABLE book_authors (
    book_id   INT NOT NULL,
    author_id INT NOT NULL,
    PRIMARY KEY (book_id, author_id),
    FOREIGN KEY (book_id)   REFERENCES books(id)   ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 7. BOOK TAGS
-- ─────────────────────────────────────────
CREATE TABLE tags (
    id   INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(60) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE book_tags (
    book_id INT NOT NULL,
    tag_id  INT NOT NULL,
    PRIMARY KEY (book_id, tag_id),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 8. REVIEWS  (rating 1-5 + comment)
-- ─────────────────────────────────────────
CREATE TABLE reviews (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT  NOT NULL,
    book_id    INT  NOT NULL,
    rating     TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_user_book (user_id, book_id),
    FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 9. FAVORITES
-- ─────────────────────────────────────────
CREATE TABLE favorites (
    user_id    INT NOT NULL,
    book_id    INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, book_id),
    FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 10. ORDERS
-- ─────────────────────────────────────────
CREATE TABLE orders (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT          NULL,   -- NULL = guest checkout
    full_name       VARCHAR(120) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    city            VARCHAR(100) NOT NULL,
    street          VARCHAR(200) NOT NULL,
    number          VARCHAR(20)  NOT NULL,
    payment_method  ENUM('card','cash_on_delivery','bank_transfer') NOT NULL,
    needs_invoice   BOOLEAN      NOT NULL DEFAULT FALSE,
    promo_code      VARCHAR(40)  NULL,
    subtotal        DECIMAL(8,2) NOT NULL,
    promo_discount  DECIMAL(8,2) NOT NULL DEFAULT 0,
    threshold_disc  DECIMAL(8,2) NOT NULL DEFAULT 0,
    shipping        DECIMAL(8,2) NOT NULL DEFAULT 0,
    total           DECIMAL(8,2) NOT NULL,
    status          ENUM('pending','confirmed','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 11. ORDER ITEMS
-- ─────────────────────────────────────────
CREATE TABLE order_items (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    order_id  INT          NOT NULL,
    book_id   INT          NOT NULL,
    quantity  INT          NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(8,2) NOT NULL,

    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id)  REFERENCES books(id)  ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 12. COMMUNITY MESSAGES
-- ─────────────────────────────────────────
CREATE TABLE messages (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT  NOT NULL,
    text       TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 13. PROMO CODES
-- ─────────────────────────────────────────
CREATE TABLE promo_codes (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    code        VARCHAR(40)  NOT NULL UNIQUE,
    discount_pct TINYINT     NOT NULL CHECK (discount_pct BETWEEN 1 AND 100),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    expires_at  DATETIME     NULL
) ENGINE=InnoDB;

-- ═════════════════════════════════════════
-- SEED DATA
-- ═════════════════════════════════════════

-- GENRES
INSERT INTO genres (name) VALUES
('Science Fiction'),('Fantasy'),('Horror'),('Classic'),
('Mystery'),('Romance'),('History'),('Science'),('Comedy');

-- PUBLISHERS
INSERT INTO publishers (name) VALUES
('Secker & Warburg'),('Bloomsbury'),('Doubleday'),('Gnome Press'),
('Chilton Books'),('Arkham House'),('Pan Books'),('Penguin Books'),('Bard');

-- AUTHORS
INSERT INTO authors (name) VALUES
('George Orwell'),('J.K. Rowling'),('Stephen King'),('Isaac Asimov'),
('Frank Herbert'),('H.P. Lovecraft'),('Douglas Adams'),('Neil Gaiman'),
('Terry Pratchett'),('Bram Stoker'),('Leo Tolstoy'),('Gabriel Garcia Marquez'),
('Carl Sagan'),('Arthur Conan Doyle');

-- TAGS
INSERT INTO tags (name) VALUES
('Classic'),('Dystopia'),('Epic'),('Magic'),('Gothic'),('Detective'),
('Space'),('Philosophical'),('Magical realism'),('Family'),('Desert'),('Universe');

-- NOTE: demo users (admin / seller / reader) are NOT inserted here because
-- their passwords must be bcrypt-hashed at runtime. Run `npm run seed`
-- after creating the database — it inserts admin@bibliotheca.test (admin123),
-- seller@bibliotheca.test (seller123) and reader@bibliotheca.test (reader123)
-- with properly generated bcrypt hashes.

-- BOOKS
INSERT INTO books (title, description, pages, year, price, stock, cover_color, publisher_id, genre_id) VALUES
('1984',                          'A chilling dystopian novel about surveillance and power.',              328, 1949, 15.50, 5,  '#1a1a3a', 1, 4),
('Dune',                          'Epic survival story on the desert world Arrakis.',                     412, 1965, 18.99, 7,  '#2c4a2c', 5, 1),
('Dracula',                       'The gothic tale of Count Dracula.',                                    418, 1897, 14.50, 4,  '#4a1a1a', 9, 3),
('War and Peace',                 'Napoleon-era Russia through the eyes of noble families.',               1225,1869, 22.00, 5,  '#1a2a4a', 8, 4),
('Sherlock Holmes',               'Collected mysteries featuring the brilliant detective.',                307, 2024, 12.99, 9,  '#3a2a1a', 8, 5),
('One Hundred Years of Solitude', 'The magical story of the Buendia family in Macondo.',                  417, 1967, 19.90, 3,  '#2a1a3a', 9, 6),
('Cosmos',                        'A lucid exploration of the universe and our place in it.',             365, 1980, 16.90, 8,  '#0a2840', 8, 8),
('The Hitchhiker\'s Guide',       'The funniest book in the universe — or any other.',                   224, 1979, 13.50, 6,  '#1a3a2a', 7, 9);

-- BOOK ↔ AUTHORS
INSERT INTO book_authors (book_id, author_id) VALUES
(1,1),(2,5),(3,10),(4,11),(5,14),(6,12),(7,13),(8,7);

-- BOOK ↔ TAGS
INSERT INTO book_tags (book_id, tag_id) VALUES
(1,1),(1,2),(2,1),(2,3),(2,11),(3,1),(3,5),(4,1),(4,8),
(5,6),(5,1),(6,9),(6,10),(7,12),(8,1);

-- PROMO CODES
INSERT INTO promo_codes (code, discount_pct, is_active) VALUES
('BOOK10', 10, TRUE),
('WELCOME5', 5, TRUE);

-- Sample reviews and community messages are inserted by `npm run seed`
-- (they reference the demo users created there).
