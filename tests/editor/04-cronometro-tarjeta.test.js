const { launch, FILE, SHOTS, fixture } = require('./_helper');
const data = fixture();
data.settings.timerCounsel = true;
let ok = 0, bad = 0; const check = (l, c, d) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, d === undefined ? '' : JSON.stringify(d)); } };
(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/gstatic/, r => r.abort());
  await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); localStorage.setItem('kh-onboarding-seen', '1'); window.__vib = []; navigator.vibrate = (x) => { window.__vib.push(x); return true; }; }, data);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(FILE); await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden')));
  await p.evaluate(() => { const x = [...document.querySelectorAll('[data-tab="timer"]')].find(y => y.offsetParent); x.click(); });
  await p.waitForTimeout(400);
  const cardIdx = () => p.evaluate(() => { const g = $('weeklyPartsGrid'); if (!g) return -2; return [...g.children].findIndex(c => c.classList.contains('timer-panel')); });
  const cardTitle = () => p.evaluate(() => { const t = document.querySelector('.timer-panel.as-card .tc-l'); return t ? t.firstChild.textContent.trim() : null; });
  check('la primera parte viene abierta como reloj, dentro de la lista', await cardIdx() === 0 && await cardTitle() === 'Tesoros de la Biblia', [await cardIdx(), await cardTitle()]);
  check('la tarjeta muestra quién la tiene y el tiempo planeado', await p.evaluate(() => /Andrés Torres/.test(document.querySelector('.tc-l').textContent) && /10 min/.test(document.querySelector('.tc-plan').textContent) && $('timerDisplay').textContent === '10:00'));
  check('las demás son filas chicas (7)', await p.evaluate(() => document.querySelectorAll('#weeklyPartsGrid .mt-part').length) === 7);
  check('no hay reloj arriba (la casa del reloj está vacía)', await p.evaluate(() => $('timerPanelHome').children.length === 0));
  await p.screenshot({ path: SHOTS + '/k1.png' });
  // correr Tesoros 10:40 (+0:40)
  await p.click('#timerMainBtn'); await p.evaluate(() => { timerEndAt = Date.now() - 40 * 1000; tickTimer(); });
  check('pasado de tiempo: la tarjeta se pone roja', await p.evaluate(() => document.querySelector('.timer-panel').classList.contains('st-bad')));
  // tocar otra fila mientras corre no cambia
  await p.click('#weeklyPartsGrid .mt-part[data-mpart="3"]'); await p.waitForTimeout(150);
  check('mientras corre, tocar otra fila no la cambia', await cardTitle() === 'Tesoros de la Biblia' && await p.evaluate(() => !!timerInterval));
  await p.click('#timerMainBtn'); await p.waitForTimeout(600);
  check('"Terminó": la tarjeta pasa a la siguiente (Perlas)', await cardIdx() === 1 && await cardTitle() === 'Perlas escondidas', [await cardIdx(), await cardTitle()]);
  check('la anterior queda como fila con ✓ y +0:40', await p.evaluate(() => { const r = document.querySelector('#weeklyPartsGrid .mt-part[data-mpart="0"]'); return r.classList.contains('done') && /\+0:40/.test(r.textContent); }));
  check('ritmo arriba: 0:40 atrasada', await p.evaluate(() => /0:40 atrasada/.test($('timerPace').textContent)));
  check('la siguiente queda lista, sin arrancar', await p.evaluate(() => !timerInterval && /Iniciar/.test($('timerMainBtn').textContent)));
  // Perlas y Lectura rápido
  for (const extra of [0, -5]) { await p.click('#timerMainBtn'); await p.evaluate((e) => { timerEndAt = Date.now() + e * 1000; tickTimer(); }, extra); await p.click('#timerMainBtn'); await p.waitForTimeout(300); }
  check('después de la Lectura viene el consejo, corrido a la derecha', await cardTitle() === 'Consejo' && await p.evaluate(() => document.querySelector('.timer-panel').style.marginLeft === '22px' && /Carlos Vega/.test(document.querySelector('.tc-l').textContent)));
  // scroll: la tarjeta activa quedó a la vista
  await p.waitForTimeout(700);
  check('la pantalla se desplazó para dejar la tarjeta a la vista', await p.evaluate(() => { const r = document.querySelector('.timer-panel.as-card').getBoundingClientRect(); return r.top >= 60 && r.bottom <= innerHeight - 40; }), await p.evaluate(() => { const r = document.querySelector('.timer-panel.as-card').getBoundingClientRect(); return [r.top, r.bottom, innerHeight, scrollY]; }));
  check('el ritmo queda fijo arriba al desplazarse', await p.evaluate(() => { const r = $('timerPace').getBoundingClientRect(); return scrollY > 0 && r.top >= 0 && r.top < 140; }));
  await p.screenshot({ path: SHOTS + '/k2.png' });
  // ajustar tiempo mantiene la parte
  await p.click('#timerAdjustBtn'); await p.fill('#minutesInput', '2'); await p.dispatchEvent('#minutesInput', 'change'); await p.waitForTimeout(150);
  check('"Ajustar tiempo" cambia los minutos sin perder la parte', await cardTitle() === 'Consejo' && await p.evaluate(() => $('timerDisplay').textContent === '02:00'));
  // elegir otra parte a mano (reloj quieto)
  await p.click('#weeklyPartsGrid .mt-part[data-mpart="6"]'); await p.waitForTimeout(300);
  check('tocar una fila con el reloj quieto la abre como reloj', await cardTitle() === 'Necesidades locales');
  check('aviso de minutos faltantes en la tarjeta', await p.evaluate(() => /sin minutos cargados · usa 15/.test(document.querySelector('.timer-panel.as-card').textContent)));
  // tiempo estándar → el reloj vuelve arriba
  await p.click('#otherPresets > summary'); await p.click('#presetGrid [data-preset="6"]'); await p.waitForTimeout(300);
  check('un tiempo estándar pone el reloj arriba, fuera de la lista', await p.evaluate(() => $('timerPanelHome').children.length === 1 && !document.querySelector('.timer-panel').classList.contains('as-card') && $('timerDisplay').textContent === '30:00' && /Discurso Público/.test($('timerNow').textContent)));
  check('y ninguna fila queda como reloj', await cardIdx() === -1);
  // volver a una parte
  await p.click('#weeklyPartsGrid .mt-part[data-mpart="4"]'); await p.waitForTimeout(300);
  check('volver a una parte la abre en la lista', await cardTitle() === 'Empiece conversaciones');
  // actualización de datos (onSnapshot) mientras corre: el reloj sigue
  await p.click('#timerMainBtn'); await p.waitForTimeout(1100);
  const before = await p.evaluate(() => timerEndAt);
  await p.evaluate(() => { initUiFromData(); renderAll(); renderWeeklyPartsGrid(); });
  check('si llegan cambios mientras corre, el reloj sigue igual', await p.evaluate((b) => !!timerInterval && timerEndAt === b && document.querySelector('.timer-panel.as-card .tc-l').firstChild.textContent.trim() === 'Empiece conversaciones', before));
  await p.click('#timerMainBtn'); await p.waitForTimeout(300);
  // pantalla completa sigue andando
  await p.click('#timerFsBtn'); await p.waitForTimeout(150);
  check('pantalla completa sigue funcionando', await p.evaluate(() => !$('timerFs').classList.contains('hidden') && /Consejo/.test($('timerFsPart').textContent)));
  await p.click('#timerFsClose');
  // sin programa: reloj arriba y otras partes abiertas
  await p.evaluate(() => { const nxt = document.getElementById('nextWeekBtn'); nxt.click(); });
  await p.evaluate(() => { const x = [...document.querySelectorAll('[data-tab="timer"]')].find(y => y.offsetParent); x.click(); }); await p.waitForTimeout(300);
  check('semana sin programa: reloj arriba y "Otras partes" abierto', await p.evaluate(() => $('timerPanelHome').children.length === 1 && !$('weeklyPartsGrid') && $('otherPresets').open));
  check('no se corre de costado', await p.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth));
  check('sin errores de JavaScript', errs.length === 0, errs);
  console.log(`\n${ok} OK, ${bad} fallaron`);
  await b.close();
})();
