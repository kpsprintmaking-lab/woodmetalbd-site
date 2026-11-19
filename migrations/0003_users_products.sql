-- Staff logins, the editable product catalogue, and uploaded product photos.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',     -- super | staff
  pw TEXT NOT NULL,                        -- pbkdf2$<iterations>$<salt hex>$<hash hex>
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,             -- sha256 of the cookie value
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS login_fails (ip TEXT NOT NULL, at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_login_fails ON login_fails(ip, at);

-- One row per product; "data" is the same JSON shape as data/products.json.
CREATE TABLE IF NOT EXISTS products (
  slug TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
CREATE TABLE IF NOT EXISTS product_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  username TEXT NOT NULL,
  slug TEXT NOT NULL,
  action TEXT NOT NULL,                    -- add | edit | price | hide | show | delete
  detail TEXT
);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  w INTEGER, h INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT
);
