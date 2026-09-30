// Vista (ver/ver.html): "En el Salón" en Inicio — limpieza del grupo con sus tareas, trabajos con
// "Me sumo", la hoja de confirmación, "✓ Anotado", "Ya no puedo ir", "Completo" y el email sin vincular.
const path = require('path');
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
  'congregations/C/salon/limpieza': { modo: 'reunion', rotacion: ['g1', 'g2'], inicio: '2026-09-21', otra: [], tareas: ['Barrer y trapear', 'Baños'] },
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
  async function open(email) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route(/googleapis|tile\.openstreetmap/, r => r.abort());
    await ctx.addInitScript(() => { localStorage.setItem('welcome-seen-C', '1'); window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => { if (!/firebase is not defined/.test(e.message)) p.errs.push(e.message); });
    await p.goto(VER); await p.waitForTimeout(500);
    await p.evaluate(({ store, main, email, mock }) => {
      eval('(' + mock + ')')(store);
      data = main; currentUser = { uid: 'u-' + email, email }; currentMonday = mondayOf(new Date().toISOString().slice(0, 10));
      hideInitialLoading(); $('gateView').classList.add('hidden'); $('authGateView').classList.add('hidden'); $('mainView').classList.remove('hidden');
      renderCurrent(); renderPersonalSummary('C'); renderAnuncios(); renderUpcoming();
      window.terrVer.onData('C'); window.salonVer.onData('C');
    }, { store: JSON.parse(JSON.stringify(DOCS)), main: data, email, mock: installMock.toString() });
    await p.waitForTimeout(300);
    return p;
  }
  const cardsOf = (p) => p.evaluate(() => [...document.querySelectorAll('#salonBox .sv-card')].map(c => c.innerText.replace(/\s+/g, ' ')));

  console.log('\nMartín (Grupo 1: le toca limpiar esta semana)');
  let p = await open('martin@x.com');
  const lz = await p.evaluate(() => { const e = document.querySelector('#salonBox .sv-lz.mine'); return e ? e.innerText.replace(/\s+/g, ' ') : ''; });
  check('limpieza: le toca a su grupo, jue 24 y dom 27, con las tareas', /Le toca a tu grupo \(Grupo 1\)/.test(lz) && /jue 24 y dom 27/.test(lz) && /Barrer y trapear/.test(lz), lz);
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
  check('aparece en sus asignaciones (y la limpieza del grupo)', /Pintura de la entrada · voluntario/.test(mine) && /Limpieza del Salón/.test(mine), mine.replace(/\s+/g, ' ').slice(0, 400));
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
  check('ve a qué grupo le toca limpiar', await p.evaluate(() => /Le toca a Grupo 1/.test(document.querySelector('#salonBox .sv-lz').innerText)));
  await p.click('#salonBox [data-sv="sumo"][data-id="t1"]'); await p.waitForTimeout(120);
  check('"Me sumo" le pide vincular su email', await p.evaluate(() => /Primero vinculá tu nombre/.test(document.querySelector('.sv-sheet').innerText) && !window.__writes.length));
  check('sin errores', !p.errs.length, p.errs);
  await p.context().close();

  await b.close();
  console.log(`\n${ok} OK, ${bad} fallaron`);
  process.exitCode = bad ? 1 : 0;
})();
