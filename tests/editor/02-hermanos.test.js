const { launch, FILE, SHOTS, fixture } = require('./_helper');
const data = fixture();
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
    await p.evaluate(() => { const x = [...document.querySelectorAll('[data-tab="hermanos"]')].find(y => y.offsetParent); x.click(); });
    await p.waitForTimeout(300);
    const rows = () => p.evaluate(() => document.querySelectorAll('#brothersTableBody tr[data-row-pub]').length);
    if (w < 700) {
      check('buscador y PDF en el mismo renglón', await p.evaluate(() => Math.abs($('brSearch').getBoundingClientRect().top - $('brPdfBtn').getBoundingClientRect().top) < 4));
      check('botoncitos de filtro visibles, desplegable oculto', await p.evaluate(() => !!$('brChips').offsetParent && !$('brFilter').offsetParent));
      check('no se corre de costado', await p.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth));
      const all = await rows();
      await p.click('#brChips [data-br-filter="video"]'); await p.waitForTimeout(200);
      const v = await rows();
      check('filtro "Video" deja solo los de video', v > 0 && v < all && await p.evaluate(() => [...document.querySelectorAll('#brothersTableBody tr[data-row-pub]')].every(tr => /Video/.test(tr.querySelector('.br-tags').textContent))), [all, v]);
      check('el botoncito elegido queda marcado', await p.evaluate(() => document.querySelector('#brChips .active').dataset.brFilter === 'video'));
      await p.click('#brChips [data-br-filter="sin-email"]'); await p.waitForTimeout(200);
      check('filtro "Sin email"', await rows() === all - 1, await rows());
      await p.click('#brChips [data-br-filter=""]'); await p.waitForTimeout(200);
      check('"Todos" vuelve a mostrar todos', await rows() === all);
      await p.screenshot({ path: SHOTS + '/h-mobile.png' });
    } else {
      check('en computadora sigue el desplegable y sin botoncitos', await p.evaluate(() => !!$('brFilter').offsetParent && !$('brChips').offsetParent));
      check('en computadora el botón dice "Descargar PDF"', await p.evaluate(() => $('brPdfBtn').innerText.replace(/\s+/g, ' ').trim() === 'Descargar PDF' || console.log(JSON.stringify($('brPdfBtn').innerText))));
      await p.selectOption('#brFilter', 'video'); await p.waitForTimeout(200);
      check('el desplegable sigue filtrando', await rows() < 16);
    }
    check('sin errores de JavaScript', errs.length === 0, errs);
    await ctx.close();
  }
  console.log(`\n${ok} OK, ${bad} fallaron`);
  await b.close();
})();
