const { launch, FILE, SHOTS, fixture } = require('./_helper');
const data = fixture();
// 170 personas: 2 super, 4 admins, 1 solo anuncios, 163 solo ver (12 sin vincular)
const extra = [];
for (let i = 0; i < 163; i++) extra.push({ id: 'v' + i, name: (i === 0 ? 'Marcela Díaz' : i === 1 ? 'Mario Sosa' : i === 2 ? 'Ana Martínez' : 'Hermano ' + String(i).padStart(3, '0')), roles: [] });
data.publishers = data.publishers.concat(extra);
const viewers = extra.map((p, i) => { const e = (i === 0 ? 'marcela.diaz' : 'v' + i) + '@gmail.com'; if (i < 151) p.email = e; return e; });
viewers.push('maria.l.2020@gmail.com'); viewers.pop();
data.publishers.find(p => p.id === 'p1').email = 'mruiz82@gmail.com';
Object.assign(data.settings, { editorEmails: ['super@x.com', 'cvega@gmail.com'], tecnicoAdminEmails: ['mruiz82@gmail.com', 'tbravo@gmail.com'], acomodadoresAdminEmails: ['npaz@gmail.com'], asignacionesAdminEmails: ['lucasg@hotmail.com'], anunciosEmails: ['mruiz82@gmail.com'], anunciosOnlyEmails: ['rquinteros@gmail.com'], viewerEmails: viewers });
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x)); } };
(async () => {
  const b = await launch();
  for (const w of [390, 1280]) {
    console.log('\n' + w);
    const ctx = await b.newContext({ viewport: { width: w, height: 844 } });
    await ctx.route(/gstatic/, r => r.abort());
    await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); localStorage.setItem('kh-onboarding-seen', '1'); }, data);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(FILE); await p.waitForTimeout(900);
    await p.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden')); currentUser = { email: 'super@x.com' }; currentUserRole = 'super'; switchTab('ajustes'); document.querySelectorAll('#panel-ajustes details').forEach(d => d.open = false); const d = [...document.querySelectorAll('#panel-ajustes details')].find(x => /Acceso/.test(x.querySelector('h3').textContent)); d.open = true; renderAccessLists(); d.scrollIntoView(); });
    await p.waitForTimeout(200);
    const info = await p.evaluate(() => ({ count: $('accCount').textContent, chips: [...document.querySelectorAll('#accChips button')].map(b => b.textContent), secs: [...document.querySelectorAll('.acc-sec, .acc-fold')].map(x => x.textContent.replace(/\s+/g, ' ').trim()), rows: document.querySelectorAll('.acc-row').length }));
    console.log(JSON.stringify(info));
    check('170 personas, chips con cantidades', info.count === '170 personas' && info.chips.join('|') === 'Todos|Admins 4|Anuncios 4|Solo ver 163|Sin vincular 18', info.chips);
    check('grupos y Solo ver plegado', /Super Admin · 2/.test(info.secs[0]) && /Admins · 4/.test(info.secs[1]) && /Solo anuncios · 1/.test(info.secs[2]) && /Solo ver · 163/.test(info.secs[3]) && info.rows === 7, info);
    check('agregar oculto, default Solo ver', await p.evaluate(() => $('accAddBlock').classList.contains('hidden') && $('newRoleSelect').value === 'viewerEmails'));
    check('sin desborde', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    if (w < 500) await p.screenshot({ path: SHOTS + '/acc-1.png' });
    await p.fill('#accSearch', 'mar'); await p.waitForTimeout(100);
    const s = await p.evaluate(() => ({ count: $('accCount').textContent, names: [...document.querySelectorAll('.acc-main b')].map(b => b.textContent.trim()), marks: document.querySelectorAll('.acc-main mark').length }));
    console.log(JSON.stringify(s));
    check('buscar "mar" encuentra por nombre (Martín, Marcela, Mario, Ana Martínez)', ['Martín Ruiz', 'Marcela Díaz', 'Mario Sosa', 'Ana Martínez'].every(n => s.names.includes(n)) && s.marks >= 4, s);
    if (w < 500) await p.screenshot({ path: SHOTS + '/acc-2.png' });
    await p.fill('#accSearch', ''); await p.click('[data-acc-filter="unlinked"]'); await p.waitForTimeout(100);
    check('filtro "Sin vincular" muestra 12 con botón Vincular', await p.evaluate(() => document.querySelectorAll('.acc-row').length === 18 && document.querySelectorAll('.acc-row [data-acc-link]').length === 18), await p.evaluate(() => document.querySelectorAll('.acc-row').length));
    // vincular
    await p.evaluate(() => document.querySelector('[data-acc-link]').click()); await p.waitForTimeout(150);
    const em = await p.evaluate(() => accState.menuEmail);
    check('Vincular abre la lista de hermanos sin email', await p.evaluate(() => !$('accMenuOverlay').classList.contains('hidden') && document.querySelectorAll('#accPickList .acc-pick').length > 5));
    await p.fill('#accPickSearch', 'hermano 16'); await p.waitForTimeout(100);
    if (w < 500) await p.screenshot({ path: SHOTS + '/acc-3.png' });
    await p.evaluate(() => document.querySelector('#accPickList [data-acc-pick]').click()); await p.waitForTimeout(150);
    check('vinculado: el hermano tiene ese email y baja "Sin vincular"', await p.evaluate((em) => data.publishers.some(x => x.email === em) && /Sin vincular 17/.test($('accChips').textContent), em));
    await p.click('#accMenuCloseBtn');
    await p.click('[data-acc-filter="all"]');
    // menú de persona: rol y permiso
    await p.evaluate(() => document.querySelector('[data-acc="tbravo@gmail.com"]').click()); await p.waitForTimeout(150);
    check('menú: 6 roles con el actual marcado + permiso', await p.evaluate(() => document.querySelectorAll('#accMenuBody [data-acc-role]').length === 6 && document.querySelector('[data-acc-role="tecnicoAdminEmails"]').classList.contains('on') && !!document.querySelector('#accMenuBody [data-an-perm]')));
    if (w < 500) await p.screenshot({ path: SHOTS + '/acc-4.png' });
    await p.click('#accMenuBody [data-an-perm]'); await p.waitForTimeout(100);
    check('prender permiso desde el menú', await p.evaluate(() => data.settings.anunciosEmails.includes('tbravo@gmail.com') && /Anuncios 5/.test($('accChips').textContent)));
    await p.click('[data-acc-role="viewerEmails"]'); await p.waitForTimeout(100);
    check('cambiar a Solo ver saca el permiso', await p.evaluate(() => data.settings.viewerEmails.includes('tbravo@gmail.com') && !data.settings.anunciosEmails.includes('tbravo@gmail.com')));
    await p.click('[data-accm="remove"]'); await p.waitForTimeout(150);
    check('quitar acceso cierra y avisa con Deshacer', await p.evaluate(() => !data.settings.viewerEmails.includes('tbravo@gmail.com') && $('accMenuOverlay').classList.contains('hidden') && [...document.querySelectorAll('#toastContainer .toast')].some(t => /Se quitó/.test(t.textContent) && t.querySelector('.toast-undo'))));
    await p.evaluate(() => [...document.querySelectorAll('#toastContainer .toast')].find(t => /Se quitó/.test(t.textContent)).querySelector('.toast-undo').click()); await p.waitForTimeout(150);
    check('Deshacer lo devuelve', await p.evaluate(() => data.settings.viewerEmails.includes('tbravo@gmail.com')));
    // el único super no puede sacarse
    await p.evaluate(() => { data.settings.editorEmails = ['super@x.com']; renderAccessLists(); document.querySelector('[data-acc="super@x.com"]').click(); }); await p.waitForTimeout(100);
    await p.click('[data-accm="remove"]'); await p.waitForTimeout(100);
    check('único Super Admin no se puede quitar', await p.evaluate(() => data.settings.editorEmails.includes('super@x.com')));
    await p.click('#accMenuCloseBtn');
    // agregar
    await p.click('#accAddToggle'); await p.fill('#newRoleEmail', 'Nuevo@Gmail.com'); await p.click('#addRoleBtn'); await p.waitForTimeout(100);
    check('agregar (Solo ver por defecto) y se cierra el formulario', await p.evaluate(() => data.settings.viewerEmails.includes('nuevo@gmail.com') && $('accAddBlock').classList.contains('hidden')));
    await p.click('#accViewerFold'); await p.waitForTimeout(100);
    check('desplegar Solo ver', await p.evaluate(() => document.querySelectorAll('.acc-row').length > 150));
    check('sin errores', errs.length === 0, errs);
    await ctx.close();
  }
  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
