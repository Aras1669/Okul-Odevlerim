export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const classId = url.searchParams.get('class_id');

  let stmt = env.DB.prepare('SELECT * FROM assignments ORDER BY created_at DESC');

  if (classId) {
    stmt = env.DB.prepare('SELECT * FROM assignments WHERE class_id = ? ORDER BY created_at DESC').bind(classId);
  }

  const { results } = await stmt.all();
  return new Response(JSON.stringify({ assignments: results }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { class_id, title, description, due_date } = await request.json();

  if (!class_id || !title) {
    return new Response(JSON.stringify({ error: 'Sınıf ID ve ödev başlığı zorunludur.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const result = await env.DB.prepare('INSERT INTO assignments (class_id, title, description, due_date) VALUES (?, ?, ?, ?)')
    .bind(class_id, title, description || '', due_date || '')
    .run();

  return new Response(JSON.stringify({ id: result.meta.last_row_id }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}