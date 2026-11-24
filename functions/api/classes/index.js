export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(`
    SELECT classes.*, users.name as teacher_name 
    FROM classes 
    JOIN users ON classes.teacher_id = users.id 
    ORDER BY created_at DESC
  `).all();

  return new Response(JSON.stringify({ classes: results }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { title, description, teacher_id } = await request.json();

  if (!title || !teacher_id) {
    return new Response(JSON.stringify({ error: 'Sınıf başlığı ve öğretmen ID zorunludur.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  const result = await env.DB.prepare('INSERT INTO classes (title, description, code, teacher_id) VALUES (?, ?, ?, ?)')
    .bind(title, description || '', code, teacher_id)
    .run();

  return new Response(JSON.stringify({ id: result.meta.last_row_id, code }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}