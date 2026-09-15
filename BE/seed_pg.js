// seed_pg.js — creates demo users with bcrypt hashes for PostgreSQL
// Run once after importing pythia_pg.sql:
//
//   node seed_pg.js
//
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const { Pool } = pg;
const DB_URL = process.env.DATABASE_URL || "postgresql://postgres@localhost:5432/pythia";
const isLocalDb = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB_URL);

const db = new Pool({
  connectionString: DB_URL,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
});

async function upsertUser(username, fullName, email, plainPassword, role) {
  const existing = await db.query("SELECT id FROM users WHERE email=$1", [email]);
  if (existing.rows.length) {
    console.log(`↷ ${email} already exists, skipping`);
    return existing.rows[0].id;
  }
  const hash = await bcrypt.hash(plainPassword, 10);
  const result = await db.query(
    "INSERT INTO users (username, full_name, email, password, role) VALUES ($1,$2,$3,$4,$5) RETURNING id",
    [username, fullName, email, hash, role]
  );
  console.log(`✓ created ${role}: ${email} / ${plainPassword}`);
  return result.rows[0].id;
}

const adminId  = await upsertUser("admin",      "Site Admin",  "admin@pythia.test",  "admin123",  "admin");
const sellerId = await upsertUser("seller_ivy", "Ivy Seller",  "seller@pythia.test", "seller123", "seller");
const clientId = await upsertUser("reader123",  "Jane Reader", "reader@pythia.test", "reader123", "client");

// Sample reviews
const reviews = [
  [clientId, "1984",      5, "A landmark that everyone should read."],
  [clientId, "Dune",      4, "Incredibly detailed world, slightly slow start."],
  [clientId, "Cosmos",    5, "Changed the way I look at the universe."],
];
for (const [userId, title, rating, comment] of reviews) {
  const book = await db.query("SELECT id FROM books WHERE title=$1", [title]);
  if (book.rows[0]) {
    await db.query(
      `INSERT INTO reviews (user_id, book_id, rating, comment) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, book_id) DO UPDATE SET rating=EXCLUDED.rating, comment=EXCLUDED.comment`,
      [userId, book.rows[0].id, rating, comment]
    );
  }
}
console.log("✓ sample reviews seeded");

// Sample community messages
const messages = [
  [clientId, "Dune is absolutely worth the hype!"],
  [clientId, "Has anyone read Cosmos recently?"],
  [sellerId, "New mystery books coming this week — stay tuned."],
];
for (const [userId, text] of messages) {
  await db.query("INSERT INTO messages (user_id, text) VALUES ($1,$2)", [userId, text]);
}
console.log("✓ sample community messages seeded");

await db.end();
console.log("\nSeeding complete! Demo logins:");
console.log("  admin@pythia.test  / admin123");
console.log("  seller@pythia.test / seller123");
console.log("  reader@pythia.test / reader123");
