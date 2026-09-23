// Datos como los que quedaron en la nube el 23/9/2026: semanas a las que les falta "roles"
// (o "program", o un tipo de reunión entero). Antes la app se rompía al abrir y no se conectaba.
const { launch, FILE, fixture } = require('./_helper');
const data = fixture();
data.weeks['2026-09-21'].finde = { program: { presidente: 'p1', oradorPublico: 'p5' } };          // sin roles
data.weeks['2026-09-28'] = { finde: { program: { presidente: 'p2' } } };                          // sin semana y sin roles
data.weeks['2026-10-05'] = { semana: { roles: { sonido: 'p0' } } };                               // sin program ni finde
data.weeks['2026-10-12'] = null;                                                                  // vacía
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 300)); } };
(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); localStorage.setItem('kh-onboarding-seen', '1'); }, data);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(FILE); await p.waitForTimeout(1200);
  check('abre sin errores con semanas incompletas', errs.length === 0, errs);
  check('sin cartel de error', await p.evaluate(() => !document.querySelector('.top-banner.error')));
  check('las semanas quedan con su estructura completa', await p.evaluate(() => ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'].every(m => ['semana', 'finde'].every(t => data.weeks[m][t] && data.weeks[m][t].roles && 'sonido' in data.weeks[m][t].roles && data.weeks[m][t].program && Array.isArray(data.weeks[m][t].excluded)))));
  check('conserva lo que había cargado', await p.evaluate(() => data.weeks['2026-09-21'].finde.program.presidente === 'p1' && data.weeks['2026-10-05'].semana.roles.sonido === 'p0'));
  check('el sábado 26 y el Equipo técnico se ven', await p.evaluate(() => { goToMeeting(dateForType('2026-09-21', 'finde'), 'finde'); return document.querySelectorAll('.tec-list .role-card').length > 3; }));
  check('los puntos de las subpestañas y los conteos aparecen', await p.evaluate(() => /faltan|✓/.test($('countTecnico').textContent)));
  // Una falla al dibujar no impide conectarse a la nube
  const p2 = await ctx.newPage(); const errs2 = []; p2.on('pageerror', e => errs2.push(e.message));
  await p2.addInitScript(() => { window.__syncCalled = false; });
  await p2.goto(FILE); await p2.waitForTimeout(300);
  const r = await p2.evaluate(async () => { const orig = renderAll; renderAll = () => { throw new Error('falla de prueba'); }; let called = false; const oi = initCloudSync; initCloudSync = async () => { called = true; }; try { await loadData(); } catch (e) { return 'loadData tiró: ' + e.message; } renderAll = orig; initCloudSync = oi; return called; });
  check('si algo falla al dibujar, igual se conecta a la nube', r === true, r);
  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
