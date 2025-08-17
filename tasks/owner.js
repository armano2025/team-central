/* /tasks/owner.js — V8 (שמירה יציבה בלי Preflight) */

/* ===== CONFIG ===== */
const BASE_URL =
  'https://script.google.com/macros/s/AKfycbybBJXB1vTEv9EDjyRXJnU674ZSCoUCT5MB9g9CTbDAiLKWn5iMAWSjC2XXLN4_ZdOhRw/exec';

/* ===== Helpers ===== */
function norm(s) {
  return String(s ?? '')
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '') // תווי כיווניות
    .replace(/\u00A0/g, ' ')                      // NBSP -> space
    .replace(/\s+/g, ' ')                         // איחוד רווחים
    .trim();
}
function escapeHTML(s) {
  const str = String(s ?? '');
  return str.replace(/[&<>"']/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]
  ));
}
function show(el){ el.style.display='block'; }
function hide(el){ el.style.display='none'; }

async function fetchJSON(url) {
  const res  = await fetch(url, { credentials: 'omit' });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  try { return JSON.parse(text); }
  catch { throw new Error('Bad JSON from server'); }
}

/* ===== Query & Elements ===== */
const qs = new URLSearchParams(location.search);
const ownerParam = norm(decodeURIComponent(qs.get('owner') || 'unassigned')); // "בלה" | "unassigned"
const focusId    = norm(qs.get('focus') || '');

const els = {
  title:    document.getElementById('ownerTitle'),
  stats:    document.getElementById('ownerStats'),
  list:     document.getElementById('tasksList'),
  search:   document.getElementById('ownerSearch'),
  btnSearch:document.getElementById('btnOwnerSearch'),
  btnClear: document.getElementById('btnOwnerClear'),
  loader:   document.getElementById('loader'),
  errBox:   document.getElementById('errBox'),

  dlg:      document.getElementById('taskDialog'),
  f_status: document.getElementById('f_status'),
  f_owner:  document.getElementById('f_owner'),
  f_name:   document.getElementById('f_name'),
  f_phone:  document.getElementById('f_phone'),
  f_notes:  document.getElementById('f_notes'),
  f_caseId: document.getElementById('f_caseId'),
  btnSave:  document.getElementById('btnSave'),
  btnClose: document.getElementById('btnClose'),
};

els.title.textContent = `משימות – ${ownerParam === 'unassigned' ? 'לא משויך' : ownerParam}`;

/* ===== Load tasks ===== */
async function loadTasks() {
  try {
    hide(els.errBox);
    show(els.loader);
    els.list.innerHTML = '';

    const q = norm(els.search.value);
    const u = new URL(BASE_URL);
    u.searchParams.set('path', 'tasks');
    u.searchParams.set('owner', ownerParam === 'unassigned' ? 'unassigned' : ownerParam);
    if (q) u.searchParams.set('q', q);

    const data  = await fetchJSON(u.toString());
    const items = Array.isArray(data.tasks) ? data.tasks : [];

    // סדר סטטוסים: לטיפול → בתהליך → בוצע → בוטל
    const order = { 'לטיפול':0, 'בתהליך':1, 'בוצע':2, 'בוטל':3 };
    items.sort((a,b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

    // מונה
    const counts = { 'לטיפול':0, 'בתהליך':0, 'בוצע':0, 'בוטל':0 };
    items.forEach(t => counts[t.status] = (counts[t.status] || 0) + 1);
    els.stats.textContent =
      `לטיפול: ${counts['לטיפול']||0} | בתהליך: ${counts['בתהליך']||0} | בוצע: ${counts['בוצע']||0} | בוטל: ${counts['בוטל']||0}`;

    if (!items.length) {
      els.list.innerHTML = `<div class="card muted">אין משימות לתצוגה.</div>`;
      return;
    }

    // רינדור
    els.list.innerHTML = items.map(t => {
      const ownerLabel = t.owner || 'לא משויך';
      return `
        <div class="result-item"
             data-id="${escapeHTML(String(t.caseId))}"
             data-task='${escapeHTML(JSON.stringify(t))}'
             ${focusId && String(t.caseId)===focusId ? 'style="outline:2px solid #2563eb;"' : ''}>
          <div>
            <div><strong>${escapeHTML(t.subject ?? '(ללא כותרת)')}</strong></div>
            <div class="result-meta">#${escapeHTML(t.caseId)} • ${escapeHTML(t.fullName ?? '')} • ${escapeHTML(t.phone ?? '')}</div>
            <div class="result-meta">סטטוס: ${escapeHTML(t.status ?? '')} • מטפל: ${escapeHTML(ownerLabel)}</div>
          </div>
          <button class="btn" data-open="${escapeHTML(String(t.caseId))}">פתח</button>
        </div>
      `;
    }).join('');

    // מאזיני פתיחה
    els.list.querySelectorAll('button[data-open]').forEach(btn => {
      btn.addEventListener('click', () => openDialog(btn.dataset.open));
    });

    // פתיחה אוטומטית לפי focus
    if (focusId) {
      const btn = els.list.querySelector(`button[data-open="${CSS.escape(String(focusId))}"]`);
      if (btn) btn.click();
    }
  } catch (err) {
    console.error(err);
    els.errBox.textContent = `שגיאת טעינה מהשרת: ${err.message || err}`;
    show(els.errBox);
  } finally {
    hide(els.loader);
  }
}

/* ===== Dialog open ===== */
function openDialog(caseId) {
  const row = els.list.querySelector(`.result-item[data-id="${CSS.escape(String(caseId))}"]`);
  if (!row) return;
  const t = JSON.parse(row.dataset.task || '{}');

  document.getElementById('dlgTitle').textContent = t.subject || '(ללא כותרת)';
  els.f_caseId.value = t.caseId ?? '';
  els.f_status.value = t.status ?? 'לטיפול';
  els.f_owner.value  = (t.owner === 'לא משויך' ? '' : (t.owner ?? ''));
  els.f_name.value   = t.fullName ?? '';
  els.f_phone.value  = t.phone ?? '';
  els.f_notes.value  = t.adminNotes ?? '';

  els.dlg.showModal();
}

/* ===== Save (PATCH) – text/plain to avoid CORS preflight ===== */
async function saveTask() {
  const caseId = els.f_caseId.value;
  const body = {
    status: els.f_status.value,
    owner:  els.f_owner.value,
    adminNotes: els.f_notes.value
  };

  try {
    els.btnSave.disabled = true;

    const url = `${BASE_URL}?path=tasks/${encodeURIComponent(caseId)}`;
    const res = await fetch(url, {
      method: 'POST',
      // שים לב: לא application/json כדי למנוע OPTIONS (preflight)
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(body),
      credentials: 'omit'
    });

    const text = await res.text();
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

    const json = JSON.parse(text);
    if (json && json.error) throw new Error(json.error);

    showToast('עודכן בהצלחה');
    await loadTasks(); // רענון אחרי שמירה
  } catch (err) {
    console.error('saveTask failed:', err);
    showToast('שמירה נכשלה');
  } finally {
    els.btnSave.disabled = false;
  }
}

/* ===== Toast ===== */
function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.position='fixed'; t.style.bottom='16px'; t.style.right='16px';
  t.style.background='#111'; t.style.color='#fff'; t.style.padding='10px 14px';
  t.style.borderRadius='10px'; t.style.opacity='0.95'; t.style.zIndex='9999';
  document.body.appendChild(t);
  setTimeout(()=> t.remove(), 1800);
}

/* ===== Events ===== */
els.btnSearch.addEventListener('click', loadTasks);
els.search.addEventListener('keydown', e => { if (e.key === 'Enter') loadTasks(); });
els.btnClear.addEventListener('click', () => { els.search.value=''; loadTasks(); });
els.btnSave.addEventListener('click', saveTask);
els.btnClose.addEventListener('click', () => els.dlg.close());

/* ===== Init ===== */
loadTasks();