/* Okul Ödevlerim — SPA istemcisi (saf JavaScript, framework yok) */
(() => {
  'use strict';

  const APP_NAME = 'Okul Ödevlerim';
  const KEY_USER = 'oo_user';
  const keyJoined = (uid) => `oo_joined_${uid}`; // öğrencinin katıldığı sınıf kimlikleri
  const SPINES = ['#2554D9', '#1F7A5A', '#C93642', '#B7791F', '#6B3FA0', '#0E7490'];
  const $app = document.getElementById('app');
  const $toasts = document.getElementById('toasts');
  const state = { user: null };
  let renderId = 0;

  /* ---------- Yardımcılar ---------- */
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : '#');
  const isTeacher = () => state.user?.role === 'teacher';
  const spine = (id) => SPINES[id % SPINES.length];

  const store = {
    get(key, fallback = null) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* depolama kapalı olabilir */ } },
    del(key) { try { localStorage.removeItem(key); } catch { /* yoksay */ } },
  };
  const getJoined = () => store.get(keyJoined(state.user.id), []);
  const setJoined = (ids) => store.set(keyJoined(state.user.id), ids);

  const fmtDate = (s) => {
    const d = new Date(`${s}T00:00:00`);
    return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const fmtDateTime = (s) => {
    const d = new Date(String(s).replace(' ', 'T') + 'Z'); // D1 UTC saklar
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  };
  const isOverdue = (due) => Boolean(due) && new Date(`${due}T23:59:59`) < new Date();
  const dueLabel = (a) => (a.due_date ? `Son teslim tarihi: ${fmtDate(a.due_date)}` : 'Son teslim tarihi yok');
  const dueClass = (a) => (isOverdue(a.due_date) ? 'font-bold text-margin' : 'text-slate-600');

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch { /* gövde boş olabilir */ }
    if (!res.ok) {
      const err = new Error(data.error || 'İstek tamamlanamadı. Bağlantını kontrol edip tekrar dene.');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function toast(message, type = 'ok') {
    const el = document.createElement('div');
    el.className = `toast ${type === 'ok' ? '' : type}`;
    el.setAttribute('role', type === 'err' ? 'alert' : 'status');
    el.textContent = message;
    $toasts.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  const busy = (btn, on) => {
    if (!btn) return;
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    btn.disabled = on;
    btn.textContent = on ? 'Bekle…' : btn.dataset.label;
  };

  /* ---------- Ortak parçalar ---------- */
  const LOGO = '<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="3" width="22" height="26" rx="3" fill="#2554D9"/><rect x="5" y="3" width="5" height="26" rx="2" fill="#1B2A41"/><path d="M14 12h9M14 17h9M14 22h6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
  const skeleton = '<div class="space-y-3" aria-busy="true"><div class="skeleton"></div><div class="skeleton"></div></div>';
  const emptyState = (title, text) => `<div class="panel !border-dashed p-8 text-center"><p class="font-display text-lg font-bold">${esc(title)}</p><p class="mx-auto mt-1 max-w-sm text-slate-600">${esc(text)}</p></div>`;
  const errorBox = (msg) => `<div class="panel border-margin p-4 font-bold text-margin" role="alert">${esc(msg)}</div>`;
  const backLink = () => '<a href="#/" class="mb-4 inline-block font-bold text-pen hover:underline">Sınıflarıma dön</a>';

  const shell = (inner) => `
    <header class="border-b border-ink/15 bg-white">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <a href="#/" class="flex items-center gap-2.5 font-display text-xl font-extrabold">${LOGO}<span>${APP_NAME}</span></a>
        <div class="flex items-center gap-3">
          <p class="text-right text-sm leading-tight"><span class="block font-bold">${esc(state.user.name)}</span><span class="text-slate-600">${isTeacher() ? 'Öğretmen' : 'Öğrenci'}</span></p>
          <button type="button" data-action="logout" class="btn btn-ghost">Çıkış yap</button>
        </div>
      </div>
    </header>
    <main class="mx-auto max-w-5xl px-4 py-6 sm:py-8">${inner}</main>`;

  /* ---------- Yönlendirme ---------- */
  function route() {
    const rid = ++renderId;
    if (!state.user) return renderLogin();
    const m = location.hash.match(/^#\/class\/(\d+)$/);
    return m ? renderClass(Number(m[1]), rid) : renderDashboard(rid);
  }
  const go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };

  /* ---------- Giriş ekranı ---------- */
  function renderLogin() {
    $app.innerHTML = `
      <main class="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-10 px-4 py-10 md:flex-row md:items-center md:gap-16">
        <section class="md:w-1/2">
          <p class="flex items-center gap-2.5 font-display text-xl font-extrabold">${LOGO}${APP_NAME}</p>
          <h1 class="mt-6 font-display text-4xl font-extrabold leading-[1.1] sm:text-5xl">Ödev, teslim ve not tek defterde.</h1>
          <p class="mt-5 max-w-md text-lg text-slate-700">Öğretmen sınıf açar, öğrenciler 6 haneli kodla katılır. Ödev bağlantıyla teslim edilir, not aynı sayfada görünür.</p>
        </section>
        <section class="md:w-1/2">
          <form data-form="login" class="sheet py-6 pl-12 pr-6">
            <h2 class="font-display text-2xl font-bold">Giriş yap</h2>
            <p class="mt-1 text-slate-600">E-posta adresini yaz. Hesabın yoksa adını ve rolünü sorarız.</p>
            <div class="mt-5">
              <label class="label" for="l-email">E-posta</label>
              <input id="l-email" name="email" type="email" required autocomplete="email" class="input" placeholder="ad@okul.edu.tr">
            </div>
            <div id="register-fields" class="hidden">
              <div class="mt-4">
                <label class="label" for="l-name">Ad soyad</label>
                <input id="l-name" name="name" maxlength="100" autocomplete="name" class="input">
              </div>
              <fieldset class="mt-4">
                <legend class="label">Rolün</legend>
                <div class="grid grid-cols-2 gap-2">
                  <label class="seg"><input type="radio" name="role" value="student"><span>Öğrenci</span></label>
                  <label class="seg"><input type="radio" name="role" value="teacher"><span>Öğretmen</span></label>
                </div>
              </fieldset>
            </div>
            <button type="submit" class="btn btn-primary mt-6 w-full">Giriş yap</button>
          </form>
        </section>
      </main>`;
  }

  /* ---------- Sınıflarım ---------- */
  const classForm = `
    <form data-form="class" class="panel space-y-3 p-5">
      <h2 class="font-display text-xl font-bold">Yeni sınıf</h2>
      <div><label class="label" for="c-title">Sınıf adı</label><input id="c-title" name="title" required maxlength="120" placeholder="Örn. 9-A Matematik" class="input"></div>
      <div><label class="label" for="c-desc">Açıklama</label><textarea id="c-desc" name="description" rows="3" maxlength="500" class="input"></textarea></div>
      <button type="submit" class="btn btn-primary w-full">Sınıf aç</button>
      <p class="text-sm text-slate-600">Sınıf için 6 haneli bir katılım kodu otomatik üretilir.</p>
    </form>`;

  const joinForm = `
    <form data-form="join" class="panel space-y-3 p-5">
      <h2 class="font-display text-xl font-bold">Sınıfa katıl</h2>
      <div><label class="label" for="j-code">Sınıf kodu</label><input id="j-code" name="code" required minlength="6" maxlength="6" autocomplete="off" placeholder="ABC123" class="input text-center text-lg font-bold uppercase tracking-[.3em]"></div>
      <button type="submit" class="btn btn-primary w-full">Sınıfa katıl</button>
      <p class="text-sm text-slate-600">Kodu öğretmeninden al.</p>
    </form>`;

  const classCard = (c) => `
    <a href="#/class/${c.id}" class="class-card">
      <span class="spine" style="background:${spine(c.id)}"></span>
      <span class="block min-w-0 flex-1 p-4">
        <span class="block truncate font-display text-lg font-bold leading-tight">${esc(c.title)}</span>
        <span class="mt-0.5 block truncate text-sm text-slate-600">${esc(c.teacher_name)}</span>
        <span class="mt-3 block min-h-[3rem] text-slate-700 line-clamp-2">${esc(c.description) || 'Açıklama eklenmemiş.'}</span>
        <span class="mt-3 flex items-center justify-between"><span class="font-bold">${c.assignment_count} ödev</span>${isTeacher() ? `<mark class="code-mark">${esc(c.code)}</mark>` : ''}</span>
      </span>
    </a>`;

  async function renderDashboard(rid) {
    $app.innerHTML = shell(`
      <div class="mb-6">
        <h1 class="font-display text-3xl font-extrabold">Sınıflarım</h1>
        <p class="text-slate-700">${isTeacher() ? 'Sınıf aç, ödev ver, teslimleri notlandır.' : 'Katıldığın sınıfları ve ödevlerini buradan takip et.'}</p>
      </div>
      <div class="grid items-start gap-6 md:grid-cols-[18rem_1fr]">
        <aside>${isTeacher() ? classForm : joinForm}</aside>
        <section id="class-list">${skeleton}</section>
      </div>`);

    const box = document.getElementById('class-list');
    try {
      let classes = [];
      if (isTeacher()) {
        ({ classes } = await api(`/classes?teacher_id=${state.user.id}`));
      } else {
        const ids = getJoined();
        if (ids.length) ({ classes } = await api(`/classes?ids=${ids.join(',')}`));
      }
      if (rid !== renderId) return;
      box.innerHTML = classes.length
        ? `<div class="grid gap-4 sm:grid-cols-2">${classes.map(classCard).join('')}</div>`
        : emptyState(
            isTeacher() ? 'Henüz sınıfın yok' : 'Henüz bir sınıfta değilsin',
            isTeacher() ? 'Soldaki formu doldurup ilk sınıfını aç.' : 'Öğretmeninden aldığın 6 haneli kodu soldaki alana yaz.'
          );
    } catch (err) {
      if (rid === renderId) box.innerHTML = errorBox(err.message);
    }
  }

  /* ---------- Sınıf sayfası ---------- */
  const assignmentForm = (classId) => `
    <form data-form="assignment" data-class="${classId}" class="panel space-y-3 p-5">
      <h2 class="font-display text-xl font-bold">Yeni ödev</h2>
      <div><label class="label" for="a-title">Başlık</label><input id="a-title" name="title" required maxlength="150" class="input"></div>
      <div><label class="label" for="a-desc">Açıklama</label><textarea id="a-desc" name="description" rows="4" maxlength="2000" class="input"></textarea></div>
      <div><label class="label" for="a-due">Son teslim tarihi</label><input id="a-due" name="due_date" type="date" class="input"></div>
      <button type="submit" class="btn btn-primary w-full">Ödev ver</button>
    </form>`;

  const teacherAssignment = (a) => `
    <article class="py-4 pl-12 pr-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="font-display text-lg font-bold leading-snug">${esc(a.title)}</h3>
          <p class="text-sm ${dueClass(a)}">${esc(dueLabel(a))}</p>
        </div>
        <button type="button" class="btn btn-ghost" data-action="toggle-subs" data-id="${a.id}">Teslimleri gör (${a.submission_count})</button>
      </div>
      ${a.description ? `<p class="mt-2 max-w-prose whitespace-pre-line text-slate-700">${esc(a.description)}</p>` : ''}
      <div id="subs-${a.id}" class="mt-4 hidden space-y-2"></div>
    </article>`;

  const subRow = (s) => `
    <form data-form="grade" data-id="${s.id}" class="sub flex flex-wrap items-center gap-3">
      <div class="min-w-0 flex-1">
        <p class="truncate font-bold">${esc(s.student_name)}</p>
        <a href="${esc(safeUrl(s.content_url))}" target="_blank" rel="noopener noreferrer" class="block truncate text-sm text-pen hover:underline">${esc(s.content_url)}</a>
        <p class="text-sm text-slate-600">Teslim edildi: ${esc(fmtDateTime(s.submitted_at))}</p>
      </div>
      <input name="grade" type="number" min="0" max="100" step="1" inputmode="numeric" placeholder="Not" value="${esc(s.grade)}" class="input !w-24" aria-label="${esc(s.student_name)} için not (0-100)">
      <button type="submit" class="btn btn-primary">Notu kaydet</button>
    </form>`;

  function studentAssignment(a, sub) {
    const graded = Boolean(sub) && sub.grade !== null;
    let status;
    if (graded) status = `<span class="stamp" title="Öğretmenin verdiği not">${esc(sub.grade)}/100</span>`;
    else if (sub) status = '<span class="chip chip-pen">Teslim edildi</span>';
    else if (isOverdue(a.due_date)) status = '<span class="chip chip-red">Süresi geçti</span>';
    else status = '<span class="chip">Bekliyor</span>';

    const submitArea = graded
      ? `<p class="mt-3">Teslimin: <a href="${esc(safeUrl(sub.content_url))}" target="_blank" rel="noopener noreferrer" class="break-all text-pen hover:underline">${esc(sub.content_url)}</a></p>`
      : `<form data-form="submit" data-id="${a.id}" class="mt-4 flex flex-col gap-2 sm:flex-row">
           <input name="content_url" type="url" required class="input" value="${esc(sub?.content_url)}" placeholder="Drive, OneDrive vb. paylaşım bağlantısı" aria-label="Teslim bağlantısı">
           <button type="submit" class="btn btn-primary shrink-0">${sub ? 'Teslimi güncelle' : 'Teslim et'}</button>
         </form>
         ${sub ? `<p class="mt-2 text-sm text-slate-600">Teslim edildi: ${esc(fmtDateTime(sub.submitted_at))}</p>` : ''}`;

    return `
      <article class="py-4 pl-12 pr-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="font-display text-lg font-bold leading-snug">${esc(a.title)}</h3>
            <p class="text-sm ${dueClass(a)}">${esc(dueLabel(a))}</p>
          </div>
          ${status}
        </div>
        ${a.description ? `<p class="mt-2 max-w-prose whitespace-pre-line text-slate-700">${esc(a.description)}</p>` : ''}
        ${submitArea}
      </article>`;
  }

  function classView(c, assignments, mine) {
    const teacher = isTeacher();
    const list = assignments.length
      ? `<div class="sheet divide-y divide-pen/20">${assignments.map((a) => (teacher ? teacherAssignment(a) : studentAssignment(a, mine[a.id]))).join('')}</div>`
      : emptyState('Henüz ödev yok', teacher ? 'Soldaki formla ilk ödevi ver.' : 'Öğretmenin ödev verince burada görünecek.');

    return `
      ${backLink()}
      <section class="cover">
        <span class="spine" style="background:${spine(c.id)}"></span>
        <div class="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
          <div class="min-w-0">
            <h1 class="font-display text-3xl font-extrabold leading-tight">${esc(c.title)}</h1>
            <p class="mt-1 text-slate-700">${esc(c.teacher_name)}</p>
            ${c.description ? `<p class="mt-3 max-w-prose text-slate-700">${esc(c.description)}</p>` : ''}
          </div>
          ${teacher
            ? `<div class="text-center"><p class="text-sm font-bold">Sınıf kodu</p><mark class="code-mark mt-1 !text-2xl">${esc(c.code)}</mark><br><button type="button" class="mt-2 text-sm font-bold text-pen hover:underline" data-action="copy-code" data-code="${esc(c.code)}">Kodu kopyala</button></div>`
            : `<button type="button" class="btn btn-ghost" data-action="leave-class" data-id="${c.id}">Sınıftan ayrıl</button>`}
        </div>
      </section>
      <div class="mt-6 grid items-start gap-6 ${teacher ? 'md:grid-cols-[18rem_1fr]' : ''}">
        ${teacher ? `<aside>${assignmentForm(c.id)}</aside>` : ''}
        <section>
          <h2 class="mb-3 font-display text-xl font-bold">Ödevler (${assignments.length})</h2>
          ${list}
        </section>
      </div>`;
  }

  async function renderClass(id, rid) {
    $app.innerHTML = shell(skeleton);
    try {
      const { class: c, assignments } = await api(`/classes/${id}`);
      const allowed = isTeacher() ? c.teacher_id === state.user.id : getJoined().includes(c.id);
      if (!allowed) throw new Error('Bu sınıfa erişimin yok. Öğrenciysen sınıf koduyla katıl.');

      const mine = {};
      if (!isTeacher()) {
        const { submissions } = await api(`/submissions?student_id=${state.user.id}`);
        submissions.forEach((s) => { mine[s.assignment_id] = s; });
      }
      if (rid !== renderId) return;
      $app.innerHTML = shell(classView(c, assignments, mine));
    } catch (err) {
      if (rid === renderId) $app.innerHTML = shell(`${backLink()}${errorBox(err.message)}`);
    }
  }

  /* ---------- Form işleyicileri ---------- */
  const forms = {
    async login(form) {
      const fd = new FormData(form);
      const reg = form.querySelector('#register-fields');
      const registering = !reg.classList.contains('hidden');
      const name = String(fd.get('name') || '').trim();
      const role = fd.get('role');
      if (registering && (!name || !role)) throw new Error('Kayıt için ad soyadını yaz ve rolünü seç.');

      try {
        const { user, created } = await api('/auth/login', {
          method: 'POST',
          body: { email: fd.get('email'), name: registering ? name : undefined, role: registering ? role : undefined },
        });
        state.user = user;
        store.set(KEY_USER, user);
        toast(created ? 'Hesabın oluşturuldu.' : 'Giriş yapıldı.');
        go('#/');
      } catch (err) {
        if (err.data?.needs_registration) {
          reg.classList.remove('hidden');
          form.querySelector('[name=name]').focus();
          toast('Bu e-posta kayıtlı değil. Adını yaz ve rolünü seç.', 'info');
          return;
        }
        throw err;
      }
    },

    async class(form) {
      const fd = new FormData(form);
      const { class: c } = await api('/classes', {
        method: 'POST',
        body: { teacher_id: state.user.id, title: fd.get('title'), description: fd.get('description') },
      });
      toast(`Sınıf açıldı. Katılım kodu: ${c.code}`);
      route();
    },

    async join(form) {
      const code = String(new FormData(form).get('code') || '').trim().toUpperCase();
      if (code.length !== 6) throw new Error('Sınıf kodu 6 karakter olmalı.');
      const { classes } = await api(`/classes?code=${encodeURIComponent(code)}`);
      if (!classes.length) throw new Error('Bu kodla bir sınıf bulunamadı. Kodu kontrol et.');
      const cls = classes[0];
      const joined = getJoined();
      if (joined.includes(cls.id)) {
        toast('Bu sınıftasın zaten.', 'info');
      } else {
        setJoined([...joined, cls.id]);
        toast(`Sınıfa katıldın: ${cls.title}`);
      }
      route();
    },

    async assignment(form) {
      const fd = new FormData(form);
      await api('/assignments', {
        method: 'POST',
        body: {
          class_id: Number(form.dataset.class),
          teacher_id: state.user.id,
          title: fd.get('title'),
          description: fd.get('description'),
          due_date: fd.get('due_date') || null,
        },
      });
      toast('Ödev verildi.');
      route();
    },

    async submit(form) {
      await api('/submissions', {
        method: 'POST',
        body: {
          assignment_id: Number(form.dataset.id),
          student_id: state.user.id,
          content_url: String(new FormData(form).get('content_url') || '').trim(),
        },
      });
      toast('Ödev teslim edildi.');
      route();
    },

    async grade(form) {
      const raw = String(new FormData(form).get('grade') ?? '').trim();
      const grade = raw === '' ? null : Number(raw);
      if (grade !== null && (!Number.isInteger(grade) || grade < 0 || grade > 100)) {
        throw new Error('Not 0 ile 100 arasında tam sayı olmalı.');
      }
      await api('/submissions', { method: 'PATCH', body: { id: Number(form.dataset.id), teacher_id: state.user.id, grade } });
      toast('Not kaydedildi.');
    },
  };

  /* ---------- Tıklama eylemleri ---------- */
  const actions = {
    logout() {
      store.del(KEY_USER);
      state.user = null;
      history.replaceState(null, '', location.pathname);
      route();
    },

    async 'copy-code'(el) {
      try {
        await navigator.clipboard.writeText(el.dataset.code);
        toast('Sınıf kodu kopyalandı.');
      } catch {
        toast(`Kodu elle kopyala: ${el.dataset.code}`, 'info');
      }
    },

    'leave-class'(el) {
      if (!confirm('Bu sınıftan ayrılmak istediğine emin misin? Kodla tekrar katılabilirsin.')) return;
      setJoined(getJoined().filter((id) => id !== Number(el.dataset.id)));
      toast('Sınıftan ayrıldın.');
      go('#/');
    },

    async 'toggle-subs'(el) {
      const box = document.getElementById(`subs-${el.dataset.id}`);
      if (!box.classList.contains('hidden')) { box.classList.add('hidden'); return; }
      box.classList.remove('hidden');
      box.innerHTML = '<p class="text-slate-600">Teslimler yükleniyor…</p>';
      try {
        const { submissions } = await api(`/submissions?assignment_id=${el.dataset.id}`);
        box.innerHTML = submissions.length
          ? submissions.map(subRow).join('')
          : '<p class="sub text-slate-700">Henüz teslim eden öğrenci yok.</p>';
      } catch (err) {
        box.innerHTML = errorBox(err.message);
      }
    },
  };

  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    busy(btn, true);
    try {
      await forms[form.dataset.form](form);
    } catch (err) {
      toast(err.message || 'Bir hata oluştu.', 'err');
    } finally {
      busy(btn, false);
    }
  });

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    try {
      await actions[el.dataset.action]?.(el);
    } catch (err) {
      toast(err.message || 'Bir hata oluştu.', 'err');
    }
  });

  /* ---------- Başlangıç ---------- */
  const saved = store.get(KEY_USER);
  if (saved && Number.isInteger(saved.id) && ['teacher', 'student'].includes(saved.role)) state.user = saved;
  window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
  route();
})();
