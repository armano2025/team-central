// === הגדרות ===
const BASE_URL = 'https://script.google.com/macros/s/AKfycbybBJXB1vTEv9EDjyRXJnU674ZSCoUCT5MB9g9CTbDAiLKWn5iMAWSjC2XXLN4_ZdOhRw/exec';

const els = {
  searchInput: document.getElementById('globalSearch'),
  btnSearch: document.getElementById('btnSearch'),
  btnClear: document.getElementById('btnClear'),
  resultsBox: document.getElementById('searchResults'),
  resultsList: document.getElementById('resultsList'),
  resultsCount: document.getElementById('searchCount'),

  // counters
  u_todo: document.getElementById('u_todo'),
  u_inp:  document.getElementById('u_inp'),
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

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Network error');
  return res.json();
}

async function loadStats() {
  const data = await fetchJSON(`${BASE_URL}?path=stats`);
  // data = { "":{לטיפול:x, בתהליך:y}, "חן":{...}, ... }

  const get = (owner, key) => (data[owner] && data[owner][key]) || 0;

  els.u_todo.textContent   = get("", "לטיפול");
  els.u_inp.textContent    = get("", "בתהליך");
  els.chen_todo.textContent= get("חן", "לטיפול");
  els.chen_inp.textContent = get("חן", "בתהליך");
  els.tam_todo.textContent = get("תמרה", "לטיפול");
  els.tam_inp.textContent  = get("תמרה", "בתהליך");
  els.bel_todo.textContent = get("בלה", "לטיפול");
  els.bel_inp.textContent  = get("בלה", "בתהליך");
  els.lio_todo.textContent = get("ליאור", "לטיפול");
  els.lio_inp.textContent  = get("ליאור", "בתהליך");
  els.net_todo.textContent = get("נטע", "לטיפול");
  els.net_inp.textContent  = get("נטע", "בתהליך");
}

async function runGlobalSearch() {
  const q = (els.searchInput.value || '').trim();
  if (!q) { // אין חיפוש – החבא תוצאות
    els.resultsBox.style.display = 'none';
    els.resultsList.innerHTML = '';
    return;
  }
  const data = await fetchJSON(`${BASE_URL}?path=tasks&q=${encodeURIComponent(q)}`);
  const list = data.tasks || [];
  els.resultsCount.textContent = `נמצאו ${list.length} תוצאות`;
  els.resultsList.innerHTML = list.map(t => {
    const owner = t.owner || 'לא משויך';
    return `
      <div class="result-item">
        <div>
          <div><strong>${escapeHTML(t.subject || '(ללא כותרת)')}</strong></div>
          <div class="result-meta">
            #${escapeHTML(t.caseId)} • ${escapeHTML(t.fullName || '')} • ${escapeHTML(t.phone || '')} • ${escapeHTML(owner)}
          </div>
        </div>
        <a class="btn" href="./owner.html?owner=${owner === 'לא משויך' ? 'unassigned' : encodeURIComponent(owner)}&focus=${encodeURIComponent(t.caseId)}">פתח</a>
      </div>
    `;
  }).join('');
  els.resultsBox.style.display = 'block';
}

function escapeHTML(s='') {
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

// אירועים
els.btnSearch.addEventListener('click', runGlobalSearch);
els.searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') runGlobalSearch(); });
els.btnClear.addEventListener('click', () => {
  els.searchInput.value = '';
  els.resultsBox.style.display = 'none';
  els.resultsList.innerHTML = '';
});

loadStats().catch(console.error);