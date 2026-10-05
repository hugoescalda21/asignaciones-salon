// Vista (ver/ver.html): pestaña "Mantenimiento" (aparte de las reuniones) — limpieza del grupo con sus tareas, trabajos con
// "Me sumo", la hoja de confirmación, "✓ Anotado", "Ya no puedo ir", "Completo" y el email sin vincular.
const path = require('path');
const fs = require('fs');
const { launch, SHOTS, fixture } = require('./_helper');
const VER = 'file://' + path.resolve(__dirname, '../../ver/ver.html') + '?codigo=C';
const data = fixture();
data.publishers[1].email = 'martin@x.com';
Object.assign(data.settings, { editorEmails: ['hugo@x.com'], viewerEmails: ['martin@x.com', 'ver@x.com'] });
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 400)); } };

const DOCS = {
  'congregations/C/terr/grupos': { lista: {
    g1: { id: 'g1', nombre: 'Grupo 1', encargado: 'p1', miembros: ['p1', 'p5'] },
    g2: { id: 'g2', nombre: 'Grupo 2', encargado: 'p6', miembros: ['p6', 'p7'] } } },
  'congregations/C/salon/limpieza': { rotacion: ['g1', 'g2'], otra: [], semanas: { '2026-09-21': { g: 'g1' }, '2026-09-28': { g: 'g2' } },
    tipos: [{ id: 'reu', nombre: 'Después de las reuniones', modo: 'reunion', tareas: ['Barrer y trapear', 'Baños'] }, { id: 'gen', nombre: 'Limpieza general', modo: 'semana', dia: 6, hora: '09:00', tareas: ['Vidrios', 'Cocina'], mismoGrupo: true }] },
  'congregations/C/salon/trabajos': { lista: {
    t1: { id: 't1', titulo: 'Pintura de la entrada', tipo: 'pintura', fecha: '2026-09-26', hora: '09:00', resp: 'p2', aux: 'p11', cupo: 2, repite: 'no', materiales: ['Ropa de trabajo'], vista: true },
    t2: { id: 't2', titulo: 'Arreglar la puerta', tipo: 'reparacion', fecha: '2026-09-30', hora: '18:00', resp: 'p8', aux: 'p9', cupo: 1, repite: 'no', vista: true },
    t4: { id: 't4', titulo: 'Canaletas', tipo: 'reparacion', fecha: '2026-10-03', hora: '08:00', resp: 'p8', aux: 'x:x1', cupo: 2, vista: true, externos: { 'x:x1': { nombre: 'Juan Ramírez', cong: 'Sur' }, 'x:x2': { nombre: 'Carlos Peralta', cong: 'Sur' } }, ocurr: { '2026-10-03': { vols: ['x:x2'] } } },
    t3: { id: 't3', titulo: 'Solo para el editor', tipo: 'otro', fecha: '2026-09-27', resp: 'p8', aux: 'p9', cupo: 1, vista: false } } },
  'congregations/C/salonAnotados/t1__2026-09-26__u9': { tid: 't1', fecha: '2026-09-26', pubId: 'p13', nombre: 'Sofía Abad', uid: 'u9', comentario: '', at: 'x' },
  'congregations/C/salonAnotados/t2__2026-09-30__u8': { tid: 't2', fecha: '2026-09-30', pubId: 'p7', nombre: 'Raúl Méndez', uid: 'u8', comentario: '', at: 'x' }
};

function installMock(store) {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const listeners = [];
  const notify = () => setTimeout(() => listeners.forEach(fn => fn()), 0);
  const snap = (p) => ({ exists: store[p] !== undefined, id: p.split('/').pop(), data: () => (store[p] === undefined ? undefined : clone(store[p])) });
  const col = (p, filt) => ({
    doc: (id) => doc(p + '/' + id),
    where: (f, op, v) => col(p, [f, v]),
    onSnapshot: (cb) => {
      const fn = () => { const docs = Object.keys(store).filter(k => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/') && (!filt || store[k][filt[0]] === filt[1])).map(snap); cb({ docs, forEach(f) { docs.forEach(f); } }); };
      listeners.push(fn); fn(); return () => {};
    }
  });
  const doc = (p) => ({
    onSnapshot: (cb) => { const fn = () => cb(snap(p)); listeners.push(fn); fn(); return () => {}; },
    set: async (o) => { store[p] = clone(o); window.__writes.push(['set', p, clone(o)]); notify(); },
    delete: async () => { delete store[p]; window.__writes.push(['delete', p]); notify(); },
    collection: (n) => col(p + '/' + n)
  });
  window.__writes = [];
  initFirebase = () => ({ collection: (n) => col(n) });
}

(async () => {
  const b = await launch();
  async function open(email, query, extra) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    await ctx.route(/googleapis|tile\.openstreetmap/, r => r.abort());
    const jd = process.env.JSPDF_DIR;
    if (jd) {
      await ctx.route(/jspdf\.umd\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(jd, 'jspdf.umd.min.js')) }));
      await ctx.route(/jspdf\.plugin\.autotable\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(jd, 'jspdf.plugin.autotable.min.js')) }));
    }
    await ctx.addInitScript(() => { localStorage.setItem('welcome-seen-C', '1'); window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; window.__confirm = true; window.confirm = () => window.__confirm; });
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => { if (!/firebase is not defined/.test(e.message)) p.errs.push(e.message); });
    await p.goto(VER + (query || '')); await p.waitForTimeout(500);
    await p.evaluate(({ store, main, email, mock }) => {
      eval('(' + mock + ')')(store);
      data = main; currentUser = { uid: 'u-' + email, email }; currentMonday = mondayOf(new Date().toISOString().slice(0, 10)); verComoInit();
      hideInitialLoading(); $('gateView').classList.add('hidden'); $('authGateView').classList.add('hidden'); $('mainView').classList.remove('hidden');
      renderCurrent(); renderPersonalSummary('C'); renderAnuncios(); renderUpcoming();
      window.terrVer.onData('C'); window.salonVer.onData('C');
    }, { store: extra ? extra(JSON.parse(JSON.stringify(DOCS))) : JSON.parse(JSON.stringify(DOCS)), main: data, email, mock: installMock.toString() });
    await p.waitForTimeout(300);
    return p;
  }
  const cardsOf = (p) => p.evaluate(() => [...document.querySelectorAll('#salonBox .sv-card')].map(c => c.innerText.replace(/\s+/g, ' ')));

  console.log('\nMartín (Grupo 1: le toca limpiar esta semana)');
  let p = await open('martin@x.com');
  const ini = await p.evaluate(() => { const t = document.getElementById('salonTeaser'); return { teaser: t && !t.classList.contains('hidden') ? t.innerText.replace(/\s+/g, ' ') : '', inicioTieneSalon: !!document.querySelector('#panel-inicio #salonBox'), resumen: (document.getElementById('nextHero').innerText + ' ' + document.getElementById('personalSummary').innerText) }; });
  check('Inicio: sin la caja de limpieza y trabajos, y sin limpieza en "Tus asignaciones"', !ini.inicioTieneSalon && !/Limpieza/.test(ini.resumen), ini);
  check('Inicio: una línea que lleva a Mantenimiento', /Esta semana limpia tu grupo · jue 24, sáb 26 y dom 27/.test(ini.teaser) && /2 trabajos buscan voluntarios/.test(ini.teaser), ini.teaser);
  check('pestaña "Mantenimiento" con el puntito', await p.evaluate(() => { const b = document.querySelector('.bt-btn[data-tab="salon"]'); return b && !b.classList.contains('hidden') && /Mantenimiento/.test(b.textContent) && !b.querySelector('.bt-dot').classList.contains('hidden'); }));
  await p.click('#salonTeaser'); await p.waitForTimeout(150);
  check('la línea abre la pestaña Mantenimiento', await p.evaluate(() => !document.getElementById('panel-salon').classList.contains('hidden') && document.getElementById('panel-inicio').classList.contains('hidden')));
  const lz = await p.evaluate(() => { const e = document.querySelector('#salonBox .sv-lz.mine'); return e ? e.innerText.replace(/\s+/g, ' ') : ''; });
  check('limpieza: le toca a su grupo, las dos limpiezas con sus días y tareas', /Le toca a tu grupo \(Grupo 1\)/.test(lz) && /Después de las reuniones · jue 24 y dom 27, después de la reunión/.test(lz) && /Limpieza general · sáb 26 · 09:00/.test(lz) && /Barrer y trapear/.test(lz) && /Vidrios/.test(lz), lz);
  let cards = await cardsOf(p);
  check('trabajos visibles (no el que es solo para el editor)', cards.length === 3 && !cards.some(c => /Solo para el editor/.test(c)), cards);
  check('Pintura: responsable y auxiliar, falta 1, quiénes van y "Me sumo"', /Pintura de la entrada/.test(cards[0]) && /Gómez y Díaz/.test(cards[0]) && /falta 1/.test(cards[0]) && /Van: Abad/.test(cards[0]) && /Me sumo/.test(cards[0]), cards[0]);
  check('hermanos de otra congregación: con su congregación y en "Van"', /Sosa y Ramírez \(Cong\. Sur\)/.test(cards[2]) && /Van: Peralta/.test(cards[2]) && /falta 1/.test(cards[2]), cards[2]);
  check('Arreglar la puerta: completo', /Completo/.test(cards[1]) && await p.evaluate(() => document.querySelectorAll('#salonBox .sv-btn.full[disabled]').length === 1), cards[1]);
  await p.screenshot({ path: path.join(SHOTS, 'vista-salon-inicio.png'), fullPage: true });

  await p.click('#salonBox [data-sv="sumo"][data-id="t1"]'); await p.waitForTimeout(120);
  const sh = await p.evaluate(() => document.querySelector('.sv-sheet').innerText.replace(/\s+/g, ' '));
  check('hoja: datos del trabajo y "Te anotás como Martín Ruiz"', /¿Te sumás a este trabajo\?/.test(sh) && /sábado 26 de septiembre · 09:00/.test(sh) && /Responsable: Lucas Gómez · Auxiliar: Mario Díaz/.test(sh) && /Ropa de trabajo/.test(sh) && /Te anotás como Martín Ruiz/.test(sh), sh);
  await p.screenshot({ path: path.join(SHOTS, 'vista-salon-me-sumo.png') });
  await p.fill('#svCom', 'Llevo la escalera');
  await p.click('#svOk'); await p.waitForTimeout(250);
  const w = await p.evaluate(() => window.__writes[0]);
  check('se guarda su "Me sumo" con su uid y comentario', w && w[0] === 'set' && w[1] === 'congregations/C/salonAnotados/t1__2026-09-26__u-martin@x.com' && w[2].pubId === 'p1' && w[2].comentario === 'Llevo la escalera' && w[2].uid === 'u-martin@x.com', w);
  check('"¡Listo, te anotaste!" con Agregar al calendario', await p.evaluate(() => /¡Listo, te anotaste!/.test(document.querySelector('.sv-sheet').innerText) && /calendar\.google\.com/.test(document.querySelector('.sv-sheet a.sv-bb').href)));
  await p.click('.sv-sheet [data-svclose]'); await p.waitForTimeout(150);
  cards = await cardsOf(p);
  check('la tarjeta pasa a "✓ Anotado", completo y con su nombre en "Van"', /✓ Anotado/.test(cards[0]) && /completo/.test(cards[0]) && /Van: Abad, Ruiz/.test(cards[0]), cards[0]);
  const mine = await p.evaluate(() => (document.getElementById('nextHero') || {}).innerText + ' ' + (document.getElementById('personalSummary') || {}).innerText);
  check('lo del mantenimiento no se mezcla con sus asignaciones de las reuniones', !/Pintura de la entrada|Limpieza/.test(mine), mine.replace(/\s+/g, ' ').slice(0, 400));
  check('en Inicio, la línea dice que está anotado', await p.evaluate(() => /estás en «Pintura de la entrada» \(sáb 26\)/i.test(document.getElementById('salonTeaser').innerText)));
  check('próximas limpiezas', await p.evaluate(() => /Próximas limpiezas/.test(document.getElementById('salonBox').innerText) && /Grupo 2/.test(document.querySelector('.sv-wks').innerText)));
  await p.click('#salonBox [data-sv="anotado"][data-id="t1"]'); await p.waitForTimeout(120);
  check('"✓ Anotado": calendario, cambiar comentario y "Ya no puedo ir"', await p.evaluate(() => { const t = document.querySelector('.sv-sheet').innerText; return /Agregar al calendario/.test(t) && /Cambiar mi comentario/.test(t) && /Ya no puedo ir/.test(t) && /Llevo la escalera/.test(t); }));
  await p.click('#svNo'); await p.waitForTimeout(80);
  check('pide confirmar la baja', await p.evaluate(() => /¿Ya no podés ir\?/.test(document.querySelector('.sv-sheet').innerText)));
  await p.click('#svBaja'); await p.waitForTimeout(250);
  check('se borra su anotación y vuelve "Me sumo"', await p.evaluate(() => { const w = window.__writes.pop(); return w[0] === 'delete' && /t1__2026-09-26__u-martin/.test(w[1]); }) && /Me sumo/.test((await cardsOf(p))[0]));
  check('sin errores', !p.errs.length, p.errs);
  await p.context().close();

  console.log('\nEmail sin vincular');
  p = await open('ver@x.com');
  await p.evaluate(() => showTab('salon'));
  check('ve a qué grupo le toca limpiar', await p.evaluate(() => /Limpieza general: Grupo 1 · sáb 26 · 09:00/.test(document.querySelector('#salonBox .sv-lz').innerText)));
  await p.click('#salonBox [data-sv="sumo"][data-id="t1"]'); await p.waitForTimeout(120);
  check('"Me sumo" le pide vincular su email', await p.evaluate(() => /Primero vinculá tu nombre/.test(document.querySelector('.sv-sheet').innerText) && !window.__writes.length));
  check('sin errores', !p.errs.length, p.errs);
  await p.context().close();

  console.log('\nCronograma: solo el comité, publicado por fecha y sin día');
  const conComite = (d) => {
    Object.assign(d['congregations/C/salon/trabajos'].lista, {
      t5: { id: 't5', titulo: 'Fumigación', tipo: 'otro', fecha: '2026-10-01', hora: '10:00', resp: 'p1', aux: 'p9', cupo: 2, repite: 'no', vista: false },
      t6: { id: 't6', titulo: 'Corte de pasto', tipo: 'jardin', fecha: '2026-09-25', hora: '17:00', resp: 'p8', aux: 'p9', cupo: 2, repite: '15d', vista: false, ocurr: { '2026-09-25': { pub: true } } },
      t7: { id: 't7', titulo: 'Pintura del frente', tipo: 'pintura', fecha: '2026-10-01', resp: 'p1', aux: 'p9', cupo: 8, repite: 'no', vista: true, soloMes: true },
      t8: { id: 't8', titulo: 'Arreglo del portón', tipo: 'reparacion', fecha: '2026-09-29', resp: 'p8', aux: 'p9', cupo: 1, repite: 'no', vista: true, ocurr: { '2026-09-29': { pub: false } } }
    });
    return d;
  };
  p = await open('martin@x.com', '', conComite);
  await p.evaluate(() => showTab('salon')); await p.waitForTimeout(100);
  cards = await cardsOf(p);
  const fum = cards.find(c => /Fumigación/.test(c)) || '';
  check('el trabajo del comité lo ve el responsable, con el aviso y sin "Me sumo"', /🔒 Todavía no está publicado/.test(fum) && /Sos el responsable/.test(fum) && !/Me sumo/.test(fum), fum);
  const pasto = cards.filter(c => /Corte de pasto/.test(c));
  check('de los que se repiten, solo la fecha publicada (25/9), no la siguiente', pasto.length === 1 && /Me sumo/.test(pasto[0]) && /vie\s*25|VIE\s*25|Vie\s*25/.test(pasto[0]), pasto);
  check('una fecha ocultada no se ve aunque el trabajo sea para todos', !cards.some(c => /Arreglo del portón/.test(c)), cards);
  check('lo que no tiene día no aparece (ni en sus asignaciones)', !cards.some(c => /Pintura del frente/.test(c)) && await p.evaluate(() => !/Pintura del frente/.test(document.body.innerText)));
  const tz = await p.evaluate(() => $('salonTeaser').innerText.replace(/\s+/g, ' '));
  check('en Inicio: "buscan voluntarios" cuenta solo lo publicado', /3 trabajos buscan voluntarios/.test(tz) && /Fumigación/.test(tz), tz);
  check('sin errores', !p.errs.length, p.errs);
  await p.context().close();
  p = await open('ver@x.com', '', conComite);
  await p.evaluate(() => showTab('salon')); await p.waitForTimeout(100);
  cards = await cardsOf(p);
  check('otro hermano no ve lo del comité', !cards.some(c => /Fumigación|Pintura del frente|Arreglo del portón/.test(c)) && cards.some(c => /Corte de pasto/.test(c)), cards);
  await p.context().close();

  console.log('\nFicha desde el celular (responsable, auxiliar y voluntario)');
  const conFicha = (d) => {
    d['congregations/C/salon/trabajos'].lista.t9 = { id: 't9', titulo: 'Limpieza de canaletas', tipo: 'profunda', fecha: '2026-09-26', hora: '08:00', resp: 'p1', aux: 'p9', cupo: 2, repite: 'no', vista: true, fichaCod: '03.F',
      tareas: ['TECHOS', 'Revise el techo', 'Limpie la basura', 'ALEROS', 'Revise los aleros'], materiales: ['Escalera'] };
    d['congregations/C/salonAnotados/t9__2026-09-26__u7'] = { tid: 't9', fecha: '2026-09-26', pubId: 'p13', nombre: 'Sofía Abad', uid: 'u7', comentario: '', at: 'x' };
    return d;
  };
  p = await open('martin@x.com', '', conFicha);
  await p.evaluate(() => showTab('salon')); await p.waitForTimeout(100);
  let fc = await p.evaluate(() => { const c = document.getElementById('sv-t9-2026-09-26'); return c ? c.innerText.replace(/\s+/g, ' ') : ''; });
  check('su trabajo con ficha: la letra F y el botón "📋 Ficha"', /F ?Limpieza de canaletas/.test(fc) && /Ficha/.test(fc) && /Sos el responsable/.test(fc), fc);
  await p.click('#salonBox [data-sv="ficha"][data-id="t9"]'); await p.waitForTimeout(150);
  const fh = await p.evaluate(() => document.querySelector('.sv-sheet').innerText.replace(/\s+/g, ' '));
  check('la ficha: sección, grupos y tareas para tildar', /FICHA DE TRABAJO \| EDIFICIOS/i.test(fh) && /MM SECCIÓN 03/i.test(fh) && /TECHOS/.test(fh) && /ALEROS/.test(fh) && /0 de 3/.test(fh) && await p.evaluate(() => document.querySelectorAll('.sv-sheet input[data-ft="tareas"]:not([disabled])').length === 3), fh.slice(0, 300));
  await p.click('.sv-sheet input[data-ft="tareas"][data-i="1"]'); await p.waitForTimeout(150);
  let wf = await p.evaluate(() => window.__writes.filter(w => /salonFichas/.test(w[1])).pop());
  check('tildar guarda en salonFichas (trabajo__fecha) con su nombre y email', wf && wf[1] === 'congregations/C/salonFichas/t9__2026-09-26' && wf[2].tareas[1] === true && wf[2].pubId === 'p1' && wf[2].email === 'martin@x.com' && wf[2].estado === 'curso', wf);
  await p.fill('#svFNota', 'Falta sellar la bajada'); await p.dispatchEvent('#svFNota', 'change'); await p.waitForTimeout(100);
  await p.evaluate(() => { window.__confirm = false; }); await p.click('#svFFin'); await p.waitForTimeout(150);
  check('"Terminé" con tareas sin marcar pregunta antes (y si dice que no, no termina)', await p.evaluate(() => !!document.getElementById('svFFin')) && (await p.evaluate(() => window.__writes.filter(w => /salonFichas/.test(w[1])).pop()))[2].estado === 'curso');
  await p.evaluate(() => { window.__confirm = true; }); await p.click('#svFFin'); await p.waitForTimeout(200);
  wf = await p.evaluate(() => window.__writes.filter(w => /salonFichas/.test(w[1])).pop());
  check('"Terminé": queda hecho, con la nota y la hora', wf[2].estado === 'hecho' && wf[2].nota === 'Falta sellar la bajada' && !!wf[2].terminadoAt && await p.evaluate(() => /¡Gracias!/.test(document.querySelector('.sv-sheet').innerText)), wf[2]);
  await p.click('.sv-sheet [data-svclose]'); await p.waitForTimeout(150);
  check('la tarjeta pasa a "✓ Terminado"', await p.evaluate(() => /Terminado/.test(document.getElementById('sv-t9-2026-09-26').innerText)));
  await p.click('#salonBox [data-sv="ficha"][data-id="t9"]'); await p.waitForTimeout(150);
  check('terminada: se ve quién la terminó y se puede volver atrás', await p.evaluate(() => /Terminado por Martín Ruiz/.test(document.querySelector('.sv-sheet').innerText) && !!document.getElementById('svFReabrir') && !document.getElementById('svFFin')));
  if (process.env.JSPDF_DIR) {
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#svFPdf')]);
    const txt = fs.readFileSync(await dl.path()).toString('latin1');
    check('"Descargar la ficha (PDF)" desde el celular, con el diseño del manual', /^Ficha - Limpieza de canaletas - 2026-09-26\.pdf$/.test(dl.suggestedFilename()) && /MM SECCI/.test(txt) && /TECHOS/.test(txt) && /Falta sellar/.test(txt), dl.suggestedFilename());
  }
  check('sin errores', !p.errs.length, p.errs);
  await p.context().close();
  // "Tus asignaciones" → abre la ficha directo
  p = await open('martin@x.com', '', conFicha);
  await p.evaluate(() => window.salonVer.goTo('2026-09-26')); await p.waitForTimeout(150);
  check('tocar la asignación abre la ficha', await p.evaluate(() => !!document.querySelector('.sv-sheet.sv-ficha') && /Limpieza de canaletas/.test(document.querySelector('.sv-sheet').innerText)));
  await p.context().close();
  // Otro hermano (no es responsable ni auxiliar): la ve sin poder tildar
  p = await open('ver@x.com', '', conFicha);
  await p.evaluate(() => showTab('salon')); await p.waitForTimeout(100);
  await p.click('#salonBox [data-sv="ficha"][data-id="t9"]'); await p.waitForTimeout(150);
  check('otro hermano ve la ficha, sin poder tildar ni terminar', await p.evaluate(() => document.querySelectorAll('.sv-sheet input[data-ft="tareas"][disabled]').length === 3 && !document.getElementById('svFFin') && /La completan el responsable y el auxiliar/.test(document.querySelector('.sv-sheet').innerText)));
  check('sin errores', !p.errs.length, p.errs);
  await p.context().close();

  console.log('\nVer como un hermano (Super Admin)');
  p = await open('hugo@x.com', '&como=p1');
  check('franja "Estás viendo como Martín Ruiz" con Salir', await p.evaluate(() => /Estás viendo como Martín Ruiz/.test($('verComoBar').innerText) && !!$('verComoSalir')));
  const como = await p.evaluate(() => (document.getElementById('nextHero').innerText + ' ' + document.getElementById('personalSummary').innerText).replace(/\s+/g, ' '));
  check('se ven las asignaciones de Martín (no las de Hugo)', /Hola, Martín/i.test(como) && /Video y Zoom/.test(como), como.slice(0, 300));
  check('la línea de Mantenimiento es la de su grupo', await p.evaluate(() => /Esta semana limpia tu grupo/.test($('salonTeaser').innerText)));
  await p.evaluate(() => showTab('salon')); await p.waitForTimeout(100);
  await p.click('#salonBox [data-sv="sumo"][data-id="t1"]'); await p.waitForTimeout(120);
  check('"Me sumo" no hace nada: solo para mirar', await p.evaluate(() => !document.querySelector('.sv-sheet') && !window.__writes.length && /solo para mirar/.test(document.getElementById('appToast').textContent)));
  await p.click('#salonBox [data-tarea]'); await p.waitForTimeout(80);
  check('las tareas no se tildan', await p.evaluate(() => !document.querySelector('#salonBox [data-tarea]').checked));
  check('sin carteles de avisos ni recordatorios', await p.evaluate(() => $('pushPrompt').classList.contains('hidden') || !$('pushPrompt').innerHTML));
  check('sin errores', !p.errs.length, p.errs);
  await p.context().close();
  p = await open('martin@x.com', '&como=p2');
  const dbg = await p.evaluate(() => ({ bar: !!$('verComoBar'), como: window.__comoPubId, hero: document.getElementById('nextHero').innerText }));
  check('un hermano común no puede ver como otro (se ignora)', !dbg.bar && !dbg.como && /Martín/i.test(dbg.hero), dbg);
  await p.context().close();

  await b.close();
  console.log(`\n${ok} OK, ${bad} fallaron`);
  process.exitCode = bad ? 1 : 0;
})();
