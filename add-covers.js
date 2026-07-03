// add-covers.js — adds real Open Library cover images to the 8 seed books
// without touching anything else in the database.
// Run once:
//
//   node add-covers.js
//
import "dotenv/config";
import mysql from "mysql2/promise";

const db = await mysql.createConnection({
  host:     process.env.DB_HOST     || "localhost",
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "bibliotheca",
});

const covers = {
  "1984":                          "https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg",
  "Dune":                          "https://covers.openlibrary.org/b/isbn/9780441013593-L.jpg",
  "Dracula":                       "https://covers.openlibrary.org/b/isbn/9780486411095-L.jpg",
  "War and Peace":                 "https://covers.openlibrary.org/b/isbn/9781400079988-L.jpg",
  "Sherlock Holmes":               "https://covers.openlibrary.org/b/isbn/9781503280125-L.jpg",
  "One Hundred Years of Solitude": "https://covers.openlibrary.org/b/isbn/9780060883287-L.jpg",
  "Cosmos":                        "https://covers.openlibrary.org/b/isbn/9780345539434-L.jpg",
  "The Hitchhiker's Guide":        "https://covers.openlibrary.org/b/isbn/9780345391803-L.jpg",
};

let updated = 0;
for (const [title, url] of Object.entries(covers)) {
  const [result] = await db.query("UPDATE books SET cover_url=? WHERE title=?", [url, title]);
  if (result.affectedRows) {
    console.log(`✓ ${title} → cover set`);
    updated += result.affectedRows;
  } else {
    console.log(`↷ ${title} not found, skipped`);
  }
}

await db.end();
console.log(`\nDone — ${updated} book(s) updated with real covers.`);
