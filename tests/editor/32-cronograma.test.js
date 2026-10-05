// Cronograma de mantenimiento: vista "Año" (computadora y celular), trabajos "Solo el comité" que se publican
// cuando lo deciden (por fecha), trabajos con "Solo el mes" y "Poner el día", repeticiones nuevas, PDF y el Panel.
const { launch, FILE, SHOTS, fixture } = require('./_helper');
const { installMock } = require('./_mock-firestore');
const path = require('path');
const fs = require('fs');
const C = require('../../salon-core');
const data = fixture();
Object.assign(data.settings, { editorEmails: ['hugo@x.com'], salonAdminEmails: ['salon@x.com'] });
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 500)); } };

console.log('\nRepeticiones y publicación (salon-core)');
check('cada 6 meses y cada año', JSON.stringify(C.fechasDe({ fecha: '2026-11-21', repite: '6m' }, '2026-01-01', '2027-12-31')) === '["2026-11-21","2027-05-21","2027-11-21"]' && JSON.stringify(C.fechasDe({ fecha: '2026-11-07', repite: 'anio' }, '2026-01-01', '2028-12-31')) === '["2026-11-07","2027-11-07","2028-11-07"]');
check('cada 2 meses', C.fechasDe({ fecha: '2026-10-10', repite: '2m' }, '2026-10-01', '2027-02-28').join() === '2026-10-10,2026-12-10,2027-02-10');
check('"Solo el comité" (vista: false) no se publica; los de antes (sin "vista") sí', !C.publicado({ vista: false }, 'x') && C.publicado({}, 'x') && C.publicado({ vista: true }, 'x'));
check('cada fecha se publica u oculta aparte', C.publicado({ vista: false, ocurr: { a: { pub: true } } }, 'a') && !C.publicado({ vista: true, ocurr: { a: { pub: false } } }, 'a') && !C.publicado({ vista: false, ocurr: { a: { pub: true } } }, 'b'));
check('sin día: nunca publicado ni en las asignaciones', !C.publicado({ vista: true, soloMes: true }, 'x') && !C.asignacionesSalon('p1', { t: { id: 't', titulo: 'X', fecha: '2026-10-01', soloMes: true, resp: 'p1', aux: 'p2' } }, {}, null, {}, null, '2026-09-01', '2026-12-31').length);

(async () => {
  const b = await launch();
  async function open(email, store, vp) {
    const ctx = await b.newContext({ viewport: vp || { width: 1280, height: 900 }, acceptDownloads: true });
    const jd = process.env.JSPDF_DIR;
    if (jd) {
      await ctx.route(/jspdf\.umd\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(jd, 'jspdf.umd.min.js')) }));
      await ctx.route(/jspdf\.plugin\.autotable\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(jd, 'jspdf.plugin.autotable.min.js')) }));
    }
    await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); localStorage.setItem('kh-welcome-salon', '1'); window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; window.confirm = () => true; }, data);
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.goto(FILE); await p.waitForTimeout(700);
    await p.evaluate(async ({ store, email, mock }) => {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
      window.__store = store;
      eval('(' + mock + ')')(store, email);
      await startSync('C');
    }, { store, email, mock: installMock.toString() });
    await p.waitForTimeout(400);
    await p.evaluate(() => { const o = $('onboardingOverlay'); if (o) o.classList.add('hidden'); });
    return p;
  }
  const click = async (p, sel) => { await p.click(sel); await p.waitForTimeout(150); };
  const T = (o) => Object.assign({ hora: '09:00', cupo: 0, materiales: [], repite: 'no', resp: 'p2', aux: 'p3' }, o);
  const lista = {
    w1: T({ id: 'w1', titulo: 'Corte de pasto', tipo: 'jardin', fecha: '2026-09-19', repite: '15d', cupo: 3, vista: true }),
    w2: T({ id: 'w2', titulo: 'Fumigación', tipo: 'otro', fecha: '2026-10-03', repite: '6m', cupo: 2, vista: false }),
    w3: T({ id: 'w3', titulo: 'Revisión de matafuegos', tipo: 'reparacion', fecha: '2026-10-01', repite: 'anio', vista: false, soloMes: true }),
    w4: T({ id: 'w4', titulo: 'Limpieza profunda', tipo: 'profunda', fecha: '2026-12-05', cupo: 10, vista: false })
  };
  const store = { docs: { 'congregations/C': JSON.parse(JSON.stringify(data)), 'congregations/C/terr/grupos': { lista: { g1: { id: 'g1', nombre: 'Grupo 1', miembros: ['p1'] } } },
    'congregations/C/salon/trabajos': { lista }, 'congregations/C/salon/limpieza': { rotacion: ['g1'], semanas: {} } }, writes: [], uploads: [] };
  let p;
  const tr = () => p.evaluate(() => window.__store.docs['congregations/C/salon/trabajos'].lista);

  console.log('\nAño en la computadora');
  p = await open('hugo@x.com', store);
  await p.evaluate(() => switchTab('salon'));
  check('cuatro opciones: Calendario · Trabajos · Año · Limpieza', await p.evaluate(() => [...document.querySelectorAll('#salonRoot .tseg button')].map(x => x.textContent).join() === 'Calendario,Trabajos,Año,Limpieza'));
  await click(p, '#salonRoot [data-s="view"][data-k="anio"]');
  const g = await p.evaluate(() => ({
    rango: document.querySelector('.cr-head h3 small').textContent,
    meses: [...document.querySelectorAll('.cr-pc .cr-grid > .h')].slice(1).map(x => x.firstChild.textContent).join(),
    filas: [...document.querySelectorAll('.cr-pc .cr-nm b')].map(x => x.textContent),
    pasto: [...document.querySelectorAll('.cr-pc .cr-d[data-id="w1"]')].map(x => x.textContent + (x.classList.contains('v') ? 'v' : '')).slice(0, 4).join(),
    fum: [...document.querySelectorAll('.cr-pc .cr-d[data-id="w2"]')].map(x => x.dataset.f + (x.classList.contains('v') ? 'v' : 'c')).join(),
    mata: [...document.querySelectorAll('.cr-pc .cr-d[data-id="w3"]')].map(x => x.dataset.f + (x.classList.contains('m') ? '?' : '')).join(),
    visible: document.querySelector('.cr-pc').getBoundingClientRect().height > 0 && document.querySelector('.cr-m').getBoundingClientRect().height === 0
  }));
  check('12 meses desde septiembre 2026', /Sep 2026 – Ago 2027/.test(g.rango) && g.meses === 'sep,oct,nov,dic,ene,feb,mar,abr,may,jun,jul,ago', g);
  check('una fila por trabajo, en orden', g.filas.join() === 'Corte de pasto,Revisión de matafuegos,Fumigación,Limpieza profunda', g.filas);
  check('el corte de pasto, publicado, con sus días (el 19 ya pasó sin marcar: atrasado)', g.pasto === '! 19,3v,17v,31v', g.pasto);
  check('fumigación cada 6 meses, solo el comité', g.fum === '2026-10-03c,2027-04-03c', g.fum);
  check('matafuegos sin día: "?" en octubre', g.mata === '2026-10-01?', g.mata);
  check('en la computadora se ve la grilla (no la lista)', g.visible);
  await p.screenshot({ path: path.join(SHOTS, 'cronograma-pc.png'), fullPage: true });
  // PDF
  if (await p.evaluate(() => !!window.jspdf)) {
    await click(p, '#salonRoot [data-s="a-pdf"]');
    let [dl] = await Promise.all([p.waitForEvent('download'), p.click('#crOk')]);
    let txt = fs.readFileSync(await dl.path()).toString('latin1');
    check('PDF del comité: todo, con * en lo no publicado y ? en lo que no tiene día', dl.suggestedFilename() === 'Cronograma de mantenimiento septiembre 2026 - agosto 2027.pdf' && /Fumigaci/.test(txt) && /3\*/.test(txt) && /matafuegos/.test(txt), dl.suggestedFilename());
    await click(p, '#salonRoot [data-s="a-pdf"]');
    await p.check('#crPub');
    [dl] = await Promise.all([p.waitForEvent('download'), p.click('#crOk')]);
    txt = fs.readFileSync(await dl.path()).toString('latin1');
    if (process.env.DBG) console.log(dl.suggestedFilename(), txt.match(/\((?:[^()\\]|\\.)*\)\s*Tj/g));
    check('PDF para el tablero: solo lo publicado', /^Trabajos del Sal/.test(dl.suggestedFilename()) && /Corte de pasto/.test(txt) && !/Fumigaci/.test(txt) && !/matafuegos/.test(txt));
  } else console.log('  (sin jsPDF en este entorno: se salta el PDF)');

  console.log('\nEstados: hecho, en curso, atrasado');
  check('avance arriba: hasta hoy 0 de 1, 1 atrasado', await p.evaluate(() => /Hasta hoy: 0 de 1 hechos · 1 atrasado/.test(document.querySelector('.cr-prog').textContent)), await p.evaluate(() => document.querySelector('.cr-prog').textContent));
  check('el atrasado tiene su etiqueta en la fila', await p.evaluate(() => /Atrasado/.test(document.querySelector('.cr-pc .cr-nm button[data-id="w1"]').textContent)));
  await click(p, '.cr-pc .cr-d[data-id="w1"][data-f="2026-09-19"]');
  check('tocar uno atrasado pregunta "¿Se hizo?" (los que se repiten: "Suspender esta vez", sin cambiar la fecha)', await p.evaluate(() => { const t = [...document.querySelectorAll('.slmodal')].pop().innerText; return /¿Se hizo\?/.test(t) && /Corte de pasto/.test(t) && /sábado 19 de septiembre/.test(t) && /Suspender esta vez/.test(t) && !document.querySelector('.slmodal [data-h="fecha"]'); }));
  await click(p, '.slmodal [data-h="si"]'); await p.waitForTimeout(150);
  check('"Sí, se hizo" lo marca hecho', (await tr()).w1.ocurr['2026-09-19'].estado === 'hecho');
  check('y se ve verde con ✓, y el avance sube', await p.evaluate(() => { const d = document.querySelector('.cr-pc .cr-d[data-id="w1"][data-f="2026-09-19"]'); return d.classList.contains('h') && /✓ 19/.test(d.textContent) && /Hasta hoy: 1 de 1 hechos/.test(document.querySelector('.cr-prog').textContent); }));
  await click(p, '.cr-fil [data-k="pend"]');
  check('"Por hacer" esconde lo hecho', await p.evaluate(() => !document.querySelector('.cr-pc .cr-d[data-f="2026-09-19"]') && !!document.querySelector('.cr-pc .cr-d[data-id="w1"][data-f="2026-10-03"]')));
  await click(p, '.cr-fil [data-k="hechos"]');
  check('"Hechos" muestra solo lo hecho', await p.evaluate(() => document.querySelectorAll('.cr-pc .cr-d').length === 1 && document.querySelectorAll('.cr-pc .cr-nm').length === 1));
  await click(p, '.cr-fil [data-k="todos"]');

  console.log('\nPublicar y ocultar');
  await click(p, '.cr-pc .cr-d[data-id="w2"][data-f="2026-10-03"]');
  check('detalle: "Solo lo ve el comité" con "Publicar"', await p.evaluate(() => /Solo lo ve el comité/.test(document.querySelector('.sl-detail').innerText) && !!document.querySelector('.sl-detail [data-d="publicar"]')));
  await click(p, '.sl-detail [data-d="publicar"]');
  check('publicar guarda esa fecha como publicada', ((await tr()).w2.ocurr || {})['2026-10-03'] && (await tr()).w2.ocurr['2026-10-03'].pub === true, (await tr()).w2);
  check('y ahora dice "Se ve en la vista" con "Ocultar"', await p.evaluate(() => /Se ve en la vista/.test(document.querySelector('.sl-detail').innerText) && !!document.querySelector('.sl-detail [data-d="ocultar"]')));
  check('en el Año: esa fecha llena y la de abril sigue del comité', await p.evaluate(() => document.querySelector('.cr-pc .cr-d[data-id="w2"][data-f="2026-10-03"]').classList.contains('v') && !document.querySelector('.cr-pc .cr-d[data-id="w2"][data-f="2027-04-03"]').classList.contains('v')));
  await click(p, '.sl-detail [data-d="ocultar"]');
  check('ocultar la vuelve al comité', !('pub' in ((await tr()).w2.ocurr['2026-10-03'] || {})), (await tr()).w2.ocurr);
  await p.evaluate(() => document.querySelectorAll('.slmodal').forEach(x => x.remove()));
  await click(p, '.cr-pc .cr-d[data-id="w1"][data-f="2026-10-03"]');
  await click(p, '.sl-detail [data-d="ocultar"]');
  check('en uno que es para todos, ocultar esa fecha deja la excepción', (await tr()).w1.ocurr['2026-10-03'].pub === false);
  await p.evaluate(() => document.querySelectorAll('.slmodal').forEach(x => x.remove()));

  console.log('\nSolo el mes y "Poner el día"');
  await click(p, '#salonRoot .cr-head [data-s="new"]');
  check('nuevo: empieza en "Solo el comité"', await p.evaluate(() => document.querySelector('#slVis .cr-opt.on').dataset.v === '0'));
  await p.fill('#slTit', 'Pintura del frente');
  await click(p, '#slRep [data-k="si"]'); await click(p, '#slAtajos [data-n="2"][data-u="s"]');
  check('"15 días" = cada 2 semanas', await p.evaluate(() => $('slCada').value === '2' && $('slUni').value === 's'));
  await click(p, '#slCuando [data-k="mes"]');
  check('con "Solo el mes" no hay días ni semanas: pasa a meses', await p.evaluate(() => $('slFec').closest('.trow2').classList.contains('hidden') && $('slUni').value === 'm' && Number($('slCada').value) >= 2 && document.querySelector('#slUni option[value="d"]').disabled && document.querySelector('#slUni option[value="s"]').disabled && document.querySelector('#slAtajos [data-u="s"]').disabled));
  check('unidades: días, semanas, meses, años', await p.evaluate(() => [...document.querySelectorAll('#slUni option')].map(x => x.value).join() === 'd,s,m,a'));
  await click(p, '#slRep [data-k="no"]');
  await p.selectOption('#slMes', '2026-10');
  await click(p, '#slRespBtn'); await click(p, '.sl-chooser .tpick[data-id="p6"]');
  await click(p, '#slAuxBtn'); await click(p, '.sl-chooser .tpick[data-id="p8"]');
  await p.fill('#slCupo', '8');
  await click(p, '#slSave'); await p.waitForTimeout(150);
  const nuevo = Object.values((await tr())).find(t => t.titulo === 'Pintura del frente');
  check('se guarda con el mes (día 1), sin día y solo para el comité', nuevo && nuevo.fecha === '2026-10-01' && nuevo.soloMes === true && nuevo.vista === false, nuevo);
  check('en el Año aparece con "?"', await p.evaluate((id) => !!document.querySelector(`.cr-pc .cr-d.m[data-id="${id}"]`), nuevo.id));
  await click(p, `.cr-pc .cr-d[data-id="${nuevo.id}"]`);
  check('detalle: "Falta poner el día", sin publicar ni voluntarios', await p.evaluate(() => { const t = document.querySelector('.sl-detail').innerText; return /Falta poner el día/.test(t) && /octubre 2026/.test(t) && !document.querySelector('.sl-detail [data-d="publicar"]') && !document.querySelector('.sl-detail [data-d="wa"]'); }));
  await click(p, '.sl-detail [data-d="ponerdia"]');
  await p.fill('#slPdF', '2026-11-14');
  await click(p, '#slPdOk');
  check('pide un día de ese mes', await p.evaluate(() => /octubre 2026/.test($('slPdE').textContent)) && (await tr())[nuevo.id].soloMes === true);
  await p.fill('#slPdF', '2026-10-17'); await p.fill('#slPdH', '08:30');
  await click(p, '#slPdOk'); await p.waitForTimeout(150);
  check('queda con ese día y hora, ya sin "solo el mes"', (await tr())[nuevo.id].fecha === '2026-10-17' && (await tr())[nuevo.id].hora === '08:30' && !(await tr())[nuevo.id].soloMes, (await tr())[nuevo.id]);
  check('y se abre para publicarlo', await p.evaluate(() => /Solo lo ve el comité/.test(document.querySelector('.sl-detail').innerText) && /17 de octubre/i.test(document.querySelector('.sl-detail').innerText)), await p.evaluate(() => [...document.querySelectorAll('.sl-detail')].map(x => x.innerText.slice(0, 200))));
  await p.evaluate(() => document.querySelectorAll('.slmodal').forEach(x => x.remove()));
  // Repetición libre: cada 4 meses, hasta una fecha
  await click(p, '#salonRoot .cr-head [data-s="new"]');
  await p.fill('#slTit', 'Revisión de bombas de agua');
  await p.fill('#slFec', '2026-10-10');
  await click(p, '#slRep [data-k="si"]');
  await p.fill('#slCada', '4'); await p.selectOption('#slUni', 'm'); await p.fill('#slHasta', '2027-12-31'); await p.waitForTimeout(80);
  const prev = await p.evaluate(() => $('slPrev').textContent);
  check('muestra cómo queda y las próximas fechas', /Cada 4 meses → sáb 10 oct · mié 10 feb 2027 · jue 10 jun 2027 · dom 10 oct 2027/.test(prev), prev);
  await p.fill('#slHasta', '2026-09-01'); await click(p, '#slSave');
  check('"Hasta" antes de la primera fecha: no deja', await p.evaluate(() => /Hasta/.test($('slErr').textContent)));
  await p.fill('#slHasta', '2027-06-30'); await click(p, '#slSave'); await p.waitForTimeout(150);
  const bomba = Object.values(await tr()).find(t => t.titulo === 'Revisión de bombas de agua');
  check('se guarda cada 4 meses hasta junio 2027', bomba && bomba.repite === 'n' && bomba.cada === 4 && bomba.unidad === 'm' && bomba.hasta === '2027-06-30' && C.fechasDe(bomba, '2026-01-01', '2028-12-31').join() === '2026-10-10,2027-02-10,2027-06-10', bomba);
  check('en el Año: oct, feb y jun', await p.evaluate((id) => [...document.querySelectorAll(`.cr-pc .cr-d[data-id="${id}"]`)].map(x => x.dataset.f).join() === '2026-10-10,2027-02-10,2027-06-10', bomba.id));
  check('texto "Cada 4 meses" en la fila', await p.evaluate((id) => /Cada 4 meses/.test(document.querySelector(`.cr-pc .cr-nm button[data-id="${id}"]`).textContent), bomba.id));
  await click(p, `.cr-pc .cr-nm button[data-id="${bomba.id}"]`);
  check('al editarlo, el formulario lo muestra igual', await p.evaluate(() => document.querySelector('#slRep .on').dataset.k === 'si' && $('slCada').value === '4' && $('slUni').value === 'm' && $('slHasta').value === '2027-06-30'));
  await p.evaluate(() => document.querySelectorAll('.slmodal').forEach(x => x.remove()));
  check('los de antes siguen igual (cada 15 días = cada 2 semanas)', C.repiteTxt({ repite: '15d' }) === 'Cada 15 días' && C.fechasDe({ fecha: '2026-10-03', repite: '15d' }, '2026-10-01', '2026-10-31').join() === '2026-10-03,2026-10-17,2026-10-31' && C.repiteTxt({ repite: 'n', cada: 3, unidad: 's' }) === 'Cada 3 semanas' && C.repiteTxt({ repite: 'anio' }) === 'Cada año');
  // Uno que se repite: la fecha base se corre a ese día del mes
  await click(p, '.cr-pc .cr-d[data-id="w3"]');
  await click(p, '.sl-detail [data-d="ponerdia"]');
  await p.fill('#slPdF', '2026-10-24'); await click(p, '#slPdOk'); await p.waitForTimeout(150);
  check('cada año: queda el 24 de octubre y el año que viene también', (await tr()).w3.fecha === '2026-10-24' && !(await tr()).w3.soloMes && C.fechasDe((await tr()).w3, '2026-01-01', '2027-12-31').join() === '2026-10-24,2027-10-24', (await tr()).w3);
  await p.evaluate(() => document.querySelectorAll('.slmodal').forEach(x => x.remove()));
  console.log('\nPendiente: sin fecha ni responsable');
  await click(p, '#salonRoot .cr-head [data-s="new"]');
  await p.fill('#slTit', 'Cambiar la canilla del baño');
  await click(p, '#slCuando [data-k="no"]');
  check('"Todavía no": sin día ni mes', await p.evaluate(() => $('slDiaRow').classList.contains('hidden') && $('slMesRow').classList.contains('hidden') && !$('slNoRow').classList.contains('hidden')));
  await click(p, '#slSave'); await p.waitForTimeout(150);
  let pend = Object.values(await tr()).find(t => t.titulo === 'Cambiar la canilla del baño');
  check('se guarda sin fecha, sin responsable ni auxiliar', pend && pend.sinFecha === true && !pend.fecha && !pend.resp && !pend.aux && pend.vista === false, pend);
  check('en el Año: abajo, "Sin fecha"', await p.evaluate(() => /Sin fecha · 1/.test(document.querySelector('.cr-sinf').textContent) && /Cambiar la canilla/.test(document.querySelector('.cr-sinf').textContent) && /1 sin fecha/.test(document.querySelector('.cr-head small').textContent)));
  await click(p, '#salonRoot [data-s="view"][data-k="trab"]');
  check('en Trabajos: "Pendientes (sin fecha)" y no en "Terminados"', await p.evaluate(() => /Pendientes \(sin fecha\) · 1/.test($('salonRoot').textContent) && !/Terminados/.test($('salonRoot').textContent)));
  await click(p, '#salonRoot [data-s="view"][data-k="cal"]');
  check('en el Calendario: "Pendientes: 1"', await p.evaluate(() => /Pendientes: 1/.test($('salonRoot').innerText)));
  await click(p, '#salonRoot [data-s="pend"]');
  await click(p, `#salonRoot [data-s="edit"][data-id="${pend.id}"]`);
  check('al abrirlo, el formulario está en "Todavía no"', await p.evaluate(() => document.querySelector('#slCuando .on').dataset.k === 'no'));
  await click(p, '#slVis [data-v="1"]'); await click(p, '#slSave');
  check('para "Todos" pide responsable y auxiliar', await p.evaluate(() => /hacen falta responsable y auxiliar/.test($('slErr').textContent)));
  await click(p, '#slVis [data-v="0"]');
  await click(p, '#slCuando [data-k="dia"]'); await p.fill('#slFec', '2026-10-01');
  await click(p, '#slSave'); await p.waitForTimeout(150);
  pend = (await tr())[pend.id];
  check('se programa con día, todavía sin responsable', pend.fecha === '2026-10-01' && !pend.sinFecha && !pend.resp, pend);
  await click(p, `#salonRoot [data-s="open"][data-id="${pend.id}"]`);
  check('detalle: "Falta responsable y auxiliar" con "Elegir" (no "Publicar")', await p.evaluate(() => /Falta responsable y auxiliar/.test(document.querySelector('.sl-detail').innerText) && !document.querySelector('.sl-detail [data-d="publicar"]')));
  await p.evaluate(() => document.querySelectorAll('.slmodal').forEach(x => x.remove()));
  await p.evaluate(() => switchTab('panel')); await p.waitForTimeout(100);
  check('Panel: "sin responsable y auxiliar" en las próximas 2 semanas', await p.evaluate(() => /Cambiar la canilla del baño \(jue 1\): sin responsable y auxiliar/.test($('pnUrg').innerText)), await p.evaluate(() => $('pnUrg').innerText));
  check('sin errores', !p.errs.length, p.errs);
  await p.context().close();

  console.log('\nAño en el celular');
  p = await open('salon@x.com', store, { width: 390, height: 844 });
  await p.evaluate(() => { switchTab('salon'); window.__salon.view = 'anio'; salonRender(); }); await p.waitForTimeout(150);
  const m = await p.evaluate(() => ({ lista: getComputedStyle(document.querySelector('.cr-m')).display !== 'none' && getComputedStyle(document.querySelector('.cr-pc')).display === 'none',
    meses: [...document.querySelectorAll('.cr-m .cr-mes')].map(x => x.getAttribute('aria-expanded')).join(),
    oct: [...document.querySelectorAll('.cr-m .sl-ev')].map(x => x.innerText.replace(/\s+/g, ' ')),
    ancho: document.documentElement.scrollWidth }));
  check('lista por mes: los 3 primeros abiertos', m.lista && m.meses === 'true,true,true,false,false,false,false,false,false,false,false,false', m.meses);
  check('con su etiqueta: en la vista, comité', m.oct.some(x => /Corte de pasto/.test(x) && /En la vista/.test(x)) && m.oct.some(x => /Fumigación/.test(x) && /Comité/.test(x)), m.oct);
  check('nada se corre de costado', m.ancho <= 390, m.ancho);
  await click(p, '.cr-m .cr-mes[data-m="2026-12"]');
  check('tocar un mes lo abre', await p.evaluate(() => document.querySelector('.cr-m .cr-mes[data-m="2026-12"]').getAttribute('aria-expanded') === 'true' && /Limpieza profunda/.test(document.querySelector('.cr-m').innerText)));
  await p.screenshot({ path: path.join(SHOTS, 'cronograma-celular.png'), fullPage: true });
  check('sin errores', !p.errs.length, p.errs);
  await p.context().close();

  console.log('\nPanel: lo que hay que decidir');
  const st2 = JSON.parse(JSON.stringify(store)); st2.writes = [];
  Object.assign(st2.docs['congregations/C/salon/trabajos'].lista, {
    w5: T({ id: 'w5', titulo: 'Arreglo del techo', tipo: 'reparacion', fecha: '2026-10-01', soloMes: true, vista: false }),
    w6: T({ id: 'w6', titulo: 'Pintura de rejas', tipo: 'pintura', fecha: '2026-09-26', cupo: 4, vista: false })
  });
  p = await open('salon@x.com', st2);
  await p.evaluate(() => switchTab('panel')); await p.waitForTimeout(150);
  const u = await p.evaluate(() => $('pnUrg').innerText.replace(/\s+/g, ' '));
  check('"falta poner el día" del mes que viene', /Arreglo del techo: falta poner el día/.test(u) && /octubre 2026/.test(u), u);
  check('"todavía no está publicado" si pide voluntarios en 2 semanas', /Pintura de rejas \(sáb 26\) todavía no está publicado/.test(u) && /Necesita 4 voluntarios/.test(u), u);
  check('los del comité no cuentan como "faltan voluntarios"', !/Pintura de rejas: faltan/.test(u), u);
  await click(p, '#pnUrg [data-pn="trabajo"][data-id="w6"]');
  check('"Ver" abre el trabajo para publicarlo', await p.evaluate(() => !$('panel-salon').classList.contains('hidden') && !!document.querySelector('.sl-detail [data-d="publicar"]')));
  check('sin errores', !p.errs.length, p.errs);
  await p.context().close();

  console.log('\nProgramados y reparaciones; lo hecho fuera del calendario');
  const st3 = JSON.parse(JSON.stringify(store)); st3.writes = [];
  Object.assign(st3.docs['congregations/C/salon/trabajos'].lista, {
    r1: T({ id: 'r1', titulo: 'Cambiar picaportes', tipo: 'reparacion', clase: 'rep', ficha: '12', sinFecha: true, vista: false }),
    r2: T({ id: 'r2', titulo: 'Arreglar poste de la reja', tipo: 'reparacion', clase: 'rep', fecha: '2026-09-20', vista: false }),
    r3: T({ id: 'r3', titulo: 'Porcelanato baño', tipo: 'reparacion', clase: 'rep', fecha: '2026-09-21', vista: false, ocurr: { '2026-09-21': { estado: 'hecho' } } }),
    r4: T({ id: 'r4', titulo: 'Pintar rejas (con voluntarios)', tipo: 'pintura', clase: 'rep', fecha: '2026-10-10', cupo: 4, vista: true }),
    x1: T({ id: 'x1', titulo: 'Arreglo de canilla', tipo: 'reparacion', fecha: '2026-10-07', vista: false }),
    h1: T({ id: 'h1', titulo: 'Limpieza de vidrios', tipo: 'profunda', fecha: '2026-09-22', vista: false, ocurr: { '2026-09-22': { estado: 'hecho' } } })
  });
  p = await open('hugo@x.com', st3);
  await p.evaluate(() => { switchTab('salon'); window.__salon.view = 'cal'; window.__salon.month = '2026-09'; window.__salon.verHechos = false; salonRender(); }); await p.waitForTimeout(150);
  check('calendario: lo hecho no aparece', await p.evaluate(() => !document.querySelector('.sl-d[data-f="2026-09-22"] .sl-dots i')));
  await click(p, '#salonRoot [data-s="verhechos"]');
  check('"Ver hechos": aparece en gris con ✓', await p.evaluate(() => document.querySelector('.sl-d[data-f="2026-09-22"] .sl-labs em.hecho') && /✓ Limpieza de vidrios/.test(document.querySelector('.sl-d[data-f="2026-09-22"] .sl-labs').textContent)));
  await click(p, '#salonRoot [data-s="verhechos"]');
  await p.evaluate(() => { window.__salon.month = '2026-10'; salonRender(); }); await p.waitForTimeout(100);
  check('reparaciones fuera del calendario, salvo las que piden voluntarios', await p.evaluate(() => !document.querySelector('.sl-labs em[title="Arreglar poste de la reja"]') && !!document.querySelector('.sl-d[data-f="2026-10-10"] .sl-labs em[title="Pintar rejas (con voluntarios)"]') && /Reparaciones: 3/.test($('salonRoot').textContent)));
  await click(p, '#salonRoot [data-s="verrep"]');
  const lr = await p.evaluate(() => $('salonRoot').textContent);
  check('"Reparaciones" en Trabajos: atrasadas, por hacer, sin fecha, hechas', await p.evaluate(() => document.querySelector('.cr-clase .on').dataset.k === 'rep') && /Atrasados · 1/.test(lr) && /Arreglar poste/.test(lr) && /Pendientes \(sin fecha\) · 1/.test(lr) && /Ficha 12/.test(lr) && /Hechas · 1/.test(lr) && !/Corte de pasto/.test(lr), lr.slice(0, 400));
  await click(p, '#salonRoot [data-s="t-clase"][data-k="prog"]');
  check('"Programados" deja afuera las reparaciones', await p.evaluate(() => !/Arreglar poste|Cambiar picaportes/.test($('salonRoot').textContent) && /Corte de pasto/.test($('salonRoot').textContent)));
  await click(p, '#salonRoot [data-s="bulk-rep"]');
  await p.check('.slmodal input[data-id="x1"]'); await click(p, '#slBulkOk'); await p.waitForTimeout(150);
  check('"Pasar varios a reparaciones"', (await tr()).x1.clase === 'rep' && await p.evaluate(() => document.querySelector('.cr-clase .on').dataset.k === 'rep' && /Arreglo de canilla/.test($('salonRoot').textContent)));
  await p.evaluate(() => { window.__salon.view = 'anio'; window.__salon.aClase = null; salonRender(); }); await p.waitForTimeout(100);
  check('Año arranca en Programados (sin reparaciones)', await p.evaluate(() => document.querySelector('.cr-clase .on').dataset.k === 'prog' && !document.querySelector('.cr-pc .cr-d[data-id="r2"]') && !!document.querySelector('.cr-pc .cr-d[data-id="w1"]')));
  await click(p, '#salonRoot [data-s="a-clase"][data-k="rep"]');
  check('y con "Reparaciones", solo ellas', await p.evaluate(() => !!document.querySelector('.cr-pc .cr-d[data-id="r2"]') && !document.querySelector('.cr-pc .cr-d[data-id="w1"]')));
  await click(p, '#salonRoot [data-s="t-clase"]').catch(() => {});
  await p.evaluate(() => { window.__salon.view = 'trab'; window.__salon.tClase = 'rep'; salonRender(); }); await p.waitForTimeout(80);
  await click(p, '#salonRoot .thead [data-s="new"]');
  check('nueva desde Reparaciones: clase reparación, con selector de ficha, y sin fecha', await p.evaluate(() => document.querySelector('#slClase .on').dataset.c === 'rep' && !$('slFichaRow').classList.contains('hidden') && document.querySelector('#slCuando .on').dataset.k === 'no'));
  check('el selector tiene las 21 fichas del manual por sección', await p.evaluate(() => document.querySelectorAll('#slFicha optgroup').length === 5 && document.querySelectorAll('#slFicha option[value^="0"]').length === 21));
  await p.fill('#slTit', 'Driver luminaria'); await p.selectOption('#slFicha', '04.B'); await p.waitForTimeout(80);
  check('elegir la ficha trae sus tareas agrupadas', await p.evaluate(() => /^LÁMPARAS INTERIORES\nRevise que la iluminación/.test($('slTar').value) && $('slPropiaRow').classList.contains('hidden')), await p.evaluate(() => $('slTar').value.slice(0, 80)));
  await click(p, '#slSave'); await p.waitForTimeout(150);
  const dr = Object.values(await tr()).find(t => t.titulo === 'Driver luminaria');
  check('se guarda con clase y ficha', dr && dr.clase === 'rep' && dr.fichaCod === '04.B' && dr.sinFecha === true && dr.tareas[0] === 'LÁMPARAS INTERIORES', dr && dr.fichaCod);
  check('en la lista: "Reparación · 04.B Luminarias"', await p.evaluate(() => /Reparación · 04\.B Luminarias/.test($('salonRoot').textContent)));
  // Ficha propia
  await click(p, '#salonRoot .thead [data-s="new"]');
  await p.fill('#slTit', 'Pintura de rejas'); await p.fill('#slTar', 'PREPARACIÓN\nLijar el óxido\nPINTURA\n2 manos de esmalte');
  await p.check('#slPropia'); await click(p, '#slSave'); await p.waitForTimeout(150);
  const docT = await p.evaluate(() => window.__store.docs['congregations/C/salon/trabajos']);
  const pr = Object.values(docT.lista).find(t => t.titulo === 'Pintura de rejas');
  const mod = pr && pr.fichaCod && docT.modelos && docT.modelos[pr.fichaCod.slice(2)];
  check('"Guardar como ficha propia": queda el modelo con sus tareas', !!mod && mod.nombre === 'Pintura de rejas' && mod.tareas.length === 4, docT.modelos);
  await click(p, '#salonRoot .thead [data-s="new"]');
  check('y aparece para elegirla la próxima vez', await p.evaluate(() => !!document.querySelector('#slFicha optgroup[label="Fichas propias"] option')));
  await p.evaluate(() => document.querySelectorAll('.slmodal').forEach(x => x.remove()));
  // Detalle con grupos y la ficha en PDF
  await p.evaluate((id) => { window.__salon.trabajos[id].fecha = '2026-10-20'; delete window.__salon.trabajos[id].sinFecha; }, dr.id);
  await p.evaluate((id) => { document.querySelectorAll('.slmodal').forEach(x => x.remove()); }, dr.id);
  await p.evaluate((id) => { window.__salonOpen = id; }, dr.id);
  const det = await p.evaluate((id) => { const S = window.__salon; S.view = 'trab'; salonRender(); return id; }, dr.id);
  await click(p, `#salonRoot [data-id="${det}"]`);
  check('detalle: grupos de la ficha y la advertencia', await p.evaluate(() => { const d = [...document.querySelectorAll('.slmodal')].pop(); return d.querySelectorAll('.sl-tgr').length === 2 && /desenergizar/.test(d.querySelector('.sl-aviso').textContent) && !d.querySelector('.sl-tgr input'); }));
  if (await p.evaluate(() => !!window.jspdf)) {
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.slmodal [data-d="ficha"]')]);
    const txt = fs.readFileSync(await dl.path()).toString('latin1');
    check('ficha PDF con el diseño del manual: sección, grupos y notas', /MM SECCI/.test(txt) && /SISTEMAS EL/.test(txt) && /LÁMPARAS INTERIORES|L.MPARAS INTERIORES/.test(txt) && /DC-85/.test(txt) && /Driver luminaria/.test(txt), dl.suggestedFilename());
  }
  await p.evaluate(() => document.querySelectorAll('.slmodal').forEach(x => x.remove()));
  check('sin errores', !p.errs.length, p.errs);
  await p.context().close();

  await b.close();
  console.log(`\n${ok} OK, ${bad} fallaron`);
  process.exitCode = bad ? 1 : 0;
})();
