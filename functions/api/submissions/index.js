// GET   /api/submissions?assignment_id=1 | ?student_id=2 -> teslimler
// POST  /api/submissions { assignment_id, student_id, content_url } -> teslim et (varsa günceller)
// PATCH /api/submissions { id, teacher_id, grade }                  -> öğretmen not verir
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
const readJson = async (request) => { try { return await request.json(); } catch { return null; } };
const URL_RE = /^https?:\/\/\S+$/i;

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const assignmentId = parseInt(q.get('assignment_id'), 10);
  const studentId = parseInt(q.get('student_id'), 10);

  const where = [];
  const args = [];
  if (Number.isInteger(assignmentId)) { where.push('s.assignment_id = ?'); args.push(assignmentId); }
  if (Number.isInteger(studentId)) { where.push('s.student_id = ?'); args.push(studentId); }
  if (!where.length) return json({ error: 'assignment_id veya student_id gerekli.' }, 400);

  const { results } = await env.DB
    .prepare(`SELECT s.id, s.assignment_id, s.student_id, s.content_url, s.status, s.grade, s.submitted_at,
                     u.name AS student_name
              FROM submissions s JOIN users u ON u.id = s.student_id
              WHERE ${where.join(' AND ')}
              ORDER BY s.submitted_at DESC, s.id DESC`)
    .bind(...args)
    .all();
  return json({ submissions: results });
}

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return json({ error: 'Geçersiz JSON gövdesi.' }, 400);

  const assignmentId = parseInt(body.assignment_id, 10);
  const studentId = parseInt(body.student_id, 10);
  const contentUrl = String(body.content_url || '').trim();
  if (!Number.isInteger(assignmentId) || !Number.isInteger(studentId)) {
    return json({ error: 'Ödev ve öğrenci bilgisi gerekli.' }, 400);
  }
  if (!URL_RE.test(contentUrl) || contentUrl.length > 2000) {
    return json({ error: 'Teslim bağlantısı http:// veya https:// ile başlayan geçerli bir adres olmalı.' }, 400);
  }

  const student = await env.DB.prepare("SELECT id FROM users WHERE id = ? AND role = 'student'").bind(studentId).first();
  if (!student) return json({ error: 'Sadece öğrenciler ödev teslim edebilir.' }, 403);

  const assignment = await env.DB.prepare('SELECT id FROM assignments WHERE id = ?').bind(assignmentId).first();
  if (!assignment) return json({ error: 'Ödev bulunamadı.' }, 404);

  const existing = await env.DB
    .prepare('SELECT id, grade FROM submissions WHERE assignment_id = ? AND student_id = ?')
    .bind(assignmentId, studentId)
    .first();

  if (existing) {
    if (existing.grade !== null) return json({ error: 'Notlandırılmış teslim değiştirilemez.' }, 409);
    await env.DB
      .prepare("UPDATE submissions SET content_url = ?, status = 'submitted', submitted_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(contentUrl, existing.id)
      .run();
    return json({ submission: { id: existing.id, assignment_id: assignmentId, student_id: studentId, content_url: contentUrl }, updated: true });
  }

  const r = await env.DB
    .prepare('INSERT INTO submissions (assignment_id, student_id, content_url) VALUES (?, ?, ?)')
    .bind(assignmentId, studentId, contentUrl)
    .run();
  return json({ submission: { id: r.meta.last_row_id, assignment_id: assignmentId, student_id: studentId, content_url: contentUrl }, updated: false }, 201);
}

export async function onRequestPatch({ request, env }) {
  const body = await readJson(request);
  if (!body) return json({ error: 'Geçersiz JSON gövdesi.' }, 400);

  const id = parseInt(body.id, 10);
  const teacherId = parseInt(body.teacher_id, 10);
  if (!Number.isInteger(id) || !Number.isInteger(teacherId)) return json({ error: 'Teslim ve öğretmen bilgisi gerekli.' }, 400);

  let grade = body.grade === '' || body.grade === undefined ? null : body.grade;
  if (grade !== null) {
    grade = Number(grade);
    if (!Number.isInteger(grade) || grade < 0 || grade > 100) return json({ error: 'Not 0 ile 100 arasında tam sayı olmalı.' }, 400);
  }

  const row = await env.DB
    .prepare(`SELECT c.teacher_id FROM submissions s
              JOIN assignments a ON a.id = s.assignment_id
              JOIN classes c ON c.id = a.class_id
              WHERE s.id = ?`)
    .bind(id)
    .first();
  if (!row) return json({ error: 'Teslim bulunamadı.' }, 404);
  if (row.teacher_id !== teacherId) return json({ error: 'Bu teslimi notlandırma yetkin yok.' }, 403);

  await env.DB
    .prepare('UPDATE submissions SET grade = ?, status = ? WHERE id = ?')
    .bind(grade, grade === null ? 'submitted' : 'graded', id)
    .run();
  return json({ ok: true, id, grade });
}
