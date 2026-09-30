/* =====================================================================
   Salón — calendario de trabajos de mantenimiento y limpieza por grupos
   ---------------------------------------------------------------------
   Módulo de la app de asignaciones (asignaciones-salon.html). Usa las
   globales de la app (data, fbDb, accessCode, currentUser, currentUserRole,
   $, escapeHtml, showToast, switchTab, accNorm...), la lógica de
   salon-core.js (window.SalonCore) y algunos estilos de territorios.js
   (.tseg, .trow, .tf, .topts, .tfoot, .tchk, .tempty, .tnote, .tmodal).

   No usa las fichas de mantenimiento ni se conecta con Salón al Día:
   acá solo se programa qué trabajo se hace, cuándo, quién es el
   responsable y el auxiliar, y se juntan los voluntarios.

   Quién lo maneja: Super Admin y "Admin — Salón".
   Los grupos salen de Territorios (congregations/{código}/terr/grupos).
   ===================================================================== */
(function () {
  'use strict';
  const C = window.SalonCore;
  if (!C) { console.warn('salon: falta salon-core.js'); return; }

  const S = {
    trabajos: {}, limpieza: {}, grupos: {}, anotados: {}, externos: {},
    loaded: { trabajos: false, limpieza: false, grupos: false, anotados: false },
    unsub: [], code: null, started: false,
    view: 'cal', month: null, day: null
  };
  window.__salon = S;   // para las pruebas

  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const DIAS3 = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const LIMPIEZA_COLOR = '#2563EB', OTRA_COLOR = '#94A3B8';
  const TAREAS_DEF = ['Barrer y trapear el salón', 'Baños: limpiar y reponer papel y jabón', 'Vaciar los cestos', 'Limpiar la plataforma y el atril', 'Repasar sillas y picaportes'];

  const css = `
  #salonRoot { padding-bottom: 20px; }
  .sl-hero { background: var(--top, linear-gradient(135deg,#0F1B2D,#1E3A8A)); color: #fff; border-radius: 16px; padding: 14px 15px; margin-bottom: 12px; }
  .sl-hero small { display: block; font-size: 10.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; opacity: .75; }
  .sl-hero b { display: block; font-size: 16px; margin: 3px 0 2px; }
  .sl-hero p { margin: 0; font-size: 12.5px; opacity: .88; line-height: 1.45; }
  .sl-hero .sl-hl { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.18); font-size: 12.5px; }
  .sl-mnav { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
  .sl-mnav button { border: 1px solid var(--line); background: var(--surface); border-radius: 8px; width: 36px; height: 34px; font-size: 16px; color: var(--ink); cursor: pointer; }
  .sl-mnav .lbl { flex: 1; text-align: center; font-weight: 700; font-size: 15px; text-transform: capitalize; }
  .sl-cal { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 8px; }
  .sl-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
  .sl-grid .h { text-align: center; font-size: 10.5px; font-weight: 700; color: var(--ink-soft); padding: 3px 0; }
  .sl-d { border: none; background: none; border-radius: 9px; min-height: 44px; padding: 4px 0 3px; font: inherit; font-size: 13px; color: var(--ink); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; position: relative; }
  .sl-d.out { color: var(--ink-faint, #b3b3b3); }
  .sl-d.hoy b { background: var(--accent-blue); color: #fff; border-radius: 50%; width: 24px; height: 24px; display: grid; place-items: center; }
  .sl-d.sel { background: color-mix(in srgb, var(--accent-blue) 13%, transparent); }
  .sl-d b { font-weight: 600; width: 24px; height: 24px; display: grid; place-items: center; }
  .sl-dots { display: flex; gap: 2px; height: 6px; }
  .sl-dots i { width: 6px; height: 6px; border-radius: 50%; display: block; }
  .sl-d .lb { position: absolute; left: 4px; right: 4px; bottom: 1px; height: 3px; border-radius: 2px; }
  .sl-leg { display: flex; flex-wrap: wrap; gap: 5px 10px; font-size: 11.5px; color: var(--ink-soft); margin: 8px 2px 2px; }
  .sl-leg i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 4px; vertical-align: 0; }
  .sl-leg i.bar { border-radius: 2px; height: 4px; width: 12px; vertical-align: 2px; }
  .sl-sec { display: flex; justify-content: space-between; align-items: center; margin: 14px 2px 8px; }
  .sl-sec h4 { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-soft); }
  .sl-ev { display: flex; gap: 10px; align-items: center; width: 100%; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 9px 11px; margin-bottom: 7px; font: inherit; color: var(--ink); text-align: left; cursor: pointer; box-sizing: border-box; }
  .sl-ev.off { opacity: .55; } .sl-ev.off b { text-decoration: line-through; }
  .sl-ev .dt { width: 40px; text-align: center; flex-shrink: 0; font-size: 10.5px; font-weight: 700; color: var(--ink-soft); line-height: 1.15; }
  .sl-ev .dt b { display: block; font-size: 17px; color: var(--ink); text-decoration: none; }
  .sl-ev .bar { width: 4px; align-self: stretch; border-radius: 3px; flex-shrink: 0; }
  .sl-ev .tx { flex: 1; min-width: 0; }
  .sl-ev .tx b { display: block; font-size: 14px; }
  .sl-ev .tx small { display: block; font-size: 12px; color: var(--ink-soft); line-height: 1.4; }
  .sl-pill { font-size: 10.5px; font-weight: 700; border-radius: 9px; padding: 3px 8px; white-space: nowrap; flex-shrink: 0; }
  .sl-pill.falta { background: #FEF3C7; color: #92400E; } .sl-pill.ok { background: #DCFCE7; color: #166534; }
  .sl-pill.curso { background: #DBEAFE; color: #1D4ED8; } .sl-pill.no { background: var(--bg); color: var(--ink-soft); }
  html.dk .sl-pill.falta { background: rgba(251,191,36,.18); color: #FCD34D; } html.dk .sl-pill.ok { background: rgba(34,197,94,.18); color: #86EFAC; } html.dk .sl-pill.curso { background: rgba(59,130,246,.2); color: #93C5FD; }
  .sl-fab { width: 100%; margin-top: 4px; }
  .sl-types { display: flex; gap: 6px; flex-wrap: wrap; }
  .sl-types button { border: 1px solid var(--line); background: var(--surface); border-radius: 16px; padding: 6px 11px; font: inherit; font-size: 13px; font-weight: 600; color: var(--ink); cursor: pointer; }
  .sl-types button.on { color: #fff; border-color: transparent; }
  .sl-req { color: #DC2626; }
  .sl-err { color: #DC2626; font-size: 12.5px; margin: -4px 0 10px; min-height: 0; }
  .sl-toggle { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; font-size: 13.5px; cursor: pointer; }
  .sl-toggle input { width: 20px; height: 20px; }
  .sl-dhero { border-radius: 14px; padding: 13px 14px; color: #fff; margin-bottom: 12px; }
  .sl-dhero small { font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; opacity: .85; }
  .sl-dhero b { display: block; font-size: 18px; margin: 3px 0; }
  .sl-dhero p { margin: 0; font-size: 12.5px; opacity: .92; }
  .sl-steps { display: flex; gap: 4px; margin-bottom: 12px; }
  .sl-steps button { flex: 1; border: 1px solid var(--line); background: var(--surface); border-radius: 9px; padding: 8px 2px; font: inherit; font-size: 12.5px; font-weight: 700; color: var(--ink-soft); cursor: pointer; }
  .sl-steps button.on { background: var(--accent-blue); color: #fff; border-color: var(--accent-blue); }
  .sl-steps button.on.hecho { background: #16A34A; border-color: #16A34A; }
  .sl-box { border: 1px solid var(--line); border-radius: 12px; padding: 4px 12px; margin-bottom: 12px; }
  .sl-row { display: flex; align-items: center; gap: 9px; padding: 8px 0; border-top: 1px solid var(--line); font-size: 13.5px; }
  .sl-row:first-child { border-top: none; }
  .sl-row .nm { flex: 1; min-width: 0; }
  .sl-row .nm small { display: block; color: var(--ink-soft); font-size: 12px; }
  .sl-row .x { border: none; background: none; color: var(--ink-soft); font: inherit; font-size: 12.5px; cursor: pointer; padding: 4px; }
  .sl-av { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 800; color: #fff; flex-shrink: 0; background: var(--accent-blue); }
  .sl-av.e { background: none; border: 1.5px dashed var(--line); color: var(--ink-soft); }
  .sl-kv { display: flex; gap: 8px; }
  .sl-kv > div { flex: 1; border: 1px solid var(--line); border-radius: 12px; padding: 9px 11px; }
  .sl-kv small { display: block; font-size: 10.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-soft); }
  .sl-kv b { font-size: 14px; }
  .sl-rot { display: flex; align-items: center; gap: 9px; padding: 8px 0; border-top: 1px solid var(--line); font-size: 14px; }
  .sl-rot:first-child { border-top: none; }
  .sl-rot .nn { width: 26px; height: 26px; border-radius: 8px; background: var(--bg); display: grid; place-items: center; font-weight: 800; font-size: 12.5px; flex-shrink: 0; }
  .sl-rot .nm { flex: 1; } .sl-rot .nm small { display: block; font-size: 12px; color: var(--ink-soft); }
  .sl-rot button { border: 1px solid var(--line); background: var(--surface); border-radius: 8px; width: 32px; height: 30px; font-size: 14px; color: var(--ink); cursor: pointer; }
  .sl-rot button:disabled { opacity: .35; cursor: default; }
  .sl-weeks { display: flex; gap: 6px; flex-wrap: wrap; }
  .sl-weeks label { display: flex; align-items: center; gap: 6px; border: 1px solid var(--line); border-radius: 9px; padding: 6px 10px; font-size: 13px; cursor: pointer; }
  .sl-prev div { display: flex; gap: 10px; padding: 7px 0; border-top: 1px solid var(--line); font-size: 13px; }
  .sl-prev div:first-child { border-top: none; }
  .sl-prev span { width: 64px; white-space: nowrap; flex-shrink: 0; font-weight: 700; color: var(--ink-soft); }
  .sl-prev em { font-style: normal; color: var(--ink-soft); }
  .sl-oc { font-size: 10px; font-weight: 800; border-radius: 7px; padding: 2px 6px; background: #FEF3C7; color: #92400E; white-space: nowrap; vertical-align: 1px; }
  html.dk .sl-oc { background: rgba(251,191,36,.18); color: #FCD34D; }
  .sl-wa { border: none; border-radius: 8px; padding: 5px 9px; font: inherit; font-size: 12px; font-weight: 800; background: #DCFCE7; color: #15803D; cursor: pointer; white-space: nowrap; text-decoration: none; }
  .sl-seg { display: flex; background: var(--bg); border-radius: 10px; padding: 3px; margin-bottom: 10px; gap: 2px; }
  .sl-seg button { flex: 1; border: none; background: none; border-radius: 8px; padding: 7px 4px; font: inherit; font-size: 13px; font-weight: 700; color: var(--ink-soft); cursor: pointer; }
  .sl-seg button.on { background: var(--surface); color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- Utilidades ---------- */
  const esc = (s) => escapeHtml(s == null ? '' : String(s));
  const hoy = () => todayIsoLocal();
  const pubs = () => (data.publishers || []).filter(p => p.status !== 'inactivo');
  // Los hermanos de otra congregación van con id "x:<id>"; en cada trabajo queda copia de su nombre y congregación (sin el teléfono).
  const isExt = (id) => typeof id === 'string' && id.startsWith('x:');
  const extOf = (id, t) => isExt(id) ? (S.externos[id.slice(2)] || (t && t.externos && t.externos[id]) || null) : null;
  const pubName = (id, t) => { if (isExt(id)) { const x = extOf(id, t); return x ? x.nombre : 'Hermano de otra congregación'; } const p = (data.publishers || []).find(x => x.id === id); return p ? p.name : ''; };
  const congTag = (id, t) => { const x = extOf(id, t); return isExt(id) ? ` <span class="sl-oc">${x && x.cong ? 'Cong. ' + esc(x.cong) : 'Otra cong.'}</span>` : ''; };
  // Nombre de la otra congregación del Salón compartido (se carga una vez en Limpieza).
  const otraNombre = () => ((S.limpieza && S.limpieza.otraNombre) || '').trim();
  const otraLabel = () => otraNombre() || 'Otra congregación';
  const extList = () => Object.values(S.externos).filter(x => x && x.id).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
  // Copia de nombre y congregación de los de afuera que usa un trabajo (la vista no ve la lista con teléfonos).
  function extRefs(t) {
    const ids = new Set([t.resp, t.aux].filter(isExt));
    Object.values(t.ocurr || {}).forEach(o => (o && o.vols || []).filter(isExt).forEach(i => ids.add(i)));
    const out = {};
    ids.forEach(i => { const x = extOf(i, t); if (x) out[i] = { nombre: x.nombre || '', cong: x.cong || '' }; });
    return out;
  }
  function waLink(tel, text) {
    let d = String(tel || '').replace(/\D/g, '');
    if (!d) return '';
    if (!d.startsWith('54')) d = '549' + d.replace(/^0/, '');
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent(text);
  }
  const apellido = (id, fallback, t) => { const n = pubName(id, t) || fallback || ''; const parts = n.trim().split(/\s+/); return parts.length > 1 ? parts[parts.length - 1] : n; };
  const inic = (n) => String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const grupoName = (gid) => (S.grupos[gid] && S.grupos[gid].nombre) || 'Grupo';
  const tipoOf = (t) => C.TIPOS[t.tipo] || C.TIPOS.otro;
  const newId = () => (typeof uid === 'function' ? uid() : Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
  function fmtDia(iso) { const d = new Date(iso + 'T12:00:00'); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; }
  function fmtCorto(iso) { const d = new Date(iso + 'T12:00:00'); return `${DIAS3[d.getDay()].toLowerCase()} ${d.getDate()}`; }
  const COLORS = ['#2563EB', '#059669', '#9333EA', '#DB2777', '#EA580C', '#0891B2'];
  const colorOf = (s) => COLORS[[...String(s || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

  /* ---------- Firestore ---------- */
  function congRef() { return fbDb.collection('congregations').doc(accessCode); }
  function sRef(doc) { return congRef().collection('salon').doc(doc); }
  async function sWrite(ref, pairs) {
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
      if (typeof logCloudError === 'function') logCloudError('salon', `${(e && e.code) || ''} ${(e && e.message) || e}`.trim(), '');
      return false;
    }
  }
  function stop() { S.unsub.forEach(u => { try { u(); } catch (e) { /* nada */ } }); S.unsub = []; S.started = false; }
  function start() {
    if (!fbDb || !accessCode || !currentUser || !access()) return false;
    if (S.started && S.code === accessCode) return true;
    stop();
    S.code = accessCode; S.started = true;
    S.loaded = { trabajos: false, limpieza: false, grupos: false, anotados: false, externos: false };
    const onErr = (k) => (err) => { S.loaded[k] = true; console.warn('salon', k, err && err.code); onData(); };
    S.unsub.push(sRef('trabajos').onSnapshot((s) => { S.trabajos = ((s.exists && s.data()) || {}).lista || {}; S.loaded.trabajos = true; onData(); }, onErr('trabajos')));
    // Hermanos de otra congregación (salón compartido): nombre, congregación y teléfono. Solo los ven los que manejan el Salón.
    S.unsub.push(sRef('externos').onSnapshot((s) => { S.externos = ((s.exists && s.data()) || {}).lista || {}; S.loaded.externos = true; onData(); }, onErr('externos')));
    S.unsub.push(sRef('limpieza').onSnapshot((s) => { S.limpieza = (s.exists && s.data()) || {}; S.loaded.limpieza = true; onData(); }, onErr('limpieza')));
    S.unsub.push(congRef().collection('terr').doc('grupos').onSnapshot((s) => { S.grupos = ((s.exists && s.data()) || {}).lista || {}; S.loaded.grupos = true; onData(); }, onErr('grupos')));
    S.unsub.push(congRef().collection('salonAnotados').onSnapshot((qs) => { const o = {}; qs.forEach(d => { o[d.id] = d.data() || {}; }); S.anotados = o; S.loaded.anotados = true; onData(); }, onErr('anotados')));
    return true;
  }
  let queued = false;
  function onData() {
    if (queued) return; queued = true;
    setTimeout(() => { queued = false; if (isVisible()) render(); if (openDetail) openDetail.refresh(); }, 0);
  }
  function isVisible() { const p = $('panel-salon'); return p && !p.classList.contains('hidden'); }

  /* ---------- Permisos y pestaña ---------- */
  function access() {
    if (!currentUser) return true;
    const s = (data && data.settings) || {}, e = currentUser.email;
    return currentUserRole === 'super' || currentUserRole === 'salon' || (s.editorEmails || []).includes(e) || (s.salonAdminEmails || []).includes(e);
  }
  function updateTabVisibility() {
    const show = access() && currentUserRole !== 'anuncios' && currentUserRole !== 'territorios' && currentUserRole !== 'grupo';
    document.querySelectorAll('.tab-btn[data-tab="salon"]').forEach(b => b.classList.toggle('hidden', !show));
  }
  function applySalonOnly() {
    document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.toggle('hidden', b.dataset.tab !== 'salon'));
    ['navAnunciosBtn', 'navAnunciosBtnMobile'].forEach(id => { const el = $(id); if (el && !(typeof canManageAnuncios === 'function' && canManageAnuncios())) el.classList.add('hidden'); });
    const tb = $('narrowThemeBtn'); if (tb) tb.classList.remove('hidden');
    const bb = $('backupBanner'); if (bb) bb.remove();
    const active = document.querySelector('.tab-btn.active');
    if (!active || active.dataset.tab !== 'salon') switchTab('salon');
  }
  window.salonOnRole = function () {
    if (currentUser && accessCode && fbDb) start();
    updateTabVisibility();
    if (currentUserRole === 'salon') applySalonOnly();
    if (isVisible()) render();
  };
  window.salonRender = function () { start(); render(); };

  /* ---------- Modal ---------- */
  function openModal(html, opts) {
    const ov = document.createElement('div');
    ov.className = 'modal-overlay tmodal slmodal' + (opts && opts.cls ? ' ' + opts.cls : '');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="modal">${html}</div>`;
    document.body.appendChild(ov);
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); if (opts && opts.onClose) opts.onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    ov.addEventListener('click', (e) => { if (e.target.closest('[data-tclose]')) close(); });
    return { el: ov, q: (s) => ov.querySelector(s), qa: (s) => ov.querySelectorAll(s), close, set: (h) => { ov.querySelector('.modal').innerHTML = h; } };
  }

  /* =====================================================================
     CALENDARIO
     ===================================================================== */
  function evRow(o) {
    const t = o.t, tp = tipoOf(t), d = new Date(o.fecha + 'T12:00:00');
    const ci = C.cupoInfo(t, o.fecha, S.anotados);
    let pill = '';
    if (o.cancelada) pill = '<span class="sl-pill no">Suspendido</span>';
    else if (o.estado === 'hecho') pill = '<span class="sl-pill ok">Hecho</span>';
    else if (o.estado === 'curso') pill = '<span class="sl-pill curso">En curso</span>';
    else if (ci.cupo && ci.faltan) pill = `<span class="sl-pill falta">Faltan ${ci.faltan}</span>`;
    else if (ci.cupo) pill = '<span class="sl-pill ok">Completo</span>';
    const quien = [t.resp && apellido(t.resp, '', t), t.aux && apellido(t.aux, '', t)].filter(Boolean).join(' y ');
    return `<button type="button" class="sl-ev${o.cancelada ? ' off' : ''}" data-s="open" data-id="${esc(t.id)}" data-f="${o.fecha}">
      <span class="dt">${DIAS3[d.getDay()]}<b>${d.getDate()}</b></span><span class="bar" style="background:${tp.color}"></span>
      <span class="tx"><b>${tp.icon} ${esc(t.titulo)}</b><small>${esc(t.hora || '')}${t.hora ? ' · ' : ''}${esc(quien || 'Sin responsable')}${ci.cupo ? ` · ${ci.van} de ${ci.cupo} voluntarios` : ''}${t.repite && t.repite !== 'no' ? ` · 🔁 ${esc(C.REPITE[t.repite].toLowerCase())}` : ''}</small></span>${pill}</button>`;
  }
  function limpiezaDe(monday) {
    const tu = C.turnoLimpieza(S.limpieza, monday);
    if (!tu) return null;
    return { tu, dias: C.diasLimpieza(S.limpieza, monday, data.settings), nombre: tu.otra ? otraLabel() : grupoName(tu.gid) };
  }
  function renderCal(v) {
    const today = hoy();
    if (!S.month) S.month = today.slice(0, 7);
    const mon = C.mondayOf(today);
    const semana = C.trabajosEntre(S.trabajos, mon, C.addDays(mon, 6)).filter(o => !o.cancelada);
    const lz = limpiezaDe(mon);
    let html = '';
    // Esta semana
    const first = semana.find(o => o.estado !== 'hecho');
    if (first || lz) {
      const t = first && first.t;
      const ci = first ? C.cupoInfo(t, first.fecha, S.anotados) : null;
      html += `<div class="sl-hero"><small>Esta semana</small>${first ? `<b>${tipoOf(t).icon} ${esc(t.titulo)}</b><p>${esc(fmtCorto(first.fecha))}${t.hora ? ' · ' + esc(t.hora) : ''} · Resp. ${esc(apellido(t.resp, '', t) || '—')}, aux. ${esc(apellido(t.aux, '', t) || '—')}${ci.cupo ? (ci.faltan ? ` · faltan ${ci.faltan} voluntarios` : ' · completo') : ''}</p>${semana.length > 1 ? `<p>y ${semana.length - 1} ${semana.length === 2 ? 'trabajo más' : 'trabajos más'}</p>` : ''}` : '<b>Sin trabajos programados</b>'}
        ${lz ? `<div class="sl-hl">🧹 Limpieza: <b style="display:inline;font-size:inherit;">${esc(lz.nombre)}</b> · ${lz.dias.map(fmtCorto).join(' y ')}</div>` : ''}</div>`;
    }
    // Mes
    const [y, m] = S.month.split('-').map(Number);
    const firstDay = `${S.month}-01`;
    const gridStart = C.mondayOf(firstDay);
    const lastDay = C.isoOf(new Date(y, m, 0, 12));
    const gridEnd = C.addDays(C.mondayOf(lastDay), 6);
    const occ = C.trabajosEntre(S.trabajos, gridStart, gridEnd).filter(o => !o.cancelada);
    const limpiezaDias = {};
    for (let w = gridStart; w <= gridEnd; w = C.addDays(w, 7)) { const l = limpiezaDe(w); if (l) l.dias.forEach(f => { limpiezaDias[f] = l.tu.otra ? OTRA_COLOR : LIMPIEZA_COLOR; }); }
    html += `<div class="sl-mnav"><button type="button" data-s="mes" data-d="-1" aria-label="Mes anterior">‹</button><span class="lbl">${MESES[m - 1]} ${y}</span><button type="button" data-s="mes" data-d="1" aria-label="Mes siguiente">›</button></div>`;
    html += '<div class="sl-cal"><div class="sl-grid">' + ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<span class="h">${x}</span>`).join('');
    for (let f = gridStart; f <= gridEnd; f = C.addDays(f, 1)) {
      const dots = occ.filter(o => o.fecha === f).slice(0, 3).map(o => `<i style="background:${tipoOf(o.t).color}"></i>`).join('');
      html += `<button type="button" class="sl-d${f.slice(0, 7) !== S.month ? ' out' : ''}${f === today ? ' hoy' : ''}${f === S.day ? ' sel' : ''}" data-s="day" data-f="${f}"><b>${Number(f.slice(8))}</b><span class="sl-dots">${dots}</span>${limpiezaDias[f] ? `<span class="lb" style="background:${limpiezaDias[f]}"></span>` : ''}</button>`;
    }
    html += '</div><div class="sl-leg">' + Object.values(C.TIPOS).map(tp => `<span><i style="background:${tp.color}"></i>${tp.label}</span>`).join('') + `<span><i class="bar" style="background:${LIMPIEZA_COLOR}"></i>Limpieza</span>${(S.limpieza.otra || []).length ? `<span><i class="bar" style="background:${OTRA_COLOR}"></i>${esc(otraLabel())}</span>` : ''}</div></div>`;
    // Día elegido o próximos
    if (S.day) {
      const del = C.trabajosEntre(S.trabajos, S.day, S.day);
      const l = limpiezaDe(C.mondayOf(S.day));
      const lz2 = l && l.dias.includes(S.day) ? `<div class="tnote">🧹 Limpieza: <b>${esc(l.nombre)}</b></div>` : '';
      html += `<div class="sl-sec"><h4>${esc(fmtDia(S.day))}</h4><button type="button" class="btn" data-s="new" data-f="${S.day}">+ Trabajo este día</button></div>${lz2}` + (del.length ? del.map(evRow).join('') : (lz2 ? '' : '<div class="tempty" style="padding:10px;">Nada programado este día.</div>'));
    }
    // Próximos: la siguiente vez de cada trabajo (los que se repiten no llenan la lista).
    const vistos = new Set();
    const prox = C.trabajosEntre(S.trabajos, today, C.addDays(today, 120)).filter(o => !o.cancelada && o.estado !== 'hecho' && !vistos.has(o.t.id) && vistos.add(o.t.id)).slice(0, 8);
    html += `<div class="sl-sec"><h4>Próximos trabajos</h4><button type="button" class="btn btn-primary" data-s="new">+ Trabajo</button></div>`;
    html += prox.length ? prox.map(evRow).join('') : '<div class="tempty">Todavía no hay trabajos programados.<br>Con "+ Trabajo" cargás qué hay que hacer, el día, el responsable y el auxiliar. Si se repite (el corte de pasto, por ejemplo), aparece solo en el calendario.</div>';
    v.innerHTML = html;
  }

  /* =====================================================================
     TRABAJOS (lista de todos, con los que se repiten)
     ===================================================================== */
  function renderTrabajos(v) {
    const today = hoy();
    const ts = Object.values(S.trabajos).filter(t => t && t.id);
    const next = (t) => C.fechasDe(t, today, C.addDays(today, 400)).find(f => { const o = (t.ocurr || {})[f] || {}; return !o.cancelada && o.estado !== 'hecho'; });
    const activos = ts.filter(t => next(t)).sort((a, b) => next(a).localeCompare(next(b)));
    const hechos = C.trabajosEntre(S.trabajos, C.addDays(today, -120), today).filter(o => o.estado === 'hecho').reverse().slice(0, 10);
    const pasados = ts.filter(t => !next(t));
    let html = `<div class="thead"><h3>Trabajos</h3><button type="button" class="btn btn-primary" data-s="new">+ Trabajo</button></div>`;
    if (!ts.length) html += '<div class="tempty">Todavía no hay trabajos.</div>';
    html += activos.map(t => {
      const f = next(t), tp = tipoOf(t);
      return `<button type="button" class="sl-ev" data-s="open" data-id="${esc(t.id)}" data-f="${f}"><span class="bar" style="background:${tp.color}"></span>
        <span class="tx"><b>${tp.icon} ${esc(t.titulo)}</b><small>Próximo: ${esc(fmtCorto(f))}${t.hora ? ' · ' + esc(t.hora) : ''} · ${esc(C.REPITE[t.repite || 'no'])}</small><small>Resp. ${esc(pubName(t.resp, t) || '—')} · Aux. ${esc(pubName(t.aux, t) || '—')}</small></span></button>`;
    }).join('');
    if (hechos.length) html += '<div class="sl-sec"><h4>Hechos hace poco</h4></div>' + hechos.map(evRow).join('');
    if (pasados.length) html += '<div class="sl-sec"><h4>Terminados</h4></div>' + pasados.map(t => `<button type="button" class="sl-ev off" data-s="edit" data-id="${esc(t.id)}"><span class="bar" style="background:${tipoOf(t).color}"></span><span class="tx"><b>${tipoOf(t).icon} ${esc(t.titulo)}</b><small>${esc(fmtCorto(t.fecha))}</small></span></button>`).join('');
    v.innerHTML = html;
  }

  /* ---------- Formulario de trabajo ---------- */
  function pubOptions(sel) {
    const cong = (data.settings && data.settings.congregationName) || 'Congregación';
    const ext = extList();
    return '<option value="">Elegí…</option>' +
      `<optgroup label="${esc(cong)}">` + pubs().slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map(p => `<option value="${esc(p.id)}"${p.id === sel ? ' selected' : ''}>${esc(p.name)}</option>`).join('') + '</optgroup>' +
      `<optgroup label="${esc(otraLabel())}">` + ext.map(x => `<option value="x:${esc(x.id)}"${'x:' + x.id === sel ? ' selected' : ''}>${esc(x.nombre)}${x.cong ? ' · Cong. ' + esc(x.cong) : ''}</option>`).join('') +
      `<option value="__new">＋ Agregar hermano de ${esc(otraNombre() || 'otra congregación')}…</option></optgroup>`;
  }
  function openForm(id, fechaDefault) {
    const t = id ? S.trabajos[id] : null;
    const f = t ? Object.assign({}, t) : { tipo: 'pintura', fecha: fechaDefault || C.addDays(hoy(), 7), hora: '09:00', cupo: 0, repite: 'no', materiales: [], vista: true };
    const m = openModal(`<h3>${t ? 'Editar trabajo' : 'Nuevo trabajo'}</h3>
      <div class="tf"><label for="slTit">Qué hay que hacer</label><input id="slTit" maxlength="80" placeholder="Ej.: Pintura de la entrada" value="${esc(f.titulo || '')}"></div>
      <div class="tf"><span class="tlbl">Tipo</span><div class="sl-types" id="slTipo">${Object.entries(C.TIPOS).map(([k, tp]) => `<button type="button" data-k="${k}" class="${f.tipo === k ? 'on' : ''}" style="${f.tipo === k ? 'background:' + tp.color : ''}">${tp.icon} ${tp.label}</button>`).join('')}</div></div>
      <div class="trow2"><div class="tf"><label for="slFec">Día</label><input type="date" id="slFec" value="${esc(f.fecha)}"></div><div class="tf"><label for="slHora">Hora</label><input type="time" id="slHora" value="${esc(f.hora || '')}"></div></div>
      <div class="trow2"><div class="tf"><label for="slResp">Responsable <span class="sl-req">*</span></label><select id="slResp">${pubOptions(f.resp)}</select></div><div class="tf"><label for="slAux">Auxiliar <span class="sl-req">*</span></label><select id="slAux">${pubOptions(f.aux)}</select></div></div>
      <div class="trow2"><div class="tf"><label for="slCupo">Voluntarios además</label><input type="number" id="slCupo" min="0" max="30" value="${Number(f.cupo) || 0}"></div><div class="tf"></div></div>
      <div class="tf"><span class="tlbl">Se repite</span><div class="topts" id="slRep">${Object.entries(C.REPITE).map(([k, l]) => `<button type="button" data-k="${k}" class="${(f.repite || 'no') === k ? 'on' : ''}">${k === 'no' ? 'No' : l}</button>`).join('')}</div></div>
      <div class="tf"><label for="slMat">Qué llevar / materiales <small style="text-transform:none;letter-spacing:0;font-weight:400;">(uno por renglón)</small></label><textarea id="slMat" placeholder="Rodillos y pinceles&#10;2 latas de látex blanco">${esc((f.materiales || []).join('\n'))}</textarea></div>
      <div class="tf"><label for="slNotas">Notas</label><textarea id="slNotas" style="min-height:44px;" placeholder="Opcional">${esc(f.notas || '')}</textarea></div>
      <label class="sl-toggle"><span>Mostrarlo en la vista y pedir voluntarios</span><input type="checkbox" id="slVista"${f.vista !== false ? ' checked' : ''}></label>
      <div class="sl-err" id="slErr"></div>
      <div class="tfoot">${t ? '<button type="button" class="btn btn-danger" id="slDel">Borrar</button>' : ''}<button type="button" class="btn" data-tclose>Cancelar</button><button type="button" class="btn btn-primary" id="slSave">Guardar trabajo</button></div>`);
    m.q('#slTipo').addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]'); if (!b) return; f.tipo = b.dataset.k;
      m.qa('#slTipo button').forEach(x => { const on = x.dataset.k === f.tipo; x.classList.toggle('on', on); x.style.background = on ? C.TIPOS[x.dataset.k].color : ''; });
    });
    m.q('#slRep').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; f.repite = b.dataset.k; m.qa('#slRep button').forEach(x => x.classList.toggle('on', x.dataset.k === f.repite)); });
    const prev = { slResp: f.resp || '', slAux: f.aux || '' };
    ['slResp', 'slAux'].forEach(sid => m.q('#' + sid).addEventListener('change', (e) => {
      const el = e.target;
      if (el.value !== '__new') { prev[sid] = el.value; return; }
      el.value = prev[sid];
      openExterno(null, (xid) => {
        ['slResp', 'slAux'].forEach(k => { const v = k === sid ? 'x:' + xid : m.q('#' + k).value; m.q('#' + k).innerHTML = pubOptions(v); m.q('#' + k).value = v; prev[k] = v; });
      });
    }));
    m.q('#slSave').addEventListener('click', async () => {
      const titulo = m.q('#slTit').value.trim(), resp = m.q('#slResp').value, aux = m.q('#slAux').value, fecha = m.q('#slFec').value;
      const err = !titulo ? 'Escribí qué hay que hacer.' : !fecha ? 'Elegí el día.' : !resp ? 'Elegí el responsable.' : !aux ? 'Elegí el auxiliar: cada trabajo lleva responsable y auxiliar.' : resp === aux ? 'El responsable y el auxiliar tienen que ser dos hermanos distintos.' : '';
      m.q('#slErr').textContent = err;
      if (err) return;
      const nt = Object.assign({}, t || {}, {
        id: (t && t.id) || newId(), titulo, tipo: f.tipo, fecha, hora: m.q('#slHora').value, resp, aux,
        cupo: Math.max(0, Math.min(30, parseInt(m.q('#slCupo').value, 10) || 0)), repite: f.repite || 'no',
        materiales: m.q('#slMat').value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 30),
        notas: m.q('#slNotas').value.trim(), vista: m.q('#slVista').checked
      });
      if (!nt.ocurr) nt.ocurr = {};
      nt.externos = extRefs(nt);
      if (!t) nt.creado = new Date().toISOString();
      if (await safe(() => sWrite(sRef('trabajos'), [[['lista', nt.id], nt]]), t ? 'Trabajo guardado' : 'Trabajo agregado')) { S.trabajos[nt.id] = nt; m.close(); render(); }
    });
    const del = m.q('#slDel');
    if (del) del.addEventListener('click', async () => {
      if (!confirm(t.repite && t.repite !== 'no' ? '¿Borrar este trabajo y todas sus fechas?' : '¿Borrar este trabajo?')) return;
      if (await safe(() => sWrite(sRef('trabajos'), [[['lista', t.id], undefined]]), 'Trabajo borrado')) { delete S.trabajos[t.id]; m.close(); if (openDetail) openDetail.close(); render(); }
    });
  }

  /* ---------- Detalle de un trabajo (esa vez) ---------- */
  let openDetail = null;
  function occPath(t, fecha, k) { return ['lista', t.id, 'ocurr', fecha, k]; }
  function detailHTML(t, fecha) {
    const tp = tipoOf(t), o = (t.ocurr || {})[fecha] || {}, estado = o.estado || 'prog';
    const ci = C.cupoInfo(t, fecha, S.anotados);
    const mats = t.materiales || [];
    const volRows = ci.vols.map(v => {
      const n = pubName(v.pubId, t) || v.nombre || 'Hermano', x = extOf(v.pubId, t);
      const tel = x && S.externos[v.pubId.slice(2)] && S.externos[v.pubId.slice(2)].tel;
      return `<div class="sl-row"><span class="sl-av" style="background:${colorOf(n)}">${esc(inic(n))}</span><span class="nm">${esc(n)}${congTag(v.pubId, t)}${v.comentario ? `<small>"${esc(v.comentario)}"</small>` : ''}${v.propio || isExt(v.pubId) ? '' : '<small>Agregado por el encargado</small>'}</span>${tel ? `<button type="button" class="sl-wa" data-d="avisar" data-p="${esc(v.pubId)}">💬 Avisar</button>` : ''}<button type="button" class="x" data-d="quitar" data-a="${esc(v.id || '')}" data-p="${esc(v.pubId || '')}">Quitar</button></div>`;
    }).join('');
    const kv = (id) => { const tel = isExt(id) && S.externos[id.slice(2)] && S.externos[id.slice(2)].tel; return `<b>${esc(pubName(id, t) || '—')}</b>${congTag(id, t)}${tel ? `<div style="margin-top:6px;"><button type="button" class="sl-wa" data-d="avisar" data-p="${esc(id)}">💬 Avisar</button></div>` : ''}`; };
    const faltan = ci.faltan;
    return `<div class="sl-dhero" style="background:${tp.color}"><small>${tp.icon} ${tp.label} · ${esc(fmtDia(fecha))}${t.hora ? ' · ' + esc(t.hora) : ''}</small><b>${esc(t.titulo)}</b><p>${esc(C.REPITE[t.repite || 'no'])}${o.cancelada ? ' · suspendido esta vez' : ''}</p></div>
      <div class="sl-steps">${Object.entries(C.ESTADOS).map(([k, l]) => `<button type="button" data-d="estado" data-k="${k}" class="${estado === k ? 'on ' + k : ''}">${l}</button>`).join('')}</div>
      <div class="sl-kv" style="margin-bottom:12px;"><div><small>Responsable</small>${kv(t.resp)}</div><div><small>Auxiliar</small>${kv(t.aux)}</div></div>
      <div class="sl-sec" style="margin-top:0;"><h4>Voluntarios</h4><span style="font-size:12.5px;font-weight:700;">${ci.cupo ? `${ci.van} de ${ci.cupo}` : ci.van}</span></div>
      <div class="sl-box">${volRows}${faltan ? `<div class="sl-row"><span class="sl-av e">+</span><span class="nm" style="color:var(--ink-soft)">${ci.faltan === 1 ? 'Falta 1' : 'Faltan ' + ci.faltan}</span></div>` : ''}${!ci.vols.length && !faltan ? '<div class="sl-row" style="color:var(--ink-soft)">Sin voluntarios pedidos.</div>' : ''}</div>
      <div class="tfoot" style="margin-top:0;margin-bottom:12px;"><button type="button" class="btn" data-d="agregar">＋ Agregar hermano</button><button type="button" class="btn btn-primary" data-d="wa">Pedir por WhatsApp</button></div>
      ${mats.length ? `<div class="sl-sec" style="margin-top:0;"><h4>Qué llevar</h4></div><div class="sl-box">${mats.map((x, i) => `<label class="tchk" style="${i === 0 ? 'border-top:none;' : ''}"><input type="checkbox" data-d="mat" data-i="${i}"${(o.mats || {})[i] ? ' checked' : ''}><span>${esc(x)}</span></label>`).join('')}</div>` : ''}
      ${t.notas ? `<div class="tnote">${esc(t.notas)}</div>` : ''}
      <div class="tf"><label for="slNota">Nota de esta vez</label><textarea id="slNota" style="min-height:44px;" placeholder="Ej.: faltó comprar lija">${esc(o.nota || '')}</textarea></div>
      <div class="tfoot">${t.repite && t.repite !== 'no' ? `<button type="button" class="btn" data-d="suspender">${o.cancelada ? 'Volver a programar' : 'Suspender esta vez'}</button>` : ''}<button type="button" class="btn" data-d="editar">Editar trabajo</button><button type="button" class="btn" data-tclose>Cerrar</button></div>`;
  }
  function openTrabajo(id, fecha) {
    const t0 = S.trabajos[id]; if (!t0) return;
    const m = openModal(detailHTML(t0, fecha), { onClose: () => { openDetail = null; }, cls: 'sl-detail' });
    const cur = () => S.trabajos[id];
    openDetail = { close: m.close, refresh: () => { const t = cur(); if (!t) { m.close(); return; } const nota = m.q('#slNota'); const keep = nota ? nota.value : null; m.set(detailHTML(t, fecha)); if (keep != null && m.q('#slNota')) m.q('#slNota').value = keep; } };
    const setOcc = (k, v) => { const t = cur(); if (!t) return; t.ocurr = t.ocurr || {}; t.ocurr[fecha] = Object.assign({}, t.ocurr[fecha] || {}); if (v === undefined) delete t.ocurr[fecha][k]; else t.ocurr[fecha][k] = v; return safe(() => sWrite(sRef('trabajos'), [[occPath(t, fecha, k), v]])); };
    m.el.addEventListener('change', (e) => {
      const c = e.target.closest('[data-d="mat"]'); if (!c) return;
      const t = cur(); const mats = Object.assign({}, ((t.ocurr || {})[fecha] || {}).mats || {});
      if (c.checked) mats[c.dataset.i] = true; else delete mats[c.dataset.i];
      setOcc('mats', mats);
    });
    m.el.addEventListener('focusout', (e) => {
      if (e.target.id !== 'slNota') return;
      const v = e.target.value.trim(), t = cur();
      if (v !== ((((t.ocurr || {})[fecha]) || {}).nota || '')) setOcc('nota', v || undefined).then(ok => { if (ok) showToast('Nota guardada'); });
    });
    m.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-d]'); if (!b || b.dataset.d === 'mat') return;
      const t = cur(); if (!t) return;
      const k = b.dataset.d;
      if (k === 'estado') { await setOcc('estado', b.dataset.k === 'prog' ? undefined : b.dataset.k); showToast(b.dataset.k === 'hecho' ? '¡Trabajo hecho!' : 'Estado: ' + C.ESTADOS[b.dataset.k]); openDetail.refresh(); render(); }
      else if (k === 'suspender') { const was = !!(((t.ocurr || {})[fecha] || {}).cancelada); await setOcc('cancelada', was ? undefined : true); showToast(was ? 'Vuelve a estar programado' : 'Suspendido esta vez'); openDetail.refresh(); render(); }
      else if (k === 'editar') { openForm(t.id); }
      else if (k === 'quitar') {
        const n = pubName(b.dataset.p, t) || 'este hermano';
        if (!confirm(`¿Quitar a ${n} de este trabajo?`)) return;
        if (b.dataset.a) { if (await safe(() => congRef().collection('salonAnotados').doc(b.dataset.a).delete(), 'Quitado')) { delete S.anotados[b.dataset.a]; openDetail.refresh(); render(); } }
        else { const vols = ((((t.ocurr || {})[fecha]) || {}).vols || []).filter(x => x !== b.dataset.p); if (await setOcc('vols', vols.length ? vols : undefined)) { showToast('Quitado'); openDetail.refresh(); render(); } }
      }
      else if (k === 'agregar') pickPub(t, fecha);
      else if (k === 'wa') shareWa(t, fecha);
      else if (k === 'avisar') avisarExterno(t, fecha, b.dataset.p);
    });
  }
  function pickPub(t, fecha) {
    const ya = new Set(C.voluntarios(t, fecha, S.anotados).map(v => v.pubId).concat([t.resp, t.aux]));
    let tab = 'cong';
    const cong = (data.settings && data.settings.congregationName) || 'Congregación';
    const m = openModal(`<h3>Agregar un hermano</h3><div class="sl-seg" id="slSeg"><button type="button" data-k="cong" class="on">${esc(cong)}</button><button type="button" data-k="otra">${esc(otraLabel())}</button></div><input type="search" class="tsearch" id="slQ" placeholder="🔍 Buscar hermano" autocomplete="off"><div class="tlist" id="slL"></div><div class="tfoot"><button type="button" class="btn" data-tclose>Cancelar</button></div>`);
    const paint = () => {
      const qn = accNorm(m.q('#slQ').value.trim());
      m.qa('#slSeg button').forEach(b => b.classList.toggle('on', b.dataset.k === tab));
      if (tab === 'cong') {
        m.q('#slL').innerHTML = pubs().filter(p => !ya.has(p.id) && (!qn || accNorm(p.name).includes(qn))).sort((a, b) => a.name.localeCompare(b.name, 'es')).map(p => `<button type="button" class="tpick" data-id="${esc(p.id)}">${esc(p.name)}</button>`).join('') || '<div class="tempty" style="padding:12px;">No hay nadie más.</div>';
      } else {
        m.q('#slL').innerHTML = extList().filter(x => !ya.has('x:' + x.id) && (!qn || accNorm(x.nombre).includes(qn))).map(x => `<button type="button" class="tpick" data-id="x:${esc(x.id)}"><span>${esc(x.nombre)}<small>${x.cong ? 'Cong. ' + esc(x.cong) : 'Otra congregación'}${x.tel ? ' · 📱 ' + esc(x.tel) : ''}</small></span></button>`).join('') +
          `<button type="button" class="tpick" data-new="1" style="color:var(--accent-blue);font-weight:700;">＋ Agregar un hermano de ${esc(otraNombre() || 'la otra congregación')}</button>`;
      }
    };
    const add = async (pid) => {
      const vols = ((((t.ocurr || {})[fecha]) || {}).vols || []).concat(pid);
      t.ocurr = t.ocurr || {}; t.ocurr[fecha] = Object.assign({}, t.ocurr[fecha] || {}, { vols });
      const refs = extRefs(t); t.externos = refs;
      if (await safe(() => sWrite(sRef('trabajos'), [[occPath(t, fecha, 'vols'), vols], [['lista', t.id, 'externos'], refs]]), 'Agregado')) { m.close(); if (openDetail) openDetail.refresh(); render(); }
    };
    m.q('#slSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { tab = b.dataset.k; paint(); } });
    m.q('#slQ').addEventListener('input', paint);
    m.q('#slL').addEventListener('click', (e) => {
      const b = e.target.closest('.tpick'); if (!b) return;
      if (b.dataset.new) { openExterno(null, (xid) => add('x:' + xid)); return; }
      add(b.dataset.id);
    });
    paint();
  }
  // Alta o edición de un hermano de otra congregación (salón compartido).
  function openExterno(id, onSaved) {
    const x = id ? S.externos[id] : null;
    const m = openModal(`<h3>${x ? 'Editar hermano' : 'Hermano de ' + esc(otraNombre() || 'otra congregación')}</h3><p class="modal-sub" style="margin:0 0 10px;">Para los salones compartidos cuando la otra congregación no usa la app. Se carga una vez y queda para los próximos trabajos.</p>
      <div class="tf"><label for="slXn">Nombre *</label><input id="slXn" maxlength="60" value="${esc(x ? x.nombre : '')}" placeholder="Ej.: Juan Ramírez"></div>
      <div class="tf"><label for="slXc">Congregación</label><input id="slXc" maxlength="40" value="${esc(x ? x.cong : otraNombre())}" placeholder="Ej.: Paraná Sur"></div>
      <div class="tf"><label for="slXt">Teléfono (opcional)</label><input id="slXt" type="tel" maxlength="25" value="${esc(x ? x.tel || '' : '')}" placeholder="Ej.: 342 555-1234"></div>
      <div class="tnote">📱 Con el teléfono, desde cada trabajo le mandás el aviso por WhatsApp con un toque. No recibe avisos de la app. El teléfono solo lo ven el Super Admin y el Admin — Salón.</div>
      <div class="sl-err" id="slXe"></div>
      <div class="tfoot">${x ? '<button type="button" class="btn btn-danger" id="slXd">Borrar</button>' : ''}<button type="button" class="btn" data-tclose>Cancelar</button><button type="button" class="btn btn-primary" id="slXs">Guardar</button></div>`);
    m.q('#slXs').addEventListener('click', async () => {
      const nombre = m.q('#slXn').value.trim();
      if (!nombre) { m.q('#slXe').textContent = 'Escribí el nombre.'; return; }
      const nx = { id: (x && x.id) || newId(), nombre, cong: m.q('#slXc').value.trim(), tel: m.q('#slXt').value.trim() };
      if (await safe(() => sWrite(sRef('externos'), [[['lista', nx.id], nx]]), 'Guardado')) { S.externos[nx.id] = nx; m.close(); if (onSaved) onSaved(nx.id); render(); }
    });
    const del = m.q('#slXd');
    if (del) del.addEventListener('click', async () => {
      const usado = Object.values(S.trabajos).some(t => t && (t.resp === 'x:' + x.id || t.aux === 'x:' + x.id));
      if (!confirm(usado ? `${x.nombre} es responsable o auxiliar de algún trabajo: ahí va a seguir figurando su nombre. ¿Borrarlo de la lista igual?` : `¿Borrar a ${x.nombre} de la lista?`)) return;
      if (await safe(() => sWrite(sRef('externos'), [[['lista', x.id], undefined]]), 'Borrado')) { delete S.externos[x.id]; m.close(); render(); }
    });
  }
  function avisarExterno(t, fecha, pid) {
    const x = S.externos[String(pid).slice(2)]; if (!x || !x.tel) return;
    const rol = t.resp === pid ? 'el responsable' : t.aux === pid ? 'el auxiliar' : 'uno de los voluntarios';
    const lines = [`Hola ${String(x.nombre).split(' ')[0]}, te cuento que sos ${rol} de este trabajo en el Salón del Reino:`, `${tipoOf(t).icon} *${t.titulo}*`, `${fmtDia(fecha)}${t.hora ? ' · ' + t.hora : ''}`, `Responsable: ${pubName(t.resp, t) || '—'} · Auxiliar: ${pubName(t.aux, t) || '—'}`];
    if ((t.materiales || []).length) lines.push('Qué llevar: ' + t.materiales.join(', '));
    lines.push('¡Gracias!');
    window.open(waLink(x.tel, lines.join('\n')), '_blank', 'noopener');
  }
  function vistaLink() { try { const u = new URL('ver/ver.html', location.href); u.searchParams.set('codigo', accessCode || ''); return u.toString(); } catch (e) { return ''; } }
  function shareWa(t, fecha) {
    const ci = C.cupoInfo(t, fecha, S.anotados);
    const lines = [`${tipoOf(t).icon} *${t.titulo}* — Salón del Reino`, `${fmtDia(fecha)}${t.hora ? ' · ' + t.hora : ''}`, `Responsable: ${pubName(t.resp, t) || '—'} · Auxiliar: ${pubName(t.aux, t) || '—'}`];
    if (ci.cupo) lines.push(ci.faltan ? `Hacen falta ${ci.faltan} ${ci.faltan === 1 ? 'voluntario' : 'voluntarios'} más.` : 'Ya están todos los voluntarios, ¡gracias!');
    if ((t.materiales || []).length) lines.push('Qué llevar: ' + t.materiales.join(', '));
    const link = vistaLink(); if (link && ci.faltan) lines.push(`Para anotarte: ${link}`);
    window.open('https://wa.me/?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
  }

  /* =====================================================================
     LIMPIEZA POR GRUPOS (sin responsable ni auxiliar)
     ===================================================================== */
  function saveLimpieza(pairs, msg) { return safe(() => sWrite(sRef('limpieza'), pairs), msg).then(ok => { if (ok) pairs.forEach(([p, v]) => { if (v === undefined) delete S.limpieza[p[0]]; else S.limpieza[p[0]] = v; }); render(); return ok; }); }
  function renderLimpieza(v) {
    const L = S.limpieza || {};
    const rot = (L.rotacion || []).filter(g => S.grupos[g]);
    const sinRot = Object.values(S.grupos).filter(g => g && g.id && !rot.includes(g.id)).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { numeric: true }));
    const modo = L.modo || 'reunion';
    let html = `<div class="thead"><h3>Limpieza por grupos</h3></div>`;
    if (!Object.keys(S.grupos).length) {
      v.innerHTML = html + '<div class="tempty">Primero hay que crear los grupos en <b>Territorios → Grupos</b>. La limpieza rota entre esos grupos.</div>' + externosHTML();
      return;
    }
    html += `<div class="tf"><span class="tlbl">Cuándo se limpia</span><div class="topts" id="slModo"><button type="button" data-s="modo" data-k="reunion" class="${modo === 'reunion' ? 'on' : ''}">Después de cada reunión</button><button type="button" data-s="modo" data-k="semana" class="${modo === 'semana' ? 'on' : ''}">Una vez por semana</button></div></div>`;
    if (modo === 'semana') html += `<div class="tf"><label for="slDia">Qué día</label><select id="slDia">${[1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}"${Number(L.dia != null ? L.dia : 6) === d ? ' selected' : ''}>${DIAS[d]}</option>`).join('')}</select></div>`;
    html += `<div class="tf"><span class="tlbl">Rotación de grupos</span><div class="sl-box">${rot.length ? rot.map((g, i) => `<div class="sl-rot"><span class="nn">${i + 1}</span><span class="nm">${esc(grupoName(g))}<small>${S.grupos[g].encargado ? 'Encargado: ' + esc(pubName(S.grupos[g].encargado)) : ''}</small></span><button type="button" data-s="rot-up" data-i="${i}" aria-label="Subir"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" data-s="rot-down" data-i="${i}" aria-label="Bajar"${i === rot.length - 1 ? ' disabled' : ''}>↓</button><button type="button" data-s="rot-del" data-i="${i}" aria-label="Sacar de la rotación">✕</button></div>`).join('') : '<div class="sl-rot" style="color:var(--ink-soft)">Todavía no hay grupos en la rotación.</div>'}</div>
      ${sinRot.length ? `<div class="topts">${sinRot.map(g => `<button type="button" data-s="rot-add" data-g="${esc(g.id)}">+ ${esc(g.nombre)}</button>`).join('')}</div>` : ''}</div>`;
    if (rot.length) html += `<div class="tf"><label for="slIni">Le toca al primero la semana del</label><input type="date" id="slIni" value="${esc(L.inicio || C.mondayOf(hoy()))}"></div>`;
    html += `<div class="tf"><span class="tlbl">Salón compartido (opcional)</span><label for="slOtraN" style="text-transform:none;letter-spacing:0;font-size:13px;font-weight:600;color:var(--ink);margin:2px 0 5px;">Nombre de la otra congregación</label><input id="slOtraN" maxlength="40" value="${esc(otraNombre())}" placeholder="Ej.: Paraná Sur" style="width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:9px;padding:9px 10px;font:inherit;font-size:14px;background:var(--bg);color:var(--ink);margin-bottom:10px;"><p class="hint" style="margin:0 0 6px;">Marcá las semanas de cada mes que limpia la otra congregación. Esas semanas no cuentan en la rotación.</p><div class="topts">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-s="otra" data-n="${n}" class="${(L.otra || []).includes(n) ? 'on' : ''}" aria-pressed="${(L.otra || []).includes(n)}">Semana ${n}</button>`).join('')}</div></div>`;
    const tareas = L.tareas || TAREAS_DEF;
    html += `<div class="tf"><label for="slTar">Tareas de la limpieza <small style="text-transform:none;letter-spacing:0;font-weight:400;">(una por renglón, las ven los hermanos)</small></label><textarea id="slTar" style="min-height:110px;">${esc(tareas.join('\n'))}</textarea></div>`;
    if (rot.length) {
      const hoyM = C.mondayOf(hoy());
      const rows = [];
      for (let i = 0, w = hoyM; i < 6; i++, w = C.addDays(w, 7)) {
        const l = limpiezaDe(w); if (!l) continue;
        rows.push(`<div><span>${i === 0 ? 'Esta' : Number(w.slice(8)) + '/' + Number(w.slice(5, 7))}</span><b>${esc(l.nombre)}</b>${l.tu.otra ? '' : ` <em>· ${l.dias.map(fmtCorto).join(' y ')}</em>`}</div>`);
      }
      html += `<div class="sl-sec"><h4>Así quedan las próximas semanas</h4></div><div class="sl-box sl-prev">${rows.join('')}</div>`;
    }
    v.innerHTML = html + externosHTML();
  }
  // Salón compartido: hermanos de la otra congregación que ayudan en los trabajos.
  function externosHTML() {
    const xs = extList();
    return `<div class="sl-sec"><h4>Hermanos de ${esc(otraNombre() || 'otra congregación')}</h4><button type="button" class="btn" data-s="x-new">+ Agregar</button></div>
      <p class="hint" style="margin:-4px 2px 8px;">Si comparten el Salón con otra congregación que no usa la app, cargá acá a sus hermanos para ponerlos de responsable, auxiliar o voluntario en los trabajos.</p>
      ${xs.length ? `<div class="sl-box">${xs.map(x => `<button type="button" class="sl-rot" data-s="x-edit" data-id="${esc(x.id)}" style="width:100%;background:none;border-left:none;border-right:none;border-bottom:none;font:inherit;color:var(--ink);text-align:left;cursor:pointer;"><span class="sl-av" style="background:${colorOf(x.nombre)}">${esc(inic(x.nombre))}</span><span class="nm">${esc(x.nombre)}<small>${x.cong ? 'Cong. ' + esc(x.cong) : 'Otra congregación'}${x.tel ? ' · 📱 ' + esc(x.tel) : ''}</small></span><span style="color:var(--ink-soft)">›</span></button>`).join('')}</div>` : ''}`;
  }

  /* =====================================================================
     Pantalla principal
     ===================================================================== */
  function render() {
    const root = $('salonRoot'); if (!root) return;
    if (!fbDb || !accessCode || !currentUser) { root.innerHTML = '<div class="tempty">Los trabajos del Salón se guardan en la nube: conectá la app con el código de la congregación e iniciá sesión.</div>'; return; }
    if (!access()) { root.innerHTML = '<div class="tempty">No tenés acceso al Salón.</div>'; return; }
    start();
    const views = [['cal', 'Calendario'], ['trab', 'Trabajos'], ['limp', 'Limpieza']];
    const seg = `<div class="tseg" role="tablist">${views.map(([k, l]) => `<button type="button" role="tab" class="${k === S.view ? 'on' : ''}" aria-selected="${k === S.view}" data-s="view" data-k="${k}">${l}</button>`).join('')}</div>`;
    root.innerHTML = seg + '<div id="salonView"></div>';
    const v = $('salonView');
    if (!S.loaded.trabajos || !S.loaded.limpieza || !S.loaded.grupos) { v.innerHTML = '<div class="tempty">Cargando…</div>'; return; }
    if (S.view === 'trab') renderTrabajos(v);
    else if (S.view === 'limp') renderLimpieza(v);
    else renderCal(v);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('#salonRoot [data-s]');
    if (!b || b.tagName === 'INPUT') return;
    const k = b.dataset.s;
    const L = S.limpieza || {};
    const rot = (L.rotacion || []).filter(g => S.grupos[g]);
    if (k === 'view') { S.view = b.dataset.k; render(); }
    else if (k === 'mes') { const [y, m] = S.month.split('-').map(Number); const d = new Date(y, m - 1 + Number(b.dataset.d), 1, 12); S.month = C.isoOf(d).slice(0, 7); S.day = null; render(); }
    else if (k === 'day') { S.day = S.day === b.dataset.f ? null : b.dataset.f; render(); }
    else if (k === 'new') openForm(null, b.dataset.f);
    else if (k === 'open') openTrabajo(b.dataset.id, b.dataset.f);
    else if (k === 'edit') openForm(b.dataset.id);
    else if (k === 'otra') { const n = Number(b.dataset.n); const o = (L.otra || []).filter(x => x !== n); if (!b.classList.contains('on')) o.push(n); saveLimpieza([[['otra'], o.sort()]], 'Guardado'); }
    else if (k === 'x-new') openExterno(null);
    else if (k === 'x-edit') openExterno(b.dataset.id);
    else if (k === 'modo') saveLimpieza([[['modo'], b.dataset.k]], 'Guardado');
    else if (k === 'rot-add') saveLimpieza([[['rotacion'], rot.concat(b.dataset.g)]].concat(L.inicio ? [] : [[['inicio'], C.mondayOf(hoy())]]), 'Grupo agregado a la rotación');
    else if (k === 'rot-del') { const r = rot.slice(); r.splice(Number(b.dataset.i), 1); saveLimpieza([[['rotacion'], r]], 'Sacado de la rotación'); }
    else if (k === 'rot-up' || k === 'rot-down') { const i = Number(b.dataset.i), j = k === 'rot-up' ? i - 1 : i + 1; const r = rot.slice(); [r[i], r[j]] = [r[j], r[i]]; saveLimpieza([[['rotacion'], r]], 'Orden guardado'); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.closest || !el.closest('#salonRoot')) return;
    const L = S.limpieza || {};
    if (el.id === 'slDia') saveLimpieza([[['dia'], Number(el.value)]], 'Guardado');
    else if (el.id === 'slIni' && el.value) saveLimpieza([[['inicio'], C.mondayOf(el.value)]], 'Guardado');
    else if (el.id === 'slOtraN') saveLimpieza([[['otraNombre'], el.value.trim().slice(0, 40) || undefined]], 'Guardado');
    else if (el.id === 'slTar') saveLimpieza([[['tareas'], el.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 30)]], 'Tareas guardadas');
  });

  if (typeof currentUserRole !== 'undefined' && typeof applyRoleUI === 'function' && currentUser) { try { window.salonOnRole(); } catch (e) { /* nada */ } }
})();
