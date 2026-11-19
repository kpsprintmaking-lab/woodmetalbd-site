-- Leads from the website forms. Apply with:
--   npx wrangler d1 execute woodmetal-leads --remote --file migrations/0001_init.sql
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  kind TEXT NOT NULL,              -- quote | custom | contact
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  area TEXT,
  product_slug TEXT,
  product_name TEXT,
  size TEXT,
  polish TEXT,
  message TEXT,
  lang TEXT,
  page TEXT,
  ip TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'new', -- new | contacted | done
  emailed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS lead_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  mime TEXT NOT NULL,
  data BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_ip ON leads(ip, created_at);
CREATE INDEX IF NOT EXISTS idx_photos_lead ON lead_photos(lead_id);
