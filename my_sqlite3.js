const path = require('path');
const Database = require('better-sqlite3');

// Get database configuration from environment variables
const dbPath = path.join(__dirname, process.env.DB_PATH || 'mydb.sqlite3');
const verbose = process.env.DB_VERBOSE === 'true' ? console.log : null;

const db = new Database(dbPath, { 
  verbose: verbose
});

// Initialize database schema
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
)`);

// Initialize books table
db.exec(`CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  file_path TEXT NOT NULL,
  cover_path TEXT,
  description TEXT,
  added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ISBN TEXT,
  year_of_publication DATE,
  publisher TEXT

)`);

// Initialize tags table for categorizing books
db.exec(`CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
)`);

// Initialize book_tags junction table
db.exec(`CREATE TABLE IF NOT EXISTS book_tags (
  book_id INTEGER,
  tag_id INTEGER,
  PRIMARY KEY (book_id, tag_id),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
)`);



module.exports = db;

