-- Shop books: income/expense entries, quotations and money receipts.
-- The admin also creates these tables by itself on first use (src/admin-books.mjs).
CREATE TABLE IF NOT EXISTS txns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                 -- in | out
  day TEXT NOT NULL,                  -- YYYY-MM-DD (Dhaka)
  amount INTEGER NOT NULL,            -- taka
  category TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  party TEXT,
  note TEXT,
  receipt_id INTEGER,                 -- set when the entry came from a money receipt
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_txns_day ON txns(day);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  no TEXT NOT NULL UNIQUE,            -- Q-2026-0001
  day TEXT NOT NULL,
  valid_days INTEGER NOT NULL DEFAULT 15,
  customer TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  items TEXT NOT NULL,                -- JSON [{desc,size,polish,qty,rate}]
  discount INTEGER NOT NULL DEFAULT 0,
  delivery INTEGER NOT NULL DEFAULT 0,
  advance_pct INTEGER NOT NULL DEFAULT 50,
  days_to_make TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | sent | accepted | delivered | cancelled
  lead_id INTEGER,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  no TEXT NOT NULL UNIQUE,            -- MR-2026-0001
  day TEXT NOT NULL,
  customer TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  purpose TEXT,
  quote_id INTEGER,
  note TEXT,
  void INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_receipts_quote ON receipts(quote_id);

CREATE TABLE IF NOT EXISTS counters (name TEXT NOT NULL, year INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (name, year));
