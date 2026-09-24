// Permisos del lado del servidor: lo que guarda la app para cada Admin tiene que pasar
// las reglas nuevas (solo "weeks") y el control de guardRoles (solo su área). Si la app
// subiera algo más, el servidor lo rechazaría o lo desharía y el Admin no podría trabajar.
const path = require('path');
const { launch, FILE, fixture } = require('./_helper');
const { disallowedWeekChanges } = require(path.resolve(__dirname, '../../push-salon-2026/functions/lib.js'));
const data = fixture();
Object.assign(data.settings, { editorEmails: ['hugo@x.com'], tecnicoAdminEmails: ['tec@x.com'], acomodadoresAdminEmails: ['aco@x.com'], asignacionesAdminEmails: ['asig@x.com'] });
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 400)); } };
function applyUpdate(doc, call) {
  for (let i = 0; i < call.length; i += 2) {
    const p = call[i].s, v = call[i + 1];
    let o = doc; for (let j = 0; j < p.length - 1; j++) { if (typeof o[p[j]] !== 'object' || o[p[j]] === null || Array.isArray(o[p[j]])) o[p[j]] = {}; o = o[p[j]]; }
    if (v && v.__del) delete o[p[p.length - 1]]; else o[p[p.length - 1]] = v;
  }
}
async function client(b, email) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); }, data);
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(FILE); await p.waitForTimeout(800);
  // Firestore falso: la sincronización real (startSync + onSnapshot) contra una copia del servidor.
  await p.evaluate(async ({ server, email }) => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    window.__server = server; window.__calls = [];
    window.firebase = { firestore: { FieldPath: function (...s) { this.s = s; }, FieldValue: { delete: () => ({ __del: true }), arrayUnion: (x) => x } } };
    const docRef = {
      get: async () => ({ exists: true, data: () => JSON.parse(JSON.stringify(window.__server)) }),
      onSnapshot: (cb) => { window.__snap = cb; cb({ exists: true, data: () => JSON.parse(JSON.stringify(window.__server)) }); return () => {}; },
      update: (...args) => { window.__calls.push(args.map(a => a && a.s ? { s: a.s } : a)); return Promise.resolve(); },
      set: async () => {}, collection: () => ({ add: async () => ({}) })
    };
    fbDb = { collection: () => ({ doc: () => docRef }) };
    currentUser = { email, getIdToken: async () => 't' };
    await startSync('C');
  }, { server: data, email });
  await p.waitForTimeout(200);
  return p;
}
async function uploaded(p) {
  const calls = await p.evaluate(() => window.__calls);
  const S = JSON.parse(JSON.stringify(data));
  calls.forEach(c => applyUpdate(S, c));
  const tops = [...new Set(calls.flatMap(c => c.filter((_, i) => i % 2 === 0).map(x => x.s[0])))];
  return { calls, S, tops };
}
(async () => {
  const b = await launch();

  console.log('\nAdmin de Equipo técnico');
  let p = await client(b, 'tec@x.com');
  check('entra como Admin técnico', await p.evaluate(() => currentUserRole === 'tecnico'));
  await p.click('#narrowThemeBtn'); await p.waitForTimeout(100);
  check('cambiar el tema no sube nada a la nube (es de cada celular)', (await p.evaluate(() => window.__calls.length)) === 0 && await p.evaluate(() => localStorage.getItem('kh-theme-mode') === 'dark' && document.documentElement.getAttribute('data-theme') === 'dark'));
  await p.evaluate(() => { const s = document.querySelector('select[data-role="mic2"]'); const o = [...s.options].find(o => o.value && o.value !== s.value); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.click('#autoAssignBtn'); await p.waitForTimeout(250);
  let u = await uploaded(p);
  check('asignar y Auto-asignar suben cambios', u.calls.length > 0);
  check('solo toca "weeks" (lo permiten las reglas)', u.tops.length === 1 && u.tops[0] === 'weeks', u.tops);
  check('nada fuera de su área (guardRoles no deshace nada)', disallowedWeekChanges(data.weeks, u.S.weeks, ['tecnico']).length === 0, disallowedWeekChanges(data.weeks, u.S.weeks, ['tecnico']));
  check('sin errores', p.errs.length === 0, p.errs);

  console.log('\nAdmin de Acomodadores');
  p = await client(b, 'aco@x.com');
  await p.click('#autoAssignBtn'); await p.waitForTimeout(250);
  u = await uploaded(p);
  check('Auto-asignar sube solo acomodadores', u.calls.length > 0 && u.tops.join() === 'weeks' && disallowedWeekChanges(data.weeks, u.S.weeks, ['acomodadores']).length === 0, disallowedWeekChanges(data.weeks, u.S.weeks, ['acomodadores']));

  console.log('\nAdmin de Asignaciones');
  p = await client(b, 'asig@x.com');
  await p.evaluate(() => { const w = ensureWeek('2026-10-05'); w.semana.program.presidente = 'p3'; w.finde.program.oradorPublico = 'p4'; saveData(); });
  await p.waitForTimeout(200);
  u = await uploaded(p);
  check('una semana nueva con programa sube solo "weeks" y nada del Equipo técnico', u.tops.join() === 'weeks' && disallowedWeekChanges(data.weeks, u.S.weeks, ['asignaciones']).length === 0, disallowedWeekChanges(data.weeks, u.S.weeks, ['asignaciones']));

  console.log('\nCuando el servidor deshace un cambio');
  p = await client(b, 'tec@x.com');
  const guarded = JSON.parse(JSON.stringify(data)); guarded._guard = { at: new Date().toISOString(), by: 'tec@x.com', n: 1 };
  await p.evaluate((d) => { window.__snap({ exists: true, data: () => d }); }, guarded);
  await p.waitForTimeout(150);
  check('le avisa a quien lo hizo', await p.evaluate(() => /no corresponde a tu rol y se deshizo/.test(document.body.innerText)));
  const q = await client(b, 'hugo@x.com');
  await q.evaluate((d) => { window.__snap({ exists: true, data: () => d }); }, guarded);
  await q.waitForTimeout(150);
  check('a los demás no', await q.evaluate(() => !/no corresponde a tu rol/.test(document.body.innerText)));
  check('el campo _guard no se vuelve a subir', await q.evaluate(() => { saveData(); return window.__calls.every(c => !c.some(a => a && a.s && a.s[0] === '_guard')); }));
  check('el registro muestra los del servidor como "Control de permisos"', await q.evaluate(() => /Control de permisos/.test(document.querySelector('script:not([src])').textContent)));

  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
