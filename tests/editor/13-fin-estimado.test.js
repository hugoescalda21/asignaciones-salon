const { launch, FILE, SHOTS, fixture } = require('./_helper');
const data = fixture();
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 400)); } };
const T = (hm, day = '24') => new Date(`2026-09-${day}T${hm}:00-03:00`);
(async () => {
  const b = await launch();
  for (const w of [390, 1280]) {
    console.log('\n' + w);
    const ctx = await b.newContext({ viewport: { width: w, height: 844 } });
    await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); localStorage.setItem('kh-onboarding-seen', '1'); }, data);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.clock.setSystemTime(T('19:00'));
    await p.goto(FILE); await p.waitForTimeout(900);
    await p.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden')); switchTab('timer'); });
    await p.waitForTimeout(200);
    const pace = () => p.evaluate(() => ({ cls: $('timerPace').className, txt: $('timerPace').textContent.replace(/\s+/g, ' ').trim(), tip: $('timerPaceTip').classList.contains('hidden') ? '' : $('timerPaceTip').textContent.trim() }));
    let r = await pace(); console.log(r);
    check('antes de empezar: "Empieza 19:30 · termina 21:15"', /Empieza 19:30 · termina 21:15/.test(r.txt) && /even/.test(r.cls), r);
    // 19:37, Tesoros corriendo hace 1 min
    await p.clock.setSystemTime(T('19:37'));
    await p.evaluate(() => { loadMeetingPart(0); partMode = true; timerTotal = 600; timerRemaining = 540; timerEndAt = Date.now() + 540000; renderMeetingPace(); });
    r = await pace(); console.log(r);
    // 9 min + 62 min de partes + 5×20 s + intermedia 3 + conclusión 3 + final 5 = 83:40 → 21:00
    check('en curso: hora de fin = ahora + lo que falta (21:00, 14 min antes)', /Termina ~21:00 · 14 min antes/.test(r.txt) && /early/.test(r.cls), r);
    // 20:47: todas hechas menos el Estudio bíblico, que va 5:50
    await p.clock.setSystemTime(T('20:47'));
    await p.evaluate(() => {
      const d = todayIsoLocal(); data.timerLog = data.timerLog || [];
      meetingParts.slice(0, -1).forEach((pt, i) => data.timerLog.unshift({ id: 'l' + i, date: d, type: 'semana', endedAt: new Date(Date.now() - (60 - i * 10) * 60000).toISOString(), label: pt.label, plannedSeconds: pt.min * 60, actualSeconds: pt.min * 60 + 30 }));
      const last = meetingParts.length - 1;
      loadMeetingPart(last); partMode = true; timerTotal = 1800; timerRemaining = 1450; timerEndAt = Date.now() + 1450000; renderMeetingPace();
    });
    r = await pace(); console.log(r);
    check('atrasada: "Termina ~21:19 · 4 min tarde"', /Termina ~21:19 · 4 min tarde/.test(r.txt) && /late/.test(r.cls), r);
    check('dice cuándo empezó', /empezó ~\d+:\d\d/.test(r.txt), r);
    check('ayuda: el Estudio bíblico debería durar 26 min', /Estudio bíblico.*debería durar.*25:5\d|Estudio bíblico.*debería durar.*26:0\d/.test(r.tip), r.tip);
    if (w < 500) await p.screenshot({ path: SHOTS + '/fin-atrasada.png' });
    // Detalle
    await p.click('#timerPace'); await p.waitForTimeout(150);
    const sheet = await p.evaluate(() => ({ open: !$('paceSheetOverlay').classList.contains('hidden'), rows: [...document.querySelectorAll('#paceSheetCalc > div')].map(d => d.textContent.replace(/\s+/g, ' ').trim()) }));
    console.log(sheet.rows);
    check('detalle: ahora, lo que le queda, conclusión, canción final y total', sheet.open && /Ahora ?20:47/.test(sheet.rows[0]) && sheet.rows.some(x => /le quedan.*24:10/.test(x)) && sheet.rows.some(x => /conclusión.*3:00/.test(x)) && sheet.rows.some(x => /Canción final.*5:00/.test(x)) && /Fin estimado ?21:19/.test(sheet.rows[sheet.rows.length - 1]), sheet.rows);
    check('la canción intermedia ya pasó: no cuenta', !sheet.rows.some(x => /intermedia/.test(x)));
    if (w < 500) await p.screenshot({ path: SHOTS + '/fin-detalle.png' });
    await p.selectOption('#paceDurSel', '110'); await p.waitForTimeout(100);
    r = await pace();
    check('cambiar la duración a 1 h 50: fin previsto 21:20 → a horario', /a horario/.test(r.txt) && /Fin previsto 21:20/.test(r.txt), r);
    check('se guarda en Ajustes', await p.evaluate(() => data.settings.meetingDurSemana === 110));
    await p.selectOption('#paceDurSel', '105'); await p.click('#paceSheetClose');
    // Pantalla completa
    await p.evaluate(() => { openTimerFs(); renderMeetingPace(); });
    check('en pantalla completa: "Fin ~21:19 · +4 min"', await p.evaluate(() => $('timerFsEnd').textContent === 'Fin ~21:19 · +4 min'), await p.evaluate(() => $('timerFsEnd').textContent));
    if (w < 500) await p.screenshot({ path: SHOTS + '/fin-pantalla-completa.png' });
    await p.evaluate(() => closeTimerFs());
    // Después de las 21 h (ya es otro día en UTC): lo tomado sigue marcado
    await p.clock.setSystemTime(T('21:30'));
    check('pasadas las 21 h las partes tomadas siguen contando', await p.evaluate(() => meetingParts.slice(0, -1).every(pt => !!partDoneEntry(pt.label))));
    // Sin hora de reunión cargada: el cálculo viejo, con aviso
    await p.evaluate(() => { data.settings.meetingTimeSemana = ''; renderMeetingPace(); });
    r = await pace();
    check('sin hora cargada: suma de partes + cómo activarlo', /atrasada|adelantada|a tiempo/.test(r.txt) && /cargá la hora/.test(r.txt), r);
    check('sin errores', errs.length === 0, errs);
    await ctx.close();
  }
  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
