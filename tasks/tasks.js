/* /tasks/tasks.js — V3 (חוסן ושקט תעשייתי) */

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

/* ===== Elements ===== */
const els = {
  searchInput:  document.getElementById('globalSearch'),
  btnSearch:    document.getElementById('btnSearch'),
  btnClear:     document.getElementById('btnClear'),
  resultsBox:   document.getElementById('searchResults'),
  resultsList:  document.getElementById('resultsList'),
  resultsCount: document.getElementById('searchCount'),

  // Counters
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
  // דוגמה: { "חן":{לטיפול:1,בתהליך:0}, "תמרה":{...}, "לא משויך":{...} }

  // --- סיכום עליון מכל הבעלים ---
  let totalTodo = 0, totalInp = 0;
  for (const owner of Object.keys(data)) {
    const o = data[owner] || {};
    totalTodo += Number(o['לטיפול']  ?? 0);
    totalInp  += Number(o['בתהליך'] ?? 0);
  }
  els.u_todo.textContent = totalTodo;
  els.u_inp.textContent  = totalInp;

  // --- ספציפיים לבעלים ---
  const get = (ownerName, key) => (data[ownerName] && data[ownerName][key]) || 0;

  els.chen_todo.textContent = get('חן', 'לטיפול');
  els.chen_inp.textContent  = get('חן', 'בתהליך');
  els.tam_todo.textContent  = get('תמרה', 'לטיפול');
  els.tam_inp.textContent   = get('תמרה', 'בתהליך');
  els.bel_todo.textContent  = get('בלה', 'לטיפול');
  els.bel_inp.textContent   = get('בלה', 'בתהליך');
  els.lio_todo.textContent  = get('ליאור', 'לטיפול');
  els.lio_inp.textContent   = get('ליאור', 'בתהליך');
  els.net_todo.textContent  = get('נטע', 'לטיפול');
  els.net_inp.textContent   = get('נטע', 'בתהליך');
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
els.btnSearch.addEventListener('click', runGlobalSearch);
els.searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') runGlobalSearch(); });
els.btnClear.addEventListener('click', () => {
  els.searchInput.value = '';
  els.resultsBox.style.display = 'none';
  els.resultsList.innerHTML = '';
});

/* ===== Init ===== */
loadStats().catch(err => console.error('loadStats failed:', err));