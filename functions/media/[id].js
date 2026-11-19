// /media/<id> : a product photo uploaded from /admin (stored in the D1 "media" table).
export async function onRequestGet({ params, env }) {
  const id = Number(String(params.id).replace(/\.[a-z]+$/, ''));
  if (!Number.isInteger(id) || id < 1 || !env.DB) return new Response('Not found', { status: 404 });
  const row = await env.DB.prepare('SELECT mime, data FROM media WHERE id = ?').bind(id).first();
  if (!row) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(row.data), {
    headers: { 'content-type': row.mime, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' },
  });
}
