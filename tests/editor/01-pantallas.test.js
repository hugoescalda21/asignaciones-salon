const { launch, FILE, SHOTS, fixture } = require('./_helper');
const data = fixture();
let ok = 0, bad = 0; const check = (l, c, d) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, d === undefined ? '' : JSON.stringify(d)); } };
(async () => {
  const b = await launch();
  async function open(w, h, extra) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.route(/gstatic/, r => r.abort());
    await ctx.addInitScript(([d, extra]) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); localStorage.setItem('kh-onboarding-seen', '1'); if (extra) extra.forEach(([k,v]) => localStorage.setItem(k, v)); }, [data, extra || null]);
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.goto(FILE); await p.waitForTimeout(1200);
    await p.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden')));
    return p;
  }
  const tab = (p, t) => p.evaluate(t => { const x = [...document.querySelectorAll('[data-tab="' + t + '"]')].find(y => y.offsetParent); x && x.click(); }, t);
  const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  console.log('\nCelular (390 px)');
  const m = await open(390, 844);
  check('sin errores de JavaScript al abrir', m.errs.length === 0, m.errs);
  check('Equipo técnico: no se corre de costado', await overflow(m) === 0, await overflow(m));
  check('botones en un solo renglón', await m.evaluate(() => { const r = [...document.querySelectorAll('#technicalSection .action-row > *')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect().top); return new Set(r.map(Math.round)).size === 1; }));
  check('"Copiar" y "No disponibles" ocultos, "Más" visible', await m.evaluate(() => !$('copyPrevBtn').offsetParent && !$('excludeBtn').offsetParent && !!$('moreMenuBtn').offsetParent));
  await m.click('#moreMenuBtn'); await m.waitForTimeout(200);
  await m.screenshot({ path: SHOTS + '/n-mas.png' });
  check('"Más" abre el menú', await m.isVisible('#moreMenu'));
  await m.click('#moreMenu [data-more="excludeBtn"]'); await m.waitForTimeout(300);
  check('"No disponibles hoy" desde el menú abre su ventana', await m.isVisible('#excludeModalOverlay'));
  await m.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(x => x.classList.add('hidden')));
  check('resumen del mes cerrado de entrada', await m.evaluate(() => !$('monthSummaryDetails').open));
  await m.screenshot({ path: SHOTS + '/n-tec.png', fullPage: true });
  await m.click('#subtabPrograma'); await m.waitForTimeout(300);
  check('subpestaña Programa: no se corre de costado', await overflow(m) === 0, await overflow(m));
  await m.screenshot({ path: SHOTS + '/n-prog.png', fullPage: true });
  await m.click('#monthSummaryDetails > summary'); await m.waitForTimeout(300);
  check('resumen del mes se abre', await m.evaluate(() => $('monthSummaryDetails').open));
  check('lista del mes con filas desplegables', await m.evaluate(() => document.querySelectorAll('#monthTableWrap .cal-m').length) >= 2);
  await m.click('#monthTableWrap .cal-m[data-mkey^="2026-09-24"] .cal-h'); await m.waitForTimeout(200);
  check('abrir una reunión muestra técnico y programa', await m.evaluate(() => { const x = document.querySelector('#monthTableWrap .cal-m[data-mkey^="2026-09-24"]'); return x.classList.contains('open') && /Presidente/.test(x.textContent) && /Micrófono 1/.test(x.textContent); }));
  check('resumen del mes: no se corre de costado', await overflow(m) === 0, await overflow(m));
  await m.screenshot({ path: SHOTS + '/n-resumen.png', fullPage: true });

  await tab(m, 'hermanos'); await m.waitForTimeout(300);
  check('Hermanos: no se corre de costado', await overflow(m) === 0, await overflow(m));
  check('Hermanos: "Editar" visible en la primera tarjeta', await m.evaluate(() => { const b = document.querySelector('#brothersTableBody [data-edit-pub]').getBoundingClientRect(); return b.width > 0 && b.right <= innerWidth; }));
  check('Hermanos: "Este mes" visible', await m.evaluate(() => { const b = document.querySelector('#brothersTableBody .br-count').getBoundingClientRect(); return b.width > 0 && b.right <= innerWidth; }));
  check('"+ Agregar hermano" flotando a la vista', await m.evaluate(() => { const b = $('addBrotherBtn').getBoundingClientRect(); return b.bottom <= innerHeight && b.top > 0; }));
  await m.screenshot({ path: SHOTS + '/n-hermanos.png' });
  await m.click('#brothersTableBody tr:nth-child(2) .br-tags'); await m.waitForTimeout(300);
  check('tocar la tarjeta abre la edición', await m.isVisible('#pubModalOverlay'));
  await m.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(x => x.classList.add('hidden')));
  const before = await m.evaluate(() => data.publishers.find(p => p.name === 'Ariel Núñez').status);
  await m.click('#brothersTableBody tr:nth-child(2) [data-toggle-status]'); await m.waitForTimeout(300);
  check('tocar el estado lo cambia (y no abre la edición)', await m.evaluate(b => data.publishers.find(p => p.name === 'Ariel Núñez').status !== b, before) && !(await m.isVisible('#pubModalOverlay')));

  await tab(m, 'timer'); await m.waitForTimeout(300);
  check('Cronómetro: el reloj entra en la primera pantalla', await m.evaluate(() => $('timerStartBtn').getBoundingClientRect().bottom < innerHeight - 70));
  const partsTxt = await m.evaluate(() => [...$('weeklyPartsGrid').children].map(c => (c.querySelector('.mt-l') || c.querySelector('.tc-l')).firstChild.textContent.trim()));
  check('partes de la reunión en orden', JSON.stringify(partsTxt) === JSON.stringify(['Tesoros de la Biblia','Perlas escondidas','Lectura de la Biblia','Empiece conversaciones','Necesidades locales','Estudio bíblico']), partsTxt);
  check('otras partes plegadas', await m.evaluate(() => !$('otherPresets').open));
  await m.click('.mt-part[data-mpart="2"]'); await m.waitForTimeout(200);
  check('tocar una parte la carga en el reloj con el nombre', await m.evaluate(() => $('timerDisplay').textContent === '04:00' && /Lectura de la Biblia\s*Hugo Escalda/.test($('timerNow').textContent)));
  await m.screenshot({ path: SHOTS + '/n-timer.png' });
  await m.click('#timerMainBtn'); await m.waitForTimeout(1300);
  await m.click('#timerMainBtn'); await m.waitForTimeout(400);
  check('"Marcar fin" guarda con el nombre de la parte', await m.evaluate(() => data.timerLog[0].label === 'Lectura de la Biblia'));
  check('queda con ✓ y lista la siguiente', await m.evaluate(() => document.querySelector('.mt-part[data-mpart="2"]').classList.contains('done') && /Empiece conversaciones/.test(document.querySelector('.timer-panel.as-card .tc-l').textContent) && $('timerDisplay').textContent === '03:00'));
  await m.screenshot({ path: SHOTS + '/n-timer2.png', fullPage: true });
  await m.click('#otherPresets > summary'); await m.click('#presetGrid [data-preset="6"]'); await m.waitForTimeout(200);
  check('preset estándar sigue funcionando', await m.evaluate(() => $('timerDisplay').textContent === '30:00' && /Discurso Público/.test($('timerNow').textContent) && !document.querySelector('.timer-panel.as-card')));

  await tab(m, 'ajustes'); await m.waitForTimeout(300);
  const groups = await m.evaluate(() => [...document.querySelectorAll('#panel-ajustes .settings-group')].map(x => x.textContent));
  check('Ajustes agrupados', JSON.stringify(groups) === JSON.stringify(['Congregación','Avisos','Reportes y datos','Este dispositivo','Ayuda']), groups);
  check('todas las tarjetas cerradas', await m.evaluate(() => [...document.querySelectorAll('#panel-ajustes details')].every(d => !d.open)));
  check('Congregación primero y con el horario adentro', await m.evaluate(() => { const d = document.querySelector('#panel-ajustes details'); return /Congregación/.test(d.querySelector('h3').textContent) && !!d.querySelector('#meetingTimeSemanaInput'); }));
  check('nombre nuevo del aviso', await m.evaluate(() => /Aviso de puestos sin cubrir/.test($('panel-ajustes').textContent) && !!document.querySelector('#panel-ajustes #reminderSwitch')));
  check('Ajustes: no se corre de costado', await overflow(m) === 0);
  await m.screenshot({ path: SHOTS + '/n-ajustes.png', fullPage: true });
  check('sin errores de JavaScript en todo el recorrido', m.errs.length === 0, m.errs);

  console.log('\nComputadora (1280 px)');
  const d = await open(1280, 900);
  check('"Copiar semana anterior" y "No disponibles" siguen a la vista', await d.evaluate(() => !!$('copyPrevBtn').offsetParent && !!$('excludeBtn').offsetParent && !$('moreMenuBtn').offsetParent));
  check('resumen del mes abierto de entrada', await d.evaluate(() => $('monthSummaryDetails').open));
  await d.screenshot({ path: SHOTS + '/n-desk.png' });
  await tab(d, 'hermanos'); await d.waitForTimeout(300);
  check('Hermanos: sigue la tabla con encabezados', await d.evaluate(() => getComputedStyle(document.querySelector('.br-table thead')).display !== 'none'));
  await d.click('#brothersTableBody tr:nth-child(2) .br-tags'); await d.waitForTimeout(200);
  check('en computadora tocar la fila no abre la edición', !(await d.isVisible('#pubModalOverlay')));
  await d.screenshot({ path: SHOTS + '/n-desk-herm.png' });
  check('sin errores de JavaScript', d.errs.length === 0, d.errs);

  console.log(`\n${ok} OK, ${bad} fallaron`);
  await b.close();
})();
