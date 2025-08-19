/* /tasks/tasks.js — V9 (hero spinner + totals from tasks + no-cache) */

/* ===== CONFIG ===== */
const BASE_URL =
  'https://script.google.com/macros/s/AKfycbybBJXB1vTEv9EDjyRXJnU674ZSCoUCT5MB9g9CTbDAiLKWn5iMAWSjC2XXLN4_ZdOhRw/exec';
window.BASE_URL = BASE_URL;

/* ===== Helpers ===== */
function norm(s){ return String(s ?? '').replace(/[\u200E\u200F\u202A-\u202E]/g,'').replace(/\u00A0/g,' ').replace(/\s+/g,' ').trim(); }
function escapeHTML(s){ return String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
async function fetchJSON(url){
  const res = await fetch(url, { credentials:'omit', cache:'no-store' });
  const text = await res.text();
  if(!res.ok) throw new Error(text || `HTTP ${res.status}`);
  try { return JSON.parse(text); } catch { throw new Error('Bad JSON'); }
}

/* ===== Top loader ===== */
let topLoaderEl = document.getElementById('topLoader');
if(!topLoaderEl){
  topLoaderEl = document.createElement('div');
  topLoaderEl.id='topLoader'; topLoaderEl.className='top-loader'; topLoaderEl.hidden=true;
  document.body.prepend(topLoaderEl);
}
let _loaderCount = 0;
function topLoad(on){ _loaderCount += on?1:-1; if(_loaderCount<0) _loaderCount = 0; topLoaderEl.hidden = !_loaderCount; }

/* ===== Hero spinner ===== */
const heroSpinner = document.getElementById('heroSpinner');
function heroLoad(on){ if(heroSpinner) heroSpinner.hidden = !on; }

/* ===== Status buckets ===== */
const STATUS_TO_BUCKET = {
  'לטיפול':'todo','בטיפול':'todo','todo':'todo','to-do':'todo','to do':'todo',
  'בתהליך':'inp','בתהליך עבודה':'inp','in progress':'inp','in_progress':'inp','in-progress':'inp','inp':'inp'
};
function bucketStatus(s){ return STATUS_TO_BUCKET[norm(s).toLowerCase()] || norm(s); }

/* ===== Elements ===== */
const els = {
  // בועות
  u_todo: document.getElementById('u_todo'), u_inp: document.getElementById('u_inp'),
  chen_todo: document.getElementById('chen_todo'), chen_inp: document.getElementById('chen_inp'),
  tam_todo: document.getElementById('tam_todo'),   tam_inp: document.getElementById('tam_inp'),
  bel_todo: document.getElementById('bel_todo'),   bel_inp: document.getElementById('bel_inp'),
  lio_todo: document.getElementById('lio_todo'),   lio_inp: document.getElementById('lio_inp'),
  net_todo: document.getElementById('net_todo'),   net_inp: document.getElementById('net_inp'),

  // Hero
  heroWrap: document.getElementById('heroStats'),
  statTodo: document.getElementById('statTodo'),
  statInp:  document.getElementById('statInp'),
};

/* ===== Aggregate from tasks (includes empty/—/– owners) ===== */
function aggregateFromTasks(list){
  const agg = { totals:{todo:0,inProgress:0}, owners:{} };
  for(const t of list){
    const b = bucketStatus(t.status);
    if(b!=='todo' && b!=='inp') continue;

    const owRaw = norm(t.owner);
    const owner = (!owRaw || owRaw==='-' || owRaw==='—') ? 'לא משויך' : owRaw;

    if(b==='todo') agg.totals.todo++; else agg.totals.inProgress++;
    if(!agg.owners[owner]) agg.owners[owner] = { todo:0, inp:0 };
    if(b==='todo') agg.owners[owner].todo++; else agg.owners[owner].inp++;
  }
  return agg;
}

/* ===== Load all → update hero + bubbles ===== */
async function loadAllForStats(){
  const u = new URL(BASE_URL);
  u.searchParams.set('path','tasks');
  u.searchParams.set('_', Date.now()); // break cache

  topLoad(true); heroLoad(true);
  try{
    const data = await fetchJSON(u.toString());
    const list = Array.isArray(data.tasks) ? data.tasks : [];
    const agg  = aggregateFromTasks(list);

    // Hero
    window.tasksStats = { totals: { todo: agg.totals.todo, inProgress: agg.totals.inProgress } };
    if(els.statTodo) els.statTodo.textContent = agg.totals.todo;
    if(els.statInp)  els.statInp.textContent  = agg.totals.inProgress;
    if(els.heroWrap) els.heroWrap.hidden = false;

    // Bubbles
    const get=(name,k)=>(agg.owners[name]?.[k] ?? 0);
    els.u_todo && (els.u_todo.textContent = get('לא משויך','todo'));
    els.u_inp  && (els.u_inp.textContent  = get('לא משויך','inp'));
    els.chen_todo && (els.chen_todo.textContent = get('חן','todo'));
    els.chen_inp  && (els.chen_inp.textContent  = get('חן','inp'));
    els.tam_todo  && (els.tam_todo.textContent  = get('תמרה','todo'));
    els.tam_inp   && (els.tam_inp.textContent   = get('תמרה','inp'));
    els.bel_todo  && (els.bel_todo.textContent  = get('בלה','todo'));
    els.bel_inp   && (els.bel_inp.textContent   = get('בלה','inp'));
    els.lio_todo  && (els.lio_todo.textContent  = get('ליאור','todo'));
    els.lio_inp   && (els.lio_inp.textContent   = get('ליאור','inp'));
    els.net_todo  && (els.net_todo.textContent  = get('נטע','todo'));
    els.net_inp   && (els.net_inp.textContent   = get('נטע','inp'));

    window.dispatchEvent(new CustomEvent('tasks:stats', { detail: agg }));
  }catch(e){
    console.error('[tasks] loadAllForStats failed:', e);
  }finally{
    topLoad(false); heroLoad(false);
  }
}

/* ===== Init ===== */
window.__loadStatsPromise = loadAllForStats();
window.reloadTasksStats   = async () => loadAllForStats();