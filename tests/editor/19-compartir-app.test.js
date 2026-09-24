// Ajustes → Compartir la app: links para hermanos y admins (WhatsApp, copiar, QR) y "Mandarle el link" en Acceso.
const { launch, FILE, SHOTS, fixture } = require('./_helper');
const data = fixture();
Object.assign(data.settings, { editorEmails: ['hugo@x.com'], viewerEmails: ['ver@x.com'], tecnicoAdminEmails: ['tec@x.com'] });
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 400)); } };
(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await ctx.addInitScript((d) => {
    localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d));
    window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; };
    window.__clip = null;
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__clip = t; } }, configurable: true });
  }, data);
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(FILE + '?codigo=salon-2026'); await p.waitForTimeout(800);
  check('el código del link queda guardado (sin escribirlo)', await p.evaluate(() => localStorage.getItem('kh-access-code') === 'SALON2026'));
  await p.evaluate(() => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    accessCode = 'SALON2026'; currentUser = { email: 'hugo@x.com' }; currentUserRole = computeUserRole(); applyRoleUI();
    switchTab('ajustes'); $('shareCard').open = true; $('shareCard').scrollIntoView();
  });
  await p.waitForTimeout(200);
  const links = await p.evaluate(() => [$('saLinkVista').textContent, $('saLinkAdmin').textContent]);
  check('link de hermanos: la vista con el código', /\/ver\/ver\.html\?codigo=SALON2026$/.test(links[0]), links[0]);
  check('link de admins: la app de asignaciones con el código', /\/asignaciones-salon\.html\?codigo=SALON2026$/.test(links[1]), links[1]);
  await p.screenshot({ path: SHOTS + '/compartir-app.png' });

  await p.click('[data-share-app="vista"][data-how="wa"]');
  const wa = await p.evaluate(() => decodeURIComponent((window.__opened[0] || '').split('text=')[1] || ''));
  check('WhatsApp de hermanos: mensaje + link', /^https:\/\/wa\.me\/\?text=/.test(await p.evaluate(() => window.__opened[0])) && /pedí tu acceso/.test(wa) && wa.includes(links[0]), wa);
  await p.click('[data-share-app="admin"][data-how="copy"]'); await p.waitForTimeout(100);
  check('Copiar link de admins', await p.evaluate(() => window.__clip) === links[1]);

  await p.click('[data-share-app="vista"][data-how="qr"]'); await p.waitForTimeout(600);
  check('QR: se abre con el código dibujado', await p.evaluate(() => !$('qrOverlay').classList.contains('hidden') && !!$('qrBox').querySelector('canvas') && $('qrBox').querySelector('canvas').width >= 200));
  await p.screenshot({ path: SHOTS + '/compartir-qr.png' });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#qrDownloadBtn')]);
  check('"Descargar para imprimir" baja una imagen', dl.suggestedFilename() === 'qr-app-congregacion.png', dl.suggestedFilename());
  await p.click('#qrCloseBtn');

  console.log('\nAcceso → menú de cada persona');
  await p.evaluate(() => { window.__opened = []; openAccMenu('ver@x.com'); });
  await p.waitForTimeout(100);
  await p.click('[data-accm="send"]');
  check('"Solo ver" → le manda el link de la vista', await p.evaluate(() => /ver%2Fver\.html%3Fcodigo%3DSALON2026/.test(window.__opened[0] || '')));
  await p.evaluate(() => { window.__opened = []; openAccMenu('tec@x.com'); });
  await p.waitForTimeout(100);
  await p.click('[data-accm="send"]');
  check('Admin → le manda el link de la app de asignaciones', await p.evaluate(() => /asignaciones-salon\.html%3Fcodigo%3DSALON2026/.test(window.__opened[0] || '')));
  check('sin errores', p.errs.length === 0, p.errs);
  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
