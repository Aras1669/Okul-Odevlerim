let currentUser = null;
let currentClass = null;

document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showDashboard();
    }

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('login-name').value;
        const email = document.getElementById('login-email').value;
        const role = document.getElementById('login-role').value;

        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, role })
        });

        const data = await res.json();
        if (data.user) {
            currentUser = data.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            showDashboard();
        } else {
            alert(data.error || 'Giriş başarısız.');
        }
    });

    document.getElementById('back-to-classes').addEventListener('click', () => {
        document.getElementById('class-detail').classList.add('hidden');
        document.getElementById('classes-grid').classList.remove('hidden');
    });
});

function showDashboard() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    
    document.getElementById('user-info').innerHTML = `
        <span>${currentUser.name} (${currentUser.role === 'teacher' ? 'Öğretmen' : 'Öğrenci'})</span>
        <button onclick="logout()" class="ml-3 text-xs bg-indigo-700 hover:bg-indigo-800 px-2 py-1 rounded">Çıkış</button>
    `;

    const actionContainer = document.getElementById('action-buttons');
    if (currentUser.role === 'teacher') {
        actionContainer.innerHTML = `
            <button onclick="createClassPrompt()" class="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded hover:bg-indigo-700">+ Sınıf Oluştur</button>
        `;
    } else {
        actionContainer.innerHTML = '';
    }

    loadClasses();
}

async function loadClasses() {
    const res = await fetch('/api/classes');
    const data = await res.json();
    const grid = document.getElementById('classes-grid');
    grid.innerHTML = '';

    if (!data.classes || data.classes.length === 0) {
        grid.innerHTML = `<p class="text-gray-500 col-span-full text-center">Henüz sınıf bulunmuyor.</p>`;
        return;
    }

    data.classes.forEach(c => {
        const card = document.createElement('div');
        card.className = 'class-card bg-white p-5 rounded-lg shadow-sm border cursor-pointer';
        card.innerHTML = `
            <h3 class="text-lg font-bold text-indigo-600">${c.title}</h3>
            <p class="text-sm text-gray-600 mb-2">${c.description || 'Açıklama yok.'}</p>
            <div class="text-xs text-gray-500 flex justify-between border-t pt-2">
                <span>Öğretmen: ${c.teacher_name}</span>
                <span class="font-mono bg-gray-100 px-1.5 py-0.5 rounded">Kod: ${c.code}</span>
            </div>
        `;
        card.onclick = () => openClassDetail(c.id);
        grid.appendChild(card);
    });
}

async function createClassPrompt() {
    const title = prompt('Sınıf Adı:');
    if (!title) return;
    const description = prompt('Sınıf Açıklaması:');

    const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, teacher_id: currentUser.id })
    });

    if (res.ok) {
        loadClasses();
    } else {
        alert('Sınıf oluşturulamadı.');
    }
}

async function openClassDetail(classId) {
    const res = await fetch(`/api/classes/${classId}`);
    const data = await res.json();
    if (!res.ok) return alert('Sınıf yüklenemedi.');

    currentClass = data.class;
    document.getElementById('classes-grid').classList.add('hidden');
    const detailSec = document.getElementById('class-detail');
    detailSec.classList.remove('hidden');

    document.getElementById('class-detail-header').innerHTML = `
        <h2 class="text-2xl font-bold text-indigo-600">${currentClass.title}</h2>
        <p class="text-gray-600">${currentClass.description}</p>
        <p class="text-xs text-gray-400 mt-1">Öğretmen: ${currentClass.teacher_name} | Katılım Kodu: <strong class="font-mono">${currentClass.code}</strong></p>
    `;

    const addBtn = document.getElementById('add-assignment-btn');
    if (currentUser.role === 'teacher' && currentUser.id === currentClass.teacher_id) {
        addBtn.classList.remove('hidden');
        addBtn.onclick = createAssignmentPrompt;
    } else {
        addBtn.classList.add('hidden');
    }

    renderAssignments(data.assignments);
}

function renderAssignments(assignments) {
    const container = document.getElementById('assignments-list');
    container.innerHTML = '';

    if (!assignments || assignments.length === 0) {
        container.innerHTML = `<p class="text-sm text-gray-500">Bu sınıfa ait ödev bulunmuyor.</p>`;
        return;
    }

    assignments.forEach(a => {
        const item = document.createElement('div');
        item.className = 'border p-4 rounded bg-gray-50 flex justify-between items-center';
        item.innerHTML = `
            <div>
                <h4 class="font-bold text-md">${a.title}</h4>
                <p class="text-xs text-gray-600">${a.description || ''}</p>
                <span class="text-xs text-red-500 font-medium">Son Teslim: ${a.due_date || 'Belirtilmedi'}</span>
            </div>
            <div>
                ${currentUser.role === 'student' 
                    ? `<button onclick="submitAssignmentPrompt(${a.id})" class="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700">Ödev Teslim Et</button>`
                    : `<button onclick="viewSubmissions(${a.id})" class="text-xs bg-gray-700 text-white px-3 py-1.5 rounded hover:bg-gray-800">Teslimleri Gör</button>`
                }
            </div>
        `;
        container.appendChild(item);
    });
}

async function createAssignmentPrompt() {
    const title = prompt('Ödev Başlığı:');
    if (!title) return;
    const description = prompt('Ödev Detayı/Talimatlar:');
    const due_date = prompt('Son Teslim Tarihi (Örn: 2026-12-01):');

    const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_id: currentClass.id, title, description, due_date })
    });

    if (res.ok) {
        openClassDetail(currentClass.id);
    } else {
        alert('Ödev oluşturulamadı.');
    }
}

async function submitAssignmentPrompt(assignmentId) {
    const content_url = prompt('Ödev Bağlantısı (Google Drive, GitHub veya Dosya Linki):');
    if (!content_url) return;

    const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId, student_id: currentUser.id, content_url })
    });

    if (res.ok) {
        alert('Ödeviniz başarıyla teslim edildi!');
    } else {
        alert('Teslim işlemi başarısız.');
    }
}

async function viewSubmissions(assignmentId) {
    const res = await fetch(`/api/submissions?assignment_id=${assignmentId}`);
    const data = await res.json();

    if (!data.submissions || data.submissions.length === 0) {
        alert('Henüz bu ödeve yapılan bir teslim bulunmuyor.');
        return;
    }

    const list = data.submissions.map(s => `- ${s.student_name}: ${s.content_url}`).join('\n');
    alert(`Teslim Eden Öğrenciler:\n\n${list}`);
}

function logout() {
    localStorage.removeItem('user');
    currentUser = null;
    location.reload();
}