/* /tasks/tasks.js — V5 (totals from tasks, counts include empty owner, refresh hook) */

/* ===== CONFIG ===== */
const BASE_URL =
  'https://script.google.com/macros/s/AKfycbybBJXB1vTEv9EDjyRXJnU674ZSCoUCT5MB9g9CTbDAiLKWn5iMAWSjC2XXLN4_ZdOhRw/exec';
window.BASE_URL = BASE_URL;

/* ===== Helpers ===== */
function norm(s) {
  return String(s ?? '')
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
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
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  try { return JSON.parse(text); }
  catch { throw new Error('Bad JSON'); }
}

/* נרמול סטטוס לבאקטים לוגיים */
const STATUS_TO_BUCKET = {
  'לטיפול':'todo', 'בטיפול':'todo', 'todo':'todo', 'to-do':'todo', 'to do':'todo',
  'בתהליך':'inp', 'בתהליך עבודה':'inp', 'in progress':'inp','in_progress':'inp','in-progress':'inp','inp':'inp'
};
function bucketStatus(s){ return STATUS_TO_BUCKET[norm(s).toLowerCase()] || norm(s); }

/* ===== Elements ===== */
const els = {
  // חיפוש
  searchInput:  document.getElementById('globalSearch'),
  btnSearch:    document.getElementById('btnSearch'),
  btnClear:     document.getElementById('btnClear'),
  resultsBox:   document.getElementById('searchResults'),
  resultsList:  document.getElementById('resultsList'),
  resultsCount: document.getElementById('searchCount'),

  // Counters (bubbles)
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

/* ===== חישוב סיכומים מתוך /tasks (כולל owner ריק) ===== */
function aggregateFromTasks(list){
  const agg = {
    totals: { todo:0, inProgress:0 },
    owners: {} // { '<ownerLabel>': { todo, inp } }
  };

  for (const t of list) {
    const bucket = bucketStatus(t.status);
    if (bucket !== 'todo' && bucket !== 'inp') continue;

    // בעלים: אם ריק/undefined/— → "לא משויך"
    const rawOwner = (t.owner ?? '').trim();
    const ownerLabel = rawOwner ? rawOwner : 'לא משויך';

    // totals
    if (bucket === 'todo') agg.totals.todo++;
    else if (bucket === 'inp') agg.totals.inProgress++;

    // per owner
    if (!agg.owners[ownerLabel]) agg.owners[ownerLabel] = { todo:0, inp:0 };
    agg.owners[ownerLabel][bucket === 'todo' ? 'todo' : 'inp']++;
  }

  return agg;
}

/* ===== טוען את כל המשימות לצורך סיכומים ובועות ===== */
async function loadAllForStats(){
  const u = new URL(BASE_URL);
  u.searchParams.set('path','tasks'); // בלי owner -> כל המשימות
  const data = await fetchJSON(u.toString());
  const list = Array.isArray(data.tasks) ? data.tasks : [];
  const agg  = aggregateFromTasks(list);

  // חשיפה ל-Hero
  window.tasksStats = { totals: { todo: agg.totals.todo, inProgress: agg.totals.inProgress } };

  // עדכון בועות
  const get = (name, key) => (agg.owners[name]?.[key] ?? 0);
  if (els.u_todo)  els.u_todo.textContent  = get('לא משויך','todo');
  if (els.u_inp)   els.u_inp.textContent   = get('לא משויך','inp');
  if (els.chen_todo) els.chen_todo.textContent = get('חן','todo');
  if (els.chen_inp)  els.chen_inp.textContent  = get('חן','inp');
  if (els.tam_todo)  els.tam_todo.textContent  = get('תמרה','todo');
  if (els.tam_inp)   els.tam_inp.textContent   = get('תמרה','inp');
  if (els.bel_todo)  els.bel_todo.textContent  = get('בלה','todo');
  if (els.bel_inp)   els.bel_inp.textContent   = get('בלה','inp');
  if (els.lio_todo)  els.lio_todo.textContent  = get('ליאור','todo');
  if (els.lio_inp)   els.lio_inp.textContent   = get('ליאור','inp');
  if (els.net_todo)  els.net_todo.textContent  = get('נטע','todo');
  if (els.net_inp)   els.net_inp.textContent   = get('נטע','inp');

  // אם ל-Hero יש סקריפט שמאזין – יעדכן מיד
  if (typeof window.__updateHeroFromStats === 'function') {
    window.__updateHeroFromStats();
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
    const ownerLabel = (t.owner && t.owner.trim()) ? t.owner : 'לא משויך';
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

/* ===== Init + Refresh hook ===== */
window.__loadStatsPromise = loadAllForStats().catch(err => console.error('stats load failed:', err));
window.reloadTasksStats = async () => loadAllForStats();