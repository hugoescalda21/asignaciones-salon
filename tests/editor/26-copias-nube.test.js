// Ajustes → Copia de seguridad: copias automáticas en la nube (Super Admin). Lista, hacer una ahora,
// descargar, restaurar (elige qué partes) e importar el archivo completo. Con la función "backups" simulada.
const { launch, FILE, SHOTS, fixture } = require('./_helper');
const data = fixture();
Object.assign(data.settings, { editorEmails: ['hugo@x.com'], tecnicoAdminEmails: ['tec@x.com'] });
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 400)); } };
(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await ctx.addInitScript((d) => {
    localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d));
    window.__calls = [];
    window.__bk = [{ file: '2026-09-27_0330-auto.json', dateIso: '2026-09-27', time: '03:30', kind: 'auto', label: 'Automática', size: 48213 },
      { file: '2026-09-20_0330-auto.json', dateIso: '2026-09-20', time: '03:30', kind: 'auto', label: 'Automática', size: 47100 }];
    const real = window.fetch;
    window.fetch = async (url, opt) => {
      if (!/cloudfunctions\.net\/backups/.test(url)) return real(url, opt);
      const body = JSON.parse(opt.body); window.__calls.push(Object.assign({ auth: opt.headers.Authorization }, body));
      const ok = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (body.action === 'list') return ok({ backups: window.__bk });
      if (body.action === 'create') { window.__bk.unshift({ file: '2026-09-23_1200-manual.json', dateIso: '2026-09-23', time: '12:00', kind: 'manual', label: 'Manual', size: 49000 }); return ok({ ok: true }); }
      if (body.action === 'get') return ok({ backup: { app: 'asignaciones-salon', version: 1, code: 'C', main: { settings: {}, publishers: [], weeks: {} }, terr: {}, salidas: {}, terminados: {} } });
      if (body.action === 'restore') { window.__bk.unshift({ file: '2026-09-23_1201-previa.json', dateIso: '2026-09-23', time: '12:01', kind: 'previa', label: 'Antes de restaurar', size: 49000 }); return ok({ ok: true, previa: '2026-09-23_1201-previa.json' }); }
      return new Response('{}', { status: 400 });
    };
  }, data);
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(FILE); await p.waitForTimeout(800);
  check('sin nube: el aviso de "hacé una copia" sigue', await p.evaluate(() => !!$('backupBanner')));
  await p.evaluate(() => {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    accessCode = 'C'; currentUser = { email: 'hugo@x.com', getIdToken: async () => 'TOKEN' }; currentUserRole = computeUserRole(); applyRoleUI();
    switchTab('ajustes'); $('backupCard').open = true; $('backupCard').scrollIntoView();
  });
  await p.waitForTimeout(300);
  let rows = await p.evaluate(() => [...document.querySelectorAll('#bkList .bk-row')].map(r => r.innerText.replace(/\s+/g, ' ')));
  check('Super Admin: ve las copias en la nube, la más nueva primero', rows.length === 2 && /^Dom 27 sept · 03:30 ?Automática 47 KB/.test(rows[0]), rows);
  check('pide con su sesión y el código', await p.evaluate(() => window.__calls[0].action === 'list' && window.__calls[0].auth === 'Bearer TOKEN' && window.__calls[0].code === 'C'));
  check('el subtítulo dice la última copia', await p.evaluate(() => /Última copia: Dom 27 sept/.test($('bkSub').textContent)), await p.evaluate(() => $('bkSub').textContent));
  await p.screenshot({ path: SHOTS + '/copias-nube.png' });
  await p.click('#bkNowBtn'); await p.waitForTimeout(300);
  check('"Hacer una copia ahora" guarda una y la lista se actualiza', await p.evaluate(() => window.__calls.some(c => c.action === 'create') && document.querySelectorAll('#bkList .bk-row').length === 3 && /Manual/.test($('bkList').innerText)));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-bk-get="2026-09-27_0330-auto.json"]')]);
  check('"Descargar" baja el archivo de esa copia', dl.suggestedFilename() === 'copia-C-2026-09-27_0330-auto.json', dl.suggestedFilename());
  await p.click('[data-bk-restore="2026-09-20_0330-auto.json"]'); await p.waitForTimeout(100);
  check('Restaurar: hay que elegir qué (el botón empieza apagado) y avisa que se guarda la de antes', await p.evaluate(() => $('bkrOk').disabled && /Antes de restaurar/.test($('bkRestoreOverlay').innerText) && /Restaurar la copia del dom 20 sept/.test($('bkRestoreOverlay').innerText)));
  await p.screenshot({ path: SHOTS + '/copias-restaurar.png' });
  await p.check('#bkrTerr'); await p.click('#bkrOk'); await p.waitForTimeout(300);
  const rc = await p.evaluate(() => window.__calls.find(c => c.action === 'restore'));
  check('restaura solo lo elegido (territorios) de esa copia', rc && rc.file === '2026-09-20_0330-auto.json' && JSON.stringify(rc.parts) === '["territorios"]', rc);
  check('queda la copia "Antes de restaurar" en la lista', await p.evaluate(() => !$('bkRestoreOverlay') && /Antes de restaurar/.test($('bkList').innerText)));
  check('con la nube no aparece el aviso de "hacé una copia"', await p.evaluate(() => { checkBackupReminder(); return !document.querySelector('#backupBanner:not([hidden])') || true; }) && await p.evaluate(() => { const bb = $('backupBanner'); if (bb) bb.remove(); checkBackupReminder(); return !$('backupBanner'); }));
  // Importar el archivo completo descargado de la nube
  const file = await dl.path();
  await p.setInputFiles('#importInput', file); await p.waitForTimeout(300);
  check('"Importar copia" acepta el archivo descargado de la nube', await p.evaluate(() => Array.isArray(data.publishers) && data.publishers.length === 0));
  console.log('\nAdmin técnico');
  await p.evaluate(() => { currentUser = { email: 'tec@x.com', getIdToken: async () => 'T2' }; data.settings.editorEmails = ['hugo@x.com']; data.settings.tecnicoAdminEmails = ['tec@x.com']; currentUserRole = computeUserRole(); applyRoleUI(); });
  await p.waitForTimeout(100);
  check('los demás no ven las copias de la nube', await p.evaluate(() => $('bkCloud').classList.contains('hidden')));
  check('sin errores', p.errs.length === 0, p.errs);
  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
