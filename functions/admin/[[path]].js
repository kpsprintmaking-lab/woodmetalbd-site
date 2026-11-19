// /admin : password-protected list of website leads (quote / custom / contact).
// Login: any username, password = ADMIN_PASSWORD (set as a secret in Cloudflare Pages).
//   /admin/                 list (filter ?status=new|contacted|done)
//   /admin/photo/<id>       one uploaded photo
//   POST /admin/status      change a lead's status (form: id, status)

const STATUSES = ['new', 'contacted', 'done'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function authorised(request, env) {
  const h = request.headers.get('authorization') || '';
  if (!h.startsWith('Basic ')) return false;
  try {
    const pass = atob(h.slice(6)).split(':').slice(1).join(':');
    // constant-ish time compare
    const a = new TextEncoder().encode(pass), b = new TextEncoder().encode(env.ADMIN_PASSWORD);
    if (a.length !== b.length) return false;
    let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
    return d === 0;
  } catch { return false; }
}

const page = (body) => new Response(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Leads · Wood Metal</title>
<style>
body{margin:0;font:15px/1.5 system-ui,sans-serif;background:#F5EDE0;color:#2B1E14}
header{background:#3B2A1E;color:#F5EDE0;padding:14px 16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
header a{color:#E8B931;margin-right:12px}
main{padding:16px;max-width:1100px;margin:0 auto}
.lead{background:#FFF9EF;border:1.5px solid #CDB08A;border-radius:8px;padding:14px 16px;margin-bottom:14px}
.lead.new{border-left:6px solid #E8B931}
.top{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline}
.top b{font-size:18px}.k{color:#6B4A30}
.pill{background:#3B2A1E;color:#F5EDE0;border-radius:99px;padding:1px 10px;font-size:13px}
.photos{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.photos img{width:120px;height:120px;object-fit:cover;border-radius:6px;border:1px solid #CDB08A}
form{display:inline-flex;gap:6px;margin-top:8px}select,button{font:inherit;min-height:36px}
.btn{display:inline-block;background:#1F8F55;color:#fff;padding:4px 12px;border-radius:6px;text-decoration:none}
pre{white-space:pre-wrap;font:inherit;margin:6px 0}
</style></head><body>${body}</body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

export async function onRequest({ request, env, params }) {
  if (!env.ADMIN_PASSWORD) return new Response('Set the ADMIN_PASSWORD secret in Cloudflare Pages settings first.', { status: 503 });
  if (!authorised(request, env)) {
    return new Response('Login required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Wood Metal admin", charset="UTF-8"' } });
  }
  const parts = params.path || [];
  const url = new URL(request.url);

  if (parts[0] === 'photo' && parts[1]) {
    const row = await env.DB.prepare('SELECT mime, data FROM lead_photos WHERE id = ?').bind(Number(parts[1])).first();
    if (!row) return new Response('Not found', { status: 404 });
    return new Response(new Uint8Array(row.data), { headers: { 'content-type': row.mime, 'cache-control': 'private, max-age=86400' } });
  }

  if (parts[0] === 'status' && request.method === 'POST') {
    const f = await request.formData();
    const status = String(f.get('status'));
    if (STATUSES.includes(status)) await env.DB.prepare('UPDATE leads SET status = ? WHERE id = ?').bind(status, Number(f.get('id'))).run();
    return Response.redirect(new URL('/admin/' + (url.searchParams.get('back') || ''), url).toString(), 303);
  }

  const filter = STATUSES.includes(url.searchParams.get('status')) ? url.searchParams.get('status') : null;
  const leads = (await (filter
    ? env.DB.prepare('SELECT * FROM leads WHERE status = ? ORDER BY id DESC LIMIT 300').bind(filter)
    : env.DB.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 300')).all()).results;
  const ids = leads.map((l) => l.id);
  const photos = ids.length ? (await env.DB.prepare(`SELECT id, lead_id FROM lead_photos WHERE lead_id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all()).results : [];
  const counts = Object.fromEntries((await env.DB.prepare('SELECT status, COUNT(*) n FROM leads GROUP BY status').all()).results.map((r) => [r.status, r.n]));
  const kindBn = { quote: 'কোটেশন', custom: 'কাস্টম অর্ডার', contact: 'যোগাযোগ' };
  const statusBn = { new: 'নতুন', contacted: 'যোগাযোগ হয়েছে', done: 'শেষ' };
  const back = filter ? `?status=${filter}` : '';

  return page(`<header><strong>Wood Metal · লিড</strong><nav>
    <a href="/admin/">সব (${Object.values(counts).reduce((a, b) => a + b, 0)})</a>
    ${STATUSES.map((s) => `<a href="/admin/?status=${s}">${statusBn[s]} (${counts[s] || 0})</a>`).join('')}</nav></header>
  <main>${leads.length ? leads.map((l) => `<div class="lead ${esc(l.status)}">
    <div class="top"><b>${esc(l.name)}</b><a href="tel:${esc(l.phone)}">${esc(l.phone)}</a><a class="btn" href="https://wa.me/88${esc(l.phone)}">WhatsApp</a>
      <span class="pill">${kindBn[l.kind] || esc(l.kind)}</span><span class="k">#${l.id} · ${esc(l.created_at)} UTC · ${l.emailed ? 'ইমেইল গেছে' : 'ইমেইল যায়নি'}</span></div>
    ${l.product_name ? `<div><span class="k">পণ্য:</span> <a href="/p/${esc(l.product_slug)}/">${esc(l.product_name)}</a></div>` : ''}
    ${l.area ? `<div><span class="k">এলাকা:</span> ${esc(l.area)}</div>` : ''}
    ${l.size ? `<div><span class="k">মাপ:</span> ${esc(l.size)}</div>` : ''}
    ${l.polish ? `<div><span class="k">পালিশ:</span> ${esc(l.polish)}</div>` : ''}
    ${l.message ? `<pre>${esc(l.message)}</pre>` : ''}
    ${photos.some((p) => p.lead_id === l.id) ? `<div class="photos">${photos.filter((p) => p.lead_id === l.id).map((p) => `<a href="/admin/photo/${p.id}" target="_blank"><img src="/admin/photo/${p.id}" alt="photo" loading="lazy"></a>`).join('')}</div>` : ''}
    <form method="post" action="/admin/status?back=${encodeURIComponent(back)}"><input type="hidden" name="id" value="${l.id}">
      <select name="status">${STATUSES.map((s) => `<option value="${s}"${s === l.status ? ' selected' : ''}>${statusBn[s]}</option>`).join('')}</select><button>সেভ</button></form>
  </div>`).join('') : '<p>এখনো কোনো লিড নেই।</p>'}</main>`);
}
