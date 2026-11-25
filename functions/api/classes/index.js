// GET  /api/classes?teacher_id=1 | ?code=ABC123 | ?ids=1,2,3   -> sınıf listesi
// POST /api/classes { teacher_id, title, description }        -> 6 haneli kodla yeni sınıf
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

// 0/O ve 1/I gibi karışan karakterler çıkarıldı (32 karakter)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const teacherId = parseInt(q.get('teacher_id'), 10);
  const code = (q.get('code') || '').trim().toUpperCase();
  const ids = (q.get('ids') || '').split(',').map((n) => parseInt(n, 10)).filter(Number.isInteger).slice(0, 50);

  const base = `
    SELECT c.id, c.title, c.description, c.code, c.teacher_id, c.created_at,
           u.name AS teacher_name,
           (SELECT COUNT(*) FROM assignments a WHERE a.class_id = c.id) AS assignment_count
    FROM classes c JOIN users u ON u.id = c.teacher_id`;

  let stmt;
  if (Number.isInteger(teacherId)) {
    stmt = env.DB.prepare(`${base} WHERE c.teacher_id = ? ORDER BY c.id DESC`).bind(teacherId);
  } else if (code) {
    stmt = env.DB.prepare(`${base} WHERE c.code = ?`).bind(code);
  } else if (ids.length) {
    stmt = env.DB.prepare(`${base} WHERE c.id IN (${ids.map(() => '?').join(',')}) ORDER BY c.id DESC`).bind(...ids);
  } else {
    return json({ classes: [] }); // filtresiz istekte tüm sınıfları döndürme
  }

  const { results } = await stmt.all();
  return json({ classes: results });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Geçersiz JSON gövdesi.' }, 400); }

  const teacherId = parseInt(body.teacher_id, 10);
  const title = String(body.title || '').trim().slice(0, 120);
  const description = String(body.description || '').trim().slice(0, 500);
  if (!Number.isInteger(teacherId) || !title) {
    return json({ error: 'Sınıf adı ve öğretmen bilgisi gerekli.' }, 400);
  }

  const teacher = await env.DB
    .prepare("SELECT id FROM users WHERE id = ? AND role = 'teacher'")
    .bind(teacherId)
    .first();
  if (!teacher) return json({ error: 'Sadece öğretmenler sınıf açabilir.' }, 403);

  for (let i = 0; i < 5; i++) {
    const code = makeCode();
    try {
      const r = await env.DB
        .prepare('INSERT INTO classes (title, description, code, teacher_id) VALUES (?, ?, ?, ?)')
        .bind(title, description || null, code, teacherId)
        .run();
      return json({ class: { id: r.meta.last_row_id, title, description, code, teacher_id: teacherId } }, 201);
    } catch (err) {
      if (!/UNIQUE/i.test(String(err.message))) throw err; // kod çakışırsa yeniden dene
    }
  }
  return json({ error: 'Benzersiz sınıf kodu üretilemedi. Tekrar dene.' }, 500);
}
