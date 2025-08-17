/* owner.js – לוח משימות לפי בעלים/סטטוס
   פרמטרים ב-URL:
   - owner=all | unassigned | חן | תמרה | ...  (ברירת מחדל: all)
   - status=todo | inp | done | canceled      (אופציונלי)
   טעינת נתונים (לפי סדר ניסיון):
   1) JSON מקומי (data.json / tasks.json ...)
   2) Google Sheets (GViz JSON) – SHEET_ID / SHEET_GID
   3) window.tasksData / window.tasks.items
*/

(function () {
  // ====== CONFIG: Google Sheets ======
  // ודא שהשיתופיות של ה־Sheet היא "Anyone with the link – Viewer", אחרת הדפדפן יחסום את הבקשה.
  const SHEET_ID  = '1vQGA0aeXj9yncK2ZbuYZjrvQgPdpp7qN5FCxWBSAUd4'; // החלף אם צריך
  const SHEET_GID = null;     // אם תרצה לשאוב לשונית ספציפית: מספר gid (למשל "0"). null = הלשונית הראשית

  // ====== DOM ======
  const $  = (sel) => document.querySelector(sel);
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
  const dlg      = $('#taskDialog');
  const form     = $('#taskForm');
  const dlgTitle = $('#dlgTitle');
  const f_status = $('#f_status');
  const f_owner  = $('#f_owner');
  const f_name   = $('#f_name');
  const f_phone  = $('#f_phone');
  const f_notes  = $('#f_notes');
  const f_caseId = $('#f_caseId');
  const btnSave  = $('#btnSave');

  // ====== Helpers ======
  const STATUS_LABELS = { todo: 'לטיפול', inp: 'בתהליך', done: 'בוצע', canceled: 'בוטל' };
  const STATUS_KEYS_BY_HE = { 'לטיפול': 'todo', 'בתהליך': 'inp', 'בוצע': 'done', 'בוטל': 'canceled' };

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
      return dt.toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit' }) +
             ' · ' + dt.toLocaleDateString('he-IL');
    } catch { return ''; }
  }

  function normalizeStr(s) { return (s || '').toString().toLowerCase(); }

  function matchesQuery(task, q) {
    if (!q) return true;
    const hay = [
      task.caseId, task.name, task.phone, task.subject, task.owner, task.status, task.notes
    ].map(normalizeStr).join(' • ');
    return hay.includes(normalizeStr(q));
  }

  // ====== Loaders ======
  async function fetchLocalJSON() {
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
      } catch (_) { /* continue */ }
    }
    return null;
  }

  // --- Google Sheets (GViz JSON) ---
  // פורמט: https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:json[&gid=...]
  async function fetchFromGoogleSheets(sheetId, gid = null) {
    if (!sheetId) return null;
    const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:json`;
    const url  = gid ? `${base}&gid=${encodeURIComponent(gid)}` : base;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;

    // gviz מחזיר טקסט עטוף בפונקציה; נחלץ את ה-JSON
    const txt = await res.text();
    const start = txt.indexOf('{');
    const end   = txt.lastIndexOf('}');
    if (start === -1 || end === -1) return null;

    const payload = JSON.parse(txt.slice(start, end + 1));
    const cols = (payload.table?.cols || []).map(c => (c.label || '').trim());
    const rows = payload.table?.rows || [];

    if (!cols.length || !rows.length) return [];

    // מיפוי שמות עמודות גמיש (עברית/אנגלית)
    const keyFor = (label) => {
      const k = normalizeStr(label);
      if (!k) return null;
      if (/(case\s*id|caseid|id|מזהה|מספר|תיק)/.test(k)) return 'caseId';
      if (/(name|full\s*name|שם)/.test(k)) return 'name';
      if (/(phone|טלפון|נייד|מספר\s*טלפון)/.test(k)) return 'phone';
      if (/(subject|topic|נושא)/.test(k)) return 'subject';
      if (/(owner|assignee|מטפל|משויך)/.test(k)) return 'owner';
      if (/(status|סטטוס)/.test(k)) return 'status';
      if (/(updated|עדכון|תאריך|timestamp|time)/.test(k)) return 'updatedAt';
      if (/(notes|admin\s*notes|הערות)/.test(k)) return 'notes';
      return null; // עמודות נוספות יישמרו אם נרצה להרחיב
    };

    const colIdx = {};
    cols.forEach((label, i) => {
      const key = keyFor(label);
      if (key && colIdx[key] == null) colIdx[key] = i;
    });

    const getCell = (row, idx) => (idx == null ? null : (row.c[idx]?.v ?? null));

    // המר לשורת אובייקט עם נרמול סטטוס
    const out = rows.map(r => {
      const raw = {
        caseId:    getCell(r, colIdx.caseId),
        name:      getCell(r, colIdx.name),
        phone:     getCell(r, colIdx.phone),
        subject:   getCell(r, colIdx.subject),
        owner:     getCell(r, colIdx.owner),
        status:    getCell(r, colIdx.status),
        updatedAt: getCell(r, colIdx.updatedAt),
        notes:     getCell(r, colIdx.notes),
      };

      // נרמול תאריך
      if (raw.updatedAt && typeof raw.updatedAt === 'object' && raw.updatedAt.f) {
        // gviz לפעמים מחזיר גם formatted
        raw.updatedAt = raw.updatedAt.f;
      }

      // נרמול סטטוס
      const s = (raw.status || '').toString();
      const sLow = s.toLowerCase();
      if (STATUS_LABELS[sLow]) raw.status = STATUS_LABELS[sLow];
      else if (STATUS_KEYS_BY_HE[s]) raw.status = STATUS_LABELS[STATUS_KEYS_BY_HE[s]] || s;
      else if (!s) raw.status = 'לטיפול';

      return raw;
    });

    // סינון שורות ריקות לגמרי
    return out.filter(t =>
      t.caseId || t.name || t.phone || t.subject || t.owner || t.status || t.notes
    );
  }

  async function loadTasksData() {
    // 1) JSON מקומי
    const local = await fetchLocalJSON();
    if (local && local.length) return local;

    // 2) Google Sheets (GViz)
    try {
      const sheetRows = await fetchFromGoogleSheets(SHEET_ID, SHEET_GID);
      if (sheetRows && sheetRows.length) return sheetRows;
    } catch (e) {
      console.warn('Sheets fetch failed:', e);
    }

    // 3) גלובלי
    if (Array.isArray(window.tasksData)) return window.tasksData;
    if (Array.isArray(window.tasks?.items)) return window.tasks.items;

    throw new Error('no-data');
  }

  // ====== State ======
  let ALL = [];
  let FILTERED = [];
  let CURRENT_OWNER;
  let CURRENT_STATUS;   // heb label ('לטיפול'/'בתהליך'/...)
  let CURRENT_QUERY = '';

  // ====== Rendering ======
  function renderCounts(list) {
    const counts = { 'לטיפול': 0, 'בתהליך': 0, 'בוצע': 0, 'בוטל': 0 };
    list.forEach(t => { if (counts[t.status] != null) counts[t.status] += 1; });
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
        <strong>${name}</strong>${phone ? ' · ' + phone : ''} — ${subj || 'ללא נושא'}
        <span class="result-meta"> · ${owner} · ${status}${updated ? ' · ' + updated : ''}</span>
      `;

      const btn = document.createElement('button');
      btn.className = 'btn ghost';
      btn.textContent = 'פתח';
      btn.addEventListener('click', (e) => { e.stopPropagation(); openDialog(t); });

      row.addEventListener('click', () => openDialog(t));
      row.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') openDialog(t); });

      row.appendChild(left);
      row.appendChild(btn);
      elList.appendChild(row);
    }
  }

  function applyFilters() {
    const owner  = CURRENT_OWNER;
    const status = CURRENT_STATUS; // heb label or null
    const q      = CURRENT_QUERY;

    FILTERED = ALL.filter(t => {
      const okOwner =
        owner === 'all' ||
        (owner === 'unassigned' && (!t.owner || t.owner === '')) ||
        t.owner === owner;

      const okStatus = !status || t.status === status;
      const okQuery  = matchesQuery(t, q);

      return okOwner && okStatus && okQuery;
    });

    renderCounts(FILTERED);
    renderList(FILTERED);
  }

  // ====== Dialog ======
  function openDialog(task) {
    dlgTitle.textContent = `משימה #${task.caseId || task.id || ''}`;
    // ערכי ה-<select> אצלך בעברית, ניישר אליהם
    const s = task.status || 'לטיפול';
    f_status.value = STATUS_LABELS[STATUS_KEYS_BY_HE[s]] || s;

    f_owner.value = task.owner || '';
    f_name.value  = task.name  || '';
    f_phone.value = task.phone || '';
    f_notes.value = task.notes || '';
    f_caseId.value = task.caseId || task.id || '';

    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', 'open');

    btnSave.onclick = () => {
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
      // כאן אפשר לבצע POST לשרת שלך אם צריך
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

      // טען נתונים (לפי סדר ניסיון)
      const raw = await loadTasksData();

      // normalize records
      ALL = raw.map(t => ({
        id:        t.id ?? t.caseId ?? '',
        caseId:    t.caseId ?? t.id ?? '',
        name:      t.name ?? t.fullName ?? '',
        phone:     t.phone ?? t.tel ?? '',
        subject:   t.subject ?? t.topic ?? '',
        owner:     t.owner ?? t.assignee ?? '',
        status:    (() => {
          const s = (t.status || '').toString();
          const sLow = s.toLowerCase();
          if (STATUS_LABELS[sLow]) return STATUS_LABELS[sLow];
          if (STATUS_KEYS_BY_HE[s]) return STATUS_LABELS[STATUS_KEYS_BY_HE[s]] || s;
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