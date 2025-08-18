/* /tasks/tasks.js — V3 (חוסן ושקט תעשייתי) */

/* ===== CONFIG ===== */
const BASE_URL =
  'https://script.google.com/macros/s/AKfycbybBJXB1vTEv9EDjyRXJnU674ZSCoUCT5MB9g9CTbDAiLKWנ5iMAWSjC2XXLN4_ZdOhRw/exec';

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
async function fetchJSON(url) {
  const res  = await fetch(url, { credentials: 'omit' });
  const text = await res.text();
  if (!res.ok) {
    console.error('API error:', res.status, text);
    throw new Error(text || `HTTP ${res.status}`);
  }
  try { return JSON.parse(text); }
  catch {
    console.error('Bad JSON from API:', text);
    throw new Error('Bad JSON');
  }
}

/* === Helpers נוספים לנורמליזציה (סטטוסים/בעלים) === */
// מיפוי וריאציות של סטטוסים לערכים לוגיים אחידים
const STATUS_MAP = {
  // עברית
  'לטיפול': 'todo',
  'בטיפול': 'todo',
  'בתהליך': 'inp',
  'בתהליך עבודה': 'inp',
  // אנגלית/קיצורים
  'todo': 'todo',
  'to-do': 'todo',
  'to do': 'todo',
  'in progress': 'inp',
  'in_progress': 'inp',
  'in-progress': 'inp',
  'inp': 'inp'
};

// מנרמל מפתח סטטוס גולמי לערך אחיד
function normalizeStatusKey(rawKey) {
  const k = norm(rawKey).toLowerCase();
  return STATUS_MAP[k] || k; // אם לא מצא – מחזיר את המחרוזת (אחרי נרמול)
}

// מאתר את המפתח המדויק של בעלים בתוך data לפי שם מבוקש (אחרי נרמול)
function findOwnerKey(data, wanted) {
  const wantedNorm = norm(wanted);
  for (const key of Object.keys(data || {})) {
    if (norm(key) === wantedNorm) return key;
  }
  // כיסוי ל"לא משויך"
  if (wantedNorm === 'לא משויך') {
    const candidates = ['', 'לא משויך', 'unassigned', '—', '-'];
    for (const key of Object.keys(data || {})) {
      if (candidates.includes(norm(key))) return key;
    }
  }
  return null;
}

// מחזיר ספירה לפי בעלים+סטטוס (עם נורמליזציה של מפתחות בתוך האובייקט)
function getCountByOwnerAndStatus(data, ownerWanted, statusWanted) {
  const ownerKey = findOwnerKey(data, ownerWanted);
  if (!ownerKey) return 0;
  const o = data[ownerKey] || {};
  const wantedNorm = normalizeStatusKey(statusWanted);
  let sum = 0;
  for (const [rawKey, val] of Object.entries(o)) {
    if (normalizeStatusKey(rawKey) === wantedNorm) {
      sum += Number(val || 0);
    }
  }
  return sum;
}

/* ===== Elements ===== */
const els = {
  searchInput:  document.getElementById('globalSearch'),
  btnSearch:    document.getElementById('btnSearch'),
  btnClear:     document.getElementById('btnClear'),
  resultsBox:   document.getElementById('searchResults'),
  resultsList:  document.getElementById('resultsList'),
  resultsCount: document.getElementById('searchCount'),

  // Counters (Hero + Owners)
  u_todo:    document.getElementById('u_todo'),
  u_inp:     document.getElementById('u_inp'),
  chen_todo: document.getElementById('chen_todo'),
  chen_inp:  document.getElementById('chen_inp'),
  tam_todo:  document.getElementById('tam_todo'),
  tam_inp:   document.getElementById('tam_inp'),
  bel_todo:  document.getElementById('bel_todo'),
  bel_inp:   document.getElementById('bel_inp'),
  lio_todo:  document.getElementById('lio_todo'),
  lio_inp:   document.getElementById('lio_inp'),
  net_todo:  document.getElementById('net_todo'),
  net_inp:   document.getElementById('net_inp'),
};

/* ===== Stats ===== */
async function loadStats() {
  const u = new URL(BASE_URL);
  u.searchParams.set('path', 'stats');

  const data = await fetchJSON(u.toString());

  // לוג מפורט לראות בדיוק מה מגיע מה־API (פתח קונסול)
  console.log('[tasks] Raw stats data:', JSON.stringify(data, null, 2));

  // --- סיכום עליון: סכום כל הבעלים אחרי נורמליזציה של סטטוסים ---
  let totalTodo = 0, totalInp = 0;
  for (const ownerKey of Object.keys(data || {})) {
    const bucket = data[ownerKey] || {};
    for (const [rawStatusKey, val] of Object.entries(bucket)) {
      const nk = normalizeStatusKey(rawStatusKey);
      const n = Number(val || 0);
      if (nk === 'todo') totalTodo += n;
      else if (nk === 'inp') totalInp += n;
    }
  }
  if (els.u_todo) els.u_todo.textContent = totalTodo;
  if (els.u_inp)  els.u_inp.textContent  = totalInp;

  // --- ספציפיים לבעלים (נורמליזציה גם כאן) ---
  if (els.chen_todo) els.chen_todo.textContent = getCountByOwnerAndStatus(data, 'חן', 'לטיפול');
  if (els.chen_inp)  els.chen_inp.textContent  = getCountByOwnerAndStatus(data, 'חן', 'בתהליך');

  if (els.tam_todo) els.tam_todo.textContent = getCountByOwnerAndStatus(data, 'תמרה', 'לטיפול');
  if (els.tam_inp)  els.tam_inp.textContent  = getCountByOwnerAndStatus(data, 'תמרה', 'בתהליך');

  if (els.bel_todo) els.bel_todo.textContent = getCountByOwnerAndStatus(data, 'בלה', 'לטיפול');
  if (els.bel_inp)  els.bel_inp.textContent  = getCountByOwnerAndStatus(data, 'בלה', 'בתהליך');

  if (els.lio_todo) els.lio_todo.textContent = getCountByOwnerAndStatus(data, 'ליאור', 'לטיפול');
  if (els.lio_inp)  els.lio_inp.textContent  = getCountByOwnerAndStatus(data, 'ליאור', 'בתהליך');

  if (els.net_todo) els.net_todo.textContent = getCountByOwnerAndStatus(data, 'נטע', 'לטיפול');
  if (els.net_inp)  els.net_inp.textContent  = getCountByOwnerAndStatus(data, 'נטע', 'בתהליך');

  // דיאגנוסטיקה קצרה: טבלה מסודרת לראות את כל הבעלים והערכים המנורמלים
  try {
    const diag = Object.keys(data || {}).map(ownerKey => {
      const o = data[ownerKey] || {};
      let todo = 0, inp = 0;
      for (const [k, v] of Object.entries(o)) {
        const nk = normalizeStatusKey(k);
        if (nk === 'todo') todo += Number(v || 0);
        else if (nk === 'inp') inp += Number(v || 0);
      }
      return { owner: ownerKey, todo, inp, raw: o };
    });
    console.table(diag);
  } catch (e) {
    console.warn('diag failed:', e);
  }
}

/* ===== Global Search ===== */
async function runGlobalSearch() {
  const q = norm(els.searchInput.value);
  if (!q) {
    els.resultsBox.style.display = 'none';
    els.resultsList.innerHTML = '';
    return;
  }

  const u = new URL(BASE_URL);
  u.searchParams.set('path', 'tasks');
  u.searchParams.set('q', q);

  const data = await fetchJSON(u.toString());
  const list = Array.isArray(data.tasks) ? data.tasks : [];

  els.resultsCount.textContent = `נמצאו ${list.length} תוצאות`;
  els.resultsList.innerHTML = list.map(t => {
    const ownerLabel = t.owner || 'לא משויך';
    const linkOwner  = ownerLabel === 'לא משויך' ? 'unassigned' : encodeURIComponent(ownerLabel);
    const focusId    = encodeURIComponent(String(t.caseId ?? ''));
    return `
      <div class="result-item">
        <div>
          <div><strong>${escapeHTML(t.subject ?? '(ללא כותרת)')}</strong></div>
          <div class="result-meta">
            #${escapeHTML(t.caseId)} • ${escapeHTML(t.fullName ?? '')} • ${escapeHTML(t.phone ?? '')} • ${escapeHTML(ownerLabel)}
          </div>
        </div>
        <a class="btn" href="./owner.html?owner=${linkOwner}&focus=${focusId}">פתח</a>
      </div>
    `;
  }).join('');

  els.resultsBox.style.display = 'block';
}

/* ===== Events ===== */
if (els.btnSearch)  els.btnSearch.addEventListener('click', runGlobalSearch);
if (els.searchInput) els.searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') runGlobalSearch(); });
if (els.btnClear)   els.btnClear.addEventListener('click', () => {
  els.searchInput.value = '';
  els.resultsBox.style.display = 'none';
  els.resultsList.innerHTML = '';
});

/* ===== Init ===== */
loadStats().catch(err => console.error('loadStats failed:', err));