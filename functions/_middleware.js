// Renders the catalogue pages (home, furniture lists, product pages, sitemap)
// from the D1 "products" table, so prices and products changed in /admin show
// on the site straight away. Everything else, and every page when the table is
// empty or D1 is unreachable, falls through to the static build in dist/.
import { createSite } from '../src/render.mjs';

const CATALOGUE = /^(\/en)?(\/|\/furniture\/([a-z0-9-]+\/)?|\/p\/[a-z0-9-]+\/)$/;

let siteData = null; // { assetV, cfg, slides } written by build.mjs, cached per isolate

async function loadSiteData(env, request) {
  if (siteData) return siteData;
  const r = await env.ASSETS.fetch(new URL('/site-data.json', request.url));
  if (!r.ok) throw new Error('site-data.json missing');
  siteData = await r.json();
  return siteData;
}

async function loadProducts(db) {
  const rows = (await db.prepare('SELECT data FROM products WHERE hidden = 0 ORDER BY sort, slug').all()).results;
  return rows.map((r) => JSON.parse(r.data)).filter((p) => p && p.slug && p.images && p.images.length);
}

const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'public, max-age=0, must-revalidate',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
};

export async function onRequest(context) {
  const { request, env, next } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') return next();
  const url = new URL(request.url);
  const path = url.pathname;
  const isSitemap = path === '/sitemap.xml';
  if (!isSitemap && !CATALOGUE.test(path)) {
    if (!path.endsWith('/') && CATALOGUE.test(path + '/')) return Response.redirect(new URL(path + '/' + url.search, url).toString(), 308);
    return next();
  }
  if (!env.DB) return next();

  let site;
  try {
    const products = await loadProducts(env.DB);
    if (!products.length) return next();
    const { assetV, cfg, slides } = await loadSiteData(env, request);
    site = createSite({ cfg, products, slides, assetV });
  } catch (e) {
    console.log('catalogue render fallback:', e && e.message);
    return next();
  }

  if (isSitemap) {
    return new Response(site.sitemap(new Date().toISOString().slice(0, 10)), { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  }
  const html = site.render(path);
  if (html) return new Response(request.method === 'HEAD' ? null : html, { headers: HEADERS });
  // A product or category that is hidden or does not exist.
  return new Response(site.notFoundPage(path.startsWith('/en/') ? 'en' : 'bn'), { status: 404, headers: HEADERS });
}
