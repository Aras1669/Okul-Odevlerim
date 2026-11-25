// POST /api/auth/login  { email, name?, role? }
// E-posta kayıtlıysa giriş yapar; değilse ad ve rol ile otomatik kayıt oluşturur.
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Geçersiz JSON gövdesi.' }, 400); }

  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return json({ error: 'Geçerli bir e-posta adresi yaz.' }, 400);
  }

  const existing = await env.DB
    .prepare('SELECT id, name, email, role FROM users WHERE email = ?')
    .bind(email)
    .first();
  if (existing) return json({ user: existing, created: false });

  const name = String(body.name || '').trim().slice(0, 100);
  const role = body.role;
  if (!name || !['teacher', 'student'].includes(role)) {
    return json({ error: 'Bu e-posta kayıtlı değil. Kayıt için ad soyad ve rol gerekli.', needs_registration: true }, 404);
  }

  const result = await env.DB
    .prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)')
    .bind(name, email, role)
    .run();

  return json({ user: { id: result.meta.last_row_id, name, email, role }, created: true }, 201);
}
