/* /tasks/tasks.js — V8 (hero from tasks, robust top-loader, no-cache) */

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
  const res  = await fetch(url, { credentials: 'omit', cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  try { return JSON.parse(text); } catch { throw new Error('Bad JSON'); }
}

/* ===== Top loader (spinner) ===== */
let topLoaderEl = document.getElementById('topLoader');
if (!topLoaderEl) {
  // אם לא קיים ב-HTML – ניצור אותו כדי שתמיד יופיע הספינר
  topLoaderEl = document.createElement('div');
  topLoaderEl.id = 'topLoader';
  topLoaderEl.className = 'top-loader';
  topLoaderEl.hidden = true;
  document.body.prepend(topLoaderEl);
}
let _loaderCount = 0;
function topLoad(on){
  _loaderCount += on ? 1 : -1;
  if (_loaderCount < 0) _loaderCount = 0;
  topLoaderEl.hidden = _loaderCount === 0;
}

/* ===== נרמול סטטוס לבאקטים לוגיים ===== */
const STATUS_TO_BUCKET = {
  'לטיפול':'todo','בטיפול':'todo','todo':'todo','to-do':'todo','to do':'todo',
  'בתהליך':'inp','בתהליך עבודה':'inp','in progress':'inp','in_progress':'inp','in-progress':'inp','inp':'inp'
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

  // Hero
  heroWrap:  document.getElementById('heroStats'),
  statTodo:  document.getElementById('statTodo'),
  statInp:   document.getElementById('statInp'),
};

/* ===== אגרגציה מתוך כל המשימות (כולל owner ריק/—/–) ===== */
function aggregateFromTasks(list){
  const agg = {
    totals: { todo:0, inProgress:0 },
    owners: {} // { '<ownerLabel>': { todo, inp } }
  };

  for (const t of list) {
    const bucket = bucketStatus(t.status);
    if (bucket !== 'todo' && bucket !== 'inp') continue;

    // owner: ריק/undefined/–/— → "לא משויך"
    const rawOwner = norm(t.owner);
    const ownerLabel = (!rawOwner || rawOwner === '-' || rawOwner === '—') ? 'לא משויך' : rawOwner;

    // totals
    if (bucket === 'todo') agg.totals.todo++;
    else if (bucket === 'inp') agg.totals.inProgress++;

    // per owner
    if (!agg.owners[ownerLabel]) agg.owners[ownerLabel] = { todo:0, inp:0 };
    if (bucket === 'todo') agg.owners[ownerLabel].todo++;
    else agg.owners[ownerLabel].inp++;
  }

  return agg;
}

/* ===== טוען את כל המשימות → מעדכן Hero + בועות ===== */
async function loadAllForStats(){
  const u = new URL(BASE_URL);
  u.searchParams.set('path','tasks');     // בלי owner -> כל המשימות
  u.searchParams.set('_', Date.now());    // שובר קאש

  topLoad(true);
  try {
    const data = await fetchJSON(u.toString());
    const list = Array.isArray(data.tasks) ? data.tasks : [];
    const agg  = aggregateFromTasks(list);

    // --- Hero: נתוני אמת ---
    window.tasksStats = { totals: { todo: agg.totals.todo, inProgress: agg.totals.inProgress } };
    if (els.statTodo) els.statTodo.textContent = agg.totals.todo;
    if (els.statInp)  els.statInp.textContent  = agg.totals.inProgress;
    if (els.heroWrap) els.heroWrap.hidden = false;

    // --- Bubbles ---
    const get = (name, key) => (agg.owners[name]?.[key] ?? 0);
    if (els.u_todo)    els.u_todo.textContent    = get('לא משויך','todo');
    if (els.u_inp)     els.u_inp.textContent     = get('לא משויך','inp');
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

    // אירוע למאזינים חיצוניים (אם יש)
    window.dispatchEvent(new CustomEvent('tasks:stats', { detail: agg }));
    if (typeof window.__updateHeroFromStats === 'function') window.__updateHeroFromStats();
  } catch (e) {
    console.error('[tasks] loadAllForStats failed:', e);
  } finally {
    topLoad(false);
  }
}

/* ===== Global Search ===== */
async function runGlobalSearch() {
  const q = norm(els.searchInput?.value);
  if (!q) {
    if (els.resultsBox) els.resultsBox.style.display = 'none';
    if (els.resultsList) els.resultsList.innerHTML = '';
    return;
  }

  const u = new URL(BASE_URL);
  u.searchParams.set('path', 'tasks');
  u.searchParams.set('q', q);
  u.searchParams.set('_', Date.now()); // שובר קאש

  topLoad(true);
  try {
    const data = await fetchJSON(u.toString());
    const list = Array.isArray(data.tasks) ? data.tasks : [];

    if (els.resultsCount) els.resultsCount.textContent = `נמצאו ${list.length} תוצאות`;
    if (els.resultsList) {
      els.resultsList.innerHTML = list.map(t => {
        const rawOwner = norm(t.owner);
        const ownerLabel = (!rawOwner || rawOwner==='-' || rawOwner==='—') ? 'לא משויך' : rawOwner;
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
    }

    if (els.resultsBox) els.resultsBox.style.display = 'block';
  } catch (e) {
    console.error('[tasks] search failed:', e);
  } finally {
    topLoad(false);
  }
}

/* ===== Events ===== */
els.btnSearch?.addEventListener('click', runGlobalSearch);
els.searchInput?.addEventListener('keydown', e => { if (e.key === 'Enter') runGlobalSearch(); });
els.btnClear?.addEventListener('click', () => {
  if (els.searchInput) els.searchInput.value = '';
  if (els.resultsBox) els.resultsBox.style.display = 'none';
  if (els.resultsList) els.resultsList.innerHTML = '';
});

/* ===== Init + Refresh hook ===== */
window.__loadStatsPromise = loadAllForStats();
window.reloadTasksStats   = async () => loadAllForStats();