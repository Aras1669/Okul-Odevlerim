// GET /api/classes/:id -> sınıf detayı + sınıfa ait ödevler
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function onRequestGet({ params, env }) {
  const id = parseInt(params.id, 10);
  if (!Number.isInteger(id)) return json({ error: 'Geçersiz sınıf kimliği.' }, 400);

  const cls = await env.DB
    .prepare(`SELECT c.id, c.title, c.description, c.code, c.teacher_id, c.created_at, u.name AS teacher_name
              FROM classes c JOIN users u ON u.id = c.teacher_id WHERE c.id = ?`)
    .bind(id)
    .first();
  if (!cls) return json({ error: 'Sınıf bulunamadı.' }, 404);

  const { results } = await env.DB
    .prepare(`SELECT a.id, a.class_id, a.title, a.description, a.due_date, a.created_at,
                     (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submission_count
              FROM assignments a WHERE a.class_id = ? ORDER BY a.id DESC`)
    .bind(id)
    .all();

  return json({ class: cls, assignments: results });
}
