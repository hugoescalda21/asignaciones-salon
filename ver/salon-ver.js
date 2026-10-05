/* =====================================================================
   Vista de la congregación — El Salón: trabajos y limpieza
   ---------------------------------------------------------------------
   Usa las variables y funciones de ver.html (data, currentUser, $,
   escapeHtml, initFirebase, getCode, showTab, formatDate, monthKey,
   gcalUrl, showToast, renderPersonalSummary) y salon-core.js.
   Lee: congregations/{código}/salon/trabajos, salon/limpieza, terr/grupos,
        y salonAnotados (quiénes se sumaron a cada trabajo).
   Escribe solo lo suyo: su propio "Me sumo" en salonAnotados/{trabajo__fecha__uid}.
   ===================================================================== */
(function () {
  'use strict';
  const C = window.SalonCore;
  if (!C) return;
  const V = { code: null, unsub: [], trabajos: {}, limpieza: {}, grupos: {}, anotados: {}, fichas: {}, started: false };
  window.__salonVer = V;

  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DIAS3 = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const css = `
  #salonBox .sv-lz { border-radius: 14px; padding: 12px 14px; margin-bottom: 8px; background: var(--surface); border: 1px solid var(--line); }
  #salonBox .sv-lz.mine { border: none; color: #fff; background: linear-gradient(135deg, #0E7490, #0891B2); }
  #salonBox .sv-lz small { display: block; font-size: 10.5px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; opacity: .8; }
  #salonBox .sv-lz b { display: block; font-size: 16px; margin: 2px 0; }
  #salonBox .sv-lz p { margin: 0; font-size: 12.5px; opacity: .9; line-height: 1.45; }
  #salonBox .sv-lzt + .sv-lzt { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.25); }
  #salonBox .sv-tareas { margin-top: 9px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,.25); }
  #salonBox .sv-tareas label { display: flex; gap: 9px; align-items: center; font-size: 13px; padding: 4px 0; cursor: pointer; }
  #salonBox .sv-tareas input { width: 17px; height: 17px; accent-color: #fff; }
  #salonBox .sv-tareas label.ok span { text-decoration: line-through; opacity: .75; }
  .sv-teaser { display: flex; align-items: center; gap: 11px; width: 100%; text-align: left; font: inherit; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-left: 4px solid #0891B2; border-radius: 14px; padding: 11px 13px; margin: 0 0 14px; cursor: pointer; }
  .sv-teaser .ic { font-size: 20px; } .sv-teaser .tx { flex: 1; min-width: 0; }
  .sv-teaser b { display: block; font-size: 14px; } .sv-teaser small { display: block; font-size: 12.5px; color: var(--ink-soft); margin-top: 1px; }
  .sv-teaser .go { font-size: 20px; color: var(--ink-soft); }
  .sv-empty { font-size: 13px; color: var(--ink-soft); margin: 0 2px 12px; }
  .sv-wks { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 2px 13px; margin-bottom: 12px; }
  .sv-wk { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid var(--line); font-size: 13.5px; }
  .sv-wk:first-child { border-top: none; } .sv-wk span { width: 74px; font-size: 12px; font-weight: 700; color: var(--ink-soft); }
  .sv-wk.me b { color: #0E7490; } html.dk .sv-wk.me b { color: #67E8F9; }
  .sv-wk em { margin-left: auto; font-style: normal; font-size: 10.5px; font-weight: 800; border-radius: 8px; padding: 2px 7px; background: rgba(8,145,178,.14); color: #0E7490; }
  .bt-btn { position: relative; }
  .bt-btn[data-tab="salon"] { letter-spacing: -.02em; }
  .bt-dot { position: absolute; top: 6px; left: calc(50% + 9px); width: 8px; height: 8px; border-radius: 50%; background: #F59E0B; box-shadow: 0 0 0 2px var(--surface); }
  .sv-card { display: flex; gap: 10px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; margin-bottom: 8px; }
  .sv-card.mine { border: 1.5px solid var(--accent-gold, #A9822F); }
  .sv-dt { width: 38px; flex-shrink: 0; text-align: center; font-size: 10.5px; font-weight: 700; color: var(--ink-soft); line-height: 1.15; padding-top: 2px; }
  .sv-dt b { display: block; font-size: 18px; color: var(--ink); }
  .sv-bar { width: 4px; border-radius: 3px; flex-shrink: 0; }
  .sv-tx { flex: 1; min-width: 0; }
  .sv-tx b { display: block; font-size: 14.5px; }
  .sv-tx small { display: block; font-size: 12px; color: var(--ink-soft); line-height: 1.45; }
  .sv-tx small em { font-style: normal; font-weight: 700; color: #B45309; }
  .sv-act { align-self: center; flex-shrink: 0; }
  .sv-btn { border: none; border-radius: 16px; padding: 7px 12px; font: inherit; font-size: 12.5px; font-weight: 800; cursor: pointer; background: var(--accent-blue, #2563EB); color: #fff; white-space: nowrap; }
  .sv-btn.ok { background: rgba(22,163,74,.14); color: #15803D; }
  .sv-btn.full { background: var(--bg); color: var(--ink-soft); cursor: default; }
  .sv-tag { font-size: 10.5px; font-weight: 800; border-radius: 9px; padding: 4px 8px; background: rgba(169,130,47,.2); color: var(--ink); white-space: nowrap; }
  html.dk .sv-btn.ok { color: #86EFAC; background: rgba(34,197,94,.18); }
  .sv-ov { position: fixed; inset: 0; background: rgba(15,23,42,.5); z-index: 60; display: flex; align-items: flex-end; justify-content: center; }
  .sv-sheet { background: var(--surface); color: var(--ink); width: 100%; max-width: 480px; border-radius: 22px 22px 0 0; padding: 10px 18px calc(18px + env(safe-area-inset-bottom)); max-height: 92vh; overflow: auto; }
  .sv-sheet .gr { width: 38px; height: 5px; border-radius: 5px; background: var(--line); margin: 0 auto 12px; }
  .sv-sheet h3 { margin: 0; font-size: 19px; }
  .sv-sheet .sub { font-size: 12.5px; color: var(--ink-soft); margin: 3px 0 12px; line-height: 1.45; }
  .sv-box { background: var(--bg); border: 1px solid var(--line); border-radius: 14px; padding: 2px 12px; margin-bottom: 10px; }
  .sv-box div { display: flex; gap: 9px; font-size: 13px; padding: 8px 0; border-top: 1px solid var(--line); line-height: 1.4; }
  .sv-box div:first-child { border-top: none; }
  .sv-box span { width: 18px; text-align: center; flex-shrink: 0; }
  .sv-who { display: flex; align-items: center; gap: 10px; background: rgba(37,99,235,.1); border-radius: 14px; padding: 10px 12px; margin-bottom: 10px; font-size: 13.5px; }
  .sv-av { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--accent-blue, #2563EB); color: #fff; font-weight: 800; font-size: 12px; flex-shrink: 0; }
  .sv-sheet input[type=text] { width: 100%; box-sizing: border-box; border: 1px solid var(--line); border-radius: 12px; padding: 11px 12px; font: inherit; font-size: 15px; background: var(--bg); color: var(--ink); margin-bottom: 12px; }
  .sv-bb { display: block; width: 100%; text-align: center; border-radius: 14px; padding: 13px; font: inherit; font-weight: 800; font-size: 14.5px; margin-top: 8px; border: none; cursor: pointer; text-decoration: none; box-sizing: border-box; }
  .sv-bb.p { background: var(--accent-blue, #2563EB); color: #fff; }
  .sv-bb.o { background: var(--surface); color: var(--ink); box-shadow: inset 0 0 0 1.5px var(--line); }
  .sv-bb.r { background: rgba(220,38,38,.12); color: #B91C1C; }
  html.dk .sv-bb.r { color: #FCA5A5; }
  .sv-bdg { display: inline-grid; place-items: center; min-width: 16px; height: 16px; border-radius: 4px; color: #fff; font-size: 10.5px; font-weight: 900; margin-right: 5px; padding: 0 1px; vertical-align: 1px; }
  .sv-lnk { border: none; background: none; padding: 3px 0 0; font: inherit; font-size: 12.5px; font-weight: 800; color: var(--accent-blue, #2563EB); cursor: pointer; display: block; }
  .sv-fh { padding: 2px 0 10px; }
  .sv-fhtop { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .sv-fhtop small { font-size: 9.5px; font-weight: 800; letter-spacing: .14em; color: var(--ink-soft); padding-top: 4px; }
  .sv-fbadge { display: flex; align-items: center; gap: 7px; flex-shrink: 0; } .sv-fbadge em { white-space: nowrap; font-style: normal; font-size: 9px; font-weight: 800; letter-spacing: .16em; color: var(--c); }
  .sv-fbadge b { width: 34px; height: 34px; display: grid; place-items: center; color: #fff; font-size: 19px; }
  .sv-ficha h3 { font-size: 22px !important; margin: 4px 0 6px !important; line-height: 1.15; }
  .sv-fline { display: block; height: 3px; width: 62%; background: var(--c); border-radius: 2px; }
  .sv-epp { display: flex; gap: 6px; justify-content: flex-end; margin-top: 8px; } .sv-epp img { width: 32px; height: 32px; border-radius: 50%; background: #fff; }
  html.dk .sv-epp img { filter: invert(1); background: transparent; }
  .sv-faviso { display: flex; gap: 10px; align-items: stretch; background: rgba(220,38,38,.08); border-radius: 10px; overflow: hidden; margin-bottom: 10px; font-size: 12.5px; line-height: 1.4; }
  .sv-faviso b { background: #B91C1C; color: #fff; width: 24px; display: grid; place-items: center; font-size: 15px; flex-shrink: 0; } .sv-faviso span { padding: 8px 10px 8px 0; }
  .sv-fok { background: rgba(22,163,74,.12); color: #15803D; border-radius: 12px; padding: 10px 12px; font-weight: 800; font-size: 13.5px; margin-bottom: 10px; }
  html.dk .sv-fok { color: #86EFAC; }
  .sv-fsec { display: flex; justify-content: space-between; align-items: baseline; margin: 12px 2px 6px; } .sv-fsec b { font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-soft); } .sv-fsec span { font-size: 12.5px; font-weight: 800; }
  .sv-fbar { height: 6px; border-radius: 4px; background: var(--bg); overflow: hidden; margin: 0 2px 8px; } .sv-fbar i { display: block; height: 100%; }
  .sv-flist { background: var(--bg); border: 1px solid var(--line); border-radius: 14px; padding: 4px 12px; margin-bottom: 8px; }
  .sv-flist h4 { margin: 10px 0 2px; font-size: 13px; font-weight: 900; letter-spacing: .02em; }
  .sv-flist label { display: flex; gap: 10px; align-items: flex-start; font-size: 13.5px; line-height: 1.4; padding: 8px 0; border-top: 1px solid var(--line); cursor: pointer; }
  .sv-flist h4 + label, .sv-flist label:first-child { border-top: none; }
  .sv-flist input { width: 20px; height: 20px; flex-shrink: 0; margin: 0; accent-color: #16A34A; }
  .sv-flist label.ok span { color: var(--ink-soft); text-decoration: line-through; }
  .sv-fnota { width: 100%; box-sizing: border-box; min-height: 70px; border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; font: inherit; font-size: 14px; background: var(--bg); color: var(--ink); }
  .sv-fnotas { font-size: 11px; color: var(--ink-soft); line-height: 1.45; margin-top: 12px; border-top: 1px solid var(--line); padding-top: 8px; }
  .sv-note { font-size: 12px; color: var(--ink-soft); text-align: center; margin-top: 10px; line-height: 1.45; }
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const esc = (s) => escapeHtml(s == null ? '' : String(s));
  const hoy = () => C.isoOf(new Date());
  // Los hermanos de otra congregación (salón compartido) vienen con id "x:…" y su nombre copiado en el trabajo.
  const pubName = (id, t) => { if (typeof id === 'string' && id.startsWith('x:')) { const x = t && t.externos && t.externos[id]; return x ? x.nombre : ''; } const p = ((data && data.publishers) || []).find(x => x.id === id); return p ? p.name : ''; };
  const congDe = (id, t) => { const x = typeof id === 'string' && id.startsWith('x:') && t && t.externos && t.externos[id]; return x ? (x.cong ? 'Cong. ' + x.cong : 'otra cong.') : ''; };
  const apellido = (id, fb, t) => { const n = (pubName(id, t) || fb || '').trim().split(/\s+/); return n[n.length - 1] || ''; };
  const quienCorto = (id, t) => { const a = apellido(id, '', t); const c = congDe(id, t); return a ? a + (c ? ` (${c})` : '') : ''; };
  const quienLargo = (id, t) => { const n = pubName(id, t); const c = congDe(id, t); return n ? n + (c ? ` (${c})` : '') : '—'; };
  const inic = (n) => String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  function myPub() { if (window.viewerPub) return window.viewerPub(); if (!currentUser || !currentUser.email || !data) return null; const e = String(currentUser.email).toLowerCase(); return (data.publishers || []).find(p => p.email && String(p.email).toLowerCase() === e) || null; }
  function grupoDe(pid) { const g = Object.values(V.grupos).find(x => x && ((x.miembros || []).includes(pid) || x.encargado === pid || x.auxiliar === pid)); return g ? g.id : null; }
  const tipoOf = (t) => C.TIPOS[t.tipo] || C.TIPOS.otro;
  function fmtDia(iso) { const d = new Date(iso + 'T12:00:00'); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; }
  function fmtCorto(iso) { const d = new Date(iso + 'T12:00:00'); return `${DIAS3[d.getDay()].toLowerCase()} ${d.getDate()}`; }
  function cuando(iso) { const h = hoy(); return iso === h ? 'hoy' : iso === C.addDays(h, 1) ? 'mañana' : fmtDia(iso); }
  function congName() { return (data && data.settings && data.settings.congregationName) || 'Salón del Reino'; }
  /* ---------- Fichas (modelo del manual + lo que completan el responsable y el auxiliar) ---------- */
  const FM = () => window.FichasModelo || { FICHAS: [], EPP: {}, EPP_NOMBRE: {}, porCodigo: () => null };
  const esGrupoTxt = (x) => { const l = [...String(x)].filter(c => /\p{L}/u.test(c)).length; return l >= 2 && x.length <= 60 && x === x.toUpperCase(); };
  function modeloDe(t) { const c = t && t.fichaCod; if (!c || c.startsWith('p:')) return null; return FM().porCodigo(c); }
  const colorDe = (t) => { const md = modeloDe(t); return md ? md.color : tipoOf(t).color; };
  const fichaId = (tid, fecha) => `${tid}__${fecha}`;
  const fichaDoc = (t, fecha) => V.fichas[fichaId(t.id, fecha)] || null;
  const tieneFicha = (t) => !!(modeloDe(t) || (t.tareas || []).length || (t.fichaCod || '').startsWith('p:'));
  function terminado(t, fecha) { const f = fichaDoc(t, fecha); return !!(f && f.estado === 'hecho'); }
  function myAnotado(t, fecha) { return currentUser && currentUser.uid ? V.anotados[C.anotadoId(t.id, fecha, currentUser.uid)] || null : null; }
  function voy(t, fecha, pub) { return !!myAnotado(t, fecha) || (pub && C.voluntarios(t, fecha, V.anotados).some(v => v.pubId === pub.id)); }

  /* ---------- Conectarse ---------- */
  function stop() { V.unsub.forEach(u => { try { u(); } catch (e) { /* nada */ } }); V.unsub = []; V.started = false; }
  function start(code) {
    if (V.started && V.code === code) return;
    stop();
    if (!currentUser) return;
    V.code = code; V.started = true;
    const c = initFirebase().collection('congregations').doc(code);
    V.unsub.push(c.collection('salon').doc('trabajos').onSnapshot((s) => { V.trabajos = ((s.exists && s.data()) || {}).lista || {}; schedule(); }, () => {}));
    V.unsub.push(c.collection('salon').doc('limpieza').onSnapshot((s) => { V.limpieza = (s.exists && s.data()) || {}; schedule(); }, () => {}));
    V.unsub.push(c.collection('terr').doc('grupos').onSnapshot((s) => { V.grupos = ((s.exists && s.data()) || {}).lista || {}; schedule(); }, () => {}));
    // Fichas que completan el responsable o el auxiliar desde acá (tareas tildadas, nota y "Terminé").
    V.unsub.push(c.collection('salonFichas').onSnapshot((qs) => { const o = {}; qs.forEach(d => { o[d.id] = d.data() || {}; }); V.fichas = o; schedule(); }, () => {}));
    V.unsub.push(c.collection('salonAnotados').onSnapshot((qs) => { const o = {}; qs.forEach(d => { o[d.id] = d.data() || {}; }); V.anotados = o; schedule(); }, () => {}));
  }
  let queued = false;
  function schedule() {
    if (queued) return; queued = true;
    setTimeout(() => {
      queued = false;
      try { renderBox(); } catch (e) { console.error(e); }
      try { if (data && typeof renderPersonalSummary === 'function') renderPersonalSummary(V.code); } catch (e) { console.error(e); }
    }, 30);
  }

  /* ---------- Pestaña "Salón" (limpieza y mantenimiento, aparte de las reuniones) ---------- */
  const SALON_IC = '<span class="bt-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></span>';
  function ensureTab() {
    if (!$('panel-salon')) {
      const sec = document.createElement('section');
      sec.id = 'panel-salon'; sec.className = 'tab-panel hidden'; sec.setAttribute('aria-label', 'Mantenimiento');
      const cal = $('panel-calendario');
      cal.parentNode.insertBefore(sec, cal.nextSibling);
    }
    if (!document.querySelector('.bt-btn[data-tab="salon"]')) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'bt-btn hidden'; b.dataset.tab = 'salon';
      b.innerHTML = SALON_IC + 'Mantenimiento<span class="bt-dot hidden" aria-hidden="true"></span>';
      const cal = document.querySelector('.bt-btn[data-tab="calendario"]');
      cal.parentNode.insertBefore(b, cal.nextSibling);
    }
    if (typeof TAB_NAMES !== 'undefined' && !TAB_NAMES.includes('salon')) TAB_NAMES.push('salon');
  }
  // Inicio: una sola línea que lleva a la pestaña Salón (lo del Salón no se mezcla con las reuniones).
  function ensureTeaser() {
    let el = $('salonTeaser');
    if (el) return el;
    const panel = $('panel-inicio'); if (!panel) return null;
    el = document.createElement('button'); el.type = 'button'; el.id = 'salonTeaser'; el.className = 'sv-teaser hidden';
    el.setAttribute('data-goto', 'salon');
    const before = $('pushPrompt') || panel.querySelector('.sec-title');
    panel.insertBefore(el, before || null);
    return el;
  }
  function ensureBox() {
    ensureTab();
    let box = $('salonBox');
    if (box) return box;
    const panel = $('panel-salon'); if (!panel) return null;
    box = document.createElement('div'); box.id = 'salonBox';
    panel.appendChild(box);
    box.addEventListener('click', onBoxClick);
    box.addEventListener('change', (e) => {
      const c = e.target.closest('[data-tarea]'); if (!c) return;
      if (window.__comoPubId) { c.checked = !c.checked; if (window.verComoBloquear) window.verComoBloquear(); return; }
      const k = tareasKey(); const set = loadTareas(k);
      if (c.checked) set.add(c.dataset.tarea); else set.delete(c.dataset.tarea);
      try { localStorage.setItem(k, JSON.stringify([...set])); } catch (err) { /* sin acceso */ }
      c.closest('label').classList.toggle('ok', c.checked);
    });
    return box;
  }
  function tareasKey() { return `salon-tareas-${V.code}-${C.mondayOf(hoy())}`; }
  function loadTareas(k) { try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); } catch (e) { return new Set(); } }
  // Los publicados en la vista y, de los que son "solo del comité", los que son tuyos (responsable, auxiliar o anotado).
  function visibles(pub) {
    const h = hoy();
    return C.trabajosEntre(V.trabajos, h, C.addDays(h, 21)).filter(o => !o.cancelada && o.estado !== 'hecho' && !o.sinDia && (!terminado(o.t, o.fecha) || o.fecha >= h) &&
      (o.pub || (pub && (o.t.resp === pub.id || o.t.aux === pub.id || voy(o.t, o.fecha, pub)))));
  }
  function renderBox() {
    const box = ensureBox(); if (!box) return;
    const pub = myPub();
    const h = hoy(), mon = C.mondayOf(h);
    // Las limpiezas de esta semana (después de las reuniones, la general…) con quién las hace y qué días.
    const ls = C.limpiezasSemana(V.limpieza, mon, data && data.settings)
      .map(l => Object.assign({}, l, { dias: l.dias.filter(f => f >= h) }))
      .filter(l => l.quien && l.quien.g !== 'nadie' && l.dias.length);
    const occ = visibles(pub);
    const tieneSalon = C.tiposLimpieza(V.limpieza).length && (V.limpieza.semanas || V.limpieza.inicio) || Object.keys(V.trabajos).length;
    const btn = document.querySelector('.bt-btn[data-tab="salon"]');
    if (btn) btn.classList.toggle('hidden', !tieneSalon);
    renderTeaser(pub, ls, occ);
    if (!ls.length && !occ.length && !tieneSalon) { box.innerHTML = ''; return; }
    const otraN = (V.limpieza.otraNombre || '').trim() || 'otra congregación';
    const nombreDe = (q) => q.g === 'otra' ? otraN : ((V.grupos[q.g] || {}).nombre || 'un grupo');
    const cuandoL = (l) => esc(l.dias.map(fmtCorto).reduce((t, x, i, a) => t + (i === 0 ? '' : i === a.length - 1 ? ' y ' : ', ') + x, '')) + (l.tipo.modo === 'semana' ? (l.tipo.hora ? ' · ' + esc(l.tipo.hora) : '') : ', después de la reunión');
    const miG = pub ? grupoDe(pub.id) : null;
    const mias = ls.filter(l => miG && l.quien.g === miG);
    const otras = ls.filter(l => !mias.includes(l));
    const varias = C.tiposLimpieza(V.limpieza).length > 1;
    let html = '<h2 class="sec-title" style="margin-top:6px;">Limpieza</h2>';
    if (mias.length) {
      const done = loadTareas(tareasKey());
      html += `<div class="sv-lz mine"><small>Limpieza · tu grupo</small><b>Le toca a tu grupo (${esc(nombreDe(mias[0].quien))})</b>` +
        mias.map(l => `<div class="sv-lzt">${varias ? `<p><b style="display:inline;font-size:inherit;">${esc(l.tipo.nombre)}</b> · ${cuandoL(l)}</p>` : `<p>${cuandoL(l)}.</p>`}
          ${(l.tipo.tareas || []).length ? `<div class="sv-tareas">${l.tipo.tareas.map(x => { const k = l.tipo.id + '|' + x; return `<label class="${done.has(k) ? 'ok' : ''}"><input type="checkbox" data-tarea="${esc(k)}"${done.has(k) ? ' checked' : ''}><span>${esc(x)}</span></label>`; }).join('')}</div>` : ''}</div>`).join('') + '</div>';
    }
    if (otras.length) {
      html += `<div class="sv-lz"><small>Limpieza esta semana</small>${otras.map(l => `<p>${varias ? esc(l.tipo.nombre) + ': ' : 'Le toca a '}<b style="display:inline;font-size:inherit;">${esc(nombreDe(l.quien))}</b> · ${esc(l.dias.map(fmtCorto).reduce((t, x, i, a) => t + (i === 0 ? '' : i === a.length - 1 ? ' y ' : ', ') + x, ''))}${l.tipo.modo === 'semana' && l.tipo.hora ? ' · ' + esc(l.tipo.hora) : ''}</p>`).join('')}</div>`;
    }
    if (!ls.length) html += '<p class="sv-empty">No hay limpieza cargada para esta semana.</p>';
    html += '<h2 class="sec-title">Trabajos de mantenimiento</h2>' + (occ.length ? occ.map(o => cardHTML(o, pub)).join('') : '<p class="sv-empty">No hay trabajos programados en las próximas semanas.</p>');
    // Próximas limpiezas: quién limpia las semanas que vienen (la de tu grupo, marcada).
    const prox = [];
    for (let i = 1, m = C.addDays(mon, 7); i <= 6; i++, m = C.addDays(m, 7)) {
      const lw = C.limpiezasSemana(V.limpieza, m, data && data.settings).filter(l => l.quien && l.quien.g !== 'nadie');
      if (!lw.length) continue;
      const nombres = [...new Set(lw.map(l => nombreDe(l.quien)))];
      const mio = miG && lw.some(l => l.quien.g === miG);
      prox.push(`<div class="sv-wk${mio ? ' me' : ''}"><span>Sem. ${Number(m.slice(8))}/${Number(m.slice(5, 7))}</span><b>${esc(nombres.join(' y '))}</b>${mio ? '<em>Tu grupo</em>' : ''}</div>`);
    }
    if (prox.length) html += `<h2 class="sec-title">Próximas limpiezas</h2><div class="sv-wks">${prox.join('')}</div>`;
    box.innerHTML = html;
  }
  function renderTeaser(pub, ls, occ) {
    const el = ensureTeaser(); if (!el) return;
    const miG = pub ? grupoDe(pub.id) : null;
    const mias = ls.filter(l => miG && l.quien.g === miG);
    const misTrab = occ.filter(o => pub && (o.t.resp === pub.id || o.t.aux === pub.id || voy(o.t, o.fecha, pub)));
    const conLugar = occ.filter(o => { if (!o.pub) return false; const ci = C.cupoInfo(o.t, o.fecha, V.anotados); return ci.cupo && !ci.completo && !misTrab.includes(o); });
    const dot = document.querySelector('.bt-btn[data-tab="salon"] .bt-dot');
    if (dot) dot.classList.toggle('hidden', !mias.length && !misTrab.length);
    const partes = [];
    if (misTrab.length) partes.push(misTrab.length === 1 ? `estás en «${misTrab[0].t.titulo}» (${fmtCorto(misTrab[0].fecha)})` : `estás en ${misTrab.length} trabajos`);
    if (conLugar.length) partes.push(conLugar.length === 1 ? '1 trabajo busca voluntarios' : `${conLugar.length} trabajos buscan voluntarios`);
    if (!mias.length && !partes.length) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    const dias = [...new Set([].concat(...mias.map(l => l.dias)))].sort();
    const lista = dias.map(fmtCorto).reduce((t, x, i, a) => t + (i === 0 ? '' : i === a.length - 1 ? ' y ' : ', ') + x, '');
    const titulo = mias.length ? `Esta semana limpia tu grupo · ${lista}` : 'Mantenimiento';
    el.innerHTML = `<span class="ic">🧹</span><span class="tx"><b>${esc(titulo)}</b>${partes.length ? `<small>${esc(partes.join(' · ').replace(/^./, c => c.toUpperCase()))}</small>` : '<small>Tocá para ver las tareas</small>'}</span><span class="go">›</span>`;
    el.classList.remove('hidden');
  }
  function cardHTML(o, pub) {
    const t = o.t, tp = tipoOf(t), d = new Date(o.fecha + 'T12:00:00');
    const ci = C.cupoInfo(t, o.fecha, V.anotados);
    const soy = pub && (t.resp === pub.id ? 'Sos el responsable' : t.aux === pub.id ? 'Sos el auxiliar' : '');
    const anot = voy(t, o.fecha, pub);
    const van = ci.vols.map(v => apellido(v.pubId, v.nombre, t)).filter(Boolean);
    let act = '';
    const fd = fichaDoc(t, o.fecha), conF = tieneFicha(t);
    if (soy && conF) act = fd && fd.estado === 'hecho' ? `<button type="button" class="sv-btn ok" data-sv="ficha" data-id="${esc(t.id)}" data-f="${o.fecha}">✓ Terminado</button>` : `<button type="button" class="sv-btn" data-sv="ficha" data-id="${esc(t.id)}" data-f="${o.fecha}">📋 Ficha</button>`;
    else if (soy) act = `<span class="sv-tag">${soy}</span>`;
    else if (anot) act = `<button type="button" class="sv-btn ok" data-sv="anotado" data-id="${esc(t.id)}" data-f="${o.fecha}">✓ Anotado</button>`;
    else if (ci.completo) act = '<button type="button" class="sv-btn full" disabled>Completo</button>';
    else if (ci.cupo && o.pub) act = `<button type="button" class="sv-btn" data-sv="sumo" data-id="${esc(t.id)}" data-f="${o.fecha}">Me sumo</button>`;
    return `<div class="sv-card${soy || anot ? ' mine' : ''}" id="sv-${esc(t.id)}-${o.fecha}"><span class="sv-dt">${DIAS3[d.getDay()]}<b>${d.getDate()}</b></span><span class="sv-bar" style="background:${colorDe(t)}"></span>
      <span class="sv-tx"><b>${modeloDe(t) ? `<span class="sv-bdg" style="background:${modeloDe(t).color}${modeloDe(t).sec === '05' ? ';color:#3A2A00' : ''}">${modeloDe(t).letra}</span>` : tp.icon + ' '}${esc(t.titulo)}</b><small>${t.hora ? esc(t.hora) + ' · ' : ''}${esc(quienCorto(t.resp, t))} y ${esc(quienCorto(t.aux, t))}${ci.cupo ? (ci.faltan ? ` · <em>${ci.faltan === 1 ? 'falta 1' : 'faltan ' + ci.faltan}</em>` : ' · completo') : ''}</small>${van.length ? `<small>Van: ${esc(van.join(', '))}</small>` : ''}${o.pub ? '' : '<small>🔒 Todavía no está publicado: lo ve el comité de mantenimiento y vos.</small>'}${soy && conF ? `<small>${esc(soy)}${fd && fd.tareas ? ` · ${Object.keys(fd.tareas).length} de ${(t.tareas || []).filter(x => !esGrupoTxt(x)).length} tareas` : ''}</small>` : ''}${!soy && conF ? `<button type="button" class="sv-lnk" data-sv="ficha" data-id="${esc(t.id)}" data-f="${o.fecha}">📋 Ver la ficha ›</button>` : ''}</span>
      <span class="sv-act">${act}</span></div>`;
  }

  /* ---------- Hojas ---------- */
  function sheet(html) {
    const ov = document.createElement('div'); ov.className = 'sv-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="sv-sheet"><div class="gr"></div>${html}</div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-svclose]')) close(); });
    return { el: ov, q: (s) => ov.querySelector(s), close, set: (h) => { ov.querySelector('.sv-sheet').innerHTML = `<div class="gr"></div>${h}`; } };
  }
  function datosBox(t, fecha) {
    const tp = tipoOf(t);
    return `<div class="sv-box"><div><span>${tp.icon}</span><b>${esc(t.titulo)}</b></div><div><span>🗓</span>${esc(fmtDia(fecha))}${t.hora ? ' · ' + esc(t.hora) : ''}</div><div><span>👤</span>Responsable: ${esc(quienLargo(t.resp, t))} · Auxiliar: ${esc(quienLargo(t.aux, t))}</div>${(t.materiales || []).length ? `<div><span>🧰</span>Qué llevar: ${esc(t.materiales.join(', '))}</div>` : ''}</div>`;
  }
  function gcalFor(t, fecha) { return gcalUrl(t.titulo + ' (Salón del Reino)', fecha, `Trabajo en el Salón — ${congName()}. Responsable: ${quienLargo(t.resp, t)}`, t.hora); }
  function onBoxClick(e) {
    const b = e.target.closest('[data-sv]'); if (!b) return;
    if (window.__comoPubId && b.dataset.sv !== 'ficha') { if (window.verComoBloquear) window.verComoBloquear(); return; }
    const t = V.trabajos[b.dataset.id]; if (!t) return;
    if (b.dataset.sv === 'ficha') { openFicha(t, b.dataset.f); return; }
    if (b.dataset.sv === 'sumo') openSumo(t, b.dataset.f);
    else openAnotado(t, b.dataset.f);
  }
  // La ficha del trabajo en el celular: con el diseño del manual. El responsable y el auxiliar tildan
  // las tareas, escriben cómo se hizo y tocan "Terminé"; los demás la ven sin poder cambiarla.
  function openFicha(t, fecha) {
    const pub = myPub();
    const soy = !!(pub && (t.resp === pub.id || t.aux === pub.id)) && !window.__comoPubId;
    const md = modeloDe(t), col = colorDe(t);
    const ref = () => initFirebase().collection('congregations').doc(V.code).collection('salonFichas').doc(fichaId(t.id, fecha));
    let f = Object.assign({ tareas: {}, mats: {}, nota: '' }, JSON.parse(JSON.stringify(fichaDoc(t, fecha) || {})));
    const hecho = () => f.estado === 'hecho';
    const items = (t.tareas || []).filter(x => !esGrupoTxt(x)).length;
    const puede = () => soy && !hecho();
    const html = () => {
      const n = Object.keys(f.tareas || {}).length;
      const epp = (md && md.epp) || [];
      return `<div class="sv-fh" style="--c:${col}">
          <div class="sv-fhtop"><small>FICHA DE TRABAJO${md ? ' | ' + esc(md.cat.toUpperCase()) : ''}</small>${md ? `<span class="sv-fbadge"><em>MM SECCIÓN ${md.sec}</em><b style="background:${col}${md.sec === '05' ? ';color:#3A2A00' : ''}">${md.letra}</b></span>` : ''}</div>
          <h3>${esc(t.titulo)}</h3><i class="sv-fline"></i>
          ${epp.length ? `<div class="sv-epp">${epp.map(k => `<img src="${FM().EPP[k]}" alt="${esc(FM().EPP_NOMBRE[k] || k)}" title="${esc(FM().EPP_NOMBRE[k] || k)}">`).join('')}</div>` : ''}
        </div>
        ${md && (md.aviso || []).length ? `<div class="sv-faviso"><b>!</b><span>${md.aviso.map(esc).join(' ')}</span></div>` : ''}
        <div class="sv-box"><div><span>🗓</span>${esc(fmtDia(fecha))}${t.hora ? ' · ' + esc(t.hora) : ''}</div><div><span>👤</span>Responsable: ${esc(quienLargo(t.resp, t))} · Auxiliar: ${esc(quienLargo(t.aux, t))}</div>${C.cupoInfo(t, fecha, V.anotados).vols.length ? `<div><span>🙋</span>Van: ${esc(C.cupoInfo(t, fecha, V.anotados).vols.map(v => pubName(v.pubId, t) || v.nombre).filter(Boolean).join(', '))}</div>` : ''}</div>
        ${hecho() ? `<div class="sv-fok">✓ Terminado${f.nombre ? ' por ' + esc(f.nombre) : ''}${f.terminadoAt ? ' · ' + esc(fmtCorto(f.terminadoAt.slice(0, 10))) : ''}</div>` : ''}
        ${items ? `<div class="sv-fsec"><b>Tareas</b><span>${n} de ${items}</span></div><div class="sv-fbar"><i style="width:${Math.round(n * 100 / items)}%;background:${col}"></i></div>
          <div class="sv-flist">${(t.tareas || []).map((x, i) => esGrupoTxt(x) ? `<h4 style="color:${md && md.sec === '05' ? '#A16207' : col}">${esc(x)}</h4>` : `<label class="${(f.tareas || {})[i] ? 'ok' : ''}"><input type="checkbox" data-ft="tareas" data-i="${i}"${(f.tareas || {})[i] ? ' checked' : ''}${puede() ? '' : ' disabled'}><span>${esc(x)}</span></label>`).join('')}</div>` : ''}
        ${(t.materiales || []).length ? `<div class="sv-fsec"><b>Qué llevar</b></div><div class="sv-flist">${t.materiales.map((x, i) => `<label class="${(f.mats || {})[i] ? 'ok' : ''}"><input type="checkbox" data-ft="mats" data-i="${i}"${(f.mats || {})[i] ? ' checked' : ''}${puede() ? '' : ' disabled'}><span>${esc(x)}</span></label>`).join('')}</div>` : ''}
        ${t.notas ? `<div class="sv-note" style="text-align:left;margin:0 0 10px;">${esc(t.notas)}</div>` : ''}
        ${soy || f.nota ? `<div class="sv-fsec"><b>Cómo se hizo</b></div><textarea id="svFNota" class="sv-fnota" placeholder="Ej.: se cambiaron 2 tejas; falta sellar la bajada del fondo"${puede() ? '' : ' disabled'}>${esc(f.nota || '')}</textarea>` : ''}
        ${puede() ? '<button type="button" class="sv-bb p" id="svFFin">✓ Terminé</button>' : ''}
        ${soy && hecho() ? '<button type="button" class="sv-bb o" id="svFReabrir">Todavía no terminé</button>' : ''}
        <button type="button" class="sv-bb o" id="svFPdf">📄 Descargar la ficha (PDF)</button>
        <button type="button" class="sv-bb o" data-svclose>Cerrar</button>
        ${soy ? '<div class="sv-note">Lo que tildás se guarda solo, también sin señal. Al tocar "Terminé" le avisamos al comité de mantenimiento.</div>' : '<div class="sv-note">La completan el responsable y el auxiliar.</div>'}
        ${md && md.notas ? `<div class="sv-fnotas"><b>NOTAS.</b> ${esc(md.notas)}</div>` : ''}`;
    };
    const m = sheet(html());
    m.el.querySelector('.sv-sheet').classList.add('sv-ficha');
    const guardar = async (extra) => {
      if (!soy) return false;
      Object.assign(f, extra || {});
      const doc = { tid: t.id, fecha, tareas: f.tareas || {}, mats: f.mats || {}, nota: String(f.nota || '').slice(0, 1000), estado: f.estado || 'curso', pubId: pub.id, nombre: pub.name, email: currentUser.email, at: new Date().toISOString() };
      if (f.terminadoAt) doc.terminadoAt = f.terminadoAt;
      V.fichas[fichaId(t.id, fecha)] = doc;
      try { await ref().set(doc); return true; }
      catch (e) { console.error(e); showToast(e && e.code === 'permission-denied' ? 'No se pudo guardar: no tenés permiso.' : 'No se pudo guardar. Se reintenta cuando haya conexión.'); return false; }
    };
    const rebind = () => { m.set(html()); bind(); };
    const bind = () => {
      m.el.querySelectorAll('input[data-ft]').forEach(c => c.addEventListener('change', () => {
        const k = c.dataset.ft; f[k] = Object.assign({}, f[k] || {});
        if (c.checked) f[k][c.dataset.i] = true; else delete f[k][c.dataset.i];
        c.closest('label').classList.toggle('ok', c.checked);
        guardar(); if (k === 'tareas') { const n = Object.keys(f.tareas).length; const sp = m.el.querySelector('.sv-fsec span'); if (sp) sp.textContent = `${n} de ${items}`; const bar = m.el.querySelector('.sv-fbar i'); if (bar) bar.style.width = Math.round(n * 100 / items) + '%'; }
      }));
      const nota = m.q('#svFNota'); if (nota) nota.addEventListener('change', () => guardar({ nota: nota.value.trim() }));
      const fin = m.q('#svFFin');
      if (fin) fin.addEventListener('click', async () => {
        if (nota) f.nota = nota.value.trim();
        const faltan = items - Object.keys(f.tareas || {}).length;
        if (faltan > 0 && !window.confirm(`Quedan ${faltan} ${faltan === 1 ? 'tarea' : 'tareas'} sin marcar. ¿Terminaste igual?`)) return;
        if (await guardar({ estado: 'hecho', terminadoAt: new Date().toISOString() })) {
          m.set(`<h3>¡Gracias!</h3><div class="sub">${esc(t.titulo)} quedó como <b>terminado</b>${items ? ` (${Object.keys(f.tareas || {}).length} de ${items} tareas)` : ''}. Le avisamos al comité de mantenimiento.</div><button type="button" class="sv-bb p" data-svclose>Listo</button>`);
          schedule();
        }
      });
      const re = m.q('#svFReabrir'); if (re) re.addEventListener('click', async () => { delete f.terminadoAt; if (await guardar({ estado: 'curso' })) { rebind(); schedule(); } });
      const pdf = m.q('#svFPdf'); if (pdf) pdf.addEventListener('click', () => { const n = m.q('#svFNota'); if (n) f.nota = n.value.trim(); descargarFicha(t, fecha, f); });
    };
    bind();
  }
  // jsPDF se carga recién cuando hace falta (la vista no lo trae de entrada).
  function cargarScript(src) { return new Promise((ok, mal) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = mal; document.head.appendChild(s); }); }
  async function descargarFicha(t, fecha, f) {
    try {
      if (!window.jspdf) await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      if (!window.jspdf.jsPDF.API.autoTable) await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    } catch (e) { showToast('No se pudo preparar el PDF (revisá la conexión).'); return; }
    if (!window.FichaPdf) return;
    const md = modeloDe(t), ci = C.cupoInfo(t, fecha, V.anotados);
    const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    window.FichaPdf.dibujar(doc, {
      titulo: t.titulo, md, color: colorDe(t), esRep: t.clase === 'rep', cong: congName(),
      cuando: fmtDia(fecha).replace(/^./, c => c.toUpperCase()) + (t.hora ? ' · ' + t.hora + ' h' : ''),
      frecuencia: md ? md.frec : C.repiteTxt(t), resp: pubName(t.resp, t), aux: pubName(t.aux, t),
      tareas: t.tareas || [], tareasOk: (f && f.tareas) || {}, matsOk: (f && f.mats) || {}, nota: (f && f.nota) || '',
      voluntarios: ci.vols.map(v => pubName(v.pubId, t) || v.nombre).filter(Boolean), cupo: ci.cupo, materiales: t.materiales || [], notas: t.notas || ''
    });
    const nombre = `Ficha - ${String(t.titulo || 'Trabajo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\\/:*?"<>|]/g, ' ').slice(0, 60)} - ${fecha}.pdf`;
    try {
      const file = new File([doc.output('blob')], nombre, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: nombre }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    doc.save(nombre);
  }
  function openSumo(t, fecha) {
    const pub = myPub();
    if (!pub) {
      sheet(`<h3>Primero vinculá tu nombre</h3><div class="sub">Para anotarte, tu email (<b>${esc(currentUser && currentUser.email)}</b>) tiene que estar vinculado a tu nombre en la app. Pedíselo a quien administra la app.</div><button type="button" class="sv-bb o" data-svclose>Entendido</button>`);
      return;
    }
    const m = sheet(`<h3>¿Te sumás a este trabajo?</h3><div class="sub">El responsable recibe el aviso al instante.</div>${datosBox(t, fecha)}
      <div class="sv-who"><span class="sv-av">${esc(inic(pub.name))}</span><span>Te anotás como <b>${esc(pub.name)}</b></span></div>
      <input type="text" id="svCom" maxlength="80" placeholder="Comentario (opcional): &quot;Llevo la escalera&quot;">
      <button type="button" class="sv-bb p" id="svOk">Confirmar, me sumo</button><button type="button" class="sv-bb o" data-svclose>Cancelar</button>`);
    m.q('#svOk').addEventListener('click', async () => {
      const ci = C.cupoInfo(t, fecha, V.anotados);
      if (ci.completo) { m.close(); showToast('Justo se completó: ya no quedan lugares.'); return; }
      m.q('#svOk').disabled = true;
      const id = C.anotadoId(t.id, fecha, currentUser.uid);
      const doc = { tid: t.id, fecha, pubId: pub.id, nombre: pub.name, uid: currentUser.uid, comentario: m.q('#svCom').value.trim().slice(0, 80), at: new Date().toISOString() };
      try {
        await initFirebase().collection('congregations').doc(V.code).collection('salonAnotados').doc(id).set(doc);
        V.anotados[id] = doc;
        m.set(`<h3>¡Listo, te anotaste!</h3><div class="sub">${esc(t.titulo)} · ${esc(cuando(fecha))}${t.hora ? ' a las ' + esc(t.hora) : ''}. Queda marcado en Mantenimiento y la víspera te llega el recordatorio.</div>
          <a class="sv-bb p" href="${esc(gcalFor(t, fecha))}" target="_blank" rel="noopener">🗓 Agregar al calendario</a><button type="button" class="sv-bb o" data-svclose>Listo</button>`);
        schedule();
      } catch (e) {
        console.error(e); m.q('#svOk').disabled = false;
        showToast(e && e.code === 'permission-denied' ? 'No se pudo anotar: no tenés permiso.' : 'No se pudo anotar. Revisá la conexión y probá de nuevo.');
      }
    });
  }
  function openAnotado(t, fecha) {
    const a = myAnotado(t, fecha);
    const ref = () => initFirebase().collection('congregations').doc(V.code).collection('salonAnotados').doc(C.anotadoId(t.id, fecha, currentUser.uid));
    const main = () => `<h3>${esc(t.titulo)}</h3><div class="sub">${esc(fmtDia(fecha))}${t.hora ? ' · ' + esc(t.hora) : ''} · estás anotado${a && a.comentario ? ` · "${esc(a.comentario)}"` : ''}</div>
      <a class="sv-bb o" href="${esc(gcalFor(t, fecha))}" target="_blank" rel="noopener">🗓 Agregar al calendario</a>
      ${a ? '<button type="button" class="sv-bb o" id="svEd">✏️ Cambiar mi comentario</button><button type="button" class="sv-bb r" id="svNo">Ya no puedo ir</button><div class="sv-note">Si te das de baja se libera el lugar y se avisa al responsable.</div>' : '<div class="sv-note">Te anotó el responsable. Si no podés ir, avisale a él.</div>'}`;
    const m = sheet(main());
    const bind = () => {
      const ed = m.q('#svEd'), no = m.q('#svNo');
      if (ed) ed.addEventListener('click', () => {
        m.set(`<h3>Tu comentario</h3><div class="sub">Lo ve el responsable.</div><input type="text" id="svCom" maxlength="80" value="${esc(a.comentario || '')}" placeholder="Ej.: Llevo la escalera"><button type="button" class="sv-bb p" id="svSave">Guardar</button><button type="button" class="sv-bb o" data-svclose>Cancelar</button>`);
        m.q('#svSave').addEventListener('click', async () => {
          const com = m.q('#svCom').value.trim().slice(0, 80);
          try { await ref().set({ tid: a.tid, fecha: a.fecha, pubId: a.pubId, nombre: a.nombre, uid: a.uid, comentario: com, at: a.at || new Date().toISOString() }); a.comentario = com; m.close(); showToast('Comentario guardado'); schedule(); }
          catch (e) { console.error(e); showToast('No se pudo guardar. Probá de nuevo.'); }
        });
      });
      if (no) no.addEventListener('click', () => {
        m.set(`<h3>¿Ya no podés ir?</h3><div class="sub">Se libera tu lugar en <b>${esc(t.titulo)}</b> (${esc(fmtCorto(fecha))}) y le avisamos al responsable.</div><button type="button" class="sv-bb r" id="svBaja">Sí, darme de baja</button><button type="button" class="sv-bb o" data-svclose>No, sigo anotado</button>`);
        m.q('#svBaja').addEventListener('click', async () => {
          try { await ref().delete(); delete V.anotados[C.anotadoId(t.id, fecha, currentUser.uid)]; m.close(); showToast('Listo, te diste de baja'); schedule(); }
          catch (e) { console.error(e); showToast('No se pudo. Revisá la conexión y probá de nuevo.'); }
        });
      });
    };
    bind();
  }

  /* ---------- "Tus asignaciones" ---------- */
  function myRows(pub, todayIso) {
    if (!pub) return [];
    return C.asignacionesSalon(pub.id, V.trabajos, V.anotados, V.limpieza, data && data.settings, grupoDe, todayIso, C.addDays(todayIso, 56)).map(a => {
      const { dayName, day } = formatDate(a.fecha);
      return { dayLabel: `${dayName.slice(0, 3).toUpperCase()} ${day}`, month: monthKey(a.fecha), type: 'salon', label: a.rol === 'limpieza' ? a.titulo : `${a.titulo} · ${a.quien.toLowerCase()}`, date: a.fecha, meetingType: 'salon', time: a.hora, where: 'Salón del Reino' };
    });
  }

  window.salonVer = {
    onData(code) { ensureTab(); start(code); schedule(); },
    myRows,
    goTo(date) {
      if (typeof showTab === 'function') showTab('salon');
      // Si ese día tenés un trabajo con ficha (responsable o auxiliar), se abre la ficha directamente.
      const pub = myPub();
      const mio = pub && C.trabajosEntre(V.trabajos, date, date).find(o => !o.cancelada && (o.t.resp === pub.id || o.t.aux === pub.id) && tieneFicha(o.t));
      if (mio) { openFicha(mio.t, date); return; }
      const el = document.querySelector(`#salonBox [id$="-${date}"]`) || $('salonBox');
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.transition = 'box-shadow .3s'; el.style.boxShadow = '0 0 0 3px rgba(37,99,235,.45)'; setTimeout(() => { el.style.boxShadow = ''; }, 1600); }
    }
  };
  try { if (typeof data !== 'undefined' && data && typeof getCode === 'function' && getCode()) window.salonVer.onData(getCode()); } catch (e) { /* nada */ }
})();
