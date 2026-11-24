export async function onRequestGet(context) {
  const { env, params } = context;
  const classId = params.id;

  const classData = await env.DB.prepare(`
    SELECT classes.*, users.name as teacher_name 
    FROM classes 
    JOIN users ON classes.teacher_id = users.id 
    WHERE classes.id = ?
  `).bind(classId).first();

  if (!classData) {
    return new Response(JSON.stringify({ error: 'Sınıf bulunamadı.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { results: assignments } = await env.DB.prepare('SELECT * FROM assignments WHERE class_id = ? ORDER BY created_at DESC')
    .bind(classId)
    .all();

  return new Response(JSON.stringify({ class: classData, assignments }), {
    headers: { 'Content-Type': 'application/json' }
  });
}