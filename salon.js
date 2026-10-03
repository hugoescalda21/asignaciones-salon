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
  .sl-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; }
  .sl-grid > * { min-width: 0; }
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
  .sl-pickbtn { width: 100%; box-sizing: border-box; display: flex; align-items: center; gap: 6px; border: 1px solid var(--line); border-radius: 9px; padding: 9px 10px; font: inherit; font-size: 14px; background: var(--bg); color: var(--ink); text-align: left; cursor: pointer; min-height: 40px; }
  .sl-pickbtn span:first-child { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sl-pickbtn .ph { color: var(--ink-faint, #999); }
  .sl-pickbtn::after { content: '›'; color: var(--ink-soft); font-size: 16px; }
  .sl-pickbtn.filled { font-weight: 600; }
  .sl-chooser .tlist { max-height: 55vh; }
  .sl-chooser .tpick span:last-child:not(:first-child) { color: var(--accent-blue); font-weight: 800; }

  /* Limpieza semana por semana */
  .sl-tg { font-size: 10px; font-weight: 800; border-radius: 8px; padding: 3px 7px; white-space: nowrap; flex-shrink: 0; }
  .sl-tg.fx { background: #DCFCE7; color: #166534; } .sl-tg.sg { background: #EDE9FE; color: #6D28D9; } .sl-tg.ot { background: var(--bg); color: var(--ink-soft); } .sl-tg.no { background: #FEE2E2; color: #B91C1C; } .sl-tg.vac { background: var(--surface); color: var(--ink-soft); box-shadow: inset 0 0 0 1px var(--line); }
  html.dk .sl-tg.fx { background: rgba(34,197,94,.18); color: #86EFAC; } html.dk .sl-tg.sg { background: rgba(139,92,246,.22); color: #C4B5FD; } html.dk .sl-tg.no { background: rgba(239,68,68,.18); color: #FCA5A5; }
  .sl-wk { background: var(--surface); border: 1px solid var(--line); border-radius: 13px; margin-bottom: 7px; overflow: hidden; }
  .sl-wk.sg { border: 1.5px dashed #A78BFA; background: color-mix(in srgb, #8B5CF6 5%, var(--surface)); }
  .sl-wk.vac { border: 1.5px dashed var(--line); }
  .sl-wk.ot .nmrow b { color: var(--ink-soft); }
  .sl-wk.hoy { box-shadow: 0 0 0 2px var(--accent-blue); }
  .sl-wkm { display: flex; gap: 10px; align-items: center; width: 100%; border: none; background: none; padding: 9px 11px; font: inherit; color: var(--ink); text-align: left; cursor: pointer; }
  .sl-wkm .d { width: 46px; flex-shrink: 0; text-align: center; font-size: 9.5px; font-weight: 800; color: var(--ink-soft); line-height: 1.15; }
  .sl-wkm .d b { display: block; font-size: 15px; color: var(--ink); }
  .sl-wkm .tx { flex: 1; min-width: 0; }
  .nmrow { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .nmrow b { font-size: 14.5px; }
  .sl-wk.vac .nmrow b { color: var(--ink-soft); font-weight: 600; }
  .sl-l2 { display: flex; gap: 6px; align-items: center; font-size: 12px; color: var(--ink-soft); margin-top: 3px; flex-wrap: wrap; }
  .sl-l2 i { font-style: normal; font-size: 10px; font-weight: 800; border-radius: 6px; padding: 1px 6px; background: color-mix(in srgb, var(--accent-blue) 14%, transparent); color: var(--accent-blue); }
  .sl-l2 i.o { background: color-mix(in srgb, #0891B2 16%, transparent); color: #0E7490; }
  .sl-l2 b { color: var(--ink); }
  .sl-l2 .ph { color: var(--accent-blue); font-weight: 700; }
  .sl-wkx { border-top: 1px dashed var(--line); padding: 2px 11px 7px 67px; }
  .sl-l2b { width: 100%; border: none; background: none; font: inherit; font-size: 12px; text-align: left; padding: 5px 0 0; cursor: pointer; }
  .sl-undo { display: flex; align-items: center; gap: 10px; background: #0F1B2D; color: #fff; border-radius: 12px; padding: 9px 12px; margin-bottom: 9px; font-size: 13px; }
  .sl-undo span { flex: 1; } .sl-undo button { border: none; background: none; color: #93C5FD; font: inherit; font-weight: 800; cursor: pointer; }
  .sl-lzbtns { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .sl-lzbtns .btn { flex: 1; justify-content: center; min-width: 110px; }
  .sl-lzbtns .btn:disabled { opacity: .5; }
  .sl-lzside { display: none; }
  .sl-st { display: grid; grid-template-columns: 1fr auto; gap: 1px 8px; padding: 8px 0; border-top: 1px solid var(--line); font-size: 13px; }
  .sl-st:first-child { border-top: none; }
  .sl-st span { grid-column: 1; font-size: 11.5px; color: var(--ink-soft); } .sl-st em { grid-column: 2; grid-row: 1 / span 2; align-self: center; font-style: normal; font-size: 11.5px; color: var(--ink-soft); }
  .sl-star { color: var(--accent-blue); font-weight: 800; }
  .sl-back { border: 1px solid var(--line); background: var(--surface); border-radius: 8px; width: 30px; height: 30px; font-size: 17px; color: var(--ink); cursor: pointer; margin-right: 4px; vertical-align: 2px; }
  .sl-lzc { border: 1px solid var(--line); border-radius: 12px; background: var(--surface); padding: 10px 12px; margin-bottom: 8px; }
  .sl-lzc .h { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .sl-lzc .h .btn { padding: 5px 10px; font-size: 12.5px; }
  .sl-lzc > small { display: block; color: var(--ink-soft); font-size: 12px; margin-top: 2px; }
  .sl-sw { display: flex; align-items: center; gap: 10px; border-top: 1px solid var(--line); margin-top: 8px; padding-top: 8px; font-size: 12.5px; cursor: pointer; }
  .sl-sw span { flex: 1; } .sl-sw input { width: 20px; height: 20px; }
  .sl-labs { display: none; }
  /* Computadora: aprovechar el ancho */
  @media (min-width: 900px) {
    .sl-calgrid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); grid-template-rows: min-content 1fr; grid-template-areas: "cal hero" "cal rest"; gap: 0 18px; align-items: start; }
    .sl-calgrid .a-hero { grid-area: hero; } .sl-calgrid .a-cal { grid-area: cal; min-width: 0; } .sl-calgrid .a-rest { grid-area: rest; min-width: 0; }
    .sl-calgrid .sl-d { min-height: 86px; align-items: stretch; justify-content: flex-start; padding: 4px; }
    .sl-calgrid .sl-d b { align-self: flex-end; }
    .sl-calgrid .sl-dots { display: none; }
    .sl-calgrid .sl-labs { display: flex; flex-direction: column; gap: 2px; width: 100%; min-width: 0; overflow: hidden; }
    .sl-labs em { display: block; max-width: 100%; box-sizing: border-box; font-style: normal; font-size: 10.5px; line-height: 1.25; text-align: left; padding: 2px 4px; border-radius: 5px; border-left: 3px solid var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sl-labs em.lz { color: var(--ink-soft); }
    .sl-calgrid .sl-d .lb { display: none; }
    .sl-lzwrap { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 18px; align-items: start; }
    .sl-lzside { display: block; position: sticky; top: 12px; }
    .sl-wkm { padding: 11px 14px; }
    .sl-wkm .tx { display: grid; grid-template-columns: minmax(0, 1fr); }
    .sl-ajgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 22px; align-items: start; }
    #salonView .sl-ev { margin-bottom: 8px; }
  }
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
    setTimeout(() => { queued = false; if (isVisible()) render(); if (openDetail) openDetail.refresh(); if (window.panelRefresh) window.panelRefresh(); }, 0);
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
    document.querySelectorAll('.tab-btn[data-tab]').forEach(b => { if (b.dataset.tab !== 'panel') b.classList.toggle('hidden', b.dataset.tab !== 'salon'); });
    ['navAnunciosBtn', 'navAnunciosBtnMobile'].forEach(id => { const el = $(id); if (el && !(typeof canManageAnuncios === 'function' && canManageAnuncios())) el.classList.add('hidden'); });
    const tb = $('narrowThemeBtn'); if (tb) tb.classList.remove('hidden');
    const bb = $('backupBanner'); if (bb) bb.remove();
    const active = document.querySelector('.tab-btn.active');
    if (!active || (active.dataset.tab !== 'salon' && active.dataset.tab !== 'panel')) switchTab('salon');
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
    // Escape cierra solo la ventana de arriba (el buscador sin cerrar el formulario de abajo).
    const onKey = (e) => { if (e.key === 'Escape' && [...document.querySelectorAll('.slmodal')].pop() === ov) close(); };
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
  function renderCal(v) {
    const today = hoy();
    if (!S.month) S.month = today.slice(0, 7);
    const mon = C.mondayOf(today);
    const semana = C.trabajosEntre(S.trabajos, mon, C.addDays(mon, 6)).filter(o => !o.cancelada);
    const lz = limpiezaDe(mon);
    let html = '<div class="sl-calgrid"><div class="a-hero">';
    // Esta semana
    const first = semana.find(o => o.estado !== 'hecho');
    if (first || lz) {
      const t = first && first.t;
      const ci = first ? C.cupoInfo(t, first.fecha, S.anotados) : null;
      html += `<div class="sl-hero"><small>Esta semana</small>${first ? `<b>${tipoOf(t).icon} ${esc(t.titulo)}</b><p>${esc(fmtCorto(first.fecha))}${t.hora ? ' · ' + esc(t.hora) : ''} · Resp. ${esc(apellido(t.resp, '', t) || '—')}, aux. ${esc(apellido(t.aux, '', t) || '—')}${ci.cupo ? (ci.faltan ? ` · faltan ${ci.faltan} voluntarios` : ' · completo') : ''}</p>${semana.length > 1 ? `<p>y ${semana.length - 1} ${semana.length === 2 ? 'trabajo más' : 'trabajos más'}</p>` : ''}` : '<b>Sin trabajos programados</b>'}
        ${lz ? `<div class="sl-hl">🧹 Limpieza: <b style="display:inline;font-size:inherit;">${esc(lz.nombre)}</b> · ${lz.dias.map(fmtCorto).reduce((t, x, i, a) => t + (i === 0 ? '' : i === a.length - 1 ? ' y ' : ', ') + x, '')}</div>` : ''}</div>`;
    }
    html += '</div><div class="a-cal">';
    // Mes
    const [y, m] = S.month.split('-').map(Number);
    const firstDay = `${S.month}-01`;
    const gridStart = C.mondayOf(firstDay);
    const lastDay = C.isoOf(new Date(y, m, 0, 12));
    const gridEnd = C.addDays(C.mondayOf(lastDay), 6);
    const occ = C.trabajosEntre(S.trabajos, gridStart, gridEnd).filter(o => !o.cancelada);
    const limpiezaDias = {}, limpiezaNombre = {};
    for (let w = gridStart; w <= gridEnd; w = C.addDays(w, 7)) { const l = limpiezaDe(w); if (l) l.dias.forEach(f => { limpiezaDias[f] = l.colorDe(f); limpiezaNombre[f] = l.ls.filter(x => x.dias.includes(f)).map(x => nombreQuien(x.quien)).filter((x, k, a) => a.indexOf(x) === k).join(' y '); }); }
    html += `<div class="sl-mnav"><button type="button" data-s="mes" data-d="-1" aria-label="Mes anterior">‹</button><span class="lbl">${MESES[m - 1]} ${y}</span><button type="button" data-s="mes" data-d="1" aria-label="Mes siguiente">›</button></div>`;
    html += '<div class="sl-cal"><div class="sl-grid">' + ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<span class="h">${x}</span>`).join('');
    for (let f = gridStart; f <= gridEnd; f = C.addDays(f, 1)) {
      const dots = occ.filter(o => o.fecha === f).slice(0, 3).map(o => `<i style="background:${tipoOf(o.t).color}"></i>`).join('');
      // En la computadora, además de los puntitos, el nombre de cada trabajo y de la limpieza.
      const labs = occ.filter(o => o.fecha === f).slice(0, 3).map(o => `<em style="--c:${tipoOf(o.t).color}" title="${esc(o.t.titulo)}">${esc(o.t.titulo)}</em>`).join('') + (limpiezaNombre[f] ? `<em class="lz" style="--c:${limpiezaDias[f]}">🧹 ${esc(limpiezaNombre[f])}</em>` : '');
      html += `<button type="button" class="sl-d${f.slice(0, 7) !== S.month ? ' out' : ''}${f === today ? ' hoy' : ''}${f === S.day ? ' sel' : ''}" data-s="day" data-f="${f}"><b>${Number(f.slice(8))}</b><span class="sl-dots">${dots}</span><span class="sl-labs">${labs}</span>${limpiezaDias[f] ? `<span class="lb" style="background:${limpiezaDias[f]}"></span>` : ''}</button>`;
    }
    html += '</div><div class="sl-leg">' + Object.values(C.TIPOS).map(tp => `<span><i style="background:${tp.color}"></i>${tp.label}</span>`).join('') + `<span><i class="bar" style="background:${LIMPIEZA_COLOR}"></i>Limpieza</span>${(S.limpieza.otra || []).length ? `<span><i class="bar" style="background:${OTRA_COLOR}"></i>${esc(otraLabel())}</span>` : ''}</div></div>`;
    html += '</div><div class="a-rest">';
    // Día elegido o próximos
    if (S.day) {
      const del = C.trabajosEntre(S.trabajos, S.day, S.day);
      const l = limpiezaDe(C.mondayOf(S.day));
      const lz2 = l && l.dias.includes(S.day) ? l.ls.filter(x => x.dias.includes(S.day)).map(x => `<div class="tnote">🧹 ${esc(x.tipo.nombre)}: <b>${esc(nombreQuien(x.quien))}</b>${x.tipo.modo === 'semana' && x.tipo.hora ? ' · ' + esc(x.tipo.hora) : ''}</div>`).join('') : '';
      html += `<div class="sl-sec"><h4>${esc(fmtDia(S.day))}</h4><button type="button" class="btn" data-s="new" data-f="${S.day}">+ Trabajo este día</button></div>${lz2}` + (del.length ? del.map(evRow).join('') : (lz2 ? '' : '<div class="tempty" style="padding:10px;">Nada programado este día.</div>'));
    }
    // Próximos: la siguiente vez de cada trabajo (los que se repiten no llenan la lista).
    const vistos = new Set();
    const prox = C.trabajosEntre(S.trabajos, today, C.addDays(today, 120)).filter(o => !o.cancelada && o.estado !== 'hecho' && !vistos.has(o.t.id) && vistos.add(o.t.id)).slice(0, 8);
    html += `<div class="sl-sec"><h4>Próximos trabajos</h4><button type="button" class="btn btn-primary" data-s="new">+ Trabajo</button></div>`;
    html += prox.length ? prox.map(evRow).join('') : '<div class="tempty">Todavía no hay trabajos programados.<br>Con "+ Trabajo" cargás qué hay que hacer, el día, el responsable y el auxiliar. Si se repite (el corte de pasto, por ejemplo), aparece solo en el calendario.</div>';
    html += '</div></div>';
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
  function openForm(id, fechaDefault) {
    const t = id ? S.trabajos[id] : null;
    const f = t ? Object.assign({}, t) : { tipo: 'pintura', fecha: fechaDefault || C.addDays(hoy(), 7), hora: '09:00', cupo: 0, repite: 'no', materiales: [], vista: true };
    const m = openModal(`<h3>${t ? 'Editar trabajo' : 'Nuevo trabajo'}</h3>
      <div class="tf"><label for="slTit">Qué hay que hacer</label><input id="slTit" maxlength="80" placeholder="Ej.: Pintura de la entrada" value="${esc(f.titulo || '')}"></div>
      <div class="tf"><span class="tlbl">Tipo</span><div class="sl-types" id="slTipo">${Object.entries(C.TIPOS).map(([k, tp]) => `<button type="button" data-k="${k}" class="${f.tipo === k ? 'on' : ''}" style="${f.tipo === k ? 'background:' + tp.color : ''}">${tp.icon} ${tp.label}</button>`).join('')}</div></div>
      <div class="trow2"><div class="tf"><label for="slFec">Día</label><input type="date" id="slFec" value="${esc(f.fecha)}"></div><div class="tf"><label for="slHora">Hora</label><input type="time" id="slHora" value="${esc(f.hora || '')}"></div></div>
      <div class="trow2"><div class="tf"><label for="slRespBtn">Responsable <span class="sl-req">*</span></label><button type="button" class="sl-pickbtn" id="slRespBtn" data-for="slResp"></button><input type="hidden" id="slResp" value="${esc(f.resp || '')}"></div><div class="tf"><label for="slAuxBtn">Auxiliar <span class="sl-req">*</span></label><button type="button" class="sl-pickbtn" id="slAuxBtn" data-for="slAux"></button><input type="hidden" id="slAux" value="${esc(f.aux || '')}"></div></div>
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
    const pintarBtn = (sid) => {
      const v = m.q('#' + sid).value, b = m.q('#' + sid + 'Btn');
      b.innerHTML = v ? `<span>${esc(pubName(v, t))}</span>${congTag(v, t)}` : '<span class="ph">Elegí…</span>';
      b.classList.toggle('filled', !!v);
    };
    ['slResp', 'slAux'].forEach(sid => {
      pintarBtn(sid);
      m.q('#' + sid + 'Btn').addEventListener('click', () => {
        const otro = m.q('#' + (sid === 'slResp' ? 'slAux' : 'slResp')).value;
        choosePub(sid === 'slResp' ? 'Elegí el responsable' : 'Elegí el auxiliar', { current: m.q('#' + sid).value, exclude: new Set(otro ? [otro] : []) }, (pid) => { m.q('#' + sid).value = pid; pintarBtn(sid); m.q('#slErr').textContent = ''; });
      });
    });
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
  // Ventana para elegir un hermano: buscador y dos pestañas (esta congregación y la otra del Salón compartido).
  function choosePub(title, opts, onPick) {
    const excl = opts.exclude || new Set();
    let tab = opts.current && isExt(opts.current) ? 'otra' : 'cong';
    const cong = (data.settings && data.settings.congregationName) || 'Congregación';
    const m = openModal(`<h3>${esc(title)}</h3><div class="sl-seg" id="slSeg"><button type="button" data-k="cong">${esc(cong)}</button><button type="button" data-k="otra">${esc(otraLabel())}</button></div><input type="search" class="tsearch" id="slQ" placeholder="🔍 Buscar hermano" autocomplete="off"><div class="tlist" id="slL"></div><div class="tfoot">${opts.current ? '<button type="button" class="btn" id="slQuitar">Quitar</button>' : ''}<button type="button" class="btn" data-tclose>Cancelar</button></div>`, { cls: 'sl-chooser' });
    const mark = (id) => id === opts.current ? ' on' : '';
    const paint = () => {
      const qn = accNorm(m.q('#slQ').value.trim());
      m.qa('#slSeg button').forEach(b => b.classList.toggle('on', b.dataset.k === tab));
      if (tab === 'cong') {
        m.q('#slL').innerHTML = pubs().filter(p => !excl.has(p.id) && (!qn || accNorm(p.name).includes(qn))).sort((a, b) => a.name.localeCompare(b.name, 'es')).map(p => `<button type="button" class="tpick${mark(p.id)}" data-id="${esc(p.id)}">${esc(p.name)}${p.id === opts.current ? ' <span>✓</span>' : ''}</button>`).join('') || '<div class="tempty" style="padding:12px;">Nadie coincide.</div>';
      } else {
        m.q('#slL').innerHTML = extList().filter(x => !excl.has('x:' + x.id) && (!qn || accNorm(x.nombre).includes(qn))).map(x => `<button type="button" class="tpick${mark('x:' + x.id)}" data-id="x:${esc(x.id)}"><span>${esc(x.nombre)}<small>${x.cong ? 'Cong. ' + esc(x.cong) : 'Otra congregación'}${x.tel ? ' · 📱 ' + esc(x.tel) : ''}</small></span>${'x:' + x.id === opts.current ? '<span>✓</span>' : ''}</button>`).join('') +
          `<button type="button" class="tpick" data-new="1" style="color:var(--accent-blue);font-weight:700;">＋ Agregar un hermano de ${esc(otraNombre() || 'la otra congregación')}</button>`;
      }
    };
    m.q('#slSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { tab = b.dataset.k; paint(); m.q('#slQ').focus(); } });
    m.q('#slQ').addEventListener('input', paint);
    m.q('#slL').addEventListener('click', (e) => {
      const b = e.target.closest('.tpick'); if (!b) return;
      if (b.dataset.new) { openExterno(null, (xid) => { m.close(); onPick('x:' + xid); }); return; }
      m.close(); onPick(b.dataset.id);
    });
    const q = m.q('#slQuitar'); if (q) q.addEventListener('click', () => { m.close(); onPick(''); });
    paint();
    setTimeout(() => { try { m.q('#slQ').focus(); } catch (e) { /* nada */ } }, 50);
  }
  function pickPub(t, fecha) {
    const ya = new Set(C.voluntarios(t, fecha, S.anotados).map(v => v.pubId).concat([t.resp, t.aux]));
    choosePub('Agregar un hermano', { exclude: ya }, async (pid) => {
      if (!pid) return;
      const vols = ((((t.ocurr || {})[fecha]) || {}).vols || []).concat(pid);
      t.ocurr = t.ocurr || {}; t.ocurr[fecha] = Object.assign({}, t.ocurr[fecha] || {}, { vols });
      const refs = extRefs(t); t.externos = refs;
      if (await safe(() => sWrite(sRef('trabajos'), [[occPath(t, fecha, 'vols'), vols], [['lista', t.id, 'externos'], refs]]), 'Agregado')) { if (openDetail) openDetail.refresh(); render(); }
    });
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
     Cada semana se carga a mano (o con "Sugerir") qué grupo limpia. Puede haber varias
     limpiezas (después de las reuniones, la general…): las que van "con el mismo grupo"
     las hace el grupo de la principal; las otras tienen su propio grupo cada semana.
     ===================================================================== */
  // Guarda campos del documento de la limpieza (rutas como listas) y los aplica también en memoria.
  function setLocal(obj, path, v) { let o = obj; path.slice(0, -1).forEach(k => { o = o[k] = (o[k] && typeof o[k] === 'object') ? o[k] : {}; }); if (v === undefined) delete o[path[path.length - 1]]; else o[path[path.length - 1]] = v; }
  function saveLimpieza(pairs, msg) { return safe(() => sWrite(sRef('limpieza'), pairs), msg).then(ok => { if (ok) pairs.forEach(([p, v]) => setLocal(S.limpieza, p, v === undefined ? undefined : JSON.parse(JSON.stringify(v)))); render(); return ok; }); }
  const tipos = () => C.tiposLimpieza(S.limpieza);
  const cortoDe = (t) => t.modo === 'reunion' ? 'Reuniones' : (String(t.nombre || 'Semanal').replace(/^limpieza\s+/i, '').replace(/^./, c => c.toUpperCase()));
  const nombreQuien = (q) => !q ? '' : q.g === 'otra' ? otraLabel() : q.g === 'nadie' ? 'Sin limpieza' : grupoName(q.g);
  const gruposIds = () => Object.values(S.grupos).filter(g => g && g.id).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { numeric: true })).map(g => g.id);
  // Claves que se cargan por separado: 'g' (la principal y las que van con ella) y cada limpieza con su propio grupo.
  const claves = () => ['g'].concat(tipos().filter(t => C.claveDe(S.limpieza, t.id) !== 'g').map(t => t.id));
  // Lunes de las semanas de un mes (las que tienen el jueves en ese mes, como "Semana 1 … 5").
  function semanasDelMes(ym) {
    const out = [];
    for (let m = C.mondayOf(ym + '-01'); m <= ym + '-31'; m = C.addDays(m, 7)) if (C.semanaDelMes(m).mes === ym) out.push(m);
    if (!out.length || C.semanaDelMes(C.mondayOf(ym + '-01')).mes !== ym) { /* el primer lunes es del mes anterior: ya se filtró por el jueves */ }
    return out;
  }
  const mesLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MESES[m - 1]} ${y}`; };
  const shiftYm = (ym, n) => { const [y, m] = ym.split('-').map(Number); return C.isoOf(new Date(y, m - 1 + n, 1, 12)).slice(0, 7); };
  const fmtSem = (m) => `${Number(m.slice(8))}/${Number(m.slice(5, 7))}`;
  function tagDe(q) {
    if (!q) return '<span class="sl-tg vac">Sin cargar</span>';
    if (q.g === 'otra') return '<span class="sl-tg ot">Compartido</span>';
    if (q.g === 'nadie') return '<span class="sl-tg no">Sin limpieza</span>';
    return q.s ? '<span class="sl-tg sg">✨ Sugerido</span>' : '<span class="sl-tg fx">✓ Cargado</span>';
  }
  // Lo que se ve en el calendario y en "Esta semana": quién limpia y qué días.
  function limpiezaDe(monday) {
    const ls = C.limpiezasSemana(S.limpieza, monday, data.settings).filter(l => l.quien && l.quien.g !== 'nadie');
    if (!ls.length) return null;
    const nombres = [...new Set(ls.map(l => nombreQuien(l.quien)))];
    const dias = [...new Set([].concat(...ls.map(l => l.dias)))].sort();
    return { ls, nombre: nombres.join(' y '), dias, otra: ls.every(l => l.quien.g === 'otra'), colorDe: (f) => { const l = ls.find(x => x.dias.includes(f)); return l ? (l.quien.g === 'otra' ? OTRA_COLOR : LIMPIEZA_COLOR) : null; } };
  }
  function renderLimpieza(v) {
    if (S.lAjustes) { renderLimpAjustes(v); return; }
    const L = S.limpieza || {};
    if (!S.lMonth) S.lMonth = C.semanaDelMes(C.mondayOf(hoy())).mes;
    let html = `<div class="thead"><h3>Limpieza por grupos</h3><button type="button" class="btn" data-s="lz-ajustes">⚙ Ajustes</button></div>`;
    if (!Object.keys(S.grupos).length) {
      v.innerHTML = html + '<div class="tempty">Primero hay que crear los grupos en <b>Territorios → Grupos</b>. La limpieza se reparte entre esos grupos.</div>';
      return;
    }
    const ts = tipos(), ks = claves();
    const semanas = semanasDelMes(S.lMonth);
    const hoyM = C.mondayOf(hoy());
    html += `<div class="sl-mnav"><button type="button" data-s="lz-mes" data-d="-1" aria-label="Mes anterior">‹</button><span class="lbl">${mesLabel(S.lMonth)}</span><button type="button" data-s="lz-mes" data-d="1" aria-label="Mes siguiente">›</button></div>`;
    if (S.undo && S.undo.month === S.lMonth) html += `<div class="sl-undo"><span>${esc(S.undo.msg)}</span><button type="button" data-s="lz-undo">Deshacer</button></div>`;
    const rows = semanas.map(m => {
      const ls = C.limpiezasSemana(L, m, data.settings);
      const qg = C.quienLimpia(L, m, 'g');
      const conG = ls.filter(l => l.clave === 'g'), solos = ls.filter(l => l.clave !== 'g');
      const lineas = conG.map(l => `<span class="sl-l2"><i>${esc(cortoDe(l.tipo))}</i>${qg && (qg.g === 'otra' || qg.g === 'nadie') ? '' : esc(l.dias.map(fmtCorto).reduce((t, x, i, a) => t + (i === 0 ? '' : i === a.length - 1 ? ' y ' : ', ') + x, ''))}${l.tipo.modo === 'semana' && l.tipo.hora && qg && qg.g !== 'otra' && qg.g !== 'nadie' ? ' · ' + esc(l.tipo.hora) : ''}</span>`).join('');
      const extra = solos.map(l => `<button type="button" class="sl-l2 sl-l2b" data-s="lz-pick" data-m="${m}" data-k="${esc(l.clave)}"><i class="o">${esc(cortoDe(l.tipo))}</i><b>${l.quien ? esc(nombreQuien(l.quien)) : '<span class="ph">Sin cargar · Elegir</span>'}</b>${l.quien && l.quien.g !== 'otra' && l.quien.g !== 'nadie' ? ' · ' + esc(l.dias.map(fmtCorto).reduce((t, x, i, a) => t + (i === 0 ? '' : i === a.length - 1 ? ' y ' : ', ') + x, '')) + (l.tipo.hora ? ' · ' + esc(l.tipo.hora) : '') : ''}${l.quien && l.quien.s ? ' <span class="sl-tg sg">✨</span>' : ''}</button>`).join('');
      const cls = !qg ? ' vac' : qg.g === 'otra' || qg.g === 'nadie' ? ' ot' : qg.s ? ' sg' : '';
      return `<div class="sl-wk${cls}${m === hoyM ? ' hoy' : ''}" id="lz-${m}"><button type="button" class="sl-wkm" data-s="lz-pick" data-m="${m}" data-k="g"><span class="d">${m === hoyM ? 'ESTA' : 'SEM'}<b>${fmtSem(m)}</b></span><span class="tx"><span class="nmrow"><b>${qg ? esc(nombreQuien(qg)) : 'Sin cargar'}</b>${tagDe(qg)}</span>${lineas}</span></button>${extra ? `<div class="sl-wkx">${extra}</div>` : ''}</div>`;
    }).join('');
    const vacias = semanas.reduce((n, m) => n + ks.filter(k => !C.quienLimpia(L, m, k)).length, 0);
    const stats = gruposIds().map(g => {
      const ult = C.ultimaVez(L, g, 'g', C.addDays(hoyM, 7));
      let n = 0; Object.keys(L.semanas || {}).forEach(m => { if (m >= C.addDays(hoyM, -84) && m <= hoyM) ks.forEach(k => { const q = C.cargado(L, m, k); if (q && q.g === g) n++; }); });
      return `<div class="sl-st"><b>${esc(grupoName(g))}</b><span>${ult ? `Última: sem. ${fmtSem(ult)}` : 'Todavía no limpió'}</span><em>${n} en 3 meses</em></div>`;
    }).join('');
    html += `<div class="sl-lzwrap"><div class="sl-lzmain">${rows}
      <div class="sl-lzbtns"><button type="button" class="btn btn-primary" data-s="lz-sug"${vacias ? '' : ' disabled'}>✨ Sugerir${vacias ? ` las vacías (${vacias})` : ''}</button><button type="button" class="btn" data-s="lz-copy">Copiar ${MESES[Number(shiftYm(S.lMonth, -1).slice(5)) - 1]}</button><button type="button" class="btn" data-s="lz-pdf">📄 Compartir</button></div>
      <p class="hint" style="margin:8px 2px 0;">Tocá una semana para elegir el grupo. Lo que cargás a mano no lo cambia "Sugerir".</p></div>
      <aside class="sl-lzside"><div class="sl-sec" style="margin-top:0;"><h4>Grupos</h4></div><div class="sl-box">${stats}</div>
      <div class="sl-sec"><h4>Limpiezas</h4></div><div class="sl-box">${ts.map(t => `<div class="sl-st"><b>${esc(t.nombre)}</b><span>${esc(t.modo === 'reunion' ? 'Después de cada reunión' : DIAS[t.dia != null ? t.dia : 6] + (t.hora ? ' · ' + t.hora : ''))}</span><em>${C.claveDe(L, t.id) === 'g' ? (t === ts[0] ? 'Principal' : 'Mismo grupo') : 'Su propio grupo'}</em></div>`).join('')}</div></aside></div>`;
    v.innerHTML = html;
  }
  // Elegir quién limpia una semana (con esa clave).
  function pickSemana(m, clave) {
    const L = S.limpieza || {};
    const ls = C.limpiezasSemana(L, m, data.settings).filter(l => l.clave === clave);
    const actual = C.cargado(L, m, clave);
    const w = (L.semanas || {})[m] || {};
    const otrasClaves = claves().filter(k => k !== clave).map(k => C.cargado(L, m, k)).filter(Boolean).map(q => q.g);
    const ord = C.ordenSugerido(L, gruposIds(), clave, m);
    const sug = (ord.find(o => !otrasClaves.includes(o.g)) || ord[0] || {}).g;
    const hace = (ult) => { if (!ult) return 'Todavía no limpió'; const n = Math.round((new Date(m + 'T12:00:00') - new Date(ult + 'T12:00:00')) / 604800000); return n <= 0 ? 'Ya limpia más adelante' : `Limpió hace ${n} ${n === 1 ? 'semana' : 'semanas'}`; };
    const titulo = clave === 'g' ? `Semana del ${Number(m.slice(8))} de ${MESES[Number(m.slice(5, 7)) - 1]}` : `${ls[0] ? ls[0].tipo.nombre : 'Limpieza'} · semana del ${fmtSem(m)}`;
    const sub = ls.map(l => `${l.tipo.nombre}: ${l.dias.map(fmtCorto).reduce((t, x, i, a) => t + (i === 0 ? '' : i === a.length - 1 ? ' y ' : ', ') + x, '')}${l.tipo.modo === 'semana' && l.tipo.hora ? ' · ' + l.tipo.hora : ''}`).join(' · ');
    const opt = (val, nm, small, on, star) => `<button type="button" class="tpick${on ? ' on' : ''}" data-v="${esc(val)}"><span>${nm}<small>${small}</small></span>${star ? '<span class="sl-star">✨</span>' : on ? '<span class="sl-star">✓</span>' : ''}</button>`;
    const md = openModal(`<h3>${esc(titulo)}</h3><p class="modal-sub" style="margin:0 0 10px;">${esc(sub)}</p>
      <span class="tlbl">Grupos</span><div class="sl-box" style="padding:0 8px;">${ord.map(o => opt(o.g, esc(grupoName(o.g)), hace(o.ult) + (otrasClaves.includes(o.g) ? ' · ya tiene otra limpieza esta semana' : '') + (o.g === sug ? ' · sugerido' : ''), actual && actual.g === o.g, o.g === sug && !(actual && actual.g === o.g))).join('')}</div>
      <div class="sl-box" style="padding:0 8px;">${opt('otra', esc(otraLabel()), 'La otra congregación del Salón', actual && actual.g === 'otra')}${opt('nadie', 'Sin limpieza', 'Asamblea, semana sin reunión…', actual && actual.g === 'nadie')}</div>
      <div class="tfoot">${actual ? '<button type="button" class="btn" id="lzBorrar">Dejar sin cargar</button>' : ''}<button type="button" class="btn" id="lzDias">🗓 Días de esta semana</button><button type="button" class="btn" data-tclose>Cancelar</button></div>`, { cls: 'sl-chooser' });
    const guardar = (val) => {
      const path = clave === 'g' ? ['semanas', m] : ['semanas', m, 'x', clave];
      const nv = clave === 'g' ? Object.assign({}, w, { g: val }) : { g: val };
      if (clave === 'g') delete nv.s;
      md.close(); S.undo = null;
      saveLimpieza([[path, val ? nv : (clave === 'g' ? (() => { const r = Object.assign({}, w); delete r.g; delete r.s; return Object.keys(r).length ? r : undefined; })() : undefined)]], val ? 'Guardado' : 'Semana sin cargar');
    };
    md.el.addEventListener('click', (e) => { const b = e.target.closest('.tpick[data-v]'); if (b) guardar(b.dataset.v); });
    const bb = md.q('#lzBorrar'); if (bb) bb.addEventListener('click', () => guardar(''));
    md.q('#lzDias').addEventListener('click', () => { md.close(); diasSemana(m, ls.map(l => l.tipo)); });
  }
  // Cambiar los días de las limpiezas solo esa semana.
  function diasSemana(m, ts) {
    const L = S.limpieza || {};
    const md = openModal(`<h3>Días de la semana del ${fmtSem(m)}</h3><p class="modal-sub" style="margin:0 0 10px;">Solo para esta semana (por ejemplo, si hay asamblea o se cambia la reunión).</p>
      ${ts.map(t => { const d = C.diasDe(L, m, t, data.settings); const n = t.modo === 'reunion' ? 2 : 1; return `<div class="tf"><span class="tlbl">${esc(t.nombre)}</span><div class="trow2">${Array.from({ length: n }, (_, i) => `<input type="date" data-t="${esc(t.id)}" value="${esc(d[i] || '')}" min="${m}" max="${C.addDays(m, 6)}">`).join('')}</div></div>`; }).join('')}
      <div class="tfoot"><button type="button" class="btn" id="lzDef">Volver a los de siempre</button><button type="button" class="btn" data-tclose>Cancelar</button><button type="button" class="btn btn-primary" id="lzDok">Guardar</button></div>`);
    const save = (def) => {
      const pairs = ts.map(t => { const vals = [...md.qa(`input[data-t="${t.id}"]`)].map(x => x.value).filter(Boolean).sort(); const std = C.diasLimpieza({ modo: t.modo, dia: t.dia }, m, data.settings); return [['semanas', m, 'd', t.id], def || !vals.length || JSON.stringify(vals) === JSON.stringify(std) ? undefined : vals]; });
      md.close(); saveLimpieza(pairs, def ? 'Días de siempre' : 'Días guardados');
    };
    md.q('#lzDok').addEventListener('click', () => save(false));
    md.q('#lzDef').addEventListener('click', () => save(true));
  }
  function sugerirMes() {
    const L = S.limpieza || {};
    const sem = semanasDelMes(S.lMonth);
    const r = C.sugerir(L, gruposIds(), sem[0], sem[sem.length - 1], claves());
    if (!r.n) { showToast('No hay semanas vacías este mes'); return; }
    const prev = L.semanas ? JSON.parse(JSON.stringify(L.semanas)) : null;
    saveLimpieza([[['semanas'], r.semanas]], null).then(ok => { if (ok) { S.undo = { month: S.lMonth, prev, msg: `Se completaron ${r.n} ${r.n === 1 ? 'semana' : 'semanas'}` }; render(); } });
  }
  function copiarMesAnterior() {
    const L = S.limpieza || {};
    const ant = semanasDelMes(shiftYm(S.lMonth, -1)), act = semanasDelMes(S.lMonth);
    const nuevas = JSON.parse(JSON.stringify(L.semanas || {}));
    let n = 0;
    act.forEach((m, i) => {
      const src = ant[i]; if (!src) return;
      claves().forEach(k => {
        if (C.cargado(L, m, k) || C.esOtra(L, m)) return;
        const q = C.cargado(L, src, k); if (!q) return;
        const w = nuevas[m] = nuevas[m] || {};
        if (k === 'g') { w.g = q.g; w.s = true; } else { w.x = w.x || {}; w.x[k] = { g: q.g, s: true }; }
        n++;
      });
    });
    if (!n) { showToast('No hay nada para copiar (o este mes ya está completo)'); return; }
    const prev = L.semanas ? JSON.parse(JSON.stringify(L.semanas)) : null;
    saveLimpieza([[['semanas'], nuevas]], null).then(ok => { if (ok) { S.undo = { month: S.lMonth, prev, msg: `Se copiaron ${n} ${n === 1 ? 'semana' : 'semanas'}` }; render(); } });
  }
  function deshacer() {
    const u = S.undo; if (!u) return;
    S.undo = null;
    saveLimpieza([[['semanas'], u.prev || undefined]], 'Listo, se deshizo');
  }

  /* ---------- Compartir en PDF ---------- */
  function openPdf() {
    const m = openModal(`<h3>Compartir la limpieza</h3><p class="modal-sub" style="margin:0 0 10px;">Un PDF para mandar por WhatsApp o imprimir, desde ${esc(mesLabel(S.lMonth))}.</p>
      <div class="tf"><span class="tlbl">Período</span><div class="topts" id="pdfMeses"><button type="button" data-k="1">Este mes</button><button type="button" data-k="2" class="on">2 meses</button><button type="button" data-k="3">3 meses</button></div></div>
      <div class="tf"><span class="tlbl">Incluir</span>
        <label class="tchk"><input type="checkbox" id="pdfL" checked><span>Limpieza <small>· semana, días y grupo</small></span></label>
        <label class="tchk"><input type="checkbox" id="pdfT"><span>Trabajos del Salón <small>· fecha, qué se hace, responsable y auxiliar</small></span></label>
        <label class="tchk"><input type="checkbox" id="pdfR" checked><span>Tareas de cada limpieza <small>· al pie, para el tablero</small></span></label></div>
      <div class="tfoot"><button type="button" class="btn" data-tclose>Cancelar</button><button type="button" class="btn btn-primary" id="pdfOk">Compartir PDF</button></div>`);
    let meses = 2;
    m.q('#pdfMeses').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; meses = Number(b.dataset.k); m.qa('#pdfMeses button').forEach(x => x.classList.toggle('on', x === b)); });
    m.q('#pdfOk').addEventListener('click', async () => {
      const opts = { meses, limpieza: m.q('#pdfL').checked, trabajos: m.q('#pdfT').checked, tareas: m.q('#pdfR').checked };
      if (!opts.limpieza && !opts.trabajos) { showToast('Elegí qué incluir'); return; }
      m.close();
      const sem = []; for (let i = 0; i < meses; i++) sem.push(...semanasDelMes(shiftYm(S.lMonth, i)));
      const faltan = sem.reduce((n, w) => n + claves().filter(k => !C.quienLimpia(S.limpieza, w, k)).length, 0);
      if (opts.limpieza && faltan && confirm(`Faltan ${faltan} ${faltan === 1 ? 'semana' : 'semanas'} sin cargar. ¿Las sugiero antes de armar el PDF?`)) {
        const r = C.sugerir(S.limpieza, gruposIds(), sem[0], sem[sem.length - 1], claves());
        if (r.n) await saveLimpieza([[['semanas'], r.semanas]], null);
      }
      await limpiezaPdf(sem, opts);
    });
  }
  async function limpiezaPdf(sem, opts) {
    if (!window.jspdf) { showToast('No se pudo cargar el generador de PDF (revisá tu conexión)'); return; }
    const L = S.limpieza || {};
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const cong = (data.settings && data.settings.congregationName) || 'Congregación';
    const ts = tipos(), ks = claves();
    const desde = sem[0], hasta = C.addDays(sem[sem.length - 1], 6);
    const meses = [...new Set(sem.map(x => C.semanaDelMes(x).mes))].map(mesLabel);
    doc.setFillColor(15, 27, 45); doc.rect(0, 0, W, 66, 'F');
    doc.setFillColor(37, 99, 235); doc.rect(0, 66, W, 3, 'F');
    doc.setTextColor(147, 197, 253); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(`SALÓN DEL REINO — ${cong.toUpperCase()}`, 32, 24);
    doc.setTextColor(255, 255, 255); doc.setFontSize(17);
    doc.text(opts.limpieza ? 'Limpieza del Salón' : 'Trabajos del Salón', 32, 46);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(203, 213, 225);
    doc.text(meses.length > 1 ? `${meses.slice(0, -1).join(', ')} y ${meses[meses.length - 1]}` : meses[0], 32, 60);
    let y = 86;
    const dd = (arr) => arr.map(fmtCorto).join(' · ');
    if (opts.limpieza) {
      const head = ['Semana'].concat(ts.map(t => t.nombre + (t.modo === 'semana' && t.hora ? ` (${t.hora})` : ''))).concat(ks.map(k => k === 'g' ? (ks.length > 1 ? `Limpia (${cortoDe(ts[0])})` : 'Limpia') : `Limpia (${cortoDe(ts.find(t => t.id === k))})`));
      const body = sem.map(mm => {
        const ls = C.limpiezasSemana(L, mm, data.settings);
        return [`${fmtSem(mm)}`].concat(ls.map(l => l.quien && (l.quien.g === 'otra' || l.quien.g === 'nadie') ? '—' : dd(l.dias))).concat(ks.map(k => { const q = C.quienLimpia(L, mm, k); return q ? nombreQuien(q) : ''; }));
      });
      doc.autoTable({ startY: y, margin: { left: 32, right: 32 }, theme: 'grid', head: [head], body,
        headStyles: { fillColor: [15, 27, 45], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
        styles: { fontSize: 9, cellPadding: 5 },
        didParseCell: (d) => { if (d.section === 'body' && d.column.index >= 1 + ts.length) { d.cell.styles.fontStyle = 'bold'; const t = String(d.cell.raw || ''); if (t === otraLabel() || t === 'Sin limpieza') { d.cell.styles.fontStyle = 'normal'; d.cell.styles.textColor = [120, 130, 145]; } } } });
      y = doc.lastAutoTable.finalY + 16;
    }
    if (opts.trabajos) {
      const occ = C.trabajosEntre(S.trabajos, desde, hasta).filter(o => !o.cancelada);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(15, 27, 45);
      if (y > H - 120) { doc.addPage(); y = 40; }
      doc.text('Trabajos en el Salón', 32, y); y += 6;
      doc.autoTable({ startY: y, margin: { left: 32, right: 32 }, theme: 'grid',
        head: [['Fecha', 'Hora', 'Trabajo', 'Responsable', 'Auxiliar', 'Voluntarios']],
        body: occ.length ? occ.map(o => { const t = o.t; const vols = C.voluntarios(t, o.fecha, S.anotados).map(v => pubName(v.pubId, t) || v.nombre).filter(Boolean); return [fmtDia(o.fecha), t.hora || '', `${tipoOf(t).label}: ${t.titulo}`, pubName(t.resp, t), pubName(t.aux, t), vols.join(', ')]; }) : [['', '', 'No hay trabajos programados', '', '', '']],
        headStyles: { fillColor: [15, 27, 45], textColor: 255, fontStyle: 'bold', fontSize: 8.5 }, styles: { fontSize: 8.5, cellPadding: 4.5 } });
      y = doc.lastAutoTable.finalY + 16;
    }
    if (opts.tareas && opts.limpieza) {
      doc.setFontSize(9);
      ts.forEach(t => {
        const txt = `${t.nombre}: ${(t.tareas || []).join(' · ') || '—'}`;
        const lines = doc.splitTextToSize(txt, W - 64);
        if (y + lines.length * 12 > H - 30) { doc.addPage(); y = 40; }
        doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 27, 45); doc.text(lines, 32, y);
        y += lines.length * 12 + 4;
      });
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(140);
    doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 32, H - 16);
    const filename = `Limpieza ${meses.join(' - ')}.pdf`;
    try {
      const file = new File([doc.output('blob')], filename, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Limpieza del Salón' }); return; }
    } catch (e) { /* se canceló el panel de compartir: se descarga */ }
    doc.save(filename);
    showToast('PDF generado');
  }

  /* ---------- Ajustes de la limpieza ---------- */
  function guardarTipos(nuevos, msg) { return saveLimpieza([[['tipos'], nuevos]], msg); }
  function renderLimpAjustes(v) {
    const L = S.limpieza || {};
    const ts = tipos();
    const rot = (L.rotacion || []).filter(g => S.grupos[g]);
    const sinRot = Object.values(S.grupos).filter(g => g && g.id && !rot.includes(g.id)).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { numeric: true }));
    let html = `<div class="thead"><h3><button type="button" class="sl-back" data-s="lz-volver" aria-label="Volver">‹</button> Ajustes de la limpieza</h3></div><div class="sl-ajgrid"><div>`;
    html += `<div class="sl-sec" style="margin-top:0;"><h4>Limpiezas</h4></div>` + ts.map((t, i) => `<div class="sl-lzc"><div class="h"><b>${i === 0 ? '🧹' : '🧽'} ${esc(t.nombre)}</b><button type="button" class="btn" data-s="lz-tipo" data-i="${i}">Editar</button></div>
      <small>${esc(t.modo === 'reunion' ? 'Después de cada reunión' : DIAS[t.dia != null ? t.dia : 6] + (t.hora ? ' · ' + t.hora : ''))} · ${(t.tareas || []).length} tareas</small>
      ${i > 0 ? `<label class="sl-sw"><span><b>La hace el mismo grupo</b> que «${esc(ts[0].nombre)}»</span><input type="checkbox" data-s="lz-mismo" data-i="${i}"${t.mismoGrupo !== false ? ' checked' : ''}></label>` : ''}</div>`).join('') +
      `<button type="button" class="btn" data-s="lz-tipo" data-i="-1" style="width:100%;justify-content:center;">＋ Agregar otra limpieza</button>`;
    html += `<div class="sl-sec"><h4>Orden para sugerir</h4></div><p class="hint" style="margin:-4px 2px 8px;">"Sugerir" propone al grupo que hace más tiempo que no limpia; a igualdad, el que está más arriba.</p><div class="sl-box">${rot.length ? rot.map((g, i) => `<div class="sl-rot"><span class="nn">${i + 1}</span><span class="nm">${esc(grupoName(g))}<small>${S.grupos[g].encargado ? 'Encargado: ' + esc(pubName(S.grupos[g].encargado)) : ''}</small></span><button type="button" data-s="rot-up" data-i="${i}" aria-label="Subir"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" data-s="rot-down" data-i="${i}" aria-label="Bajar"${i === rot.length - 1 ? ' disabled' : ''}>↓</button><button type="button" data-s="rot-del" data-i="${i}" aria-label="Sacar">✕</button></div>`).join('') : '<div class="sl-rot" style="color:var(--ink-soft)">Sin orden: se usan todos los grupos por nombre.</div>'}</div>
      ${sinRot.length ? `<div class="topts">${sinRot.map(g => `<button type="button" data-s="rot-add" data-g="${esc(g.id)}">+ ${esc(g.nombre)}</button>`).join('')}</div>` : ''}`;
    html += `</div><div>`;
    html += `<div class="sl-sec" style="margin-top:0;"><h4>Salón compartido (opcional)</h4></div><div class="tf"><label for="slOtraN">Nombre de la otra congregación</label><input id="slOtraN" maxlength="40" value="${esc(otraNombre())}" placeholder="Ej.: Paraná Sur"></div>
      <p class="hint" style="margin:0 0 6px;">Las semanas de cada mes que limpia la otra congregación salen solas en el mes.</p><div class="topts">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-s="otra" data-n="${n}" class="${(L.otra || []).includes(n) ? 'on' : ''}" aria-pressed="${(L.otra || []).includes(n)}">Semana ${n}</button>`).join('')}</div>`;
    html += externosHTML() + '</div></div>';
    v.innerHTML = html;
  }
  function openTipo(i) {
    const ts = tipos();
    const t = i >= 0 ? ts[i] : { id: newId(), nombre: 'Limpieza general', modo: 'semana', dia: 6, hora: '09:00', tareas: [], mismoGrupo: true };
    const f = Object.assign({}, t);
    const m = openModal(`<h3>${i >= 0 ? 'Editar limpieza' : 'Nueva limpieza'}</h3>
      <div class="tf"><label for="lzN">Nombre</label><input id="lzN" maxlength="40" value="${esc(f.nombre || '')}"></div>
      <div class="tf"><span class="tlbl">Cuándo</span><div class="topts" id="lzModo"><button type="button" data-k="reunion" class="${f.modo === 'reunion' ? 'on' : ''}">Después de cada reunión</button><button type="button" data-k="semana" class="${f.modo !== 'reunion' ? 'on' : ''}">Un día por semana</button></div></div>
      <div class="trow2" id="lzDH"><div class="tf"><label for="lzD">Día</label><select id="lzD">${[1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}"${Number(f.dia != null ? f.dia : 6) === d ? ' selected' : ''}>${DIAS[d]}</option>`).join('')}</select></div><div class="tf"><label for="lzH">Hora (opcional)</label><input type="time" id="lzH" value="${esc(f.hora || '')}"></div></div>
      <div class="tf"><label for="lzT">Tareas <small style="text-transform:none;letter-spacing:0;font-weight:400;">(una por renglón, las ven los hermanos)</small></label><textarea id="lzT" style="min-height:120px;">${esc((f.tareas || []).join('\n'))}</textarea></div>
      <div class="tfoot">${i > 0 ? '<button type="button" class="btn btn-danger" id="lzX">Borrar</button>' : ''}<button type="button" class="btn" data-tclose>Cancelar</button><button type="button" class="btn btn-primary" id="lzOk">Guardar</button></div>`);
    const paintDH = () => { m.q('#lzDH').style.display = f.modo === 'reunion' ? 'none' : ''; };
    m.q('#lzModo').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; f.modo = b.dataset.k; m.qa('#lzModo button').forEach(x => x.classList.toggle('on', x === b)); paintDH(); });
    paintDH();
    m.q('#lzOk').addEventListener('click', () => {
      const nombre = m.q('#lzN').value.trim() || (f.modo === 'reunion' ? 'Después de las reuniones' : 'Limpieza general');
      const nt = Object.assign({}, f, { nombre, dia: Number(m.q('#lzD').value), hora: m.q('#lzH').value, tareas: m.q('#lzT').value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 40) });
      const nuevos = ts.map(x => Object.assign({}, x));
      if (i >= 0) nuevos[i] = nt; else nuevos.push(nt);
      m.close(); guardarTipos(nuevos, 'Guardado');
    });
    const x = m.q('#lzX'); if (x) x.addEventListener('click', () => { if (!confirm(`¿Borrar «${t.nombre}»?`)) return; m.close(); guardarTipos(ts.filter((_, k) => k !== i), 'Limpieza borrada'); });
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
    if (!fbDb || !accessCode || !currentUser) { root.innerHTML = '<div class="tempty">Los trabajos de mantenimiento se guardan en la nube: conectá la app con el código de la congregación e iniciá sesión.</div>'; return; }
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
    else if (k === 'lz-ajustes') { S.lAjustes = true; render(); }
    else if (k === 'lz-volver') { S.lAjustes = false; render(); }
    else if (k === 'lz-mes') { S.lMonth = shiftYm(S.lMonth, Number(b.dataset.d)); render(); }
    else if (k === 'lz-pick') pickSemana(b.dataset.m, b.dataset.k);
    else if (k === 'lz-sug') sugerirMes();
    else if (k === 'lz-copy') copiarMesAnterior();
    else if (k === 'lz-undo') deshacer();
    else if (k === 'lz-pdf') openPdf();
    else if (k === 'lz-tipo') openTipo(Number(b.dataset.i));
    else if (k === 'otra') { const n = Number(b.dataset.n); const o = (L.otra || []).filter(x => x !== n); if (!b.classList.contains('on')) o.push(n); saveLimpieza([[['otra'], o.sort()]], 'Guardado'); }
    else if (k === 'x-new') openExterno(null);
    else if (k === 'x-edit') openExterno(b.dataset.id);
    else if (k === 'rot-add') saveLimpieza([[['rotacion'], rot.concat(b.dataset.g)]], 'Grupo agregado al orden');
    else if (k === 'rot-del') { const r = rot.slice(); r.splice(Number(b.dataset.i), 1); saveLimpieza([[['rotacion'], r]], 'Sacado del orden'); }
    else if (k === 'rot-up' || k === 'rot-down') { const i = Number(b.dataset.i), j = k === 'rot-up' ? i - 1 : i + 1; const r = rot.slice(); [r[i], r[j]] = [r[j], r[i]]; saveLimpieza([[['rotacion'], r]], 'Orden guardado'); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.closest || !el.closest('#salonRoot')) return;
    const L = S.limpieza || {};
    if (el.dataset && el.dataset.s === 'lz-mismo') { const ts = tipos().map(x => Object.assign({}, x)); ts[Number(el.dataset.i)].mismoGrupo = el.checked; guardarTipos(ts, el.checked ? 'La hace el mismo grupo' : 'Ahora tiene su propio grupo'); }
    else if (el.id === 'slOtraN') saveLimpieza([[['otraNombre'], el.value.trim().slice(0, 40) || undefined]], 'Guardado');
  });

  // Resumen para el Panel del Super Admin (panel.js).
  window.salonPanel = function () {
    start();
    const today = hoy(), mon = C.mondayOf(today);
    const lz = limpiezaDe(mon);
    const occ = C.trabajosEntre(S.trabajos, today, C.addDays(today, 30)).filter(o => !o.cancelada && o.estado !== 'hecho');
    const buscan = occ.map(o => ({ o, ci: C.cupoInfo(o.t, o.fecha, S.anotados) })).filter(x => x.ci.cupo && x.ci.faltan);
    let vacias = 0, primeraVacia = null;
    for (let i = 0, m = mon; i < 6; i++, m = C.addDays(m, 7)) {
      const falta = claves().some(k => !C.quienLimpia(S.limpieza, m, k));
      if (falta) { vacias++; if (!primeraVacia) primeraVacia = m; }
    }
    const hayLimpieza = !!(S.limpieza && (S.limpieza.semanas || S.limpieza.inicio || S.limpieza.tipos)) && Object.keys(S.grupos).length > 0;
    return { loaded: S.loaded.trabajos && S.loaded.limpieza && S.loaded.grupos, limpiaEsta: lz ? lz.nombre : '', trabajos: occ.length,
      buscan: buscan.length, faltan: buscan.reduce((n, x) => n + x.ci.faltan, 0), hayLimpieza, vacias: hayLimpieza ? vacias : 0, primeraVacia,
      // Los de esta semana que todavía necesitan voluntarios (para "Para resolver" del Admin — Mantenimiento).
      pronto: buscan.filter(x => x.o.fecha <= C.addDays(today, 7)).map(x => ({ titulo: x.o.t.titulo || 'Trabajo', fecha: x.o.fecha, faltan: x.ci.faltan })) };
  };
  window.salonGoLimpieza = function (m) { S.view = 'limp'; S.lAjustes = false; if (m) S.lMonth = C.semanaDelMes(m).mes; switchTab('salon'); };

  if (typeof currentUserRole !== 'undefined' && typeof applyRoleUI === 'function' && currentUser) { try { window.salonOnRole(); } catch (e) { /* nada */ } }
})();
