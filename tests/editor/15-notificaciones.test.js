const { launch, FILE, SHOTS, HOY, fixture } = require('./_helper');
const data = fixture();
data.publishers[13].email = 'sofia@x.com'; data.publishers[14].email = 'laura@x.com'; data.publishers[2].email = 'lucas@x.com';
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 300)); } };
const now = HOY.getTime(), iso = (m) => new Date(now - m * 60000).toISOString();
let devices = [
  { id: 'tokA', pubId: 'p0', createdAt: iso(3000), updatedAt: iso(60), device: 'Android · Chrome · instalada', lastOkAt: iso(120), lastKind: 'asignacion', reminderPrefs: { dayBefore: true, morning: false, hoursBefore: 0 } },
  { id: 'tokB', pubId: 'p13', createdAt: iso(90), updatedAt: iso(90), device: 'Android · Samsung', lastErrAt: iso(30), lastErr: 'messaging/third-party-auth-error', lastKind: 'asignacion' },
  { id: 'tokC', pubId: 'p0', createdAt: iso(9000), device: '' }
];
const calls = [];
(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); localStorage.setItem('kh-onboarding-seen', '1'); }, data);
  await ctx.route(/cloudfunctions\.net\/devices/, async (route) => {
    const req = route.request(); const body = JSON.parse(req.postData() || '{}'); calls.push({ body, auth: req.headers()['authorization'] });
    let out;
    if (body.action === 'list') out = { devices };
    else if (body.action === 'test') out = body.token === 'tokC' ? { ok: false, error: 'messaging/registration-token-not-registered', removed: true } : { ok: true };
    else if (body.action === 'remove') { devices = devices.filter(d => d.id !== body.token); out = { ok: true }; }
    if (body.action === 'test' && body.token === 'tokC') devices = devices.filter(d => d.id !== 'tokC');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out), headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(FILE); await p.waitForTimeout(900);
  await p.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden')); accessCode = 'C'; currentUser = { email: 'hugo@x.com', getIdToken: async () => 'IDTOKEN' }; currentUserRole = 'super'; switchTab('ajustes'); });
  await p.evaluate(() => { $('devCard').open = true; $('devCard').scrollIntoView(); });
  await p.waitForTimeout(400);
  const txt = await p.evaluate(() => $('devCard').innerText);
  console.log(txt.slice(0, 300));
  check('manda el token de sesión y el código', calls[0] && calls[0].auth === 'Bearer IDTOKEN' && calls[0].body.code === 'C' && calls[0].body.action === 'list', calls[0]);
  check('resumen: 3 celulares de 2 hermanos · 1 con problemas', await p.evaluate(() => $('devSub').textContent === '3 celulares de 2 hermanos · 1 con problemas'), await p.evaluate(() => $('devSub').textContent));
  check('los que tienen problemas van primero, con el motivo', /Sofía Abad[\s\S]*falló[\s\S]*third-party-auth-error[\s\S]*Hugo Escalda/.test(txt));
  check('muestra el último aviso enviado y los recordatorios', /Último aviso \(asignación\) enviado hace 2 h/.test(txt) && /recordatorios: día anterior/.test(txt));
  check('celular viejo sin datos: "sin identificar"', /sin identificar/.test(txt));
  check('con email pero sin notificaciones: Laura Paz y Lucas Gómez', await p.evaluate(() => { const d = document.querySelector('.dev-none'); return d && /: 2/.test(d.querySelector('summary').textContent) && /Laura Paz/.test(d.textContent) && /Lucas Gómez/.test(d.textContent); }));
  await p.screenshot({ path: SHOTS + '/notificaciones.png', fullPage: false });
  await p.click('[data-dev-test="tokA"]'); await p.waitForTimeout(400);
  check('Enviar prueba: llama a la función y avisa', calls.some(c => c.body.action === 'test' && c.body.token === 'tokA') && await p.evaluate(() => [...document.querySelectorAll('#toastContainer .toast')].some(t => /Prueba enviada/.test(t.textContent))));
  await p.click('[data-dev-test="tokC"]'); await p.waitForTimeout(400);
  check('celular ya no registrado: avisa y desaparece de la lista', await p.evaluate(() => [...document.querySelectorAll('#toastContainer .toast')].some(t => /ya no está registrado/.test(t.textContent)) && !document.querySelector('[data-dev-test="tokC"]')));
  p.once('dialog', d => d.accept());
  await p.click('[data-dev-rm="tokB"]'); await p.waitForTimeout(400);
  check('Quitar un celular', await p.evaluate(() => !document.querySelector('[data-dev-test="tokB"]')));
  await p.fill('#devSearch', 'hugo'); await p.waitForTimeout(100);
  check('buscador', await p.evaluate(() => document.querySelectorAll('.dev-pub').length === 1));
  // Sin la función publicada
  await ctx.unroute(/cloudfunctions\.net\/devices/);
  await ctx.route(/cloudfunctions\.net\/devices/, r => r.fulfill({ status: 404, body: 'Not found' }));
  await p.click('#devRefreshBtn'); await p.waitForTimeout(300);
  check('si falta publicar la función, lo explica', await p.evaluate(() => /firebase deploy --only functions/.test($('devList').textContent)));
  check('sin errores', errs.length === 0, errs);
  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
