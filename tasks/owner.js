/* owner.js – לוח משימות לפי בעלים/סטטוס
   תומך בפרמטרים ב־URL:
   - owner=all | unassigned | חן | תמרה | ...  (ברירת מחדל: all)
   - status=todo | inp | done | canceled      (אופציונלי)
   טעינת נתונים: ניסוי fetch ממספר נתיבים -> window.tasksData -> שגיאה.
*/

(function () {
  // ====== DOM ======
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const elTitle      = $('#ownerTitle');
  const elSearch     = $('#ownerSearch');
  const btnSearch    = $('#btnOwnerSearch');
  const btnClear     = $('#btnOwnerClear');
  const elStats      = $('#ownerStats');
  const elList       = $('#tasksList');
  const elErr        = $('#errBox');
  const elLoaderWrap = $('#loader');

  // Dialog fields
  const dlg          = $('#taskDialog');
  const form         = $('#taskForm');
  const dlgTitle     = $('#dlgTitle');
  const f_status     = $('#f_status');
  const f_owner      = $('#f_owner');
  const f_name       = $('#f_name');
  const f_phone      = $('#f_phone');
  const f_notes      = $('#f_notes');
  const f_caseId     = $('#f_caseId');
  const btnSave      = $('#btnSave');

  // ====== Helpers ======
  const STATUS_LABELS = {
    todo: 'לטיפול',
    inp: 'בתהליך',
    done: 'בוצע',
    canceled: 'בוטל',
  };
  const STATUS_KEYS_BY_HE = {
    'לטיפול': 'todo',
    'בתהליך': 'inp',
    'בוצע': 'done',
    'בוטל': 'canceled',
  };

  function getParam(name, def = undefined) {
    const url = new URL(location.href);
    const val = url.searchParams.get(name);
    return val != null ? decodeURIComponent(val) : def;
  }

  function titleForOwner(ownerParam) {
    if (!ownerParam || ownerParam === 'all') return 'משימות – כל המטפלים';
    if (ownerParam === 'unassigned') return 'משימות – לא משויך';
    return `משימות – ${ownerParam}`;
  }

  function mapStatusParamToHeb(param) {
    if (!param) return null;
    const k = String(param).toLowerCase();
    return STATUS_LABELS[k] || null;
  }

  function fmtDate(d) {
    try {
      const dt = typeof d === 'string' ? new Date(d) : d;
      if (isNaN(dt)) return '';
      // הצגה תמציתית: DD.MM.YYYY HH:MM
      return dt.toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit' }) +
             ' · ' +
             dt.toLocaleDateString('he-IL');
    } catch {
      return '';
    }
  }

  function normalizeStr(s) {
    return (s || '').toString().toLowerCase();
  }

  function matchesQuery(task, q) {
    if (!q) return true;
    const hay = [
      task.caseId,
      task.name,
      task.phone,
      task.subject,
      task.owner,
      task.status,
      task.notes,
    ].map(normalizeStr).join(' • ');
    return hay.includes(normalizeStr(q));
  }

  // ====== Data loading ======
  async function loadTasksData() {
    // סדר ניסיונות (אותו דומיין):
    const endpoints = [
      './data.json',
      './tasks.json',
      '../tasks.json',
      '/tasks/data.json',
      '/tasks/tasks.json',
    ];
    for (const url of endpoints) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json)) return json;
          if (Array.isArray(json?.items)) return json.items;
          if (Array.isArray(json?.tasks)) return json.tasks;
        }
      } catch (_) {/* continue */}
    }
    // חלופה: גלובלי
    if (Array.isArray(window.tasksData)) return window.tasksData;
    if (Array.isArray(window.tasks?.items)) return window.tasks.items;

    throw new Error('no-data');
  }

  // ====== State ======
  let ALL = [];          // כל המשימות
  let FILTERED = [];     // אחרי owner/status/search
  let CURRENT_OWNER;     // owner param
  let CURRENT_STATUS;    // heb label ('לטיפול'/'בתהליך'/...)
  let CURRENT_QUERY = ''; // search query

  // ====== Rendering ======
  function renderCounts(list) {
    const counts = { 'לטיפול': 0, 'בתהליך': 0, 'בוצע': 0, 'בוטל': 0 };
    list.forEach(t => {
      if (counts[t.status] != null) counts[t.status] += 1;
    });
    elStats.textContent =
      `לטיפול: ${counts['לטיפול']} | בתהליך: ${counts['בתהליך']} | בוצע: ${counts['בוצע']} | בוטל: ${counts['בוטל']}`;
  }

  function renderList(list) {
    elList.innerHTML = '';
    if (!list.length) {
      elList.innerHTML = `<div class="result-item"><span>לא נמצאו משימות תואמות</span><span class="result-meta">נסה/י לשנות חיפוש או מסננים</span></div>`;
      return;
    }
    for (const t of list) {
      const name     = t.name || '—';
      const phone    = t.phone || '';
      const subj     = t.subject || '';
      const owner    = t.owner || 'לא משויך';
      const status   = t.status || '—';
      const updated  = fmtDate(t.updatedAt || t.updated_at || t.timestamp);

      const row = document.createElement('div');
      row.className = 'result-item';
      row.tabIndex = 0;
      row.dataset.caseId = t.caseId || t.id || '';

      const left = document.createElement('span');
      left.innerHTML = `
        <strong>${name}</strong> ${phone ? ' · ' + phone : ''} — ${subj || 'ללא נושא'}
        <span class="result-meta"> · ${owner} · ${status}${updated ? ' · ' + updated : ''}</span>
      `;

      const btn = document.createElement('button');
      btn.className = 'btn ghost';
      btn.textContent = 'פתח';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDialog(t);
      });

      row.addEventListener('click', () => openDialog(t));
      row.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') openDialog(t); });

      row.appendChild(left);
      row.appendChild(btn);
      elList.appendChild(row);
    }
  }

  function applyFilters() {
    const owner = CURRENT_OWNER;
    const status = CURRENT_STATUS; // heb label or null
    const q = CURRENT_QUERY;

    FILTERED = ALL.filter(t => {
      const okOwner =
        owner === 'all' ||
        (owner === 'unassigned' && (!t.owner || t.owner === '')) ||
        t.owner === owner;

      const okStatus = !status || t.status === status;

      const okQuery = matchesQuery(t, q);

      return okOwner && okStatus && okQuery;
    });

    renderCounts(FILTERED);
    renderList(FILTERED);
  }

  // ====== Dialog ======
  function openDialog(task) {
    dlgTitle.textContent = `משימה #${task.caseId || task.id || ''}`;
    f_status.value = task.status && STATUS_KEYS_BY_HE[task.status] ? task.status : task.status || 'לטיפול';
    // f_status מחזיק ערכים בעברית? ב-HTML הערכים הם בעברית, נשמור עקביות:
    // ניישר: אם הגיע באנגלית – נמפה לעברית
    if (STATUS_LABELS[f_status.value]) {
      // אם למשל 'todo' – נמיר לעברית
      f_status.value = STATUS_LABELS[f_status.value];
    }

    // בעלים
    f_owner.value = task.owner || '';

    // תצוגה בלבד
    f_name.value  = task.name  || '';
    f_phone.value = task.phone || '';

    // הערות אדמין (נשמר מקומית)
    f_notes.value = task.notes || '';

    f_caseId.value = task.caseId || task.id || '';

    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', 'open');

    btnSave.onclick = () => {
      // עדכון מקומי במערך ALL
      const key = f_caseId.value;
      const idx = ALL.findIndex(x => String(x.caseId || x.id || '') === String(key));
      if (idx >= 0) {
        ALL[idx] = {
          ...ALL[idx],
          status: f_status.value,
          owner: f_owner.value,
          notes: f_notes.value,
          updatedAt: new Date().toISOString(),
        };
      }
      // אפשרות: שליחת עדכון לשרת (התאם ל-API שלך)
      // fetch('/api/tasks/update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(ALL[idx]) }).catch(console.warn);

      applyFilters();
      closeDialog();
    };
  }

  function closeDialog() {
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
  }
  $('#btnClose')?.addEventListener('click', (e) => { e.preventDefault(); closeDialog(); });

  // ====== Search ======
  btnSearch.addEventListener('click', () => { CURRENT_QUERY = elSearch.value.trim(); applyFilters(); });
  btnClear.addEventListener('click', () => { elSearch.value = ''; CURRENT_QUERY = ''; applyFilters(); });
  elSearch.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); CURRENT_QUERY = elSearch.value.trim(); applyFilters(); } });

  // ====== Init ======
  (async function init() {
    try {
      elLoaderWrap.style.display = 'block';
      elErr.style.display = 'none';

      CURRENT_OWNER  = getParam('owner', 'all');
      CURRENT_STATUS = mapStatusParamToHeb(getParam('status', null));

      elTitle.textContent = titleForOwner(CURRENT_OWNER);

      // טען נתונים
      const raw = await loadTasksData();

      // normalize records
      ALL = raw.map(t => ({
        id:        t.id ?? t.caseId ?? '',
        caseId:    t.caseId ?? t.id ?? '',
        name:      t.name ?? t.fullName ?? '',
        phone:     t.phone ?? t.tel ?? '',
        subject:   t.subject ?? t.topic ?? '',
        owner:     t.owner ?? t.assignee ?? '',
        // נורמליזציית סטטוס: אם הגיעו באנגלית – נתרגם לעברית
        status:    (() => {
          const s = (t.status || '').toString();
          const sLow = s.toLowerCase();
          if (STATUS_LABELS[sLow]) return STATUS_LABELS[sLow];
          if (STATUS_KEYS_BY_HE[s]) return STATUS_LABELS[STATUS_KEYS_BY_HE[s]] || s; // כבר בעברית
          // ברירות מחדל
          if (!s) return 'לטיפול';
          return s;
        })(),
        updatedAt: t.updatedAt ?? t.updated_at ?? t.timestamp ?? null,
        notes:     t.notes ?? t.adminNotes ?? '',
      }));

      applyFilters();
    } catch (err) {
      console.error(err);
      elErr.style.display = 'block';
      elList.innerHTML = '';
    } finally {
      elLoaderWrap.style.display = 'none';
    }
  })();
})();