const BASE_URL = 'https://script.google.com/macros/s/AKfycbybBJXB1vTEv9EDjyRXJnU674ZSCoUCT5MB9g9CTbDAiLKWn5iMAWSjC2XXLN4_ZdOhRw/exec';

const qs = new URLSearchParams(location.search);
const ownerParam = qs.get('owner') || 'unassigned';
const focusId = qs.get('focus') || '';

const els = {
  title: document.getElementById('ownerTitle'),
  stats: document.getElementById('ownerStats'),
  list: document.getElementById('tasksList'),
  search: document.getElementById('ownerSearch'),
  btnSearch: document.getElementById('btnOwnerSearch'),
  btnClear: document.getElementById('btnOwnerClear'),

  dlg: document.getElementById('taskDialog'),
  form: document.getElementById('taskForm'),
  f_status: document.getElementById('f_status'),
  f_owner: document.getElementById('f_owner'),
  f_name: document.getElementById('f_name'),
  f_phone: document.getElementById('f_phone'),
  f_notes: document.getElementById('f_notes'),
  f_caseId: document.getElementById('f_caseId'),
  btnSave: document.getElementById('btnSave'),
  btnClose: document.getElementById('btnClose'),
};

function ownerLabel() {
  return ownerParam === 'unassigned' ? 'לא משויך' : ownerParam;
}

els.title.textContent = `משימות – ${ownerLabel()}`;

function escapeHTML(s='') {
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Network error');
  return res.json();
}

async function loadTasks() {
  const q = els.search.value.trim();
  const url = new URL(BASE_URL);
  url.searchParams.set('path', 'tasks');
  url.searchParams.set('owner', ownerParam);
  if (q) url.searchParams.set('q', q);

  const data = await fetchJSON(url.toString());
  const items = data.tasks || [];

  // מיון לפי סטטוס: לטיפול → בתהליך → בוצע/בוטל
  const order = { 'לטיפול': 0, 'בתהליך': 1, 'בוצע': 2, 'בוטל': 3 };
  items.sort((a,b) => (order[a.status]??9) - (order[b.status]??9));

  // ספירה לסיכום
  const counts = { 'לטיפול':0, 'בתהליך':0, 'בוצע':0, 'בוטל':0 };
  items.forEach(t => counts[t.status] = (counts[t.status]||0) + 1);
  els.stats.textContent = `לטיפול: ${counts['לטיפול']||0} | בתהליך: ${counts['בתהליך']||0} | בוצע: ${counts['בוצע']||0} | בוטל: ${counts['בוטל']||0}`;

  els.list.innerHTML = items.map(t => {
    const isFocus = focusId && String(t.caseId) === String(focusId);
    return `
      <div class="result-item" data-id="${escapeHTML(String(t.caseId))}" style="${isFocus?'outline:2px solid #2563eb;':''}">
        <div>
          <div><strong>${escapeHTML(t.subject || '(ללא כותרת)')}</strong></div>
          <div class="result-meta">#${escapeHTML(t.caseId)} • ${escapeHTML(t.fullName||'')} • ${escapeHTML(t.phone||'')}</div>
          <div class="result-meta">סטטוס: ${escapeHTML(t.status)} • מטפל: ${escapeHTML(t.owner||'לא משויך')}</div>
        </div>
        <button class="btn" data-open="${escapeHTML(String(t.caseId))}">פתח</button>
      </div>
    `;
  }).join('');

  // הזרקת מאזינים לכפתורי "פתח"
  els.list.querySelectorAll('button[data-open]').forEach(btn => {
    btn.addEventListener('click', () => openDialog(btn.dataset.open));
  });

  // אם יש focusId – פתח את המשימה אוטומטית
  if (focusId) {
    const btn = els.list.querySelector(`button[data-open="${CSS.escape(String(focusId))}"]`);
    if (btn) btn.click();
  }
}

function openDialog(caseId) {
  // שליפת הנתונים מהכרטיס ברשימה
  const row = els.list.querySelector(`.result-item[data-id="${CSS.escape(caseId)}"]`);
  if (!row) return;

  const title = row.querySelector('strong')?.textContent || '(ללא כותרת)';
  const metaText = row.querySelectorAll('.result-meta')[1]?.textContent || '';
  const statusMatch = metaText.match(/סטטוס: ([^•]+) •/);
  const ownerMatch  = metaText.match(/מטפל: (.+)$/);

  const namePhone = row.querySelectorAll('.result-meta')[0]?.textContent || '';
  const nameMatch = namePhone.split('•')[1]?.trim() || '';
  const phoneMatch= namePhone.split('•')[2]?.trim() || '';

  els.dlg.showModal();
  document.getElementById('dlgTitle').textContent = title;
  els.f_caseId.value = caseId;
  els.f_status.value = (statusMatch && statusMatch[1].trim()) || 'לטיפול';
  els.f_owner.value  = (ownerMatch && ownerMatch[1].trim() === 'לא משויך') ? '' : (ownerMatch && ownerMatch[1].trim()) || '';
  els.f_name.value   = nameMatch.replace(/^#\S+\s•\s/, '');
  els.f_phone.value  = phoneMatch;
  els.f_notes.value  = ''; // נטען ערך מדויק בקריאה ייעודית אם נרצה; כרגע כבר קיבלנו את adminNotes ב-GET, אפשר לשמור אותו בדאטה-אטטריביוט אם תרצה
}

async function saveTask() {
  const caseId = els.f_caseId.value;
  const body = {
    status: els.f_status.value,
    owner:  els.f_owner.value,
    adminNotes: els.f_notes.value
  };
  const url = `${BASE_URL}?path=tasks/${encodeURIComponent(caseId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json();

  // Toast + ריענון, המודאל נשאר פתוח
  showToast('עודכן בהצלחה');
  await loadTasks();
}

function showToast(msg) {
  // טוסט מינימלי
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.position='fixed'; t.style.bottom='16px'; t.style.right='16px';
  t.style.background='#111'; t.style.color='#fff'; t.style.padding='10px 14px';
  t.style.borderRadius='10px'; t.style.opacity='0.95'; t.style.zIndex='9999';
  document.body.appendChild(t);
  setTimeout(()=> t.remove(), 1800);
}

// אירועים
els.btnSearch.addEventListener('click', loadTasks);
els.search.addEventListener('keydown', e => { if (e.key==='Enter') loadTasks(); });
els.btnClear.addEventListener('click', () => { els.search.value=''; loadTasks(); });
els.btnSave.addEventListener('click', saveTask);
els.btnClose.addEventListener('click', () => els.dlg.close());

// טעינה ראשונית
loadTasks().catch(console.error);