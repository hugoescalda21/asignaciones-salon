const { launch, FILE, SHOTS, fixture } = require('./_helper');
const data = fixture();
data.weeks['2026-09-21'].semana.topic = 'Tema viejo';
let ok = 0, bad = 0; const check = (l, c, d) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, d === undefined ? '' : JSON.stringify(d)); } };
(async () => {
  const b = await launch();
  for (const [w, label] of [[390, 'Celular'], [1280, 'Computadora']]) {
    console.log('\n' + label);
    const ctx = await b.newContext({ viewport: { width: w, height: 844 } });
    await ctx.route(/gstatic/, r => r.abort());
    await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); localStorage.setItem('kh-onboarding-seen', '1'); }, data);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(FILE); await p.waitForTimeout(1200);
    await p.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden')));
    const items = await p.evaluate(() => [...document.querySelectorAll('.ms-item')].map(x => x.dataset.msDate + ' ' + x.dataset.msType + ' ' + x.querySelector('.ms-st').textContent + (x.classList.contains('active') ? ' *' : '') + (x.classList.contains('past') ? ' past' : '') + (x.querySelector('.ms-next') ? ' NEXT' : '')));
    console.log(items.join('\n'));
    check('mes con sus 8-9 reuniones', items.length >= 8 && items.length <= 10, items.length);
    check('abre en la próxima (jueves 24)', await p.evaluate(() => currentMonday === '2026-09-21' && currentType === 'semana' && /Jueves 24 · Entre semana/.test($('meetingTitle').textContent)), await p.evaluate(() => $('meetingTitle').textContent));
    check('etiqueta PRÓXIMA en la activa', items.some(x => /2026-09-24.*\*.*NEXT/.test(x)));
    check('mes "septiembre 2026"', await p.evaluate(() => /septiembre 2026/i.test($('msMonthLabel').textContent)));
    check('subpestañas con conteo', await p.evaluate(() => /faltan \d|✓/.test($('countTecnico').textContent) && /faltan \d|✓/.test($('countPrograma').textContent)), await p.evaluate(() => [$('countTecnico').textContent, $('countPrograma').textContent]));
    check('sin barra de tema', await p.evaluate(() => !document.getElementById('topicInput')));
    check('semana/pills viejos ocultos', await p.evaluate(() => !document.querySelector('.week-bar').offsetParent && !document.querySelector('.type-pills').offsetParent));
    check('no se corre de costado', await p.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth));
    if (w < 500) await p.screenshot({ path: SHOTS + '/ms-a.png' });
    else await p.screenshot({ path: SHOTS + '/ms-d.png' });
    // tocar domingo 27
    await p.click('.ms-item[data-ms-date="2026-09-27"]'); await p.waitForTimeout(300);
    check('tocar el domingo abre fin de semana', await p.evaluate(() => currentType === 'finde' && currentMonday === '2026-09-21' && $('pillFinde').classList.contains('active') && /Domingo 27/.test($('meetingTitle').textContent)));
    // asignar algo y ver que el estado cambia
    const before = await p.evaluate(() => document.querySelector('.ms-item[data-ms-date="2026-09-27"] .ms-st').textContent);
    await p.evaluate(() => { const s = [...document.querySelectorAll('#roleCardsContainer select[data-role]')].find(x => !x.value); const o = [...s.options].find(o => o.value); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await p.waitForTimeout(300);
    const after = await p.evaluate(() => document.querySelector('.ms-item[data-ms-date="2026-09-27"] .ms-st').textContent);
    check('el estado del chip se actualiza al asignar', before !== after, [before, after]);
    // mes siguiente
    await p.click('#msNextMonth'); await p.waitForTimeout(300);
    check('› va al primer día de octubre', await p.evaluate(() => /octubre 2026/i.test($('msMonthLabel').textContent) && dateForType(currentMonday, currentType) === '2026-10-01'), await p.evaluate(() => [$('msMonthLabel').textContent, currentMonday, currentType]));
    await p.click('#msPrevMonth'); await p.waitForTimeout(300);
    check('‹ vuelve a la próxima de septiembre', await p.evaluate(() => dateForType(currentMonday, currentType) === '2026-09-24' && currentType === 'semana'));
    // calendario
    await p.click('#msMonthBtn'); await p.waitForTimeout(300);
    check('📅 abre el calendario con días de reunión', await p.evaluate(() => !$('meetingCalOverlay').classList.contains('hidden') && document.querySelectorAll('#mcalGrid .mc.m').length >= 8));
    if (w < 500) await p.screenshot({ path: SHOTS + '/ms-cal.png' });
    await p.click('#mcalNext'); await p.waitForTimeout(150);
    await p.click('#mcalGrid [data-mc-date="2026-10-11"]'); await p.waitForTimeout(300);
    check('elegir día en el calendario lo abre', await p.evaluate(() => $('meetingCalOverlay').classList.contains('hidden') && currentType === 'finde' && currentMonday === '2026-10-05' && /octubre/i.test($('msMonthLabel').textContent) && document.querySelector('.ms-item.active').dataset.msDate === '2026-10-11'));
    // cronómetro sin tema
    check('etiqueta del cronómetro sin tema', await p.evaluate(() => !/tema/i.test($('timerTopicLabel').textContent)), await p.evaluate(() => $('timerTopicLabel').textContent));
    check('sin errores', errs.length === 0, errs);
    await ctx.close();
  }
  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
