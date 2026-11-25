// GET  /api/assignments?class_id=1 -> sınıfın ödevleri
// POST /api/assignments { class_id, teacher_id, title, description, due_date } -> ödev ekle
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function onRequestGet({ request, env }) {
  const classId = parseInt(new URL(request.url).searchParams.get('class_id'), 10);
  if (!Number.isInteger(classId)) return json({ error: 'class_id parametresi gerekli.' }, 400);

  const { results } = await env.DB
    .prepare(`SELECT a.id, a.class_id, a.title, a.description, a.due_date, a.created_at,
                     (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submission_count
              FROM assignments a WHERE a.class_id = ? ORDER BY a.id DESC`)
    .bind(classId)
    .all();
  return json({ assignments: results });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Geçersiz JSON gövdesi.' }, 400); }

  const classId = parseInt(body.class_id, 10);
  const teacherId = parseInt(body.teacher_id, 10);
  const title = String(body.title || '').trim().slice(0, 150);
  const description = String(body.description || '').trim().slice(0, 2000);
  const dueDate = body.due_date ? String(body.due_date).trim() : null;

  if (!Number.isInteger(classId) || !Number.isInteger(teacherId) || !title) {
    return json({ error: 'Sınıf, öğretmen ve ödev başlığı gerekli.' }, 400);
  }
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return json({ error: 'Son teslim tarihi YYYY-AA-GG biçiminde olmalı.' }, 400);
  }

  const owner = await env.DB
    .prepare('SELECT id FROM classes WHERE id = ? AND teacher_id = ?')
    .bind(classId, teacherId)
    .first();
  if (!owner) return json({ error: 'Bu sınıfa ödev ekleme yetkin yok.' }, 403);

  const r = await env.DB
    .prepare('INSERT INTO assignments (class_id, title, description, due_date) VALUES (?, ?, ?, ?)')
    .bind(classId, title, description || null, dueDate)
    .run();

  return json({ assignment: { id: r.meta.last_row_id, class_id: classId, title, description, due_date: dueDate } }, 201);
}
