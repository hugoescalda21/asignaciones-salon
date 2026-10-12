// Semana especial: visita del superintendente de circuito (la reunión de entre semana pasa al martes y cambia el
// programa), asamblea (no hay reunión del fin de semana) y quitarla. Tira, título, calendario, programa,
// cronómetro (partes), lista del mes y la cuenta compartida de salon-core.js (limpieza de esa semana).
const { launch, FILE, SHOTS, fixture } = require('./_helper');
const C = require('../../salon-core.js');
const data = fixture();
Object.assign(data.settings, { congregationName: 'San Agustín', weekdaySemana: 4, weekdayFinde: 0, meetingTimeSemana: '19:30', meetingTimeFinde: '10:00' });
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 500)); } };
const M = '2026-09-21';

(async () => {
  /* ---------- Cuenta compartida (salon-core.js) ---------- */
  console.log('\nsalon-core: reunionDe y la limpieza');
  const st = { weekdaySemana: 4, weekdayFinde: 0, meetingTimeSemana: '19:30', meetingTimeFinde: '10:00' };
  const wv = { [M]: { especial: { tipo: 'visita', semana: { dia: 2 }, so: 'Rubén Acosta' } } };
  let r = C.reunionDe(wv, M, 'semana', st);
  check('visita: entre semana el martes 22 a las 19:30, movida (antes jueves 24)', r.fecha === '2026-09-22' && r.hora === '19:30' && r.movida && r.visita && r.fechaNormal === '2026-09-24', r);
  r = C.reunionDe(wv, M, 'finde', st);
  check('visita: el fin de semana sigue el domingo 27', r.fecha === '2026-09-27' && !r.movida && r.visita, r);
  check('sin semana especial: jueves y domingo de Ajustes', C.reunionDe({}, M, 'semana', st).fecha === '2026-09-24' && !C.reunionDe({}, M, 'semana', st).especial);
  check('limpieza después de las reuniones: martes 22 y domingo 27', JSON.stringify(C.diasLimpieza({ modo: 'reunion' }, M, Object.assign({ weeks: wv }, st))) === '["2026-09-22","2026-09-27"]');
  const wa = { [M]: { especial: { tipo: 'asamblea', sinFinde: true } } };
  check('asamblea: la limpieza solo después de la reunión de entre semana', JSON.stringify(C.diasLimpieza({ modo: 'reunion' }, M, Object.assign({ weeks: wa }, st))) === '["2026-09-24"]');
  check('la limpieza de un día fijo no cambia', JSON.stringify(C.diasLimpieza({ modo: 'semana', dia: 6 }, M, Object.assign({ weeks: wv }, st))) === '["2026-09-26"]');
  const ls = C.limpiezasSemana({ tipos: [{ id: 'reu', nombre: 'Reu', modo: 'reunion' }], semanas: {} }, M, Object.assign({ weeks: wv }, st));
  check('limpiezasSemana sigue a la visita', JSON.stringify(ls[0].dias) === '["2026-09-22","2026-09-27"]', ls);
  check('un tipo que no existe no cuenta', !C.especialDe({ [M]: { especial: { tipo: 'x' } } }, M));

  /* ---------- Editor ---------- */
  console.log('\nEditor: cargar la visita');
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((d) => { if (!sessionStorage.getItem('__ini')) { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); sessionStorage.setItem('__ini', '1'); } }, data);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(FILE); await p.waitForTimeout(700);
  await p.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden')));
  await p.evaluate(() => goToMeeting('2026-09-24', 'semana')); await p.waitForTimeout(150);
  check('sin semana especial: botón "Semana especial"', await p.isVisible('#espAddBtn'));
  check('la tira tiene el jueves 24', await p.evaluate(() => !!document.querySelector('[data-ms-date="2026-09-24"][data-ms-type="semana"]')));
  await p.click('#espAddBtn'); await p.waitForTimeout(150);
  const m0 = await p.evaluate(() => ({ on: document.querySelector('.esp-modal .tpick.on').dataset.espTipo, sd: $('espSemDia').value, fd: $('espFinDia').value, sh: $('espSemHora').value, fdTxt: $('espFinDia').selectedOptions[0].textContent, so: !$('espSoWrap').classList.contains('hidden') }));
  check('la ventana empieza en "Visita": martes, domingo 27 (igual), 19:30, con el superintendente', m0.on === 'visita' && m0.sd === '2' && m0.fd === '0' && m0.sh === '19:30' && /Domingo 27 \(igual\)/.test(m0.fdTxt) && m0.so, m0);
  await p.fill('#espSo', 'Rubén Acosta');
  await p.screenshot({ path: SHOTS + '/35-modal.png' });
  await p.click('#espSave'); await p.waitForTimeout(250);
  const e1 = await p.evaluate((m) => data.weeks[m].especial, M);
  check('se guarda { tipo: visita, semana: { dia: 2 }, so } (lo igual a Ajustes no se guarda)', JSON.stringify(e1) === JSON.stringify({ tipo: 'visita', semana: { dia: 2 }, so: 'Rubén Acosta' }), e1);
  const saved = await p.evaluate((m) => JSON.parse(localStorage.getItem('kh-schedule-data-v2')).weeks[m].especial, M);
  check('queda guardada en el dispositivo', saved && saved.tipo === 'visita', saved);
  const tira = await p.evaluate(() => ({ mar: !!document.querySelector('[data-ms-date="2026-09-22"][data-ms-type="semana"]'), jue: !!document.querySelector('[data-ms-date="2026-09-24"]'), tag: (document.querySelector('[data-ms-date="2026-09-22"] .ms-esp') || {}).textContent, tagF: (document.querySelector('[data-ms-date="2026-09-27"] .ms-esp') || {}).textContent }));
  check('tira: martes 22 con "🧳 VISITA", ya no el jueves 24, y el domingo 27 también marcado', tira.mar && !tira.jue && /VISITA/.test(tira.tag || '') && /VISITA/.test(tira.tagF || ''), tira);
  await p.evaluate(() => goToMeeting('2026-09-22', 'semana')); await p.waitForTimeout(150);
  const hd = await p.evaluate(() => ({ t: $('meetingTitle').textContent, h: $('meetingTime').textContent, ban: $('espBanner').innerText.replace(/\s+/g, ' '), pill: $('pillSemanaDate').textContent }));
  check('título "Martes 22 · Entre semana" a las 19:30', hd.t === 'Martes 22 · Entre semana' && hd.h === '19:30', hd);
  check('aviso: visita, Rubén Acosta, martes 22 a las 19:30 (en vez del jueves 24), con "Cambiar"', /Visita del superintendente de circuito/.test(hd.ban) && /Rubén Acosta/.test(hd.ban) && /martes 22 a las 19:30 \(en vez del jueves 24\)/.test(hd.ban) && /Cambiar/.test(hd.ban), hd.ban);
  check('el botón de la semana dice Martes 22', hd.pill === 'Martes 22', hd.pill);
  await p.screenshot({ path: SHOTS + '/35-tira.png' });

  console.log('\nPrograma de la visita');
  await p.click('#subtabPrograma'); await p.waitForTimeout(250);
  let pr = await p.evaluate(() => ({ serv: ($('espServicio') || {}).innerText || '', est: !!document.querySelector('[data-program-field="estudioConductor"]'), lec: !!document.querySelector('[data-program-field="estudioLector"]') }));
  check('entre semana: "Discurso de servicio del superintendente" en lugar del Estudio bíblico', /Discurso de servicio del superintendente de circuito/.test(pr.serv) && /Rubén Acosta/.test(pr.serv) && !pr.est && !pr.lec, pr);
  await p.screenshot({ path: SHOTS + '/35-programa-semana.png', fullPage: true });
  const parts = await p.evaluate(() => meetingTimedParts().map(x => x.label + '|' + x.who + '|' + x.min));
  check('cronómetro: discurso de servicio, 30 min, Rubén Acosta', parts.includes('Discurso de servicio|Rubén Acosta|30'), parts);
  await p.evaluate(() => goToMeeting('2026-09-27', 'finde')); await p.waitForTimeout(150);
  await p.evaluate(() => renderProgramSection()); await p.waitForTimeout(100);
  pr = await p.evaluate(() => ({ dp: ($('espDiscursoPublico') || {}).innerText || '', conc: ($('espConclusion') || {}).innerText || '', orador: !!document.querySelector('[data-program-field="oradorPublico"]'), at: [...document.querySelectorAll('.program-row')].map(r => r.innerText).find(t => /Atalaya — Conductor/.test(t)) || '' }));
  check('fin de semana: discurso público del superintendente (sin orador), Atalaya 30 min y discurso de conclusión', /Discurso público/.test(pr.dp) && /Rubén Acosta/.test(pr.dp) && !pr.orador && /30 min/.test(pr.at) && /Discurso de conclusión del superintendente/.test(pr.conc), pr);
  const ent = await p.evaluate(() => programEntries(weekView('2026-09-21').finde.program, 'finde', especialDe('2026-09-21')).map(e => e.label + '|' + (e.name || '') + '|' + (e.min || '')));
  check('partes del fin de semana: Discurso público (superintendente), Atalaya 30, Discurso de conclusión 30', ent.includes('Discurso público|Rubén Acosta|30') && ent.includes('Discurso de conclusión|Rubén Acosta|30'), ent);
  const comp = await p.evaluate(() => { const pr = { presidente: 'p0', oracionInicial: 'p1', atalayaConductor: 'p2', atalayaLector: 'p3', oracionFinal: 'p4' }; return [programCompleteness(pr, 'finde', especialDe('2026-09-21')), programCompleteness(pr, 'finde', null)]; });
  check('sin orador el programa del fin de semana de la visita está completo (otra semana, no)', comp[0] === 'complete' && comp[1] === 'partial', comp);
  await p.screenshot({ path: SHOTS + '/35-programa-finde.png', fullPage: true });
  const cal = await p.evaluate(() => { renderMonthCalendar(); return { mar: document.querySelector('#calendarWrap [data-date="2026-09-22"]').className, jue: document.querySelector('#calendarWrap [data-date="2026-09-24"]').className }; });
  check('calendario del mes: reunión el martes 22, no el jueves 24', /has-meeting/.test(cal.mar) && /semana-day/.test(cal.mar) && !/has-meeting/.test(cal.jue), cal);
  const mstat = await p.evaluate(() => meetingsOfMonth('2026-09').filter(x => x.monday === '2026-09-21').map(x => x.date + x.type).join(','));
  check('reuniones del mes esa semana: 22 semana y 27 finde', mstat === '2026-09-22semana,2026-09-27finde', mstat);

  console.log('\nAsamblea y quitar');
  await p.click('#espEditBtn'); await p.waitForTimeout(150);
  check('al cambiar, la ventana muestra lo guardado y "Quitar"', await p.evaluate(() => $('espSemDia').value === '2' && $('espSo').value === 'Rubén Acosta' && !!$('espQuitar')));
  await p.click('[data-esp-tipo="asamblea"]'); await p.waitForTimeout(100);
  const ma = await p.evaluate(() => ({ sd: $('espSemDia').value, fd: $('espFinDia').value, hid: $('espSoWrap').classList.contains('hidden'), dis: $('espFinHora').disabled }));
  check('asamblea: entre semana igual (jueves), fin de semana "No hay reunión", sin superintendente', ma.sd === '4' && ma.fd === 'no' && ma.hid && ma.dis, ma);
  await p.click('#espSave'); await p.waitForTimeout(250);
  const e2 = await p.evaluate((m) => data.weeks[m].especial, M);
  check('se guarda { tipo: asamblea, sinFinde: true }', JSON.stringify(e2) === JSON.stringify({ tipo: 'asamblea', sinFinde: true }), e2);
  const t2 = await p.evaluate(() => ({ dom: !!document.querySelector('[data-ms-date="2026-09-27"]'), jue: !!document.querySelector('[data-ms-date="2026-09-24"]'), ban: $('espBanner').innerText.replace(/\s+/g, ' ') }));
  check('tira: sin el domingo 27, con el jueves 24; aviso "no hay reunión del fin de semana"', !t2.dom && t2.jue && /Asamblea/.test(t2.ban) && /no hay reunión del fin de semana/.test(t2.ban), t2);
  await p.evaluate(() => { currentType = 'finde'; renderProgramSection(); });
  check('programa del fin de semana: "no hay reunión"', /no hay reunión del fin de semana/i.test(await p.evaluate(() => $('programSection').innerText)));
  await p.evaluate(() => goToMeeting('2026-09-24', 'semana')); await p.waitForTimeout(100);
  await p.click('#espEditBtn'); await p.waitForTimeout(150);
  await p.click('#espQuitar'); await p.waitForTimeout(250);
  check('Quitar: vuelve a ser una semana normal', await p.evaluate((m) => !data.weeks[m].especial && !!document.querySelector('[data-ms-date="2026-09-27"]') && !!$('espAddBtn'), M));
  const sv = await p.evaluate((m) => JSON.parse(localStorage.getItem('kh-schedule-data-v2')).weeks[m].especial, M);
  check('y se borra del dispositivo', sv === undefined, sv);

  console.log('\nRoles');
  await p.evaluate(() => { currentUserRole = 'tecnico'; data.weeks['2026-09-21'].especial = { tipo: 'visita', semana: { dia: 2 } }; renderMeetingStrip(); });
  const tec = await p.evaluate(() => ({ add: !!$('espAddBtn'), edit: !!$('espEditBtn'), ban: $('espBanner').innerText }));
  check('el equipo técnico ve el aviso pero no lo cambia', !tec.add && !tec.edit && /Visita/.test(tec.ban), tec);
  check('sin errores en la página', !errs.length, errs);

  /* ---------- Vista de los hermanos ---------- */
  console.log('\nVista: aviso y fechas');
  const path = require('path');
  const VER = 'file://' + path.resolve(__dirname, '../../ver/ver.html') + '?codigo=C';
  const dv = JSON.parse(JSON.stringify(data));
  dv.settings.viewerEmails = ['martin@x.com']; dv.publishers[1].email = 'martin@x.com';
  const me = dv.publishers[1].id;
  dv.weeks[M] = { especial: { tipo: 'visita', semana: { dia: 2 }, so: 'Rubén Acosta' },
    semana: { roles: { sonido: me }, program: { presidente: dv.publishers[2].id, estudioConductor: me } },
    finde: { roles: {}, program: { atalayaConductor: dv.publishers[3].id, oradorPublico: dv.publishers[4].id } } };
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c2.route(/googleapis|tile\.openstreetmap/, r => r.abort());
  await c2.addInitScript(() => { localStorage.setItem('welcome-seen-C', '1'); });
  const v = await c2.newPage(); const verrs = []; v.on('pageerror', e => verrs.push(e.message));
  await v.goto(VER); await v.waitForTimeout(500);
  await v.evaluate((main) => {
    const col = () => ({ doc: () => dc(), where: () => col(), onSnapshot: (cb) => { cb({ docs: [], forEach() {} }); return () => {}; } });
    const dc = () => ({ collection: () => col(), onSnapshot: (cb) => { cb({ exists: false, data: () => undefined }); return () => {}; } });
    initFirebase = () => ({ collection: () => col() });
    data = main; currentUser = { uid: 'u', email: 'martin@x.com' }; currentMonday = mondayOf('2026-09-23'); verComoInit();
    hideInitialLoading(); $('gateView').classList.add('hidden'); $('authGateView').classList.add('hidden'); $('mainView').classList.remove('hidden');
    renderCurrent(); renderUpcoming();
  }, dv);
  await v.waitForTimeout(300);
  const vb = await v.evaluate(() => ({ ban: $('espBannerV').innerText.replace(/\s+/g, ' '), hid: $('espBannerV').classList.contains('hidden') }));
  check('Inicio: "Esta semana nos visita el superintendente de circuito" con el martes 22 a las 19:30', !vb.hid && /Esta semana nos visita el superintendente de circuito/.test(vb.ban) && /martes 22 a las 19:30/.test(vb.ban) && /no el jueves/.test(vb.ban), vb);
  const vd = await v.evaluate((m) => ({ s: dateForType(m, 'semana', data.settings), h: meetingTimeOf('semana', '2026-09-22'), ent: programEntries(data.weeks[m].semana.program, 'semana', especialDe(m)).map(e => e.label + '|' + (e.name || '')), fin: programEntries(data.weeks[m].finde.program, 'finde', especialDe(m)).map(e => e.label + '|' + (e.name || '')) }), M);
  check('vista: la reunión de entre semana es el martes 22, 19:30', vd.s === '2026-09-22' && vd.h === '19:30', vd);
  check('vista: discurso de servicio en lugar del Estudio bíblico', vd.ent.includes('Discurso de servicio del superintendente|Rubén Acosta') && !vd.ent.some(x => /Estudio bíblico/.test(x)), vd.ent);
  check('vista: discurso público y de conclusión del superintendente', vd.fin.includes('Discurso público|Rubén Acosta') && vd.fin.includes('Discurso de conclusión|Rubén Acosta'), vd.fin);
  const up = await v.evaluate(() => $('thisWeek').innerText.replace(/\s+/g, ' '));
  check('próximas reuniones: con "🧳 VISITA"', /VISITA/.test(up), up.slice(0, 300));
  const mine = await v.evaluate((id) => programMatches(data.weeks['2026-09-21'].semana.program, 'semana', new Set([id]), especialDe('2026-09-21')).map(x => x.label), me);
  check('a quien tenía el Estudio bíblico no le figura como asignación', !mine.includes('Estudio bíblico'), mine);
  await v.screenshot({ path: SHOTS + '/35-vista.png' });
  const verrs2 = verrs.filter(x => !/firebase is not defined/.test(x));   // sin Firebase (se bloquea en las pruebas)
  check('vista sin errores', !verrs2.length, verrs2);
  await b.close();
  console.log(`\n${ok} OK, ${bad} fallaron`);
  process.exitCode = bad ? 1 : 0;
})();
