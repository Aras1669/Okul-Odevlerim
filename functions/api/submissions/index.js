export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const assignmentId = url.searchParams.get('assignment_id');

  if (!assignmentId) {
    return new Response(JSON.stringify({ error: 'assignment_id parametresi gereklidir.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { results } = await env.DB.prepare(`
    SELECT submissions.*, users.name as student_name 
    FROM submissions 
    JOIN users ON submissions.student_id = users.id 
    WHERE assignment_id = ? 
    ORDER BY submitted_at DESC
  `).bind(assignmentId).all();

  return new Response(JSON.stringify({ submissions: results }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { assignment_id, student_id, content_url } = await request.json();

  if (!assignment_id || !student_id || !content_url) {
    return new Response(JSON.stringify({ error: 'Ödev ID, öğrenci ID ve ödev adresi zorunludur.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const result = await env.DB.prepare('INSERT INTO submissions (assignment_id, student_id, content_url) VALUES (?, ?, ?)')
    .bind(assignment_id, student_id, content_url)
    .run();

  return new Response(JSON.stringify({ id: result.meta.last_row_id, status: 'submitted' }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}