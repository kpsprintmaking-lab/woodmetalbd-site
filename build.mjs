// Static site builder for woodmetalbd.com. No dependencies: `node build.mjs`.
// Reads data/products.json + site.config.json, writes the whole site to dist/.
// The same templates (src/render.mjs) also run in functions/_middleware.js, which
// renders the catalogue pages from the D1 products table once the shop edits it.
import fs from 'node:fs';
import path from 'node:path';
import { createSite } from './src/render.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, 'dist');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/products.json'), 'utf8'));
const slides = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/slides.json'), 'utf8')).slides;
const assetV = Date.now().toString(36);
const site = createSite({ cfg, products, slides, assetV });

function write(rel, html) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });

const pages = site.allPaths();
for (const p of pages) write(path.join(p, 'index.html'), site.render(p));
write('404.html', site.notFoundPage('bn'));
write('sitemap.xml', site.sitemap(new Date().toISOString().slice(0, 10)));
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);
// The functions need the CSS/JS version stamp and the site config at run time.
write('site-data.json', JSON.stringify({ assetV, cfg, slides }));
// First-time import into the D1 products table (done by /admin when the table is empty).
write('products-seed.json', JSON.stringify(products));

console.log(`Built ${pages.length} pages into dist/`);
