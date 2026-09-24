// Bienvenida según el rol (primera vez) y "Puesta en marcha" del Super Admin.
const { launch, FILE, SHOTS, fixture } = require('./_helper');
const data = fixture();
data.publishers[1].email = 'martin@x.com';
data.publishers[2].email = 'laura@x.com';
Object.assign(data.settings, {
  editorEmails: ['hugo@x.com'], tecnicoAdminEmails: ['martin@x.com'], acomodadoresAdminEmails: ['aco@x.com'],
  asignacionesAdminEmails: ['asig@x.com'], anunciosOnlyEmails: ['laura@x.com'], viewerEmails: ['ver@x.com', 'suelto@x.com']
});
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x)); } };
(async () => {
  const b = await launch();
  const open = async (email, d = data) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, welcome: true });
    await ctx.route(/cloudfunctions/, r => r.fulfill({ json: { devices: [{ id: 't1', pubId: 'p0' }] } }));
    await ctx.addInitScript((dd) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(dd)); }, d);
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.goto(FILE); await p.waitForTimeout(900);
    check('sin conexión a la nube no aparece antes de saber el rol', await p.evaluate(() => $('onboardingOverlay').classList.contains('hidden')));
    await p.evaluate((email) => {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
      accessCode = 'C'; currentUser = { email, getIdToken: async () => 'tok' }; currentUserRole = computeUserRole(); applyRoleUI(); maybeShowRoleWelcome();
    }, email);
    await p.waitForTimeout(300);
    return p;
  };
  const state = (p) => p.evaluate(() => ({
    open: !$('onboardingOverlay').classList.contains('hidden'),
    badge: (document.querySelector('#onbBody .wl-badge') || {}).textContent,
    h: (document.querySelector('#onbBody h3') || {}).textContent,
    tips: document.querySelectorAll('#onbBody .wl-tip').length,
    rows: [...document.querySelectorAll('#onbBody .setup-row')].map(r => (r.classList.contains('done') ? '✓ ' : '· ') + r.querySelector('.t').innerText.replace(/\n/g, ' — ')),
    btn: $('onboardingCloseBtn').textContent
  }));

  console.log('\nAdmin de Equipo técnico');
  let p = await open('martin@x.com');
  let s = await state(p);
  check('aparece la primera vez', s.open);
  check('saluda por el nombre del hermano vinculado', /Hola, /.test(s.h) && !/Bienvenido/.test(s.h), s.h);
  check('etiqueta del rol y tres consejos', s.badge === 'Admin — Equipo técnico' && s.tips === 3, s);
  check('menciona Auto-asignar y Compartir', await p.evaluate(() => /Auto-asignar/.test($('onbBody').innerText) && /Compartir/.test($('onbBody').innerText)));
  await p.screenshot({ path: SHOTS + '/bienvenida-tecnico.png' });
  await p.click('#onboardingCloseBtn');
  check('"Empezar" la cierra y queda guardado', await p.evaluate(() => $('onboardingOverlay').classList.contains('hidden') && !!localStorage.getItem('kh-welcome-tecnico')));
  check('no vuelve a aparecer', await p.evaluate(() => { maybeShowRoleWelcome(); return $('onboardingOverlay').classList.contains('hidden'); }));
  check('se vuelve a ver desde el "?"', await p.evaluate(() => { openGuide(); $('guideWelcomeBtn').click(); return !$('onboardingOverlay').classList.contains('hidden') && $('guideOverlay').classList.contains('hidden'); }));
  check('sin errores', p.errs.length === 0, p.errs);

  console.log('\nOtros roles');
  p = await open('aco@x.com'); s = await state(p);
  check('Acomodadores: su propia versión', s.open && s.badge === 'Admin — Acomodadores' && s.h === '¡Bienvenido!', s);
  p = await open('asig@x.com'); s = await state(p);
  check('Asignaciones: orador visitante', s.open && s.badge === 'Admin — Asignaciones' && await p.evaluate(() => /Viene de otra congregación/.test($('onbBody').innerText)), s);
  p = await open('laura@x.com'); s = await state(p);
  check('Solo anuncios: vista previa y fecha del evento', s.open && s.badge === 'Anuncios' && await p.evaluate(() => /Vista previa/.test($('onbBody').innerText) && /Fecha del evento/.test($('onbBody').innerText)), s);
  check('se ve por encima de la lista de anuncios', await p.evaluate(() => { const r = $('onboardingCloseBtn').getBoundingClientRect(); return document.elementFromPoint(r.x + 5, r.y + 5) === $('onboardingCloseBtn'); }));
  await p.screenshot({ path: SHOTS + '/bienvenida-anuncios.png' });
  p = await open('ver@x.com');
  check('Solo ver: no aparece (va a la vista pública)', await p.evaluate(() => $('onboardingOverlay').classList.contains('hidden')));

  console.log('\nSuper Admin: puesta en marcha');
  p = await open('hugo@x.com'); await p.waitForTimeout(300); s = await state(p);
  check('muestra la lista de puesta en marcha', s.open && s.badge === 'Super Admin' && s.rows.length === 5, s);
  check('horario ✓ (San Agustín, jueves 19:30 · domingo 10:00)', /^✓ .*Jueves 19:30 · Domingo 10:00/.test(s.rows[0]), s.rows[0]);
  check('hermanos ✓ con la cantidad', /^✓ Hermanos cargados — \d+ hermanos/.test(s.rows[1]), s.rows[1]);
  check('accesos ✓ (3 admins · 1 solo anuncios · 2 solo ver)', /^✓ .*3 admins · 1 solo anuncios · 2 solo ver/.test(s.rows[2]), s.rows[2]);
  check('emails pendiente: 4 sin vincular', /^· .*4 sin vincular/.test(s.rows[3]), s.rows[3]);
  check('avisos: consulta los celulares (1 de 3 con email)', /1 de 3 con email/.test(s.rows[4]) && /^· /.test(s.rows[4]), s.rows[4]);
  check('con pendientes el botón dice "Seguir más tarde"', s.btn === 'Seguir más tarde', s.btn);
  await p.screenshot({ path: SHOTS + '/bienvenida-super.png' });
  await p.click('#onbBody [data-setup-go="unlinked"]'); await p.waitForTimeout(250);
  check('"Emails vinculados" lleva a Acceso filtrado por "Sin vincular"', await p.evaluate(() => $('onboardingOverlay').classList.contains('hidden') && !$('panel-ajustes').classList.contains('hidden') && $('accCard').open && accState.filter === 'unlinked'));
  check('queda como vista', await p.evaluate(() => !!localStorage.getItem('kh-welcome-super')));
  check('la tarjeta de Ajustes muestra el avance', await p.evaluate(() => /de 5 listos/.test($('setupSub').textContent) && $('setupList').querySelectorAll('.setup-row').length === 5), await p.evaluate(() => $('setupSub').textContent));
  await p.evaluate(() => { $('setupCard').open = true; $('setupCard').scrollIntoView(); }); await p.waitForTimeout(200);
  await p.screenshot({ path: SHOTS + '/puesta-en-marcha-ajustes.png' });
  await p.click('#setupList [data-setup-go="congregacion"]').catch(() => {});
  check('un punto ya listo también lleva a su lugar (Congregación)', await p.evaluate(() => $('congCard').open));
  check('sin errores', p.errs.length === 0, p.errs);

  console.log('\nCongregación recién creada');
  const vacia = fixture(); vacia.publishers = []; Object.assign(vacia.settings, { congregationName: 'Mi Congregación', meetingTimeSemana: '', meetingTimeFinde: '', editorEmails: ['hugo@x.com'] });
  p = await open('hugo@x.com', vacia); s = await state(p);
  check('nada tildado y explica qué falta', s.rows.every(r => r.startsWith('· ')) && /Falta el nombre/.test(s.rows[0]) && /Todavía no hay hermanos/.test(s.rows[1]) && /solo entrás vos/.test(s.rows[2]), s.rows);
  await p.click('#onbBody [data-setup-go="hermanos"]'); await p.waitForTimeout(200);
  check('"Hermanos cargados" lleva a Hermanos', await p.evaluate(() => !$('panel-hermanos').classList.contains('hidden')));
  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
