/* tasks/owner.js — גרסה מוקשחת */

const BASE_URL = 'https://script.google.com/macros/s/AKfycbybBJXB1vTEv9EDjyRXJnU674ZSCoUCT5MB9g9CTbDAiLKWn5iMAWSjC2XXLN4_ZdOhRw/exec';

// === עזר ===
function norm(s) {
  return String(s || '')
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function escapeHTML(s=''){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
async function fetchJSON(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(`Network ${res.status}`);
  return res.json();
}

// === אלמנטים ===
const qs = new URLSearchParams(location.search);
let ownerParam = norm(decodeURIComponent(qs.get('owner') || 'unassigned'));
const focusId = norm(qs.get('focus') || '');

const els = {
  title: document.getElementById('ownerTitle'),
  stats: document.getElementById('ownerStats'),
  list:  document.getElementById('tasksList'),
  search: document.getElementById('ownerSearch'),
  btnSearch: document.getElementById('btnOwnerSearch'),
  btnClear:  document.getElementById('btnOwnerClear'),

  dlg: document.getElementById('taskDialog'),
  f_status: document.getElementById('f_status'),
  f_owner:  document.getElementById('f_owner'),
  f_name:   document.getElementById('f_name'),
  f_phone:  document.getElementById('f_phone'),
  f_notes:  document.getElementById('f_notes'),
  f_caseId: document.getElementById('f_caseId'),
  btnSave:  document.getElementById('btnSave'),
  btnClose: document.getElementById('btnClose'),
};

// כותרת
els.title.textContent = `משימות – ${ownerParam === 'unassigned' ? 'לא משויך' : ownerParam}`;

// === טעינת משימות ===
async function loadTasks(){
  try{
    const q = norm(els.search.value);
    const url = new URL(BASE_URL);
    url.searchParams.set('path','tasks');
    url.searchParams.set('owner', ownerParam);
    if(q) url.searchParams.set('q', q);

    const data = await fetchJSON(url.toString());
    const items = Array.isArray(data.tasks) ? data.tasks : [];

    // מיון: לטיפול → בתהליך → בוצע → בוטל
    const order = { 'לטיפול':0, 'בתהליך':1, 'בוצע':2, 'בוטל':3 };
    items.sort((a,b)=>(order[a.status]??9)-(order[b.status]??9));

    // ספירה
    const counts = { 'לטיפול':0, 'בתהליך':0, 'בוצע':0, 'בוטל':0 };
    items.forEach(t => counts[t.status] = (counts[t.status]||0)+1);
    els.stats.textContent =
      `לטיפול: ${counts['לטיפול']||0} | בתהליך: ${counts['בתהליך']||0} | בוצע: ${counts['בוצע']||0} | בוטל: ${counts['בוטל']||0}`;

    if(items.length===0){
      els.list.innerHTML = `<div class="card muted">אין משימות לתצוגה.</div>`;
      return;
    }

    // רינדור הרשימה
    els.list.innerHTML = items.map(t=>{
      const ownerLabel = t.owner || 'לא משויך';
      return `
        <div class="result-item"
             data-id="${escapeHTML(String(t.caseId))}"
             data-task='${escapeHTML(JSON.stringify(t))}'
             ${focusId && String(t.caseId)===focusId ? 'style="outline:2px solid #2563eb;"' : ''}>
          <div>
            <div><strong>${escapeHTML(t.subject || '(ללא כותרת)')}</strong></div>
            <div class="result-meta">#${escapeHTML(t.caseId)} • ${escapeHTML(t.fullName||'')} • ${escapeHTML(t.phone||'')}</div>
            <div class="result-meta">סטטוס: ${escapeHTML(t.status||'')} • מטפל: ${escapeHTML(ownerLabel)}</div>
          </div>
          <button class="btn" data-open="${escapeHTML(String(t.caseId))}">פתח</button>
        </div>
      `;
    }).join('');

    // מאזינים לפתיחה
    els.list.querySelectorAll('button[data-open]').forEach(btn=>{
      btn.addEventListener('click',()=> openDialog(btn.dataset.open));
    });

    // פתיחה אוטומטית אם יש focus
    if(focusId){
      const btn = els.list.querySelector(`button[data-open="${CSS.escape(String(focusId))}"]`);
      if(btn) btn.click();
    }
  } catch(err){
    console.error(err);
    els.list.innerHTML = `<div class="card" style="border-color:#ef4444;color:#ef4444;">
      שגיאת טעינה מהשרת. בדוק/י את ה־URL של ה־API או את החיבור לרשת.
    </div>`;
  }
}

// === פתיחת מודאל ===
function openDialog(caseId){
  const row = els.list.querySelector(`.result-item[data-id="${CSS.escape(String(caseId))}"]`);
  if(!row) return;
  const t = JSON.parse(row.dataset.task || '{}');

  document.getElementById('dlgTitle').textContent = t.subject || '(ללא כותרת)';
  els.f_caseId.value = t.caseId || '';
  els.f_status.value = t.status || 'לטיפול';
  els.f_owner.value  = (t.owner === 'לא משויך' ? '' : (t.owner || ''));
  els.f_name.value   = t.fullName || '';
  els.f_phone.value  = t.phone || '';
  els.f_notes.value  = t.adminNotes || '';

  els.dlg.showModal();
}

// === שמירה (PATCH) ===
async function saveTask(){
  const caseId = els.f_caseId.value;
  const body = {
    status: els.f_status.value,
    owner:  els.f_owner.value,
    adminNotes: els.f_notes.value
  };
  try{
    const url = `${BASE_URL}?path=tasks/${encodeURIComponent(caseId)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    const json = await res.json();
    showToast('עודכן בהצלחה');
    await loadTasks(); // ריענון
  }catch(err){
    console.error(err);
    showToast('שמירה נכשלה');
  }
}

// === טוסט קטן ===
function showToast(msg){
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.position='fixed'; t.style.bottom='16px'; t.style.right='16px';
  t.style.background='#111'; t.style.color='#fff'; t.style.padding='10px 14px';
  t.style.borderRadius='10px'; t.style.opacity='0.95'; t.style.zIndex='9999';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),1800);
}

// === אירועים ===
els.btnSearch.addEventListener('click', loadTasks);
els.search.addEventListener('keydown', e=>{ if(e.key==='Enter') loadTasks(); });
els.btnClear.addEventListener('click', ()=>{ els.search.value=''; loadTasks(); });
els.btnSave.addEventListener('click', saveTask);
els.btnClose.addEventListener('click', ()=> els.dlg.close());

// === טעינה ראשונית ===
loadTasks();