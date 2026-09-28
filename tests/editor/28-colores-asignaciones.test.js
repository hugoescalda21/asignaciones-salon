// App de asignaciones: estilos de color en Ajustes → Apariencia (Clásico, Moderno azul, Cálido, Vibrante).
// Es la misma elección que la vista (kh-paleta). Quien ya usaba la app sigue en Clásico; quien empieza, Moderno azul.
const { launch, SHOTS, fixture } = require('./_helper');
// Se sirve por http://127.0.0.1 (no file://): así el almacenamiento sobrevive a recargar la página.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
let FILE;
const data = fixture();
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 300)); } };
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  FILE = `http://127.0.0.1:${server.address().port}/asignaciones-salon.html`;
  const b = await launch();
  const st = (p) => p.evaluate(() => ({ pal: document.documentElement.getAttribute('data-paleta'), ls: localStorage.getItem('kh-paleta'), tc: document.querySelector('meta[name="theme-color"]').content, top: getComputedStyle(document.querySelector('.topbar')).backgroundImage, on: (document.querySelector('.pal-opt.active') || {}).dataset }));

  console.log('\nQuien ya usaba la app');
  let ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((d) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); } localStorage.setItem('kh-onboarding-seen', '1'); }, data);
  let p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(FILE); await p.waitForTimeout(800);
  let s = await st(p);
  check('sigue en Clásico (encabezado blanco)', s.pal === null && s.ls === 'clasico' && s.top === 'none', s);
  await p.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden')); document.querySelectorAll('.top-banner').forEach(m => m.remove()); switchTab('ajustes'); const c = [...document.querySelectorAll('#panel-ajustes details')].find(x => /Apariencia/.test(x.innerText)); c.open = true; c.scrollIntoView(); });
  await p.waitForTimeout(150);
  check('Ajustes → Apariencia muestra los 4 estilos (marcado el actual)', await p.evaluate(() => [...document.querySelectorAll('.pal-opt b')].map(x => x.textContent).join() === 'Clásico,Moderno azul,Cálido,Vibrante' && document.querySelector('.pal-opt.active').dataset.pal === 'clasico'));
  await p.click('.pal-opt[data-pal="b"]'); await p.waitForTimeout(100);
  s = await st(p);
  check('elegir Cálido cambia al instante: encabezado verde y barra del celular', s.pal === 'b' && s.ls === 'b' && /gradient/.test(s.top) && s.tc === '#0F8A6A', s);
  await p.screenshot({ path: SHOTS + '/asignaciones-colores.png' });
  await p.click('.theme-opt[data-theme-choice="dark"]'); await p.waitForTimeout(100);
  check('en oscuro la barra del celular también acompaña', (await st(p)).tc === '#0B5E49');
  await p.reload(); await p.waitForTimeout(700);
  check('al volver a abrir sigue en Cálido', (await st(p)).pal === 'b');
  check('sin errores', errs.length === 0, errs);
  await ctx.close();

  console.log('\nQuien empieza de cero');
  ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  p = await ctx.newPage();
  await p.goto(FILE); await p.waitForTimeout(800);
  s = await st(p);
  check('arranca con Moderno azul', s.pal === 'a' && s.ls === 'a', s);
  await b.close(); server.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
