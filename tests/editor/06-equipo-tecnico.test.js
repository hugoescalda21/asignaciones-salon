const { launch, FILE, SHOTS, fixture } = require('./_helper');
const data = fixture();
// semana anterior (14): mic1 p5 (Ramiro), usher1 p9 (Nicolás)... hace 3 semanas mic: p6
data.weeks['2026-08-31'] = { semana: { roles: { mic1: 'p9', usher1: 'p13' }, excluded: [], program: {} }, finde: { roles: {}, program: {} } };
let ok = 0, bad = 0; const check = (l, c, d) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, d === undefined ? '' : JSON.stringify(d)); } };
(async () => {
  const b = await launch();
  for (const [w, label] of [[390, 'Celular'], [1280, 'Computadora']]) {
  console.log('\n' + label);
  const ctx = await b.newContext({ viewport: { width: w, height: 844 } });
  await ctx.route(/gstatic/, r => r.abort());
  await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); localStorage.setItem('kh-onboarding-seen', '1'); localStorage.setItem('kh-month-summary-open', '0'); }, data);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(FILE); await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden')));
  check('una fila por puesto dentro de una lista', await p.evaluate(() => document.querySelectorAll('.tec-list .role-card').length === 8));
  check('no se corre de costado', await p.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth));
  const h = await p.evaluate(() => { const r = $('roleCardsContainer').getBoundingClientRect(); return Math.round(r.height); });
  check('el equipo entero ocupa menos de una pantalla', h < 700, h);
  check('las filas en conflicto dicen por qué', await p.evaluate(() => { const c = document.querySelector('.role-card[data-rkey="sonido"]'); return c.classList.contains('conflict-card') && /Lectura de la Biblia/.test(c.querySelector('.role-tag-row').textContent); }));
  check('"Si no llega" solo en las filas con conflicto', await p.evaluate(() => [...document.querySelectorAll('.role-card')].every(c => { const bk = c.querySelector('.rc-backup'); if (!bk) return true; return (getComputedStyle(bk).display !== 'none') === c.classList.contains('conflict-card'); })));
  check('aviso de conflictos en una línea, con detalle plegado', await p.evaluate(() => /3 puestos a revisar/.test($('conflictBanner').textContent) && $('conflictBanner').querySelector('.cb-rows').classList.contains('hidden') && $('conflictBanner').getBoundingClientRect().height < 60), await p.evaluate(() => [$('conflictBanner').textContent.slice(0, 60), $('conflictBanner').getBoundingClientRect().height]));
  if (w < 500) await p.screenshot({ path: SHOTS + '/et-a.png' });
  // selector
  await p.evaluate(() => document.querySelector('select[data-role="mic2"]').closest('.pub-combo').querySelector('.pub-combo-input').focus()); await p.waitForTimeout(200);
  const L = await p.evaluate(() => [...document.querySelector('select[data-role="mic2"]').closest('.pub-combo').querySelector('.pub-combo-list').children].map(c => c.classList.contains('pub-combo-group') ? '## ' + c.textContent : c.querySelector('span').textContent + ' | ' + ((c.querySelector('.pub-combo-note') || {}).textContent || '')));
  check('selector agrupado, "Disponibles" primero', L[0] === '## Disponibles', L.slice(0, 3));
  check('nota "micrófonos: nunca / hace N sem."', L.some(x => /^Nicolás Paz \| micrófonos: hace 3 sem\./.test(x)), L);
  check('los que ya tienen algo, con qué', L.includes('## Ya tienen algo en esta reunión') && L.some(x => /^Hugo Escalda \| ya tiene: Audio, Lectura de la Biblia/.test(x)), L.filter(x => /Hugo/.test(x)));
  check('solo los habilitados para micrófonos', !L.some(x => /^Mario Díaz|^Andrés Torres/.test(x)));
  if (w < 500) await p.screenshot({ path: SHOTS + '/et-b.png' });
  await p.keyboard.press('Escape');
  // "Ver" y "Usar sugeridos"
  await p.click('#cbToggleBtn'); await p.waitForTimeout(100);
  check('"Ver" despliega el detalle', await p.evaluate(() => !$('conflictBanner').querySelector('.cb-rows').classList.contains('hidden')));
  await p.click('#cbFixAllBtn'); await p.waitForTimeout(400);
  check('"Usar sugeridos" resuelve los conflictos con reemplazo', await p.evaluate(() => { const r = data.weeks['2026-09-21'].semana.roles; return r.sonido !== 'p0' && r.mic1 !== 'p2'; }));
  await p.evaluate(() => document.querySelector('#toastContainer .toast-undo').click()); await p.waitForTimeout(300);
  check('y se puede deshacer', await p.evaluate(() => { const r = data.weeks['2026-09-21'].semana.roles; return r.sonido === 'p0' && r.mic1 === 'p2'; }));
  // menú ⋯
  await p.click('.role-card[data-rkey="plataforma"] .rr-more'); await p.waitForTimeout(200);
  check('menú ⋯ con reemplazo, elegir otro, ver asignaciones y quitar', await p.evaluate(() => !$('roleMenuOverlay').classList.contains('hidden') && ['use','pick','assign','clear'].every(k => !!document.querySelector(`#roleMenuItems [data-rm="${k}"]`)) && /Ahora: Tomás Bravo/.test($('roleMenuSub').textContent)));
  if (w < 500) await p.screenshot({ path: SHOTS + '/et-c.png' });
  await p.click('#roleMenuItems [data-rm="clear"]'); await p.waitForTimeout(300);
  check('"Quitar asignación" deja el puesto vacío', await p.evaluate(() => !data.weeks['2026-09-21'].semana.roles.plataforma));
  // auto-asignar
  await p.click('#autoAssignBtn'); await p.waitForTimeout(400);
  const r = await p.evaluate(() => data.weeks['2026-09-21'].semana.roles);
  check('auto-asignar completa los vacíos', r.plataforma && r.mic2 && r.usher2, r);
  check('no repite el puesto de la semana anterior', r.mic2 !== 'p5' && r.usher2 !== 'p9' && r.usher2 !== 'p10', r);
  check('resalta lo nuevo y explica por qué', await p.evaluate(() => { const c = document.querySelector('.role-card[data-rkey="mic2"]'); return c.classList.contains('auto-new') && /micrófonos|Nunca hizo micrófonos/.test(c.querySelector('.rr-why').textContent); }));
  check('aviso con cuántos completó y Deshacer', await p.evaluate(() => [...document.querySelectorAll('#toastContainer .toast')].some(t => /se completaron 3 puestos/.test(t.textContent) && t.querySelector('.toast-undo'))));
  if (w < 500) await p.screenshot({ path: SHOTS + '/et-d.png' });
  await p.evaluate(() => [...document.querySelectorAll('#toastContainer .toast')].find(t => /se completaron/.test(t.textContent)).querySelector('.toast-undo').click()); await p.waitForTimeout(300);
  check('Deshacer vuelve a como estaba', await p.evaluate(() => { const r = data.weeks['2026-09-21'].semana.roles; return !r.plataforma && !r.mic2 && !r.usher2 && !document.querySelector('.auto-new'); }));
  // elegir en el selector actualiza los otros
  await p.evaluate(() => { const c = document.querySelector('select[data-role="mic2"]').closest('.pub-combo'); c.querySelector('.pub-combo-input').focus(); });
  await p.waitForTimeout(150);
  await p.evaluate(() => { const c = document.querySelector('select[data-role="mic2"]').closest('.pub-combo'); [...c.querySelectorAll('.pub-combo-item')].find(x => /Pablo Sosa/.test(x.textContent)).dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
  await p.waitForTimeout(300);
  check('elegir guarda', await p.evaluate(() => data.weeks['2026-09-21'].semana.roles.mic2 === 'p8'));
  await p.evaluate(() => document.querySelector('select[data-role="usher2"]').closest('.pub-combo').querySelector('.pub-combo-input').focus()); await p.waitForTimeout(150);
  check('los otros selectores lo muestran como ocupado', await p.evaluate(() => [...document.querySelector('select[data-role="usher2"]').closest('.pub-combo').querySelectorAll('.pub-combo-item')].some(x => /Pablo Sosa/.test(x.textContent) && /ya tiene: Micrófono 2/.test(x.textContent))));
  await p.keyboard.press('Escape');
  check('sin errores de JavaScript', errs.length === 0, errs);
  await ctx.close();
  }
  console.log(`\n${ok} OK, ${bad} fallaron`);
  await b.close();
})();
