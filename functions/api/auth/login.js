export async function onRequestPost(context) {
  const { request, env } = context;
  const { email, role, name } = await request.json();

  if (!email || !role) {
    return new Response(JSON.stringify({ error: 'E-posta ve rol alanı zorunludur.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();

  if (!user) {
    const userName = name || email.split('@')[0];
    const result = await env.DB.prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)')
      .bind(userName, email, role)
      .run();
    user = { id: result.meta.last_row_id, name: userName, email, role };
  }

  return new Response(JSON.stringify({ user }), {
    headers: { 'Content-Type': 'application/json' }
  });
}