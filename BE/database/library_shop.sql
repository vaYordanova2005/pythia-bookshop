DROP DATABASE IF EXISTS bibliotheca_shop;
CREATE DATABASE bibliotheca_shop CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bibliotheca_shop;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50),
  role ENUM('admin', 'client', 'seller') NOT NULL DEFAULT 'client',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

CREATE TABLE user_addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  city VARCHAR(120) NOT NULL,
  street_or_district VARCHAR(255) NOT NULL,
  address_number VARCHAR(50) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE genres (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(120) NOT NULL UNIQUE
) ENGINE = InnoDB;

CREATE TABLE authors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
) ENGINE = InnoDB;

CREATE TABLE publishers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
) ENGINE = InnoDB;

CREATE TABLE books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  seller_id INT,
  genre_id INT NOT NULL,
  publisher_id INT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  publication_year INT,
  pages INT CHECK (pages IS NULL OR pages > 0),
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  stock_quantity INT NOT NULL DEFAULT 1 CHECK (stock_quantity >= 0),
  rating_average DECIMAL(3, 2) NOT NULL DEFAULT 0,
  cover_color VARCHAR(20) NOT NULL DEFAULT '#2c4a2c',
  cover_image_url VARCHAR(500),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (genre_id) REFERENCES genres(id),
  FOREIGN KEY (publisher_id) REFERENCES publishers(id) ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE book_authors (
  book_id INT NOT NULL,
  author_id INT NOT NULL,
  PRIMARY KEY (book_id, author_id),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE book_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  tag VARCHAR(80) NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE favorites (
  user_id INT NOT NULL,
  book_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, book_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE discount_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  discount_type ENUM('percent', 'fixed') NOT NULL,
  discount_value DECIMAL(10, 2) NOT NULL CHECK (discount_value > 0),
  min_order_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  starts_at DATETIME,
  expires_at DATETIME,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE = InnoDB;

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  city VARCHAR(120) NOT NULL,
  street_or_district VARCHAR(255) NOT NULL,
  address_number VARCHAR(50) NOT NULL,
  payment_method ENUM('card', 'cash_on_delivery', 'bank_transfer') NOT NULL,
  wants_invoice BOOLEAN NOT NULL DEFAULT FALSE,
  discount_code_id INT,
  subtotal DECIMAL(10, 2) NOT NULL,
  promo_discount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  threshold_discount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  shipping_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  status ENUM('new', 'paid', 'packed', 'shipped', 'completed', 'cancelled') NOT NULL DEFAULT 'new',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (discount_code_id) REFERENCES discount_codes(id) ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  book_id INT,
  title_snapshot VARCHAR(255) NOT NULL,
  author_snapshot VARCHAR(255) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  book_id INT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY one_review_per_user_book (user_id, book_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE community_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  book_id INT,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL
) ENGINE = InnoDB;

INSERT INTO users (username, full_name, email, password_hash, role) VALUES
('admin', 'Site Admin', 'admin@bibliotheca.test', 'demo-only-change-me', 'admin'),
('seller_ivy', 'Ivy Seller', 'seller@bibliotheca.test', 'demo-only-change-me', 'seller'),
('reader123', 'Jane Reader', 'reader@bibliotheca.test', 'demo-only-change-me', 'client');

INSERT INTO genres (name, slug) VALUES
('Science Fiction', 'science-fiction'),
('Horror', 'horror'),
('Classic', 'classic'),
('Mystery', 'mystery'),
('Romance', 'romance'),
('History', 'history'),
('Science', 'science');

INSERT INTO authors (name) VALUES
('Frank Herbert'), ('Bram Stoker'), ('Leo Tolstoy'), ('Arthur Conan Doyle'),
('George Orwell'), ('Gabriel Garcia Marquez'), ('John Ross'), ('Carl Sagan');

INSERT INTO publishers (name) VALUES
('Ace Books'), ('Archibald Constable and Company'), ('The Russian Messenger'),
('George Newnes'), ('Secker & Warburg'), ('Editorial Sudamericana'), ('Bibliotheca Press'), ('Random House');

INSERT INTO books (seller_id, genre_id, publisher_id, title, description, publication_year, pages, price, stock_quantity, rating_average, cover_color) VALUES
(2, 1, 1, 'Dune', 'A sweeping story of survival, politics and prophecy on the desert world Arrakis.', 2021, 412, 18.99, 7, 5.00, '#2c4a2c'),
(2, 2, 2, 'Dracula', 'The gothic tale of Count Dracula and the people drawn into his shadow.', 2022, 418, 14.50, 4, 4.00, '#4a1a1a'),
(2, 3, 3, 'War and Peace', 'A monumental novel about families, war, love and history during the Napoleonic era.', 2021, 1225, 22.00, 5, 5.00, '#1a2a4a'),
(2, 4, 4, 'Sherlock Holmes', 'Collected mysteries featuring the brilliant detective Sherlock Holmes.', 2024, 320, 12.99, 9, 5.00, '#3a2a1a'),
(2, 1, 5, '1984', 'A chilling dystopian novel about surveillance, language and power.', 2023, 328, 15.50, 5, 5.00, '#1a1a3a'),
(2, 5, 6, 'One Hundred Years of Solitude', 'The magical story of the Buendia family and the town of Macondo.', 2022, 417, 19.90, 3, 5.00, '#2a1a3a'),
(2, 6, 7, 'Secrets of Egypt', 'An illustrated journey through the mysteries of ancient Egypt.', 2024, 260, 24.99, 6, 4.00, '#3a2800'),
(2, 7, 8, 'Cosmos', 'A lucid exploration of the universe and our place within it.', 2023, 384, 16.90, 8, 4.00, '#0a2840');

INSERT INTO book_authors (book_id, author_id) VALUES
(1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (6, 6), (7, 7), (8, 8);

INSERT INTO book_tags (book_id, tag) VALUES
(1, 'Classic'), (1, 'Epic'), (1, 'Desert'),
(2, 'Gothic'), (2, 'Classic'),
(3, 'Classic'), (3, 'Historical'),
(4, 'Detective'), (4, 'Classic'),
(5, 'Dystopia'), (5, 'Classic'),
(6, 'Magical realism'), (6, 'Family'),
(7, 'Ancient Egypt'), (8, 'Universe');

INSERT INTO discount_codes (code, discount_type, discount_value, min_order_total, is_active) VALUES
('BOOK10', 'percent', 10.00, 0.00, TRUE);

INSERT INTO reviews (user_id, book_id, rating, comment) VALUES
(3, 1, 5, 'A landmark science-fiction novel.'),
(3, 8, 4, 'Beautiful and accessible science writing.');

INSERT INTO community_messages (user_id, book_id, message) VALUES
(3, 1, 'Dune is absolutely worth the hype.'),
(2, NULL, 'New mystery books are coming this week.');
