// Prints SQL that loads data/products.json into the D1 "products" table
// (only rows that are not there yet, so edits made in /admin are kept).
//   node scripts/products_to_sql.mjs > /tmp/seed.sql
//   npx wrangler d1 execute woodmetal-leads --remote --file /tmp/seed.sql
import fs from 'node:fs';
import { CATEGORIES } from '../src/strings.mjs';

const products = JSON.parse(fs.readFileSync(new URL('../data/products.json', import.meta.url), 'utf8'));
const order = CATEGORIES.flatMap((c) => products.filter((p) => p.cat === c.slug));
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
console.log(order.map((p, i) => `INSERT OR IGNORE INTO products (slug, data, sort, updated_by) VALUES (${q(p.slug)}, ${q(JSON.stringify(p))}, ${(i + 1) * 10}, 'import');`).join('\n'));
