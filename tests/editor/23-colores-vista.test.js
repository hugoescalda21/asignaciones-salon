// Vista: colores de la app (botón 🎨). Estilo predeterminado para nuevos y para quienes ya la usaban,
// la hoja para elegir estilo y modo, el aviso de una vez y que todo quede guardado en el celular.
const path = require('path');
const { launch, SHOTS } = require('./_helper');
// Se sirve por http://127.0.0.1 (no file://): así el almacenamiento del navegador sobrevive a recargar la página.
const http = require('http'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
let VER;
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 300)); } };

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  VER = `http://127.0.0.1:${server.address().port}/ver/ver.html?codigo=C`;
  const b = await launch();
  async function open(init, scheme) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme || 'light' });
    await ctx.route(/googleapis|firebasejs/, r => r.abort());
    if (init) await ctx.addInitScript(init);
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => { if (!/firebase is not defined/.test(e.message)) p.errs.push(e.message); });
    await p.goto(VER); await p.waitForTimeout(400);
    await p.evaluate(() => { hideInitialLoading(); document.querySelectorAll('.wl-ov').forEach(x => x.remove()); $('gateView').classList.add('hidden'); $('authGateView').classList.add('hidden'); $('mainView').classList.remove('hidden'); });
    return p;
  }
  const st = (p) => p.evaluate(() => ({ pal: document.documentElement.getAttribute('data-paleta'), dk: document.documentElement.classList.contains('dk'), lsP: localStorage.getItem('kh-paleta'), lsM: localStorage.getItem('kh-modo'), news: !$('colNews').classList.contains('hidden'), tc: document.querySelector('meta[name="theme-color"]').content, top: getComputedStyle(document.querySelector('.topbar')).backgroundImage + getComputedStyle(document.querySelector('.topbar')).backgroundColor }));

  console.log('\nHermano nuevo');
  let p = await open(null);
  let s = await st(p);
  check('arranca con Moderno azul y sin aviso', s.pal === 'a' && s.lsP === 'a' && !s.news, s);
  check('encabezado azul y barra del celular del mismo color', /rgb\(15, 27, 45\)/.test(s.top) && s.tc === '#0F1B2D', s);
  check('botón 🎨 en el encabezado', await p.evaluate(() => { const r = $('colBtn').getBoundingClientRect(); return r.width > 20 && r.top < 80; }));
  await p.click('#colBtn'); await p.waitForTimeout(150);
  check('la hoja muestra los 4 estilos (marcado el actual) y los 3 modos', await p.evaluate(() => [...document.querySelectorAll('.col-opt b')].map(x => x.textContent).join() === 'Clásico,Moderno azul,Cálido,Vibrante' && document.querySelector('.col-opt.on').dataset.colP === 'a' && document.querySelectorAll('[data-col-m]').length === 3 && document.querySelector('[data-col-m].on').dataset.colM === 'auto'));
  await p.screenshot({ path: SHOTS + '/vista-colores.png' });
  await p.click('[data-col-p="c"]'); await p.waitForTimeout(80);
  s = await st(p);
  check('tocando Vibrante cambia al instante y se guarda', s.pal === 'c' && s.lsP === 'c' && s.tc === '#6D28D9', s);
  await p.click('[data-col-m="oscuro"]'); await p.waitForTimeout(80);
  s = await st(p);
  check('Oscuro aunque el celular esté en claro', s.dk && s.lsM === 'oscuro' && s.tc === '#4C1D95', s);
  await p.screenshot({ path: SHOTS + '/vista-colores-oscuro.png' });
  await p.click('[data-col-p="clasico"]'); await p.waitForTimeout(80);
  s = await st(p);
  check('Clásico vuelve al de siempre (sin estilo)', s.pal === null && s.lsP === 'clasico', s);
  await p.click('#colOk'); await p.waitForTimeout(80);
  check('Listo cierra la hoja', await p.evaluate(() => !document.querySelector('.col-ov')));
  await p.reload(); await p.waitForTimeout(300);
  s = await st(p);
  check('al volver a abrir la app sigue igual (Clásico, oscuro)', s.pal === null && s.dk, s);
  check('sin errores', p.errs.length === 0, p.errs);

  console.log('\nHermano que ya usaba la app');
  p = await open(() => { if (!localStorage.getItem('kh-test-init')) { localStorage.setItem('kh-test-init', '1'); localStorage.setItem('ver-last-code', 'C'); } }, 'dark');
  s = await st(p);
  check('sigue con el Clásico y el celular en oscuro manda', s.pal === null && s.lsP === 'clasico' && s.dk && s.tc === '#0C1216', s);
  check('ve el aviso "Nuevo: elegí tus colores"', s.news && await p.evaluate(() => /Nuevo: elegí tus colores/.test($('colNews').innerText)), s);
  await p.click('[data-col-open]'); await p.waitForTimeout(150);
  check('"Ver" abre la hoja y el aviso no vuelve', await p.evaluate(() => !!document.querySelector('.col-ov') && $('colNews').classList.contains('hidden') && !localStorage.getItem('kh-colores-aviso')));
  await p.click('[data-col-p="b"]'); await p.click('[data-col-m="claro"]'); await p.waitForTimeout(80);
  s = await st(p);
  check('Cálido en claro aunque el celular esté en oscuro', s.pal === 'b' && !s.dk && s.tc === '#0F8A6A', s);
  await p.keyboard.press('Escape'); await p.waitForTimeout(50);
  check('Escape cierra la hoja', await p.evaluate(() => !document.querySelector('.col-ov')));
  await p.reload(); await p.waitForTimeout(300);
  check('después de recargar no vuelve el aviso', !(await st(p)).news);
  check('sin errores', p.errs.length === 0, p.errs);

  console.log('\nCerrar el aviso con ✕ y probar con ?paleta=');
  p = await open(() => { if (!localStorage.getItem('kh-test-init')) { localStorage.setItem('kh-test-init', '1'); localStorage.setItem('welcome-seen-C', '1'); } });
  check('también lo ve quien ya había pasado la bienvenida', (await st(p)).news);
  await p.click('[data-col-x]'); await p.waitForTimeout(50);
  check('✕ lo cierra para siempre', await p.evaluate(() => $('colNews').classList.contains('hidden') && !localStorage.getItem('kh-colores-aviso')));
  await p.goto(VER + '&paleta=b'); await p.waitForTimeout(300);
  check('?paleta=b lo deja en Cálido', (await st(p)).pal === 'b');
  await p.goto(VER + '&paleta=actual'); await p.waitForTimeout(300);
  check('?paleta=actual vuelve al Clásico', (await st(p)).lsP === 'clasico');
  check('sin errores', p.errs.length === 0, p.errs);
  await b.close(); server.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
