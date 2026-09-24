/* =====================================================================
   Territorios, grupos de predicación y salidas al servicio
   ---------------------------------------------------------------------
   Módulo de la app de asignaciones (asignaciones-salon.html). Usa las
   variables y funciones globales de la app: data, fbDb, accessCode,
   currentUser, currentUserRole, $, escapeHtml, showToast, switchTab,
   mondayOf, shiftDate, todayIsoLocal, accNorm, uid...

   Datos (aparte del documento de la congregación, para no llenarlo y
   para que cada parte tenga sus propios permisos):
     congregations/{código}/terr/grupos      → { lista: {id: grupo}, editoresTodos, conductoresCongregacion }
     congregations/{código}/terr/lugares     → { lista: {id: lugar} }
     congregations/{código}/terr/territorios → { lista: {id: territorio} }
     congregations/{código}/salidas/{grupo}  → { plantilla: {id: salida}, semanas: {lunes: {cambios, extra}} }
       (grupo = id del grupo, o "congregacion")
   Quién edita: Super Admin y "Admin — Territorios" todo; el encargado y
   el auxiliar de cada grupo, las salidas de su grupo (y los lugares).
   ===================================================================== */
(function () {
  'use strict';

  const T = {
    grupos: {}, gruposMeta: {}, lugares: {}, territorios: {}, salidas: {},
    loaded: { grupos: false, lugares: false, territorios: false, salidas: false },
    unsub: [], code: null, started: false,
    week: null, view: 'salidas', sFilter: 'todas', tFilter: 'todos', tSearch: '',
    waitingViewer: false
  };
  window.__terr = T;   // para las pruebas

  const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const DIAS3 = ['', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  const TIPOS_T = { casas: 'Casas', edificios: 'Edificios', rural: 'Rural', comercial: 'Comercial', mixto: 'Mixto' };
  const TIPOS_L = { casa: '🏠', esquina: '📍', salon: '🏛', otro: '📌' };
  const TIPOS_L_TX = { casa: 'Casa de una familia', esquina: 'Esquina o punto de encuentro', salon: 'Salón del Reino', otro: 'Otro lugar' };
  const VENCE_DIAS = 120, ANIO_DIAS = 365;

  /* ---------- Estilos ---------- */
  const css = `
  #terrRoot { padding-bottom: 20px; }
  .tseg { display: flex; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 3px; margin: 2px 0 12px; gap: 2px; }
  .tseg button { flex: 1; border: none; background: none; border-radius: 8px; padding: 8px 4px; font: inherit; font-size: 13px; font-weight: 700; color: var(--ink-soft); cursor: pointer; }
  .tseg button.on { background: var(--emphasis, var(--ink)); color: var(--on-emphasis, #fff); }
  .thead { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 4px 0 10px; }
  .thead h3 { font-family: 'Fraunces', serif; font-weight: 500; font-size: 18px; margin: 0; }
  .twk { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
  .twk button { border: 1px solid var(--line); background: var(--surface); border-radius: 8px; width: 36px; height: 34px; font-size: 16px; color: var(--ink); cursor: pointer; }
  .twk .lbl { flex: 1; text-align: center; font-family: 'Fraunces', serif; font-size: 15px; }
  .twk .hoy { width: auto; padding: 0 10px; font-size: 12px; font-weight: 700; }
  .tchips { display: flex; gap: 6px; overflow-x: auto; margin: 0 0 10px; padding-bottom: 2px; scrollbar-width: none; }
  .tchips::-webkit-scrollbar { display: none; }
  .tchips button { border: 1px solid var(--line); background: var(--surface); border-radius: 16px; padding: 6px 11px; font: inherit; font-size: 12px; font-weight: 600; color: var(--ink); white-space: nowrap; cursor: pointer; }
  .tchips button.on { background: var(--ink); color: var(--surface); border-color: var(--ink); }
  .trow { display: flex; gap: 10px; align-items: flex-start; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 10px 11px; margin-bottom: 7px; width: 100%; text-align: left; font: inherit; color: var(--ink); cursor: pointer; box-sizing: border-box; }
  .trow.ro { cursor: default; }
  .trow.off { opacity: .55; }
  .trow.off .tx b { text-decoration: line-through; }
  .tday { width: 46px; flex-shrink: 0; border-radius: 9px; background: var(--bg); text-align: center; padding: 5px 0; font-size: 10.5px; font-weight: 700; color: var(--ink-soft); line-height: 1.2; }
  .tday b { display: block; font-size: 14px; color: var(--ink); }
  .tnum { width: 38px; height: 38px; flex-shrink: 0; border-radius: 10px; background: var(--bg); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; }
  .trow .tx { flex: 1; min-width: 0; }
  .trow .tx b { display: block; font-size: 14px; }
  .trow .tx small { display: block; font-size: 12px; color: var(--ink-soft); line-height: 1.4; }
  .trow .tx small em { font-style: normal; color: var(--ink); font-weight: 600; }
  .trow .tx small em.falta { color: var(--danger, #A8433A); }
  .tpill { font-size: 10.5px; font-weight: 700; border-radius: 9px; padding: 3px 8px; white-space: nowrap; flex-shrink: 0; }
  .tpill.g { background: color-mix(in srgb, #4C7A5E 16%, transparent); color: #3E6B50; }
  .tpill.b { background: color-mix(in srgb, var(--accent-blue) 15%, transparent); color: var(--accent-blue); }
  .tpill.r { background: color-mix(in srgb, #C0392B 14%, transparent); color: #A8433A; }
  .tpill.o { background: color-mix(in srgb, #C98A1B 18%, transparent); color: #8A6212; }
  .tpill.n { background: var(--bg); color: var(--ink-soft); }
  .tkpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
  .tkpi { background: var(--surface); border: 1px solid var(--line); border-top: 3px solid var(--line); border-radius: 10px; padding: 7px 4px; text-align: center; font: inherit; color: var(--ink); cursor: pointer; }
  .tkpi b { display: block; font-size: 18px; }
  .tkpi span { display: block; font-size: 10.5px; color: var(--ink-soft); line-height: 1.2; }
  .tkpi.g { border-top-color: #4C7A5E; } .tkpi.b { border-top-color: var(--accent-blue); } .tkpi.r { border-top-color: #C0392B; } .tkpi.o { border-top-color: #C98A1B; }
  .tkpi.on { outline: 2px solid var(--ink); outline-offset: -1px; }
  .tsearch { width: 100%; box-sizing: border-box; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; font: inherit; font-size: 14px; background: var(--surface); color: var(--ink); margin-bottom: 8px; }
  .tacts { display: flex; gap: 8px; margin: 10px 0 4px; flex-wrap: wrap; }
  .tacts .btn { flex: 1; justify-content: center; min-width: 130px; }
  .tempty { text-align: center; color: var(--ink-soft); font-size: 13.5px; padding: 24px 10px; line-height: 1.5; }
  .tcard { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 11px 12px; margin-bottom: 8px; }
  .tcard h4 { margin: 0 0 4px; font-size: 15px; display: flex; justify-content: space-between; gap: 8px; }
  .tkv { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; padding: 3px 0; }
  .tkv span { color: var(--ink-soft); }
  .tkv b { text-align: right; }
  .tmodal .modal { max-width: 480px; }
  .tmodal h3 { margin: 0 0 4px; }
  .tf { margin: 0 0 12px; }
  .tf label, .tlbl { display: block; font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 5px; }
  .tf input, .tf select, .tf textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--line); border-radius: 9px; padding: 9px 10px; font: inherit; font-size: 14px; background: var(--bg); color: var(--ink); }
  .tf textarea { min-height: 60px; resize: vertical; }
  .trow2 { display: flex; gap: 10px; }
  .trow2 > * { flex: 1; }
  .topts { display: flex; gap: 6px; flex-wrap: wrap; }
  .topts button { border: 1px solid var(--line); background: var(--surface); border-radius: 16px; padding: 6px 11px; font: inherit; font-size: 13px; font-weight: 600; color: var(--ink); cursor: pointer; }
  .topts button.on { background: var(--accent-blue); border-color: var(--accent-blue); color: #fff; }
  .ttags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
  .ttags span { display: inline-flex; align-items: center; gap: 6px; background: color-mix(in srgb, var(--accent-blue) 14%, transparent); border-radius: 14px; padding: 4px 6px 4px 10px; font-size: 12.5px; font-weight: 600; }
  .ttags span button { border: none; background: none; font-size: 14px; color: var(--ink-soft); cursor: pointer; padding: 0 2px; }
  .tsec { border-top: 1px solid var(--line); margin-top: 6px; padding-top: 12px; }
  .tsec > .tlbl { color: var(--ink); font-size: 12px; }
  .tchk { display: flex; align-items: center; gap: 10px; padding: 8px 2px; border-top: 1px solid var(--line); font-size: 14px; cursor: pointer; }
  .tchk input { width: 18px; height: 18px; flex-shrink: 0; }
  .tchk small { color: var(--ink-soft); font-size: 12px; }
  .tlist { max-height: 45vh; overflow: auto; border-bottom: 1px solid var(--line); margin-bottom: 10px; }
  .tpick { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 9px 4px; border-top: 1px solid var(--line); font-size: 14px; cursor: pointer; width: 100%; background: none; border-left: none; border-right: none; border-bottom: none; font-family: inherit; color: var(--ink); text-align: left; }
  .tpick small { display: block; color: var(--ink-soft); font-size: 12px; }
  .tpick.on { background: color-mix(in srgb, var(--accent-blue) 12%, transparent); }
  .tphoto { width: 100%; border-radius: 10px; display: block; margin: 6px 0 10px; background: var(--bg); max-height: 320px; object-fit: contain; cursor: zoom-in; }
  .tnophoto { border: 1.5px dashed var(--line); border-radius: 10px; padding: 18px; text-align: center; color: var(--ink-soft); font-size: 13px; margin: 6px 0 10px; }
  .thist div { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; padding: 5px 0; border-top: 1px solid var(--line); }
  .thist div:first-child { border-top: none; }
  .thist span { color: var(--ink-soft); white-space: nowrap; }
  .tnote { background: color-mix(in srgb, var(--accent-gold) 16%, transparent); border-radius: 10px; padding: 9px 11px; font-size: 13px; line-height: 1.45; margin-bottom: 10px; }
  .tfoot { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
  .tfoot .btn { flex: 1; justify-content: center; }
  .tfoot .btn-danger { flex: 0 0 auto; }
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- Utilidades ---------- */
  const esc = (s) => escapeHtml(s == null ? '' : String(s));
  const hoy = () => todayIsoLocal();
  const pubs = () => (data.publishers || []).filter(p => p.status !== 'inactivo');
  const pubName = (id) => { const p = (data.publishers || []).find(x => x.id === id); return p ? p.name : ''; };
  const grupoName = (gid) => gid === 'congregacion' ? 'Congregación' : (T.grupos[gid] ? T.grupos[gid].nombre : 'Grupo');
  const tName = (tid) => { const t = T.territorios[tid]; return t ? `${t.num}` : ''; };
  function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }
  function addDays(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function mondayLocal(iso) { const d = new Date(iso + 'T12:00:00'); const w = d.getDay(); return addDays(iso, w === 0 ? -6 : 1 - w); }
  function fmtShort(iso) { if (!iso) return ''; const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', ''); }
  function fmtMonthYear(iso) { const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }).replace('.', ''); }
  function agoTxt(iso) {
    const n = daysBetween(iso, hoy());
    if (n <= 0) return 'hoy';
    if (n === 1) return 'ayer';
    if (n < 14) return `hace ${n} días`;
    if (n < 60) return `hace ${Math.round(n / 7)} semanas`;
    const m = Math.round(n / 30); return m < 12 ? `hace ${m} meses` : (m < 24 ? 'hace más de un año' : `hace ${Math.floor(m / 12)} años`);
  }
  function weekLabel(monday) {
    const end = addDays(monday, 6);
    const a = new Date(monday + 'T12:00:00'), b = new Date(end + 'T12:00:00');
    const mes = (d) => d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
    return a.getMonth() === b.getMonth() ? `Semana del ${a.getDate()} al ${b.getDate()} de ${mes(b)}` : `Semana del ${a.getDate()} de ${mes(a)} al ${b.getDate()} de ${mes(b)}`;
  }
  const newId = () => (typeof uid === 'function' ? uid() : Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
  function sortPubs(list) { return list.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')); }

  /* ---------- Firestore ---------- */
  function congRef() { return fbDb.collection('congregations').doc(accessCode); }
  function tRef(doc) { return congRef().collection('terr').doc(doc); }
  function sRef(gid) { return congRef().collection('salidas').doc(gid); }
  // Escribe varios campos (rutas como listas) en un documento; si todavía no existe, lo crea.
  async function tWrite(ref, pairs) {
    const FP = firebase.firestore.FieldPath, FV = firebase.firestore.FieldValue;
    const args = [];
    pairs.forEach(([path, v]) => { args.push(new FP(...path), v === undefined ? FV.delete() : v); });
    try { await ref.update(...args); }
    catch (e) {
      if (!e || e.code !== 'not-found') throw e;
      const obj = {};
      pairs.forEach(([path, v]) => {
        if (v === undefined) return;
        let o = obj; path.slice(0, -1).forEach(k => { o = o[k] = o[k] || {}; }); o[path[path.length - 1]] = v;
      });
      await ref.set(obj, { merge: true });
    }
  }
  async function safe(fn, okMsg) {
    try { await fn(); if (okMsg) showToast(okMsg); return true; }
    catch (e) {
      console.error(e);
      showToast(e && e.code === 'permission-denied' ? 'No tenés permiso para hacer ese cambio' : 'No se pudo guardar. Revisá la conexión y probá de nuevo.');
      if (typeof logCloudError === 'function') logCloudError('territorios', `${(e && e.code) || ''} ${(e && e.message) || e}`.trim(), '');
      return false;
    }
  }

  function stop() { T.unsub.forEach(u => { try { u(); } catch (e) { /* nada */ } }); T.unsub = []; T.started = false; }
  function listenDoc(name, onErr) {
    return tRef(name).onSnapshot((snap) => {
      const d = snap.exists ? (snap.data() || {}) : {};
      if (name === 'grupos') { T.grupos = d.lista || {}; T.gruposMeta = { editoresTodos: d.editoresTodos || [], conductoresCongregacion: d.conductoresCongregacion || [] }; }
      else T[name] = d.lista || {};
      T.loaded[name] = true;
      onData(name);
    }, (err) => { T.loaded[name] = true; if (onErr) onErr(err); else console.warn('territorios', name, err && err.code); onData(name); });
  }
  function start() {
    if (!fbDb || !accessCode || !currentUser) return false;
    if (T.started && T.code === accessCode) return true;
    stop();
    T.code = accessCode; T.started = true;
    T.loaded = { grupos: false, lugares: false, territorios: false, salidas: false };
    T.unsub.push(listenDoc('grupos'));
    T.unsub.push(listenDoc('lugares'));
    T.unsub.push(congRef().collection('salidas').onSnapshot((qs) => {
      const o = {}; qs.forEach(d => { o[d.id] = d.data() || {}; }); T.salidas = o; T.loaded.salidas = true; onData('salidas');
    }, (err) => { T.loaded.salidas = true; console.warn('salidas', err && err.code); onData('salidas'); }));
    return true;
  }
  let territoriosListening = false;
  function ensureTerritorios() {
    if (territoriosListening || !T.started) return;
    const a = access();
    if (!a.all && !a.groups.length) return;
    territoriosListening = true;
    T.unsub.push(listenDoc('territorios', () => { territoriosListening = false; }));
  }
  let renderQueued = false;
  function onData(name) {
    if (name === 'grupos') {
      ensureTerritorios();
      if (T.waitingViewer) decideViewer();
      updateTabVisibility();
      syncGroupEditors();
    }
    if (renderQueued) return;
    renderQueued = true;
    setTimeout(() => { renderQueued = false; if (isVisible()) render(); }, 0);
  }
  function isVisible() { const p = $('panel-territorios'); return p && !p.classList.contains('hidden'); }

  /* ---------- Permisos ---------- */
  function myEmail() { return currentUser && currentUser.email ? currentUser.email : ''; }
  function access() {
    const s = (data && data.settings) || {};
    if (!currentUser) return { all: true, groups: [] };
    const e = myEmail();
    const all = currentUserRole === 'super' || currentUserRole === 'territorios' ||
      (s.editorEmails || []).includes(e) || (s.territoriosAdminEmails || []).includes(e);
    const groups = Object.keys(T.grupos).filter(g => (T.grupos[g].editores || []).includes(e));
    return { all, groups };
  }
  function canEditGroup(gid) { const a = access(); return a.all || (gid !== 'congregacion' && a.groups.includes(gid)); }
  // Emails de encargado y auxiliar de cada grupo (los usan las reglas del servidor). Si un hermano
  // vinculó su email después, se actualiza solo la próxima vez que un Super Admin / Admin de Territorios abre la app.
  function groupEditors(g) { return [g.encargado, g.auxiliar].map(id => { const p = (data.publishers || []).find(x => x.id === id); return p && p.email ? p.email : null; }).filter(Boolean); }
  let syncing = false;
  function syncGroupEditors() {
    if (syncing || !T.loaded.grupos || !access().all || !currentUser) return;
    const pairs = [];
    const all = new Set();
    Object.keys(T.grupos).forEach(gid => {
      const want = groupEditors(T.grupos[gid]);
      want.forEach(x => all.add(x));
      if (JSON.stringify(want) !== JSON.stringify(T.grupos[gid].editores || [])) pairs.push([['lista', gid, 'editores'], want]);
    });
    const allArr = [...all].sort();
    if (JSON.stringify(allArr) !== JSON.stringify((T.gruposMeta.editoresTodos || []).slice().sort())) pairs.push([['editoresTodos'], allArr]);
    if (!pairs.length) return;
    syncing = true;
    tWrite(tRef('grupos'), pairs).catch(e => console.warn('editores de grupo', e)).finally(() => { syncing = false; });
  }

  /* ---------- Rol, pestaña y "Solo ver" que es encargado de grupo ---------- */
  function updateTabVisibility() {
    const a = access();
    const show = !!currentUser ? (a.all || a.groups.length > 0) : true;
    document.querySelectorAll('.tab-btn[data-tab="territorios"]').forEach(b => b.classList.toggle('hidden', !show || currentUserRole === 'anuncios'));
  }
  // Quien tiene "Solo ver" pero es encargado o auxiliar de un grupo entra acá, solo a las salidas de su grupo.
  let viewerTimer = null;
  function decideViewer() {
    if (!T.loaded.grupos) return;
    T.waitingViewer = false;
    clearTimeout(viewerTimer);
    if (access().groups.length) {
      currentUserRole = 'grupo';
      applyTerrOnly();
      if (typeof maybeShowRoleWelcome === 'function') { try { maybeShowRoleWelcome(); } catch (e) { /* nada */ } }
    } else if (typeof goToViewerPage === 'function') goToViewerPage();
  }
  window.terrMaybeGroupEditor = function () {
    if (!start()) { if (typeof goToViewerPage === 'function') goToViewerPage(); return; }
    if (T.loaded.grupos) { decideViewer(); return; }
    T.waitingViewer = true;
    clearTimeout(viewerTimer);
    viewerTimer = setTimeout(() => { if (T.waitingViewer) { T.waitingViewer = false; if (typeof goToViewerPage === 'function') goToViewerPage(); } }, 6000);
  };
  function applyTerrOnly() {
    document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.toggle('hidden', b.dataset.tab !== 'territorios'));
    ['navAnunciosBtn', 'navAnunciosBtnMobile'].forEach(id => { const el = $(id); if (el && !(typeof canManageAnuncios === 'function' && canManageAnuncios() && currentUserRole === 'territorios')) el.classList.add('hidden'); });
    const tb = $('narrowThemeBtn'); if (tb) tb.classList.remove('hidden');
    const bb = $('backupBanner'); if (bb) bb.remove();
    const active = document.querySelector('.tab-btn.active');
    if (!active || active.dataset.tab !== 'territorios') switchTab('territorios');
    if (currentUserRole === 'grupo') T.view = 'salidas';
  }
  window.terrApplyTerrOnly = applyTerrOnly;
  // La llama applyRoleUI con cada cambio de datos o de rol.
  window.terrOnRole = function () {
    if (currentUser && accessCode && fbDb) start();
    ensureTerritorios();
    updateTabVisibility();
    if (currentUserRole === 'territorios') applyTerrOnly();
    if (isVisible()) render();
  };
  window.terrRender = function () { start(); ensureTerritorios(); render(); };

  /* ---------- Modal genérico ---------- */
  function openModal(html, opts) {
    const ov = document.createElement('div');
    ov.className = 'modal-overlay tmodal';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="modal">${html}</div>`;
    document.body.appendChild(ov);
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); if (opts && opts.onClose) opts.onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    ov.querySelectorAll('[data-tclose]').forEach(b => b.addEventListener('click', close));
    return { el: ov, q: (s) => ov.querySelector(s), qa: (s) => ov.querySelectorAll(s), close };
  }

  /* =====================================================================
     SALIDAS
     ===================================================================== */
  // Salidas de una semana (de todos los grupos), ya con los cambios de esa semana.
  function weekSalidas(monday) {
    const out = [];
    Object.keys(T.salidas).forEach(gid => {
      const doc = T.salidas[gid] || {};
      const sem = (doc.semanas || {})[monday] || {};
      const cambios = sem.cambios || {};
      Object.values(doc.plantilla || {}).forEach(p => {
        if (!p || !p.id) return;
        if (p.desde && p.desde > monday) return;
        const c = cambios[p.id] || {};
        out.push({
          gid, id: p.id, fija: true, dia: p.dia, hora: p.hora || '', lugar: p.lugar || '',
          conductor: c.conductor !== undefined ? c.conductor : (p.conductor || null),
          conductorFijo: !!p.conductor && c.conductor === undefined,
          territorios: c.territorios !== undefined ? (c.territorios || []) : (p.territorios || []),
          cancelada: !!c.cancelada, fecha: addDays(monday, (p.dia || 1) - 1)
        });
      });
      Object.values(sem.extra || {}).forEach(x => {
        if (!x || !x.id) return;
        out.push({ gid, id: x.id, fija: false, dia: x.dia, hora: x.hora || '', lugar: x.lugar || '', conductor: x.conductor || null, territorios: x.territorios || [], cancelada: false, fecha: addDays(monday, (x.dia || 1) - 1) });
      });
    });
    return out.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora) || grupoName(a.gid).localeCompare(grupoName(b.gid), 'es'));
  }
  // Última vez que condujo cada hermano (para repartir parejo).
  function lastConducted() {
    const m = {};
    Object.keys(T.salidas).forEach(gid => {
      const doc = T.salidas[gid] || {};
      Object.keys(doc.semanas || {}).forEach(mon => {
        const sem = doc.semanas[mon] || {};
        Object.keys(sem.cambios || {}).forEach(sid => {
          const c = sem.cambios[sid]; const p = (doc.plantilla || {})[sid];
          if (c && c.conductor && !c.cancelada) { const f = addDays(mon, ((p && p.dia) || 1) - 1); if (!m[c.conductor] || m[c.conductor] < f) m[c.conductor] = f; }
        });
        Object.values(sem.extra || {}).forEach(x => { if (x && x.conductor) { const f = addDays(mon, (x.dia || 1) - 1); if (!m[x.conductor] || m[x.conductor] < f) m[x.conductor] = f; } });
      });
    });
    return m;
  }
  function conductorPool(gid) {
    if (gid === 'congregacion') return (T.gruposMeta.conductoresCongregacion || []).slice();
    const g = T.grupos[gid]; if (!g) return [];
    return [...new Set([g.encargado, g.auxiliar, ...(g.conductores || [])].filter(Boolean))];
  }

  function renderSalidas(root) {
    const a = access();
    if (!T.week) T.week = mondayLocal(hoy());
    const all = weekSalidas(T.week);
    const gids = Object.keys(T.grupos).sort((x, y) => (T.grupos[x].nombre || '').localeCompare(T.grupos[y].nombre || '', 'es', { numeric: true }));
    const chips = [['todas', `Todas · ${all.length}`], ['congregacion', 'Congregación'], ...gids.map(g => [g, T.grupos[g].nombre || 'Grupo'])];
    if (!chips.some(c => c[0] === T.sFilter)) T.sFilter = 'todas';
    const list = T.sFilter === 'todas' ? all : all.filter(s => s.gid === T.sFilter);
    const canAdd = a.all || a.groups.length;
    let html = `<div class="thead"><h3>Salidas</h3>${canAdd ? '<button type="button" class="btn btn-primary" data-t="s-new">+ Salida</button>' : ''}</div>
      <div class="twk"><button type="button" data-t="wk" data-d="-7" aria-label="Semana anterior">‹</button><span class="lbl">${esc(weekLabel(T.week))}</span>${T.week !== mondayLocal(hoy()) ? '<button type="button" class="hoy" data-t="wk" data-d="0">Hoy</button>' : ''}<button type="button" data-t="wk" data-d="7" aria-label="Semana siguiente">›</button></div>
      <div class="tchips" role="group" aria-label="Filtrar por grupo">${chips.map(([k, l]) => `<button type="button" class="${k === T.sFilter ? 'on' : ''}" data-t="s-filter" data-k="${esc(k)}">${esc(l)}</button>`).join('')}</div>`;
    if (!list.length) {
      html += `<div class="tempty">${all.length ? 'No hay salidas de ese grupo esta semana.' : (canAdd ? 'Todavía no hay salidas.<br>Tocá <b>+ Salida</b> para cargar las de todas las semanas (día, hora, lugar y quién conduce).' : 'No hay salidas cargadas para esta semana.')}</div>`;
    } else {
      html += list.map(s => {
        const L = T.lugares[s.lugar];
        const place = L ? `${TIPOS_L[L.tipo] || '📌'} ${esc(L.nombre)}` : '📌 Lugar sin definir';
        const addr = L && L.direccion ? esc(L.direccion) + ' · ' : '';
        const d = new Date(s.fecha + 'T12:00:00');
        const cond = s.conductor ? `<em>${esc(pubName(s.conductor) || '—')}</em>` : '<em class="falta">falta asignar</em>';
        const terr = s.territorios.length ? `Territorio${s.territorios.length > 1 ? 's' : ''} ${s.territorios.map(tName).filter(Boolean).join(', ')}` : '';
        const ed = canEditGroup(s.gid);
        const pill = s.cancelada ? '<span class="tpill n">Suspendida</span>' : !s.conductor ? '<span class="tpill r">Falta</span>' : `<span class="tpill ${s.gid === 'congregacion' ? 'g' : 'b'}">${esc(grupoName(s.gid))}</span>`;
        return `<button type="button" class="trow${ed ? '' : ' ro'}${s.cancelada ? ' off' : ''}" ${ed ? `data-t="s-edit" data-g="${esc(s.gid)}" data-id="${esc(s.id)}"` : 'tabindex="-1"'}>
          <span class="tday">${DIAS3[(d.getDay() || 7)]} ${d.getDate()}<b>${esc(s.hora || '—')}</b></span>
          <span class="tx"><b>${place}</b><small>${addr}Conduce ${cond}</small>${terr || !s.fija ? `<small>${esc(terr)}${!s.fija ? (terr ? ' · ' : '') + 'solo esta semana' : ''}</small>` : ''}${s.cancelada || !s.conductor ? `<small>${esc(grupoName(s.gid))}</small>` : ''}</span>${pill}</button>`;
      }).join('');
      html += `<div class="tacts">${canAdd ? '<button type="button" class="btn" data-t="s-auto">✨ Auto-asignar conductores</button>' : ''}<button type="button" class="btn btn-primary" data-t="s-share">📤 Compartir</button></div>`;
    }
    root.innerHTML = html;
  }

  function autoAssignConductors() {
    const list = weekSalidas(T.week).filter(s => !s.cancelada && !s.conductor && canEditGroup(s.gid) && (T.sFilter === 'todas' || s.gid === T.sFilter));
    if (!list.length) { showToast('Todas las salidas de la semana ya tienen quién conduce'); return; }
    const last = lastConducted();
    const usedDay = {};
    weekSalidas(T.week).forEach(s => { if (s.conductor) (usedDay[s.fecha] = usedDay[s.fecha] || new Set()).add(s.conductor); });
    const byDoc = {}; let n = 0, sinLista = 0;
    list.forEach(s => {
      const pool = conductorPool(s.gid);
      if (!pool.length) { sinLista++; return; }
      const used = usedDay[s.fecha] || new Set();
      const cand = pool.filter(id => !used.has(id)).sort((x, y) => String(last[x] || '').localeCompare(String(last[y] || '')));
      if (!cand.length) return;
      const pick = cand[0];
      (usedDay[s.fecha] = used).add(pick); last[pick] = s.fecha;
      (byDoc[s.gid] = byDoc[s.gid] || []).push(s.fija ? [['semanas', T.week, 'cambios', s.id, 'conductor'], pick] : [['semanas', T.week, 'extra', s.id, 'conductor'], pick]);
      n++;
    });
    if (!n) { showToast(sinLista ? 'Primero marcá quiénes pueden conducir (pestaña Grupos)' : 'No quedan conductores libres esos días'); return; }
    const undo = () => Object.keys(byDoc).forEach(gid => tWrite(sRef(gid), byDoc[gid].map(([p]) => [p, p[2] === 'cambios' ? undefined : null])).catch(() => {}));
    Promise.all(Object.keys(byDoc).map(gid => tWrite(sRef(gid), byDoc[gid])))
      .then(() => showToast(`Se asignaron ${n} ${n === 1 ? 'conductor' : 'conductores'}${sinLista ? ` · ${sinLista} sin lista de conductores` : ''}`, undo))
      .catch(() => showToast('No se pudo guardar. Revisá la conexión.'));
  }

  function shareSalidas() {
    const list = weekSalidas(T.week).filter(s => !s.cancelada && (T.sFilter === 'todas' || s.gid === T.sFilter));
    if (!list.length) { showToast('No hay salidas para compartir'); return; }
    const cong = (data.settings && data.settings.congregationName) || '';
    let txt = `*Salidas al servicio${T.sFilter !== 'todas' ? ' · ' + grupoName(T.sFilter) : ''}*\n${weekLabel(T.week)}${cong ? ' · ' + cong : ''}\n`;
    list.forEach(s => {
      const d = new Date(s.fecha + 'T12:00:00');
      const L = T.lugares[s.lugar];
      txt += `\n*${DIAS[d.getDay() || 7]} ${d.getDate()} · ${s.hora}*${T.sFilter === 'todas' ? ' — ' + grupoName(s.gid) : ''}\n`;
      if (L) txt += `${TIPOS_L[L.tipo] || '📌'} ${L.nombre}${L.direccion ? ' (' + L.direccion + ')' : ''}\n`;
      txt += `Conduce: ${s.conductor ? pubName(s.conductor) : 'a confirmar'}\n`;
      if (s.territorios.length) txt += `Territorio${s.territorios.length > 1 ? 's' : ''}: ${s.territorios.map(tName).join(', ')}\n`;
    });
    window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener');
  }

  function openSalida(gid, id) {
    const a = access();
    const isNew = !id;
    const cur = isNew ? null : weekSalidas(T.week).find(s => s.gid === gid && s.id === id);
    if (!isNew && !cur) return;
    const editable = [['congregacion', 'Congregación'], ...Object.keys(T.grupos).map(g => [g, T.grupos[g].nombre || 'Grupo'])].filter(([g]) => canEditGroup(g));
    if (!editable.length) { showToast('No tenés grupos para organizar'); return; }
    const st = {
      gid: isNew ? (T.sFilter !== 'todas' && canEditGroup(T.sFilter) ? T.sFilter : editable[0][0]) : gid,
      dia: cur ? cur.dia : 6, hora: cur ? cur.hora : '09:30', lugar: cur ? cur.lugar : '',
      conductor: cur ? cur.conductor : null, siempre: cur ? !!cur.conductorFijo : false,
      territorios: cur ? cur.territorios.slice() : [], cancelada: cur ? cur.cancelada : false,
      fija: cur ? cur.fija : true
    };
    const m = openModal(`<h3>${isNew ? 'Nueva salida' : 'Salida del ' + DIAS[st.dia].toLowerCase()}</h3>
      <p class="modal-sub" style="margin:0 0 12px;">${isNew ? 'Se repite todas las semanas, salvo que la marques solo para esta.' : esc(weekLabel(T.week))}</p>
      <div class="tf"><label>Es de</label><div class="topts" id="tsG"></div></div>
      <div class="trow2"><div class="tf"><label for="tsDia">Día</label><select id="tsDia">${DIAS.slice(1).map((d, i) => `<option value="${i + 1}">${d}</option>`).join('')}</select></div>
        <div class="tf"><label for="tsHora">Hora</label><input type="time" id="tsHora"></div></div>
      <div class="tf"><label for="tsLugar">Lugar de encuentro</label><select id="tsLugar"></select></div>
      ${isNew ? '<label class="tchk" style="border-top:none;padding-top:0;"><input type="checkbox" id="tsFija" checked> Se repite todas las semanas</label>' : ''}
      <div class="tsec"><span class="tlbl">${isNew ? 'Esta semana' : 'Esta semana · ' + esc(weekLabel(T.week).replace('Semana del ', ''))}</span>
        <div class="tf"><label for="tsCond">Conduce</label><select id="tsCond"></select></div>
        <label class="tchk" style="border-top:none;padding-top:0;" id="tsSiempreW"><input type="checkbox" id="tsSiempre"> Conduce siempre (todas las semanas)</label>
        <div class="tf"><label>Territorios</label><div class="ttags" id="tsTags"></div><select id="tsTerr"></select></div>
        ${!isNew && st.fija ? '<label class="tchk"><input type="checkbox" id="tsCancel"> Suspendida esta semana</label>' : ''}
      </div>
      <div class="tfoot">${!isNew ? `<button type="button" class="btn btn-danger" id="tsDel">${st.fija ? 'Quitar' : 'Borrar'}</button>` : ''}<button type="button" class="btn" data-tclose>Cancelar</button><button type="button" class="btn btn-primary" id="tsSave">Guardar</button></div>`);
    const q = m.q;
    function paintGroups() {
      q('#tsG').innerHTML = editable.map(([g, l]) => `<button type="button" class="${g === st.gid ? 'on' : ''}" data-g="${esc(g)}" ${!isNew && g !== gid ? 'disabled style="opacity:.45"' : ''}>${esc(l)}</button>`).join('');
    }
    function paintLugar() {
      const ls = Object.values(T.lugares).sort((x, y) => (x.nombre || '').localeCompare(y.nombre || '', 'es'));
      q('#tsLugar').innerHTML = '<option value="">Elegí el lugar…</option>' + ls.map(l => `<option value="${esc(l.id)}"${l.id === st.lugar ? ' selected' : ''}>${TIPOS_L[l.tipo] || '📌'} ${esc(l.nombre)}${l.direccion ? ' · ' + esc(l.direccion) : ''}</option>`).join('') + '<option value="__new">+ Nuevo lugar…</option>';
    }
    function paintCond() {
      const last = lastConducted();
      const pool = conductorPool(st.gid);
      const lbl = (id) => `${esc(pubName(id))}${last[id] ? ' · condujo ' + agoTxt(last[id]) : ''}`;
      const others = sortPubs(pubs().filter(p => !pool.includes(p.id)));
      q('#tsCond').innerHTML = '<option value="">Sin asignar</option>'
        + (pool.length ? `<optgroup label="${st.gid === 'congregacion' ? 'Conductores de congregación' : 'Del grupo'}">${pool.map(id => `<option value="${esc(id)}"${id === st.conductor ? ' selected' : ''}>${lbl(id)}</option>`).join('')}</optgroup>` : '')
        + `<optgroup label="Otros hermanos">${others.map(p => `<option value="${esc(p.id)}"${p.id === st.conductor ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`;
      q('#tsSiempre').checked = st.siempre;
      q('#tsSiempreW').style.display = (isNew ? q('#tsFija').checked : st.fija) ? '' : 'none';
    }
    function paintTerr() {
      q('#tsTags').innerHTML = st.territorios.map(t => `<span>${esc(tName(t))}${T.territorios[t] ? ' · ' + esc(T.territorios[t].nombre || '') : ''}<button type="button" data-rm="${esc(t)}" aria-label="Quitar">✕</button></span>`).join('');
      const opts = Object.values(T.territorios).filter(t => !st.territorios.includes(t.id)).sort((x, y) => String(x.num).localeCompare(String(y.num), 'es', { numeric: true }));
      q('#tsTerr').innerHTML = `<option value="">${opts.length ? '+ Agregar territorio…' : (Object.keys(T.territorios).length ? 'No hay más territorios' : 'Todavía no hay territorios cargados')}</option>` + opts.map(t => `<option value="${esc(t.id)}">${esc(t.num)} · ${esc(t.nombre || '')}</option>`).join('');
    }
    paintGroups(); paintLugar(); paintCond(); paintTerr();
    q('#tsDia').value = String(st.dia); q('#tsHora').value = st.hora;
    if (q('#tsCancel')) q('#tsCancel').checked = st.cancelada;
    if (!isNew && st.fija && !a.all && !canEditGroup(gid)) { /* sin permiso: no debería llegar */ }
    q('#tsG').addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (!b || b.disabled) return; st.gid = b.dataset.g; paintGroups(); paintCond(); });
    q('#tsLugar').addEventListener('change', (e) => {
      if (e.target.value === '__new') { openLugar(null, (nid) => { st.lugar = nid || st.lugar; paintLugar(); }); e.target.value = st.lugar; return; }
      st.lugar = e.target.value;
    });
    q('#tsCond').addEventListener('change', (e) => { st.conductor = e.target.value || null; });
    q('#tsSiempre').addEventListener('change', (e) => { st.siempre = e.target.checked; });
    if (q('#tsFija')) q('#tsFija').addEventListener('change', paintCond);
    q('#tsTerr').addEventListener('change', (e) => { if (e.target.value) { st.territorios.push(e.target.value); paintTerr(); } });
    q('#tsTags').addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { st.territorios = st.territorios.filter(t => t !== b.dataset.rm); paintTerr(); } });
    if (q('#tsDel')) q('#tsDel').addEventListener('click', async () => {
      const msg = cur.fija ? '¿Quitar esta salida de todas las semanas? (Si es solo esta semana, usá "Suspendida esta semana".)' : '¿Borrar esta salida?';
      if (!confirm(msg)) return;
      const path = cur.fija ? ['plantilla', cur.id] : ['semanas', T.week, 'extra', cur.id];
      if (await safe(() => tWrite(sRef(cur.gid), [[path, undefined]]), 'Salida quitada')) m.close();
    });
    q('#tsSave').addEventListener('click', async () => {
      st.dia = parseInt(q('#tsDia').value, 10) || 1;
      st.hora = /^\d{2}:\d{2}$/.test(q('#tsHora').value) ? q('#tsHora').value : '';
      if (!st.hora) { showToast('Poné la hora de la salida'); return; }
      if (!st.lugar) { showToast('Elegí el lugar de encuentro'); return; }
      const cancel = q('#tsCancel') ? q('#tsCancel').checked : false;
      const fija = isNew ? q('#tsFija').checked : st.fija;
      const sid = isNew ? newId() : cur.id;
      const pairs = [];
      if (fija) {
        const base = isNew ? { id: sid, dia: st.dia, hora: st.hora, lugar: st.lugar, conductor: st.siempre ? st.conductor : null, territorios: [], desde: T.week } : null;
        if (isNew) pairs.push([['plantilla', sid], base]);
        else {
          pairs.push([['plantilla', sid, 'dia'], st.dia], [['plantilla', sid, 'hora'], st.hora], [['plantilla', sid, 'lugar'], st.lugar]);
          pairs.push([['plantilla', sid, 'conductor'], st.siempre ? st.conductor : null]);
        }
        const ch = { territorios: st.territorios, cancelada: !!cancel };
        if (!st.siempre) ch.conductor = st.conductor;
        pairs.push([['semanas', T.week, 'cambios', sid], ch]);
      } else {
        pairs.push([['semanas', T.week, 'extra', sid], { id: sid, dia: st.dia, hora: st.hora, lugar: st.lugar, conductor: st.conductor, territorios: st.territorios }]);
      }
      if (await safe(() => tWrite(sRef(st.gid), pairs), isNew ? 'Salida agregada' : 'Salida guardada')) m.close();
    });
  }

  /* =====================================================================
     TERRITORIOS
     ===================================================================== */
  function tState(t) {
    const h = hoy();
    if (t.asignado && t.asignado.desde) return daysBetween(t.asignado.desde, h) > VENCE_DIAS ? 'vencido' : 'asignado';
    if (!t.ultimoTerminado || daysBetween(t.ultimoTerminado, h) > ANIO_DIAS) return 'anio';
    return 'disponible';
  }
  const ST_PILL = { disponible: ['g', 'Disponible'], asignado: ['b', 'Asignado'], vencido: ['r', 'Vencido'], anio: ['o', '+1 año'] };
  function asignadoName(as) { if (!as) return ''; return as.tipo === 'grupo' ? grupoName(as.id) + (T.grupos[as.id] && T.grupos[as.id].encargado ? ` (${pubName(T.grupos[as.id].encargado)})` : '') : pubName(as.id); }
  function tSub(t) {
    const s = tState(t);
    if (s === 'asignado' || s === 'vencido') return `${esc(asignadoName(t.asignado))} · ${agoTxt(t.asignado.desde)}`;
    if (!t.ultimoTerminado) return `Sin fecha de la última vez · ${esc(TIPOS_T[t.tipo] || '')}`;
    return s === 'anio' ? `Sin trabajar desde ${fmtMonthYear(t.ultimoTerminado)} · ${esc((TIPOS_T[t.tipo] || '').toLowerCase())}` : `Terminado ${agoTxt(t.ultimoTerminado)} · ${esc((TIPOS_T[t.tipo] || '').toLowerCase())}`;
  }
  function renderTerritorios(root) {
    const all = Object.values(T.territorios);
    const cnt = { disponible: 0, asignado: 0, vencido: 0, anio: 0 };
    all.forEach(t => { cnt[tState(t)]++; });
    const f = T.tFilter;
    const qn = accNorm(T.tSearch.trim());
    let list = all.filter(t => {
      const s = tState(t);
      if (f === 'primero' && !(s === 'anio' || s === 'disponible')) return false;
      if (f === 'asignados' && !(s === 'asignado' || s === 'vencido')) return false;
      if (['disponible', 'vencido', 'anio'].includes(f) && s !== f) return false;
      if (f === 'grupos' && !(t.asignado && t.asignado.tipo === 'grupo')) return false;
      if (qn && !accNorm(`${t.num} ${t.nombre || ''} ${asignadoName(t.asignado)}`).includes(qn)) return false;
      return true;
    });
    if (f === 'primero') list.sort((x, y) => String(x.ultimoTerminado || '').localeCompare(String(y.ultimoTerminado || '')));
    else list.sort((x, y) => String(x.num).localeCompare(String(y.num), 'es', { numeric: true }));
    const kpi = (k, cls, n, l) => `<button type="button" class="tkpi ${cls}${f === k ? ' on' : ''}" data-t="t-filter" data-k="${k}"><b>${n}</b><span>${l}</span></button>`;
    const chips = [['todos', `Todos · ${all.length}`], ['primero', 'Para dar primero'], ['asignados', 'Asignados'], ['grupos', 'A grupos']];
    let html = `<div class="thead"><h3>Territorios</h3>${access().all ? '<button type="button" class="btn btn-primary" data-t="t-new">+ Territorio</button>' : ''}</div>`;
    if (!all.length) {
      root.innerHTML = html + `<div class="tempty">Todavía no hay territorios cargados.<br>Tocá <b>+ Territorio</b> y cargá cada uno con su número, la zona, <b>una foto de la tarjeta</b> y la última fecha en que se terminó (sale del registro en papel). Con eso el semáforo funciona desde el primer día.</div>`;
      return;
    }
    html += `<div class="tkpis">${kpi('disponible', 'g', cnt.disponible, 'Disponibles')}${kpi('asignados', 'b', cnt.asignado + cnt.vencido, 'Asignados')}${kpi('vencido', 'r', cnt.vencido, 'Vencidos')}${kpi('anio', 'o', cnt.anio, '+1 año sin trabajar')}</div>
      <input type="search" class="tsearch" id="tSearch" placeholder="🔍 Buscar por número, zona o hermano" value="${esc(T.tSearch)}" autocomplete="off">
      <div class="tchips">${chips.map(([k, l]) => `<button type="button" class="${k === f ? 'on' : ''}" data-t="t-filter" data-k="${k}">${esc(l)}</button>`).join('')}</div>
      <div id="tList">`;
    html += list.length ? list.map(t => { const [c, l] = ST_PILL[tState(t)]; return `<button type="button" class="trow" data-t="t-open" data-id="${esc(t.id)}"><span class="tnum">${esc(t.num)}</span><span class="tx"><b>${esc(t.nombre || 'Territorio ' + t.num)}</b><small>${tSub(t)}</small></span><span class="tpill ${c}">${l}</span></button>`; }).join('') : '<div class="tempty">Ningún territorio coincide.</div>';
    html += '</div>';
    if (f === 'primero') html = html.replace('<div id="tList">', '<p class="hint" style="margin:0 0 8px;">Los que hace más tiempo que no se trabajan, primero.</p><div id="tList">');
    root.innerHTML = html;
    const inp = $('tSearch');
    if (inp) inp.addEventListener('input', () => { T.tSearch = inp.value; const pos = inp.selectionStart; render(); const n = $('tSearch'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* nada */ } } });
  }

  function openTerritorio(id) {
    const t = T.territorios[id]; if (!t) return;
    const s = tState(t);
    const [c, l] = ST_PILL[s];
    const hist = (t.historial || []).slice(0, 12);
    const all = access().all;
    const m = openModal(`<h3 style="display:flex;justify-content:space-between;gap:8px;"><span>${esc(t.num)} · ${esc(t.nombre || '')}</span><span class="tpill ${c}">${l}</span></h3>
      ${t.foto && t.foto.url ? `<img class="tphoto" src="${esc(t.foto.url)}" alt="Tarjeta del territorio ${esc(t.num)}" id="tPh">` : '<div class="tnophoto">Sin foto de la tarjeta todavía</div>'}
      <div class="tcard" style="padding:8px 11px;">
        <div class="tkv"><span>Tipo</span><b>${esc(TIPOS_T[t.tipo] || '—')}</b></div>
        <div class="tkv"><span>${t.asignado ? 'Asignado a' : 'Estado'}</span><b>${t.asignado ? esc(asignadoName(t.asignado)) + ' · ' + fmtShort(t.asignado.desde) : 'Disponible'}</b></div>
        <div class="tkv"><span>Última vez terminado</span><b>${t.ultimoTerminado ? fmtShort(t.ultimoTerminado) + ' ' + new Date(t.ultimoTerminado + 'T12:00:00').getFullYear() : 'Sin fecha'}</b></div>
        ${t.notas ? `<div class="tkv" style="display:block;"><span>Notas</span><div style="font-size:13px;margin-top:2px;white-space:pre-wrap;">${esc(t.notas)}</div></div>` : ''}
      </div>
      ${all ? `<div class="tfoot" style="margin-top:4px;">${t.asignado ? '<button type="button" class="btn btn-primary" id="tDone" style="background:#4C7A5E;border-color:#4C7A5E;">✓ Marcar terminado</button><button type="button" class="btn" id="tAsg">Reasignar</button>' : '<button type="button" class="btn btn-primary" id="tAsg">Asignar</button>'}</div>` : ''}
      <div class="tsec"><span class="tlbl">Historial</span><div class="thist">${hist.length ? hist.map(h => `<div><b>${esc(h.nombre || '')}</b><span>${fmtShort(h.desde)}${h.hasta ? ' → ' + fmtShort(h.hasta) + ' ' + h.hasta.slice(0, 4) : ' → en curso'}</span></div>`).join('') : '<div><span>Todavía sin registros en la app.</span></div>'}</div></div>
      <div class="tfoot">${all ? '<button type="button" class="btn" id="tEdit">Editar</button>' : ''}<button type="button" class="btn" data-tclose>Cerrar</button></div>`);
    if (m.q('#tPh')) m.q('#tPh').addEventListener('click', () => window.open(t.foto.url, '_blank', 'noopener'));
    if (m.q('#tEdit')) m.q('#tEdit').addEventListener('click', () => { m.close(); openTerritorioForm(id); });
    if (m.q('#tAsg')) m.q('#tAsg').addEventListener('click', () => { m.close(); openAsignar(id); });
    if (m.q('#tDone')) m.q('#tDone').addEventListener('click', () => { m.close(); openTerminar(id); });
  }

  function openTerminar(id) {
    const t = T.territorios[id]; if (!t || !t.asignado) return;
    const m = openModal(`<h3>Territorio ${esc(t.num)} terminado</h3><p class="modal-sub" style="margin:0 0 12px;">Lo tenía ${esc(asignadoName(t.asignado))} desde el ${fmtShort(t.asignado.desde)}.</p>
      <div class="tf"><label for="tDoneDate">Fecha en que se terminó</label><input type="date" id="tDoneDate" value="${hoy()}"></div>
      <div class="tfoot"><button type="button" class="btn" data-tclose>Cancelar</button><button type="button" class="btn btn-primary" id="tDoneOk">Guardar</button></div>`);
    m.q('#tDoneOk').addEventListener('click', async () => {
      const f = m.q('#tDoneDate').value || hoy();
      const hist = (t.historial || []).slice();
      if (hist[0] && !hist[0].hasta && hist[0].id === t.asignado.id) hist[0] = Object.assign({}, hist[0], { hasta: f });
      else hist.unshift({ tipo: t.asignado.tipo, id: t.asignado.id, nombre: asignadoName(t.asignado), desde: t.asignado.desde, hasta: f });
      const nt = Object.assign({}, t, { asignado: null, ultimoTerminado: f, historial: hist.slice(0, 40) });
      if (await safe(() => tWrite(tRef('territorios'), [[['lista', id], nt]]), `Territorio ${t.num} terminado`)) m.close();
    });
  }

  function territoryHolders() {
    const cur = {}, last = {};
    Object.values(T.territorios).forEach(t => {
      if (t.asignado) { cur[t.asignado.tipo + ':' + t.asignado.id] = (cur[t.asignado.tipo + ':' + t.asignado.id] || []).concat(t.num); last[t.asignado.tipo + ':' + t.asignado.id] = hoy(); }
      (t.historial || []).forEach(h => { const k = h.tipo + ':' + h.id; const f = h.hasta || h.desde; if (f && (!last[k] || last[k] < f)) last[k] = f; });
    });
    return { cur, last };
  }
  function openAsignar(id) {
    const t = T.territorios[id]; if (!t) return;
    const { cur, last } = territoryHolders();
    const st = { tipo: 'hermano', sel: null, q: '' };
    const m = openModal(`<h3>Asignar el territorio ${esc(t.num)}</h3><p class="modal-sub" style="margin:0 0 10px;">${esc(t.nombre || '')}</p>
      <div class="tseg" id="taSeg"><button type="button" class="on" data-k="hermano">Hermano</button><button type="button" data-k="grupo">Grupo</button></div>
      <input type="search" class="tsearch" id="taQ" placeholder="🔍 Buscar" autocomplete="off">
      <div class="tlist" id="taList"></div>
      <div class="tf"><label for="taDate">Desde</label><input type="date" id="taDate" value="${hoy()}"></div>
      <div class="tfoot"><button type="button" class="btn" data-tclose>Cancelar</button><button type="button" class="btn btn-primary" id="taOk" disabled>Asignar</button></div>`);
    function paint() {
      const qn = accNorm(st.q.trim());
      let html = '';
      if (st.tipo === 'hermano') {
        const ps = pubs().filter(p => !qn || accNorm(p.name).includes(qn));
        const free = ps.filter(p => !cur['hermano:' + p.id]).sort((a, b) => String(last['hermano:' + a.id] || '').localeCompare(String(last['hermano:' + b.id] || '')) || a.name.localeCompare(b.name, 'es'));
        const busy = sortPubs(ps.filter(p => cur['hermano:' + p.id]));
        const row = (p, sub) => `<button type="button" class="tpick${st.sel === p.id ? ' on' : ''}" data-id="${esc(p.id)}"><span>${esc(p.name)}<small>${sub}</small></span>${st.sel === p.id ? '✓' : ''}</button>`;
        html += `<div class="tlbl" style="margin-top:6px;">Sin territorio ahora</div>` + (free.map(p => row(p, last['hermano:' + p.id] ? 'Último: ' + agoTxt(last['hermano:' + p.id]) : 'Todavía no tuvo en la app')).join('') || '<p class="hint">Nadie.</p>');
        if (busy.length) html += `<div class="tlbl" style="margin-top:8px;">Ya tienen uno</div>` + busy.map(p => row(p, 'Tiene el ' + cur['hermano:' + p.id].join(', '))).join('');
      } else {
        const gs = Object.values(T.grupos).filter(g => !qn || accNorm(g.nombre || '').includes(qn)).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { numeric: true }));
        html = gs.length ? gs.map(g => `<button type="button" class="tpick${st.sel === g.id ? ' on' : ''}" data-id="${esc(g.id)}"><span>${esc(g.nombre)}<small>${g.encargado ? 'Encargado: ' + esc(pubName(g.encargado)) : ''}${cur['grupo:' + g.id] ? ' · tiene el ' + cur['grupo:' + g.id].join(', ') : ''}</small></span>${st.sel === g.id ? '✓' : ''}</button>`).join('') : '<p class="hint">Todavía no hay grupos. Se crean en la pestaña Grupos.</p>';
      }
      m.q('#taList').innerHTML = html;
      const btn = m.q('#taOk');
      btn.disabled = !st.sel;
      btn.textContent = st.sel ? 'Asignar a ' + (st.tipo === 'grupo' ? grupoName(st.sel) : pubName(st.sel)) : 'Asignar';
    }
    m.q('#taSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; st.tipo = b.dataset.k; st.sel = null; m.qa('#taSeg button').forEach(x => x.classList.toggle('on', x === b)); paint(); });
    m.q('#taQ').addEventListener('input', (e) => { st.q = e.target.value; paint(); });
    m.q('#taList').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (!b) return; st.sel = b.dataset.id; paint(); });
    m.q('#taOk').addEventListener('click', async () => {
      if (!st.sel) return;
      const desde = m.q('#taDate').value || hoy();
      const asg = { tipo: st.tipo, id: st.sel, desde };
      const hist = (t.historial || []).slice();
      if (t.asignado) { // reasignación: se cierra la anterior sin marcarla como terminada
        if (hist[0] && !hist[0].hasta) hist[0] = Object.assign({}, hist[0], { hasta: desde, reasignado: true });
      }
      hist.unshift({ tipo: st.tipo, id: st.sel, nombre: st.tipo === 'grupo' ? grupoName(st.sel) : pubName(st.sel), desde, hasta: null });
      const nt = Object.assign({}, t, { asignado: asg, historial: hist.slice(0, 40) });
      if (await safe(() => tWrite(tRef('territorios'), [[['lista', id], nt]]), `Territorio ${t.num} asignado a ${hist[0].nombre}`)) m.close();
    });
    paint();
  }

  // Achica la foto antes de subirla (las tarjetas escaneadas con el celular pesan mucho).
  function shrinkImage(file, max) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => b ? res(b) : rej(new Error('imagen')), 'image/jpeg', 0.82);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => rej(new Error('imagen'));
      img.src = URL.createObjectURL(file);
    });
  }
  function openTerritorioForm(id) {
    const t = id ? T.territorios[id] : null;
    const nums = Object.values(T.territorios).map(x => parseInt(x.num, 10)).filter(n => !isNaN(n));
    const m = openModal(`<h3>${t ? 'Editar territorio' : 'Nuevo territorio'}</h3>
      <div class="trow2"><div class="tf" style="flex:0 0 90px;"><label for="tfNum">Número</label><input id="tfNum" inputmode="numeric" value="${esc(t ? t.num : (nums.length ? Math.max(...nums) + 1 : 1))}"></div>
        <div class="tf"><label for="tfNom">Zona o nombre</label><input id="tfNom" value="${esc(t ? t.nombre || '' : '')}" placeholder="Ej: Centro Norte"></div></div>
      <div class="tf"><label for="tfTipo">Tipo</label><select id="tfTipo">${Object.entries(TIPOS_T).map(([k, v]) => `<option value="${k}"${t && t.tipo === k ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="tf"><label>Foto de la tarjeta</label>${t && t.foto && t.foto.url ? `<img class="tphoto" src="${esc(t.foto.url)}" alt="" style="max-height:160px;">` : ''}<input type="file" id="tfFoto" accept="image/*"><small class="hint" id="tfFotoMsg">Sacale una foto a la tarjeta de papel, con buena luz.</small></div>
      <div class="tf"><label for="tfUlt">Última vez que se terminó</label><input type="date" id="tfUlt" value="${esc(t ? t.ultimoTerminado || '' : '')}"><small class="hint">Del registro en papel. Si no se sabe, dejalo vacío.</small></div>
      <div class="tf"><label for="tfNotas">Notas</label><textarea id="tfNotas" placeholder="Ej: tiene 2 edificios con portero">${esc(t ? t.notas || '' : '')}</textarea></div>
      <div class="tfoot">${t ? '<button type="button" class="btn btn-danger" id="tfDel">Borrar</button>' : ''}<button type="button" class="btn" data-tclose>Cancelar</button><button type="button" class="btn btn-primary" id="tfSave">Guardar</button></div>`);
    if (m.q('#tfDel')) m.q('#tfDel').addEventListener('click', async () => {
      if (!confirm(`¿Borrar el territorio ${t.num} y su historial?`)) return;
      if (await safe(() => tWrite(tRef('territorios'), [[['lista', id], undefined]]), 'Territorio borrado')) {
        if (t.foto && t.foto.path) { try { firebase.storage().ref(t.foto.path).delete().catch(() => {}); } catch (e) { /* nada */ } }
        m.close();
      }
    });
    m.q('#tfSave').addEventListener('click', async () => {
      const num = m.q('#tfNum').value.trim();
      if (!num) { showToast('Poné el número del territorio'); return; }
      if (Object.values(T.territorios).some(x => String(x.num) === num && x.id !== (t && t.id))) { showToast(`Ya existe el territorio ${num}`); return; }
      const btn = m.q('#tfSave'); btn.disabled = true; btn.textContent = 'Guardando…';
      const tid = t ? t.id : newId();
      let foto = t ? t.foto || null : null;
      const file = m.q('#tfFoto').files && m.q('#tfFoto').files[0];
      if (file) {
        try {
          m.q('#tfFotoMsg').textContent = 'Subiendo la foto…';
          const blob = await shrinkImage(file, 1600);
          const path = `congregations/${accessCode}/territorios/${tid}-${Date.now()}.jpg`;
          const ref = firebase.storage().ref(path);
          await ref.put(blob, { contentType: 'image/jpeg' });
          const url = await ref.getDownloadURL();
          if (foto && foto.path) { try { firebase.storage().ref(foto.path).delete().catch(() => {}); } catch (e) { /* nada */ } }
          foto = { url, path };
        } catch (e) {
          console.error(e); btn.disabled = false; btn.textContent = 'Guardar';
          m.q('#tfFotoMsg').textContent = 'No se pudo subir la foto. Revisá la conexión y probá de nuevo.';
          return;
        }
      }
      const nt = Object.assign({ historial: [], asignado: null }, t || {}, {
        id: tid, num, nombre: m.q('#tfNom').value.trim(), tipo: m.q('#tfTipo').value,
        ultimoTerminado: m.q('#tfUlt').value || null, notas: m.q('#tfNotas').value.trim(), foto
      });
      if (await safe(() => tWrite(tRef('territorios'), [[['lista', tid], nt]]), t ? 'Territorio guardado' : `Territorio ${num} agregado`)) m.close();
      else { btn.disabled = false; btn.textContent = 'Guardar'; }
    });
  }

  /* =====================================================================
     GRUPOS
     ===================================================================== */
  function groupOf(pid) { return Object.values(T.grupos).find(g => (g.miembros || []).includes(pid)); }
  function renderGrupos(root) {
    const gs = Object.values(T.grupos).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { numeric: true }));
    const sin = pubs().filter(p => !groupOf(p.id));
    const salidasDe = (gid) => { const d = T.salidas[gid]; return d ? Object.values(d.plantilla || {}).sort((a, b) => a.dia - b.dia).map(s => `${DIAS3[s.dia].charAt(0)}${DIAS3[s.dia].slice(1).toLowerCase()} ${s.hora}`).join(' · ') : ''; };
    let html = `<div class="thead"><h3>Grupos de predicación</h3><button type="button" class="btn btn-primary" data-t="g-new">+ Grupo</button></div>`;
    if (!gs.length) html += '<div class="tempty">Todavía no hay grupos.<br>Creá cada grupo con su encargado, su auxiliar y sus hermanos. El encargado y el auxiliar pueden organizar las salidas de su grupo.</div>';
    html += gs.map(g => `<button type="button" class="trow" data-t="g-edit" data-id="${esc(g.id)}" style="display:block;">
        <span class="tx"><b style="display:flex;justify-content:space-between;">${esc(g.nombre)}<small style="font-weight:400;">${(g.miembros || []).length} hermanos</small></b>
        <small>Encargado: <em>${esc(pubName(g.encargado) || '—')}</em>${g.auxiliar ? ' · Auxiliar: <em>' + esc(pubName(g.auxiliar)) + '</em>' : ''}</small>
        ${salidasDe(g.id) ? `<small>Salidas: ${esc(salidasDe(g.id))}</small>` : ''}
        ${g.encargado && !groupEditors(g).length ? '<small style="color:var(--danger,#A8433A);">El encargado no tiene email vinculado: no va a poder organizar las salidas.</small>' : ''}</span></button>`).join('');
    const cc = T.gruposMeta.conductoresCongregacion || [];
    html += `<button type="button" class="trow" data-t="g-cong" style="display:block;"><span class="tx"><b>Salidas de congregación</b><small>Pueden conducir: ${cc.length ? esc(cc.map(pubName).filter(Boolean).join(', ')) : '<em class="falta">nadie marcado todavía</em>'}</small></span></button>`;
    if (sin.length && gs.length) html += `<div class="tnote"><b>Sin grupo · ${sin.length} ${sin.length === 1 ? 'hermano' : 'hermanos'}</b><br>${esc(sortPubs(sin).slice(0, 12).map(p => p.name).join(', '))}${sin.length > 12 ? '…' : ''}<br><span class="hint">Se agregan desde cada grupo ("Hermanos del grupo").</span></div>`;
    root.innerHTML = html;
  }
  function openPubsPicker(title, selected, onDone, note) {
    const sel = new Set(selected);
    const m = openModal(`<h3>${esc(title)}</h3>${note ? `<p class="modal-sub" style="margin:0 0 8px;">${esc(note)}</p>` : ''}
      <input type="search" class="tsearch" id="ppQ" placeholder="🔍 Buscar hermano" autocomplete="off"><div class="tlist" id="ppL"></div>
      <div class="tfoot"><button type="button" class="btn" data-tclose>Cancelar</button><button type="button" class="btn btn-primary" id="ppOk">Listo</button></div>`);
    const paint = () => {
      const qn = accNorm(m.q('#ppQ').value.trim());
      const ps = sortPubs(pubs().filter(p => !qn || accNorm(p.name).includes(qn)));
      ps.sort((a, b) => (sel.has(b.id) - sel.has(a.id)));
      m.q('#ppL').innerHTML = ps.map(p => { const g = groupOf(p.id); return `<label class="tchk"><input type="checkbox" data-id="${esc(p.id)}"${sel.has(p.id) ? ' checked' : ''}><span>${esc(p.name)}${g && note ? ` <small>· ${esc(g.nombre)}</small>` : ''}</span></label>`; }).join('');
    };
    m.q('#ppQ').addEventListener('input', paint);
    m.q('#ppL').addEventListener('change', (e) => { const c = e.target.closest('[data-id]'); if (c) { if (c.checked) sel.add(c.dataset.id); else sel.delete(c.dataset.id); } });
    m.q('#ppOk').addEventListener('click', () => { m.close(); onDone([...sel]); });
    paint();
  }
  function openGrupo(id) {
    const g = id ? T.grupos[id] : null;
    const st = { nombre: g ? g.nombre : `Grupo ${Object.keys(T.grupos).length + 1}`, encargado: g ? g.encargado || '' : '', auxiliar: g ? g.auxiliar || '' : '', miembros: g ? (g.miembros || []).slice() : [], conductores: g ? (g.conductores || []).slice() : [] };
    const opts = (v) => '<option value="">—</option>' + sortPubs(pubs()).map(p => `<option value="${esc(p.id)}"${p.id === v ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    const m = openModal(`<h3>${g ? 'Editar grupo' : 'Nuevo grupo'}</h3>
      <div class="tf"><label for="gN">Nombre</label><input id="gN" value="${esc(st.nombre)}"></div>
      <div class="trow2"><div class="tf"><label for="gE">Encargado</label><select id="gE">${opts(st.encargado)}</select></div><div class="tf"><label for="gA">Auxiliar</label><select id="gA">${opts(st.auxiliar)}</select></div></div>
      <p class="hint" style="margin:-6px 0 10px;">El encargado y el auxiliar pueden organizar las salidas del grupo (necesitan tener el email vinculado en Acceso).</p>
      <div class="tf"><label>Hermanos del grupo</label><div class="ttags" id="gM"></div><button type="button" class="btn" id="gMBtn">Elegir hermanos</button></div>
      <div class="tf"><label>Pueden conducir las salidas</label><p class="hint" style="margin:0 0 6px;">Además del encargado y el auxiliar. Se usan para "Auto-asignar conductores".</p><div class="ttags" id="gC"></div><button type="button" class="btn" id="gCBtn">Elegir conductores</button></div>
      <div class="tfoot">${g ? '<button type="button" class="btn btn-danger" id="gDel">Borrar</button>' : ''}<button type="button" class="btn" data-tclose>Cancelar</button><button type="button" class="btn btn-primary" id="gOk">Guardar</button></div>`);
    const tags = (ids) => ids.length ? sortPubs(ids.map(i => (data.publishers || []).find(p => p.id === i)).filter(Boolean)).map(p => `<span>${esc(p.name)}</span>`).join('') : '<span style="background:var(--bg);color:var(--ink-soft);padding-right:10px;">Nadie todavía</span>';
    const paint = () => { m.q('#gM').innerHTML = tags(st.miembros); m.q('#gC').innerHTML = tags(st.conductores); };
    paint();
    m.q('#gMBtn').addEventListener('click', () => openPubsPicker('Hermanos del grupo', st.miembros, (ids) => { st.miembros = ids; paint(); }, 'Si un hermano estaba en otro grupo, pasa a este.'));
    m.q('#gCBtn').addEventListener('click', () => openPubsPicker('Pueden conducir', st.conductores, (ids) => { st.conductores = ids; paint(); }));
    if (m.q('#gDel')) m.q('#gDel').addEventListener('click', async () => {
      const d = T.salidas[id];
      if (d && Object.keys(d.plantilla || {}).length) { showToast('Primero quitá las salidas de este grupo'); return; }
      if (!confirm(`¿Borrar ${g.nombre}?`)) return;
      if (await safe(() => tWrite(tRef('grupos'), [[['lista', id], undefined]]), 'Grupo borrado')) m.close();
    });
    m.q('#gOk').addEventListener('click', async () => {
      const nombre = m.q('#gN').value.trim();
      if (!nombre) { showToast('Poné el nombre del grupo'); return; }
      const gid = g ? g.id : newId();
      const ng = { id: gid, nombre, encargado: m.q('#gE').value || null, auxiliar: m.q('#gA').value || null, miembros: st.miembros, conductores: st.conductores };
      ng.editores = groupEditors(ng);
      ng.miembros = [...new Set([...ng.miembros, ng.encargado, ng.auxiliar].filter(Boolean))];
      const pairs = [[['lista', gid], ng]];
      // Un hermano está en un solo grupo: se lo saca de los otros.
      Object.values(T.grupos).forEach(o => {
        if (o.id === gid) return;
        const keep = (o.miembros || []).filter(p => !ng.miembros.includes(p));
        if (keep.length !== (o.miembros || []).length) pairs.push([['lista', o.id, 'miembros'], keep]);
      });
      const allEd = new Set(); Object.values(T.grupos).forEach(o => { if (o.id !== gid) groupEditors(o).forEach(x => allEd.add(x)); }); ng.editores.forEach(x => allEd.add(x));
      pairs.push([['editoresTodos'], [...allEd].sort()]);
      if (await safe(() => tWrite(tRef('grupos'), pairs), g ? 'Grupo guardado' : `${nombre} creado`)) m.close();
    });
  }

  /* =====================================================================
     LUGARES
     ===================================================================== */
  function mapsUrl(l) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(l.direccion || l.nombre || ''); }
  function renderLugares(root) {
    const ls = Object.values(T.lugares).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    const used = {};
    Object.keys(T.salidas).forEach(g => Object.values((T.salidas[g] || {}).plantilla || {}).forEach(s => { used[s.lugar] = (used[s.lugar] || 0) + 1; }));
    let html = `<div class="thead"><h3>Lugares de encuentro</h3><button type="button" class="btn btn-primary" data-t="l-new">+ Lugar</button></div>`;
    if (!ls.length) html += '<div class="tempty">Todavía no hay lugares.<br>Cargá una vez cada casa, esquina o el Salón donde se juntan para salir, con su dirección. Después se eligen de la lista al armar las salidas.</div>';
    html += ls.map(l => `<button type="button" class="trow" data-t="l-edit" data-id="${esc(l.id)}"><span class="tnum" style="font-size:18px;">${TIPOS_L[l.tipo] || '📌'}</span><span class="tx"><b>${esc(l.nombre)}</b><small>${esc(l.direccion || 'Sin dirección')}${used[l.id] ? ` · ${used[l.id]} ${used[l.id] === 1 ? 'salida' : 'salidas'}` : ''}</small></span></button>`).join('');
    root.innerHTML = html;
  }
  function openLugar(id, onSaved) {
    const l = id ? T.lugares[id] : null;
    const m = openModal(`<h3>${l ? 'Editar lugar' : 'Nuevo lugar de encuentro'}</h3>
      <div class="tf"><label>Tipo</label><div class="topts" id="lT">${Object.keys(TIPOS_L).map(k => `<button type="button" data-k="${k}" class="${(l ? l.tipo : 'casa') === k ? 'on' : ''}">${TIPOS_L[k]} ${esc(TIPOS_L_TX[k])}</button>`).join('')}</div></div>
      <div class="tf"><label for="lN">Nombre</label><input id="lN" value="${esc(l ? l.nombre : '')}" placeholder="Ej: Casa de la familia Gómez"></div>
      <div class="tf"><label for="lD">Dirección</label><input id="lD" value="${esc(l ? l.direccion || '' : '')}" placeholder="Ej: Belgrano 450"><small class="hint">Con la dirección, los hermanos tienen "Cómo llegar".</small></div>
      <div class="tf"><label for="lX">Notas</label><input id="lX" value="${esc(l ? l.notas || '' : '')}" placeholder="Ej: tocar timbre 2"></div>
      <div class="tfoot">${l ? '<button type="button" class="btn btn-danger" id="lDel">Borrar</button>' : ''}${l && l.direccion ? `<a class="btn" href="${esc(mapsUrl(l))}" target="_blank" rel="noopener">🧭 Ver en el mapa</a>` : ''}<button type="button" class="btn" data-tclose>Cancelar</button><button type="button" class="btn btn-primary" id="lOk">Guardar</button></div>`);
    let tipo = l ? l.tipo : 'casa';
    m.q('#lT').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; tipo = b.dataset.k; m.qa('#lT button').forEach(x => x.classList.toggle('on', x === b)); if (tipo === 'salon' && !m.q('#lN').value) m.q('#lN').value = 'Salón del Reino'; });
    if (m.q('#lDel')) m.q('#lDel').addEventListener('click', async () => {
      const inUse = Object.keys(T.salidas).some(g => Object.values((T.salidas[g] || {}).plantilla || {}).some(s => s.lugar === id));
      if (inUse) { showToast('Hay salidas que usan este lugar: cambiales el lugar primero'); return; }
      if (!confirm(`¿Borrar ${l.nombre}?`)) return;
      if (await safe(() => tWrite(tRef('lugares'), [[['lista', id], undefined]]), 'Lugar borrado')) m.close();
    });
    m.q('#lOk').addEventListener('click', async () => {
      const nombre = m.q('#lN').value.trim();
      if (!nombre) { showToast('Poné el nombre del lugar'); return; }
      const lid = l ? l.id : newId();
      const nl = { id: lid, tipo, nombre, direccion: m.q('#lD').value.trim(), notas: m.q('#lX').value.trim() };
      if (await safe(() => tWrite(tRef('lugares'), [[['lista', lid], nl]]), l ? 'Lugar guardado' : 'Lugar agregado')) { m.close(); if (onSaved) onSaved(lid); }
    });
  }

  /* =====================================================================
     Pantalla principal de la pestaña
     ===================================================================== */
  function render() {
    const root = $('terrRoot'); if (!root) return;
    if (!fbDb || !accessCode || !currentUser) { root.innerHTML = '<div class="tempty">Territorios y salidas se guardan en la nube: conectá la app con el código de la congregación e iniciá sesión.</div>'; return; }
    start(); ensureTerritorios();
    const a = access();
    const views = a.all ? [['salidas', 'Salidas'], ['territorios', 'Territorios'], ['grupos', 'Grupos'], ['lugares', 'Lugares']] : [['salidas', 'Salidas'], ['lugares', 'Lugares']];
    if (!views.some(v => v[0] === T.view)) T.view = 'salidas';
    const seg = `<div class="tseg" role="tablist">${views.map(([k, l]) => `<button type="button" role="tab" class="${k === T.view ? 'on' : ''}" aria-selected="${k === T.view}" data-t="view" data-k="${k}">${l}</button>`).join('')}</div>`;
    root.innerHTML = seg + '<div id="terrView"></div>';
    const v = $('terrView');
    const loading = !T.loaded.grupos || !T.loaded.salidas || !T.loaded.lugares || (T.view === 'territorios' && !T.loaded.territorios);
    if (loading) { v.innerHTML = '<div class="tempty">Cargando…</div>'; return; }
    if (!a.all && !a.groups.length) { v.innerHTML = '<div class="tempty">No tenés grupos a cargo.</div>'; return; }
    if (T.view === 'salidas') renderSalidas(v);
    else if (T.view === 'territorios') renderTerritorios(v);
    else if (T.view === 'grupos') renderGrupos(v);
    else renderLugares(v);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('#terrRoot [data-t]');
    if (!b) return;
    const k = b.dataset.t;
    if (k === 'view') { T.view = b.dataset.k; render(); }
    else if (k === 'wk') { const d = parseInt(b.dataset.d, 10); T.week = d === 0 ? mondayLocal(hoy()) : addDays(T.week, d); render(); }
    else if (k === 's-filter') { T.sFilter = b.dataset.k; render(); }
    else if (k === 's-new') openSalida(null, null);
    else if (k === 's-edit') openSalida(b.dataset.g, b.dataset.id);
    else if (k === 's-auto') autoAssignConductors();
    else if (k === 's-share') shareSalidas();
    else if (k === 't-filter') { T.tFilter = T.tFilter === b.dataset.k && b.classList.contains('tkpi') ? 'todos' : b.dataset.k; render(); }
    else if (k === 't-new') openTerritorioForm(null);
    else if (k === 't-open') openTerritorio(b.dataset.id);
    else if (k === 'g-new') openGrupo(null);
    else if (k === 'g-edit') openGrupo(b.dataset.id);
    else if (k === 'g-cong') openPubsPicker('Pueden conducir las salidas de congregación', T.gruposMeta.conductoresCongregacion || [], (ids) => { safe(() => tWrite(tRef('grupos'), [[['conductoresCongregacion'], ids]]), 'Guardado'); });
    else if (k === 'l-new') openLugar(null);
    else if (k === 'l-edit') openLugar(b.dataset.id);
  });

  // Por si el rol ya se conocía cuando se cargó este archivo.
  if (typeof currentUserRole !== 'undefined' && typeof applyRoleUI === 'function' && currentUser) { try { window.terrOnRole(); } catch (e) { /* nada */ } }
})();
