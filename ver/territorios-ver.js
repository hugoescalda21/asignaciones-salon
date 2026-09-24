/* =====================================================================
   Vista de la congregación — Salidas al servicio y "Mis territorios"
   ---------------------------------------------------------------------
   Usa las variables y funciones de ver.html: data, currentUser, $,
   escapeHtml, initFirebase, getCode, showTab, TAB_NAMES, formatDate,
   monthKey, renderPersonalSummary...
   Lee (lo que arma el encargado en la app de asignaciones):
     congregations/{código}/terr/grupos, terr/lugares, terr/territorios
     congregations/{código}/salidas/{grupo}
   Escribe solo el aviso "Lo terminé": congregations/{código}/terminados/{territorio}
   ===================================================================== */
(function () {
  'use strict';
  const V = { code: null, unsub: [], grupos: {}, lugares: {}, territorios: {}, salidas: {}, terminados: {}, showAll: false, started: false };
  window.__terrVer = V;

  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const DIAS3 = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const ICON_L = { casa: '🏠', esquina: '📍', salon: '🏛', otro: '📌' };
  const TIPOS_T = { casas: 'Casas', edificios: 'Edificios', rural: 'Rural', comercial: 'Comercial', mixto: 'Mixto' };
  const VENCE_DIAS = 120;

  const css = `
  #salidasBox .sal-chips { display: flex; gap: 6px; margin: -2px 0 10px; }
  #salidasBox .sal-chips button { border: 1px solid var(--line); background: var(--surface); border-radius: 16px; padding: 5px 11px; font: inherit; font-size: 12px; font-weight: 600; color: var(--ink); }
  #salidasBox .sal-chips button.on { background: var(--ink); color: var(--surface); border-color: var(--ink); }
  .sal-card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 11px 13px; margin-bottom: 8px; }
  .sal-card.mine { border: 1.5px solid var(--accent-gold, #A9822F); }
  .sal-card.off { opacity: .55; }
  .sal-when { font-size: 12px; font-weight: 700; color: var(--ink-soft); display: flex; justify-content: space-between; gap: 8px; }
  .sal-when .tag { font-size: 10.5px; border-radius: 9px; padding: 1px 8px; background: var(--bg); color: var(--ink-soft); white-space: nowrap; }
  .sal-when .tag.me { background: rgba(169,130,47,0.2); color: var(--ink); }
  .sal-place { font-size: 15px; font-weight: 700; margin: 3px 0 1px; }
  .sal-sub { font-size: 12.5px; color: var(--ink-soft); line-height: 1.45; }
  .sal-sub b { color: var(--ink); font-weight: 600; }
  .sal-terr { border: 1px solid var(--line); background: var(--bg); border-radius: 12px; padding: 2px 9px; margin: 3px 4px 0 0; font: inherit; font-size: 12px; font-weight: 700; color: var(--ink); cursor: pointer; }
  .sal-btn { display: inline-block; margin-top: 7px; border: 1px solid var(--line); border-radius: 9px; padding: 6px 11px; font-size: 12.5px; font-weight: 700; color: var(--ink); text-decoration: none; background: var(--bg); }
  .mt-card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; margin-bottom: 12px; }
  .mt-map { height: 210px; background: #e8eae3; }
  .mt-maprow { display: flex; gap: 6px; flex-wrap: wrap; padding: 8px 12px 0; }
  .mt-maprow .sal-btn { margin-top: 0; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
  .mt-big { position: fixed; inset: 0; z-index: 70; background: var(--surface); display: flex; flex-direction: column; }
  .mt-big-h { display: flex; align-items: center; gap: 8px; padding: calc(10px + env(safe-area-inset-top)) 12px 10px; border-bottom: 1px solid var(--line); }
  .mt-big-h b { flex: 1; font-size: 15px; }
  .mt-big-h .sal-btn { margin-top: 0; }
  .mt-big-h button { border: none; background: none; font-size: 20px; color: var(--ink-soft); }
  .mt-big-map { flex: 1; }
  .mt-card img { width: 100%; max-height: 300px; object-fit: contain; background: var(--bg); display: block; cursor: zoom-in; }
  .mt-noimg { padding: 22px; text-align: center; color: var(--ink-faint); font-size: 12.5px; background: var(--bg); }
  .mt-body { padding: 12px 14px 14px; }
  .mt-title { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
  .mt-title b { font-size: 16px; }
  .mt-title span { font-size: 12px; color: var(--ink-soft); }
  .mt-due { font-size: 12.5px; font-weight: 600; border-radius: 8px; padding: 6px 9px; margin: 8px 0; background: rgba(201,138,27,0.15); color: #7A5410; }
  .mt-due.late { background: rgba(192,57,43,0.13); color: #8A2E22; }
  .mt-notes { font-size: 12.5px; color: var(--ink-soft); white-space: pre-wrap; margin-bottom: 8px; }
  .mt-done { width: 100%; border: none; border-radius: 11px; padding: 12px; font: inherit; font-size: 14px; font-weight: 700; background: #4C7A5E; color: #fff; }
  .mt-sent { font-size: 12.5px; border-radius: 9px; padding: 8px 10px; background: rgba(76,122,94,0.14); color: #2F5A40; }
  .mt-ov { position: fixed; inset: 0; background: rgba(33,44,52,.45); z-index: 60; display: flex; align-items: flex-end; justify-content: center; }
  .mt-sheet { background: var(--surface); width: 100%; max-width: 480px; border-radius: 16px 16px 0 0; padding: 18px 18px calc(18px + env(safe-area-inset-bottom)); }
  .mt-sheet h3 { font-family: 'Fraunces', serif; font-weight: 500; margin: 0 0 6px; font-size: 19px; }
  .mt-sheet p { font-size: 13.5px; color: var(--ink-soft); margin: 0 0 12px; line-height: 1.5; }
  .mt-sheet input { width: 100%; box-sizing: border-box; border: 1px solid var(--line); border-radius: 10px; padding: 10px; font: inherit; font-size: 15px; background: var(--bg); color: var(--ink); margin-bottom: 12px; }
  .mt-sheet .row { display: flex; gap: 8px; }
  .mt-sheet .row button { flex: 1; border-radius: 11px; padding: 12px; font: inherit; font-size: 14px; font-weight: 700; border: 1px solid var(--line); background: var(--surface); color: var(--ink); }
  .mt-sheet .row button.ok { background: #4C7A5E; border-color: #4C7A5E; color: #fff; }
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const esc = (s) => escapeHtml(s == null ? '' : String(s));
  function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  const hoy = () => iso(new Date());
  function addDays(s, n) { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); }
  function mondayOfIso(s) { const d = new Date(s + 'T12:00:00'); const w = d.getDay(); return addDays(s, w === 0 ? -6 : 1 - w); }
  function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }
  function fmtLong(s) { const d = new Date(s + 'T12:00:00'); return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); }
  function agoTxt(s) { const n = daysBetween(s, hoy()); if (n <= 0) return 'hoy'; if (n === 1) return 'ayer'; if (n < 14) return `hace ${n} días`; if (n < 60) return `hace ${Math.round(n / 7)} semanas`; return `hace ${Math.round(n / 30)} meses`; }
  const pubName = (id) => { const p = ((data && data.publishers) || []).find(x => x.id === id); return p ? p.name : ''; };
  function myPub() { if (!currentUser || !currentUser.email || !data) return null; return (data.publishers || []).find(p => p.email === currentUser.email) || null; }
  function myGroup(pub) { if (!pub) return null; return Object.values(V.grupos).find(g => (g.miembros || []).includes(pub.id) || g.encargado === pub.id || g.auxiliar === pub.id) || null; }
  const grupoName = (gid) => gid === 'congregacion' ? 'Congregación' : (V.grupos[gid] ? V.grupos[gid].nombre : 'Grupo');
  function mapsUrl(l) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(l.direccion || l.nombre || ''); }

  // Salidas de una semana, con los cambios de esa semana (la misma lógica que en la app de asignaciones).
  function weekSalidas(monday) {
    const out = [];
    Object.keys(V.salidas).forEach(gid => {
      const doc = V.salidas[gid] || {};
      const sem = (doc.semanas || {})[monday] || {};
      const cambios = sem.cambios || {};
      Object.values(doc.plantilla || {}).forEach(p => {
        if (!p || !p.id || (p.desde && p.desde > monday)) return;
        const c = cambios[p.id] || {};
        out.push({ gid, id: p.id, hora: p.hora || '', lugar: p.lugar || '', conductor: c.conductor !== undefined ? c.conductor : (p.conductor || null), territorios: c.territorios !== undefined ? (c.territorios || []) : (p.territorios || []), cancelada: !!c.cancelada, fecha: addDays(monday, (p.dia || 1) - 1) });
      });
      Object.values(sem.extra || {}).forEach(x => { if (x && x.id) out.push({ gid, id: x.id, hora: x.hora || '', lugar: x.lugar || '', conductor: x.conductor || null, territorios: x.territorios || [], cancelada: false, fecha: addDays(monday, (x.dia || 1) - 1) }); });
    });
    return out.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  }
  function salidasBetween(from, to) {
    const out = [];
    for (let m = mondayOfIso(from); m <= to; m = addDays(m, 7)) weekSalidas(m).forEach(s => { if (s.fecha >= from && s.fecha <= to) out.push(s); });
    return out;
  }

  /* ---------- Conectarse ---------- */
  function stop() { V.unsub.forEach(u => { try { u(); } catch (e) { /* nada */ } }); V.unsub = []; V.started = false; }
  function start(code) {
    if (V.started && V.code === code) return;
    stop();
    if (!currentUser) return;
    V.code = code; V.started = true;
    const db = initFirebase();
    const c = db.collection('congregations').doc(code);
    const docL = (name) => c.collection('terr').doc(name).onSnapshot((s) => { V[name] = ((s.exists && s.data()) || {}).lista || {}; schedule(); }, () => { /* sin permiso o sin datos todavía */ });
    V.unsub.push(docL('grupos'), docL('lugares'), docL('territorios'));
    V.unsub.push(c.collection('salidas').onSnapshot((qs) => { const o = {}; qs.forEach(d => { o[d.id] = d.data() || {}; }); V.salidas = o; schedule(); }, () => {}));
    if (currentUser.email) {
      V.unsub.push(c.collection('terminados').where('email', '==', currentUser.email).onSnapshot((qs) => { const o = {}; qs.forEach(d => { o[d.id] = d.data() || {}; }); V.terminados = o; schedule(); }, () => {}));
    }
  }
  let queued = false;
  function schedule() {
    if (queued) return; queued = true;
    setTimeout(() => {
      queued = false;
      try { renderSalidasBox(); } catch (e) { console.error(e); }
      try { renderMisTerritorios(); } catch (e) { console.error(e); }
      try { if (data && typeof renderPersonalSummary === 'function') renderPersonalSummary(V.code); } catch (e) { console.error(e); }
    }, 30);
  }

  /* ---------- Inicio: salidas de los próximos días ---------- */
  function ensureBox() {
    let box = $('salidasBox');
    if (box) return box;
    const panel = $('panel-inicio'); if (!panel) return null;
    box = document.createElement('div'); box.id = 'salidasBox';
    const title = panel.querySelector('.sec-title');
    panel.insertBefore(box, title || null);
    box.addEventListener('click', (e) => {
      const t = e.target.closest('[data-sal-terr]'); if (t) { openTerritorySheet(t.dataset.salTerr); return; }
      const b = e.target.closest('[data-sal-all]'); if (b) { V.showAll = b.dataset.salAll === '1'; renderSalidasBox(); }
    });
    return box;
  }
  function renderSalidasBox() {
    const box = ensureBox(); if (!box) return;
    const from = hoy(), to = addDays(from, 7);
    const all = salidasBetween(from, to);
    if (!all.length) { box.innerHTML = ''; return; }
    const pub = myPub();
    const g = myGroup(pub);
    const list = (!g || V.showAll) ? all : all.filter(s => s.gid === 'congregacion' || s.gid === g.id || (pub && s.conductor === pub.id));
    let html = `<h2 class="sec-title">Salidas al servicio</h2>`;
    if (g) html += `<div class="sal-chips"><button type="button" class="${V.showAll ? '' : 'on'}" data-sal-all="0">${esc(g.nombre)} y congregación</button><button type="button" class="${V.showAll ? 'on' : ''}" data-sal-all="1">Todas</button></div>`;
    html += list.length ? list.map(s => {
      const d = new Date(s.fecha + 'T12:00:00');
      const L = V.lugares[s.lugar];
      const mine = pub && s.conductor === pub.id;
      const terr = s.territorios.filter(t => V.territorios[t]).map(t => `<button type="button" class="sal-terr" data-sal-terr="${esc(t)}">${tTitle(V.territorios[t])}</button>`);
      const when = `${s.fecha === from ? 'Hoy' : s.fecha === addDays(from, 1) ? 'Mañana' : DIAS3[d.getDay()] + ' ' + d.getDate()} · ${esc(s.hora)}`;
      return `<div class="sal-card${mine ? ' mine' : ''}${s.cancelada ? ' off' : ''}" id="sal-${esc(s.gid)}-${esc(s.id)}-${s.fecha}">
        <div class="sal-when"><span>${when}</span><span class="tag${mine ? ' me' : ''}">${mine ? 'Vos conducís' : s.cancelada ? 'Suspendida' : esc(grupoName(s.gid))}</span></div>
        <div class="sal-place">${L ? (ICON_L[L.tipo] || '📌') + ' ' + esc(L.nombre) : '📌 Lugar a confirmar'}</div>
        <div class="sal-sub">${L && L.direccion ? esc(L.direccion) + ' · ' : ''}Conduce <b>${s.conductor ? esc(pubName(s.conductor)) : 'a confirmar'}</b></div>
        ${terr.length ? `<div class="sal-sub">Territorio${terr.length > 1 ? 's' : ''} ${terr.join(' ')}</div>` : ''}
        ${L && L.notas ? `<div class="sal-sub">${esc(L.notas)}</div>` : ''}
        ${L && L.direccion && !s.cancelada ? `<a class="sal-btn" href="${esc(mapsUrl(L))}" target="_blank" rel="noopener">🧭 Cómo llegar</a>` : ''}
      </div>`;
    }).join('') : '<p class="sal-sub" style="margin:0 2px 10px;">No hay salidas de tu grupo en los próximos días.</p>';
    box.innerHTML = html;
  }

  // Filas para "tus asignaciones" (Inicio): las salidas que conduce esta persona.
  function myConductorRows(pub, todayIso) {
    if (!pub) return [];
    const to = addDays(todayIso, 56);
    return salidasBetween(todayIso, to).filter(s => s.conductor === pub.id && !s.cancelada).map(s => {
      const { dayName, day } = formatDate(s.fecha);
      const L = V.lugares[s.lugar];
      return { dayLabel: `${dayName.slice(0, 3).toUpperCase()} ${day}`, month: monthKey(s.fecha), type: 'salida', label: 'Conducir la salida', date: s.fecha, meetingType: 'salida', time: s.hora, where: L ? L.nombre : 'Salida al servicio', salId: `sal-${s.gid}-${s.id}-${s.fecha}` };
    });
  }

  /* ---------- Mis territorios ---------- */
  // Sus territorios: los asignados a él o a su grupo, y los de las salidas que conduce en los próximos días.
  function myTerritories() {
    const pub = myPub(); if (!pub) return [];
    const g = myGroup(pub);
    const out = [];
    Object.values(V.territorios).forEach(t => {
      if (t.asignado && ((t.asignado.tipo === 'hermano' && t.asignado.id === pub.id) || (g && t.asignado.tipo === 'grupo' && t.asignado.id === g.id))) out.push({ t, via: null });
    });
    salidasBetween(hoy(), addDays(hoy(), 7)).filter(s => s.conductor === pub.id && !s.cancelada).forEach(s => {
      s.territorios.forEach(tid => { const t = V.territorios[tid]; if (t && !out.some(x => x.t.id === tid)) out.push({ t, via: s }); });
    });
    return out.sort((a, b) => String(a.t.num).localeCompare(String(b.t.num), 'es', { numeric: true }));
  }
  function tTitle(t) { return `${esc(t.num)}${t.nombre ? ' · ' + esc(t.nombre) : ''}`; }
  const hasMap = (t) => !!(t.limites && t.limites.length >= 3 && window.TerrMapa);
  function tTop(t) {
    if (!hasMap(t)) return tImg(t);
    return `<div class="mt-map" data-mt-map="${esc(t.id)}"></div><div class="mt-maprow"><a class="sal-btn" href="${esc(window.TerrMapa.directionsUrl(t.limites))}" target="_blank" rel="noopener">🧭 Cómo llegar</a><button type="button" class="sal-btn" data-mt-big="${esc(t.id)}">🗺 Mapa grande</button>${t.foto && t.foto.url ? `<button type="button" class="sal-btn" data-mt-img="${esc(t.foto.url)}">📷 Tarjeta</button>` : ''}</div>`;
  }
  function initMaps(root) {
    if (!window.TerrMapa) return;
    (root || document).querySelectorAll('[data-mt-map]:not([data-done])').forEach(el => {
      if (!el.offsetWidth) return;   // todavía oculto: se dibuja al mostrar la pestaña
      const t = V.territorios[el.dataset.mtMap]; if (!t) return;
      el.dataset.done = '1';
      window.TerrMapa.show(el, t.limites, { label: t.num, locate: true }).catch(() => { el.outerHTML = tImg(t); });
    });
  }
  function openBigMap(tid) {
    const t = V.territorios[tid]; if (!t || !hasMap(t)) return;
    const ov = document.createElement('div');
    ov.className = 'mt-big';
    ov.innerHTML = `<div class="mt-big-h"><b>${tTitle(t)}</b><a class="sal-btn" href="${esc(window.TerrMapa.directionsUrl(t.limites))}" target="_blank" rel="noopener">🧭 Cómo llegar</a><button type="button" aria-label="Cerrar" id="mtBigX">✕</button></div><div class="mt-big-map" id="mtBigMap"></div>`;
    document.body.appendChild(ov);
    ov.querySelector('#mtBigX').addEventListener('click', () => ov.remove());
    window.TerrMapa.show(ov.querySelector('#mtBigMap'), t.limites, { label: t.num, locate: true, big: true }).catch(() => ov.remove());
  }
  function tImg(t) { return t.foto && t.foto.url ? `<img src="${esc(t.foto.url)}" alt="Tarjeta del territorio ${esc(t.num)}" data-mt-img="${esc(t.foto.url)}">` : '<div class="mt-noimg">Sin foto de la tarjeta todavía</div>'; }
  function viaTxt(s) { const d = new Date(s.fecha + 'T12:00:00'); const L = V.lugares[s.lugar]; return `Para la salida que conducís el ${DIAS[d.getDay()].toLowerCase()} ${d.getDate()} · ${esc(s.hora)}${L ? ' · ' + esc(L.nombre) : ''}`; }
  function ensureTab() {
    if (!$('panel-territorios')) {
      const sec = document.createElement('section');
      sec.id = 'panel-territorios'; sec.className = 'tab-panel hidden'; sec.setAttribute('aria-label', 'Mis territorios');
      const avisos = $('panel-avisos');
      avisos.parentNode.insertBefore(sec, avisos.nextSibling);
      sec.addEventListener('click', onTerrClick);
    }
    if (!document.querySelector('.bt-btn[data-tab="territorios"]')) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'bt-btn hidden'; b.dataset.tab = 'territorios';
      b.innerHTML = '<span class="bt-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg></span>Territorios';
      const av = document.querySelector('.bt-btn[data-tab="avisos"]');
      av.parentNode.insertBefore(b, av);
      b.addEventListener('click', () => setTimeout(() => initMaps($('panel-territorios')), 60));
    }
    if (typeof TAB_NAMES !== 'undefined' && !TAB_NAMES.includes('territorios')) TAB_NAMES.push('territorios');
  }
  function renderMisTerritorios() {
    ensureTab();
    const list = myTerritories();
    const btn = document.querySelector('.bt-btn[data-tab="territorios"]');
    btn.classList.toggle('hidden', !list.length);
    const panel = $('panel-territorios');
    if (!list.length) {
      panel.innerHTML = '';
      if (typeof currentTab !== 'undefined' && currentTab === 'territorios') showTab('inicio');
      return;
    }
    const pub = myPub(); const g = myGroup(pub);
    const canReport = (t, via) => !!via || (t.asignado && (t.asignado.tipo === 'hermano' || (g && (g.encargado === pub.id || g.auxiliar === pub.id))));
    panel.innerHTML = `<h2 class="sec-title" style="margin-top:6px;">Mis territorios</h2>` + list.map(({ t, via }) => {
      const rep = V.terminados[t.id];
      let info = '';
      if (via) info = `<div class="mt-due">${viaTxt(via)}</div>`;
      else {
        const due = addDays(t.asignado.desde, VENCE_DIAS);
        const late = hoy() > due;
        info = `${t.asignado.tipo === 'grupo' ? `<div class="sal-sub">De tu grupo · ${esc(grupoName(t.asignado.id))}</div>` : ''}<div class="mt-due${late ? ' late' : ''}">Asignado ${esc(agoTxt(t.asignado.desde))} · ${late ? 'se pasó la fecha: ' : 'terminalo antes del '}${esc(fmtLong(due))}</div>`;
      }
      return `<div class="mt-card">${tTop(t)}<div class="mt-body">
        <div class="mt-title"><b>${tTitle(t)}</b><span>${esc(TIPOS_T[t.tipo] || '')}</span></div>
        ${info}
        ${t.notas ? `<div class="mt-notes">${esc(t.notas)}</div>` : ''}
        ${rep ? `<div class="mt-sent">✓ Avisaste que lo terminaste el ${esc(fmtLong(rep.fecha))}. Falta que lo confirme el encargado.</div>` : (canReport(t, via) ? `<button type="button" class="mt-done" data-mt-done="${esc(t.id)}">✓ Lo terminé</button>` : '')}
      </div></div>`;
    }).join('');
    setTimeout(() => initMaps(panel), 30);
  }
  // Tarjeta de un territorio (desde una salida): foto y notas.
  function openTerritorySheet(tid) {
    const t = V.territorios[tid]; if (!t) return;
    const ov = document.createElement('div');
    ov.className = 'mt-ov';
    ov.innerHTML = `<div class="mt-sheet" role="dialog" aria-modal="true" style="max-height:88vh;overflow:auto;"><div class="mt-card" style="margin:0 0 12px;">${tTop(t)}<div class="mt-body"><div class="mt-title"><b>${tTitle(t)}</b><span>${esc(TIPOS_T[t.tipo] || '')}</span></div>${t.notas ? `<div class="mt-notes" style="margin-top:6px;">${esc(t.notas)}</div>` : ''}</div></div><div class="row"><button type="button" id="mtClose">Cerrar</button></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => {
      if (e.target === ov || e.target.id === 'mtClose') { ov.remove(); return; }
      const im = e.target.closest('[data-mt-img]'); if (im) { window.open(im.dataset.mtImg, '_blank', 'noopener'); return; }
      const bg = e.target.closest('[data-mt-big]'); if (bg) openBigMap(bg.dataset.mtBig);
    });
    setTimeout(() => initMaps(ov), 30);
  }
  function onTerrClick(e) {
    const im = e.target.closest('[data-mt-img]');
    if (im) { window.open(im.dataset.mtImg, '_blank', 'noopener'); return; }
    const bg = e.target.closest('[data-mt-big]');
    if (bg) { openBigMap(bg.dataset.mtBig); return; }
    const b = e.target.closest('[data-mt-done]');
    if (b) openDone(b.dataset.mtDone);
  }
  function openDone(tid) {
    const t = V.territorios[tid]; const pub = myPub();
    if (!t || !pub) return;
    const ov = document.createElement('div');
    ov.className = 'mt-ov';
    ov.innerHTML = `<div class="mt-sheet" role="dialog" aria-modal="true"><h3>¿Terminaste el territorio ${esc(t.num)}?</h3>
      <p>Le avisamos al encargado de territorios para que lo marque como terminado.</p>
      <input type="date" id="mtDate" value="${hoy()}" max="${hoy()}" aria-label="Fecha en que lo terminaste">
      <div class="row"><button type="button" id="mtNo">Cancelar</button><button type="button" class="ok" id="mtOk">Sí, avisar</button></div></div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    ov.querySelector('#mtNo').addEventListener('click', close);
    ov.querySelector('#mtOk').addEventListener('click', async () => {
      const btn = ov.querySelector('#mtOk'); btn.disabled = true; btn.textContent = 'Avisando…';
      try {
        await initFirebase().collection('congregations').doc(V.code).collection('terminados').doc(tid)
          .set({ tid, pubId: pub.id, nombre: pub.name, email: currentUser.email, fecha: ov.querySelector('#mtDate').value || hoy(), at: new Date().toISOString() });
        V.terminados[tid] = { fecha: ov.querySelector('#mtDate').value || hoy() };
        close(); renderMisTerritorios();
      } catch (err) {
        console.error(err); btn.disabled = false; btn.textContent = 'Sí, avisar';
        ov.querySelector('p').textContent = 'No se pudo avisar. Revisá la conexión y probá de nuevo.';
      }
    });
  }

  window.terrVer = {
    onData(code) { start(code); schedule(); },
    myConductorRows,
    // Tocar "Conducir la salida" en Inicio lleva a la tarjeta de esa salida.
    goToSalida(date) {
      if (typeof showTab === 'function') showTab('inicio');
      const el = document.querySelector(`.sal-card.mine[id$="-${date}"]`) || $('salidasBox');
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.transition = 'box-shadow .3s'; el.style.boxShadow = '0 0 0 3px rgba(169,130,47,.5)'; setTimeout(() => { el.style.boxShadow = ''; }, 1600); }
    }
  };
  try { if (typeof data !== 'undefined' && data && typeof getCode === 'function' && getCode()) window.terrVer.onData(getCode()); } catch (e) { /* nada */ }
})();
