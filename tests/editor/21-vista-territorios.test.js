// Vista de la congregación (ver/ver.html): salidas al servicio en Inicio, la salida que conduce
// como asignación propia, y "Mis territorios" con "Lo terminé". Con un Firestore simulado.
const path = require('path');
const { launch, SHOTS, fixture } = require('./_helper');
const VER = 'file://' + path.resolve(__dirname, '../../ver/ver.html') + '?codigo=C';
const data = fixture();
data.publishers[1].email = 'martin@x.com';
Object.assign(data.settings, { editorEmails: ['hugo@x.com'], viewerEmails: ['martin@x.com', 'ver@x.com'] });
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 400)); } };

const DOCS = {
  'congregations/C/terr/grupos': { lista: {
    g1: { id: 'g1', nombre: 'Grupo 1', encargado: 'p1', auxiliar: 'p12', miembros: ['p1', 'p12', 'p5'], editores: ['martin@x.com'] },
    g2: { id: 'g2', nombre: 'Grupo 2', encargado: 'p6', miembros: ['p6', 'p7'] } } },
  'congregations/C/terr/lugares': { lista: {
    L1: { id: 'L1', tipo: 'casa', nombre: 'Casa de la familia Gómez', direccion: 'Belgrano 450' },
    L2: { id: 'L2', tipo: 'salon', nombre: 'Salón del Reino', direccion: '' } } },
  'congregations/C/terr/territorios': { lista: {
    t12: { id: 't12', num: '12', nombre: 'Centro Norte', tipo: 'casas', foto: { url: 'https://example.com/t12.jpg' }, notas: 'Tocar timbre', asignado: { tipo: 'hermano', id: 'p1', desde: '2026-09-01' } },
    t4: { id: 't4', num: '4', nombre: 'Los Aromos', tipo: 'casas', asignado: { tipo: 'grupo', id: 'g1', desde: '2026-04-01' } },
    t9: { id: 't9', num: '9', nombre: 'Otro', tipo: 'casas', asignado: { tipo: 'hermano', id: 'p8', desde: '2026-09-01' } } } },
  'congregations/C/salidas/g1': { plantilla: { s1: { id: 's1', dia: 5, hora: '09:30', lugar: 'L1', conductor: null, territorios: ['t4'] } },
    semanas: { '2026-09-21': { cambios: { s1: { conductor: 'p1', territorios: ['t4', 't12'] } } } } },
  'congregations/C/salidas/g2': { plantilla: { s3: { id: 's3', dia: 4, hora: '17:00', lugar: 'L1', conductor: 'p6' } } },
  'congregations/C/salidas/congregacion': { plantilla: { s2: { id: 's2', dia: 6, hora: '10:00', lugar: 'L2', conductor: 'p4' } } }
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
    onSnapshot: (cb, err) => { const fn = () => cb(snap(p)); listeners.push(fn); fn(); return () => {}; },
    set: async (o) => { store[p] = clone(o); window.__writes.push([p, clone(o)]); notify(); },
    collection: (n) => col(p + '/' + n)
  });
  window.__writes = [];
  initFirebase = () => ({ collection: (n) => col(n) });
}

(async () => {
  const b = await launch();
  async function open(email) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route(/googleapis/, r => r.abort());
    await ctx.addInitScript(() => { localStorage.setItem('welcome-seen-C', '1'); window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => { if (!/firebase is not defined/.test(e.message)) p.errs.push(e.message); });   // sin Firebase de verdad (bloqueado en las pruebas)
    await p.goto(VER); await p.waitForTimeout(500);
    await p.evaluate(({ store, main, email, mock }) => {
      eval('(' + mock + ')')(store);
      data = main; currentUser = { uid: 'u-' + email, email }; currentMonday = mondayOf(new Date().toISOString().slice(0, 10));
      hideInitialLoading(); $('gateView').classList.add('hidden'); $('authGateView').classList.add('hidden'); $('mainView').classList.remove('hidden');
      renderCurrent(); renderPersonalSummary('C'); renderAnuncios(); renderUpcoming();
      window.terrVer.onData('C');
    }, { store: JSON.parse(JSON.stringify(DOCS)), main: data, email, mock: installMock.toString() });
    await p.waitForTimeout(300);
    return p;
  }

  console.log('\nMartín (Grupo 1, conduce el viernes, tiene territorios)');
  const p = await open('martin@x.com');
  let cards = await p.evaluate(() => [...document.querySelectorAll('#salidasBox .sal-card')].map(c => c.innerText.replace(/\s+/g, ' ')));
  check('Inicio: salidas de su grupo y de la congregación (no las del Grupo 2)', cards.length === 2 && /^Vie 25 · 09:30 Vos conducís 🏠 Casa de la familia Gómez Belgrano 450 · Conduce Martín Ruiz Territorios 4, 12/.test(cards[0]) && /^Sáb 26 · 10:00 Congregación 🏛 Salón del Reino Conduce Tomás Bravo/.test(cards[1]), cards);
  check('"Cómo llegar" con la dirección', await p.evaluate(() => /maps\/search\/\?api=1&query=Belgrano%20450/.test(document.querySelector('#salidasBox .sal-btn').href)));
  await p.click('#salidasBox [data-sal-all="1"]'); await p.waitForTimeout(80);
  check('"Todas" muestra también las del Grupo 2', await p.evaluate(() => document.querySelectorAll('#salidasBox .sal-card').length === 3));
  await p.click('#salidasBox [data-sal-all="0"]');
  check('la salida que conduce es una asignación suya', await p.evaluate(() => /Conducir la salida/.test(($('nextHero').innerText || '') + ($('personalSummary').innerText || ''))));
  await p.evaluate(() => { const el = $('salidasBox'); el.scrollIntoView(); });
  await p.screenshot({ path: SHOTS + '/vista-salidas.png' });

  check('aparece la pestaña Territorios', await p.evaluate(() => !document.querySelector('.bt-btn[data-tab="territorios"]').classList.contains('hidden')));
  await p.click('.bt-btn[data-tab="territorios"]'); await p.waitForTimeout(150);
  const terr = await p.evaluate(() => [...document.querySelectorAll('#panel-territorios .mt-card')].map(c => c.innerText.replace(/\s+/g, ' ')));
  check('Mis territorios: el suyo y el de su grupo (no el de otro)', terr.length === 2 && /4 · Los Aromos/.test(terr[0]) && /De tu grupo · Grupo 1/.test(terr[0]) && /^12 · Centro Norte/.test(terr[1]), terr);
  check('fecha para terminarlo (y si se pasó, lo dice)', /se pasó la fecha/.test(terr[0]) && /terminalo antes del [^,]+, 30 de diciembre/.test(terr[1]), terr);
  check('la foto de la tarjeta', await p.evaluate(() => !!document.querySelector('#panel-territorios img[src="https://example.com/t12.jpg"]')));
  await p.screenshot({ path: SHOTS + '/vista-territorios.png' });
  await p.click('[data-mt-done="t12"]'); await p.waitForTimeout(100);
  await p.click('#mtOk'); await p.waitForTimeout(200);
  const w = await p.evaluate(() => window.__writes);
  check('"Lo terminé" avisa al encargado (con su email y la fecha)', w.length === 1 && w[0][0] === 'congregations/C/terminados/t12' && w[0][1].email === 'martin@x.com' && w[0][1].pubId === 'p1' && w[0][1].fecha === '2026-09-23' && w[0][1].tid === 't12', w);
  check('después dice que falta que lo confirme', await p.evaluate(() => /Avisaste que lo terminaste/.test($('panel-territorios').innerText) && !document.querySelector('[data-mt-done="t12"]')));
  check('como encargado de grupo también puede avisar el del grupo', await p.evaluate(() => !!document.querySelector('[data-mt-done="t4"]')));
  check('sin errores', p.errs.length === 0, p.errs);

  console.log('\nOtro hermano sin grupo ni territorios');
  const q = await open('ver@x.com');
  check('ve todas las salidas (no tiene grupo)', await q.evaluate(() => document.querySelectorAll('#salidasBox .sal-card').length === 3 && !document.querySelector('#salidasBox .sal-chips')));
  check('no aparece la pestaña Territorios', await q.evaluate(() => document.querySelector('.bt-btn[data-tab="territorios"]').classList.contains('hidden')));
  check('sin errores', q.errs.length === 0, q.errs);
  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
