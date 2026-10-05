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
  /* Cronograma (vista "Año") y lo de "Solo el comité" */
  .cr-head { display: flex; align-items: center; gap: 8px; margin: 4px 0 10px; flex-wrap: wrap; }
  .cr-head h3 { font-family: 'Fraunces', serif; font-weight: 500; font-size: 18px; margin: 0; flex: 1; min-width: 150px; }
  .cr-head h3 small { display: block; font-family: 'Public Sans', sans-serif; font-size: 12px; color: var(--ink-soft); font-weight: 400; margin-top: 2px; }
  .cr-nav { display: flex; gap: 4px; }
  .cr-nav button { border: 1px solid var(--line); background: var(--surface); border-radius: 8px; width: 34px; height: 34px; font: inherit; font-size: 16px; cursor: pointer; color: var(--ink); }
  .cr-leg { display: flex; gap: 6px 14px; flex-wrap: wrap; font-size: 12px; color: var(--ink-soft); margin: 0 2px 10px; align-items: center; }
  .cr-leg i { display: inline-block; width: 16px; height: 14px; border-radius: 5px; vertical-align: -3px; margin-right: 5px; }
  .cr-box { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
  .cr-grid { display: grid; grid-template-columns: 230px repeat(12, minmax(0, 1fr)); }
  .cr-grid > div { border-top: 1px solid var(--line); padding: 7px 3px; min-height: 40px; display: flex; gap: 3px; flex-wrap: wrap; align-content: center; justify-content: center; min-width: 0; }
  .cr-grid > .h { border-top: none; min-height: 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-soft); padding: 9px 2px; text-align: center; display: block; }
  .cr-grid > .h small { display: block; font-size: 10px; font-weight: 600; letter-spacing: 0; opacity: .8; }
  .cr-grid > .now { background: color-mix(in srgb, var(--accent-gold, #B7791F) 7%, transparent); }
  .cr-grid > .h.now { color: var(--accent-gold-text, var(--accent-gold)); }
  .cr-nm { justify-content: flex-start !important; padding: 7px 8px 7px 12px !important; }
  .cr-nm button { border: none; background: none; font: inherit; color: var(--ink); text-align: left; cursor: pointer; padding: 0; width: 100%; min-width: 0; }
  .cr-nm b { display: block; font-size: 13px; line-height: 1.25; } .cr-nm b i { display: inline-block; width: 4px; height: 12px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
  .cr-nm small { display: block; font-size: 11.5px; color: var(--ink-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cr-d { min-width: 22px; height: 20px; padding: 0 3px; border-radius: 6px; font: inherit; font-size: 11px; font-weight: 800; display: grid; place-items: center; border: 1.5px solid; background: var(--surface); cursor: pointer; }
  .cr-d.v { }
  .cr-d.m { border-style: dashed; border-color: #B7791F !important; color: #8A6212 !important; background: var(--surface) !important; }
  .cr-d.x { opacity: .45; text-decoration: line-through; }
  .cr-d.h { background: #16A34A !important; border-color: #16A34A !important; color: #fff !important; }
  .cr-d.cu { background: #2563EB !important; border-color: #2563EB !important; color: #fff !important; }
  .cr-d.at { background: #FEE2E2 !important; border-color: #DC2626 !important; color: #B91C1C !important; }
  html.dk .cr-d.at { background: rgba(220,38,38,.18) !important; color: #FCA5A5 !important; }
  .cr-tag.ok { background: #DCFCE7; color: #166534; } .cr-tag.cu { background: #DBEAFE; color: #1D4ED8; } .cr-tag.at { background: #FEE2E2; color: #B91C1C; }
  html.dk .cr-tag.ok { background: rgba(34,197,94,.18); color: #86EFAC; } html.dk .cr-tag.cu { background: rgba(59,130,246,.2); color: #93C5FD; } html.dk .cr-tag.at { background: rgba(220,38,38,.2); color: #FCA5A5; }
  .sl-pill.at { background: #FEE2E2; color: #B91C1C; } html.dk .sl-pill.at { background: rgba(220,38,38,.2); color: #FCA5A5; }
  .cr-nm .cr-tag { display: inline-block; margin-top: 3px; }
  .cr-top { display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap; margin: 0 2px 10px; }
  .cr-prog { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 220px; font-size: 13px; color: var(--ink-soft); }
  .cr-prog .bar { flex: 0 0 140px; height: 8px; border-radius: 6px; background: var(--bg); overflow: hidden; border: 1px solid var(--line); }
  .cr-prog .bar i { display: block; height: 100%; background: #16A34A; }
  .cr-prog b { color: var(--ink); } .cr-prog b.r { color: #B91C1C; } html.dk .cr-prog b.r { color: #FCA5A5; }
  .cr-fil { display: flex; background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 3px; gap: 2px; }
  .cr-fil button { border: none; background: none; border-radius: 8px; padding: 6px 11px; font: inherit; font-size: 12.5px; font-weight: 700; color: var(--ink-soft); cursor: pointer; }
  .cr-fil button.on { background: var(--surface); color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .cr-hizo { display: grid; gap: 8px; margin-top: 4px; }
  .cr-hizo .btn { flex-direction: column; align-items: flex-start; justify-content: center; text-align: left; padding: 10px 14px; gap: 1px; }
  @media (max-width: 600px) { .cr-prog .bar { flex-basis: 70px; } .cr-prog { min-width: 0; } }
  .cr-hizo .btn small { display: block; font-weight: 400; font-size: 12px; opacity: .8; }
  .cr-m { display: block; } .cr-pc { display: none; }
  @media (min-width: 900px) { .cr-m { display: none; } .cr-pc { display: block; } }
  .cr-mes { display: flex; justify-content: space-between; align-items: center; width: 100%; border: none; background: none; font: inherit; margin: 12px 0 6px; padding: 2px; font-size: 12.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-soft); cursor: pointer; }
  .cr-mes.now { color: var(--accent-gold-text, var(--accent-gold)); }
  .cr-mes span:last-child { letter-spacing: 0; }
  .sl-ev .dt.q b { color: #B7791F; }
  .cr-tag { font-size: 10.5px; font-weight: 800; border-radius: 8px; padding: 3px 7px; white-space: nowrap; flex-shrink: 0; }
  .cr-tag.v { background: rgba(76,122,94,.14); color: #2F6B4A; } .cr-tag.c { background: var(--bg); color: var(--ink-soft); } .cr-tag.q { background: rgba(201,138,27,.16); color: #8A6212; }
  html.dk .cr-tag.v { color: #9FD4B2; } html.dk .cr-tag.q { color: #F2C46B; }
  .cr-seg2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .cr-opt { border: 1.5px solid var(--line); border-radius: 12px; padding: 9px 10px; font: inherit; font-size: 12.5px; color: var(--ink-soft); line-height: 1.35; background: var(--surface); text-align: left; cursor: pointer; }
  .cr-opt b { display: block; font-size: 13.5px; color: var(--ink); margin-bottom: 2px; }
  .cr-opt.on { border-color: var(--accent-blue); background: color-mix(in srgb, var(--accent-blue) 8%, var(--surface)); }
  .cr-pub { border-radius: 12px; padding: 10px 12px; margin: 0 0 12px; font-size: 13px; line-height: 1.45; background: var(--bg); display: flex; gap: 10px; align-items: center; }
  .cr-pub > span { flex: 1; min-width: 0; } .cr-pub b { display: block; font-size: 13.5px; }
  .cr-pub.v { background: rgba(76,122,94,.1); } .cr-pub.q { background: rgba(201,138,27,.12); }
  .cr-pub .btn { white-space: nowrap; }
  .topts button:disabled { opacity: .4; cursor: not-allowed; }
  .sl-opc { text-transform: none; letter-spacing: 0; font-weight: 500; color: var(--ink-soft); }
  .cr-sinf { margin-top: 14px; }
  .cr-sinf .sl-ev .dt b { color: var(--ink-soft); }
  .sl-hint { margin: 6px 2px 0; font-size: 12px; color: var(--ink-soft); line-height: 1.4; }
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
    if (o.sinDia) pill = '<span class="cr-tag q">Falta el día</span>';
    else if (o.cancelada) pill = '<span class="sl-pill no">Suspendido</span>';
    else if (o.estado === 'hecho') pill = '<span class="sl-pill ok">Hecho</span>';
    else if (o.estado === 'curso') pill = '<span class="sl-pill curso">En curso</span>';
    else if (o.fecha < hoy()) pill = '<span class="sl-pill at">Atrasado</span>';
    else if (ci.cupo && ci.faltan) pill = `<span class="sl-pill falta">Faltan ${ci.faltan}</span>`;
    else if (ci.cupo) pill = '<span class="sl-pill ok">Completo</span>';
    const quien = [t.resp && apellido(t.resp, '', t), t.aux && apellido(t.aux, '', t)].filter(Boolean).join(' y ');
    return `<button type="button" class="sl-ev${o.cancelada ? ' off' : ''}" data-s="open" data-id="${esc(t.id)}" data-f="${o.fecha}">
      ${o.sinDia ? `<span class="dt q">${esc(MESES[d.getMonth()].slice(0, 3))}<b>?</b></span>` : `<span class="dt">${DIAS3[d.getDay()]}<b>${d.getDate()}</b></span>`}<span class="bar" style="background:${tp.color}"></span>
      <span class="tx"><b>${tp.icon} ${esc(t.titulo)}</b><small>${o.sinDia ? '' : esc(t.hora || '')}${t.hora && !o.sinDia ? ' · ' : ''}${esc(quien || 'Sin responsable')}${ci.cupo ? ` · ${ci.van} de ${ci.cupo} voluntarios` : ''}${t.repite && t.repite !== 'no' ? ` · 🔁 ${esc(C.REPITE[t.repite].toLowerCase())}` : ''}${!o.sinDia && !o.pub && !o.cancelada && o.estado !== 'hecho' ? ' · 🔒 solo el comité' : ''}</small></span>${pill}</button>`;
  }
  function renderCal(v) {
    const today = hoy();
    if (!S.month) S.month = today.slice(0, 7);
    const mon = C.mondayOf(today);
    const semana = C.trabajosEntre(S.trabajos, mon, C.addDays(mon, 6)).filter(o => !o.cancelada && !o.sinDia);
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
    const occ = C.trabajosEntre(S.trabajos, gridStart, gridEnd).filter(o => !o.cancelada && !o.sinDia);
    // Los que tienen solo el mes no van en un día: se listan abajo del calendario.
    const sinDiaMes = C.trabajosEntre(S.trabajos, firstDay, lastDay).filter(o => o.sinDia && !o.cancelada);
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
    html += '</div><div class="sl-leg">' + Object.values(C.TIPOS).map(tp => `<span><i style="background:${tp.color}"></i>${tp.label}</span>`).join('') + `<span><i class="bar" style="background:${LIMPIEZA_COLOR}"></i>Limpieza</span>${(S.limpieza.otra || []).length ? `<span><i class="bar" style="background:${OTRA_COLOR}"></i>${esc(otraLabel())}</span>` : ''}</div>${sinDiaMes.length ? `<div class="tnote" style="margin:8px 2px 2px;">📅 Este mes, sin día todavía: ${sinDiaMes.map(o => `<button type="button" class="pn-go" style="border:none;background:none;font:inherit;font-weight:800;color:var(--accent-gold-text,var(--accent-gold));cursor:pointer;padding:0;" data-s="open" data-id="${esc(o.t.id)}" data-f="${o.fecha}">${esc(o.t.titulo)}</button>`).join(', ')}</div>` : ''}</div>`;
    html += '</div><div class="a-rest">';
    // Día elegido o próximos
    if (S.day) {
      const del = C.trabajosEntre(S.trabajos, S.day, S.day).filter(o => !o.sinDia);
      const l = limpiezaDe(C.mondayOf(S.day));
      const lz2 = l && l.dias.includes(S.day) ? l.ls.filter(x => x.dias.includes(S.day)).map(x => `<div class="tnote">🧹 ${esc(x.tipo.nombre)}: <b>${esc(nombreQuien(x.quien))}</b>${x.tipo.modo === 'semana' && x.tipo.hora ? ' · ' + esc(x.tipo.hora) : ''}</div>`).join('') : '';
      html += `<div class="sl-sec"><h4>${esc(fmtDia(S.day))}</h4><button type="button" class="btn" data-s="new" data-f="${S.day}">+ Trabajo este día</button></div>${lz2}` + (del.length ? del.map(evRow).join('') : (lz2 ? '' : '<div class="tempty" style="padding:10px;">Nada programado este día.</div>'));
    }
    // Próximos: la siguiente vez de cada trabajo (los que se repiten no llenan la lista).
    const vistos = new Set();
    const prox = C.trabajosEntre(S.trabajos, today, C.addDays(today, 120)).filter(o => !o.cancelada && o.estado !== 'hecho' && !vistos.has(o.t.id) && vistos.add(o.t.id)).slice(0, 8);
    html += `<div class="sl-sec"><h4>Próximos trabajos</h4><button type="button" class="btn btn-primary" data-s="new">+ Trabajo</button></div>`;
    const nPend = pendientesDe().length;
    if (nPend) html += `<button type="button" class="sl-ev" data-s="pend" style="justify-content:space-between;"><span class="tx"><b>📝 Pendientes: ${nPend}</b><small>Trabajos anotados que todavía no tienen fecha</small></span><span class="cr-tag q">Ver ›</span></button>`;
    html += prox.length ? prox.map(evRow).join('') : '<div class="tempty">Todavía no hay trabajos programados.<br>Con "+ Trabajo" cargás qué hay que hacer, el día, el responsable y el auxiliar. Si se repite (el corte de pasto, por ejemplo), aparece solo en el calendario.</div>';
    html += '</div></div>';
    v.innerHTML = html;
  }

  /* =====================================================================
     TRABAJOS (lista de todos, con los que se repiten)
     ===================================================================== */
  // Un trabajo pendiente (sin fecha): se abre el formulario para programarlo.
  function pendRow(t) {
    const tp = tipoOf(t);
    const quien = t.resp || t.aux ? `Resp. ${pubName(t.resp, t) || '—'} · Aux. ${pubName(t.aux, t) || '—'}` : 'Sin responsable ni auxiliar todavía';
    return `<button type="button" class="sl-ev" data-s="edit" data-id="${esc(t.id)}"><span class="dt"><b>—</b></span><span class="bar" style="background:${tp.color}"></span>
      <span class="tx"><b>${tp.icon} ${esc(t.titulo)}</b><small>${esc(quien)}${t.repite && t.repite !== 'no' ? ' · 🔁 ' + esc(C.REPITE[t.repite].toLowerCase()) : ''}</small></span><span class="cr-tag q">Programar ›</span></button>`;
  }
  const pendientesDe = () => Object.values(S.trabajos).filter(t => t && t.id && (t.sinFecha || !t.fecha));
  function renderTrabajos(v) {
    const today = hoy();
    const ts = Object.values(S.trabajos).filter(t => t && t.id);
    const next = (t) => C.fechasDe(t, today, C.addDays(today, 400)).find(f => { const o = (t.ocurr || {})[f] || {}; return !o.cancelada && o.estado !== 'hecho'; });
    const activos = ts.filter(t => next(t)).sort((a, b) => next(a).localeCompare(next(b)));
    const hechos = C.trabajosEntre(S.trabajos, C.addDays(today, -120), today).filter(o => o.estado === 'hecho').reverse().slice(0, 10);
    const pendientes = ts.filter(t => t.sinFecha || !t.fecha).sort((a, b) => (a.creado || '').localeCompare(b.creado || ''));
    const pasados = ts.filter(t => !next(t) && !pendientes.includes(t));
    let html = `<div class="thead"><h3>Trabajos</h3><button type="button" class="btn btn-primary" data-s="new">+ Trabajo</button></div>`;
    if (!ts.length) html += '<div class="tempty">Todavía no hay trabajos.</div>';
    html += activos.map(t => {
      const f = next(t), tp = tipoOf(t);
      const cuando = t.soloMes ? `Para ${mesLabel(f.slice(0, 7))} · falta el día` : `Próximo: ${fmtCorto(f)}${t.hora ? ' · ' + t.hora : ''}`;
      const tag = t.soloMes ? '<span class="cr-tag q">Falta el día</span>' : C.publicado(t, f) ? '<span class="cr-tag v">👁 En la vista</span>' : '<span class="cr-tag c">🔒 Comité</span>';
      return `<button type="button" class="sl-ev" data-s="open" data-id="${esc(t.id)}" data-f="${f}"><span class="bar" style="background:${tp.color}"></span>
        <span class="tx"><b>${tp.icon} ${esc(t.titulo)}</b><small>${esc(cuando)} · ${esc(C.REPITE[t.repite || 'no'])}</small><small>Resp. ${esc(pubName(t.resp, t) || '—')} · Aux. ${esc(pubName(t.aux, t) || '—')}</small></span>${tag}</button>`;
    }).join('');
    if (pendientes.length) html += `<div class="sl-sec" id="slPend"><h4>Pendientes (sin fecha) · ${pendientes.length}</h4></div>` + pendientes.map(pendRow).join('');
    if (hechos.length) html += '<div class="sl-sec"><h4>Hechos hace poco</h4></div>' + hechos.map(evRow).join('');
    if (pasados.length) html += '<div class="sl-sec"><h4>Terminados</h4></div>' + pasados.map(t => `<button type="button" class="sl-ev off" data-s="edit" data-id="${esc(t.id)}"><span class="bar" style="background:${tipoOf(t).color}"></span><span class="tx"><b>${tipoOf(t).icon} ${esc(t.titulo)}</b><small>${esc(fmtCorto(t.fecha))}</small></span></button>`).join('');
    v.innerHTML = html;
  }

  /* =====================================================================
     AÑO (cronograma de 12 meses, para el comité de mantenimiento)
     ===================================================================== */
  // Lo de 12 meses desde S.aStart ("AAAA-MM"): las fechas de cada trabajo, con si está en la vista o no.
  function cronograma(desdeYm, n) {
    const from = desdeYm + '-01', hastaYm = shiftYm(desdeYm, n - 1);
    const [y, m] = hastaYm.split('-').map(Number);
    const to = C.isoOf(new Date(y, m, 0, 12));
    const meses = []; for (let i = 0; i < n; i++) meses.push(shiftYm(desdeYm, i));
    const occ = C.trabajosEntre(S.trabajos, from, to);
    const filas = [];
    const porId = {};
    occ.forEach(o => { if (!porId[o.t.id]) { porId[o.t.id] = { t: o.t, occ: [] }; filas.push(porId[o.t.id]); } porId[o.t.id].occ.push(o); });
    return { meses, from, to, occ, filas };
  }
  const MES3 = (ym) => MESES[Number(ym.slice(5, 7)) - 1].slice(0, 3);
  // Estado de esa vez: hecho, en curso, atrasado (ya pasó y no se marcó hecho), sin día, suspendido o por hacer.
  function estadoDe(o) {
    if (o.cancelada) return 'susp';
    if (o.estado === 'hecho') return 'hecho';
    if (o.estado === 'curso') return 'curso';
    if (o.sinDia) return 'sindia';
    return o.fecha < hoy() ? 'atrasado' : 'prog';
  }
  function marca(o) {
    const col = tipoOf(o.t).color, e = estadoDe(o);
    const tit = `${o.t.titulo} · ${o.sinDia ? mesLabel(o.fecha.slice(0, 7)) + ' (falta el día)' : fmtDia(o.fecha)} · ${({ susp: 'suspendido', hecho: 'hecho', curso: 'en curso', atrasado: 'atrasado: ¿se hizo?', sindia: '', prog: o.pub ? 'en la vista' : 'solo el comité' })[e]}`;
    const cls = ({ sindia: ' m', susp: ' x', hecho: ' h', curso: ' cu', atrasado: ' at', prog: o.pub ? ' v' : '' })[e];
    const dia = Number(o.fecha.slice(8));
    const txt = ({ sindia: '?', hecho: '✓ ' + dia, curso: '● ' + dia, atrasado: '! ' + dia })[e] || String(dia);
    // En la vista: fondo suave del color del tipo; solo el comité: solo el borde. Lo lleno queda para hecho y en curso.
    return `<button type="button" class="cr-d${cls}" style="border-color:${col};color:${col};${e === 'prog' && o.pub ? `background:color-mix(in srgb, ${col} 18%, var(--surface))` : ''}" data-s="${e === 'atrasado' ? 'hizo' : 'open'}" data-id="${esc(o.t.id)}" data-f="${o.fecha}" title="${esc(tit)}" aria-label="${esc(tit)}">${txt}</button>`;
  }
  // Etiqueta de la fila (o de la próxima vez de los que se repiten): atrasado, en curso o hecho.
  function tagFila(occ) {
    if (occ.some(o => estadoDe(o) === 'atrasado')) return '<span class="cr-tag at">! Atrasado</span>';
    if (occ.some(o => estadoDe(o) === 'curso')) return '<span class="cr-tag cu">● En curso</span>';
    const vivas = occ.filter(o => !o.cancelada);
    if (vivas.length && vivas.every(o => o.estado === 'hecho')) return '<span class="cr-tag ok">✓ Hecho</span>';
    return '';
  }
  const pasaFiltro = (o) => !S.aFiltro || S.aFiltro === 'todos' ? true : S.aFiltro === 'hechos' ? o.estado === 'hecho' && !o.cancelada : o.estado !== 'hecho' && !o.cancelada;
  // Una fecha que ya pasó y no se marcó: "¿Se hizo?" (sí / cambiar la fecha / suspender / ver el detalle).
  function seHizo(id, fecha) {
    const t = S.trabajos[id]; if (!t) return;
    const rep = t.repite && t.repite !== 'no';
    const m = openModal(`<h3>¿Se hizo?</h3><p class="modal-sub" style="margin:0 0 10px;"><b>${esc(t.titulo)}</b><br>Era para el ${esc(fmtDia(fecha).toLowerCase())}${t.hora ? ' · ' + esc(t.hora) : ''}.</p>
      <div class="cr-hizo"><button type="button" class="btn btn-primary" data-h="si">✓ Sí, se hizo<small>Queda marcado como hecho</small></button>
      ${rep ? '' : '<button type="button" class="btn" data-h="fecha">📅 Cambiar la fecha<small>Todavía no se hizo: elegí otro día</small></button>'}
      <button type="button" class="btn" data-h="susp">⏸ Suspender${rep ? ' esta vez' : ''}<small>${rep ? 'No se hizo esta vez; las próximas siguen igual' : 'No se va a hacer'}</small></button>
      <button type="button" class="btn" data-h="ver">Ver el detalle</button></div>
      <div class="tfoot"><button type="button" class="btn" data-tclose>Cerrar</button></div>`);
    const put = (k, v, msg) => safe(() => sWrite(sRef('trabajos'), [[occPath(t, fecha, k), v]]), msg).then(ok => { if (ok) { t.ocurr = t.ocurr || {}; t.ocurr[fecha] = Object.assign({}, t.ocurr[fecha] || {}, { [k]: v }); render(); } return ok; });
    m.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-h]'); if (!b) return;
      const k = b.dataset.h;
      if (k === 'si') { if (await put('estado', 'hecho', '¡Trabajo hecho!')) m.close(); }
      else if (k === 'susp') { if (await put('cancelada', true, rep ? 'Suspendido esta vez' : 'Suspendido')) m.close(); }
      else if (k === 'fecha') { m.close(); openForm(id); }
      else if (k === 'ver') { m.close(); openTrabajo(id, fecha); }
    });
  }
  function renderAnio(v) {
    const today = hoy(), mesHoy = today.slice(0, 7);
    if (!S.aStart) S.aStart = mesHoy;
    const c = cronograma(S.aStart, 12);
    const rango = `${MES3(c.meses[0]).replace(/^./, x => x.toUpperCase())} ${c.meses[0].slice(0, 4)} – ${MES3(c.meses[11]).replace(/^./, x => x.toUpperCase())} ${c.meses[11].slice(0, 4)}`;
    const pend = pendientesDe();
    const sinf = pend.length ? `<div class="cr-sinf"><div class="sl-sec" style="margin-top:0;"><h4>Sin fecha · ${pend.length}</h4></div>${pend.map(pendRow).join('')}</div>` : '';
    let html = `<div class="cr-head"><h3>Cronograma<small>${esc(rango)} · ${c.filas.length} ${c.filas.length === 1 ? 'trabajo' : 'trabajos'}${pend.length ? ` · ${pend.length} sin fecha` : ''}</small></h3><div class="cr-nav"><button type="button" data-s="a-mes" data-d="-12" aria-label="12 meses antes">‹</button><button type="button" data-s="a-mes" data-d="12" aria-label="12 meses después">›</button></div><button type="button" class="btn" data-s="a-pdf">📄 PDF</button><button type="button" class="btn btn-primary" data-s="new">+ Trabajo</button></div>
      <div class="cr-leg"><span><i style="background:#E2E8F0;border:1.5px solid #64748B"></i>En la vista</span><span><i style="border:1.5px solid #64748B"></i>Solo el comité</span><span><i style="border:1.5px dashed #B7791F"></i>Falta el día</span><span><i style="background:#16A34A"></i>✓ Hecho</span><span><i style="background:#2563EB"></i>● En curso</span><span><i style="background:#FEE2E2;border:1.5px solid #DC2626"></i>! Atrasado</span></div>`;
    // Avance: cuántas veces ya se hicieron de las que tocaban en estos 12 meses, y cuántas están atrasadas.
    // Hasta hoy: de lo que ya tocaba, cuánto se hizo y cuánto está atrasado; y cuánto falta en el resto del período.
    const vivas = c.occ.filter(o => !o.cancelada && !o.sinDia && o.fecha <= today);
    const nHechos = vivas.filter(o => o.estado === 'hecho').length, nAtr = vivas.filter(o => estadoDe(o) === 'atrasado').length;
    const nVienen = c.occ.filter(o => !o.cancelada && (o.sinDia || o.fecha > today) && o.estado !== 'hecho').length;
    if (!S.aFiltro) S.aFiltro = 'todos';
    const top = c.occ.length ? `<div class="cr-top"><div class="cr-prog">${vivas.length ? `<span class="bar"><i style="width:${Math.round(nHechos * 100 / vivas.length)}%"></i></span><span>Hasta hoy: <b>${nHechos} de ${vivas.length}</b> hechos${nAtr ? ` · <b class="r">${nAtr} ${nAtr === 1 ? 'atrasado' : 'atrasados'}</b>` : ''} · ${nVienen} por venir</span>` : `<span>${nVienen} por venir</span>`}</div>
      <div class="cr-fil" role="tablist">${[['todos', 'Todos'], ['pend', 'Por hacer'], ['hechos', 'Hechos']].map(([k, l]) => `<button type="button" class="${S.aFiltro === k ? 'on' : ''}" data-s="a-fil" data-k="${k}">${l}</button>`).join('')}</div></div>` : '';
    html += top;
    c.filas = c.filas.map(r => ({ t: r.t, occ: r.occ, ver: r.occ.filter(pasaFiltro) })).filter(r => r.ver.length);
    c.occ = c.occ.filter(pasaFiltro);
    if (!c.filas.length) { v.innerHTML = html + '<div class="tempty">No hay trabajos con fecha en estos 12 meses.<br>Con "+ Trabajo" cargás lo que hay que hacer: con el día, solo el mes, o "Todavía no" para dejarlo pendiente. Los que se repiten (cada 3 meses, cada año…) aparecen solos.</div>' + sinf; return; }
    // Computadora: una fila por trabajo y los 12 meses en columnas.
    let g = `<div class="cr-grid"><div class="h" style="text-align:left;padding-left:12px;">Trabajo</div>` + c.meses.map(ym => `<div class="h${ym === mesHoy ? ' now' : ''}">${esc(MES3(ym))}<small>${ym.slice(0, 4)}</small></div>`).join('');
    c.filas.forEach(r => {
      const t = r.t, tp = tipoOf(t);
      g += `<div class="cr-nm"><button type="button" data-s="edit" data-id="${esc(t.id)}" title="Editar"><b><i style="background:${tp.color}"></i>${esc(t.titulo)}</b><small>${esc(C.REPITE[t.repite || 'no'])} · ${esc(pubName(t.resp, t) || 'sin responsable')}</small>${tagFila(r.occ)}</button></div>`;
      c.meses.forEach(ym => { g += `<div class="${ym === mesHoy ? 'now' : ''}">${r.ver.filter(o => o.fecha.slice(0, 7) === ym).map(marca).join('')}</div>`; });
    });
    html += `<div class="cr-pc"><div class="cr-box">${g}</div></div></div>`;
    // Celular: lista por mes (los 3 primeros abiertos; los demás se abren tocando el mes).
    if (!S.aOpen) S.aOpen = {};
    html += '<div class="cr-m">' + c.meses.map((ym, i) => {
      // Los hechos van al final del mes.
      const items = c.occ.filter(o => o.fecha.slice(0, 7) === ym).sort((a, b) => ((a.estado === 'hecho') - (b.estado === 'hecho')) || (a.sinDia - b.sinDia) || a.fecha.localeCompare(b.fecha));
      const abierto = S.aOpen[ym] != null ? S.aOpen[ym] : i < 3;
      return `<button type="button" class="cr-mes${ym === mesHoy ? ' now' : ''}" data-s="a-tog" data-m="${ym}" aria-expanded="${abierto}"><span>${esc(mesLabel(ym))}</span><span>${items.length}${abierto ? '' : ' ›'}</span></button>` +
        (abierto ? (items.length ? items.map(o => {
          const e = estadoDe(o);
          const tag = ({ sindia: '', susp: '<span class="cr-tag c">Suspendido</span>', hecho: '<span class="cr-tag ok">✓ Hecho</span>', curso: '<span class="cr-tag cu">● En curso</span>', atrasado: '<span class="cr-tag at">! Atrasado</span>' })[e] ?? (o.pub ? '<span class="cr-tag v">👁 En la vista</span>' : '<span class="cr-tag c">🔒 Comité</span>');
          let row = evRow(o).replace(' · 🔒 solo el comité', '').replace(/<\/button>$/, tag + '</button>').replace(/<span class="sl-pill[^"]*">[^<]*<\/span>/, '');
          if (e === 'atrasado') row = row.replace('data-s="open"', 'data-s="hizo"');
          if (e === 'hecho') row = row.replace('class="sl-ev', 'style="opacity:.7" class="sl-ev');
          return row;
        }).join('') : '<div class="tempty" style="padding:8px;">Nada programado.</div>') : '');
    }).join('') + '</div>';
    v.innerHTML = html + sinf;
  }
  // PDF del cronograma: todo (para el comité) o solo lo publicado (para el tablero de anuncios).
  function openCronoPdf() {
    const m = openModal(`<h3>PDF del cronograma</h3><p class="modal-sub" style="margin:0 0 10px;">Desde ${esc(mesLabel(S.aStart))}.</p>
      <div class="tf"><span class="tlbl">Período</span><div class="topts" id="crMeses"><button type="button" data-k="3">3 meses</button><button type="button" data-k="6">6 meses</button><button type="button" data-k="12" class="on">12 meses</button></div></div>
      <label class="tchk"><input type="checkbox" id="crPub"><span>Solo lo publicado <small>· para el tablero de anuncios (sin lo del comité ni lo que no tiene día)</small></span></label>
      <div class="tfoot"><button type="button" class="btn" data-tclose>Cancelar</button><button type="button" class="btn btn-primary" id="crOk">Compartir PDF</button></div>`);
    let n = 12;
    m.q('#crMeses').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; n = Number(b.dataset.k); m.qa('#crMeses button').forEach(x => x.classList.toggle('on', x === b)); });
    m.q('#crOk').addEventListener('click', async () => { const soloPub = m.q('#crPub').checked; m.close(); await cronoPdf(n, soloPub); });
  }
  async function cronoPdf(n, soloPub) {
    if (!window.jspdf) { showToast('No se pudo cargar el generador de PDF (revisá tu conexión)'); return; }
    const c = cronograma(S.aStart, n);
    const vale = (o) => !o.cancelada && (!soloPub || (o.pub && !o.sinDia));
    const filas = c.filas.map(r => ({ t: r.t, occ: r.occ.filter(vale) })).filter(r => r.occ.length);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: n > 6 ? 'landscape' : 'portrait' });
    const W = doc.internal.pageSize.getWidth();
    const cong = (data.settings && data.settings.congregationName) || 'Congregación';
    doc.setFillColor(15, 27, 45); doc.rect(0, 0, W, 66, 'F');
    doc.setFillColor(37, 99, 235); doc.rect(0, 66, W, 3, 'F');
    doc.setTextColor(147, 197, 253); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(`SALÓN DEL REINO — ${cong.toUpperCase()}`, 32, 24);
    doc.setTextColor(255, 255, 255); doc.setFontSize(17);
    doc.text(soloPub ? 'Trabajos de mantenimiento' : 'Cronograma de mantenimiento', 32, 46);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(203, 213, 225);
    doc.text(`${mesLabel(c.meses[0])} a ${mesLabel(c.meses[c.meses.length - 1])}${soloPub ? '' : ' · uso del comité'}`, 32, 60);
    const head = [['Trabajo', 'Responsable / auxiliar'].concat(c.meses.map(ym => `${MES3(ym)} ${ym.slice(2, 4)}`))];
    const body = filas.length ? filas.map(r => [`${r.t.titulo}\n${C.REPITE[r.t.repite || 'no']}`, `${pubName(r.t.resp, r.t) || '—'}\n${pubName(r.t.aux, r.t) || '—'}`].concat(c.meses.map(ym => r.occ.filter(o => o.fecha.slice(0, 7) === ym).map(o => o.sinDia ? '?' : Number(o.fecha.slice(8)) + (!soloPub && !o.pub ? '*' : '') + (o.estado === 'hecho' ? ' hecho' : '')).join(', '))))
      : [['No hay trabajos en este período', ''].concat(c.meses.map(() => ''))];
    doc.autoTable({ startY: 84, margin: { left: 24, right: 24 }, theme: 'grid', head, body,
      headStyles: { fillColor: [15, 27, 45], textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
      styles: { fontSize: 8, cellPadding: 4, valign: 'middle' },
      columnStyles: Object.assign({ 0: { cellWidth: n > 6 ? 150 : 170, fontStyle: 'bold' }, 1: { cellWidth: n > 6 ? 100 : 110 } }, Object.fromEntries(c.meses.map((x, i) => [i + 2, { halign: 'center' }]))) });
    let y = doc.lastAutoTable.finalY + 14;
    doc.setFontSize(8.5); doc.setTextColor(90, 100, 115);
    doc.text(soloPub ? 'Los números son los días de cada mes. Para anotarte como voluntario, tocá "Me sumo" en la vista de la congregación.' : 'Los números son los días de cada mes. * = todavía no está publicado (lo ve solo el comité). ? = falta poner el día.', 24, y);
    const nombre = `${soloPub ? 'Trabajos del Salon' : 'Cronograma de mantenimiento'} ${mesLabel(c.meses[0])} - ${mesLabel(c.meses[c.meses.length - 1])}.pdf`;
    const blob = doc.output('blob');
    try {
      const file = new File([blob], nombre, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: nombre }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    doc.save(nombre);
  }

  /* ---------- Formulario de trabajo ---------- */
  function openForm(id, fechaDefault) {
    const t = id ? S.trabajos[id] : null;
    // Los trabajos nuevos son "Solo el comité" hasta que se publican.
    const f = t ? Object.assign({}, t) : { tipo: 'pintura', fecha: fechaDefault || C.addDays(hoy(), 7), hora: '09:00', cupo: 0, repite: 'no', materiales: [], vista: false };
    f.vista = f.vista !== false;
    if (!t) f.vista = false;
    // Cuándo: 'dia' (día exacto), 'mes' (solo el mes) o 'no' (todavía no: queda pendiente, sin fecha).
    let modo = f.sinFecha || (t && !t.fecha) ? 'no' : f.soloMes ? 'mes' : 'dia';
    // Meses para "Solo el mes": desde el mes anterior hasta dos años adelante (y el que ya tenía).
    const mesesOpc = []; for (let i = -1; i <= 24; i++) mesesOpc.push(shiftYm(hoy().slice(0, 7), i));
    const mesSel = (f.fecha || hoy()).slice(0, 7);
    if (!mesesOpc.includes(mesSel)) mesesOpc.unshift(mesSel);
    const visHTML = () => `<button type="button" class="cr-opt${f.vista ? '' : ' on'}" data-v="0"><b>🔒 Solo el comité</b>Los admins de Mantenimiento, el responsable y el auxiliar.</button><button type="button" class="cr-opt${f.vista ? ' on' : ''}" data-v="1"><b>👁 Todos</b>Aparece en la vista y se piden voluntarios con "Me sumo".</button>`;
    const m = openModal(`<h3>${t ? 'Editar trabajo' : 'Nuevo trabajo'}</h3>
      <div class="tf"><label for="slTit">Qué hay que hacer</label><input id="slTit" maxlength="80" placeholder="Ej.: Pintura de la entrada" value="${esc(f.titulo || '')}"></div>
      <div class="tf"><span class="tlbl">Tipo</span><div class="sl-types" id="slTipo">${Object.entries(C.TIPOS).map(([k, tp]) => `<button type="button" data-k="${k}" class="${f.tipo === k ? 'on' : ''}" style="${f.tipo === k ? 'background:' + tp.color : ''}">${tp.icon} ${tp.label}</button>`).join('')}</div></div>
      <div class="tf" style="margin-bottom:8px;"><span class="tlbl">Cuándo</span><div class="topts" id="slCuando"><button type="button" data-k="dia" class="${modo === 'dia' ? 'on' : ''}">Día exacto</button><button type="button" data-k="mes" class="${modo === 'mes' ? 'on' : ''}">Solo el mes</button><button type="button" data-k="no" class="${modo === 'no' ? 'on' : ''}">Todavía no</button></div></div>
      <div class="trow2${modo === 'dia' ? '' : ' hidden'}" id="slDiaRow"><div class="tf"><label for="slFec">Día</label><input type="date" id="slFec" value="${esc(modo === 'dia' ? (f.fecha || '') : '')}"></div><div class="tf"><label for="slHora">Hora</label><input type="time" id="slHora" value="${esc(f.hora || '')}"></div></div>
      <div class="tf${modo === 'mes' ? '' : ' hidden'}" id="slMesRow"><select id="slMes" aria-label="Mes">${mesesOpc.map(ym => `<option value="${ym}"${ym === mesSel ? ' selected' : ''}>${esc(mesLabel(ym).replace(/^./, c => c.toUpperCase()))}</option>`).join('')}</select><p class="sl-hint">Cuando se acerque le ponés el día. Mientras tanto aparece con "?" en el cronograma y no se le avisa a nadie.</p></div>
      <p class="sl-hint${modo === 'no' ? '' : ' hidden'}" id="slNoRow" style="margin:-2px 2px 12px;">Queda en <b>Pendientes</b> (en Trabajos y abajo del Año). Cuando lo decidan, lo abrís y le ponés el mes o el día.</p>
      <div class="trow2"><div class="tf"><label for="slRespBtn">Responsable <small class="sl-opc">· para publicar</small></label><button type="button" class="sl-pickbtn" id="slRespBtn" data-for="slResp"></button><input type="hidden" id="slResp" value="${esc(f.resp || '')}"></div><div class="tf"><label for="slAuxBtn">Auxiliar <small class="sl-opc">· para publicar</small></label><button type="button" class="sl-pickbtn" id="slAuxBtn" data-for="slAux"></button><input type="hidden" id="slAux" value="${esc(f.aux || '')}"></div></div>
      <div class="trow2"><div class="tf"><label for="slCupo">Voluntarios además</label><input type="number" id="slCupo" min="0" max="30" value="${Number(f.cupo) || 0}"></div><div class="tf"></div></div>
      <div class="tf"><span class="tlbl">Se repite</span><div class="topts" id="slRep">${Object.entries(C.REPITE).map(([k, l]) => `<button type="button" data-k="${k}" class="${(f.repite || 'no') === k ? 'on' : ''}">${k === 'no' ? 'No' : l}</button>`).join('')}</div></div>
      <div class="tf"><label for="slMat">Qué llevar / materiales <small style="text-transform:none;letter-spacing:0;font-weight:400;">(uno por renglón)</small></label><textarea id="slMat" placeholder="Rodillos y pinceles&#10;2 latas de látex blanco">${esc((f.materiales || []).join('\n'))}</textarea></div>
      <div class="tf"><label for="slNotas">Notas</label><textarea id="slNotas" style="min-height:44px;" placeholder="Opcional">${esc(f.notas || '')}</textarea></div>
      <div class="tf"><span class="tlbl">Quién lo ve</span><div class="cr-seg2" id="slVis">${visHTML()}</div><p class="sl-hint">${t ? 'Cada fecha también se puede publicar u ocultar aparte, desde el trabajo.' : 'Lo pueden publicar más adelante, cuando lo decidan.'}</p></div>
      <div class="sl-err" id="slErr"></div>
      <div class="tfoot">${t ? '<button type="button" class="btn btn-danger" id="slDel">Borrar</button>' : ''}<button type="button" class="btn" data-tclose>Cancelar</button><button type="button" class="btn btn-primary" id="slSave">Guardar trabajo</button></div>`);
    m.q('#slTipo').addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]'); if (!b) return; f.tipo = b.dataset.k;
      m.qa('#slTipo button').forEach(x => { const on = x.dataset.k === f.tipo; x.classList.toggle('on', on); x.style.background = on ? C.TIPOS[x.dataset.k].color : ''; });
    });
    // "Solo el mes" no va con "cada 15 días" ni "cada mes": esos necesitan el día.
    const pintarRep = () => m.qa('#slRep button').forEach(x => { x.classList.toggle('on', x.dataset.k === (f.repite || 'no')); x.disabled = modo === 'mes' && (x.dataset.k === '15d' || x.dataset.k === 'mes'); });
    m.q('#slRep').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b || b.disabled) return; f.repite = b.dataset.k; pintarRep(); });
    m.q('#slCuando').addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      modo = b.dataset.k;
      m.qa('#slCuando button').forEach(x => x.classList.toggle('on', x === b));
      m.q('#slDiaRow').classList.toggle('hidden', modo !== 'dia'); m.q('#slMesRow').classList.toggle('hidden', modo !== 'mes'); m.q('#slNoRow').classList.toggle('hidden', modo !== 'no');
      if (modo === 'mes' && (f.repite === '15d' || f.repite === 'mes')) f.repite = 'no';
      pintarRep();
    });
    pintarRep();
    m.q('#slVis').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; f.vista = b.dataset.v === '1'; m.q('#slVis').innerHTML = visHTML(); });
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
      const titulo = m.q('#slTit').value.trim(), resp = m.q('#slResp').value, aux = m.q('#slAux').value;
      const fecha = modo === 'no' ? '' : modo === 'mes' ? (m.q('#slMes').value ? m.q('#slMes').value + '-01' : '') : m.q('#slFec').value;
      // Responsable y auxiliar hacen falta recién para que lo vean todos ("Todos" o "Publicar").
      const err = !titulo ? 'Escribí qué hay que hacer.' : modo !== 'no' && !fecha ? (modo === 'mes' ? 'Elegí el mes.' : 'Elegí el día.')
        : f.vista && (!resp || !aux) ? 'Para que lo vean todos hacen falta responsable y auxiliar. Si todavía no los tienen, dejalo en "Solo el comité".'
        : resp && aux && resp === aux ? 'El responsable y el auxiliar tienen que ser dos hermanos distintos.' : '';
      m.q('#slErr').textContent = err;
      if (err) return;
      const nt = Object.assign({}, t || {}, {
        id: (t && t.id) || newId(), titulo, tipo: f.tipo, fecha, hora: m.q('#slHora').value, resp, aux,
        cupo: Math.max(0, Math.min(30, parseInt(m.q('#slCupo').value, 10) || 0)), repite: f.repite || 'no',
        materiales: m.q('#slMat').value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 30),
        notas: m.q('#slNotas').value.trim(), vista: !!f.vista
      });
      if (modo === 'mes') nt.soloMes = true; else delete nt.soloMes;
      if (modo === 'no') { nt.sinFecha = true; delete nt.fecha; } else delete nt.sinFecha;
      if (!nt.resp) delete nt.resp;
      if (!nt.aux) delete nt.aux;
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
    const sinDia = !!t.soloMes, pub = C.publicado(t, fecha);
    const mesTxt = mesLabel(fecha.slice(0, 7));
    // Quién lo ve: sin día (no se publica todavía), solo el comité (con "Publicar") o en la vista (con "Ocultar").
    const estadoVis = sinDia
      ? `<div class="cr-pub q"><span><b>📅 Falta poner el día</b>Está programado para ${esc(mesTxt)}. Cuando lo sepan, ponele el día: recién ahí les llega el aviso al responsable y al auxiliar.</span><button type="button" class="btn btn-primary" data-d="ponerdia">Poner el día</button></div>`
      : o.cancelada || estado === 'hecho' ? ''
      : pub ? `<div class="cr-pub v"><span><b>👁 Se ve en la vista</b>Lo ven todos los hermanos${ci.cupo ? ' y se pueden anotar con "Me sumo"' : ''}.</span><button type="button" class="btn" data-d="ocultar">Ocultar</button></div>`
      : !t.resp || !t.aux ? `<div class="cr-pub q"><span><b>🙋 Falta ${!t.resp && !t.aux ? 'responsable y auxiliar' : !t.resp ? 'el responsable' : 'el auxiliar'}</b>Lo ve solo el comité. Para publicarlo hace falta elegir${!t.resp && !t.aux ? 'los' : 'lo'}.</span><button type="button" class="btn btn-primary" data-d="editar">Elegir</button></div>`
      : `<div class="cr-pub"><span><b>🔒 Solo lo ve el comité</b>Todavía no aparece en la vista${ci.cupo ? ' ni se pidieron voluntarios' : ''}. El responsable y el auxiliar sí lo ven.</span><button type="button" class="btn btn-primary" data-d="publicar">📢 Publicar</button></div>`;
    if (sinDia) {
      return `<div class="sl-dhero" style="background:${tp.color}"><small>${tp.icon} ${tp.label} · ${esc(mesTxt)} · falta el día</small><b>${esc(t.titulo)}</b><p>${esc(C.REPITE[t.repite || 'no'])}</p></div>${estadoVis}
      <div class="sl-kv" style="margin-bottom:12px;"><div><small>Responsable</small>${kv(t.resp)}</div><div><small>Auxiliar</small>${kv(t.aux)}</div></div>
      ${ci.cupo ? `<div class="tnote">Hacen falta ${ci.cupo} ${ci.cupo === 1 ? 'voluntario' : 'voluntarios'}: se piden cuando tenga el día y lo publiquen.</div>` : ''}
      ${mats.length ? `<div class="sl-sec" style="margin-top:0;"><h4>Qué llevar</h4></div><div class="tnote">${mats.map(esc).join(' · ')}</div>` : ''}
      ${t.notas ? `<div class="tnote">${esc(t.notas)}</div>` : ''}
      <div class="tfoot"><button type="button" class="btn" data-d="editar">Editar trabajo</button><button type="button" class="btn" data-tclose>Cerrar</button></div>`;
    }
    return `<div class="sl-dhero" style="background:${tp.color}"><small>${tp.icon} ${tp.label} · ${esc(fmtDia(fecha))}${t.hora ? ' · ' + esc(t.hora) : ''}</small><b>${esc(t.titulo)}</b><p>${esc(C.REPITE[t.repite || 'no'])}${o.cancelada ? ' · suspendido esta vez' : ''}</p></div>${estadoVis}
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
      else if (k === 'publicar') {
        if (!t.resp || !t.aux) { showToast('Antes de publicarlo, elegí responsable y auxiliar'); openForm(t.id); return; }
        // Si el trabajo es "Todos" y esta vez estaba oculta, alcanza con sacar la excepción.
        if (await setOcc('pub', t.vista !== false ? undefined : true)) { showToast(Number(t.cupo) > 0 ? 'Publicado: ya se ve en la vista y se piden voluntarios' : 'Publicado: ya se ve en la vista'); openDetail.refresh(); render(); }
      }
      else if (k === 'ocultar') {
        const n = C.voluntarios(t, fecha, S.anotados).length;
        if (n && !confirm(`Ya ${n === 1 ? 'hay 1 hermano anotado' : 'hay ' + n + ' hermanos anotados'}. Si lo ocultás deja de verse en la vista (los anotados siguen). ¿Ocultarlo?`)) return;
        if (await setOcc('pub', t.vista === false ? undefined : false)) { showToast('Ahora lo ve solo el comité'); openDetail.refresh(); render(); }
      }
      else if (k === 'ponerdia') ponerDia(t, fecha);
      else if (k === 'agregar') pickPub(t, fecha);
      else if (k === 'wa') shareWa(t, fecha);
      else if (k === 'avisar') avisarExterno(t, fecha, b.dataset.p);
    });
  }
  // "Poner el día" a un trabajo que tenía solo el mes. Si se repite, las próximas veces quedan ese mismo día del mes.
  function ponerDia(t, fecha) {
    const ym = fecha.slice(0, 7);
    const ult = C.isoOf(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0, 12));
    const m = openModal(`<h3>Poner el día</h3><p class="modal-sub" style="margin:0 0 10px;">${esc(t.titulo)} · ${esc(mesLabel(ym))}</p>
      <div class="trow2"><div class="tf"><label for="slPdF">Día</label><input type="date" id="slPdF" min="${ym}-01" max="${ult}" value=""></div><div class="tf"><label for="slPdH">Hora</label><input type="time" id="slPdH" value="${esc(t.hora || '09:00')}"></div></div>
      ${t.repite && t.repite !== 'no' ? `<p class="sl-hint" style="margin:-4px 2px 10px;">Las próximas veces (${esc(C.REPITE[t.repite].toLowerCase())}) quedan para el mismo día del mes. Después se puede cambiar cada una.</p>` : ''}
      <div class="sl-err" id="slPdE"></div>
      <div class="tfoot"><button type="button" class="btn" data-tclose>Cancelar</button><button type="button" class="btn btn-primary" id="slPdOk">Guardar</button></div>`);
    m.q('#slPdOk').addEventListener('click', async () => {
      const dia = m.q('#slPdF').value;
      if (!dia || dia.slice(0, 7) !== ym) { m.q('#slPdE').textContent = `Elegí un día de ${mesLabel(ym)}.`; return; }
      // Mismo "desfase" que tenía: la fecha base se corre a ese día del mes (en el mes de la primera vez).
      const [y0, m0] = t.fecha.slice(0, 7).split('-').map(Number), [y1, m1] = ym.split('-').map(Number);
      const base = C.addMonths(dia, -((y1 - y0) * 12 + (m1 - m0)));
      const hora = m.q('#slPdH').value;
      const ok = await safe(() => sWrite(sRef('trabajos'), [[['lista', t.id, 'fecha'], base], [['lista', t.id, 'hora'], hora], [['lista', t.id, 'soloMes'], undefined]]), `Listo: queda para el ${fmtDia(dia)}. Se les avisó al responsable y al auxiliar.`);
      if (!ok) return;
      const cur = S.trabajos[t.id]; if (cur) { cur.fecha = base; cur.hora = hora; delete cur.soloMes; }
      m.close(); if (openDetail) openDetail.close(); render();
      openTrabajo(t.id, dia);
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
      // Es para el tablero: solo lo publicado (lo del comité y lo que no tiene día no va).
      const occ = C.trabajosEntre(S.trabajos, desde, hasta).filter(o => !o.cancelada && o.pub && !o.sinDia);
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
    const views = [['cal', 'Calendario'], ['trab', 'Trabajos'], ['anio', 'Año'], ['limp', 'Limpieza']];
    const seg = `<div class="tseg" role="tablist">${views.map(([k, l]) => `<button type="button" role="tab" class="${k === S.view ? 'on' : ''}" aria-selected="${k === S.view}" data-s="view" data-k="${k}">${l}</button>`).join('')}</div>`;
    root.innerHTML = seg + '<div id="salonView"></div>';
    const v = $('salonView');
    if (!S.loaded.trabajos || !S.loaded.limpieza || !S.loaded.grupos) { v.innerHTML = '<div class="tempty">Cargando…</div>'; return; }
    if (S.view === 'trab') renderTrabajos(v);
    else if (S.view === 'anio') renderAnio(v);
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
    else if (k === 'a-mes') { S.aStart = shiftYm(S.aStart || hoy().slice(0, 7), Number(b.dataset.d)); S.aOpen = {}; render(); }
    else if (k === 'a-tog') { if (!S.aOpen) S.aOpen = {}; S.aOpen[b.dataset.m] = b.getAttribute('aria-expanded') !== 'true'; render(); }
    else if (k === 'a-pdf') openCronoPdf();
    else if (k === 'a-fil') { S.aFiltro = b.dataset.k; render(); }
    else if (k === 'hizo') seHizo(b.dataset.id, b.dataset.f);
    else if (k === 'pend') { S.view = 'trab'; render(); setTimeout(() => { const e = $('slPend'); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50); }
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
    const occ = C.trabajosEntre(S.trabajos, today, C.addDays(today, 30)).filter(o => !o.cancelada && o.estado !== 'hecho' && !o.sinDia);
    const buscan = occ.filter(o => o.pub).map(o => ({ o, ci: C.cupoInfo(o.t, o.fecha, S.anotados) })).filter(x => x.ci.cupo && x.ci.faltan);
    // Para decidir: los que piden voluntarios en las próximas 2 semanas y siguen siendo solo del comité,
    // y los que tienen solo el mes y ese mes ya es este o el que viene.
    const sinResp = occ.filter(o => (!o.t.resp || !o.t.aux) && o.fecha <= C.addDays(today, 14))
      .map(o => ({ id: o.t.id, titulo: o.t.titulo || 'Trabajo', fecha: o.fecha, falta: !o.t.resp && !o.t.aux ? 'responsable y auxiliar' : !o.t.resp ? 'responsable' : 'auxiliar' }));
    const porPublicar = occ.filter(o => !o.pub && o.t.resp && o.t.aux && o.fecha <= C.addDays(today, 14) && Number(o.t.cupo) > 0)
      .map(o => ({ id: o.t.id, titulo: o.t.titulo || 'Trabajo', fecha: o.fecha, cupo: Number(o.t.cupo) }));
    const vistos = new Set();
    const sinDia = C.trabajosEntre(S.trabajos, today.slice(0, 7) + '-01', shiftYm(today.slice(0, 7), 1) + '-31').filter(o => o.sinDia && !o.cancelada && !vistos.has(o.t.id) && vistos.add(o.t.id))
      .map(o => ({ id: o.t.id, titulo: o.t.titulo || 'Trabajo', fecha: o.fecha, mes: mesLabel(o.fecha.slice(0, 7)) }));
    let vacias = 0, primeraVacia = null;
    for (let i = 0, m = mon; i < 6; i++, m = C.addDays(m, 7)) {
      const falta = claves().some(k => !C.quienLimpia(S.limpieza, m, k));
      if (falta) { vacias++; if (!primeraVacia) primeraVacia = m; }
    }
    const hayLimpieza = !!(S.limpieza && (S.limpieza.semanas || S.limpieza.inicio || S.limpieza.tipos)) && Object.keys(S.grupos).length > 0;
    return { loaded: S.loaded.trabajos && S.loaded.limpieza && S.loaded.grupos, limpiaEsta: lz ? lz.nombre : '', trabajos: occ.length,
      buscan: buscan.length, faltan: buscan.reduce((n, x) => n + x.ci.faltan, 0), hayLimpieza, vacias: hayLimpieza ? vacias : 0, primeraVacia,
      // Los de esta semana que todavía necesitan voluntarios (para "Para resolver" del Admin — Mantenimiento).
      porPublicar, sinDia, sinResp, pendientes: pendientesDe().length,
      pronto: buscan.filter(x => x.o.fecha <= C.addDays(today, 7)).map(x => ({ titulo: x.o.t.titulo || 'Trabajo', fecha: x.o.fecha, faltan: x.ci.faltan })) };
  };
  window.salonOpenTrabajo = function (id, f) { if (S.view !== 'anio' && S.view !== 'trab') S.view = 'trab'; switchTab('salon'); openTrabajo(id, f); };
  window.salonGoLimpieza = function (m) { S.view = 'limp'; S.lAjustes = false; if (m) S.lMonth = C.semanaDelMes(m).mes; switchTab('salon'); };

  if (typeof currentUserRole !== 'undefined' && typeof applyRoleUI === 'function' && currentUser) { try { window.salonOnRole(); } catch (e) { /* nada */ } }
})();
