// seed.js — creates demo users (admin / seller / client) with real bcrypt
// hashes, plus a few sample reviews and community messages.
// Run once after importing pythia.sql:
//
//   node seed.js
//
import "dotenv/config";
import bcrypt from "bcrypt";
import mysql from "mysql2/promise";

const db = await mysql.createConnection({
  host:     process.env.DB_HOST     || "localhost",
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "pythia",
});

async function upsertUser(username, fullName, email, plainPassword, role) {
  const [existing] = await db.query("SELECT id FROM users WHERE email=?", [email]);
  if (existing.length) {
    console.log(`↷ ${email} already exists, skipping`);
    return existing[0].id;
  }
  const hash = await bcrypt.hash(plainPassword, 10);
  const [result] = await db.query(
    "INSERT INTO users (username, full_name, email, password, role) VALUES (?,?,?,?,?)",
    [username, fullName, email, hash, role]
  );
  console.log(`✓ created ${role}: ${email} / ${plainPassword}`);
  return result.insertId;
}

const adminId  = await upsertUser("admin",      "Site Admin",  "admin@pythia.test",  "admin123",  "admin");
const sellerId = await upsertUser("seller_ivy", "Ivy Seller",  "seller@pythia.test", "seller123", "seller");
const clientId = await upsertUser("reader123",  "Jane Reader", "reader@pythia.test", "reader123", "client");

// Sample reviews (only insert if none exist yet for that book/user pair)
const reviews = [
  [clientId, 1, 5, "A landmark that everyone should read."],
  [clientId, 2, 4, "Incredibly detailed world, slightly slow start."],
  [clientId, 7, 5, "Changed the way I look at the universe."],
];
for (const [userId, bookId, rating, comment] of reviews) {
  await db.query(
    `INSERT INTO reviews (user_id, book_id, rating, comment) VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE rating=VALUES(rating), comment=VALUES(comment)`,
    [userId, bookId, rating, comment]
  );
}
console.log("✓ sample reviews seeded");

// Sample community messages
const messages = [
  [clientId, "Dune is absolutely worth the hype!"],
  [clientId, "Has anyone read Cosmos recently?"],
  [sellerId, "New mystery books coming this week — stay tuned."],
];
for (const [userId, text] of messages) {
  await db.query("INSERT INTO messages (user_id, text) VALUES (?,?)", [userId, text]);
}
console.log("✓ sample community messages seeded");

await db.end();
console.log("\nSeeding complete. Demo logins:");
console.log("  admin@pythia.test  / admin123");
console.log("  seller@pythia.test / seller123");
console.log("  reader@pythia.test / reader123");
