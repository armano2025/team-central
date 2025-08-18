/* /tasks/owner.js — V11 (supports owner=all + top loader) */
const BASE_URL =
  'https://script.google.com/macros/s/AKfycbybBJXB1vTEv9EDjyRXJnU674ZSCoUCT5MB9g9CTbDAiLKWn5iMAWSjC2XXLN4_ZdOhRw/exec';

/* Helpers */
const qs = new URLSearchParams(location.search);
const DEBUG = qs.get('debug') === '1';

function norm(s){ return String(s ?? '').replace(/[\u200E\u200F\u202A-\u202E]/g,'').replace(/\u00A0/g,' ').replace(/\s+/g,' ').trim(); }
function escapeHTML(s){ return String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function show(el){ el.style.display='block'; } function hide(el){ el.style.display='none'; }

async function fetchJSON(url){
  const res  = await fetch(url, { credentials:'omit' });
  const text = await res.text();
  if(DEBUG) appendDebug('GET '+url, text, res.status);
  if(!res.ok) throw new Error(text || `HTTP ${res.status}`);
  try { return JSON.parse(text); } catch { throw new Error('Bad JSON'); }
}

/* Elements */
const ownerParamRaw = decodeURIComponent(qs.get('owner') || 'unassigned');
const ownerParam = norm(ownerParamRaw);            // 'unassigned' | שם בעלים | 'all'
const focusId    = norm(qs.get('focus') || '');

const els = {
  title: document.getElementById('ownerTitle'),
  stats: document.getElementById('ownerStats'),
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
  topLoader: document.getElementById('topLoader'),
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
  `משימות – ${ownerParam === 'unassigned' ? 'לא משויך' : (ownerParam === 'all' ? 'כל המשימות' : ownerParam)}`;

/* Loader helper */
function topLoad(on){ if (els.topLoader) els.topLoader.hidden = !on; }

/* Load tasks */
async function loadTasks(){
  try{
    hide(els.errBox); show(els.loader); els.list.innerHTML = '';
    topLoad(true);

    const q = norm(els.search.value);
    const u = new URL(BASE_URL);
    u.searchParams.set('path','tasks');

    // תמיכה ב-all: לא שולחים owner בכלל כדי לקבל את הכול
    if (ownerParam === 'unassigned') {
      u.searchParams.set('owner', 'unassigned');
    } else if (ownerParam !== 'all') {
      u.searchParams.set('owner', ownerParam);
    }
    if(q) u.searchParams.set('q', q);

    const data = await fetchJSON(u.toString());
    const items = Array.isArray(data.tasks) ? data.tasks : [];

    const order = {'לטיפול':0,'בתהליך':1,'בוצע':2,'בוטל':3};
    items.sort((a,b)=>(order[a.status]??9)-(order[b.status]??9));

    const counts = {'לטיפול':0,'בתהליך':0,'בוצע':0,'בוטל':0};
    items.forEach(t=> counts[t.status]=(counts[t.status]||0)+1);
    els.stats.textContent =
      `לטיפול: ${counts['לטיפול']||0} | בתהליך: ${counts['בתהליך']||0} | בוצע: ${counts['בוצע']||0} | בוטל: ${counts['בוטל']||0}`;

    if(!items.length){
      els.list.innerHTML = `<div class="card muted">אין משימות לתצוגה.</div>`;
      return;
    }

    els.list.innerHTML = items.map(t=>{
      const ownerLabel = t.owner || 'לא משויך';
      return `
        <div class="result-item" data-id="${escapeHTML(String(t.caseId))}"
             data-task='${escapeHTML(JSON.stringify(t))}'
             ${focusId && String(t.caseId)===focusId ? 'style="outline:2px solid #2563eb;"' : ''}>
          <div>
            <div><strong>${escapeHTML(t.subject ?? '(ללא כותרת)')}</strong></div>
            <div class="result-meta">#${escapeHTML(t.caseId)} • ${escapeHTML(t.fullName ?? '')} • ${escapeHTML(t.phone ?? '')}</div>
            <div class="result-meta">סטטוס: ${escapeHTML(t.status ?? '')} • מטפל: ${escapeHTML(ownerLabel)}</div>
          </div>
          <button class="btn" data-open="${escapeHTML(String(t.caseId))}">פתח</button>
        </div>`;
    }).join('');

    els.list.querySelectorAll('button[data-open]').forEach(btn=>{
      btn.addEventListener('click', ()=> openDialog(btn.dataset.open));
    });

    if(focusId){
      const btn = els.list.querySelector(`button[data-open="${CSS.escape(String(focusId))}"]`);
      if(btn) btn.click();
    }
  }catch(err){
    els.errBox.textContent = `שגיאת טעינה מהשרת: ${err.message || err}`;
    show(els.errBox);
    appendDebug('LOAD ERROR', String(err), 0);
  }finally{
    hide(els.loader);
    topLoad(false);
  }
}

/* Dialog */
function openDialog(caseId){
  const row = els.list.querySelector(`.result-item[data-id="${CSS.escape(String(caseId))}"]`);
  if(!row) return;
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

/* Save (no-preflight) */
async function saveTask(){
  const caseId = els.f_caseId.value;
  const body = {
    status: els.f_status.value,
    owner:  els.f_owner.value,
    adminNotes: els.f_notes.value
  };

  try{
    els.btnSave.disabled = true;
    topLoad(true);

    const url = `${BASE_URL}?path=tasks/${encodeURIComponent(caseId)}`;
    const res = await fetch(url, {
      method:'POST',
      headers:{ 'Content-Type':'text/plain;charset=UTF-8' }, // אין OPTIONS
      body: JSON.stringify(body),
      credentials:'omit'
    });

    const text = await res.text();
    appendDebug('POST '+url+'\n'+JSON.stringify(body,null,2), text, res.status);

    let json = null; try { json = JSON.parse(text); } catch {}

    if(!res.ok || (json && json.error)){
      const msg = (json && json.error) ? json.error : (text || `HTTP ${res.status}`);
      showToast('שמירה נכשלה: ' + msg);
      throw new Error(msg);
    }

    showToast('עודכן בהצלחה');
    await loadTasks();
    els.dlg.close();
  }catch(err){
    console.error('saveTask failed:', err);
  }finally{
    els.btnSave.disabled = false;
    topLoad(false);
  }
}

/* Toast */
function showToast(msg){
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:16px;right:16px;background:#111;color:#fff;padding:10px 14px;border-radius:10px;opacity:.95;z-index:9999';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2200);
}

/* Events */
els.btnSearch.addEventListener('click', loadTasks);
els.search.addEventListener('keydown', e=>{ if(e.key==='Enter') loadTasks(); });
els.btnClear.addEventListener('click', ()=>{ els.search.value=''; loadTasks(); });
els.btnRefresh?.addEventListener('click', loadTasks);
els.btnSave.addEventListener('click', saveTask);
els.btnClose.addEventListener('click', ()=> els.dlg.close());

/* Init */
loadTasks();