// Red de seguridad de errores: un "Script error." de otro sitio (sin detalle) no muestra el cartel rojo;
// un error real de la app sí.
const { launch, FILE } = require('./_helper');
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x)); } };
(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(FILE); await p.waitForTimeout(800);
  const banner = () => p.evaluate(() => !!document.querySelector('.top-banner.error'));
  await p.evaluate(() => window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' })));
  await p.waitForTimeout(50);
  check('"Script error." de otro sitio: sin cartel', !(await banner()));
  await p.evaluate(() => window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' })));
  check('aviso de ResizeObserver: sin cartel', !(await banner()));
  await p.evaluate(() => { const e = new TypeError('x is undefined'); window.dispatchEvent(new ErrorEvent('error', { message: e.message, error: e })); });
  await p.waitForTimeout(50);
  check('un error real de la app sí muestra el cartel', await banner());
  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
