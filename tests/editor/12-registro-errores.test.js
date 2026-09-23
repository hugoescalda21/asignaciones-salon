const { launch, FILE, SHOTS, fixture } = require('./_helper');
const data = fixture();
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 300)); } };
// Firestore falso en memoria: alcanza para la subcolección "errores" y para el guardado.
const FAKE = () => {
  window.__store = window.__store || [];
  const col = {
    add: (d) => { window.__store.push(Object.assign({ __id: 'e' + Math.random().toString(36).slice(2, 8) }, d)); return Promise.resolve(); },
    where: (f, op, v) => ({ limit: () => ({ get: () => { const docs = window.__store.filter(x => op === '>' ? x[f] > v : x[f] < v); return Promise.resolve({ empty: !docs.length, size: docs.length, forEach: fn => docs.forEach(x => fn({ id: x.__id, data: () => x, ref: { delete: () => { window.__store = window.__store.filter(y => y !== x); return Promise.resolve(); } } })) }); } }) }),
    orderBy: () => ({ limit: (n) => ({ get: () => { const docs = window.__store.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, n); return Promise.resolve({ forEach: fn => docs.forEach(x => fn({ id: x.__id, data: () => x })) }); } }) }),
    doc: (id) => ({ delete: () => { window.__store = window.__store.filter(y => y.__id !== id); return Promise.resolve(); } })
  };
  window.__failSave = false;
  fbDb = { collection: () => ({ doc: () => ({ collection: () => col, update: () => window.__failSave ? Promise.reject(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' })) : Promise.resolve(), set: () => Promise.resolve() }) }) };
  window.firebase = { firestore: { FieldPath: function (...s) { this.s = s; }, FieldValue: { delete: () => ({}) } } };
};
(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); localStorage.setItem('kh-onboarding-seen', '1'); }, data);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(FILE); await p.waitForTimeout(900);
  await p.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden')));
  // Antes de conectarse: el error queda en espera
  await p.evaluate((m) => { const s = document.createElement('script'); s.textContent = 'throw new Error(' + JSON.stringify(m) + ')'; document.body.appendChild(s); }, 'Algo falló antes de conectar');
  await p.waitForTimeout(100);
  check('sin conexión todavía: queda en espera', await p.evaluate(() => errQueue.length === 1 && errQueue[0].kind === 'error' && errQueue[0].app === 'editor'));
  await p.evaluate(FAKE);
  await p.evaluate(() => { accessCode = 'C'; currentUser = { email: 'hugo@x.com' }; currentUserRole = 'super'; cloudBase = jsonClone(data); flushCloudErrors(); });
  await p.waitForTimeout(50);
  check('al conectarse se sube a la nube', await p.evaluate(() => window.__store.length === 1 && /antes de conectar/.test(window.__store[0].msg) && !!window.__store[0].device && window.__store[0].at));
  check('no guarda datos personales (ni email ni nombre)', await p.evaluate(() => !JSON.stringify(window.__store).includes('hugo@x.com')));
  // Repetidos y tope
  await p.evaluate(() => { for (let i = 0; i < 3; i++) { const s = document.createElement('script'); s.textContent = 'throw new Error("Mismo error")'; document.body.appendChild(s); } });
  await p.waitForTimeout(100);
  check('el mismo error no se repite', await p.evaluate(() => window.__store.filter(x => /Mismo error/.test(x.msg)).length === 1));
  await p.evaluate(() => { for (let i = 0; i < 15; i++) { const s = document.createElement('script'); s.textContent = 'throw new Error("Error ' + i + '")'; document.body.appendChild(s); } });
  await p.waitForTimeout(150);
  check('máximo 10 por sesión', await p.evaluate(() => window.__store.length === 10), await p.evaluate(() => window.__store.length));
  // Guardado rechazado por la nube
  await p.evaluate(() => { errCount = 0; window.__failSave = true; data.settings.timerMuted = !data.settings.timerMuted; saveData(); });
  await p.waitForTimeout(100);
  check('un guardado rechazado queda registrado', await p.evaluate(() => window.__store.some(x => x.kind === 'guardado' && /permission-denied/.test(x.msg))));
  // Aviso al Super Admin
  await p.evaluate(() => { localStorage.removeItem('kh-err-seen'); errNewChecked = false; checkNewCloudErrors(); });
  await p.waitForTimeout(100);
  check('aviso de errores nuevos al Super Admin', await p.evaluate(() => !!document.getElementById('errNewBanner') && /errores nuevos/.test(document.getElementById('errNewBanner').textContent)));
  await p.click('#errNewSee'); await p.waitForTimeout(300);
  check('"Ver" abre Ajustes → Registro de errores con la lista', await p.evaluate(() => $('errLogCard').open && document.querySelectorAll('#errLogList .err-item').length >= 10 && /en los últimos 30 días/.test($('errLogSub').textContent)));
  await p.screenshot({ path: SHOTS + '/errores.png' });
  await p.evaluate(() => { errNewChecked = false; document.getElementById('errNewBanner') && document.getElementById('errNewBanner').remove(); checkNewCloudErrors(); });
  await p.waitForTimeout(100);
  check('ya vistos: no vuelve a avisar', await p.evaluate(() => !document.getElementById('errNewBanner')));
  // Limpieza de viejos y "Borrar todos"
  await p.evaluate(() => { window.__store.push({ __id: 'viejo', at: '2026-07-01T10:00:00.000Z', app: 'vista', kind: 'error', msg: 'Viejo' }); });
  await p.click('#errLogRefreshBtn'); await p.waitForTimeout(200);
  check('los de más de 30 días se borran solos', await p.evaluate(() => !window.__store.some(x => x.__id === 'viejo')));
  await p.click('#errLogClearBtn'); await p.waitForTimeout(200);
  check('"Borrar todos" vacía el registro', await p.evaluate(() => window.__store.length === 0 && /No hubo errores/.test($('errLogList').textContent)));
  check('un admin que no es Super no recibe el aviso', await p.evaluate(async () => { window.__store.push({ __id: 'x', at: new Date().toISOString(), msg: 'x', kind: 'error' }); localStorage.removeItem('kh-err-seen'); errNewChecked = false; currentUserRole = 'tecnico'; await checkNewCloudErrors(); return !document.getElementById('errNewBanner'); }));
  check('sin errores propios de la página (fuera de los provocados)', errs.every(m => /antes de conectar|Mismo error|Error \d+/.test(m)), errs);
  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
