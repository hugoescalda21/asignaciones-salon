// Vista → Calendario: a fin de mes, si la próxima reunión ya es del mes que viene, se abre ese mes
// (antes quedaba escondida hasta tocar ›). Y las flechas pasan de a un mes, sin saltearse ni repetir.
const path = require('path');
const { launch, fixture } = require('./_helper');
const VER = 'file://' + path.resolve(__dirname, '../../ver/ver.html') + '?codigo=C';
const data = fixture();
data.weeks['2026-09-28'] = JSON.parse(JSON.stringify(data.weeks['2026-09-21']));   // jue 1 y dom 4 de octubre
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 300)); } };
(async () => {
  const b = await launch();
  async function open(when) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.clock.setSystemTime(new Date(when));
    await ctx.route(/googleapis|firebasejs/, r => r.abort());
    await ctx.addInitScript(() => localStorage.setItem('welcome-seen-C', '1'));
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => { if (!/firebase is not defined/.test(e.message)) p.errs.push(e.message); });
    await p.goto(VER); await p.waitForTimeout(400);
    await p.evaluate((main) => {
      data = main; currentUser = { uid: 'u', email: 'x@x.com' };
      hideInitialLoading(); $('gateView').classList.add('hidden'); $('authGateView').classList.add('hidden'); $('mainView').classList.remove('hidden');
      showTab('calendario'); renderMonth();
    }, data);
    await p.waitForTimeout(100);
    return p;
  }
  const view = (p) => p.evaluate(() => ({ label: $('monthLabel').textContent, rows: [...document.querySelectorAll('#agendaCard .cal-m')].map(r => r.innerText.replace(/\s+/g, ' ').slice(0, 40)), open: [...document.querySelectorAll('#agendaCard .cal-m.open')].length, past: (($('pastWeekToggle') || {}).innerText || '') }));

  console.log('\nLunes 28 de septiembre (la próxima reunión es el jueves 1 de octubre)');
  let p = await open('2026-09-28T12:00:00-03:00');
  let v = await view(p);
  check('abre octubre, con el jueves 1 abierto', /octubre de 2026/.test(v.label) && v.rows.length === 2 && /1/.test(v.rows[0]) && v.open === 1, v);
  await p.click('#prevBtn'); v = await view(p);
  check('‹ va a septiembre (las reuniones pasadas)', /septiembre de 2026/.test(v.label) && /reuniones ya pasadas/.test(v.past), v);
  const labels = [];
  for (let i = 0; i < 14; i++) { await p.click('#nextBtn'); labels.push((await view(p)).label); }
  check('› pasa de a un mes sin repetir ni saltear', labels.slice(0, 4).join('|') === 'octubre de 2026|noviembre de 2026|diciembre de 2026|enero de 2027' && new Set(labels).size === 14, labels);
  check('sin errores', p.errs.length === 0, p.errs);

  console.log('\nMiércoles 23 de septiembre (la próxima es el jueves 24)');
  p = await open('2026-09-23T12:00:00-03:00');
  v = await view(p);
  check('abre septiembre como siempre', /septiembre de 2026/.test(v.label) && v.open === 1, v);
  console.log('\nLunes 28 a las 22:30 (en UTC ya es martes)');
  p = await open('2026-09-28T22:30:00-03:00');
  check('usa la fecha de Argentina', /octubre de 2026/.test((await view(p)).label));
  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
