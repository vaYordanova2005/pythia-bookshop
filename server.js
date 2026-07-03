// server.js — Pythia bookshop backend
import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { body, param, validationResult } from "express-validator";

const app  = express();
const PORT = process.env.PORT || 5173;
const JWT_SECRET = process.env.JWT_SECRET || "pythia_secret";

// ─── DB POOL ──────────────────────────────────────────────────────────────────
const db = await mysql.createPool({
  host:     process.env.DB_HOST     || "localhost",
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "pythia",
  waitForConnections: true,
  connectionLimit: 10,
});

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false // disabled so our SVG logo and Open Library images load fine
}));
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [`http://localhost:${PORT}`];

app.use(cors({
  origin: (origin, cb) => {
    // allow requests with no origin (e.g. same-origin, mobile apps)
    if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  }
}));
app.use(express.json({ limit: "50kb" })); // reject giant request bodies
app.use(express.static("."));

// ─── RATE LIMITERS ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,                   // max 10 login/register attempts per 10 min per IP
  message: { error: "Too many attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // 200 requests per 15 min per IP
  message: { error: "Too many requests, please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth", authLimiter);   // strict limit on auth routes
app.use("/api", apiLimiter);          // general API limit

// ─── XSS HELPER ───────────────────────────────────────────────────────────────
// Escape HTML special chars before storing user-generated text
function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── VALIDATION ERROR HANDLER ─────────────────────────────────────────────────
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ error: errors.array()[0].msg });
  next();
}

// ─── AUTH HELPERS ─────────────────────────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(header.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role))
      return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/auth/signup
app.post("/api/auth/signup",
  body("username").trim().isLength({ min: 3, max: 30 }).withMessage("Username must be 3–30 characters")
    .matches(/^[a-zA-Z0-9_]+$/).withMessage("Username can only contain letters, numbers and underscores"),
  body("fullName").trim().isLength({ min: 2, max: 80 }).withMessage("Full name must be 2–80 characters"),
  body("email").isEmail().normalizeEmail().withMessage("Invalid email address"),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  validate,
  async (req, res) => {
  const { username, fullName, email, password, role } = req.body;
  const safeRole = ["client", "seller"].includes(role) ? role : "client";
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      "INSERT INTO users (username, full_name, email, password, role) VALUES (?,?,?,?,?)",
      [username, fullName, email, hash, safeRole]
    );
    const [rows] = await db.query("SELECT * FROM users WHERE id=?", [result.insertId]);
    res.json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ error: "Email or username already registered" });
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/signin
app.post("/api/auth/signin",
  body("email").isEmail().normalizeEmail().withMessage("Invalid email"),
  body("password").notEmpty().withMessage("Password required"),
  validate,
  async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await db.query("SELECT * FROM users WHERE email=?", [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: "Invalid email or password" });
  if (!user.is_active)
    return res.status(403).json({ error: "Account is disabled" });
  res.json({ token: signToken(user), user: publicUser(user) });
});

// GET /api/auth/me
app.get("/api/auth/me", auth, async (req, res) => {
  const [rows] = await db.query("SELECT * FROM users WHERE id=?", [req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: "User not found" });
  res.json(publicUser(rows[0]));
});

function publicUser(u) {
  return { id: u.id, username: u.username, fullName: u.full_name, email: u.email, role: u.role };
}

// ═════════════════════════════════════════════════════════════════════════════
// BOOKS ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/books  — catalogue with filters
app.get("/api/books", async (req, res) => {
  const { genre, search, minPrice, maxPrice, year, sort } = req.query;

  let sql = `
    SELECT b.*, g.name AS genre,
           GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', ') AS author,
           GROUP_CONCAT(DISTINCT t.name ORDER BY t.name SEPARATOR ',')  AS tags,
           ROUND(AVG(r.rating),1) AS avg_rating,
           COUNT(DISTINCT r.id)   AS review_count
    FROM books b
    JOIN genres g     ON b.genre_id = g.id
    LEFT JOIN book_authors ba ON b.id = ba.book_id
    LEFT JOIN authors a       ON ba.author_id = a.id
    LEFT JOIN book_tags bt    ON b.id = bt.book_id
    LEFT JOIN tags t          ON bt.tag_id = t.id
    LEFT JOIN reviews r       ON b.id = r.book_id
    WHERE b.is_visible = TRUE
  `;
  const params = [];

  if (genre && genre !== "all") {
    sql += " AND g.name = ?"; params.push(genre);
  }
  if (search) {
    sql += " AND (b.title LIKE ? OR a.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (minPrice) { sql += " AND b.price >= ?"; params.push(Number(minPrice)); }
  if (maxPrice) { sql += " AND b.price <= ?"; params.push(Number(maxPrice)); }
  if (year && year !== "all") {
    if (year === "older") sql += " AND b.year < 2022";
    else { sql += " AND b.year = ?"; params.push(Number(year)); }
  }

  sql += " GROUP BY b.id";

  const sortMap = {
    popular:    "avg_rating DESC",
    new:        "b.year DESC",
    "price-asc":  "b.price ASC",
    "price-desc": "b.price DESC",
  };
  sql += " ORDER BY " + (sortMap[sort] || "avg_rating DESC");

  const [rows] = await db.query(sql, params);
  res.json(rows.map(formatBook));
});

// GET /api/books/:id
app.get("/api/books/:id", async (req, res) => {
  const [rows] = await db.query(`
    SELECT b.*, g.name AS genre,
           GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', ') AS author,
           GROUP_CONCAT(DISTINCT t.name ORDER BY t.name SEPARATOR ',')  AS tags,
           ROUND(AVG(r.rating),1) AS avg_rating,
           COUNT(DISTINCT r.id)   AS review_count
    FROM books b
    JOIN genres g     ON b.genre_id = g.id
    LEFT JOIN book_authors ba ON b.id = ba.book_id
    LEFT JOIN authors a       ON ba.author_id = a.id
    LEFT JOIN book_tags bt    ON b.id = bt.book_id
    LEFT JOIN tags t          ON bt.tag_id = t.id
    LEFT JOIN reviews r       ON b.id = r.book_id
    WHERE b.id = ?
    GROUP BY b.id`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(formatBook(rows[0]));
});

// POST /api/books  — seller or admin adds a book
app.post("/api/books",
  auth,
  requireRole("seller", "admin"),
  body("title").trim().isLength({ min: 1, max: 255 }).withMessage("Title is required (max 255 chars)"),
  body("author").trim().isLength({ min: 1, max: 255 }).withMessage("Author is required (max 255 chars)"),
  body("price").isFloat({ min: 0.01 }).withMessage("Price must be a positive number"),
  body("year").isInt({ min: 1000, max: new Date().getFullYear() }).withMessage("Invalid year"),
  body("coverUrl").optional({ nullable: true }).isURL().withMessage("Cover must be a valid URL"),
  validate,
  async (req, res) => {
  const { title, author, description, pages, year, price, stock, genreId, publisherId, coverColor, coverUrl } = req.body;
  if (!title || !author) return res.status(400).json({ error: "Title and author are required" });

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    const [bookResult] = await conn.query(
      `INSERT INTO books (title, description, pages, year, price, stock, cover_color, cover_url, genre_id, publisher_id, added_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [title, description || null, pages || 200, year, price, stock || 1,
       coverColor || "#2c4a2c", coverUrl || null, genreId, publisherId || 8, req.user.id]
    );
    const bookId = bookResult.insertId;

    // find-or-create author, then link
    const authorName = String(author).trim();
    let authorId;
    const [existingAuthor] = await conn.query("SELECT id FROM authors WHERE name=?", [authorName]);
    if (existingAuthor[0]) {
      authorId = existingAuthor[0].id;
    } else {
      const [authorResult] = await conn.query("INSERT INTO authors (name) VALUES (?)", [authorName]);
      authorId = authorResult.insertId;
    }
    await conn.query("INSERT INTO book_authors (book_id, author_id) VALUES (?,?)", [bookId, authorId]);

    await conn.commit();
    res.json({ id: bookId, message: "Book added" });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: "Could not add book" });
  } finally {
    conn.release();
  }
});

// DELETE /api/books/:id  — admin only
app.delete("/api/books/:id", auth, requireRole("admin"), async (req, res) => {
  await db.query("UPDATE books SET is_visible=FALSE WHERE id=?", [req.params.id]);
  res.json({ message: "Book removed" });
});

function formatBook(b) {
  return {
    id:          b.id,
    title:       b.title,
    author:      b.author || "Unknown",
    description: b.description || "",
    pages:       b.pages,
    year:        b.year,
    price:       parseFloat(b.price),
    stock:       b.stock,
    color:       b.cover_color,
    coverUrl:    b.cover_url || null,
    genre:       b.genre,
    tags:        b.tags ? b.tags.split(",") : [],
    rating:      parseFloat(b.avg_rating) || 0,
    reviewCount: b.review_count || 0,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// GENRES
// ═════════════════════════════════════════════════════════════════════════════
app.get("/api/genres", async (_req, res) => {
  const [rows] = await db.query("SELECT * FROM genres ORDER BY name");
  res.json(rows);
});

// ═════════════════════════════════════════════════════════════════════════════
// REVIEWS
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/books/:id/reviews
app.get("/api/books/:id/reviews", async (req, res) => {
  const [rows] = await db.query(
    `SELECT r.*, u.username FROM reviews r
     JOIN users u ON r.user_id = u.id
     WHERE r.book_id = ? ORDER BY r.created_at DESC`,
    [req.params.id]
  );
  res.json(rows);
});

// POST /api/books/:id/reviews
app.post("/api/books/:id/reviews",
  auth,
  body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be 1–5"),
  body("comment").optional().trim().isLength({ max: 1000 }).withMessage("Comment too long (max 1000 chars)"),
  validate,
  async (req, res) => {
  const { rating, comment } = req.body;
  const safeComment = comment ? escapeHtml(comment) : null;
  try {
    await db.query(
      "INSERT INTO reviews (user_id, book_id, rating, comment) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE rating=VALUES(rating), comment=VALUES(comment)",
      [req.user.id, req.params.id, rating, safeComment]
    );
    res.json({ message: "Review saved" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/reviews/:id  — admin only
app.delete("/api/reviews/:id", auth, requireRole("admin"), async (req, res) => {
  await db.query("DELETE FROM reviews WHERE id=?", [req.params.id]);
  res.json({ message: "Review deleted" });
});

// ═════════════════════════════════════════════════════════════════════════════
// FAVORITES
// ═════════════════════════════════════════════════════════════════════════════

app.get("/api/favorites", auth, async (req, res) => {
  const [rows] = await db.query(
    `SELECT b.*, g.name AS genre,
            GROUP_CONCAT(DISTINCT a.name SEPARATOR ', ') AS author,
            GROUP_CONCAT(DISTINCT t.name SEPARATOR ',')  AS tags,
            ROUND(AVG(r.rating),1) AS avg_rating
     FROM favorites f
     JOIN books b   ON f.book_id = b.id
     JOIN genres g  ON b.genre_id = g.id
     LEFT JOIN book_authors ba ON b.id = ba.book_id
     LEFT JOIN authors a       ON ba.author_id = a.id
     LEFT JOIN book_tags bt    ON b.id = bt.book_id
     LEFT JOIN tags t          ON bt.tag_id = t.id
     LEFT JOIN reviews r       ON b.id = r.book_id
     WHERE f.user_id = ? AND b.is_visible = TRUE
     GROUP BY b.id`,
    [req.user.id]
  );
  res.json(rows.map(formatBook));
});

app.post("/api/favorites/:bookId", auth, async (req, res) => {
  try {
    await db.query("INSERT IGNORE INTO favorites (user_id,book_id) VALUES (?,?)",
      [req.user.id, req.params.bookId]);
    res.json({ message: "Added to favorites" });
  } catch { res.status(500).json({ error: "Server error" }); }
});

app.delete("/api/favorites/:bookId", auth, async (req, res) => {
  await db.query("DELETE FROM favorites WHERE user_id=? AND book_id=?",
    [req.user.id, req.params.bookId]);
  res.json({ message: "Removed from favorites" });
});

// ═════════════════════════════════════════════════════════════════════════════
// ORDERS
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/orders  — place an order
app.post("/api/orders", async (req, res) => {
  const authHeader = req.headers.authorization;
  let userId = null;
  if (authHeader) {
    try { userId = jwt.verify(authHeader.split(" ")[1], JWT_SECRET).id; } catch {}
  }

  const { fullName, email, city, street, number, paymentMethod, needsInvoice,
          promoCode, items } = req.body;

  if (!items?.length) return res.status(400).json({ error: "Cart is empty" });

  // Fetch prices from DB (never trust client prices)
  const ids = items.map(i => i.bookId);
  const [books] = await db.query(`SELECT id, price, stock FROM books WHERE id IN (?)`, [ids]);
  const bookMap = Object.fromEntries(books.map(b => [b.id, b]));

  for (const item of items) {
    const book = bookMap[item.bookId];
    if (!book) return res.status(400).json({ error: `Book ${item.bookId} not found` });
    if (book.stock < item.quantity) return res.status(400).json({ error: `Not enough stock for book ${item.bookId}` });
  }

  // Totals
  const subtotal = items.reduce((sum, i) => sum + bookMap[i.bookId].price * i.quantity, 0);
  let promoDisc = 0;
  if (promoCode) {
    const [pc] = await db.query("SELECT * FROM promo_codes WHERE code=? AND is_active=TRUE AND (expires_at IS NULL OR expires_at > NOW())", [promoCode.toUpperCase()]);
    if (pc[0]) promoDisc = subtotal * (pc[0].discount_pct / 100);
  }
  const afterPromo = subtotal - promoDisc;
  const thresholdDisc = afterPromo > 50 ? afterPromo * 0.05 : 0;
  const shipping = afterPromo > 40 ? 0 : 4.99;
  const total = Math.max(0, afterPromo - thresholdDisc + shipping);

  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    const [orderResult] = await conn.query(
      `INSERT INTO orders (user_id, full_name, email, city, street, number, payment_method,
        needs_invoice, promo_code, subtotal, promo_discount, threshold_disc, shipping, total)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [userId, fullName, email, city, street, number, paymentMethod,
       needsInvoice ? 1 : 0, promoCode || null,
       subtotal, promoDisc, thresholdDisc, shipping, total]
    );
    const orderId = orderResult.insertId;

    for (const item of items) {
      await conn.query(
        "INSERT INTO order_items (order_id, book_id, quantity, unit_price) VALUES (?,?,?,?)",
        [orderId, item.bookId, item.quantity, bookMap[item.bookId].price]
      );
      await conn.query("UPDATE books SET stock = stock - ? WHERE id=?", [item.quantity, item.bookId]);
    }

    await conn.commit();
    res.json({ orderId, total, message: "Order placed successfully" });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: "Order failed" });
  } finally {
    conn.release();
  }
});

// GET /api/orders  — admin sees all, user sees own
app.get("/api/orders", auth, async (req, res) => {
  let sql, params;
  if (req.user.role === "admin") {
    sql = "SELECT * FROM orders ORDER BY created_at DESC";
    params = [];
  } else {
    sql = "SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC";
    params = [req.user.id];
  }
  const [rows] = await db.query(sql, params);
  res.json(rows);
});

// ═════════════════════════════════════════════════════════════════════════════
// COMMUNITY CHAT
// ═════════════════════════════════════════════════════════════════════════════

app.get("/api/messages", async (_req, res) => {
  const [rows] = await db.query(
    `SELECT m.id, m.text, m.created_at, u.username
     FROM messages m JOIN users u ON m.user_id = u.id
     ORDER BY m.created_at ASC LIMIT 200`
  );
  res.json(rows);
});

app.post("/api/messages",
  auth,
  body("text").trim().isLength({ min: 1, max: 500 }).withMessage("Message must be 1–500 characters"),
  validate,
  async (req, res) => {
  const safeText = escapeHtml(req.body.text.trim());
  const [result] = await db.query(
    "INSERT INTO messages (user_id, text) VALUES (?,?)", [req.user.id, safeText]
  );
  res.json({ id: result.insertId, username: req.user.username, text: safeText });
});

app.delete("/api/messages/:id", auth, requireRole("admin"), async (req, res) => {
  await db.query("DELETE FROM messages WHERE id=?", [req.params.id]);
  res.json({ message: "Deleted" });
});

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN — users management
// ═════════════════════════════════════════════════════════════════════════════

app.get("/api/admin/users", auth, requireRole("admin"), async (_req, res) => {
  const [rows] = await db.query(
    "SELECT id, username, full_name, email, role, is_active, created_at FROM users ORDER BY created_at DESC"
  );
  res.json(rows);
});

app.patch("/api/admin/users/:id", auth, requireRole("admin"), async (req, res) => {
  const { role, isActive } = req.body;
  if (role)     await db.query("UPDATE users SET role=?      WHERE id=?", [role,     req.params.id]);
  if (isActive !== undefined)
                await db.query("UPDATE users SET is_active=? WHERE id=?", [isActive, req.params.id]);
  res.json({ message: "User updated" });
});

// ═════════════════════════════════════════════════════════════════════════════
// PROMO CODE CHECK
// ═════════════════════════════════════════════════════════════════════════════
app.get("/api/promo/:code", async (req, res) => {
  const [rows] = await db.query(
    "SELECT * FROM promo_codes WHERE code=? AND is_active=TRUE AND (expires_at IS NULL OR expires_at > NOW())",
    [req.params.code.toUpperCase()]
  );
  if (!rows[0]) return res.status(404).json({ error: "Invalid or expired code" });
  res.json({ code: rows[0].code, discountPct: rows[0].discount_pct });
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Pythia running → http://localhost:${PORT}`);
});