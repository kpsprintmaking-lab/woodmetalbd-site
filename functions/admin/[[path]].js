// /admin : the shop's back office (Bangla).
// Login with a username + password (users table). Two roles:
//   super  everything, plus managing users and deleting products
//   staff  leads, products and prices, quotations, money receipts, writing expenses
//          (staff never see the income/expense totals or reports)
//
//   /admin/                    leads (filter ?status=new|contacted|done)
//   /admin/login, /logout      sign in / out (cookie session, 30 days)
//   /admin/products            product list, quick price change, hide/show
//   /admin/products/new        add a product
//   /admin/products/edit/<slug>
//   /admin/media               POST a photo (JSON, base64) -> { id }
//   /admin/users               super only
//   /admin/password            change your own password
//   /admin/quotes, /receipts   quotations and money receipts (src/admin-books.mjs)
//   /admin/books               income & expense, monthly report (super only)
import { CATEGORIES, POLISH } from '../../src/strings.mjs';
import { books } from '../../src/admin-books.mjs';

const STATUSES = ['new', 'contacted', 'done'];
const STATUS_BN = { new: 'নতুন', contacted: 'যোগাযোগ হয়েছে', done: 'শেষ' };
const KIND_BN = { quote: 'কোটেশন', custom: 'কাস্টম অর্ডার', contact: 'যোগাযোগ', chat: 'চ্যাট' };
const ROLE_BN = { super: 'সুপার অ্যাডমিন', staff: 'স্টাফ' };
const COOKIE = 'wm_s';
const SESSION_DAYS = 30;
const PBKDF2_ITER = 20000;
const catBySlug = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const money = (n) => '৳ ' + Number(n).toLocaleString('en-IN');
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const pName = (p) => `${catBySlug[p.cat]?.one.bn ?? p.cat} ${p.model}`;
function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

// ---------- passwords and sessions ----------
async function pbkdf2(pw, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
}
async function hashPw(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITER}$${hex(salt)}$${await pbkdf2(pw, salt, PBKDF2_ITER)}`;
}
async function checkPw(pw, stored) {
  const [kind, iter, salt, want] = String(stored).split('$');
  if (kind !== 'pbkdf2') return false;
  const got = await pbkdf2(pw, unhex(salt), Number(iter));
  return sameBytes(enc.encode(got), enc.encode(want));
}
function cookieToken(request) {
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([A-Za-z0-9_-]+)`));
  return m ? m[1] : null;
}
async function currentUser(request, env) {
  const tok = cookieToken(request);
  if (!tok) return null;
  return env.DB.prepare(`SELECT u.id, u.username, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.active = 1`).bind(await sha256(tok)).first();
}
const sessionCookie = (tok, maxAge) => `${COOKIE}=${tok}; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

// Forms must come from this site (stops other sites posting to /admin).
function sameOrigin(request, url) {
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return false;
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  return true;
}

// ---------- html ----------
const html = (body, status = 200, extra = {}) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY', ...extra } });
const redirect = (to, extra = {}) => new Response(null, { status: 303, headers: { location: to, 'cache-control': 'no-store', ...extra } });

const CSS = `
*{box-sizing:border-box}body{margin:0;background:#F5F5F5;font:15px/1.5 'Hind Siliguri',system-ui,sans-serif;color:#111}
a{color:#111}header{background:#111;color:#fff;padding:10px 16px;display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;justify-content:space-between}
header nav{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center}header a{color:#FECC2F;text-decoration:none}header a.on{color:#fff;border-bottom:2px solid #FECC2F}
header form{margin:0}header button{background:none;border:1px solid #666;color:#fff;border-radius:6px;padding:2px 10px;cursor:pointer}
.who{color:#D1D1D1;font-size:13px}
main{padding:16px;max-width:1150px;margin:0 auto}
h1{font-size:24px;margin:6px 0 14px}h2{font-size:19px;margin:22px 0 10px}
.box{background:#fff;border:1.5px solid #EDEDED;border-radius:10px;padding:14px 16px;margin-bottom:14px}
.lead.new{border-left:6px solid #FECC2F}
.top{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline}.top b{font-size:18px}.k{color:#666}
.pill{background:#111;color:#fff;border-radius:99px;padding:1px 10px;font-size:13px}.pill.off{background:#D1D1D1}
.photos{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.photos img{width:120px;height:120px;object-fit:cover;border-radius:6px;border:1px solid #EDEDED}
input,select,textarea,button{font:inherit}
.field{min-height:38px;border:1.5px solid #D1D1D1;border-radius:6px;padding:6px 10px;background:#fff;width:100%}
[hidden]{display:none!important}
.btn{display:inline-flex;justify-content:center;align-items:center;gap:6px;min-height:38px;background:#111;color:#fff;border:0;padding:6px 16px;border-radius:6px;text-decoration:none;cursor:pointer;font-weight:600}
.btn.y{background:#FECC2F;color:#111}.btn.g{background:#C38820;color:#111}.btn.o{background:#fff;color:#111;border:1.5px solid #111}.btn.r{background:#343434}.btn.s{min-height:32px;padding:3px 10px;font-size:14px}
.inline{display:inline-flex;gap:6px;align-items:center;margin:0}
pre{white-space:pre-wrap;font:inherit;margin:6px 0}
table{width:100%;border-collapse:collapse;background:#fff;border:1.5px solid #EDEDED;border-radius:10px;overflow:hidden}
th,td{padding:8px 10px;border-bottom:1px solid #EDEDED;text-align:left;vertical-align:middle}th{background:#F5F5F5;font-size:14px;color:#343434}
td img{width:56px;height:56px;object-fit:cover;border-radius:6px;display:block}
tr.off td{opacity:.55}
.price-in{width:120px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px 16px}
.grid label,.stack label{display:flex;flex-direction:column;gap:4px;font-weight:600;font-size:14px}
.checks{display:flex;flex-wrap:wrap;gap:6px 16px;font-weight:400}.checks label{flex-direction:row;font-weight:400;align-items:center}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0 14px}
.flash{background:#F5F5F5;border:1.5px solid #FECC2F;border-radius:8px;padding:10px 14px;margin-bottom:14px}
.flash.err{background:#FFFFFF;border-color:#343434}
.pe{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0}.pe figure{margin:0;width:140px;background:#fff;border:1.5px solid #EDEDED;border-radius:8px;padding:6px;text-align:center}
.pe img{width:100%;height:110px;object-fit:cover;border-radius:4px;display:block}.pe figure div{display:flex;justify-content:center;gap:4px;margin-top:4px}
.pe figure:first-child{border-color:#FECC2F}.pe button{min-width:32px;min-height:30px;border:1px solid #D1D1D1;background:#fff;border-radius:5px;cursor:pointer}
.login{max-width:380px;margin:60px auto}.login img{display:block;width:180px;margin:0 auto 18px}
.muted{color:#666;font-size:14px}
@media(max-width:700px){.hide-sm{display:none}th,td{padding:6px}.price-in{width:96px}}
`;

function page(title, body, { user, on, flash, err } = {}) {
  const nav = user ? `<nav>
    <a href="/admin/"${on === 'leads' ? ' class="on"' : ''}>লিড</a>
    <a href="/admin/quotes"${on === 'quotes' ? ' class="on"' : ''}>কোটেশন</a>
    <a href="/admin/receipts"${on === 'receipts' ? ' class="on"' : ''}>মানি রিসিট</a>
    <a href="/admin/books"${on === 'books' ? ' class="on"' : ''}>${user.role === 'super' ? 'হিসাব' : 'খরচ লিখুন'}</a>
    <a href="/admin/products"${on === 'products' ? ' class="on"' : ''}>প্রোডাক্ট</a>
    ${user.role === 'super' ? `<a href="/admin/users"${on === 'users' ? ' class="on"' : ''}>ইউজার</a>` : ''}
    <a href="/admin/password"${on === 'password' ? ' class="on"' : ''}>পাসওয়ার্ড</a>
    <a href="/" target="_blank" rel="noopener">সাইট দেখুন ↗</a>
    <span class="who">${esc(user.name)} (${ROLE_BN[user.role] || esc(user.role)})</span>
    <form method="post" action="/admin/logout"><button>লগআউট</button></form></nav>` : '';
  return html(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)} · Wood Metal অ্যাডমিন</title><link rel="icon" href="/favicon-48.png">
<link rel="manifest" href="/admin/manifest.webmanifest"><meta name="theme-color" content="#111111"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="WM অ্যাডমিন">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap"><style>${CSS}</style></head>
<body>${user ? `<header><strong>Wood Metal · অ্যাডমিন</strong>${nav}</header>` : ''}<main>
${flash ? `<div class="flash">${esc(flash)}</div>` : ''}${err ? `<div class="flash err">${esc(err)}</div>` : ''}
${body}</main>
<script>if('serviceWorker'in navigator)navigator.serviceWorker.register('/admin/sw.js',{scope:'/admin/'}).catch(function(){});
var ip;addEventListener('beforeinstallprompt',function(e){e.preventDefault();ip=e;var b=document.getElementById('install');if(b)b.hidden=false;});
document.addEventListener('click',function(e){if(e.target.id==='install'&&ip){ip.prompt();ip=null;e.target.hidden=true;}});</script>
</body></html>`);
}
const flashOf = (url) => ({ flash: url.searchParams.get('ok') || '', err: url.searchParams.get('err') || '' });
const withMsg = (path, key, msg) => `${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(msg)}`;

// ---------- phone app (installable admin) ----------
const MANIFEST = {
  name: 'Wood Metal অ্যাডমিন', short_name: 'WM অ্যাডমিন', lang: 'bn',
  start_url: '/admin/', scope: '/admin/', display: 'standalone',
  background_color: '#FFFFFF', theme_color: '#111111',
  icons: [
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
// Network only: the app always shows fresh leads and prices. Offline shows a short note.
const SW = `self.addEventListener('install',function(){self.skipWaiting()});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',function(e){if(e.request.mode!=='navigate')return;e.respondWith(fetch(e.request).catch(function(){return new Response('<meta charset=utf-8><meta name=viewport content="width=device-width"><p style="font-family:sans-serif;padding:24px">ইন্টারনেট নেই। সংযোগ ফিরলে আবার চেষ্টা করুন।</p>',{headers:{'content-type':'text/html; charset=utf-8'}})}))});`;

// ---------- entry ----------
export async function onRequest({ request, env, params }) {
  if (!env.DB) return new Response('D1 binding DB is missing.', { status: 500 });
  const url = new URL(request.url);
  const parts = (params.path || []).filter(Boolean);
  const route = parts.join('/');
  const post = request.method === 'POST';
  if (post && !sameOrigin(request, url)) return new Response('Forbidden', { status: 403 });

  if (route === 'manifest.webmanifest') return new Response(JSON.stringify(MANIFEST), { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=3600' } });
  if (route === 'sw.js') return new Response(SW, { headers: { 'content-type': 'text/javascript', 'cache-control': 'no-cache' } });
  if (route === 'login') return post ? doLogin(request, env, url) : loginPage(url);
  const user = await currentUser(request, env);
  if (!user) return redirect('/admin/login' + (route ? `?next=${encodeURIComponent(url.pathname + url.search)}` : ''));
  if (route === 'logout' && post) return doLogout(request, env);

  try {
    if (parts[0] === 'photo' && parts[1]) return leadPhoto(env, parts[1]);
    if (route === 'status' && post) return leadStatus(request, env, url);
    if (route === 'media' && post) return uploadMedia(request, env, user);
    if (['books', 'quotes', 'receipts'].includes(parts[0])) {
      return await books({ request, env, url, user, rest: parts.slice(1), post, section: parts[0], page, redirect, withMsg, flashOf, html });
    }
    if (parts[0] === 'products') return products(request, env, url, user, parts.slice(1), post);
    if (parts[0] === 'users') {
      if (user.role !== 'super') return page('অনুমতি নেই', '<p>এই পাতাটা শুধু সুপার অ্যাডমিনের জন্য।</p>', { user });
      return users(request, env, url, user, parts.slice(1), post);
    }
    if (route === 'password') return post ? changePassword(request, env, user) : passwordPage(url, user);
    if (route === '') return leadsPage(env, url, user);
  } catch (e) {
    console.log('admin error', e && e.stack);
    return page('সমস্যা', `<p>কিছু একটা সমস্যা হয়েছে: ${esc(e && e.message)}</p><p><a href="/admin/">ফিরে যান</a></p>`, { user });
  }
  return page('পাওয়া যায়নি', '<p>এই পাতাটা নেই। <a href="/admin/">লিডে ফিরে যান</a></p>', { user });
}

// ---------- login ----------
function loginPage(url, err, nextIn) {
  const next = nextIn ?? (url.searchParams.get('next') || '');
  return page('লগইন', `<div class="login box"><img src="/img/logo.png" alt="Wood Metal">
  <form method="post" action="/admin/login" class="stack" style="display:flex;flex-direction:column;gap:12px">
    <input type="hidden" name="next" value="${esc(next)}">
    <label>ইউজারনেম<input class="field" name="username" autocomplete="username" required autofocus></label>
    <label>পাসওয়ার্ড<input class="field" type="password" name="password" autocomplete="current-password" required></label>
    <button class="btn y">লগইন</button>
  </form>
  <button type="button" id="install" class="btn" hidden style="margin-top:14px;width:100%">📲 ফোনে অ্যাপ হিসেবে রাখুন</button>
  <details style="margin-top:14px" class="muted"><summary>ফোনে অ্যাপের মতো রাখবেন কীভাবে?</summary>
  <p><b>অ্যান্ড্রয়েড (Chrome):</b> উপরের ডান কোণে ⋮ চাপুন → "Add to Home screen" বা "Install app" → "Install"।</p>
  <p><b>আইফোন (Safari):</b> নিচের শেয়ার বাটন (□↑) চাপুন → "Add to Home Screen" → "Add"।</p>
  <p>এরপর ফোনের হোম স্ক্রিনে Wood Metal আইকন থেকে সরাসরি খুলবে।</p></details></div>`, { err });
}

async function doLogin(request, env, url) {
  const f = await request.formData();
  const username = String(f.get('username') || '').trim();
  const password = String(f.get('password') || '');
  const ip = request.headers.get('cf-connecting-ip') || '';
  const fails = await env.DB.prepare("SELECT COUNT(*) n FROM login_fails WHERE ip = ? AND at > datetime('now', '-15 minutes')").bind(ip).first();
  if (fails && fails.n >= 10) return loginPage(url, 'অনেকবার ভুল হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন।', String(f.get('next') || ''));
  const u = await env.DB.prepare('SELECT id, pw FROM users WHERE username = ? AND active = 1').bind(username).first();
  if (!u || !(await checkPw(password, u.pw))) {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO login_fails (ip) VALUES (?)').bind(ip),
      env.DB.prepare("DELETE FROM login_fails WHERE at < datetime('now', '-1 day')"),
    ]);
    return loginPage(url, 'ইউজারনেম বা পাসওয়ার্ড ভুল।', String(f.get('next') || ''));
  }
  const tok = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`).bind(await sha256(tok), u.id),
    env.DB.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").bind(u.id),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')"),
  ]);
  let next = String(f.get('next') || '');
  if (!next.startsWith('/admin')) next = '/admin/';
  return redirect(next, { 'set-cookie': sessionCookie(tok, SESSION_DAYS * 86400) });
}

async function doLogout(request, env) {
  const tok = cookieToken(request);
  if (tok) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(tok)).run();
  return redirect('/admin/login', { 'set-cookie': sessionCookie('', 0) });
}

// ---------- password ----------
function passwordPage(url, user) {
  return page('পাসওয়ার্ড', `<h1>নিজের পাসওয়ার্ড বদলান</h1>
  <form method="post" class="box stack" style="max-width:420px;display:flex;flex-direction:column;gap:12px">
    <label>এখনকার পাসওয়ার্ড<input class="field" type="password" name="old" autocomplete="current-password" required></label>
    <label>নতুন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)<input class="field" type="password" name="new1" autocomplete="new-password" minlength="8" required></label>
    <label>নতুন পাসওয়ার্ড আবার<input class="field" type="password" name="new2" autocomplete="new-password" minlength="8" required></label>
    <button class="btn y">সেভ</button></form>`, { user, on: 'password', ...flashOf(url) });
}
async function changePassword(request, env, user) {
  const f = await request.formData();
  const row = await env.DB.prepare('SELECT pw FROM users WHERE id = ?').bind(user.id).first();
  const n1 = String(f.get('new1') || ''), n2 = String(f.get('new2') || '');
  if (!(await checkPw(String(f.get('old') || ''), row.pw))) return redirect(withMsg('/admin/password', 'err', 'এখনকার পাসওয়ার্ড ভুল।'));
  if (n1.length < 8) return redirect(withMsg('/admin/password', 'err', 'নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।'));
  if (n1 !== n2) return redirect(withMsg('/admin/password', 'err', 'দুইবার একই পাসওয়ার্ড দিন।'));
  await env.DB.prepare('UPDATE users SET pw = ? WHERE id = ?').bind(await hashPw(n1), user.id).run();
  return redirect(withMsg('/admin/password', 'ok', 'পাসওয়ার্ড বদলানো হয়েছে।'));
}

// ---------- leads ----------
async function leadPhoto(env, id) {
  const row = await env.DB.prepare('SELECT mime, data FROM lead_photos WHERE id = ?').bind(Number(id)).first();
  if (!row) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(row.data), { headers: { 'content-type': row.mime, 'cache-control': 'private, max-age=86400' } });
}
async function leadStatus(request, env, url) {
  const f = await request.formData();
  const status = String(f.get('status'));
  if (STATUSES.includes(status)) await env.DB.prepare('UPDATE leads SET status = ? WHERE id = ?').bind(status, Number(f.get('id'))).run();
  return redirect('/admin/' + (url.searchParams.get('back') || ''));
}
async function leadsPage(env, url, user) {
  const filter = STATUSES.includes(url.searchParams.get('status')) ? url.searchParams.get('status') : null;
  const leads = (await (filter
    ? env.DB.prepare('SELECT * FROM leads WHERE status = ? ORDER BY id DESC LIMIT 300').bind(filter)
    : env.DB.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 300')).all()).results;
  const ids = leads.map((l) => l.id);
  const photos = ids.length ? (await env.DB.prepare(`SELECT id, lead_id FROM lead_photos WHERE lead_id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all()).results : [];
  const counts = Object.fromEntries((await env.DB.prepare('SELECT status, COUNT(*) n FROM leads GROUP BY status').all()).results.map((r) => [r.status, r.n]));
  const back = filter ? `?status=${filter}` : '';
  return page('লিড', `<h1>ক্রেতাদের মেসেজ ও অনুরোধ</h1>
  <div class="bar"><a class="btn ${filter ? 'o' : ''} s" href="/admin/">সব (${Object.values(counts).reduce((a, b) => a + b, 0)})</a>
    ${STATUSES.map((s) => `<a class="btn ${filter === s ? '' : 'o'} s" href="/admin/?status=${s}">${STATUS_BN[s]} (${counts[s] || 0})</a>`).join('')}</div>
  ${leads.length ? leads.map((l) => `<div class="box lead ${esc(l.status)}">
    <div class="top"><b>${esc(l.name)}</b><a href="tel:${esc(l.phone)}">${esc(l.phone)}</a><a class="btn g s" href="https://wa.me/88${esc(l.phone)}" target="_blank" rel="noopener">WhatsApp</a><a class="btn o s" href="/admin/quotes/new?lead=${l.id}">কোটেশন বানান</a>
      <span class="pill">${KIND_BN[l.kind] || esc(l.kind)}</span><span class="k">#${l.id} · ${esc(l.created_at)} UTC · ${l.emailed ? 'ইমেইল গেছে' : 'ইমেইল যায়নি'}</span></div>
    ${l.product_name ? `<div><span class="k">পণ্য:</span> <a href="/p/${esc(l.product_slug)}/" target="_blank" rel="noopener">${esc(l.product_name)}</a></div>` : ''}
    ${l.area ? `<div><span class="k">এলাকা:</span> ${esc(l.area)}</div>` : ''}
    ${l.size ? `<div><span class="k">মাপ:</span> ${esc(l.size)}</div>` : ''}
    ${l.polish ? `<div><span class="k">পালিশ:</span> ${esc(l.polish)}</div>` : ''}
    ${l.message ? `<pre>${esc(l.message)}</pre>` : ''}
    ${photos.some((p) => p.lead_id === l.id) ? `<div class="photos">${photos.filter((p) => p.lead_id === l.id).map((p) => `<a href="/admin/photo/${p.id}" target="_blank"><img src="/admin/photo/${p.id}" alt="photo" loading="lazy"></a>`).join('')}</div>` : ''}
    <form class="inline" method="post" action="/admin/status?back=${encodeURIComponent(back)}" style="margin-top:8px"><input type="hidden" name="id" value="${l.id}">
      <select class="field" name="status" style="width:auto">${STATUSES.map((s) => `<option value="${s}"${s === l.status ? ' selected' : ''}>${STATUS_BN[s]}</option>`).join('')}</select><button class="btn s">সেভ</button></form>
  </div>`).join('') : '<p>এখনো কোনো লিড নেই।</p>'}`, { user, on: 'leads' });
}

// ---------- photos ----------
async function uploadMedia(request, env, user) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ ok: false, error: 'bad json' }, { status: 400 }); }
  if (!/^image\/(jpeg|png|webp)$/.test(body.type || '') || typeof body.data !== 'string') return Response.json({ ok: false, error: 'bad image' }, { status: 400 });
  const bin = atob(body.data);
  if (bin.length > 1.8 * 1024 * 1024) return Response.json({ ok: false, error: 'too big' }, { status: 413 });
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const r = await env.DB.prepare('INSERT INTO media (mime, data, w, h, created_by) VALUES (?, ?, ?, ?, ?)')
    .bind(body.type, bytes, Number(body.w) || null, Number(body.h) || null, user.username).run();
  return Response.json({ ok: true, id: r.meta.last_row_id });
}

// ---------- products ----------
async function allProducts(env) {
  const rows = (await env.DB.prepare('SELECT slug, data, hidden, sort, updated_at, updated_by FROM products ORDER BY sort, slug').all()).results;
  return rows.map((r) => ({ ...JSON.parse(r.data), _hidden: !!r.hidden, _sort: r.sort, _updated: r.updated_at, _by: r.updated_by }));
}
const getProduct = async (env, slug) => {
  const r = await env.DB.prepare('SELECT data, hidden FROM products WHERE slug = ?').bind(slug).first();
  return r ? { ...JSON.parse(r.data), _hidden: !!r.hidden } : null;
};
const log = (env, user, slug, action, detail) => env.DB.prepare('INSERT INTO product_log (username, slug, action, detail) VALUES (?, ?, ?, ?)').bind(user.username, slug, action, detail || null);

// The first time anyone opens the product pages, copy the catalogue from the
// static build (data/products.json) into D1. After that D1 is the source of truth.
async function ensureSeeded(env, request) {
  const n = await env.DB.prepare('SELECT COUNT(*) n FROM products').first();
  if (n && n.n > 0) return;
  const r = await env.ASSETS.fetch(new URL('/products-seed.json', request.url));
  if (!r.ok) return;
  const list = await r.json();
  const order = CATEGORIES.flatMap((c) => list.filter((p) => p.cat === c.slug));
  const stmts = order.map((p, i) => env.DB.prepare("INSERT OR IGNORE INTO products (slug, data, sort, updated_by) VALUES (?, ?, ?, 'import')").bind(p.slug, JSON.stringify(p), (i + 1) * 10));
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
}

async function products(request, env, url, user, rest, post) {
  await ensureSeeded(env, request);
  if (!rest.length) return productList(env, url, user);
  if (rest[0] === 'new' && !post) return productForm(url, user, null);
  if (rest[0] === 'edit' && rest[1] && !post) {
    const p = await getProduct(env, rest[1]);
    return p ? productForm(url, user, p, env) : redirect(withMsg('/admin/products', 'err', 'প্রোডাক্টটা পাওয়া যায়নি।'));
  }
  if (!post) return redirect('/admin/products');
  const f = await request.formData();
  const back = String(f.get('back') || '/admin/products');
  const safeBack = back.startsWith('/admin/products') ? back : '/admin/products';
  const slug = String(f.get('slug') || '');

  if (rest[0] === 'price') {
    const p = await getProduct(env, slug);
    const price = Math.round(Number(String(f.get('price') || '').replace(/[^0-9.]/g, '')));
    if (!p || !(price > 0)) return redirect(withMsg(safeBack, 'err', 'সঠিক দাম দিন।'));
    if (price === p.price) return redirect(safeBack);
    const old = p.price; delete p._hidden; p.price = price;
    await env.DB.batch([
      env.DB.prepare("UPDATE products SET data = ?, updated_at = datetime('now'), updated_by = ? WHERE slug = ?").bind(JSON.stringify(p), user.username, slug),
      log(env, user, slug, 'price', `${old} → ${price}`),
    ]);
    return redirect(withMsg(safeBack, 'ok', `${pName(p)}: দাম ${money(old)} থেকে ${money(price)} করা হয়েছে।`));
  }
  if (rest[0] === 'toggle') {
    const p = await getProduct(env, slug);
    if (!p) return redirect(safeBack);
    await env.DB.batch([
      env.DB.prepare("UPDATE products SET hidden = ?, updated_at = datetime('now'), updated_by = ? WHERE slug = ?").bind(p._hidden ? 0 : 1, user.username, slug),
      log(env, user, slug, p._hidden ? 'show' : 'hide'),
    ]);
    return redirect(withMsg(safeBack, 'ok', `${pName(p)} ${p._hidden ? 'এখন সাইটে দেখাচ্ছে।' : 'সাইট থেকে লুকানো হয়েছে।'}`));
  }
  if (rest[0] === 'delete') {
    if (user.role !== 'super') return redirect(withMsg(safeBack, 'err', 'মুছতে পারেন শুধু সুপার অ্যাডমিন।'));
    const p = await getProduct(env, slug);
    if (!p) return redirect('/admin/products');
    await env.DB.batch([env.DB.prepare('DELETE FROM products WHERE slug = ?').bind(slug), log(env, user, slug, 'delete', JSON.stringify(p))]);
    return redirect(withMsg('/admin/products', 'ok', `${pName(p)} মুছে ফেলা হয়েছে।`));
  }
  if (rest[0] === 'save') return saveProduct(env, user, f);
  return redirect('/admin/products');
}

async function productList(env, url, user) {
  const all = await allProducts(env);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const cat = url.searchParams.get('cat') || '';
  const list = all.filter((p) => (!cat || p.cat === cat) && (!q || [p.model, p.code, p.slug, pName(p), catBySlug[p.cat]?.en].join(' ').toLowerCase().includes(q)));
  const back = url.pathname + url.search;
  const recent = (await env.DB.prepare('SELECT * FROM product_log ORDER BY id DESC LIMIT 15').all()).results;
  const actBn = { add: 'নতুন যোগ', edit: 'এডিট', price: 'দাম বদল', hide: 'লুকানো', show: 'দেখানো', delete: 'মুছে ফেলা' };
  return page('প্রোডাক্ট', `<h1>প্রোডাক্ট (${all.length})</h1>
  <div class="bar"><a class="btn y" href="/admin/products/new">+ নতুন প্রোডাক্ট</a>
    <form class="inline" method="get" action="/admin/products">
      <select class="field" name="cat" style="width:auto"><option value="">সব ক্যাটাগরি</option>${CATEGORIES.map((c) => `<option value="${c.slug}"${c.slug === cat ? ' selected' : ''}>${c.bn}</option>`).join('')}</select>
      <input class="field" name="q" value="${esc(q)}" placeholder="মডেল বা কোড খুঁজুন" style="width:180px"><button class="btn s">খুঁজুন</button></form></div>
  <p class="muted">দাম বদলাতে নতুন দাম লিখে "সেভ" চাপুন। সাইটে সাথে সাথে বদলে যাবে।</p>
  <table><thead><tr><th>ছবি</th><th>প্রোডাক্ট</th><th class="hide-sm">কোড</th><th>দাম (৳)</th><th>অবস্থা</th><th></th></tr></thead><tbody>
  ${list.map((p) => `<tr${p._hidden ? ' class="off"' : ''}>
    <td><img src="${esc(p.images?.[0]?.sm || '')}" alt="" loading="lazy"></td>
    <td><a href="/admin/products/edit/${esc(p.slug)}"><b>${esc(pName(p))}</b></a><br><span class="muted">${esc(p.size || '')}</span></td>
    <td class="hide-sm">${esc(p.code)}</td>
    <td><form class="inline" method="post" action="/admin/products/price"><input type="hidden" name="slug" value="${esc(p.slug)}"><input type="hidden" name="back" value="${esc(back)}">
      <input class="field price-in" name="price" inputmode="numeric" value="${esc(p.price)}" aria-label="দাম"><button class="btn s">সেভ</button></form></td>
    <td><form class="inline" method="post" action="/admin/products/toggle"><input type="hidden" name="slug" value="${esc(p.slug)}"><input type="hidden" name="back" value="${esc(back)}">
      <button class="btn s ${p._hidden ? 'o' : 'g'}" title="চাপলে বদলাবে">${p._hidden ? 'লুকানো' : 'দেখাচ্ছে'}</button></form></td>
    <td><a class="btn o s" href="/admin/products/edit/${esc(p.slug)}">এডিট</a> <a class="hide-sm" href="/p/${esc(p.slug)}/" target="_blank" rel="noopener">সাইটে ↗</a></td>
  </tr>`).join('')}
  </tbody></table>
  ${list.length ? '' : '<p>কিছু পাওয়া যায়নি।</p>'}
  <h2>সাম্প্রতিক পরিবর্তন</h2>
  ${recent.length ? `<table><tbody>${recent.map((r) => `<tr><td class="muted">${esc(r.at)} UTC</td><td>${esc(r.username)}</td><td>${actBn[r.action] || esc(r.action)}</td><td><a href="/admin/products/edit/${esc(r.slug)}">${esc(r.slug)}</a></td><td>${r.action === 'delete' ? '' : esc(r.detail || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">এখনো কোনো পরিবর্তন হয়নি।</p>'}`,
  { user, on: 'products', ...flashOf(url) });
}

function productForm(url, user, p) {
  const isNew = !p;
  p = p || { cat: url.searchParams.get('cat') || '', model: '', code: '', price: '', regular_price: '', size: '', wood: 'Pine', polishes: Object.keys(POLISH), images: [] };
  return page(isNew ? 'নতুন প্রোডাক্ট' : pName(p), `<h1>${isNew ? 'নতুন প্রোডাক্ট যোগ করুন' : 'এডিট: ' + esc(pName(p))}</h1>
  <form method="post" action="/admin/products/save" id="pform" class="box">
    <input type="hidden" name="slug" value="${esc(p.slug || '')}">
    <div class="grid">
      <label>ক্যাটাগরি *<select class="field" name="cat" required><option value="">বাছাই করুন</option>${CATEGORIES.map((c) => `<option value="${c.slug}"${c.slug === p.cat ? ' selected' : ''}>${c.bn} (${c.en})</option>`).join('')}</select></label>
      <label>মডেল নম্বর *<input class="field" name="model" value="${esc(p.model)}" required maxlength="40" placeholder="যেমন 580 বা 329 A"></label>
      <label>কোড<input class="field" name="code" value="${esc(p.code)}" maxlength="40" placeholder="যেমন SS-580"></label>
      <label>দাম (৳) *<input class="field" name="price" inputmode="numeric" value="${esc(p.price)}" required placeholder="যেমন 48720"></label>
      <label>আগের দাম (কাটা দাম, ঐচ্ছিক)<input class="field" name="regular_price" inputmode="numeric" value="${esc(p.regular_price ?? '')}"></label>
      <label>মাপ<input class="field" name="size" value="${esc(p.size)}" maxlength="120" placeholder='যেমন L-36" x W-22" x H-78"'></label>
      <label>কাঠ<input class="field" name="wood" value="${esc(p.wood)}" maxlength="40" list="woods"><datalist id="woods"><option value="Pine"><option value="Mahogany"><option value="Teak"><option value="Gamari"><option value="Shil Koroi"></datalist></label>
      <label>পালিশ<span class="checks">${Object.entries(POLISH).map(([k, v]) => `<label><input type="checkbox" name="polishes" value="${esc(k)}"${(p.polishes || []).includes(k) ? ' checked' : ''}> ${v.bn}</label>`).join('')}</span></label>
      ${isNew ? '' : `<label>সাইটে<span class="checks"><label><input type="checkbox" name="hidden" value="1"${p._hidden ? ' checked' : ''}> লুকিয়ে রাখুন</label></span></label>`}
    </div>
    <h2>ছবি</h2>
    <p class="muted">প্রথম ছবিটাই প্রধান ছবি হিসেবে দেখাবে। ← → দিয়ে ক্রম বদলান। মোবাইল থেকে তোলা ছবিও দেওয়া যাবে, নিজে থেকে ছোট হয়ে যাবে।</p>
    <div class="pe" id="pe"></div>
    <input type="hidden" name="images" id="images" value="${esc(JSON.stringify(p.images || []))}">
    <label class="btn o" style="width:max-content">+ ছবি যোগ করুন<input type="file" id="addph" accept="image/*" multiple hidden></label>
    <span id="upst" class="muted"></span>
    <div class="bar" style="margin-top:20px"><button class="btn y" id="savebtn">${isNew ? 'প্রোডাক্ট যোগ করুন' : 'সেভ করুন'}</button><a class="btn o" href="/admin/products">বাতিল</a>
      ${!isNew ? `<a href="/p/${esc(p.slug)}/" target="_blank" rel="noopener">সাইটে দেখুন ↗</a>` : ''}</div>
  </form>
  ${!isNew && user.role === 'super' ? `<form method="post" action="/admin/products/delete" onsubmit="return confirm('সত্যিই মুছে ফেলবেন? এটা ফেরত আনা যাবে না। শুধু লুকাতে চাইলে উপরের লুকিয়ে রাখুন বক্সে টিক দিন।')">
    <input type="hidden" name="slug" value="${esc(p.slug)}"><button class="btn r s">প্রোডাক্ট মুছে ফেলুন</button></form>` : ''}
<script>
(function(){
  var imgs = JSON.parse(document.getElementById('images').value || '[]');
  var pe = document.getElementById('pe'), st = document.getElementById('upst'), busy = 0;
  function draw(){
    document.getElementById('images').value = JSON.stringify(imgs);
    pe.innerHTML = '';
    imgs.forEach(function(im, i){
      var f = document.createElement('figure');
      f.innerHTML = '<img alt="">' + '<div><button type="button" data-a="l" aria-label="আগে">←</button><button type="button" data-a="r" aria-label="পরে">→</button><button type="button" data-a="x" aria-label="মুছুন">✕</button></div>';
      f.querySelector('img').src = im.sm || im.src;
      f.addEventListener('click', function(e){
        var a = e.target.getAttribute('data-a'); if (!a) return;
        if (a === 'x') imgs.splice(i, 1);
        if (a === 'l' && i > 0) imgs.splice(i - 1, 0, imgs.splice(i, 1)[0]);
        if (a === 'r' && i < imgs.length - 1) imgs.splice(i + 1, 0, imgs.splice(i, 1)[0]);
        draw();
      });
      pe.appendChild(f);
    });
  }
  function shrink(img, max, q){
    var k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    var c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    return { w: c.width, h: c.height, data: c.toDataURL('image/jpeg', q).split(',')[1] };
  }
  function up(x){
    return fetch('/admin/media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'image/jpeg', data: x.data, w: x.w, h: x.h }) })
      .then(function(r){ if (!r.ok) throw new Error('upload ' + r.status); return r.json(); }).then(function(j){ return '/media/' + j.id; });
  }
  function load(file){
    return new Promise(function(res, rej){ var u = URL.createObjectURL(file), im = new Image(); im.onload = function(){ res(im); }; im.onerror = function(){ rej(new Error('ছবিটা খোলা গেল না')); }; im.src = u; });
  }
  function status(){ st.textContent = busy ? ('ছবি আপলোড হচ্ছে... (' + busy + ')') : ''; document.getElementById('savebtn').disabled = !!busy; }
  document.getElementById('addph').addEventListener('change', function(e){
    Array.prototype.forEach.call(e.target.files, function(file){
      busy++; status();
      load(file).then(function(im){
        var big = shrink(im, 1600, 0.85), sm = shrink(im, 480, 0.8);
        return Promise.all([up(big), up(sm)]).then(function(u){ imgs.push({ src: u[0], sm: u[1], w: big.w, h: big.h }); draw(); });
      }).catch(function(err){ alert('ছবি আপলোড হয়নি: ' + err.message); }).then(function(){ busy--; status(); });
    });
    e.target.value = '';
  });
  document.getElementById('pform').addEventListener('submit', function(e){
    if (busy) { e.preventDefault(); return; }
    if (!imgs.length) { e.preventDefault(); alert('কমপক্ষে একটা ছবি দিন।'); }
  });
  draw();
})();
</script>`, { user, on: 'products', ...flashOf(url) });
}

async function saveProduct(env, user, f) {
  const slugIn = String(f.get('slug') || '');
  const isNew = !slugIn;
  const backTo = isNew ? '/admin/products/new' : `/admin/products/edit/${encodeURIComponent(slugIn)}`;
  const fail = (m) => redirect(withMsg(backTo, 'err', m));
  const cat = String(f.get('cat') || '');
  const model = String(f.get('model') || '').trim().slice(0, 40);
  const price = Math.round(Number(String(f.get('price') || '').replace(/[^0-9.]/g, '')));
  const regRaw = String(f.get('regular_price') || '').replace(/[^0-9.]/g, '');
  const regular = regRaw ? Math.round(Number(regRaw)) : null;
  if (!catBySlug[cat]) return fail('ক্যাটাগরি বাছাই করুন।');
  if (!model || !slugify(model)) return fail('মডেল নম্বর দিন (ইংরেজি অক্ষর বা সংখ্যা)।');
  if (!(price > 0)) return fail('সঠিক দাম দিন।');
  let images;
  try { images = JSON.parse(String(f.get('images') || '[]')); } catch { images = []; }
  images = (Array.isArray(images) ? images : []).filter((im) => im && /^\/(img|media)\//.test(im.src) && /^\/(img|media)\//.test(im.sm || im.src))
    .slice(0, 12).map((im) => ({ src: im.src, sm: im.sm || im.src, w: Number(im.w) || 1000, h: Number(im.h) || 1000 }));
  if (!images.length) return fail('কমপক্ষে একটা ছবি দিন।');
  const polishes = f.getAll('polishes').map(String).filter((k) => POLISH[k]);
  const code = String(f.get('code') || '').trim().slice(0, 40) || model;

  let old = null, slug = slugIn;
  if (isNew) {
    slug = `${slugify(catBySlug[cat].one.en)}-${slugify(model)}`;
    if (await env.DB.prepare('SELECT 1 FROM products WHERE slug = ?').bind(slug).first()) return redirect(withMsg('/admin/products/new', 'err', `এই ক্যাটাগরিতে "${model}" মডেল আগে থেকেই আছে।`));
  } else {
    old = await getProduct(env, slug);
    if (!old) return fail('প্রোডাক্টটা পাওয়া যায়নি।');
  }
  const p = {
    ...(old || {}),
    slug, cat, model, code,
    sku: old?.sku || `WM-${code.replace(/\s+/g, '-')}`,
    price, regular_price: regular && regular > price ? regular : null,
    size: String(f.get('size') || '').trim().slice(0, 120),
    wood: String(f.get('wood') || '').trim().slice(0, 40) || 'Pine',
    polishes: polishes.length ? polishes : Object.keys(POLISH),
    images,
  };
  delete p._hidden;
  const hidden = isNew ? 0 : (f.get('hidden') ? 1 : 0);
  if (isNew) {
    const min = await env.DB.prepare('SELECT MIN(sort) m FROM products').first();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO products (slug, data, hidden, sort, updated_at, updated_by) VALUES (?, ?, 0, ?, datetime('now'), ?)").bind(slug, JSON.stringify(p), (min?.m ?? 0) - 10, user.username),
      log(env, user, slug, 'add', `${money(price)}`),
    ]);
    return redirect(withMsg('/admin/products', 'ok', `${pName(p)} যোগ হয়েছে। সাইটে এখনই দেখা যাবে।`));
  }
  const changes = [];
  if (old.price !== p.price) changes.push(`দাম ${old.price} → ${p.price}`);
  for (const [k, label] of [['model', 'মডেল'], ['code', 'কোড'], ['cat', 'ক্যাটাগরি'], ['size', 'মাপ'], ['wood', 'কাঠ']]) if ((old[k] || '') !== (p[k] || '')) changes.push(label);
  if (JSON.stringify(old.images) !== JSON.stringify(p.images)) changes.push('ছবি');
  if (old._hidden !== !!hidden) changes.push(hidden ? 'লুকানো' : 'দেখানো');
  await env.DB.batch([
    env.DB.prepare("UPDATE products SET data = ?, hidden = ?, updated_at = datetime('now'), updated_by = ? WHERE slug = ?").bind(JSON.stringify(p), hidden, user.username, slug),
    log(env, user, slug, changes.length === 1 && changes[0].startsWith('দাম') ? 'price' : 'edit', changes.join(', ') || null),
  ]);
  return redirect(withMsg(backTo, 'ok', 'সেভ হয়েছে। সাইটে এখনই বদলে গেছে।'));
}

// ---------- users (super admin) ----------
async function users(request, env, url, user, rest, post) {
  if (post) {
    const f = await request.formData();
    if (rest[0] === 'add') {
      const username = String(f.get('username') || '').trim().toLowerCase();
      const name = String(f.get('name') || '').trim().slice(0, 60);
      const pw = String(f.get('password') || '');
      const role = f.get('role') === 'super' ? 'super' : 'staff';
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) return redirect(withMsg('/admin/users', 'err', 'ইউজারনেম ৩ থেকে ৩০ অক্ষরের হবে, শুধু ইংরেজি ছোট হাতের অক্ষর, সংখ্যা, . _ -'));
      if (!name) return redirect(withMsg('/admin/users', 'err', 'নাম দিন।'));
      if (pw.length < 8) return redirect(withMsg('/admin/users', 'err', 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।'));
      if (await env.DB.prepare('SELECT 1 FROM users WHERE username = ?').bind(username).first()) return redirect(withMsg('/admin/users', 'err', 'এই ইউজারনেম আগে থেকেই আছে।'));
      await env.DB.prepare('INSERT INTO users (username, name, role, pw) VALUES (?, ?, ?, ?)').bind(username, name, role, await hashPw(pw)).run();
      return redirect(withMsg('/admin/users', 'ok', `${name} (${username}) যোগ হয়েছে।`));
    }
    if (rest[0] === 'update') {
      const id = Number(f.get('id'));
      const target = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
      if (!target) return redirect('/admin/users');
      const action = String(f.get('action'));
      if (action === 'reset') {
        const pw = String(f.get('password') || '');
        if (pw.length < 8) return redirect(withMsg('/admin/users', 'err', 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।'));
        await env.DB.batch([
          env.DB.prepare('UPDATE users SET pw = ? WHERE id = ?').bind(await hashPw(pw), id),
          env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
        ]);
        return redirect(withMsg('/admin/users', 'ok', `${target.name}-এর নতুন পাসওয়ার্ড সেট হয়েছে।`));
      }
      if (id === user.id) return redirect(withMsg('/admin/users', 'err', 'নিজের অ্যাকাউন্ট বন্ধ বা রোল বদলানো যাবে না।'));
      if (action === 'toggle') {
        await env.DB.batch([
          env.DB.prepare('UPDATE users SET active = ? WHERE id = ?').bind(target.active ? 0 : 1, id),
          env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
        ]);
        return redirect(withMsg('/admin/users', 'ok', `${target.name} ${target.active ? 'বন্ধ করা হয়েছে, আর লগইন করতে পারবেন না।' : 'আবার চালু হয়েছে।'}`));
      }
      if (action === 'role') {
        const role = target.role === 'super' ? 'staff' : 'super';
        await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id).run();
        return redirect(withMsg('/admin/users', 'ok', `${target.name} এখন ${ROLE_BN[role]}।`));
      }
    }
    return redirect('/admin/users');
  }
  const list = (await env.DB.prepare('SELECT id, username, name, role, active, created_at, last_login FROM users ORDER BY role DESC, name').all()).results;
  return page('ইউজার', `<h1>ইউজার</h1>
  <p class="muted"><b>সুপার অ্যাডমিন</b> সব করতে পারেন: ইউজার যোগ, প্রোডাক্ট মুছে ফেলা। <b>স্টাফ</b> লিড দেখতে, প্রোডাক্ট যোগ করতে আর দাম বদলাতে পারেন।</p>
  <table><thead><tr><th>নাম</th><th>ইউজারনেম</th><th>রোল</th><th class="hide-sm">শেষ লগইন</th><th>অবস্থা</th><th>নতুন পাসওয়ার্ড</th></tr></thead><tbody>
  ${list.map((u) => `<tr${u.active ? '' : ' class="off"'}><td><b>${esc(u.name)}</b></td><td>${esc(u.username)}</td>
    <td>${u.id === user.id ? ROLE_BN[u.role] : `<form class="inline" method="post" action="/admin/users/update"><input type="hidden" name="id" value="${u.id}"><input type="hidden" name="action" value="role"><button class="btn o s" title="চাপলে বদলাবে">${ROLE_BN[u.role] || esc(u.role)}</button></form>`}</td>
    <td class="hide-sm muted">${esc(u.last_login || '-')}</td>
    <td>${u.id === user.id ? 'আপনি' : `<form class="inline" method="post" action="/admin/users/update"><input type="hidden" name="id" value="${u.id}"><input type="hidden" name="action" value="toggle"><button class="btn s ${u.active ? 'g' : 'o'}">${u.active ? 'চালু' : 'বন্ধ'}</button></form>`}</td>
    <td><form class="inline" method="post" action="/admin/users/update"><input type="hidden" name="id" value="${u.id}"><input type="hidden" name="action" value="reset"><input class="field" type="text" name="password" minlength="8" placeholder="নতুন পাসওয়ার্ড" style="width:150px" autocomplete="off"><button class="btn s">সেট</button></form></td></tr>`).join('')}
  </tbody></table>
  <h2>নতুন ইউজার যোগ করুন</h2>
  <form method="post" action="/admin/users/add" class="box grid">
    <label>নাম<input class="field" name="name" required maxlength="60" placeholder="যেমন রহিম"></label>
    <label>ইউজারনেম (ইংরেজিতে)<input class="field" name="username" required pattern="[a-zA-Z0-9._-]{3,30}" placeholder="যেমন rahim" autocomplete="off"></label>
    <label>পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)<input class="field" type="text" name="password" required minlength="8" autocomplete="off"></label>
    <label>রোল<select class="field" name="role"><option value="staff">স্টাফ</option><option value="super">সুপার অ্যাডমিন</option></select></label>
    <div style="align-self:end"><button class="btn y">যোগ করুন</button></div>
  </form>`, { user, on: 'users', ...flashOf(url) });
}
