const { launch, FILE, SHOTS, fixture } = require('./_helper');
const data = fixture();
const now = Date.now(), iso = ms => new Date(ms).toISOString();
const d = ms => { const x = new Date(ms); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
data.anuncios = [
  { id: 'a1', title: 'Visita del superintendente', text: 'Esta semana nos visita el superintendente. Más info: jw.org/es', dateIso: iso(now - 2*86400000), pinned: true, eventDate: d(now + 3*86400000), eventTime: '09:00', expiresIso: new Date(d(now + 3*86400000) + 'T23:59:59').toISOString(), notify: true },
  { id: 'a2', title: 'Limpieza del Salón', text: 'Le toca al grupo 3 el sábado.', dateIso: iso(now - 86400000), expiresIso: iso(now + 29*86400000), notify: true },
  { id: 'a3', text: 'Programa de la asamblea en el adjunto.', dateIso: iso(now - 5*86400000), expiresIso: iso(now + 25*86400000), attachmentUrl: 'https://x/a.pdf', attachmentType: 'pdf', attachmentName: 'programa-asamblea.pdf', notify: true },
  { id: 'a4', title: 'Predicación especial', text: 'Salida de grupo el domingo.', dateIso: iso(now - 20*86400000), expiresIso: iso(now - 3*86400000), notify: true },
];
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x)); } };
(async () => {
  const b = await launch();
  for (const [w, label] of [[390, 'Celular'], [1280, 'Computadora']]) {
    console.log('\n' + label);
    const ctx = await b.newContext({ viewport: { width: w, height: 844 } });
    await ctx.route(/gstatic/, r => r.abort());
    await ctx.addInitScript((dd) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(dd)); localStorage.setItem('kh-onboarding-seen', '1'); }, data);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(FILE); await p.waitForTimeout(1200);
    await p.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden')); accessCode = 'TEST'; window.__del = []; window.firebase = { storage: () => ({ refFromURL: (u) => ({ delete: () => { window.__del.push(u); return Promise.resolve(); } }) }) }; });
    await p.evaluate(() => abrirAvisos()); await p.waitForTimeout(300);
    const secs = await p.evaluate(() => [...document.querySelectorAll('#anunciosListContainer .an-sec, #anunciosListContainer .an-fold')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));
    check('lista primero, agrupada: fijados / activos / vencidos', /Fijados · 1/.test(secs[0]) && /Activos · 2/.test(secs[1]) && /Vencidos · 1/.test(secs[2]), secs);
    check('formulario oculto al entrar', await p.evaluate(() => $('anFormView').classList.contains('hidden') && !$('anListView').classList.contains('hidden')));
    check('vencidos plegados', await p.evaluate(() => document.querySelectorAll('.an-card.old').length === 0));
    check('fijado muestra "hasta el evento" y chip del evento', await p.evaluate(() => { const c = document.querySelector('.an-card.pinned'); return /hasta el evento/.test(c.textContent) && /📅 .* · 9:00/.test(c.querySelector('.an-chip.ev').textContent); }));
    check('sin desbordes', await p.evaluate(() => { const m = $('anunciosModalOverlay').querySelector('.modal'); return m.scrollWidth <= m.clientWidth; }));
    if (w < 500) await p.screenshot({ path: SHOTS + '/an-1.png' });
    await p.click('#anOldToggle'); await p.waitForTimeout(150);
    check('se despliegan los vencidos con "Volver a publicar"', await p.evaluate(() => document.querySelectorAll('.an-card.old [data-an-repub]').length === 1));
    await p.click('[data-an-repub="a4"]'); await p.waitForTimeout(200);
    check('"Volver a publicar" lo pasa a activos 30 días', await p.evaluate(() => { const a = data.anuncios.find(x => x.id === 'a4'); return new Date(a.expiresIso) > Date.now() + 29 * 86400000 && !a.editedIso; }));
    // menú
    await p.click('[data-an-menu="a2"]'); await p.waitForTimeout(150);
    check('menú ⋯ con Editar, Fijar, Duplicar y Borrar', await p.evaluate(() => ['edit','pin','dup','del'].every(k => document.querySelector(`#anMenuItems [data-anm="${k}"]`)) && !$('anMenuOverlay').classList.contains('hidden')));
    if (w < 500) await p.screenshot({ path: SHOTS + '/an-2.png' });
    await p.click('#anMenuItems [data-anm="del"]'); await p.waitForTimeout(200);
    check('borrar sin confirmación, con Deshacer', await p.evaluate(() => !data.anuncios.some(x => x.id === 'a2') && [...document.querySelectorAll('#toastContainer .toast')].some(t => /Anuncio borrado/.test(t.textContent) && t.querySelector('.toast-undo'))));
    await p.evaluate(() => [...document.querySelectorAll('#toastContainer .toast')].find(t => /Anuncio borrado/.test(t.textContent)).querySelector('.toast-undo').click()); await p.waitForTimeout(300);
    check('Deshacer lo recupera (sin volver a notificar)', await p.evaluate(() => { const a = data.anuncios.find(x => x.id === 'a2'); return a && a.notify === false; }));
    // borrar con adjunto: se borra el archivo si nadie más lo usa
    await p.click('[data-an-menu="a3"]'); await p.waitForTimeout(100);
    await p.click('#anMenuItems [data-anm="dup"]'); await p.waitForTimeout(200);
    check('Duplicar abre el formulario con la copia y el adjunto', await p.evaluate(() => !$('anFormView').classList.contains('hidden') && $('anuncioTextInput').value === 'Programa de la asamblea en el adjunto.' && !$('anuncioExistingAtt').classList.contains('hidden') && /copia/.test($('anuncioFormLabel').textContent)));
    await p.click('#anPreviewBtn'); await p.waitForTimeout(200);
    await p.click('#anuncioSubmitBtn'); await p.waitForTimeout(400);
    check('la copia se publica como anuncio nuevo con el mismo archivo', await p.evaluate(() => data.anuncios.filter(x => x.attachmentUrl === 'https://x/a.pdf').length === 2));
    await p.click('[data-an-menu="a3"]'); await p.waitForTimeout(100);
    await p.click('#anMenuItems [data-anm="del"]'); await p.waitForTimeout(7600);
    check('al borrar el original, el archivo NO se borra (lo usa la copia)', await p.evaluate(() => window.__del.length === 0 && data.anuncios.some(x => x.attachmentUrl === 'https://x/a.pdf')));
    // nuevo anuncio con evento
    await p.click('#anNewBtn'); await p.waitForTimeout(150);
    check('"Hasta el evento" deshabilitado sin fecha; 30 días por defecto', await p.evaluate(() => document.querySelector('[data-vence="event"]').disabled && document.querySelector('[data-vence="30"]').classList.contains('on')));
    await p.fill('#anuncioTitleInput', 'Asamblea de circuito');
    await p.fill('#anuncioTextInput', 'Nos vemos en el salón de asambleas. Info: https://jw.org/es/');
    const evd = await p.evaluate(() => anLocalDate(new Date(Date.now() + 10 * 86400000)));
    await p.fill('#anEventDate', evd); await p.dispatchEvent('#anEventDate', 'change');
    await p.fill('#anEventTime', '09:30'); await p.dispatchEvent('#anEventTime', 'change');
    check('al cargar el evento, pasa a "Hasta el evento"', await p.evaluate(() => document.querySelector('[data-vence="event"]').classList.contains('on') && /día después del evento/.test($('anVenceHint').textContent)));
    if (w < 500) await p.screenshot({ path: SHOTS + '/an-3.png', fullPage: false });
    await p.click('#anPreviewBtn'); await p.waitForTimeout(200);
    check('vista previa: notificación y tarjeta con evento y link', await p.evaluate(() => !$('anPvNotifWrap').classList.contains('hidden') && $('anPvNotifTitle').textContent === '📢 Asamblea de circuito' && /ann-event/.test($('anPvCard').innerHTML) && /· 9:30/.test($('anPvCard').textContent) && /<a href="https:\/\/jw.org\/es\/"/.test($('anPvCard').innerHTML)));
    if (w < 500) await p.screenshot({ path: SHOTS + '/an-4.png' });
    await p.click('#anBackBtn'); await p.waitForTimeout(100);
    check('"Volver a editar" conserva lo escrito', await p.evaluate(() => $('anuncioTitleInput').value === 'Asamblea de circuito' && !$('anFormView').classList.contains('hidden')));
    await p.click('#anPreviewBtn'); await p.click('#anuncioSubmitBtn'); await p.waitForTimeout(400);
    const nu = await p.evaluate(() => data.anuncios.find(x => x.title === 'Asamblea de circuito'));
    check('se publica con fecha, hora y vence el día del evento', nu && nu.eventDate === evd && nu.eventTime === '09:30' && nu.notify === true && new Date(nu.expiresIso).getDate() === new Date(evd + 'T12:00').getDate(), nu);
    check('vuelve a la lista con aviso "Anuncio publicado"', await p.evaluate(() => !$('anListView').classList.contains('hidden') && [...document.querySelectorAll('#toastContainer .toast')].some(t => /Anuncio publicado/.test(t.textContent))));
    // Otra fecha y validaciones
    await p.click('#anNewBtn'); await p.fill('#anuncioTextInput', 'Prueba');
    await p.click('[data-vence="custom"]'); await p.waitForTimeout(100);
    check('"Otra fecha…" muestra el selector de día', await p.evaluate(() => !$('anVenceDate').classList.contains('hidden') && !!$('anVenceDate').value));
    await p.fill('#anVenceDate', '2020-01-01'); await p.dispatchEvent('#anVenceDate', 'change');
    await p.click('#anPreviewBtn'); await p.waitForTimeout(100);
    check('fecha pasada: no deja seguir y explica', await p.evaluate(() => !$('anFormErr').classList.contains('hidden') && /ya pasó/.test($('anFormErr').textContent) && $('anPreviewView').classList.contains('hidden')));
    await p.click('[data-vence="0"]'); await p.click('#anNotifySwitch'); await p.click('#anPreviewBtn'); await p.waitForTimeout(100);
    check('sin notificar: la vista previa no muestra la notificación', await p.evaluate(() => $('anPvNotifWrap').classList.contains('hidden')));
    await p.click('#anuncioSubmitBtn'); await p.waitForTimeout(300);
    check('"Siempre" = sin vencimiento, notify false', await p.evaluate(() => { const a = data.anuncios.find(x => x.text === 'Prueba'); return a && a.expiresIso === null && a.notify === false; }));
    // Editar
    await p.click('[data-an-menu="a1"]'); await p.click('#anMenuItems [data-anm="edit"]'); await p.waitForTimeout(150);
    check('editar: precarga evento, "Hasta el evento", sin opción de notificar', await p.evaluate(() => $('anEventTime').value === '09:00' && document.querySelector('[data-vence="event"]').classList.contains('on') && $('anuncioNotifyWrap').classList.contains('hidden') && $('anuncioSubmitBtn').textContent === 'Guardar cambios'));
    const before = await p.evaluate(() => data.anuncios.find(x => x.id === 'a1').expiresIso);
    await p.fill('#anuncioTextInput', 'Texto corregido'); await p.click('#anPreviewBtn'); await p.click('#anuncioSubmitBtn'); await p.waitForTimeout(300);
    check('guardar sin tocar el vencimiento lo deja igual', await p.evaluate((bf) => { const a = data.anuncios.find(x => x.id === 'a1'); return a.text === 'Texto corregido' && a.expiresIso === bf && a.editedIso; }, before));
    check('sin errores', errs.length === 0, errs);
    if (w >= 500) await p.screenshot({ path: SHOTS + '/an-d.png' });
    await ctx.close();
  }
  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
