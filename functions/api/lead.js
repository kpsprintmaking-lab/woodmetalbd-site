// POST /api/lead : saves a quote / custom-order / contact request in D1
// and (if RESEND_API_KEY is set) emails it to the shop.
//
// Bindings / settings (Cloudflare Pages > Settings):
//   DB               D1 database "woodmetal-leads"   (required)
//   RESEND_API_KEY   secret, optional: enables email
//   LEAD_EMAIL_TO    optional, default woodmetalbd@gmail.com
//   LEAD_EMAIL_FROM  optional, default "Wood Metal Website <onboarding@resend.dev>"

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
const KINDS = { quote: 'Quote request', custom: 'Custom order', contact: 'Contact form' };

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const clip = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);

function normalisePhone(v) {
  let d = String(v || '').replace(/[০-৯]/g, (c) => String('০১২৩৪৫৬৭৮৯'.indexOf(c))).replace(/[^0-9+]/g, '');
  if (d.startsWith('+880')) d = '0' + d.slice(4);
  else if (d.startsWith('880')) d = '0' + d.slice(3);
  return /^01[3-9][0-9]{8}$/.test(d) ? d : null;
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.DB) return json(500, { ok: false, error: 'DB binding missing' });
  let body;
  try {
    if (Number(request.headers.get('content-length') || 0) > 8 * 1024 * 1024) return json(413, { ok: false, error: 'too large' });
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: 'bad json' });
  }
  // Honeypot: bots fill the hidden "website" field. Pretend success.
  if (body.website) return json(200, { ok: true });

  const name = clip(body.name, 80);
  const phone = normalisePhone(body.phone);
  if (!name || !phone) return json(400, { ok: false, error: 'name and valid phone required' });
  const kind = KINDS[body.kind] ? body.kind : 'contact';

  const ip = request.headers.get('cf-connecting-ip') || '';
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM leads WHERE ip = ? AND created_at > datetime('now', '-10 minutes')").bind(ip).first();
  if (recent && recent.n >= 6) return json(429, { ok: false, error: 'too many' });

  const photos = [];
  for (const p of (Array.isArray(body.photos) ? body.photos : []).slice(0, MAX_PHOTOS)) {
    if (!p || typeof p.data !== 'string' || !/^image\/(jpeg|png|webp)$/.test(p.type || '')) continue;
    try {
      const bytes = b64ToBytes(p.data);
      if (bytes.length <= MAX_PHOTO_BYTES) photos.push({ type: p.type, bytes, b64: p.data });
    } catch { /* skip broken photo */ }
  }

  const lead = {
    kind, name, phone,
    area: clip(body.area, 80),
    product_slug: clip(body.product_slug, 80),
    product_name: clip(body.product_name, 160),
    size: clip(body.size, 120),
    polish: clip(body.polish, 40),
    message: [clip(body.item, 120) && `Item: ${clip(body.item, 120)}`, clip(body.message, 2000)].filter(Boolean).join('\n') || null,
    lang: body.lang === 'en' ? 'en' : 'bn',
    page: clip(body.page, 200),
  };

  const res = await env.DB.prepare(
    `INSERT INTO leads (kind, name, phone, area, product_slug, product_name, size, polish, message, lang, page, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(lead.kind, lead.name, lead.phone, lead.area, lead.product_slug, lead.product_name, lead.size, lead.polish,
    lead.message, lead.lang, lead.page, ip, clip(request.headers.get('user-agent'), 300)).run();
  const id = res.meta.last_row_id;

  if (photos.length) {
    await env.DB.batch(photos.map((p) => env.DB.prepare('INSERT INTO lead_photos (lead_id, mime, data) VALUES (?, ?, ?)').bind(id, p.type, p.bytes)));
  }

  if (env.RESEND_API_KEY) waitUntil(sendEmail(env, id, lead, photos, new URL(request.url).origin));
  return json(200, { ok: true, id });
}

async function sendEmail(env, id, lead, photos, origin) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wa = 'https://wa.me/88' + lead.phone;
  const rows = [
    ['Type', KINDS[lead.kind]], ['Name', lead.name], ['Phone', `<a href="tel:${lead.phone}">${lead.phone}</a> · <a href="${wa}">WhatsApp</a>`],
    ['Area', lead.area], ['Product', lead.product_slug ? `<a href="${origin}/p/${esc(lead.product_slug)}/">${esc(lead.product_name)}</a>` : null],
    ['Size', lead.size], ['Polish', lead.polish], ['Message', lead.message && esc(lead.message).replace(/\n/g, '<br>')],
    ['Language', lead.lang], ['Photos', photos.length ? `${photos.length} attached` : null],
  ].filter((r) => r[1]);
  const html = `<h2>New ${KINDS[lead.kind]} #${id}</h2><table cellpadding="6" style="border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="color:#666;vertical-align:top">${k}</td><td>${k === 'Phone' || k === 'Product' || k === 'Message' ? v : esc(v)}</td></tr>`).join('')}</table>
    <p><a href="${origin}/admin/">Open all leads</a></p>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.LEAD_EMAIL_FROM || 'Wood Metal Website <onboarding@resend.dev>',
        to: [env.LEAD_EMAIL_TO || 'woodmetalbd@gmail.com'],
        subject: `${KINDS[lead.kind]}: ${lead.name} (${lead.phone})${lead.product_name ? ' – ' + lead.product_name : ''}`,
        html,
        attachments: photos.map((p, i) => ({ filename: `lead-${id}-photo-${i + 1}.jpg`, content: p.b64 })),
      }),
    });
    if (r.ok) await env.DB.prepare('UPDATE leads SET emailed = 1 WHERE id = ?').bind(id).run();
    else console.log('resend error', r.status, await r.text());
  } catch (e) {
    console.log('email failed', e);
  }
}

export const onRequest = () => json(405, { ok: false, error: 'POST only' });
