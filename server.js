// server.js — Pythia bookshop backend (PostgreSQL)
import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pg from "pg";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { body, validationResult } from "express-validator";

const { Pool } = pg;
const app  = express();
const PORT = process.env.PORT || 5173;
const JWT_SECRET = process.env.JWT_SECRET || "pythia_secret";

// ─── DB POOL ──────────────────────────────────────────────────────────────────
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// helper — same interface as mysql2 but for pg
async function query(sql, params = []) {
  // convert ? placeholders to $1 $2 ... (already done in queries below)
  const result = await db.query(sql, params);
  return result.rows;
}

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [`http://localhost:${PORT}`];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  }
}));
app.use(express.json({ limit: "50kb" }));
app.use(express.static("."));

// ─── RATE LIMITERS ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 10,
  message: { error: "Too many attempts, please try again later." },
  standardHeaders: true, legacyHeaders: false,
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 200,
  message: { error: "Too many requests, please slow down." },
  standardHeaders: true, legacyHeaders: false,
});
app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  next();
}

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });
  try { req.user = jwt.verify(header.split(" ")[1], JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid token" }); }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

function publicUser(u) {
  return { id: u.id, username: u.username, fullName: u.full_name, email: u.email, role: u.role };
}

function formatBook(b) {
  return {
    id: b.id, title: b.title, author: b.author || "Unknown",
    description: b.description || "", pages: b.pages, year: b.year,
    price: parseFloat(b.price), stock: b.stock,
    color: b.cover_color, coverUrl: b.cover_url || null,
    genre: b.genre, tags: b.tags ? b.tags.split(",") : [],
    rating: parseFloat(b.avg_rating) || 0, reviewCount: parseInt(b.review_count) || 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════════

app.post("/api/auth/signup",
  body("username").trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body("fullName").trim().isLength({ min: 2, max: 80 }),
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 8 }),
  validate,
  async (req, res) => {
    const { username, fullName, email, password, role } = req.body;
    const safeRole = ["client", "seller"].includes(role) ? role : "client";
    try {
      const hash = await bcrypt.hash(password, 10);
      const rows = await query(
        "INSERT INTO users (username, full_name, email, password, role) VALUES ($1,$2,$3,$4,$5) RETURNING *",
        [username, fullName, email, hash, safeRole]
      );
      res.json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
    } catch (err) {
      if (err.code === "23505") return res.status(409).json({ error: "Email or username already registered" });
      res.status(500).json({ error: "Server error" });
    }
  }
);

app.post("/api/auth/signin",
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty(),
  validate,
  async (req, res) => {
    const { email, password } = req.body;
    const rows = await query("SELECT * FROM users WHERE email=$1", [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: "Invalid email or password" });
    if (!user.is_active) return res.status(403).json({ error: "Account is disabled" });
    res.json({ token: signToken(user), user: publicUser(user) });
  }
);

app.get("/api/auth/me", auth, async (req, res) => {
  const rows = await query("SELECT * FROM users WHERE id=$1", [req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: "User not found" });
  res.json(publicUser(rows[0]));
});

// ═══════════════════════════════════════════════════════════════════════════════
// BOOKS
// ═══════════════════════════════════════════════════════════════════════════════

app.get("/api/books", async (req, res) => {
  const { genre, search, minPrice, maxPrice, year, sort } = req.query;
  const params = [];
  let where = "WHERE b.is_visible = TRUE";

  if (genre && genre !== "all") { params.push(genre); where += ` AND g.name = $${params.length}`; }
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (b.title ILIKE $${params.length} OR a.name ILIKE $${params.length})`;
  }
  if (minPrice) { params.push(Number(minPrice)); where += ` AND b.price >= $${params.length}`; }
  if (maxPrice) { params.push(Number(maxPrice)); where += ` AND b.price <= $${params.length}`; }
  if (year && year !== "all") {
    if (year === "older") where += " AND b.year < 2022";
    else { params.push(Number(year)); where += ` AND b.year = $${params.length}`; }
  }

  const sortMap = { popular:"AVG(r.rating) DESC NULLS LAST", new:"b.year DESC", "price-asc":"b.price ASC", "price-desc":"b.price DESC" };
  const orderBy = sortMap[sort] || "AVG(r.rating) DESC NULLS LAST";

  const sql = `
    SELECT b.*, g.name AS genre,
           STRING_AGG(DISTINCT a.name, ', ') AS author,
           STRING_AGG(DISTINCT t.name, ',')  AS tags,
           ROUND(AVG(r.rating)::numeric, 1)  AS avg_rating,
           COUNT(DISTINCT r.id)              AS review_count
    FROM books b
    JOIN genres g ON b.genre_id = g.id
    LEFT JOIN book_authors ba ON b.id = ba.book_id
    LEFT JOIN authors a       ON ba.author_id = a.id
    LEFT JOIN book_tags bt    ON b.id = bt.book_id
    LEFT JOIN tags t          ON bt.tag_id = t.id
    LEFT JOIN reviews r       ON b.id = r.book_id
    ${where}
    GROUP BY b.id, g.name
    ORDER BY ${orderBy}`;

  const rows = await query(sql, params);
  res.json(rows.map(formatBook));
});

app.get("/api/books/:id", async (req, res) => {
  const rows = await query(`
    SELECT b.*, g.name AS genre,
           STRING_AGG(DISTINCT a.name, ', ') AS author,
           STRING_AGG(DISTINCT t.name, ',')  AS tags,
           ROUND(AVG(r.rating)::numeric, 1)  AS avg_rating,
           COUNT(DISTINCT r.id)              AS review_count
    FROM books b
    JOIN genres g ON b.genre_id = g.id
    LEFT JOIN book_authors ba ON b.id = ba.book_id
    LEFT JOIN authors a       ON ba.author_id = a.id
    LEFT JOIN book_tags bt    ON b.id = bt.book_id
    LEFT JOIN tags t          ON bt.tag_id = t.id
    LEFT JOIN reviews r       ON b.id = r.book_id
    WHERE b.id = $1
    GROUP BY b.id, g.name`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(formatBook(rows[0]));
});

app.post("/api/books", auth, requireRole("seller","admin"),
  body("title").trim().isLength({ min:1, max:255 }),
  body("author").trim().isLength({ min:1, max:255 }),
  body("price").isFloat({ min:0.01 }),
  body("year").isInt({ min:1000, max: new Date().getFullYear() }),
  body("coverUrl").optional({ nullable:true }).isURL(),
  validate,
  async (req, res) => {
    const { title, author, description, pages, year, price, stock, genreId, coverColor, coverUrl } = req.body;
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const bookRows = await client.query(
        `INSERT INTO books (title, description, pages, year, price, stock, cover_color, cover_url, genre_id, publisher_id, added_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [title, description||null, pages||200, year, price, stock||1, coverColor||"#2c4a2c", coverUrl||null, genreId||1, 8, req.user.id]
      );
      const bookId = bookRows.rows[0].id;

      const authorName = String(author).trim();
      let authorId;
      const existingAuthor = await client.query("SELECT id FROM authors WHERE name=$1", [authorName]);
      if (existingAuthor.rows[0]) {
        authorId = existingAuthor.rows[0].id;
      } else {
        const newAuthor = await client.query("INSERT INTO authors (name) VALUES ($1) RETURNING id", [authorName]);
        authorId = newAuthor.rows[0].id;
      }
      await client.query("INSERT INTO book_authors (book_id, author_id) VALUES ($1,$2)", [bookId, authorId]);
      await client.query("COMMIT");
      res.json({ id: bookId, message: "Book added" });
    } catch {
      await client.query("ROLLBACK");
      res.status(500).json({ error: "Could not add book" });
    } finally { client.release(); }
  }
);

app.delete("/api/books/:id", auth, requireRole("admin"), async (req, res) => {
  await query("UPDATE books SET is_visible=FALSE WHERE id=$1", [req.params.id]);
  res.json({ message: "Book removed" });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GENRES
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/genres", async (_req, res) => {
  const rows = await query("SELECT * FROM genres ORDER BY name");
  res.json(rows);
});

// ═══════════════════════════════════════════════════════════════════════════════
// REVIEWS
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/books/:id/reviews", async (req, res) => {
  const rows = await query(
    `SELECT r.*, u.username FROM reviews r
     JOIN users u ON r.user_id = u.id
     WHERE r.book_id = $1 ORDER BY r.created_at DESC`, [req.params.id]
  );
  res.json(rows);
});

app.post("/api/books/:id/reviews", auth,
  body("rating").isInt({ min:1, max:5 }),
  body("comment").optional().trim().isLength({ max:1000 }),
  validate,
  async (req, res) => {
    const safeComment = req.body.comment ? escapeHtml(req.body.comment) : null;
    try {
      await query(
        `INSERT INTO reviews (user_id, book_id, rating, comment) VALUES ($1,$2,$3,$4)
         ON CONFLICT (user_id, book_id) DO UPDATE SET rating=EXCLUDED.rating, comment=EXCLUDED.comment`,
        [req.user.id, req.params.id, req.body.rating, safeComment]
      );
      res.json({ message: "Review saved" });
    } catch { res.status(500).json({ error: "Server error" }); }
  }
);

app.delete("/api/reviews/:id", auth, requireRole("admin"), async (req, res) => {
  await query("DELETE FROM reviews WHERE id=$1", [req.params.id]);
  res.json({ message: "Review deleted" });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FAVORITES
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/favorites", auth, async (req, res) => {
  const rows = await query(`
    SELECT b.*, g.name AS genre,
           STRING_AGG(DISTINCT a.name, ', ') AS author,
           STRING_AGG(DISTINCT t.name, ',')  AS tags,
           ROUND(AVG(r.rating)::numeric,1)   AS avg_rating,
           COUNT(DISTINCT r.id)              AS review_count
    FROM favorites f
    JOIN books b  ON f.book_id = b.id
    JOIN genres g ON b.genre_id = g.id
    LEFT JOIN book_authors ba ON b.id = ba.book_id
    LEFT JOIN authors a       ON ba.author_id = a.id
    LEFT JOIN book_tags bt    ON b.id = bt.book_id
    LEFT JOIN tags t          ON bt.tag_id = t.id
    LEFT JOIN reviews r       ON b.id = r.book_id
    WHERE f.user_id=$1 AND b.is_visible=TRUE
    GROUP BY b.id, g.name`, [req.user.id]);
  res.json(rows.map(formatBook));
});

app.post("/api/favorites/:bookId", auth, async (req, res) => {
  try {
    await query("INSERT INTO favorites (user_id,book_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [req.user.id, req.params.bookId]);
    res.json({ message: "Added to favorites" });
  } catch { res.status(500).json({ error: "Server error" }); }
});

app.delete("/api/favorites/:bookId", auth, async (req, res) => {
  await query("DELETE FROM favorites WHERE user_id=$1 AND book_id=$2", [req.user.id, req.params.bookId]);
  res.json({ message: "Removed from favorites" });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════════════════
app.post("/api/orders", async (req, res) => {
  const authHeader = req.headers.authorization;
  let userId = null;
  if (authHeader) { try { userId = jwt.verify(authHeader.split(" ")[1], JWT_SECRET).id; } catch {} }

  const { fullName, email, city, street, number, paymentMethod, needsInvoice, promoCode, items } = req.body;
  if (!items?.length) return res.status(400).json({ error: "Cart is empty" });

  const ids = items.map(i => i.bookId);
  const books = await query(`SELECT id, price, stock FROM books WHERE id = ANY($1)`, [ids]);
  const bookMap = Object.fromEntries(books.map(b => [b.id, b]));

  for (const item of items) {
    const book = bookMap[item.bookId];
    if (!book) return res.status(400).json({ error: `Book ${item.bookId} not found` });
    if (book.stock < item.quantity) return res.status(400).json({ error: `Not enough stock for book ${item.bookId}` });
  }

  const subtotal = items.reduce((sum, i) => sum + bookMap[i.bookId].price * i.quantity, 0);
  let promoDisc = 0;
  if (promoCode) {
    const pc = await query(
      "SELECT * FROM promo_codes WHERE code=$1 AND is_active=TRUE AND (expires_at IS NULL OR expires_at > NOW())",
      [promoCode.toUpperCase()]
    );
    if (pc[0]) promoDisc = subtotal * (pc[0].discount_pct / 100);
  }
  const afterPromo = subtotal - promoDisc;
  const thresholdDisc = afterPromo > 50 ? afterPromo * 0.05 : 0;
  const shipping = afterPromo > 40 ? 0 : 4.99;
  const total = Math.max(0, afterPromo - thresholdDisc + shipping);

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const orderRows = await client.query(
      `INSERT INTO orders (user_id, full_name, email, city, street, number, payment_method,
        needs_invoice, promo_code, subtotal, promo_discount, threshold_disc, shipping, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [userId, fullName, email, city, street, number, paymentMethod,
       needsInvoice, promoCode||null, subtotal, promoDisc, thresholdDisc, shipping, total]
    );
    const orderId = orderRows.rows[0].id;
    for (const item of items) {
      await client.query(
        "INSERT INTO order_items (order_id, book_id, quantity, unit_price) VALUES ($1,$2,$3,$4)",
        [orderId, item.bookId, item.quantity, bookMap[item.bookId].price]
      );
      await client.query("UPDATE books SET stock = stock - $1 WHERE id=$2", [item.quantity, item.bookId]);
    }
    await client.query("COMMIT");
    res.json({ orderId, total, message: "Order placed successfully" });
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Order failed" });
  } finally { client.release(); }
});

app.get("/api/orders", auth, async (req, res) => {
  const rows = req.user.role === "admin"
    ? await query("SELECT * FROM orders ORDER BY created_at DESC")
    : await query("SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC", [req.user.id]);
  res.json(rows);
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNITY CHAT
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/messages", async (_req, res) => {
  const rows = await query(
    `SELECT m.id, m.text, m.created_at, u.username
     FROM messages m JOIN users u ON m.user_id = u.id
     ORDER BY m.created_at ASC LIMIT 200`
  );
  res.json(rows);
});

app.post("/api/messages", auth,
  body("text").trim().isLength({ min:1, max:500 }),
  validate,
  async (req, res) => {
    const safeText = escapeHtml(req.body.text.trim());
    const rows = await query(
      "INSERT INTO messages (user_id, text) VALUES ($1,$2) RETURNING id", [req.user.id, safeText]
    );
    res.json({ id: rows[0].id, username: req.user.username, text: safeText });
  }
);

app.delete("/api/messages/:id", auth, requireRole("admin"), async (req, res) => {
  await query("DELETE FROM messages WHERE id=$1", [req.params.id]);
  res.json({ message: "Deleted" });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/admin/users", auth, requireRole("admin"), async (_req, res) => {
  const rows = await query("SELECT id, username, full_name, email, role, is_active, created_at FROM users ORDER BY created_at DESC");
  res.json(rows);
});

app.patch("/api/admin/users/:id", auth, requireRole("admin"), async (req, res) => {
  const { role, isActive } = req.body;
  if (role)                  await query("UPDATE users SET role=$1 WHERE id=$2",      [role,     req.params.id]);
  if (isActive !== undefined) await query("UPDATE users SET is_active=$1 WHERE id=$2", [isActive, req.params.id]);
  res.json({ message: "User updated" });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROMO CODES
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/promo/:code", async (req, res) => {
  const rows = await query(
    "SELECT * FROM promo_codes WHERE code=$1 AND is_active=TRUE AND (expires_at IS NULL OR expires_at > NOW())",
    [req.params.code.toUpperCase()]
  );
  if (!rows[0]) return res.status(404).json({ error: "Invalid or expired code" });
  res.json({ code: rows[0].code, discountPct: rows[0].discount_pct });
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Pythia running → http://localhost:${PORT}`);
});
