/* /tasks/owner.js — V13 (Hero + spinner, owner=all/unassigned, status filter, no-cache) */
const BASE_URL =
  'https://script.google.com/macros/s/AKfycbybBJXB1vTEv9EDjyRXJnU674ZSCoUCT5MB9g9CTbDAiLKWn5iMAWSjC2XXLN4_ZdOhRw/exec';

/* Helpers */
const qs = new URLSearchParams(location.search);
const DEBUG = qs.get('debug') === '1';

function norm(s){ return String(s ?? '').replace(/[\u200E\u200F\u202A-\u202E]/g,'').replace(/\u00A0/g,' ').replace(/\s+/g,' ').trim(); }
function escapeHTML(s){ return String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function show(el){ el.style.display='block'; } function hide(el){ el.style.display='none'; }

async function fetchJSON(url){
  const res  = await fetch(url, { credentials:'omit', cache:'no-store' });
  const text = await res.text();
  if(DEBUG) appendDebug('GET '+url, text, res.status);
  if(!res.ok) throw new Error(text || `HTTP ${res.status}`);
  try { return JSON.parse(text); } catch { throw new Error('Bad JSON'); }
}

/* Top loader + hero spinner */
let topLoaderEl = document.getElementById('topLoader');
if(!topLoaderEl){
  topLoaderEl = document.createElement('div');
  topLoaderEl.id='topLoader'; topLoaderEl.className='top-loader'; topLoaderEl.hidden=true;
  document.body.prepend(topLoaderEl);
}
let _lc = 0;
function topLoad(on){ _lc += on?1:-1; if(_lc<0) _lc=0; topLoaderEl.hidden = _lc===0; }
const heroSpinner = document.getElementById('ownerHeroSpinner');
function heroLoad(on){ if(heroSpinner) heroSpinner.hidden = !on; }

/* Elements */
const ownerParam = norm(decodeURIComponent(qs.get('owner') || 'unassigned')); // 'all' | 'unassigned' | שם
const statusParam = norm((qs.get('status') || '').toLowerCase());             // 'todo' | 'inp' | ''

const els = {
  title: document.getElementById('ownerTitle'),
  statsText: document.getElementById('ownerStats'),
  list:  document.getElementById('tasksList'),
  search: document.getElementById('ownerSearch'),
  btnSearch: document.getElementById('btnOwnerSearch'),
  btnClear:  document.getElementById('btnOwnerClear'),
  btnRefresh: document.getElementById('btnOwnerRefresh'),
  loader: document.getElementById('loader'),
  errBox: document.getElementById('errBox'),
  dlg: document.getElementById('taskDialog'),
  f_status: document.getElementById('f_status'),
  f_owner:  document.getElementById('f_owner'),
  f_name:   document.getElementById('f_name'),
  f_phone:  document.getElementById('f_phone'),
  f_notes:  document.getElementById('f_notes'),
  f_caseId: document.getElementById('f_caseId'),
  btnSave:  document.getElementById('btnSave'),
  btnClose: document.getElementById('btnClose'),
  // hero stats
  heroStatsWrap: document.getElementById('ownerHeroStats'),
  ownerStatTodo: document.getElementById('ownerStatTodo'),
  ownerStatInp:  document.getElementById('ownerStatInp'),
  linkOwnerTodo: document.getElementById('linkOwnerTodo'),
  linkOwnerInp:  document.getElementById('linkOwnerInp'),
};

/* Debug panel (optional, ?debug=1) */
let dbg;
function ensureDebug(){
  if(!DEBUG || dbg) return;
  dbg = document.createElement('pre');
  dbg.style.cssText = 'position:fixed;left:8px;bottom:8px;max-height:40vh;max-width:90vw;overflow:auto;background:#0b1020;color:#9fe; padding:8px 10px;border-radius:8px; font:12px/1.45 ui-monospace,monospace; z-index:9999';
  document.body.appendChild(dbg);
}
function appendDebug(title, payload, status){
  ensureDebug();
  if(!DEBUG) return;
  const time = new Date().toLocaleTimeString();
  dbg.textContent += `\n[${time}] ${title} (status ${status})\n${payload}\n`;
}

/* Title */
els.title.textContent =
  `משימות – ${
    ownerParam === 'unassigned' ? 'לא משויך' :
    ownerParam === 'all' ? 'כל המשימות' : ownerParam
  }${ statusParam ? ` – ${statusParam==='todo'?'לטיפול':'בתהליך'}` : '' }`;

/* Status mapping */
const STATUS_FILTERS = {
  todo: new Set(['לטיפול','בטיפול','todo','to-do','to do']),
  inp:  new Set(['בתהליך','בתהליך עבודה','in progress','in_progress','in-progress','inp'])
};

/* Build owner-safe URL for pills */
function setPillLinks(){
  const base = './owner.html';
  const owner = ownerParam || 'all';
  if (els.linkOwnerTodo)
    els.linkOwnerTodo.href = `${base}?owner=${encodeURIComponent(owner)}&status=todo`;
  if (els.linkOwnerInp)
    els.linkOwnerInp.href  = `${base}?owner=${encodeURIComponent(owner)}&status=inp`;
}
setPillLinks();

/* Load tasks */
async function loadTasks(){
  try{
    hide(els.errBox); show(els.loader); els.list.innerHTML = '';
    topLoad(true); heroLoad(true);

    const q = norm(els.search.value);
    const u = new URL(BASE_URL);
    u.searchParams.set('path','tasks');
    // owner handling
    if (ownerParam === 'unassigned') {
      u.searchParams.set('owner','unassigned');
    } else if (ownerParam !== 'all') {
      u.searchParams.set('owner', ownerParam);
    }
    if(q) u.searchParams.set('q', q);
    u.searchParams.set('_', Date.now()); // break cache

    const data = await fetchJSON(u.toString());
    let items = Array.isArray(data.tasks) ? data.tasks : [];

    // filter by status
    if (statusParam && STATUS_FILTERS[statusParam]) {
      const set = STATUS_FILTERS[statusParam];
      items = items.filter(t => set.has(norm(t.status)));
    }

    // sort by status order
    const order = {'לטיפול':0,'בטיפול':0,'בתהליך':1,'בוצע':2,'בוטל':3};
    items.sort((a,b)=>(order[a.status]??9)-(order[b.status]??9));

    // counters
    const counts = {'לטיפול':0,'בתהליך':0,'בוצע':0,'בוטל':0};
    items.forEach(t=> counts[t.status]=(counts[t.status]||0)+1);

    // header text and hero pills
    els.statsText.textContent =
      `לטיפול: ${counts['לטיפול']||0} | בתהליך: ${counts['בתהליך']||0} | בוצע: ${counts['בוצע']||0} | בוטל: ${counts['בוטל']||0}`;
    if (els.ownerStatTodo) els.ownerStatTodo.textContent = counts['לטיפול'] || 0;
    if (els.ownerStatInp)  els.ownerStatInp.textContent  = counts['בתהליך'] || 0;
    if (els.heroStatsWrap) els.heroStatsWrap.hidden = false;

    // empty state
    if(!items.length){
      els.list.innerHTML = `<div class="card muted">אין משימות לתצוגה.</div>`;
      return;
    }

    // render
    els.list.innerHTML = items.map(t=>{
      const ownerLabel = norm(t.owner) ? t.owner : 'לא משויך';
      return `
        <div class="result-item" data-id="${escapeHTML(String(t.caseId))}"
             data-task='${escapeHTML(JSON.stringify(t))}'>
          <div>
            <div><strong>${escapeHTML(t.subject ?? '(ללא כותרת)')}</strong></div>
            <div class="result-meta">#${escapeHTML(t.caseId)} • ${escapeHTML(t.fullName ?? '')} • ${escapeHTML(t.phone ?? '')}</div>
            <div class="result-meta">סטטוס: ${escapeHTML(t.status ?? '')} • מטפל: ${escapeHTML(ownerLabel)}</div>
          </div>
          <button class="btn" data-open="${escapeHTML(String(t.caseId))}">פתח</button>
        </div>`;
    }).join('');

    // open dialog handlers
    els.list.querySelectorAll('button[data-open]').forEach(btn=>{
      btn.addEventListener('click', ()=> openDialog(btn.dataset.open));
    });

    // focus by id (if exists)
    const focusId = norm(qs.get('focus') || '');
    if(focusId){
      const btn = els.list.querySelector(`button[data-open="${CSS.escape(String(focusId))}"]`);
      if(btn) btn.click();
    }
  }catch(err){
    els.errBox.textContent = `שגיאת טעינה מהשרת: ${err.message || err}`;
    show(els.errBox);
    appendDebug('LOAD ERROR', String(err), 