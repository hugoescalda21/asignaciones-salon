// Conectar con un código que no existe: no se crea sola una congregación vacía; se pregunta
// (Revisar el código / Crear una nueva). "Generar uno nuevo" sí crea directo.
const { launch, FILE, SHOTS, fixture } = require('./_helper');
const data = fixture();
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 300)); } };
(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); }, data);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(FILE); await p.waitForTimeout(800);
  await p.evaluate(() => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    window.__db = { SALON2026: { settings: { editorEmails: ['hugo@x.com'] }, publishers: [], weeks: {} } }; window.__sets = [];
    window.firebase = { firestore: { FieldValue: { arrayUnion: (x) => x } } };
    const ref = (id) => ({
      get: async () => ({ exists: !!window.__db[id], metadata: { fromCache: false }, data: () => JSON.parse(JSON.stringify(window.__db[id])) }),
      onSnapshot: (cb) => { if (window.__db[id]) cb({ exists: true, data: () => JSON.parse(JSON.stringify(window.__db[id])) }); return () => {}; },
      set: async (o) => { window.__db[id] = JSON.parse(JSON.stringify(o)); window.__sets.push(id); },
      update: async () => {}, collection: () => ({ add: async () => ({}), onSnapshot: () => () => {} })
    });
    fbDb = { collection: () => ({ doc: ref }) };
    initFirebase = () => true;
    currentUser = { email: 'hugo@x.com', getIdToken: async () => 't' };
    $('codeModalOverlay').classList.remove('hidden');
  });
  await p.fill('#accessCodeInput', 'salon2062'); await p.click('#connectCodeBtn'); await p.waitForTimeout(200);
  let s = await p.evaluate(() => ({ modal: !!$('codeNotFoundOverlay'), txt: ($('codeNotFoundOverlay') || {}).innerText, sets: window.__sets, code: accessCode, saved: localStorage.getItem('kh-access-code') }));
  check('código que no existe: pregunta en vez de crear', s.modal && /SALON2062/.test(s.txt) && s.sets.length === 0, s);
  check('no queda conectado ni guardado ese código', s.code === null && s.saved !== 'SALON2062', s);
  await p.screenshot({ path: SHOTS + '/codigo-inexistente.png' });
  await p.click('#cnfFix'); await p.waitForTimeout(100);
  s = await p.evaluate(() => ({ open: !$('codeModalOverlay').classList.contains('hidden'), val: $('accessCodeInput').value, gone: !$('codeNotFoundOverlay') }));
  check('"Revisar el código" vuelve al cuadro con el código escrito para corregirlo', s.open && s.val === 'SALON2062' && s.gone, s);
  await p.fill('#accessCodeInput', 'SALON2026'); await p.click('#connectCodeBtn'); await p.waitForTimeout(200);
  s = await p.evaluate(() => ({ code: accessCode, modal: !!$('codeNotFoundOverlay'), sets: window.__sets }));
  check('con el código bien escrito se conecta sin crear nada', s.code === 'SALON2026' && !s.modal && s.sets.length === 0, s);
  // Crear una nueva a propósito
  await p.evaluate(() => { accessCode = null; $('codeModalOverlay').classList.remove('hidden'); });
  await p.fill('#accessCodeInput', 'NUEVA1'); await p.click('#connectCodeBtn'); await p.waitForTimeout(200);
  await p.click('#cnfCreate'); await p.waitForTimeout(200);
  s = await p.evaluate(() => ({ code: accessCode, sets: window.__sets, ed: (window.__db.NUEVA1 || { settings: {} }).settings.editorEmails }));
  check('"Crear una nueva" (con confirmación) la crea con uno como Super Admin', s.code === 'NUEVA1' && s.sets.join() === 'NUEVA1' && s.ed.join() === 'hugo@x.com', s);
  // Generar uno nuevo → crea directo
  await p.evaluate(() => { accessCode = null; $('codeModalOverlay').classList.remove('hidden'); });
  await p.click('#genCodeBtn'); await p.click('#connectCodeBtn'); await p.waitForTimeout(200);
  s = await p.evaluate(() => ({ modal: !!$('codeNotFoundOverlay'), sets: window.__sets, code: accessCode }));
  check('"Generar uno nuevo" crea directo, sin preguntar', !s.modal && s.sets.length === 2 && s.sets[1] === s.code, s);
  check('sin errores', errs.length === 0, errs);
  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
