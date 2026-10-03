/* =====================================================================
   Panel del Super Admin
   ---------------------------------------------------------------------
   Módulo de la app de asignaciones (asignaciones-salon.html). Una sola
   pantalla con lo que hay que resolver y el estado de cada área, con un
   link a la pestaña donde se arregla. Solo lee: no guarda nada propio.
   Usa las globales de la app (data, getRoles, dateForType, mondayOf,
   shiftDate, programAssignedIds, autoAssign, switchTab, accReqs,
   backupsCall, devicesCall, appLinks...) y los resúmenes de
   territorios.js (window.terrPanel) y salon.js (window.salonPanel).
   También: "Ver como un hermano" (abre la vista como la ve él).
   ===================================================================== */
(function () {
  'use strict';
  const P = { bk: undefined, dev: undefined, errN: undefined, loading: {} };
  window.__panel = P;   // para las pruebas

  const css = `
  #panelRoot { padding-bottom: 20px; }
  .pn-head { display: flex; align-items: center; gap: 10px; margin: 0 0 14px; flex-wrap: wrap; }
  .pn-head h2 { font-family: 'Fraunces', serif; font-weight: 500; font-size: 22px; margin: 0; flex: 1; min-width: 180px; }
  .pn-head h2 small { display: block; font-family: 'Public Sans', sans-serif; font-size: 12.5px; color: var(--ink-soft); margin-top: 2px; font-weight: 400; }
  .pn-urg { background: var(--surface); border: 1px solid var(--line); border-left: 4px solid #C0392B; border-radius: 14px; padding: 6px 14px; margin-bottom: 16px; }
  .pn-urg.okk { border-left-color: #4C7A5E; padding: 12px 14px; display: flex; align-items: center; gap: 10px; font-size: 14.5px; font-weight: 700; color: #2F6B4A; }
  html.dk .pn-urg.okk { color: #9FD4B2; }
  .pn-urg h3 { margin: 6px 0 4px; font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #A8433A; }
  html.dk .pn-urg h3 { color: #F1998D; }
  .pn-ui { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid var(--line); font-size: 14px; }
  .pn-urg h3 + .pn-ui { border-top: none; }
  .pn-ui > i { font-style: normal; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; font-size: 15px; flex-shrink: 0; }
  .pn-ui > i.r { background: rgba(192,57,43,.12); } .pn-ui > i.y { background: rgba(201,138,27,.16); }
  .pn-ui > span { flex: 1; min-width: 0; } .pn-ui > span small { display: block; font-size: 12px; color: var(--ink-soft); }
  .pn-ui > span.pn-acts { flex: 0 0 auto; }
  .pn-ui .pn-acts { display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
  .pn-go { border: none; background: none; font: inherit; font-size: 12.5px; font-weight: 800; color: var(--accent-gold-text, var(--accent-gold)); cursor: pointer; white-space: nowrap; padding: 4px 2px; }
  .pn-go.pill { border-radius: 9px; padding: 5px 10px; background: color-mix(in srgb, var(--accent-gold) 14%, transparent); }
  .pn-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
  @media (min-width: 900px) { .pn-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .pn-grid .w2 { grid-column: span 2; } }
  .pn-c { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 13px 14px; min-width: 0; }
  .pn-c h4 { margin: 0 0 10px; font-size: 13px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-soft); display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .pn-c h4 .pn-go { text-transform: none; letter-spacing: 0; }
  .pn-wk { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  @media (min-width: 900px) { .pn-wk { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  .pn-wk button { border-radius: 11px; padding: 9px 8px; text-align: center; font: inherit; font-size: 12px; border: 1px solid var(--line); color: var(--ink); cursor: pointer; background: var(--bg); }
  .pn-wk b { display: block; font-size: 15px; margin: 2px 0; }
  .pn-wk .ok { background: rgba(76,122,94,.12); } .pn-wk .ok b { color: #2F6B4A; }
  .pn-wk .falta { background: rgba(201,138,27,.14); } .pn-wk .falta b { color: #8A6212; }
  .pn-wk .vacia b { color: var(--ink-soft); }
  html.dk .pn-wk .ok b { color: #9FD4B2; } html.dk .pn-wk .falta b { color: #F2C46B; }
  .pn-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 8px; }
  .pn-kpis div { border-radius: 11px; background: var(--bg); padding: 8px 6px; text-align: center; font-size: 11.5px; color: var(--ink-soft); }
  .pn-kpis b { display: block; font-size: 20px; color: var(--ink); } .pn-kpis b.r { color: #A8433A; }
  .pn-row { display: flex; justify-content: space-between; gap: 8px; padding: 6px 0; border-top: 1px solid var(--line); font-size: 13px; }
  .pn-row:first-of-type { border-top: none; } .pn-row > span { color: var(--ink-soft); } .pn-row b { text-align: right; }
  .pn-row b.w { color: #8A6212; } .pn-row b.r { color: #A8433A; }
  html.dk .pn-row b.w { color: #F2C46B; } html.dk .pn-row b.r { color: #F1998D; }
  .pn-bar { height: 8px; border-radius: 6px; background: var(--bg); overflow: hidden; margin: 2px 0 4px; } .pn-bar i { display: block; height: 100%; background: var(--accent-gold); }
  .pn-names { font-size: 12px; color: var(--ink-soft); line-height: 1.5; margin: 2px 0 4px; }
  .pn-ppl { margin: 4px 0 0; }
  .pn-ppl div { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px dashed var(--line); font-size: 13px; }
  .pn-ppl div span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pn-wa { border: none; border-radius: 8px; padding: 4px 9px; font: inherit; font-size: 12px; font-weight: 800; background: #DCFCE7; color: #15803D; cursor: pointer; white-space: nowrap; }
  .pn-ver { display: flex; align-items: center; gap: 12px; }
  .pn-ver .ic { width: 42px; height: 42px; border-radius: 12px; background: var(--bg); display: grid; place-items: center; font-size: 20px; flex-shrink: 0; }
  .pn-ver p { margin: 0; font-size: 13px; color: var(--ink-soft); line-height: 1.45; flex: 1; }
  .pn-muted { color: var(--ink-soft); font-size: 12.5px; }
  .pn-pick .tlist { max-height: 50vh; }
  #panelBtn { display: none; }
  @media (max-width: 760px) { #panelBtn.pn-on { display: inline-flex; align-items: center; justify-content: center; } }
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const esc = (s) => escapeHtml(s == null ? '' : String(s));
  const hoy = () => todayIsoLocal();
  const DIAS3 = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fmtCorto = (iso) => { const d = new Date(iso + 'T12:00:00'); return `${DIAS3[d.getDay()]} ${d.getDate()}`; };
  const fmtSem = (m) => `${Number(m.slice(8))}/${Number(m.slice(5, 7))}`;
  const pubs = () => (data.publishers || []).filter(p => p.status !== 'inactivo');
  const pubName = (id) => { const p = (data.publishers || []).find(x => x.id === id); return p ? p.name : ''; };
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
  const isSuper = () => typeof currentUserRole !== 'undefined' && currentUserRole === 'super';
  const cloud = () => !!(typeof fbDb !== 'undefined' && fbDb && accessCode && currentUser);

  /* ---------- Reuniones ---------- */
  // Puestos sin asignar de una reunión (los del Equipo técnico, que son los que siempre hay que cubrir).
  function faltanRoles(monday, type) {
    const w = (data.weeks || {})[monday];
    const r = (w && w[type] && w[type].roles) || {};
    return getRoles(type).filter(x => !r[x.key]);
  }
  function semanaVacia(monday) {
    const w = (data.weeks || {})[monday];
    if (!w) return true;
    return ['semana', 'finde'].every(t => !w[t] || (!Object.values(w[t].roles || {}).some(Boolean) && !programAssignedIds(w[t].program, t).size));
  }
  function reuniones() {
    const today = hoy(), out = [];
    for (let i = 0, m = mondayOf(today); i < 4; i++, m = shiftDate(m, 7)) {
      const tipos = ['semana', 'finde'].map(t => ({ t, fecha: dateForType(m, t) })).filter(x => x.fecha >= today || i > 0);
      const vacia = semanaVacia(m);
      const faltan = vacia ? [] : tipos.map(x => ({ ...x, roles: faltanRoles(m, x.t) })).filter(x => x.roles.length);
      out.push({ monday: m, tipos, vacia, faltan, nFaltan: faltan.reduce((n, x) => n + x.roles.length, 0) });
    }
    return out;
  }
  // Hermanos con algún privilegio marcado que no tuvieron ninguna asignación en los últimos 2 meses.
  function sinAsignaciones() {
    const today = hoy(), desde = shiftDate(today, -60);
    const usados = new Set();
    Object.entries(data.weeks || {}).forEach(([m, w]) => {
      ['semana', 'finde'].forEach(t => {
        if (!w[t]) return;
        const f = dateForType(m, t);
        if (f < desde || f > shiftDate(today, 60)) return;
        Object.values(w[t].roles || {}).forEach(id => id && usados.add(id));
        programAssignedIds(w[t].program, t).forEach(id => usados.add(id));
      });
    });
    return pubs().filter(p => p.status !== 'no_disponible' && (Object.values(p.roles || {}).some(Boolean) || Object.values(p.progCaps || {}).some(Boolean)) && !usados.has(p.id));
  }

  /* ---------- Datos que se piden a la nube (una vez por sesión) ---------- */
  function cargarExtras() {
    if (!cloud() || !isSuper()) return;
    if (P.bk === undefined && !P.loading.bk) {
      P.loading.bk = true;
      backupsCall('list').then(r => { P.bk = (r.backups || [])[0] || null; }).catch(() => { P.bk = 'error'; }).finally(() => { P.loading.bk = false; refrescar(); });
    }
    if (P.dev === undefined && !P.loading.dev) {
      P.loading.dev = true;
      devicesCall('list').then(r => { P.dev = r.devices || []; }).catch(() => { P.dev = 'error'; }).finally(() => { P.loading.dev = false; refrescar(); });
    }
    if (P.errN === undefined && !P.loading.err) {
      P.loading.err = true;
      let seen = ''; try { seen = localStorage.getItem('kh-err-seen') || ''; } catch (e) { /* nada */ }
      const since = seen || new Date(Date.now() - 7 * 86400000).toISOString();
      Promise.resolve().then(() => fbDb.collection('congregations').doc(accessCode).collection('errores').where('at', '>', since).limit(20).get())
        .then(s => { P.errN = s.size || 0; }).catch(() => { P.errN = 0; }).finally(() => { P.loading.err = false; refrescar(); });
    }
  }

  /* ---------- Pantalla ---------- */
  function isVisible() { const p = $('panel-panel'); return p && !p.classList.contains('hidden'); }
  let q = false;
  function refrescar() { if (q) return; q = true; setTimeout(() => { q = false; if (isVisible()) render(); }, 30); }
  function item(icon, cls, txt, sub, acts) { return `<div class="pn-ui"><i class="${cls}">${icon}</i><span>${txt}${sub ? `<small>${sub}</small>` : ''}</span><span class="pn-acts">${acts}</span></div>`; }
  const go = (k, label, extra, pill) => `<button type="button" class="pn-go${pill ? ' pill' : ''}" data-pn="${k}"${extra || ''}>${label}</button>`;

  function render() {
    const root = $('panelRoot'); if (!root) return;
    cargarExtras();
    const today = hoy();
    const d = new Date(today + 'T12:00:00');
    const cong = (data.settings && data.settings.congregationName) || '';
    const reu = reuniones();
    const terr = window.terrPanel ? window.terrPanel() : null;
    const sal = window.salonPanel ? window.salonPanel() : null;
    const reqs = (typeof accReqs !== 'undefined' ? accReqs : []).filter(r => r.status !== 'rechazado');
    // Lo urgente
    const urg = [];
    reu.slice(0, 2).forEach(w => w.faltan.forEach(x => {
      const dd = daysBetween(today, x.fecha);
      const cuando = dd === 0 ? ' (hoy)' : dd === 1 ? ' (mañana)' : '';
      const nom = x.roles.map(r => r.label.replace('Micrófono de pasillo', 'Micrófono').replace('Acomodador de plataforma', 'Plataforma')).join(', ');
      urg.push(item('🎤', dd <= 3 ? 'r' : 'y', `${esc(fmtCorto(x.fecha).replace(/^./, c => c.toUpperCase()))}${cuando}: ${x.roles.length === 1 ? 'falta' : 'faltan'} ${esc(nom)}`, x.t === 'finde' ? 'Reunión del fin de semana' : 'Reunión entre semana',
        go('sugerir', '✨ Sugerir', ` data-m="${w.monday}" data-t="${x.t}"`, true) + go('asignar', 'Asignar ›', ` data-m="${w.monday}" data-t="${x.t}"`)));
    }));
    if (reqs.length) urg.push(item('🙋', 'y', `${reqs.length} ${reqs.length === 1 ? 'solicitud de acceso esperando' : 'solicitudes de acceso esperando'}`, esc(reqs.slice(0, 3).map(r => r.name).join(' · ')), go('solicitudes', 'Revisar ›')));
    if (terr && terr.terminados.length) urg.push(item('🗺', 'y', `${terr.terminados.length} ${terr.terminados.length === 1 ? 'aviso' : 'avisos'} de "Lo terminé" para confirmar`, esc(terr.terminados.slice(0, 2).map(t => `Territorio ${t.num}${t.nombre ? ' · ' + t.nombre : ''}${t.quien ? ' · ' + t.quien : ''}`).join(' — ')), go('terminados', 'Confirmar ›')));
    if (sal && sal.hayLimpieza && sal.vacias) urg.push(item('🧹', 'y', `Limpieza sin cargar desde la semana del ${fmtSem(sal.primeraVacia)}`, `${sal.vacias} ${sal.vacias === 1 ? 'semana vacía' : 'semanas vacías'} en las próximas 6 · "Sugerir" las completa`, go('limpieza', 'Cargar ›', ` data-m="${sal.primeraVacia}"`)));
    if (P.errN) urg.push(item('⚠️', 'y', `${P.errN >= 20 ? 'Más de 20' : P.errN} ${P.errN === 1 ? 'error nuevo' : 'errores nuevos'} en el registro`, 'En los teléfonos de los hermanos', go('errores', 'Ver ›')));
    if (P.bk && P.bk !== 'error') {
      const dias = daysBetween(P.bk.dateIso, today);
      if (dias > 7) urg.push(item('💾', 'r', `Hace ${dias} días de la última copia de seguridad`, 'La automática corre los domingos', go('backup', 'Hacer ahora ›')));
    } else if (P.bk === null) urg.push(item('💾', 'r', 'Todavía no hay copias de seguridad en la nube', 'La primera se hace sola el domingo', go('backup', 'Hacer ahora ›')));
    let html = `<div class="pn-head"><h2>Panel<small>${esc(['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][d.getDay()])} ${d.getDate()} de ${MESES[d.getMonth()]}${cong ? ' · ' + esc(cong) : ''}</small></h2><button type="button" class="btn" data-pn="vercomo">👁 Ver como un hermano</button></div>`;
    html += urg.length ? `<div class="pn-urg" id="pnUrg"><h3>Para resolver · ${urg.length}</h3>${urg.join('')}</div>` : '<div class="pn-urg okk" id="pnUrg"><span style="font-size:20px">✓</span>Todo al día</div>';
    // Reuniones
    const wk = reu.map(w => {
      const cls = w.vacia ? 'vacia' : w.nFaltan ? 'falta' : 'ok';
      const txt = w.vacia ? 'Sin cargar' : w.nFaltan ? `${w.nFaltan} ${w.nFaltan === 1 ? 'falta' : 'faltan'}` : 'Completa';
      return `<button type="button" class="${cls}" data-pn="semana" data-m="${w.monday}">Sem. ${fmtSem(w.monday)}<b>${txt}</b>${w.tipos.map(x => fmtCorto(x.fecha)).join(' · ')}</button>`;
    }).join('');
    const anuncios = (data.anuncios || []).filter(a => !(a.expiresIso && new Date(a.expiresIso).getTime() < Date.now())).length;
    html += '<div class="pn-grid">';
    html += `<div class="pn-c w2"><h4>Reuniones · próximas 4 semanas ${go('programa', 'Programa ›')}</h4><div class="pn-wk">${wk}</div><div class="pn-row" style="margin-top:8px"><span>Anuncios vigentes</span><b>${anuncios}</b></div></div>`;
    // Hermanos y acceso
    const act = pubs().filter(p => p.status !== 'no_disponible');
    const conEmail = act.filter(p => p.email);
    const devPubs = Array.isArray(P.dev) ? new Set(P.dev.map(x => x.pubId)) : null;
    const sinAvisos = devPubs ? conEmail.filter(p => !devPubs.has(p.id)) : [];
    const sinAsig = sinAsignaciones();
    html += `<div class="pn-c"><h4>Hermanos y acceso ${go('ajustes', 'Ajustes ›')}</h4>
      <div class="pn-row"><span>Email vinculado</span><b>${conEmail.length} de ${act.length}</b></div><div class="pn-bar"><i style="width:${act.length ? Math.round(conEmail.length * 100 / act.length) : 0}%"></i></div>
      <div class="pn-row"><span>Reciben notificaciones</span><b>${devPubs ? devPubs.size : (P.loading.dev ? '…' : '—')}</b></div>
      ${devPubs && sinAvisos.length ? `<div class="pn-row"><span>Con email pero sin avisos</span><b class="w">${sinAvisos.length}</b></div><div class="pn-ppl" id="pnSinAvisos">${sinAvisos.slice(0, 4).map(p => `<div><span>${esc(p.name)}</span><button type="button" class="pn-wa" data-pn="wa" data-id="${esc(p.id)}">💬 Mandar link</button></div>`).join('')}${sinAvisos.length > 4 ? `<div><span class="pn-muted">y ${sinAvisos.length - 4} más</span></div>` : ''}</div>` : ''}
      <div class="pn-row"><span>Sin asignaciones hace +2 meses</span><b class="${sinAsig.length ? 'w' : ''}">${sinAsig.length}</b></div>
      ${sinAsig.length ? `<div class="pn-names">${esc(sinAsig.slice(0, 6).map(p => p.name).join(' · '))}${sinAsig.length > 6 ? ` y ${sinAsig.length - 6} más` : ''}</div>` : ''}</div>`;
    // Territorios
    if (terr) {
      html += `<div class="pn-c"><h4>Territorios ${go('territorios', 'Ver ›')}</h4>${terr.loaded ? `
        <div class="pn-kpis"><div><b>${terr.st.disponible}</b>Disponibles</div><div><b>${terr.st.asignado}</b>Asignados</div><div><b class="${terr.st.vencido ? 'r' : ''}">${terr.st.vencido}</b>Vencidos</div></div>
        <div class="pn-row"><span>Salidas que quedan esta semana</span><b>${terr.salidas}</b></div>
        <div class="pn-row"><span>Sin conductor</span><b class="${terr.sinConductor.length ? 'w' : ''}">${terr.sinConductor.length ? terr.sinConductor.length + ' · ' + esc(terr.sinConductor.map(x => fmtCorto(x.fecha)).join(', ')) : '0'}</b></div>` : '<p class="pn-muted">Cargando…</p>'}</div>`;
    }
    // Mantenimiento
    if (sal) {
      html += `<div class="pn-c"><h4>Mantenimiento ${go('salon', 'Ver ›')}</h4>${sal.loaded ? `
        <div class="pn-row"><span>Limpia esta semana</span><b>${esc(sal.limpiaEsta || '—')}</b></div>
        <div class="pn-row"><span>Trabajos en 30 días</span><b>${sal.trabajos}</b></div>
        <div class="pn-row"><span>Buscan voluntarios</span><b class="${sal.buscan ? 'w' : ''}">${sal.buscan ? `${sal.buscan} · faltan ${sal.faltan}` : '0'}</b></div>
        <div class="pn-row"><span>Semanas de limpieza sin cargar</span><b class="${sal.vacias ? 'w' : ''}">${sal.hayLimpieza ? sal.vacias : '—'}</b></div>` : '<p class="pn-muted">Cargando…</p>'}</div>`;
    }
    html += `<div class="pn-c"><h4>Ver como un hermano</h4><div class="pn-ver"><span class="ic">👁</span><p>Abrí la vista tal como la ve un hermano: sus asignaciones, su grupo, su limpieza y sus territorios. Solo para mirar: no se cambia nada.</p></div>
      <button type="button" class="btn btn-primary" data-pn="vercomo" style="width:100%;justify-content:center;margin-top:10px">Elegir hermano</button></div>`;
    html += '</div>';
    root.innerHTML = html;
  }

  /* ---------- Ver como un hermano ---------- */
  function vistaComo(pid) {
    const u = new URL('ver/ver.html', location.href);
    if (accessCode) u.searchParams.set('codigo', accessCode);
    u.searchParams.set('como', pid);
    window.open(u.toString(), '_blank', 'noopener');
  }
  window.panelVerComo = vistaComo;
  function elegirHermano() {
    const ov = document.createElement('div');
    ov.className = 'modal-overlay tmodal pn-pick';
    ov.innerHTML = `<div class="modal"><h3>Ver como un hermano</h3><p class="modal-sub" style="margin:0 0 10px;">Se abre la vista con lo que le aparece a él. Solo para mirar: no se puede anotar ni cambiar nada.</p>
      <input type="search" class="tsearch" id="pnQ" placeholder="🔍 Buscar hermano" autocomplete="off"><div class="tlist" id="pnL"></div><div class="tfoot"><button type="button" class="btn" data-x>Cancelar</button></div></div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-x]')) close(); });
    const grupo = (pid) => (window.terrPanel ? window.terrPanel().grupoDe(pid) : '');
    const paint = () => {
      const qn = accNorm(ov.querySelector('#pnQ').value.trim());
      ov.querySelector('#pnL').innerHTML = pubs().filter(p => !qn || accNorm(p.name).includes(qn)).sort((a, b) => a.name.localeCompare(b.name, 'es')).slice(0, 80)
        .map(p => `<button type="button" class="tpick" data-id="${esc(p.id)}"><span>${esc(p.name)}<small>${[grupo(p.id), p.email ? 'email vinculado' : 'sin email (igual se puede ver)'].filter(Boolean).join(' · ')}</small></span><span style="color:var(--accent-gold-text,var(--accent-gold));font-weight:800;font-size:12px;">Ver ›</span></button>`).join('') || '<div class="tempty" style="padding:12px;">Nadie coincide.</div>';
    };
    ov.querySelector('#pnQ').addEventListener('input', paint);
    ov.querySelector('#pnL').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) { close(); vistaComo(b.dataset.id); } });
    paint();
    setTimeout(() => { try { ov.querySelector('#pnQ').focus(); } catch (e) { /* nada */ } }, 50);
  }

  /* ---------- Acciones ---------- */
  function abrirSemana(m, t) {
    currentMonday = m; if (t) currentType = t;
    switchTab('programa');
    try { if (typeof renderRoleCards === 'function') renderRoleCards(); if (typeof renderMonthTable === 'function') renderMonthTable(); if (typeof renderProgramSection === 'function' && currentSubtab === 'programa') renderProgramSection(); } catch (e) { /* nada */ }
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pn]');
    if (!b || !b.closest('#panelRoot, #panelBtn')) return;
    const k = b.dataset.pn;
    if (k === 'vercomo') elegirHermano();
    else if (k === 'sugerir') {
      const pm = currentMonday, pt = currentType;
      currentMonday = b.dataset.m; currentType = b.dataset.t;
      try { autoAssign(); } finally { currentMonday = pm; currentType = pt; }
      refrescar();
    }
    else if (k === 'asignar' || k === 'semana') abrirSemana(b.dataset.m, b.dataset.t);
    else if (k === 'programa') switchTab('programa');
    else if (k === 'solicitudes') { switchTab('ajustes'); setTimeout(() => { const c = $('accReqBox'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120); }
    else if (k === 'terminados') { if (window.terrGoTerminados) window.terrGoTerminados(); }
    else if (k === 'territorios') switchTab('territorios');
    else if (k === 'limpieza') { if (window.salonGoLimpieza) window.salonGoLimpieza(b.dataset.m); }
    else if (k === 'salon') switchTab('salon');
    else if (k === 'ajustes') switchTab('ajustes');
    else if (k === 'errores') { switchTab('ajustes'); setTimeout(() => { const c = $('errLogCard'); if (c) { c.open = true; if (typeof loadErrLog === 'function') loadErrLog(); c.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 120); P.errN = 0; }
    else if (k === 'backup') { switchTab('ajustes'); setTimeout(() => { const c = $('backupCard'); if (c) { c.open = true; c.dispatchEvent(new Event('toggle')); c.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 120); }
    else if (k === 'wa') {
      const p = (data.publishers || []).find(x => x.id === b.dataset.id); if (!p) return;
      const link = (typeof appLinks === 'function' && appLinks().vista) || '';
      const nombre = String(p.name || '').split(' ')[0];
      const msg = `Hola ${nombre}, te paso el link de la vista de la congregación, donde ves tus asignaciones y te llegan los recordatorios: ${link}\nEntrá con tu cuenta de Google (${p.email}) y tocá "Activar avisos" para recibir los recordatorios.`;
      window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    }
    else if (k === 'abrir') switchTab('panel');
  });

  /* ---------- Pestaña, botón en el celular y "Ver como él" en Hermanos ---------- */
  function setup() {
    if (!$('panel-panel')) {
      const sec = document.createElement('section'); sec.className = 'tab-panel hidden'; sec.id = 'panel-panel';
      sec.innerHTML = '<div id="panelRoot"></div>';
      const main = document.querySelector('main.content'); if (main) main.insertBefore(sec, main.firstChild);
    }
    if (!document.querySelector('.tabs .tab-btn[data-tab="panel"]')) {
      const tb = document.createElement('button'); tb.className = 'tab-btn hidden'; tb.dataset.tab = 'panel'; tb.textContent = 'Panel';
      const tabs = document.querySelector('.tabs'); if (tabs) { tabs.insertBefore(tb, tabs.firstChild); tb.addEventListener('click', () => switchTab('panel')); }
    }
    if (!$('panelBtn')) {
      const hb = $('helpBtn');
      if (hb) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'help-btn'; b.id = 'panelBtn'; b.dataset.pn = 'abrir';
        b.setAttribute('aria-label', 'Panel'); b.title = 'Panel';
        b.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>';
        hb.parentNode.insertBefore(b, hb);
        b.addEventListener('click', () => switchTab('panel'));
      }
    }
    // "Ver como él" en la ficha del hermano (pestaña Hermanos)
    const del = $('pubDeleteBtn');
    if (del && !$('pubVerComoBtn')) {
      const v = document.createElement('button'); v.type = 'button'; v.className = 'btn hidden'; v.id = 'pubVerComoBtn'; v.textContent = '👁 Ver como él';
      del.parentNode.insertBefore(v, del.nextSibling);
      v.addEventListener('click', () => { if (pubEditingId) vistaComo(pubEditingId); });
    }
  }
  setup();
  // La ficha del hermano: "Ver como él" solo para el Super Admin conectado a la nube.
  if (typeof openPubModal === 'function') {
    const orig = openPubModal;
    window.openPubModal = function (id) { orig(id); const v = $('pubVerComoBtn'); if (v) v.classList.toggle('hidden', !(id && isSuper() && accessCode)); };
  }
  function updateVisibility() {
    const show = isSuper() && !!currentUser;
    document.querySelectorAll('.tab-btn[data-tab="panel"]').forEach(b => b.classList.toggle('hidden', !show));
    const pb = $('panelBtn'); if (pb) pb.classList.toggle('pn-on', show);
    if (!show && isVisible()) switchTab('programa');
  }
  let primeraVez = true;
  window.panelOnRole = function () {
    updateVisibility();
    if (!isSuper() || !currentUser) return;
    // Al abrir la app, el Super Admin empieza por el Panel (o por donde lo lleve un link: #solicitudes, #terminados…).
    if (primeraVez) {
      primeraVez = false;
      if (!location.hash || location.hash === '#panel') { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* nada */ } switchTab('panel'); }
    }
    refrescar();
  };
  window.panelRender = function () { render(); };
  // Se refresca cuando cambian los datos de la congregación, territorios o mantenimiento.
  setInterval(() => { if (isVisible() && !document.hidden) render(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refrescar(); });
  window.panelRefresh = refrescar;
})();
