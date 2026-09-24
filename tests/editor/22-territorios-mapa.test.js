// Territorios etapa C: dibujar límites en el mapa, mapa de todos, campañas y registro en PDF.
// Los mapas usan Leaflet (vendor/leaflet); las imágenes del mapa (OpenStreetMap) no se descargan en las pruebas.
// Para probar el PDF sin internet: JSPDF_DIR=carpeta con jspdf.umd.min.js y jspdf.plugin.autotable.min.js
const fs = require('fs');
const path = require('path');
const { launch, FILE, SHOTS, fixture } = require('./_helper');
const data = fixture();
Object.assign(data.settings, { editorEmails: ['hugo@x.com'] });
data.publishers[0].email = 'hugo@x.com';
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 400)); } };
const SQ = [{ lat: -34.600, lng: -58.380 }, { lat: -34.600, lng: -58.375 }, { lat: -34.604, lng: -58.375 }, { lat: -34.604, lng: -58.380 }];
const DOCS = {
  'congregations/C': JSON.parse(JSON.stringify(data)),
  'congregations/C/terr/grupos': { lista: { g1: { id: 'g1', nombre: 'Grupo 1', encargado: 'p1', miembros: ['p1', 'p5'] } } },
  'congregations/C/terr/territorios': { lista: {
    t1: { id: 't1', num: '1', nombre: 'Centro', tipo: 'casas', ultimoTerminado: '2025-01-10', historial: [] },
    t2: { id: 't2', num: '2', nombre: 'Norte', tipo: 'casas', ultimoTerminado: '2026-08-01', limites: SQ,
      historial: [{ tipo: 'hermano', id: 'p6', nombre: 'Diego Fernández', desde: '2026-05-02', hasta: '2026-08-01' }, { tipo: 'grupo', id: 'g1', nombre: 'Grupo 1', desde: '2025-10-01', hasta: '2025-12-15' }] } } }
};

function installMock(store, email) {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const listeners = [];
  const notify = () => setTimeout(() => listeners.forEach(fn => fn()), 0);
  function setDeep(obj, keys, v) { let o = obj; keys.slice(0, -1).forEach(k => { if (typeof o[k] !== 'object' || o[k] === null || Array.isArray(o[k])) o[k] = {}; o = o[k]; }); if (v && v.__del) delete o[keys[keys.length - 1]]; else o[keys[keys.length - 1]] = clone(v); }
  function merge(a, b) { Object.keys(b).forEach(k => { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]); else a[k] = clone(b[k]); }); }
  const snap = (p) => ({ exists: store[p] !== undefined, id: p.split('/').pop(), data: () => (store[p] === undefined ? undefined : clone(store[p])) });
  const doc = (p) => ({
    get: async () => snap(p),
    onSnapshot: (cb) => { const fn = () => cb(snap(p)); listeners.push(fn); fn(); return () => {}; },
    update: async (...args) => { if (store[p] === undefined) { const e = new Error('nf'); e.code = 'not-found'; throw e; } for (let i = 0; i < args.length; i += 2) setDeep(store[p], args[i].s, args[i + 1]); notify(); },
    set: async (o, opt) => { if (opt && opt.merge && store[p]) merge(store[p], o); else store[p] = clone(o); notify(); },
    delete: async () => { delete store[p]; notify(); },
    collection: (n) => col(p + '/' + n)
  });
  const col = (p) => ({ doc: (id) => doc(p + '/' + id), add: async () => ({}), where: () => col(p),
    onSnapshot: (cb) => { const fn = () => { const docs = Object.keys(store).filter(k => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/')).map(snap); cb({ docs, forEach(f) { docs.forEach(f); } }); }; listeners.push(fn); fn(); return () => {}; } });
  window.firebase = { firestore: Object.assign(() => fbDb, { FieldPath: function (...s) { this.s = s; }, FieldValue: { delete: () => ({ __del: true }), arrayUnion: (x) => x } }) };
  fbDb = { collection: (n) => col(n) };
  currentUser = { email, getIdToken: async () => 't' };
  window.__store = store;
}

(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await ctx.route(/tile\.openstreetmap\.org/, r => r.abort());
  const jd = process.env.JSPDF_DIR;
  if (jd) {
    await ctx.route(/jspdf\.umd\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(jd, 'jspdf.umd.min.js')) }));
    await ctx.route(/jspdf\.plugin\.autotable\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(jd, 'jspdf.plugin.autotable.min.js')) }));
  }
  await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; window.confirm = () => true; }, data);
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(FILE); await p.waitForTimeout(700);
  await p.evaluate(async ({ store, mock }) => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    eval('(' + mock + ')')(store, 'hugo@x.com');
    await startSync('C');
  }, { store: DOCS, mock: installMock.toString() });
  await p.waitForTimeout(300);
  const click = async (sel) => { await p.click(sel); await p.waitForTimeout(200); };
  await click('.bottom-tabs .tab-btn[data-tab="territorios"]');
  await click('#terrRoot [data-t="view"][data-k="territorios"]');

  console.log('\nMapa de todos los territorios');
  check('herramientas: Mapa, Campañas y Registro PDF', await p.evaluate(() => [...document.querySelectorAll('#terrRoot .ttools .btn')].map(x => x.textContent.trim()).join('|') === '🗺 Mapa|🗓 Campañas|📄 Registro PDF'));
  await click('#terrRoot [data-t="t-mode"]'); await p.waitForTimeout(600);
  check('dibuja los territorios con límites (y dice cuáles faltan)', await p.evaluate(() => document.querySelectorAll('#tMapAll path.leaflet-interactive').length === 1 && /Sin dibujar \(1\): 1\./.test($('terrRoot').innerText) && /\b2\b/.test(document.querySelector('#tMapAll .tm-num').textContent)));
  await p.screenshot({ path: SHOTS + '/territorios-mapa.png' });
  await p.click('#tMapAll path.leaflet-interactive'); await p.waitForTimeout(700);
  check('tocar un territorio abre su ficha, con su mapa', await p.evaluate(() => !!document.querySelector('.tmodal #tFichaMap .leaflet-interactive') && /2 · Norte/.test(document.querySelector('.tmodal').innerText)));
  await click('.tmodal [data-tclose]');
  await click('#terrRoot [data-t="t-mode"]');

  console.log('\nDibujar los límites');
  await click('#tList [data-id="t1"]');
  check('ficha sin límites: botón "Dibujar los límites en el mapa"', await p.evaluate(() => /Dibujar los límites en el mapa/.test($('tDraw').textContent)));
  await click('#tDraw'); await p.waitForTimeout(700);
  check('se abre el mapa para dibujar, con los otros territorios de fondo', await p.evaluate(() => !!document.querySelector('.tdraw .leaflet-container') && document.querySelectorAll('.tdraw .tm-num').length === 1));
  const box = await p.locator('#tdMap').boundingBox();
  for (const [dx, dy] of [[100, 100], [250, 110], [240, 300], [110, 280]]) { await p.mouse.click(box.x + dx, box.y + dy); await p.waitForTimeout(120); }
  check('cada toque agrega una esquina', await p.evaluate(() => document.querySelectorAll('.tdraw .tm-pt').length === 4 && /4 esquinas/.test($('tdMsg').textContent)));
  await click('#tdUndo');
  check('Deshacer saca la última', await p.evaluate(() => document.querySelectorAll('.tdraw .tm-pt').length === 3));
  await p.screenshot({ path: SHOTS + '/territorios-dibujar.png' });
  await click('#tdOk'); await p.waitForTimeout(500);
  const lim = await p.evaluate(() => window.__store['congregations/C/terr/territorios'].lista.t1.limites);
  check('Listo guarda los puntos (lat/lng) y vuelve a la ficha con el mapa', Array.isArray(lim) && lim.length === 3 && typeof lim[0].lat === 'number' && await p.evaluate(() => !!document.querySelector('.tmodal #tFichaMap')), lim);
  await click('.tmodal [data-tclose]');

  console.log('\nCampañas');
  await click('#terrRoot [data-t="camp"]');
  check('sin campañas todavía', await p.evaluate(() => /Todavía no hay campañas/.test(document.querySelector('.tmodal').innerText)));
  await click('#cNew');
  await p.fill('#cN', 'Invitación especial'); await p.fill('#cD', '2026-09-01'); await p.fill('#cH', '2026-10-31');
  await click('#cAll');
  check('elegidos: 2', /2 elegidos/.test(await p.textContent('#cCnt')));
  await click('#cOk'); await p.waitForTimeout(200);
  check('campaña creada: 0 de 2 cubiertos', await p.evaluate(() => /0 de 2 \(0%\)/.test(document.querySelector('.tmodal').innerText)));
  await p.check('#cpL [data-id="t1"]'); await p.check('#cpL [data-id="t2"]');
  check('asignar los marcados juntos', /Asignar 2 marcados/.test(await p.textContent('#cpAsg')));
  await click('#cpAsg');
  check('elige a quién (varios territorios)', await p.evaluate(() => /Asignar 2 territorios/.test(document.querySelector('.tmodal h3').textContent)));
  await click('#taSeg [data-k="grupo"]'); await click('#taList [data-id="g1"]'); await click('#taOk'); await p.waitForTimeout(500);
  const asg = await p.evaluate(() => Object.values(window.__store['congregations/C/terr/territorios'].lista).map(t => t.asignado && t.asignado.id));
  check('los dos quedaron asignados al Grupo 1', asg.join() === 'g1,g1', asg);
  check('vuelve a la campaña, que muestra a quién están asignados', await p.evaluate(() => (document.querySelector('.tmodal') || {}).innerText && /Grupo 1/.test(document.querySelector('.tmodal').innerText) && /0 de 2/.test(document.querySelector('.tmodal').innerText)));
  await p.evaluate(() => { document.querySelectorAll('.tmodal').forEach(m => m.remove()); });
  // se termina uno dentro del período
  await click('#tList [data-id="t1"]'); await click('#tDone'); await p.fill('#tDoneDate', '2026-09-20'); await click('#tDoneOk');
  await click('#terrRoot [data-t="camp"]');
  check('la lista de campañas muestra el avance (1 de 2)', await p.evaluate(() => /1 de 2 cubiertos/.test(document.querySelector('.tmodal').innerText) && /En curso/.test(document.querySelector('.tmodal').innerText)));
  await p.click('.tmodal [data-c]'); await p.waitForTimeout(200);
  await click('#cpShare');
  const wa = await p.evaluate(() => decodeURIComponent((window.__opened.pop() || '').split('text=')[1] || ''));
  check('resumen por WhatsApp con lo que falta', /\*Invitación especial\*/.test(wa) && /Cubiertos: 1 de 2 \(50%\)/.test(wa) && /Faltan: 2 \(Grupo 1/.test(wa), wa);
  await p.evaluate(() => { document.querySelectorAll('.tmodal').forEach(m => m.remove()); });

  console.log('\nRegistro de asignación (PDF)');
  const hasPdf = await p.evaluate(() => !!window.jspdf);
  if (!hasPdf) console.log('  (sin jsPDF en este entorno: se salta)');
  else {
    await click('#terrRoot [data-t="t-pdf"]');
    check('año de servicio por defecto: 2026-2027', await p.evaluate(() => document.querySelector('#rY').selectedOptions[0].textContent === '2026-2027'));
    await p.selectOption('#rY', '2025');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#rOk')]);
    const buf = fs.readFileSync(await dl.path());
    if (process.env.PDF_OUT) fs.writeFileSync(process.env.PDF_OUT, buf);
    const txt = buf.toString('latin1');
    check('descarga el PDF del año elegido', dl.suggestedFilename() === 'Registro de territorios 2025-2026.pdf', dl.suggestedFilename());
    check('con el título, los territorios y las asignaciones del año', /Registro de asignaci/.test(txt) && /Diego Fern/.test(txt) && /02\/05\/2026/.test(txt) && /01\/10\/2025/.test(txt) && /10\/01\/2025/.test(txt));
  }
  check('sin errores', p.errs.length === 0, p.errs);
  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
