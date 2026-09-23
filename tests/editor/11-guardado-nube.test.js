const { launch, FILE, SHOTS, fixture } = require('./_helper');
const data = fixture();
data.anuncios = [{ id: 'a1', text: 'hola', dateIso: new Date().toISOString() }];
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 400)); } };
// "servidor" en Node: aplica updates con rutas como lo hace Firestore
function applyUpdate(doc, calls) {
  for (let i = 0; i < calls.length; i += 2) {
    const path = calls[i].s, v = calls[i + 1];
    let o = doc; for (let j = 0; j < path.length - 1; j++) { if (typeof o[path[j]] !== 'object' || o[path[j]] === null || Array.isArray(o[path[j]])) o[path[j]] = {}; o = o[path[j]]; }
    if (v && v.__del) delete o[path[path.length - 1]]; else o[path[path.length - 1]] = v;
  }
}
async function client(b, serverDoc, email, role) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/gstatic/, r => r.abort());
  await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); localStorage.setItem('kh-onboarding-seen', '1'); }, serverDoc);
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(FILE); await p.waitForTimeout(800);
  // Simula lo que hace el onSnapshot al recibir la copia de la nube + un Firestore falso que registra los updates
  await p.evaluate(({ raw, email, role }) => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    window.__calls = [];
    window.firebase = { firestore: { FieldPath: function (...s) { this.s = s; }, FieldValue: { delete: () => ({ __del: true }) } } };
    fbDb = { collection: () => ({ doc: () => ({ update: (...args) => { window.__calls.push(args.map(a => a && a.s ? { s: a.s } : a)); return Promise.resolve(); } }) }) };
    accessCode = 'C';
    currentUser = email ? { email } : null;
    applyingRemoteUpdate = true;
    data = migrate(JSON.parse(JSON.stringify(raw))); window.data = data;
    cloudBase = jsonClone(data);
    if (role) currentUserRole = role;
    initUiFromData(); renderAll();
    applyingRemoteUpdate = false;
  }, { raw: serverDoc, email, role });
  return p;
}
const calls = (p) => p.evaluate(() => window.__calls);
const paths = (cs) => cs.flatMap(c => c.filter((_, i) => i % 2 === 0).map(x => x.s.join('/')));
(async () => {
  const b = await launch();
  const server = JSON.parse(JSON.stringify(data));
  const A = await client(b, server, 'super@x.com', 'super');
  const B = await client(b, server, 'super@x.com', 'super');
  await A.evaluate(() => saveData()); await A.waitForTimeout(100);
  check('guardar sin cambios no sube nada (ni lo que normaliza migrate)', (await calls(A)).length === 0, await calls(A));
  // A asigna mic2, B asigna presidente de finde, "al mismo tiempo"
  await A.evaluate(() => { const s = document.querySelector('select[data-role="mic2"]'); const o = [...s.options].find(o => o.value && o.value !== s.value); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await B.evaluate(() => { data.weeks['2026-09-21'].finde.program.presidente = 'p9'; saveData(); });
  await A.waitForTimeout(150);
  const ca = await calls(A), cb = await calls(B);
  console.log('A:', paths(ca)); console.log('B:', paths(cb));
  check('A sube solo su campo (weeks/…/semana/roles/mic2)', paths(ca).length >= 1 && paths(ca).every(x => /^weeks\/2026-09-21\/semana\/roles\/mic2$/.test(x)), paths(ca));
  check('B sube solo su campo', paths(cb).join() === 'weeks/2026-09-21/finde/program/presidente', paths(cb));
  const S = JSON.parse(JSON.stringify(server));
  ca.forEach(c => applyUpdate(S, c)); cb.forEach(c => applyUpdate(S, c));
  check('en la nube quedan LOS DOS cambios (antes el segundo borraba el primero)', !!S.weeks['2026-09-21'].semana.roles.mic2 && S.weeks['2026-09-21'].finde.program.presidente === 'p9' && S.weeks['2026-09-21'].semana.roles.sonido === server.weeks['2026-09-21'].semana.roles.sonido);
  // semana nueva (no existe en la nube)
  await A.evaluate(() => { window.__calls = []; ensureWeek('2026-10-05').semana.roles.sonido = 'p1'; saveData(); });
  const cn = await calls(A); console.log('nueva semana:', paths(cn));
  const S2 = JSON.parse(JSON.stringify(S)); cn.forEach(c => applyUpdate(S2, c));
  check('semana nueva se crea en la nube con su asignación', S2.weeks['2026-10-05'] && S2.weeks['2026-10-05'].semana.roles.sonido === 'p1', S2.weeks['2026-10-05']);
  // borrar un campo
  await A.evaluate(() => { window.__calls = []; delete data.weeks['2026-09-21'].semana.program.perlas; saveData(); });
  const cd = await calls(A);
  check('borrar un campo usa "delete" solo en ese campo', cd.length === 1 && cd[0][0].s.join('/') === 'weeks/2026-09-21/semana/program/perlas' && cd[0][1].__del === true, cd);
  // anuncios y ajustes: arrays enteros pero solo esa sección
  await A.evaluate(() => { window.__calls = []; data.anuncios.push({ id: 'a2', text: 'nuevo' }); data.settings.timerMuted = !data.settings.timerMuted; saveData(); });
  check('anuncio nuevo + un ajuste: solo "anuncios" y "settings/timerMuted"', paths(await calls(A)).sort().join() === 'anuncios,settings/timerMuted', paths(await calls(A)));
  // mismo contenido con claves en otro orden (como devuelve la nube) no genera escritura
  await A.evaluate(() => { window.__calls = []; const w = cloudBase.weeks['2026-09-21'].semana.roles; const r = {}; Object.keys(w).reverse().forEach(k => r[k] = w[k]); cloudBase.weeks['2026-09-21'].semana.roles = r; cloudBase.anuncios = cloudBase.anuncios.map(a => Object.fromEntries(Object.entries(a).reverse())); saveData(); });
  check('mismo contenido con otro orden de claves: no sube nada', (await calls(A)).length === 0, await calls(A));
  // Solo anuncios: nunca manda otra cosa
  const C = await client(b, server, 'solo@x.com', 'anuncios');
  await C.evaluate(() => { window.__calls = []; data.anuncios.push({ id: 'z', text: 'x' }); data.weeks['2026-09-21'].semana.roles.mic1 = 'p0'; saveData(); });
  check('"Solo anuncios" sube únicamente anuncios', paths(await calls(C)).join() === 'anuncios', paths(await calls(C)));
  // Sin copia de la nube todavía: no sube nada a ciegas
  await A.evaluate(() => { window.__calls = []; cloudBase = null; data.settings.timerMuted = !data.settings.timerMuted; saveData(); });
  check('sin copia de la nube no escribe', (await calls(A)).length === 0);
  // espacio usado
  await A.evaluate(() => { updateCloudSize(data); });
  check('muestra el espacio usado', await A.evaluate(() => /Espacio usado en la nube: .*KB de 1024 KB/.test($('cloudSizeInfo').textContent)), await A.evaluate(() => $('cloudSizeInfo').textContent));
  await A.evaluate(() => { const big = { x: 'a'.repeat(800000) }; updateCloudSize(big); });
  check('aviso al Super Admin al pasar el 70%', await A.evaluate(() => !!document.getElementById('cloudSizeBanner')));
  check('sin errores', [A, B, C].every(p => p.errs.length === 0), [A.errs, B.errs, C.errs]);
  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
