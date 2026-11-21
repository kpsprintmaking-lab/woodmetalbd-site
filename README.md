# woodmetalbd.com

Bilingual (বাংলা / English) catalog + inquiry site for **Wood Metal**, handmade creative furniture since 2000.
No cart or checkout: every product has WhatsApp, call and quote-request buttons, and there is a custom-order form with room-photo upload.

- Static pages built by `build.mjs` (no dependencies) from `data/products.json` (143 products, 13 categories).
- Bangla at `/`, English at `/en/`. Products at `/p/<slug>/`, categories at `/furniture/<category>/`.
- Forms post to a Cloudflare Pages Function (`functions/api/lead.js`) which stores leads in **D1** and emails them (via Resend, optional).
- Password-protected lead list at `/admin/`.

## Change common things

| What | Where |
|---|---|
| WhatsApp number (now a **test** number) | `site.config.json` → `whatsapp`. Use `8801970802121` for launch. |
| Phones, email, social links, featured products | `site.config.json` |
| Any text in either language | `src/strings.mjs` |
| Products (price, size, images) | `data/products.json` (images in `public/img/p/`) |
| Colours / layout | `public/css/site.css` |

Run `node build.mjs` and open `dist/`, or `npm run dev` for the full site with forms (needs wrangler).

## Cloudflare setup (one time)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → **Connect to Git** → pick this repo.
2. Build command: `node build.mjs` · Output directory: `dist` · Production branch: the repo default branch (`main`).
3. The D1 binding `DB` → database `woodmetal-leads` is already in `wrangler.toml` (the database and tables exist).
4. `/admin/` password: stored as a salted SHA-256 hash in the D1 `settings` table (`admin_pw_salt`, `admin_pw_sha256`, see `migrations/0002_settings.sql`). An `ADMIN_PASSWORD` secret, if Cloudflare passes one to the function, takes priority.
5. Email (optional): sign up at resend.com **with woodmetalbd@gmail.com**, create an API key and add it as secret **`RESEND_API_KEY`**. Until the domain is verified in Resend, mail can only go to that signup address, which is what we want. Optional: `LEAD_EMAIL_TO`, `LEAD_EMAIL_FROM`.
6. When the site is approved: add the custom domain `www.woodmetalbd.com` (DNS move from Namecheap happens only then).

## Re-importing the catalog

`scripts/prepare_catalog.py <catalog.json> <raw-image-dir>` regenerates `data/products.json` and the WebP images from a WooCommerce export. Raw images are named `md5(url)[:12] + ext`.

## Admin, users and products (D1)

- `/admin` needs a username + password (table `users`). Roles: `super` (everything, incl. users and deleting products) and `staff` (leads, add/edit products, prices).
- Products live in the D1 `products` table. The first time someone opens `/admin/products` it is filled from `data/products.json`. After that, edits in `/admin` are the source of truth.
- `functions/_middleware.js` renders the home, furniture lists, product pages and sitemap from D1 with the same templates as the static build (`src/render.mjs`). If the table is empty or D1 fails, the static pages are served.
- Photos uploaded in `/admin` are stored in the D1 `media` table and served at `/media/<id>`.
- Schema: `migrations/0003_users_products.sql`.

## Quotations, money receipts and the books

All in `/admin`, code in `src/admin-books.mjs`. The tables (`txns`, `quotes`,
`receipts`, `counters`, see `migrations/0004_books.sql`) are created on first use.

- **কোটেশন** (`/admin/quotes`): numbered `Q-2026-0001`; items with size, polish, qty
  and rate, discount, delivery, advance %, terms. Print / save as PDF, send on
  WhatsApp, and see how much is paid and due. A lead has a "কোটেশন বানান" button.
- **মানি রিসিট** (`/admin/receipts`): numbered `MR-2026-0001`, amount in words, payment
  method. Made from a quotation it shows order total, paid so far and due. Every
  receipt also writes an income entry. Receipts are never deleted; the super admin
  can void one, which takes it out of the books.
- **হিসাব** (`/admin/books`, super admin only): add income and expenses by category and
  method (cash, bKash, Nagad, bank, card); monthly totals, profit, category and
  method breakdown, a year table, a printable report and a CSV export for Excel.
