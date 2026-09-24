// Solicitudes de acceso: el Super Admin ve los pedidos con el hermano sugerido y los aprueba de un toque.
const { launch, FILE, SHOTS, fixture } = require('./_helper');
const data = fixture();
data.publishers.push({ id: 'p16', name: 'Lucas Gómez (h)', notes: '', status: 'activo', roles: {}, email: null });
Object.assign(data.settings, { editorEmails: ['hugo@x.com'], viewerEmails: [] });
data.publishers[0].email = 'hugo@x.com';
const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
const REQS = [
  { uid: 'u1', name: 'laura paz', email: 'laura@gmail.com', createdAt: hace(5), status: 'pendiente' },
  { uid: 'u2', name: 'Lucas Gomez', email: 'lucasg@hotmail.com', createdAt: hace(60), status: 'pendiente' },
  { uid: 'u3', name: 'Martu', email: 'martu@gmail.com', createdAt: hace(1500), status: 'pendiente' },
  { uid: 'u4', name: 'Hugo Escalda', email: 'hugo@x.com', createdAt: hace(3000), status: 'pendiente' },
  { uid: 'u5', name: 'Spam', email: 'spam@x.com', createdAt: hace(4000), status: 'rechazado' }
];
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 400)); } };
(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); }, data);
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(FILE + '#solicitudes'); await p.waitForTimeout(800);
  await p.evaluate(async ({ server, reqs }) => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    window.__calls = []; window.__reqOps = []; window.__reqs = reqs;
    window.firebase = { firestore: { FieldPath: function (...s) { this.s = s; }, FieldValue: { delete: () => ({ __del: true }), arrayUnion: (x) => x } } };
    const reqSnap = () => ({ docs: window.__reqs.map(r => ({ id: r.uid, data: () => { const o = Object.assign({}, r); delete o.uid; return o; } })) });
    const solicitudes = {
      onSnapshot: (cb) => { window.__reqCb = () => cb(reqSnap()); cb(reqSnap()); return () => {}; },
      doc: (uid) => ({
        delete: async () => { window.__reqOps.push(['delete', uid]); window.__reqs = window.__reqs.filter(r => r.uid !== uid); window.__reqCb(); },
        update: async (o) => { window.__reqOps.push(['update', uid, o]); Object.assign(window.__reqs.find(r => r.uid === uid), o); window.__reqCb(); }
      })
    };
    const docRef = {
      get: async () => ({ exists: true, data: () => JSON.parse(JSON.stringify(server)) }),
      onSnapshot: (cb) => { cb({ exists: true, data: () => JSON.parse(JSON.stringify(server)) }); return () => {}; },
      update: (...args) => { window.__calls.push(args.map(a => a && a.s ? { s: a.s } : a)); return Promise.resolve(); },
      set: async () => {}, collection: (n) => n === 'solicitudes' ? solicitudes : { add: async () => ({}) }
    };
    fbDb = { collection: () => ({ doc: () => docRef }) };
    currentUser = { email: 'hugo@x.com', getIdToken: async () => 't' };
    await startSync('C');
  }, { server: data, reqs: REQS });
  await p.waitForTimeout(500);
  const rows = () => p.evaluate(() => [...document.querySelectorAll('#accReqBox .req-row')].map(r => r.innerText.replace(/\s+/g, ' ').trim()));

  check('el aviso (#solicitudes) abre Ajustes → Acceso', await p.evaluate(() => !$('panel-ajustes').classList.contains('hidden') && $('accCard').open && location.hash === ''));
  check('numerito en la pestaña Ajustes: 4 pendientes', await p.evaluate(() => [...document.querySelectorAll('.tab-btn[data-tab="ajustes"] .req-badge')].every(x => x.textContent === '4') && document.querySelectorAll('.tab-btn[data-tab="ajustes"] .req-badge').length === 2));
  let r = await rows();
  check('4 pedidos pendientes, el más viejo primero', r.length === 4 && /^Hugo Escalda/.test(r[0]), r);
  check('"laura paz" → sugiere Laura Paz (sin importar mayúsculas)', /laura paz .*✓ Es Laura Paz/i.test(r[3]), r[3]);
  check('"Lucas Gomez" → dos opciones y hay que elegir', /Lucas Gómez · sin email.*Lucas Gómez \(h\) · sin email/.test(r[2]) && await p.evaluate(() => document.querySelector('[data-req-ok="u2"]').disabled), r[2]);
  check('"Martu" → no coincide, no se puede aprobar sin elegir', /No coincide con ningún hermano/.test(r[1]) && await p.evaluate(() => document.querySelector('[data-req-ok="u3"]').disabled));
  check('quien ya tiene acceso: "Quitar el pedido"', /Ya tiene acceso como Hugo Escalda.*Quitar el pedido/.test(r[0]), r[0]);
  check('rechazados aparte (plegados)', await p.evaluate(() => /Rechazados · 1/.test($('accReqBox').innerText)));
  await p.evaluate(() => $('accReqBox').scrollIntoView());
  await p.screenshot({ path: SHOTS + '/solicitudes.png' });

  // Elegir entre los dos Lucas
  await p.click('[data-req-opt="u2"][data-pub="p16"]');
  check('al elegir, el botón dice "Aprobar como Lucas Gómez (h)"', await p.evaluate(() => { const b = document.querySelector('[data-req-ok="u2"]'); return !b.disabled && b.textContent === 'Aprobar como Lucas Gómez (h)'; }));
  // Martu: elegir de la lista
  await p.click('[data-req-change="u3"]');
  await p.selectOption('[data-req-sel="u3"]', 'p13');
  check('Martu → elegido Sofía Abad y se puede aprobar', await p.evaluate(() => /✓ Es Sofía Abad/.test($('accReqBox').innerText) && !document.querySelector('[data-req-ok="u3"]').disabled));

  // Aprobar a Laura
  await p.click('[data-req-ok="u1"]'); await p.waitForTimeout(300);
  const st = await p.evaluate(() => ({ viewers: data.settings.viewerEmails, email: data.publishers.find(x => x.id === 'p14').email, ops: window.__reqOps, paths: window.__calls.flatMap(c => c.filter((_, i) => i % 2 === 0).map(x => x.s.join('/'))) }));
  check('queda con "Solo ver" y vinculada a Laura Paz', st.viewers.includes('laura@gmail.com') && st.email === 'laura@gmail.com', st);
  check('se guarda en la nube (settings y hermanos) ANTES de borrar el pedido', st.paths.some(x => x.startsWith('settings/viewerEmails')) && st.paths.includes('publishers') && st.ops[0][0] === 'delete' && st.ops[0][1] === 'u1', st);
  check('aviso "Laura Paz ya tiene acceso" y sale de la lista', await p.evaluate(() => /Laura Paz ya tiene acceso/.test(document.body.innerText) && !document.querySelector('[data-req-ok="u1"]')));
  check('Acceso la muestra', await p.evaluate(() => /laura@gmail\.com/.test($('accessRolesList').innerText) || accPeople().some(x => x.email === 'laura@gmail.com')));

  // Rechazar a Martu
  await p.click('[data-req-no="u3"]'); await p.waitForTimeout(200);
  check('rechazar lo marca como rechazado (no se borra)', await p.evaluate(() => { const o = window.__reqOps.find(x => x[0] === 'update' && x[1] === 'u3'); return o && o[2].status === 'rechazado' && /Rechazados · 2/.test($('accReqBox').innerText); }));
  // Quitar el pedido de quien ya tenía acceso
  await p.click('[data-req-del="u4"]'); await p.waitForTimeout(200);
  check('numerito baja a 1', await p.evaluate(() => document.querySelector('.tab-btn[data-tab="ajustes"] .req-badge').textContent === '1'));
  // Aprobar al Lucas elegido
  await p.click('[data-req-ok="u2"]'); await p.waitForTimeout(300);
  check('Lucas Gómez (h) vinculado; el otro Lucas no', await p.evaluate(() => data.publishers.find(x => x.id === 'p16').email === 'lucasg@hotmail.com' && !data.publishers.find(x => x.id === 'p2').email));
  check('sin pendientes: sin numerito', await p.evaluate(() => !document.querySelector('.req-badge')));
  check('sin errores', p.errs.length === 0, p.errs);
  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
