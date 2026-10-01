// Pestaña Salón: calendario de trabajos del Salón (responsable y auxiliar obligatorios, voluntarios,
// repetición, estado) y limpieza por grupos. Con un Firestore simulado en memoria.
const { launch, FILE, SHOTS, fixture } = require('./_helper');
const { installMock } = require('./_mock-firestore');
const path = require('path');
const fs = require('fs');
const data = fixture();
Object.assign(data.settings, { editorEmails: ['hugo@x.com'], salonAdminEmails: ['salon@x.com'], viewerEmails: ['ver@x.com'] });
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 500)); } };

(async () => {
  const b = await launch();
  async function open(email, store, opts) {
    const ctx = await b.newContext({ viewport: opts && opts.viewport || { width: 390, height: 844 }, acceptDownloads: true });
    const jd = process.env.JSPDF_DIR;   // para probar el PDF sin internet (como en 22-territorios-mapa)
    if (jd) {
      await ctx.route(/jspdf\.umd\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(jd, 'jspdf.umd.min.js')) }));
      await ctx.route(/jspdf\.plugin\.autotable\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(jd, 'jspdf.plugin.autotable.min.js')) }));
    }
    await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); localStorage.setItem('kh-welcome-salon', '1'); window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; window.confirm = () => true; window.__errs = []; window.addEventListener('error', (e) => window.__errs.push(String(e.message))); }, data);
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.goto(FILE); await p.waitForTimeout(700);
    await p.evaluate(async ({ store, email, mock }) => {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
      window.__store = store;
      eval('(' + mock + ')')(store, email);
      await startSync('C');
    }, { store, email, mock: installMock.toString() });
    await p.waitForTimeout(400);
    return p;
  }
  const grupos = { lista: {
    g1: { id: 'g1', nombre: 'Grupo 1', encargado: 'p1', miembros: ['p1', 'p2'] }, g2: { id: 'g2', nombre: 'Grupo 2', encargado: 'p3', miembros: ['p3', 'p0'] },
    g3: { id: 'g3', nombre: 'Grupo 3', encargado: 'p5', miembros: ['p5'] } } };
  const store = { docs: { 'congregations/C': JSON.parse(JSON.stringify(data)), 'congregations/C/terr/grupos': grupos }, writes: [], uploads: [] };
  const click = async (p, sel) => { await p.click(sel); await p.waitForTimeout(150); };
  const modal = (p) => p.locator('.slmodal').last();
  // Elegir responsable o auxiliar con la ventana de búsqueda (buscando por nombre).
  const elegir = async (p, campo, nombre, tab) => {
    await click(p, `#${campo}Btn`);
    if (tab) await click(p, `.sl-chooser .sl-seg [data-k="${tab}"]`);
    await p.fill('.sl-chooser #slQ', nombre); await p.waitForTimeout(80);
    await click(p, '.sl-chooser .tpick[data-id]');
  };

  console.log('\nSuper Admin');
  let p = await open('hugo@x.com', store);
  check('ve la pestaña Salón', await p.evaluate(() => !document.querySelector('.bottom-tabs .tab-btn[data-tab="salon"]').classList.contains('hidden')));
  await click(p, '.bottom-tabs .tab-btn[data-tab="salon"]');
  check('Calendario · Trabajos · Limpieza', await p.evaluate(() => [...document.querySelectorAll('#salonRoot .tseg button')].map(x => x.textContent).join(',') === 'Calendario,Trabajos,Limpieza'));
  check('muestra septiembre 2026 y explica cómo empezar', await p.evaluate(() => /septiembre 2026/i.test($('salonRoot').innerText) && /Todavía no hay trabajos programados/.test($('salonRoot').innerText)));

  // Nuevo trabajo: responsable y auxiliar obligatorios
  await click(p, '#salonRoot .sl-sec [data-s="new"]');
  await p.fill('#slTit', 'Pintura de la entrada');
  await p.fill('#slFec', '2026-09-26'); await p.fill('#slHora', '09:00');
  await click(p, '#slRespBtn');
  check('responsable: ventana con buscador y las dos pestañas', await p.evaluate(() => !!document.querySelector('.sl-chooser #slQ') && document.querySelectorAll('.sl-chooser .sl-seg button').length === 2 && document.querySelectorAll('.sl-chooser .tpick[data-id]').length === 16));
  await p.fill('.sl-chooser #slQ', 'gom'); await p.waitForTimeout(80);
  await p.screenshot({ path: path.join(SHOTS, 'salon-elegir.png') });
  check('el buscador filtra (sin acentos)', await p.evaluate(() => { const r = [...document.querySelectorAll('.sl-chooser .tpick[data-id]')].map(b => b.textContent.trim()); return r.length === 1 && r[0] === 'Lucas Gómez'; }));
  await click(p, '.sl-chooser .tpick[data-id="p2"]');
  check('queda elegido en el botón', await p.evaluate(() => $('slResp').value === 'p2' && /Lucas Gómez/.test($('slRespBtn').textContent)));
  await click(p, '#slSave');
  check('sin auxiliar no deja guardar', await p.evaluate(() => /auxiliar/.test($('slErr').textContent) && !Object.keys(window.__salon.trabajos).length));
  await click(p, '#slAuxBtn');
  check('para auxiliar no ofrece al que ya es responsable', await p.evaluate(() => !document.querySelector('.sl-chooser .tpick[data-id="p2"]')));
  await p.keyboard.press('Escape');
  await elegir(p, 'slAux', 'mario');
  await p.fill('#slCupo', '3');
  await p.fill('#slMat', 'Rodillos\nLátex blanco');
  await click(p, '#slSave'); await p.waitForTimeout(200);
  const t1 = await p.evaluate(() => Object.values(window.__salon.trabajos)[0]);
  check('trabajo guardado en salon/trabajos', t1 && t1.titulo === 'Pintura de la entrada' && t1.resp === 'p2' && t1.aux === 'p11' && t1.cupo === 3 && t1.materiales.length === 2 && t1.vista === true && !!store.docs, t1);
  check('aparece en Esta semana con responsable y auxiliar', await p.evaluate(() => { const h = document.querySelector('.sl-hero'); return h && /Pintura de la entrada/.test(h.innerText) && /Gómez/.test(h.innerText) && /Díaz/.test(h.innerText) && /faltan 3/.test(h.innerText); }));
  check('punto de color en el día 26', await p.evaluate(() => document.querySelector('.sl-d[data-f="2026-09-26"] .sl-dots i') !== null));

  // Trabajo que se repite
  await click(p, '#salonRoot .sl-sec [data-s="new"]');
  await p.fill('#slTit', 'Corte de pasto');
  await click(p, '#slTipo [data-k="jardin"]');
  await p.fill('#slFec', '2026-09-24');
  await elegir(p, 'slResp', 'bravo'); await elegir(p, 'slAux', 'pablo');
  await click(p, '#slRep [data-k="15d"]');
  await click(p, '#slSave'); await p.waitForTimeout(200);
  await click(p, '#salonRoot [data-s="mes"][data-d="1"]');
  check('cada 15 días: aparece solo en octubre (8 y 22)', await p.evaluate(() => ['2026-10-08', '2026-10-22'].every(f => document.querySelector(`.sl-d[data-f="${f}"] .sl-dots i`)) && !document.querySelector('.sl-d[data-f="2026-10-15"] .sl-dots i')));
  await click(p, '#salonRoot [data-s="mes"][data-d="-1"]');

  // Detalle
  const tid = t1.id;
  store.docs[`congregations/C/salonAnotados/${tid}__2026-09-26__u1`] = { tid, fecha: '2026-09-26', pubId: 'p6', nombre: 'Diego Fernández', uid: 'u1', comentario: 'Llevo la escalera', at: 'x' };
  await p.evaluate(() => window.__store && 0);
  await click(p, `#salonRoot .sl-ev[data-id="${tid}"]`);
  await p.waitForTimeout(150);
  await p.waitForTimeout(100);
  check('abrir el detalle no anota errores', await p.evaluate(() => !window.__errs.length), await p.evaluate(() => window.__errs));
  check('una ventana sin id no rompe el foco', await p.evaluate(() => { try { focusFirstIn(''); return true; } catch (e) { return false; } }));
  const det = await modal(p).innerText();
  check('detalle: estado, responsable, auxiliar y voluntarios', /Programado/.test(det) && /Lucas Gómez/.test(det) && /Mario Díaz/.test(det) && /Voluntarios/i.test(det), det.slice(0, 400));
  await p.screenshot({ path: path.join(SHOTS, 'salon-detalle.png') });
  await click(p, '.slmodal [data-d="agregar"]');
  await click(p, '.slmodal:last-of-type .tpick[data-id="p9"]');
  await p.waitForTimeout(200);
  check('agregar hermano a mano', await p.evaluate((tid) => (window.__salon.trabajos[tid].ocurr['2026-09-26'].vols || []).includes('p9'), tid));
  await click(p, '.slmodal [data-d="wa"]');
  check('pedir por WhatsApp con lo que falta y el link de la vista', await p.evaluate(() => { const u = decodeURIComponent(window.__opened.pop() || ''); return /wa\.me/.test(u) && /Pintura de la entrada/.test(u) && /Hacen falta/.test(u) && /ver\/ver\.html\?codigo=C/.test(u); }));
  await click(p, '.slmodal [data-d="estado"][data-k="hecho"]');
  check('marcar como hecho', await p.evaluate((tid) => window.__salon.trabajos[tid].ocurr['2026-09-26'].estado === 'hecho', tid));
  await p.keyboard.press('Escape');

  // Limpieza por grupos: ajustes
  await click(p, '#salonRoot [data-s="view"][data-k="limp"]');
  check('limpieza sin responsable ni auxiliar; mes de septiembre', await p.evaluate(() => !/Responsable|Auxiliar/.test($('salonRoot').innerText) && /septiembre 2026/i.test($('salonRoot').innerText)));
  await click(p, '#salonRoot [data-s="lz-ajustes"]');
  await click(p, '#salonRoot [data-s="rot-add"][data-g="g2"]');
  await click(p, '#salonRoot [data-s="rot-add"][data-g="g3"]');
  await click(p, '#salonRoot [data-s="rot-add"][data-g="g1"]');
  await click(p, '#salonRoot [data-s="rot-up"][data-i="2"]');
  check('orden para sugerir', await p.evaluate(() => JSON.stringify(window.__salon.limpieza.rotacion) === '["g2","g1","g3"]'));
  await click(p, '#salonRoot [data-s="otra"][data-n="4"]'); await p.waitForTimeout(100);
  check('semanas de la otra congregación', await p.evaluate(() => JSON.stringify(window.__salon.limpieza.otra) === '[4]'));
  await p.fill('#slOtraN', 'Paraná Sur'); await p.dispatchEvent('#slOtraN', 'change'); await p.waitForTimeout(150);
  check('nombre de la otra congregación guardado una vez', await p.evaluate(() => window.__salon.limpieza.otraNombre === 'Paraná Sur'));
  await click(p, '#salonRoot [data-s="lz-tipo"][data-i="-1"]');
  await p.fill('#lzT', 'Vidrios\nSillas a fondo\nCocina');
  await click(p, '#lzOk'); await p.waitForTimeout(150);
  const tps = await p.evaluate(() => window.__salon.limpieza.tipos);
  check('dos limpiezas: después de las reuniones y la general del sábado 9:00 (mismo grupo)', tps && tps.length === 2 && tps[0].modo === 'reunion' && tps[1].nombre === 'Limpieza general' && tps[1].modo === 'semana' && tps[1].dia === 6 && tps[1].hora === '09:00' && tps[1].mismoGrupo === true && tps[1].tareas.length === 3, tps);
  await click(p, '#salonRoot [data-s="lz-volver"]');

  // El mes, semana por semana
  const filas = () => p.evaluate(() => [...document.querySelectorAll('#salonRoot .sl-wk')].map(d => d.innerText.replace(/\s+/g, ' ')));
  let fs1 = await filas();
  check('cuatro semanas en septiembre; la 4 la limpia Paraná Sur', fs1.length === 4 && /Sin cargar/.test(fs1[0]) && /Paraná Sur Compartido/.test(fs1[3]), fs1);
  await click(p, '#salonRoot .sl-wkm[data-m="2026-09-07"]');
  check('elegir: grupos con hace cuánto limpiaron, la otra congregación y "Sin limpieza"', await p.evaluate(() => { const t = document.querySelector('.sl-chooser').innerText; return /Grupo 2/.test(t) && /Todavía no limpió/.test(t) && /Paraná Sur/.test(t) && /Sin limpieza/.test(t); }));
  await click(p, '.sl-chooser .tpick[data-v="g3"]');
  check('cargado a mano: Grupo 3 (sin marca de sugerido)', await p.evaluate(() => { const w = window.__salon.limpieza.semanas['2026-09-07']; return w.g === 'g3' && !w.s; }));
  fs1 = await filas();
  check('la semana muestra las dos limpiezas con sus días', /Grupo 3 ✓ Cargado/.test(fs1[1]) && /Reuniones jue 10 y dom 13/.test(fs1[1]) && /General sáb 12 · 09:00/.test(fs1[1]), fs1[1]);
  await click(p, '#salonRoot [data-s="lz-sug"]'); await p.waitForTimeout(150);
  let sem = await p.evaluate(() => window.__salon.limpieza.semanas);
  check('Sugerir completa solo las vacías, parejo (Grupo 2 y después Grupo 1)', sem['2026-08-31'].g === 'g2' && sem['2026-08-31'].s && sem['2026-09-14'].g === 'g1' && sem['2026-09-07'].g === 'g3' && !sem['2026-09-21'], sem);
  check('aviso con "Deshacer"', await p.evaluate(() => /Se completaron 2 semanas/.test(document.querySelector('.sl-undo').innerText)));
  await click(p, '#salonRoot [data-s="lz-undo"]');
  sem = await p.evaluate(() => window.__salon.limpieza.semanas);
  check('Deshacer vuelve atrás la sugerencia', Object.keys(sem).join() === '2026-09-07', sem);
  await click(p, '#salonRoot [data-s="lz-sug"]');
  // Días de una semana suelta
  await click(p, '#salonRoot .sl-wkm[data-m="2026-09-14"]');
  await click(p, '.sl-chooser #lzDias');
  await modal(p).locator('input[type="date"]').nth(2).fill('2026-09-18');
  await click(p, '#lzDok');
  check('cambiar los días solo esa semana', await p.evaluate(() => JSON.stringify(window.__salon.limpieza.semanas['2026-09-14'].d[window.__salon.limpieza.tipos[1].id]) === '["2026-09-18"]' && /General vie 18/.test(document.getElementById('lz-2026-09-14').innerText.replace(/\s+/g, ' '))));
  // Si la general pasa a tener su propio grupo
  await click(p, '#salonRoot [data-s="lz-ajustes"]');
  await p.uncheck('#salonRoot [data-s="lz-mismo"][data-i="1"]'); await p.waitForTimeout(150);
  await click(p, '#salonRoot [data-s="lz-volver"]');
  check('con su propio grupo: un renglón aparte para elegir', await p.evaluate(() => /General Sin cargar · Elegir/.test(document.getElementById('lz-2026-09-07').innerText.replace(/\s+/g, ' '))));
  await click(p, '#salonRoot .sl-l2b[data-m="2026-09-07"]');
  check('no sugiere al grupo que ya tiene la otra limpieza esa semana', await p.evaluate(() => { const b = document.querySelector('.sl-chooser .tpick[data-v="g3"]'); return /ya tiene otra limpieza/.test(b.innerText) && !/✨/.test(b.innerText); }));
  await click(p, '.sl-chooser .tpick[data-v="g2"]');
  check('se guarda aparte', await p.evaluate(() => window.__salon.limpieza.semanas['2026-09-07'].x[window.__salon.limpieza.tipos[1].id].g === 'g2' && window.__salon.limpieza.semanas['2026-09-07'].g === 'g3'));
  await click(p, '#salonRoot [data-s="lz-ajustes"]');
  await p.check('#salonRoot [data-s="lz-mismo"][data-i="1"]'); await p.waitForTimeout(150);
  await click(p, '#salonRoot [data-s="lz-volver"]');
  // Copiar el mes anterior
  await click(p, '#salonRoot [data-s="lz-mes"][data-d="1"]');
  await click(p, '#salonRoot [data-s="lz-copy"]');
  sem = await p.evaluate(() => window.__salon.limpieza.semanas);
  check('Copiar septiembre en octubre (sin pisar la semana compartida)', sem['2026-09-28'].g === 'g2' && sem['2026-10-05'].g === 'g3' && sem['2026-10-12'].g === 'g1' && !sem['2026-10-19'] && /Se copiaron 3 semanas/.test(await p.evaluate(() => document.querySelector('.sl-undo').innerText)), sem);
  await p.screenshot({ path: path.join(SHOTS, 'salon-limpieza.png'), fullPage: true });
  // PDF
  if (await p.evaluate(() => !!window.jspdf)) {
    await click(p, '#salonRoot [data-s="lz-pdf"]');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#pdfOk')]);
    const txt = fs.readFileSync(await dl.path()).toString('latin1');
    if (process.env.PDF_OUT) fs.writeFileSync(process.env.PDF_OUT, fs.readFileSync(await dl.path()));
    check('PDF: octubre y noviembre, con las semanas, los días y los grupos', dl.suggestedFilename() === 'Limpieza octubre 2026 - noviembre 2026.pdf' && /noviembre 2026/.test(txt) && /Grupo 3/.test(txt) && /Paran/.test(txt) && /Vidrios/.test(txt), dl.suggestedFilename());
    check('antes del PDF, sugirió las semanas que faltaban', await p.evaluate(() => !!window.__salon.limpieza.semanas['2026-10-26'] && !!window.__salon.limpieza.semanas['2026-11-16']));
  } else console.log('  (sin jsPDF en este entorno: se salta el PDF)');
  await click(p, '#salonRoot [data-s="lz-ajustes"]');

  // Salón compartido: hermanos de otra congregación que no usa la app
  await click(p, '#salonRoot [data-s="x-new"]');
  check('hermano nuevo: la congregación ya viene escrita', await p.evaluate(() => $('slXc').value === 'Paraná Sur' && /Hermano de Paraná Sur/.test(document.querySelector('.slmodal:last-of-type h3').textContent)));
  await p.fill('#slXn', 'Juan Ramírez'); await p.fill('#slXc', 'Sur'); await p.fill('#slXt', '342 555-1234');
  await click(p, '#slXs');
  const ext = await p.evaluate(() => Object.values(window.__salon.externos));
  check('lista de otra congregación en salon/externos (con teléfono)', ext.length === 1 && ext[0].nombre === 'Juan Ramírez' && ext[0].cong === 'Sur' && ext[0].tel === '342 555-1234' && /Juan Ramírez/.test(await p.evaluate(() => $('salonRoot').innerText)), ext);
  await click(p, '#salonRoot [data-s="view"][data-k="cal"]');
  await click(p, '#salonRoot .sl-sec [data-s="new"]');
  await p.fill('#slTit', 'Arreglar canaletas'); await p.fill('#slFec', '2026-10-03');
  await elegir(p, 'slResp', 'vega');
  await click(p, '#slAuxBtn'); await click(p, '.sl-chooser .sl-seg [data-k="otra"]');
  check('pestaña "Paraná Sur" con Ramírez y "Agregar…"', await p.evaluate(() => /Paraná Sur/.test(document.querySelector('.sl-chooser .sl-seg [data-k="otra"]').textContent) && /Juan Ramírez/.test(document.querySelector('.sl-chooser .tlist').innerText) && !!document.querySelector('.sl-chooser .tpick[data-new]')));
  await click(p, '.sl-chooser .tpick[data-new]'); await p.waitForTimeout(150);
  await p.fill('#slXn', 'Carlos Peralta'); await p.fill('#slXc', 'Sur');
  await click(p, '#slXs');
  check('"Agregar…" desde la ventana lo carga y lo deja elegido', await p.evaluate(() => { const v = document.getElementById('slAux').value; return v.startsWith('x:') && /Carlos Peralta/.test($('slAuxBtn').textContent) && /Cong\. Sur/.test($('slAuxBtn').textContent); }));
  await click(p, '#slSave'); await p.waitForTimeout(200);
  const t3 = await p.evaluate(() => Object.values(window.__salon.trabajos).find(t => t.titulo === 'Arreglar canaletas'));
  check('el trabajo guarda nombre y congregación del de afuera, sin el teléfono', t3 && t3.aux.startsWith('x:') && t3.externos[t3.aux].nombre === 'Carlos Peralta' && t3.externos[t3.aux].cong === 'Sur' && !('tel' in t3.externos[t3.aux]), t3);
  await click(p, `#salonRoot .sl-ev[data-id="${t3.id}"]`);
  check('detalle: auxiliar con la marca "Cong. Sur"', await p.evaluate(() => /Carlos Peralta\s*Cong\. Sur/.test(document.querySelector('.slmodal').innerText)));
  await click(p, '.slmodal [data-d="agregar"]');
  await click(p, '.slmodal:last-of-type .sl-seg [data-k="otra"]');
  await click(p, '.slmodal:last-of-type .tpick[data-id^="x:"]');
  await p.waitForTimeout(200);
  check('voluntario de la otra congregación con "💬 Avisar"', await p.evaluate(() => /Juan Ramírez/.test(document.querySelector('.sl-detail').innerText) && !!document.querySelector('.sl-detail .sl-wa[data-d="avisar"]')));
  await click(p, '.sl-detail .sl-row .sl-wa[data-d="avisar"]');
  check('"Avisar" abre WhatsApp a su número con el trabajo', await p.evaluate(() => { const u = decodeURIComponent(window.__opened.pop() || ''); return /wa\.me\/5493425551234\?text=/.test(u) && /Arreglar canaletas/.test(u) && /uno de los voluntarios/.test(u); }));
  await p.screenshot({ path: path.join(SHOTS, 'salon-otra-congregacion.png') });
  await p.keyboard.press('Escape');
  await click(p, '#salonRoot [data-s="view"][data-k="cal"]');
  await p.screenshot({ path: path.join(SHOTS, 'salon-calendario.png'), fullPage: true });
  check('los 7 botones de abajo entran en el celular', await p.evaluate(() => [...document.querySelectorAll('.bottom-tabs .tab-btn:not(.hidden)')].every(b => b.scrollWidth <= b.clientWidth + 1) && document.documentElement.scrollWidth <= 390));
  check('próximos: una vez por trabajo', await p.evaluate(() => [...document.querySelectorAll('#salonRoot .sl-ev')].filter(e => /Corte de pasto/.test(e.innerText)).length === 1));
  check('sin errores', !p.errs.length, p.errs);
  Object.assign(store, await p.evaluate(() => window.__store));
  await p.context().close();

  console.log('\nAdmin — Salón');
  p = await open('salon@x.com', store);
  const tabs = await p.evaluate(() => [...document.querySelectorAll('.bottom-tabs .tab-btn[data-tab]')].filter(b => !b.classList.contains('hidden')).map(b => b.dataset.tab));
  check('solo ve la pestaña Salón', JSON.stringify(tabs) === '["salon"]', tabs);
  check('abre directo en Salón', await p.evaluate(() => !$('panel-salon').classList.contains('hidden') && /Corte de pasto/.test($('salonRoot').innerText)));
  check('sin errores', !p.errs.length, p.errs);
  await p.context().close();

  console.log('\nComputadora');
  p = await open('hugo@x.com', store, { viewport: { width: 1280, height: 900 } });
  await click(p, '.tabs .tab-btn[data-tab="salon"]');
  check('calendario a la izquierda y lo de la semana a la derecha', await p.evaluate(() => { const c = document.querySelector('.a-cal').getBoundingClientRect(), h = document.querySelector('.a-rest').getBoundingClientRect(); return c.width > 450 && h.left > c.right - 2; }));
  check('en cada día se lee el nombre del trabajo', await p.evaluate(() => { const e = document.querySelector('.sl-d[data-f="2026-09-24"] .sl-labs em'); return e && getComputedStyle(e).display !== 'none' && /Corte de pasto/.test(e.textContent); }));
  await p.screenshot({ path: path.join(SHOTS, 'salon-pc-calendario.png') });
  await click(p, '#salonRoot [data-s="view"][data-k="limp"]');
  check('limpieza: semanas y, al costado, el resumen de los grupos', await p.evaluate(() => { const s = document.querySelector('.sl-lzside'); return s && getComputedStyle(s).display !== 'none' && /Grupo 2/.test(s.innerText) && s.getBoundingClientRect().left > document.querySelector('.sl-lzmain').getBoundingClientRect().right - 2; }));
  await p.screenshot({ path: path.join(SHOTS, 'salon-pc-limpieza.png') });
  check('sin errores', !p.errs.length, p.errs);
  await p.context().close();

  console.log('\nSolo ver');
  p = await open('ver@x.com', store);
  check('no ve la pestaña Salón', await p.evaluate(() => [...document.querySelectorAll('.tab-btn[data-tab="salon"]')].every(b => b.classList.contains('hidden'))));
  await p.context().close();

  await b.close();
  console.log(`\n${ok} OK, ${bad} fallaron`);
  process.exitCode = bad ? 1 : 0;
})();
