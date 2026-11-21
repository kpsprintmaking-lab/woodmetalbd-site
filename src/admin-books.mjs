// Shop books for /admin: income & expense (monthly), quotations and money receipts.
//
//   /admin/books                 super only: month view (?m=YYYY-MM), add entry, year table
//   /admin/books/csv?m=          the month as a CSV file (opens in Excel / Google Sheets)
//   /admin/books/print?m=        printable monthly report
//   /admin/quotes                list; /new (?lead=<id>), /edit/<id>, /view/<id> (print)
//   /admin/receipts              list; /new (?quote=<id>), /view/<id> (print)
//
// Every money receipt also writes an income entry, so the month's books stay
// complete. Receipts are never deleted, only voided (super), which removes that
// income entry again.
import { T, CATEGORIES } from './strings.mjs';
const catBySlug = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]));

const SITE = {
  name: 'Wood Metal', nameBn: 'উড মেটাল',
  address: T.bn.address.replace(/<br>/g, ', '),
  phones: '01844 630 465, 01970 802121',
  email: 'woodmetalbd@gmail.com', web: 'www.woodmetalbd.com',
};

export const IN_CATS = ['বিক্রি (অগ্রিম)', 'বিক্রি (বাকি পরিশোধ)', 'বিক্রি (পুরো টাকা)', 'কাস্টম অর্ডার', 'মেরামত/সার্ভিস', 'অন্যান্য আয়'];
export const OUT_CATS = ['কাঠ', 'লোহা/মেটাল', 'ফোম/কাপড়/রেক্সিন', 'পালিশ/রং', 'হার্ডওয়্যার/ফিটিংস', 'কারিগর মজুরি', 'স্টাফ বেতন', 'দোকান ভাড়া', 'বিদ্যুৎ/পানি/ইন্টারনেট', 'ডেলিভারি/পরিবহন', 'বিজ্ঞাপন/মার্কেটিং', 'মেশিন/যন্ত্রপাতি', 'নাস্তা/অফিস খরচ', 'অন্যান্য খরচ'];
export const METHODS = { cash: 'ক্যাশ', bkash: 'বিকাশ', nagad: 'নগদ', bank: 'ব্যাংক', card: 'কার্ড' };
const METHODS_EN = { cash: 'Cash', bkash: 'bKash', nagad: 'Nagad', bank: 'Bank', card: 'Card' };
export const Q_STATUS = { draft: 'খসড়া', sent: 'পাঠানো হয়েছে', accepted: 'অর্ডার কনফার্ম', delivered: 'ডেলিভারি হয়েছে', cancelled: 'বাতিল' };
const MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const DEFAULT_TERMS = 'অর্ডার কনফার্ম করতে অগ্রিম দিতে হবে, বাকি টাকা ডেলিভারির সময়।\nমাপ, কাঠ ও পালিশ অর্ডারের সময় ঠিক করা হবে; পরে বদলালে দাম ও সময় বদলাতে পারে।\nহাতে বানানো ফার্নিচার, তাই কাঠের আঁশ ও রঙে সামান্য পার্থক্য থাকতে পারে।';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tk = (n) => '৳ ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const int = (v) => { const n = Math.round(Number(String(v ?? '').replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d)).replace(/[^0-9.-]/g, ''))); return Number.isFinite(n) ? n : 0; };
const str = (v, max = 300) => String(v ?? '').trim().slice(0, max);
export const today = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10); // Dhaka
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isMonth = (s) => /^\d{4}-\d{2}$/.test(s);
const monthName = (m) => `${MONTHS_BN[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const shiftMonth = (m, d) => { const dt = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5)) - 1 + d, 1)); return dt.toISOString().slice(0, 7); };
const fmtDay = (d) => (isDay(d) ? `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : esc(d));
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

// Amount in words, Bangladeshi style (lakh, crore): "Forty-Eight Thousand Seven Hundred Twenty Taka Only"
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function under100(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : ''); }
function under1000(n) { return (n >= 100 ? ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : '') + (n % 100 ? under100(n % 100) : ''); }
export function inWords(amount) {
  let n = Math.round(Math.abs(Number(amount) || 0));
  if (!n) return 'Zero Taka Only';
  const parts = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push((crore >= 1000 ? inWords(crore).replace(' Taka Only', '') : under1000(crore)) + ' Crore');
  if (lakh) parts.push(under100(lakh) + ' Lakh');
  if (thousand) parts.push(under100(thousand) + ' Thousand');
  if (n) parts.push(under1000(n));
  return parts.join(' ') + ' Taka Only';
}

// ---------- schema (created on first use, once per isolate) ----------
let ready = false;
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS txns (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, day TEXT NOT NULL, amount INTEGER NOT NULL, category TEXT NOT NULL, method TEXT NOT NULL DEFAULT 'cash', party TEXT, note TEXT, receipt_id INTEGER, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_txns_day ON txns(day)`,
  `CREATE TABLE IF NOT EXISTS quotes (id INTEGER PRIMARY KEY AUTOINCREMENT, no TEXT NOT NULL UNIQUE, day TEXT NOT NULL, valid_days INTEGER NOT NULL DEFAULT 15, customer TEXT NOT NULL, phone TEXT, address TEXT, items TEXT NOT NULL, discount INTEGER NOT NULL DEFAULT 0, delivery INTEGER NOT NULL DEFAULT 0, advance_pct INTEGER NOT NULL DEFAULT 50, days_to_make TEXT, note TEXT, status TEXT NOT NULL DEFAULT 'draft', lead_id INTEGER, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS receipts (id INTEGER PRIMARY KEY AUTOINCREMENT, no TEXT NOT NULL UNIQUE, day TEXT NOT NULL, customer TEXT NOT NULL, phone TEXT, address TEXT, amount INTEGER NOT NULL, method TEXT NOT NULL DEFAULT 'cash', purpose TEXT, quote_id INTEGER, note TEXT, void INTEGER NOT NULL DEFAULT 0, created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_receipts_quote ON receipts(quote_id)`,
  `CREATE TABLE IF NOT EXISTS counters (name TEXT NOT NULL, year INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (name, year))`,
];
async function ensure(env) {
  if (ready) return;
  await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
  ready = true;
}
async function nextNo(env, name, prefix, day) {
  const year = Number(day.slice(0, 4));
  const r = await env.DB.prepare('INSERT INTO counters (name, year, n) VALUES (?, ?, 1) ON CONFLICT(name, year) DO UPDATE SET n = n + 1 RETURNING n').bind(name, year).first();
  return `${prefix}-${year}-${String(r.n).padStart(4, '0')}`;
}

// ---------- quote maths ----------
function parseItems(json) { try { const a = JSON.parse(json); return Array.isArray(a) ? a : []; } catch { return []; } }
export function quoteTotals(q) {
  const items = typeof q.items === 'string' ? parseItems(q.items) : q.items || [];
  const subtotal = items.reduce((s, it) => s + int(it.qty) * int(it.rate), 0);
  const total = Math.max(0, subtotal - int(q.discount) + int(q.delivery));
  const advance = Math.round((total * int(q.advance_pct)) / 100);
  return { items, subtotal, total, advance };
}
async function paidFor(env, quoteIds) {
  if (!quoteIds.length) return {};
  const rows = (await env.DB.prepare(`SELECT quote_id, SUM(amount) paid FROM receipts WHERE void = 0 AND quote_id IN (${quoteIds.map(() => '?').join(',')}) GROUP BY quote_id`).bind(...quoteIds).all()).results;
  return Object.fromEntries(rows.map((r) => [r.quote_id, r.paid]));
}

// ---------- entry ----------
// ctx: { request, env, url, user, rest, post, section, page, redirect, withMsg, flashOf, html }
export async function books(ctx) {
  await ensure(ctx.env);
  if (ctx.section === 'books') {
    if (ctx.user.role !== 'super') return ctx.page('অনুমতি নেই', '<p>আয়-ব্যয়ের হিসাব শুধু সুপার অ্যাডমিন দেখতে পারেন।</p>', { user: ctx.user });
    return booksRoute(ctx);
  }
  if (ctx.section === 'quotes') return quotesRoute(ctx);
  if (ctx.section === 'receipts') return receiptsRoute(ctx);
  return null;
}

// ---------- income & expense ----------
async function booksRoute(ctx) {
  const { env, url, user, rest, post, redirect, withMsg } = ctx;
  const m = isMonth(url.searchParams.get('m')) ? url.searchParams.get('m') : today().slice(0, 7);
  if (rest[0] === 'add' && post) {
    const f = await ctx.request.formData();
    const kind = f.get('kind') === 'in' ? 'in' : 'out';
    const day = isDay(String(f.get('day'))) ? String(f.get('day')) : today();
    const amount = int(f.get('amount'));
    const cats = kind === 'in' ? IN_CATS : OUT_CATS;
    const category = cats.includes(String(f.get('category'))) ? String(f.get('category')) : cats[cats.length - 1];
    const method = METHODS[f.get('method')] ? String(f.get('method')) : 'cash';
    const back = `/admin/books?m=${day.slice(0, 7)}`;
    if (amount <= 0) return redirect(withMsg(back, 'err', 'টাকার পরিমাণ লিখুন।'));
    await env.DB.prepare('INSERT INTO txns (kind, day, amount, category, method, party, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(kind, day, amount, category, method, str(f.get('party'), 120) || null, str(f.get('note'), 500) || null, user.username).run();
    return redirect(withMsg(back, 'ok', `${kind === 'in' ? 'আয়' : 'খরচ'} ${tk(amount)} যোগ হয়েছে।`));
  }
  if (rest[0] === 'del' && post) {
    const f = await ctx.request.formData();
    const row = await env.DB.prepare('SELECT * FROM txns WHERE id = ?').bind(int(f.get('id'))).first();
    if (row && row.receipt_id) return redirect(withMsg(`/admin/books?m=${m}`, 'err', 'এটা মানি রিসিট থেকে এসেছে। রিসিটটা বাতিল করুন।'));
    if (row) await env.DB.prepare('DELETE FROM txns WHERE id = ?').bind(row.id).run();
    return redirect(withMsg(`/admin/books?m=${row ? row.day.slice(0, 7) : m}`, 'ok', 'এন্ট্রি মুছে ফেলা হয়েছে।'));
  }
  const rows = (await env.DB.prepare('SELECT * FROM txns WHERE day LIKE ? ORDER BY day DESC, id DESC').bind(m + '-%').all()).results;
  if (rest[0] === 'csv') return booksCsv(m, rows);
  if (rest[0] === 'print') return ctx.html(printShell(`হিসাব ${monthName(m)}`, `<div class="dtitle"><h1>উড মেটাল · আয়-ব্যয়ের হিসাব</h1><div><b>${monthName(m)}</b></div></div>` + monthReport(m, rows, true)));
  return monthPage(ctx, m, rows);
}

function sums(rows) {
  const s = { in: 0, out: 0, byCat: { in: {}, out: {} }, byMethod: {} };
  for (const r of rows) {
    s[r.kind] += r.amount;
    s.byCat[r.kind][r.category] = (s.byCat[r.kind][r.category] || 0) + r.amount;
    const bm = (s.byMethod[r.method] ||= { in: 0, out: 0 });
    bm[r.kind] += r.amount;
  }
  return s;
}

function catTable(title, obj, total) {
  const list = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  if (!list.length) return `<div class="box"><b>${title}</b><p class="muted">এই মাসে কিছু নেই।</p></div>`;
  return `<div class="box"><b>${title}</b><table class="cat">${list.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${tk(v)}</td><td class="barc"><span style="width:${Math.max(2, Math.round((v / total) * 100))}%"></span></td></tr>`).join('')}</table></div>`;
}

function monthReport(m, rows, printing) {
  const s = sums(rows);
  const net = s.in - s.out;
  return `<div class="cards">
    <div class="card in"><span>মোট আয়</span><b>${tk(s.in)}</b></div>
    <div class="card out"><span>মোট খরচ</span><b>${tk(s.out)}</b></div>
    <div class="card net"><span>${net >= 0 ? 'লাভ' : 'ক্ষতি'}</span><b>${tk(Math.abs(net))}</b></div>
  </div>
  <div class="two">${catTable('আয় কোথা থেকে', s.byCat.in, s.in)}${catTable('খরচ কোথায়', s.byCat.out, s.out)}</div>
  <div class="box"><b>কোন মাধ্যমে কত</b><table><tr><th>মাধ্যম</th><th class="num">এসেছে</th><th class="num">গেছে</th><th class="num">ব্যালান্স</th></tr>
    ${Object.entries(s.byMethod).map(([k, v]) => `<tr><td>${METHODS[k] || esc(k)}</td><td class="num">${tk(v.in)}</td><td class="num">${tk(v.out)}</td><td class="num">${v.in - v.out < 0 ? '−' : ''}${tk(Math.abs(v.in - v.out))}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">কিছু নেই</td></tr>'}</table></div>
  <h2>সব এন্ট্রি (${rows.length})</h2>
  ${rows.length ? `<table class="tx"><tr><th>তারিখ</th><th>ধরন</th><th>বিবরণ</th><th class="hide-sm">মাধ্যম</th><th class="num">টাকা</th>${printing ? '' : '<th></th>'}</tr>
  ${rows.map((r) => `<tr class="${r.kind}"><td>${fmtDay(r.day)}</td><td>${r.kind === 'in' ? 'আয়' : 'খরচ'}</td><td><b>${esc(r.category)}</b>${r.party ? ` · ${esc(r.party)}` : ''}${r.note ? `<div class="muted">${esc(r.note)}</div>` : ''}${r.receipt_id ? `<div class="muted"><a href="/admin/receipts/view/${r.receipt_id}">মানি রিসিট দেখুন</a></div>` : ''}</td><td class="hide-sm">${METHODS[r.method] || esc(r.method)}</td><td class="num">${r.kind === 'out' ? '−' : '+'}${tk(r.amount)}</td>${printing ? '' : `<td>${r.receipt_id ? '' : `<form method="post" action="/admin/books/del?m=${m}" onsubmit="return confirm('এই এন্ট্রি মুছে ফেলবেন?')" class="inline"><input type="hidden" name="id" value="${r.id}"><button class="btn o s" title="মুছুন">✕</button></form>`}</td>`}</tr>`).join('')}</table>` : '<p class="muted">এই মাসে এখনো কোনো এন্ট্রি নেই।</p>'}`;
}

async function monthPage(ctx, m, rows) {
  const { env, url, user } = ctx;
  const year = m.slice(0, 4);
  const yr = (await env.DB.prepare("SELECT substr(day,1,7) m, kind, SUM(amount) t FROM txns WHERE day LIKE ? GROUP BY 1, 2").bind(year + '-%').all()).results;
  const ym = {}; for (const r of yr) (ym[r.m] ||= { in: 0, out: 0 })[r.kind] = r.t;
  const yIn = Object.values(ym).reduce((a, v) => a + v.in, 0), yOut = Object.values(ym).reduce((a, v) => a + v.out, 0);
  const catOpts = (list) => list.map((c) => `<option>${esc(c)}</option>`).join('');
  const body = `<h1>আয়-ব্যয়ের হিসাব</h1>
  <div class="bar"><a class="btn o s" href="/admin/books?m=${shiftMonth(m, -1)}">← আগের মাস</a><b style="font-size:18px">${monthName(m)}</b><a class="btn o s" href="/admin/books?m=${shiftMonth(m, 1)}">পরের মাস →</a>
    <span style="flex:1"></span><a class="btn o s" href="/admin/books/print?m=${m}" target="_blank">🖨 রিপোর্ট প্রিন্ট/PDF</a><a class="btn o s" href="/admin/books/csv?m=${m}">⬇ Excel (CSV)</a></div>
  <form class="box addtx" method="post" action="/admin/books/add">
    <div class="seg"><label><input type="radio" name="kind" value="out" checked> খরচ</label><label><input type="radio" name="kind" value="in"> আয়</label></div>
    <div class="grid">
      <label>তারিখ<input class="field" type="date" name="day" value="${m === today().slice(0, 7) ? today() : m + '-01'}" required></label>
      <label>টাকা<input class="field" name="amount" inputmode="numeric" placeholder="যেমন 2500" required></label>
      <label id="lab-out">খরচের খাত<select class="field" name="category" id="cat-out">${catOpts(OUT_CATS)}</select></label><label id="lab-in" hidden>আয়ের খাত<select class="field" name="category" id="cat-in" disabled>${catOpts(IN_CATS)}</select></label>
      <label>মাধ্যম<select class="field" name="method">${Object.entries(METHODS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label>কাকে/কার কাছ থেকে<input class="field" name="party" placeholder="যেমন: করিম টিম্বার"></label>
      <label>নোট<input class="field" name="note" placeholder="যেমন: সেগুন কাঠ ২০ সিএফটি"></label>
    </div>
    <button class="btn y" style="margin-top:12px">+ যোগ করুন</button>
    <p class="muted" style="margin:8px 0 0">মানি রিসিট দিলে আয় নিজে থেকেই এখানে যোগ হয়, আলাদা লিখতে হবে না।</p>
  </form>
  <script>(function(){var f=document.querySelector('.addtx'),o=document.getElementById('cat-out'),i=document.getElementById('cat-in');
  function sync(){var isIn=f.querySelector('[name=kind]:checked').value==='in';o.disabled=isIn;i.disabled=!isIn;document.getElementById('lab-out').hidden=isIn;document.getElementById('lab-in').hidden=!isIn;}
  f.addEventListener('change',function(e){if(e.target.name==='kind')sync();});sync();addEventListener('pageshow',sync);})();</script>
  ${monthReport(m, rows, false)}
  <h2>${year} সালের মাসওয়ারি হিসাব</h2>
  <table><tr><th>মাস</th><th class="num">আয়</th><th class="num">খরচ</th><th class="num">লাভ/ক্ষতি</th></tr>
  ${Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`).filter((k) => ym[k] || k === m).map((k) => { const v = ym[k] || { in: 0, out: 0 }; const n = v.in - v.out; return `<tr${k === m ? ' class="cur"' : ''}><td><a href="/admin/books?m=${k}">${monthName(k)}</a></td><td class="num">${tk(v.in)}</td><td class="num">${tk(v.out)}</td><td class="num">${n < 0 ? '−' : ''}${tk(Math.abs(n))}</td></tr>`; }).join('')}
  <tr class="tot"><td>মোট ${year}</td><td class="num">${tk(yIn)}</td><td class="num">${tk(yOut)}</td><td class="num">${yIn - yOut < 0 ? '−' : ''}${tk(Math.abs(yIn - yOut))}</td></tr></table>`;
  return ctx.page('হিসাব', BOOK_CSS + body, { user, on: 'books', ...ctx.flashOf(url) });
}

function booksCsv(m, rows) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Date', 'Type', 'Category', 'Method', 'Party', 'Note', 'Amount', 'Receipt'].join(',')];
  for (const r of rows.slice().reverse()) lines.push([r.day, r.kind === 'in' ? 'Income' : 'Expense', q(r.category), METHODS_EN[r.method] || r.method, q(r.party), q(r.note), r.kind === 'out' ? -r.amount : r.amount, r.receipt_id || ''].join(','));
  return new Response('﻿' + lines.join('\r\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="woodmetal-hisab-${m}.csv"`, 'cache-control': 'no-store' } });
}

// ---------- quotations ----------
async function quotesRoute(ctx) {
  const { env, url, user, rest, post, redirect, withMsg } = ctx;
  if (rest[0] === 'save' && post) return saveQuote(ctx);
  if (rest[0] === 'status' && post) {
    const f = await ctx.request.formData();
    const st = String(f.get('status'));
    if (Q_STATUS[st]) await env.DB.prepare("UPDATE quotes SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(st, int(f.get('id'))).run();
    return redirect(withMsg(String(f.get('back') || '/admin/quotes').startsWith('/admin/') ? String(f.get('back')) : '/admin/quotes', 'ok', 'অবস্থা বদলানো হয়েছে।'));
  }
  if (rest[0] === 'new') {
    let q = { day: today(), valid_days: 15, advance_pct: 50, items: [{ qty: 1 }], note: DEFAULT_TERMS, status: 'draft' };
    const leadId = int(url.searchParams.get('lead'));
    if (leadId) {
      const l = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(leadId).first();
      if (l) {
        const price = l.product_slug ? await productPrice(env, l.product_slug) : 0;
        q = { ...q, lead_id: l.id, customer: l.name, phone: l.phone, address: l.area || '', items: [{ desc: l.product_name || '', size: l.size || '', polish: l.polish || '', qty: 1, rate: price || '' }] };
      }
    }
    return quoteForm(ctx, q);
  }
  if (rest[0] === 'edit' && rest[1]) {
    const q = await env.DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(int(rest[1])).first();
    if (!q) return redirect(withMsg('/admin/quotes', 'err', 'কোটেশন পাওয়া যায়নি।'));
    return quoteForm(ctx, { ...q, items: parseItems(q.items) });
  }
  if (rest[0] === 'view' && rest[1]) {
    const q = await env.DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(int(rest[1])).first();
    if (!q) return redirect(withMsg('/admin/quotes', 'err', 'কোটেশন পাওয়া যায়নি।'));
    const paid = (await paidFor(env, [q.id]))[q.id] || 0;
    const recs = (await env.DB.prepare('SELECT id, no, day, amount, method FROM receipts WHERE quote_id = ? AND void = 0 ORDER BY id').bind(q.id).all()).results;
    return ctx.html(printShell(`কোটেশন ${q.no}`, quoteDoc(q, paid, recs), quoteTools(q, paid)));
  }
  // list
  const st = Q_STATUS[url.searchParams.get('status')] ? url.searchParams.get('status') : '';
  const qq = url.searchParams.get('q') ? str(url.searchParams.get('q'), 60) : '';
  let sql = 'SELECT * FROM quotes', args = [], where = [];
  if (st) { where.push('status = ?'); args.push(st); }
  if (qq) { where.push('(customer LIKE ? OR phone LIKE ? OR no LIKE ?)'); args.push(`%${qq}%`, `%${qq}%`, `%${qq}%`); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  const list = (await env.DB.prepare(sql + ' ORDER BY id DESC LIMIT 200').bind(...args).all()).results;
  const paid = await paidFor(env, list.map((q) => q.id));
  const body = `<h1>কোটেশন</h1>
  <div class="bar"><a class="btn y" href="/admin/quotes/new">+ নতুন কোটেশন</a>
    <form class="inline" method="get" action="/admin/quotes"><input class="field" name="q" value="${esc(qq)}" placeholder="নাম, ফোন বা নম্বর" style="width:200px"><button class="btn o s">খুঁজুন</button></form>
    <a class="btn ${st ? 'o' : ''} s" href="/admin/quotes">সব</a>${Object.entries(Q_STATUS).map(([k, v]) => `<a class="btn ${st === k ? '' : 'o'} s" href="/admin/quotes?status=${k}">${v}</a>`).join('')}</div>
  ${list.length ? `<table><tr><th>নম্বর</th><th>ক্রেতা</th><th class="num">মোট</th><th class="num hide-sm">পেয়েছি</th><th class="num">বাকি</th><th class="hide-sm">অবস্থা</th><th></th></tr>
  ${list.map((q) => { const t = quoteTotals(q); const p = paid[q.id] || 0; return `<tr class="${q.status === 'cancelled' ? 'off' : ''}"><td><a href="/admin/quotes/view/${q.id}"><b>${esc(q.no)}</b></a><div class="muted">${fmtDay(q.day)}</div></td><td>${esc(q.customer)}<div class="muted">${esc(q.phone)}</div></td><td class="num">${tk(t.total)}</td><td class="num hide-sm">${tk(p)}</td><td class="num">${q.status === 'cancelled' ? '—' : tk(Math.max(0, t.total - p))}</td><td class="hide-sm"><span class="pill st-${q.status}">${Q_STATUS[q.status] || esc(q.status)}</span></td><td><a class="btn o s" href="/admin/quotes/view/${q.id}">দেখুন</a> <a class="btn o s" href="/admin/quotes/edit/${q.id}">এডিট</a></td></tr>`; }).join('')}</table>` : '<p class="muted">এখনো কোনো কোটেশন নেই।</p>'}`;
  return ctx.page('কোটেশন', BOOK_CSS + body, { user, on: 'quotes', ...ctx.flashOf(url) });
}

async function productPrice(env, slug) {
  const r = await env.DB.prepare('SELECT data FROM products WHERE slug = ?').bind(slug).first();
  try { return r ? JSON.parse(r.data).price || 0 : 0; } catch { return 0; }
}

async function quoteForm(ctx, q) {
  const { env, user, url } = ctx;
  const prods = (await env.DB.prepare('SELECT data FROM products WHERE hidden = 0 ORDER BY sort, slug').all()).results
    .map((r) => { try { const p = JSON.parse(r.data); return { n: `${catBySlug[p.cat]?.one.bn ?? p.cat} ${p.model ?? ''} (${p.code || p.slug})`, s: p.size || '', r: p.price || 0 }; } catch { return null; } }).filter(Boolean);
  const items = q.items && q.items.length ? q.items : [{ qty: 1 }];
  const row = (it = {}) => `<tr class="it"><td><input class="field" name="desc" list="plist" value="${esc(it.desc)}" placeholder="পণ্যের নাম লিখুন বা বেছে নিন"></td><td><input class="field" name="size" value="${esc(it.size)}" placeholder="মাপ"></td><td><input class="field" name="polish" value="${esc(it.polish)}" placeholder="পালিশ/কাপড়"></td><td><input class="field q" name="qty" inputmode="numeric" value="${esc(it.qty ?? 1)}" style="width:64px"></td><td><input class="field r" name="rate" inputmode="numeric" value="${esc(it.rate)}" style="width:110px"></td><td class="num amt"></td><td><button type="button" class="btn o s del" title="সরান">✕</button></td></tr>`;
  const body = `<h1>${q.id ? `কোটেশন ${esc(q.no)} এডিট` : 'নতুন কোটেশন'}</h1>
  <form method="post" action="/admin/quotes/save" id="qf">
    ${q.id ? `<input type="hidden" name="id" value="${q.id}">` : ''}${q.lead_id ? `<input type="hidden" name="lead_id" value="${q.lead_id}">` : ''}
    <div class="box"><b>ক্রেতা</b><div class="grid" style="margin-top:8px">
      <label>নাম<input class="field" name="customer" value="${esc(q.customer)}" required></label>
      <label>ফোন<input class="field" name="phone" value="${esc(q.phone)}" inputmode="tel"></label>
      <label>ঠিকানা<input class="field" name="address" value="${esc(q.address)}"></label>
      <label>তারিখ<input class="field" type="date" name="day" value="${esc(q.day || today())}"></label>
    </div></div>
    <div class="box"><b>পণ্য</b>
      <div style="overflow-x:auto"><table class="items"><thead><tr><th>বিবরণ</th><th>মাপ</th><th>পালিশ</th><th>সংখ্যা</th><th>দর (৳)</th><th class="num">মোট</th><th></th></tr></thead>
      <tbody>${items.map(row).join('')}</tbody></table></div>
      <button type="button" class="btn o s" id="addrow" style="margin-top:8px">+ আরেকটা পণ্য</button>
      <datalist id="plist">${prods.map((p) => `<option value="${esc(p.n)}">`).join('')}</datalist>
    </div>
    <div class="box"><div class="grid">
      <label>ছাড় (৳)<input class="field" name="discount" inputmode="numeric" value="${esc(q.discount || '')}"></label>
      <label>ডেলিভারি চার্জ (৳)<input class="field" name="delivery" inputmode="numeric" value="${esc(q.delivery || '')}"></label>
      <label>অগ্রিম (%)<input class="field" name="advance_pct" inputmode="numeric" value="${esc(q.advance_pct ?? 50)}"></label>
      <label>বানাতে সময়<input class="field" name="days_to_make" value="${esc(q.days_to_make || '')}" placeholder="যেমন: ২০-২৫ দিন"></label>
      <label>কোটেশন কতদিন চলবে<input class="field" name="valid_days" inputmode="numeric" value="${esc(q.valid_days ?? 15)}"></label>
      <label>অবস্থা<select class="field" name="status">${Object.entries(Q_STATUS).map(([k, v]) => `<option value="${k}"${k === (q.status || 'draft') ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>
    <div class="totals"><div>সাবটোটাল <b id="t-sub">৳ 0</b></div><div>মোট <b id="t-tot">৳ 0</b></div><div>অগ্রিম <b id="t-adv">৳ 0</b></div></div>
    <label style="display:block;margin-top:10px;font-weight:600">শর্তাবলি / নোট<textarea class="field" name="note" rows="4">${esc(q.note || '')}</textarea></label></div>
    <button class="btn y">সেভ করে দেখুন</button> <a class="btn o" href="/admin/quotes">বাতিল</a>
  </form>
  <template id="rowtpl">${row()}</template>
  <script>(function(){var P=${JSON.stringify(prods).replace(/</g, '\\u003c')};var f=document.getElementById('qf'),tb=f.querySelector('tbody');
  function n(v){v=String(v||'').replace(/[০-৯]/g,function(d){return '০১২৩৪৫৬৭৮৯'.indexOf(d)}).replace(/[^0-9.]/g,'');return Math.round(Number(v)||0);}
  function tk(v){return '৳ '+v.toLocaleString('en-IN');}
  function calc(){var sub=0;tb.querySelectorAll('tr.it').forEach(function(r){var a=n(r.querySelector('.q').value)*n(r.querySelector('.r').value);sub+=a;r.querySelector('.amt').textContent=a?tk(a):'';});
    var tot=Math.max(0,sub-n(f.discount.value)+n(f.delivery.value));document.getElementById('t-sub').textContent=tk(sub);document.getElementById('t-tot').textContent=tk(tot);document.getElementById('t-adv').textContent=tk(Math.round(tot*n(f.advance_pct.value)/100));}
  f.addEventListener('input',function(e){if(e.target.name==='desc'){var p=P.find(function(x){return x.n===e.target.value});if(p){var r=e.target.closest('tr');if(!r.querySelector('.r').value)r.querySelector('.r').value=p.r;if(!r.querySelector('[name=size]').value)r.querySelector('[name=size]').value=p.s;}}calc();});
  document.getElementById('addrow').addEventListener('click',function(){tb.insertAdjacentHTML('beforeend',document.getElementById('rowtpl').innerHTML);calc();});
  tb.addEventListener('click',function(e){if(e.target.classList.contains('del')){if(tb.querySelectorAll('tr.it').length>1)e.target.closest('tr').remove();else e.target.closest('tr').querySelectorAll('input').forEach(function(i){i.value=i.name==='qty'?1:''});calc();}});
  calc();})();</script>`;
  return ctx.page(q.id ? 'কোটেশন এডিট' : 'নতুন কোটেশন', BOOK_CSS + body, { user, on: 'quotes', ...ctx.flashOf(url) });
}

async function saveQuote(ctx) {
  const { env, user, redirect, withMsg } = ctx;
  const f = await ctx.request.formData();
  const desc = f.getAll('desc'), size = f.getAll('size'), polish = f.getAll('polish'), qty = f.getAll('qty'), rate = f.getAll('rate');
  const items = desc.map((d, i) => ({ desc: str(d, 200), size: str(size[i], 80), polish: str(polish[i], 80), qty: Math.max(1, int(qty[i]) || 1), rate: int(rate[i]) }))
    .filter((it) => it.desc || it.rate).slice(0, 40);
  const customer = str(f.get('customer'), 120);
  if (!customer || !items.length) return redirect(withMsg(f.get('id') ? `/admin/quotes/edit/${int(f.get('id'))}` : '/admin/quotes/new', 'err', 'ক্রেতার নাম আর অন্তত একটা পণ্য লিখুন।'));
  const day = isDay(String(f.get('day'))) ? String(f.get('day')) : today();
  const status = Q_STATUS[f.get('status')] ? String(f.get('status')) : 'draft';
  const vals = [day, Math.min(365, Math.max(1, int(f.get('valid_days')) || 15)), customer, str(f.get('phone'), 30) || null, str(f.get('address'), 300) || null, JSON.stringify(items),
    Math.max(0, int(f.get('discount'))), Math.max(0, int(f.get('delivery'))), Math.min(100, Math.max(0, int(f.get('advance_pct')))), str(f.get('days_to_make'), 60) || null, str(f.get('note'), 2000) || null, status];
  let id = int(f.get('id'));
  if (id) {
    await env.DB.prepare("UPDATE quotes SET day=?, valid_days=?, customer=?, phone=?, address=?, items=?, discount=?, delivery=?, advance_pct=?, days_to_make=?, note=?, status=?, updated_at=datetime('now') WHERE id = ?").bind(...vals, id).run();
  } else {
    const no = await nextNo(env, 'quote', 'Q', day);
    const r = await env.DB.prepare('INSERT INTO quotes (day, valid_days, customer, phone, address, items, discount, delivery, advance_pct, days_to_make, note, status, no, lead_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id')
      .bind(...vals, no, int(f.get('lead_id')) || null, user.username).first();
    id = r.id;
    if (int(f.get('lead_id'))) await env.DB.prepare("UPDATE leads SET status = 'contacted' WHERE id = ? AND status = 'new'").bind(int(f.get('lead_id'))).run();
  }
  return redirect(`/admin/quotes/view/${id}`);
}

function quoteDoc(q, paid, recs) {
  const t = quoteTotals(q);
  const due = Math.max(0, t.total - paid);
  return `${docHead('কোটেশন / QUOTATION', q.no, q.day)}
  <div class="parties"><div><span class="k">ক্রেতা</span><b>${esc(q.customer)}</b>${q.phone ? `<div>${esc(q.phone)}</div>` : ''}${q.address ? `<div>${esc(q.address)}</div>` : ''}</div>
    <div class="r"><span class="k">কোটেশনের মেয়াদ</span><b>${fmtDay(addDays(q.day, q.valid_days || 15))} পর্যন্ত</b>${q.days_to_make ? `<div>বানাতে সময়: ${esc(q.days_to_make)}</div>` : ''}</div></div>
  <table class="doc"><thead><tr><th>#</th><th>বিবরণ</th><th>মাপ</th><th>পালিশ</th><th class="num">সংখ্যা</th><th class="num">দর</th><th class="num">মোট</th></tr></thead>
  <tbody>${t.items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.desc)}</td><td>${esc(it.size)}</td><td>${esc(it.polish)}</td><td class="num">${int(it.qty)}</td><td class="num">${tk(it.rate)}</td><td class="num">${tk(int(it.qty) * int(it.rate))}</td></tr>`).join('')}</tbody></table>
  <table class="sum">
    <tr><td>সাবটোটাল</td><td class="num">${tk(t.subtotal)}</td></tr>
    ${int(q.discount) ? `<tr><td>ছাড়</td><td class="num">− ${tk(q.discount)}</td></tr>` : ''}
    ${int(q.delivery) ? `<tr><td>ডেলিভারি চার্জ</td><td class="num">${tk(q.delivery)}</td></tr>` : ''}
    <tr class="big"><td>সর্বমোট</td><td class="num">${tk(t.total)}</td></tr>
    ${int(q.advance_pct) ? `<tr><td>অগ্রিম (${int(q.advance_pct)}%)</td><td class="num">${tk(t.advance)}</td></tr>` : ''}
    ${paid ? `<tr><td>পরিশোধ হয়েছে</td><td class="num">${tk(paid)}</td></tr><tr class="big"><td>বাকি</td><td class="num">${tk(due)}</td></tr>` : ''}
  </table>
  <p class="words">কথায়: ${inWords(t.total)}</p>
  ${recs.length ? `<p class="muted">টাকা পাওয়া গেছে: ${recs.map((r) => `${esc(r.no)} (${fmtDay(r.day)}, ${tk(r.amount)})`).join(', ')}</p>` : ''}
  ${q.note ? `<div class="terms"><b>শর্তাবলি</b><ul>${esc(q.note).split('\n').filter((l) => l.trim()).map((l) => `<li>${l}</li>`).join('')}</ul></div>` : ''}
  ${docSign('ক্রেতার স্বাক্ষর', 'উড মেটালের পক্ষে')}`;
}

function quoteTools(q, paid) {
  const t = quoteTotals(q);
  const wa = q.phone ? String(q.phone).replace(/[^0-9]/g, '').replace(/^0/, '880') : '';
  const msg = `আসসালামু আলাইকুম ${q.customer},\nউড মেটাল থেকে আপনার কোটেশন ${q.no}:\n${t.items.map((it) => `• ${it.desc}${it.size ? ` (${it.size})` : ''} × ${int(it.qty)} = ${tk(int(it.qty) * int(it.rate))}`).join('\n')}\nসর্বমোট: ${tk(t.total)}${int(q.advance_pct) ? `\nঅগ্রিম (${int(q.advance_pct)}%): ${tk(t.advance)}` : ''}\nধন্যবাদ।\nউড মেটাল, ${SITE.phones}`;
  return `<a class="btn y" href="#" onclick="print();return false">🖨 প্রিন্ট / PDF</a>
    ${wa ? `<a class="btn g" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">WhatsApp-এ পাঠান</a>` : ''}
    <a class="btn" href="/admin/receipts/new?quote=${q.id}">+ টাকা পেলাম (মানি রিসিট)</a>
    <a class="btn o" href="/admin/quotes/edit/${q.id}">এডিট</a>
    <form method="post" action="/admin/quotes/status" class="inline"><input type="hidden" name="id" value="${q.id}"><input type="hidden" name="back" value="/admin/quotes/view/${q.id}">
      <select name="status" class="field" style="width:auto">${Object.entries(Q_STATUS).map(([k, v]) => `<option value="${k}"${k === q.status ? ' selected' : ''}>${v}</option>`).join('')}</select><button class="btn o">সেভ</button></form>
    <a class="btn o" href="/admin/quotes">← তালিকা</a>${paid >= t.total && t.total ? '<span class="paidtag">পুরো টাকা পরিশোধ</span>' : ''}`;
}

// ---------- money receipts ----------
async function receiptsRoute(ctx) {
  const { env, url, user, rest, post, redirect, withMsg } = ctx;
  if (rest[0] === 'save' && post) return saveReceipt(ctx);
  if (rest[0] === 'void' && post) {
    if (user.role !== 'super') return redirect(withMsg('/admin/receipts', 'err', 'রিসিট বাতিল শুধু সুপার অ্যাডমিন করতে পারেন।'));
    const f = await ctx.request.formData();
    const id = int(f.get('id'));
    await env.DB.batch([
      env.DB.prepare('UPDATE receipts SET void = 1 WHERE id = ?').bind(id),
      env.DB.prepare('DELETE FROM txns WHERE receipt_id = ?').bind(id),
    ]);
    return redirect(withMsg(`/admin/receipts/view/${id}`, 'ok', 'রিসিট বাতিল হয়েছে, হিসাব থেকেও বাদ গেছে।'));
  }
  if (rest[0] === 'new') {
    let r = { day: today(), method: 'cash' }, q = null, due = 0;
    const qid = int(url.searchParams.get('quote'));
    if (qid) {
      q = await env.DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(qid).first();
      if (q) {
        const t = quoteTotals(q); const paid = (await paidFor(env, [q.id]))[q.id] || 0; due = Math.max(0, t.total - paid);
        r = { ...r, quote_id: q.id, customer: q.customer, phone: q.phone, address: q.address, amount: paid ? due : t.advance || t.total, purpose: `${paid ? 'বাকি পরিশোধ' : 'অগ্রিম'}, কোটেশন ${q.no}`, category: paid ? 'বিক্রি (বাকি পরিশোধ)' : 'বিক্রি (অগ্রিম)' };
      }
    }
    return receiptForm(ctx, r, q, due);
  }
  if (rest[0] === 'view' && rest[1]) {
    const r = await env.DB.prepare('SELECT * FROM receipts WHERE id = ?').bind(int(rest[1])).first();
    if (!r) return redirect(withMsg('/admin/receipts', 'err', 'রিসিট পাওয়া যায়নি।'));
    let q = null, totals = null, paid = 0;
    if (r.quote_id) {
      q = await env.DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(r.quote_id).first();
      if (q) { totals = quoteTotals(q); paid = (await env.DB.prepare('SELECT SUM(amount) p FROM receipts WHERE quote_id = ? AND void = 0 AND id <= ?').bind(q.id, r.id).first()).p || 0; }
    }
    const flash = ctx.flashOf(url);
    return ctx.html(printShell(`মানি রিসিট ${r.no}`, receiptDoc(r, q, totals, paid), receiptTools(r, user), flash.flash || flash.err));
  }
  const qq = url.searchParams.get('q') ? str(url.searchParams.get('q'), 60) : '';
  const list = (await (qq
    ? env.DB.prepare('SELECT * FROM receipts WHERE customer LIKE ? OR phone LIKE ? OR no LIKE ? ORDER BY id DESC LIMIT 200').bind(`%${qq}%`, `%${qq}%`, `%${qq}%`)
    : env.DB.prepare('SELECT * FROM receipts ORDER BY id DESC LIMIT 200')).all()).results;
  const body = `<h1>মানি রিসিট</h1>
  <div class="bar"><a class="btn y" href="/admin/receipts/new">+ নতুন মানি রিসিট</a>
    <form class="inline" method="get" action="/admin/receipts"><input class="field" name="q" value="${esc(qq)}" placeholder="নাম, ফোন বা নম্বর" style="width:200px"><button class="btn o s">খুঁজুন</button></form></div>
  ${list.length ? `<table><tr><th>নম্বর</th><th>ক্রেতা</th><th class="num">টাকা</th><th class="hide-sm">মাধ্যম</th><th class="hide-sm">কিসের জন্য</th><th></th></tr>
  ${list.map((r) => `<tr class="${r.void ? 'off' : ''}"><td><a href="/admin/receipts/view/${r.id}"><b>${esc(r.no)}</b></a><div class="muted">${fmtDay(r.day)}</div></td><td>${esc(r.customer)}<div class="muted">${esc(r.phone)}</div></td><td class="num">${r.void ? '<s>' : ''}${tk(r.amount)}${r.void ? '</s> বাতিল' : ''}</td><td class="hide-sm">${METHODS[r.method] || esc(r.method)}</td><td class="hide-sm">${esc(r.purpose)}</td><td><a class="btn o s" href="/admin/receipts/view/${r.id}">দেখুন</a></td></tr>`).join('')}</table>` : '<p class="muted">এখনো কোনো রিসিট নেই।</p>'}`;
  return ctx.page('মানি রিসিট', BOOK_CSS + body, { user, on: 'receipts', ...ctx.flashOf(url) });
}

function receiptForm(ctx, r, q, due) {
  const { user, url } = ctx;
  const body = `<h1>নতুন মানি রিসিট</h1>
  ${q ? `<div class="box">কোটেশন <a href="/admin/quotes/view/${q.id}"><b>${esc(q.no)}</b></a> · সর্বমোট ${tk(quoteTotals(q).total)} · এখনো বাকি <b>${tk(due)}</b></div>` : ''}
  <form method="post" action="/admin/receipts/save" class="box">
    ${q ? `<input type="hidden" name="quote_id" value="${q.id}">` : ''}
    <div class="grid">
      <label>ক্রেতার নাম<input class="field" name="customer" value="${esc(r.customer)}" required></label>
      <label>ফোন<input class="field" name="phone" value="${esc(r.phone)}" inputmode="tel"></label>
      <label>ঠিকানা<input class="field" name="address" value="${esc(r.address)}"></label>
      <label>তারিখ<input class="field" type="date" name="day" value="${esc(r.day)}" required></label>
      <label>টাকা<input class="field" name="amount" inputmode="numeric" value="${esc(r.amount || '')}" required></label>
      <label>মাধ্যম<select class="field" name="method">${Object.entries(METHODS).map(([k, v]) => `<option value="${k}"${k === r.method ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>কিসের জন্য<input class="field" name="purpose" value="${esc(r.purpose)}" placeholder="যেমন: খাট ৫৪৭ এর অগ্রিম"></label>
      <label>হিসাবের খাত<select class="field" name="category">${IN_CATS.map((c) => `<option${c === (r.category || IN_CATS[0]) ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label>নোট (ঐচ্ছিক)<input class="field" name="note" placeholder="যেমন: বিকাশ TrxID"></label>
    </div>
    <button class="btn y" style="margin-top:12px">সেভ করে রিসিট দেখুন</button> <a class="btn o" href="/admin/receipts">বাতিল</a>
    <p class="muted" style="margin:8px 0 0">সেভ করলে এই টাকা আয়ের হিসাবে নিজে থেকেই যোগ হবে।</p>
  </form>`;
  return ctx.page('নতুন মানি রিসিট', BOOK_CSS + body, { user, on: 'receipts', ...ctx.flashOf(url) });
}

async function saveReceipt(ctx) {
  const { env, user, redirect, withMsg } = ctx;
  const f = await ctx.request.formData();
  const amount = int(f.get('amount'));
  const customer = str(f.get('customer'), 120);
  const quoteId = int(f.get('quote_id')) || null;
  if (amount <= 0 || !customer) return redirect(withMsg('/admin/receipts/new' + (quoteId ? `?quote=${quoteId}` : ''), 'err', 'ক্রেতার নাম আর টাকার পরিমাণ লিখুন।'));
  const day = isDay(String(f.get('day'))) ? String(f.get('day')) : today();
  const method = METHODS[f.get('method')] ? String(f.get('method')) : 'cash';
  const category = IN_CATS.includes(String(f.get('category'))) ? String(f.get('category')) : IN_CATS[0];
  const purpose = str(f.get('purpose'), 200) || null;
  const no = await nextNo(env, 'receipt', 'MR', day);
  const r = await env.DB.prepare('INSERT INTO receipts (no, day, customer, phone, address, amount, method, purpose, quote_id, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id')
    .bind(no, day, customer, str(f.get('phone'), 30) || null, str(f.get('address'), 300) || null, amount, method, purpose, quoteId, str(f.get('note'), 300) || null, user.username).first();
  const stmts = [env.DB.prepare('INSERT INTO txns (kind, day, amount, category, method, party, note, receipt_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind('in', day, amount, category, method, customer, [no, purpose].filter(Boolean).join(' · '), r.id, user.username)];
  if (quoteId) stmts.push(env.DB.prepare("UPDATE quotes SET status = 'accepted', updated_at = datetime('now') WHERE id = ? AND status IN ('draft', 'sent')").bind(quoteId));
  await env.DB.batch(stmts);
  return redirect(`/admin/receipts/view/${r.id}`);
}

function receiptDoc(r, q, totals, paid) {
  return `${r.void ? '<div class="voidmark">বাতিল / VOID</div>' : ''}${docHead('মানি রিসিট / MONEY RECEIPT', r.no, r.day)}
  <table class="rec">
    <tr><td class="lb">যার কাছ থেকে পেলাম<br><small>Received with thanks from</small></td><td><b>${esc(r.customer)}</b>${r.phone ? ` · ${esc(r.phone)}` : ''}${r.address ? `<div>${esc(r.address)}</div>` : ''}</td></tr>
    <tr><td class="lb">টাকার পরিমাণ<br><small>Amount</small></td><td><b class="amt">${tk(r.amount)}</b></td></tr>
    <tr><td class="lb">কথায়<br><small>In words</small></td><td>${inWords(r.amount)}</td></tr>
    <tr><td class="lb">মাধ্যম<br><small>Payment by</small></td><td>${METHODS[r.method] || esc(r.method)} / ${METHODS_EN[r.method] || esc(r.method)}${r.note ? ` · ${esc(r.note)}` : ''}</td></tr>
    ${r.purpose ? `<tr><td class="lb">কিসের জন্য<br><small>For</small></td><td>${esc(r.purpose)}</td></tr>` : ''}
  </table>
  ${totals ? `<table class="sum"><tr><td>অর্ডারের সর্বমোট (${esc(q.no)})</td><td class="num">${tk(totals.total)}</td></tr><tr><td>এ পর্যন্ত পরিশোধ</td><td class="num">${tk(paid)}</td></tr><tr class="big"><td>বাকি</td><td class="num">${tk(Math.max(0, totals.total - paid))}</td></tr></table>` : ''}
  ${docSign('ক্রেতার স্বাক্ষর', 'গ্রহণকারীর স্বাক্ষর')}`;
}

function receiptTools(r, user) {
  const wa = r.phone ? String(r.phone).replace(/[^0-9]/g, '').replace(/^0/, '880') : '';
  const msg = `আসসালামু আলাইকুম ${r.customer},\nউড মেটাল আপনার কাছ থেকে ${tk(r.amount)} (${METHODS[r.method] || r.method}) পেয়েছে। মানি রিসিট নম্বর ${r.no}, তারিখ ${fmtDay(r.day)}।${r.purpose ? `\n${r.purpose}` : ''}\nধন্যবাদ।\nউড মেটাল, ${SITE.phones}`;
  return `<a class="btn y" href="#" onclick="print();return false">🖨 প্রিন্ট / PDF</a>
    ${wa && !r.void ? `<a class="btn g" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">WhatsApp-এ পাঠান</a>` : ''}
    ${r.quote_id ? `<a class="btn o" href="/admin/quotes/view/${r.quote_id}">কোটেশন দেখুন</a>` : ''}
    <a class="btn o" href="/admin/receipts">← তালিকা</a>
    ${user.role === 'super' && !r.void ? `<form method="post" action="/admin/receipts/void" class="inline" onsubmit="return confirm('এই রিসিট বাতিল করবেন? হিসাব থেকেও টাকাটা বাদ যাবে।')"><input type="hidden" name="id" value="${r.id}"><button class="btn r">রিসিট বাতিল</button></form>` : ''}`;
}

// ---------- printable documents ----------
function docHead(title, no, day) {
  return `<div class="dhead"><img src="/img/logo.png" alt="Wood Metal" class="dlogo"><div class="dshop"><b>${SITE.nameBn} · ${SITE.name}</b><div>হাতে গড়া ফার্নিচার, ২০০০ সাল থেকে</div><div>${esc(SITE.address)}</div><div>${SITE.phones} · ${SITE.web}</div></div></div>
  <div class="dtitle"><h1>${title}</h1><div><span>নম্বর: <b>${esc(no)}</b></span><span>তারিখ: <b>${fmtDay(day)}</b></span></div></div>`;
}
function docSign(left, right) {
  return `<div class="signs"><div>${left}</div><div>${right}</div></div><p class="thanks">উড মেটাল থেকে কেনার জন্য ধন্যবাদ।</p>`;
}
function printShell(title, doc, tools = '', note = '') {
  return `<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} · Wood Metal</title>
<link rel="icon" href="/favicon-48.png"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap">
<style>${PRINT_CSS}</style></head><body>${tools ? `<div class="tools">${tools}</div>` : `<div class="tools"><a class="btn y" href="#" onclick="print();return false">🖨 প্রিন্ট / PDF</a><a class="btn o" href="javascript:history.back()">← ফিরে যান</a></div>`}
${note ? `<div class="note">${esc(note)}</div>` : ''}<div class="paper">${doc}</div></body></html>`;
}

const BOOK_CSS = `<style>
.num{text-align:right;white-space:nowrap}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:6px 0 14px}
.card{background:#fff;border:1.5px solid #EDEDED;border-radius:10px;padding:12px 16px}.card span{display:block;color:#666;font-size:14px}.card b{font-size:26px}
.card.in{border-left:6px solid #FECC2F}.card.out{border-left:6px solid #343434}.card.net{border-left:6px solid #C38820}
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}.two .box{margin:0}
table.cat{border:0;margin-top:6px}.cat td{padding:5px 6px}.barc{width:35%}.barc span{display:block;height:10px;background:#C38820;border-radius:5px}
tr.in td:last-child,tr.in td.num{color:#111}tr.out td.num{color:#343434}
tr.cur td{background:#F5F5F5;font-weight:600}tr.tot td{font-weight:700;border-top:2px solid #111}
.seg{display:flex;gap:8px;margin-bottom:10px}.seg label{display:flex;gap:6px;align-items:center;border:1.5px solid #111;border-radius:6px;padding:4px 14px;cursor:pointer;font-weight:600}
.seg label:has(input:checked){background:#FECC2F;border-color:#FECC2F}
.items td{padding:4px}.items .field{min-width:90px}.items td:first-child .field{min-width:220px}
.totals{display:flex;flex-wrap:wrap;gap:8px 24px;margin-top:12px;font-size:17px}.totals b{font-size:20px}
.pill.st-draft{background:#D1D1D1;color:#111}.pill.st-sent{background:#C1AB86;color:#111}.pill.st-accepted{background:#FECC2F;color:#111}.pill.st-delivered{background:#111}.pill.st-cancelled{background:#EDEDED;color:#666}
</style>`;

const PRINT_CSS = `
*{box-sizing:border-box}body{margin:0;background:#EDEDED;font:15px/1.5 'Hind Siliguri',system-ui,sans-serif;color:#111}
.tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;padding:12px;background:#111;position:sticky;top:0;z-index:2}
.btn{display:inline-flex;align-items:center;gap:6px;min-height:38px;background:#111;color:#fff;border:1.5px solid #666;padding:6px 14px;border-radius:6px;text-decoration:none;cursor:pointer;font:inherit;font-weight:600}
.btn.y{background:#FECC2F;color:#111;border-color:#FECC2F}.btn.g{background:#C38820;color:#111;border-color:#C38820}.btn.o{background:#fff;color:#111;border-color:#fff}.btn.r{background:#343434;border-color:#343434}
.field{min-height:38px;border-radius:6px;border:1px solid #D1D1D1;padding:4px 8px;font:inherit}.inline{display:inline-flex;gap:6px;margin:0}
.paidtag{background:#FECC2F;color:#111;border-radius:99px;padding:4px 12px;font-weight:700}
.note{max-width:820px;margin:12px auto 0;background:#fff;border:1.5px solid #FECC2F;border-radius:8px;padding:10px 14px}
.paper{position:relative;max-width:820px;margin:16px auto 40px;background:#fff;padding:36px 40px;border-radius:4px;box-shadow:0 4px 24px rgba(0,0,0,.08);overflow:hidden}
.paper::before{content:"";position:absolute;left:0;right:0;top:0;height:8px;background:linear-gradient(90deg,#C38820,#FECC2F,#C38820)}
.dhead{display:flex;gap:18px;align-items:center;border-bottom:2px solid #111;padding-bottom:14px}.dlogo{width:84px;height:auto}
.dshop{font-size:13px;color:#343434}.dshop b{font-size:20px;color:#111}
.dtitle{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:8px;margin:16px 0}.dtitle h1{margin:0;font-size:22px;letter-spacing:.5px}.dtitle div{display:flex;gap:18px}
.parties{display:flex;justify-content:space-between;gap:16px;margin-bottom:14px}.parties .k,.k{display:block;color:#666;font-size:13px}.parties b{font-size:17px}.parties .r{text-align:right}
table{width:100%;border-collapse:collapse}th,td{padding:8px 10px;text-align:left;vertical-align:top}.num{text-align:right;white-space:nowrap}
table.doc th{background:#111;color:#fff;font-weight:600;font-size:14px}table.doc td{border-bottom:1px solid #EDEDED}table.doc tbody tr:nth-child(even) td{background:#F5F5F5}
table.sum{width:auto;min-width:300px;margin:12px 0 0 auto}table.sum td{border-bottom:1px solid #EDEDED}table.sum tr.big td{font-weight:700;font-size:17px;border-top:2px solid #111;border-bottom:0}
table.rec td{border-bottom:1px solid #EDEDED;padding:12px 10px}table.rec td.lb{width:34%;color:#343434}table.rec small{color:#666}.amt{font-size:24px}
.words{font-style:italic;color:#343434;margin:12px 0}
.terms{margin-top:18px;font-size:14px;background:#F5F5F5;border-left:4px solid #C38820;padding:10px 14px}.terms ul{margin:6px 0 0;padding-left:18px}
.signs{display:flex;justify-content:space-between;gap:40px;margin-top:64px}.signs div{flex:1;border-top:1.5px solid #111;padding-top:6px;text-align:center;font-size:14px;color:#343434}
.thanks{text-align:center;color:#666;font-size:13px;margin:22px 0 0}
.voidmark{position:absolute;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-18deg);font-size:72px;font-weight:700;color:rgba(52,52,52,.15);border:6px solid rgba(52,52,52,.15);padding:0 24px;white-space:nowrap;pointer-events:none}
.muted{color:#666;font-size:13px}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:6px 0 14px}.card{border:1.5px solid #EDEDED;border-radius:8px;padding:10px 14px}.card span{display:block;color:#666;font-size:13px}.card b{font-size:22px}
.card.in{border-left:6px solid #FECC2F}.card.out{border-left:6px solid #343434}.card.net{border-left:6px solid #C38820}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.box{border:1.5px solid #EDEDED;border-radius:8px;padding:10px 14px;margin-bottom:10px}
.cat td,.tx td{border-bottom:1px solid #EDEDED;padding:5px 6px}.barc{width:30%}.barc span{display:block;height:8px;background:#C38820;border-radius:4px}.tx th{background:#F5F5F5}
.hide-sm{}h2{font-size:17px}
@media(max-width:640px){.paper{padding:24px 16px;margin:0 0 20px;border-radius:0}.parties{flex-direction:column}.parties .r{text-align:left}.dlogo{width:60px}table.doc th:nth-child(4),table.doc td:nth-child(4){display:none}.cards,.two{grid-template-columns:1fr}}
@media print{body{background:#fff}.tools,.note{display:none}.paper{box-shadow:none;margin:0;max-width:none;padding:0 4mm}.paper::before{display:none}@page{size:A4;margin:12mm}
  table.doc th{-webkit-print-color-adjust:exact;print-color-adjust:exact}.card,.terms,.barc span,table.doc tbody tr:nth-child(even) td{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;
