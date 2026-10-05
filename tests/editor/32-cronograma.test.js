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
  check('el corte de pasto, publicado, con sus días', g.pasto === '19v,3v,17v,31v', g.pasto);
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
  await click(p, '#slRep [data-k="15d"]');
  await click(p, '#slCuando [data-k="mes"]');
  check('con "Solo el mes" no se puede "cada 15 días" ni "cada mes"', await p.evaluate(() => $('slFec').closest('.trow2').classList.contains('hidden') && document.querySelector('#slRep [data-k="15d"]').disabled && document.querySelector('#slRep [data-k="mes"]').disabled && document.querySelector('#slRep .on').dataset.k === 'no'));
  check('repeticiones nuevas en el formulario', await p.evaluate(() => [...document.querySelectorAll('#slRep button')].map(x => x.dataset.k).join() === 'no,15d,mes,2m,3m,6m,anio'));
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
  // Uno que se repite: la fecha base se corre a ese día del mes
  await click(p, '.cr-pc .cr-d[data-id="w3"]');
  await click(p, '.sl-detail [data-d="ponerdia"]');
  await p.fill('#slPdF', '2026-10-24'); await click(p, '#slPdOk'); await p.waitForTimeout(150);
  check('cada año: queda el 24 de octubre y el año que viene también', (await tr()).w3.fecha === '2026-10-24' && !(await tr()).w3.soloMes && C.fechasDe((await tr()).w3, '2026-01-01', '2027-12-31').join() === '2026-10-24,2027-10-24', (await tr()).w3);
  await p.evaluate(() => document.querySelectorAll('.slmodal').forEach(x => x.remove()));
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

  await b.close();
  console.log(`\n${ok} OK, ${bad} fallaron`);
  process.exitCode = bad ? 1 : 0;
})();
