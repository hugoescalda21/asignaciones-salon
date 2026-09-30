// Pestaña Salón: calendario de trabajos del Salón (responsable y auxiliar obligatorios, voluntarios,
// repetición, estado) y limpieza por grupos. Con un Firestore simulado en memoria.
const { launch, FILE, SHOTS, fixture } = require('./_helper');
const { installMock } = require('./_mock-firestore');
const path = require('path');
const data = fixture();
Object.assign(data.settings, { editorEmails: ['hugo@x.com'], salonAdminEmails: ['salon@x.com'], viewerEmails: ['ver@x.com'] });
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 500)); } };

(async () => {
  const b = await launch();
  async function open(email, store) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); localStorage.setItem('kh-welcome-salon', '1'); window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; window.confirm = () => true; }, data);
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.goto(FILE); await p.waitForTimeout(700);
    await p.evaluate(async ({ store, email, mock }) => {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
      window.__store = store;
      eval('(' + mock + ')')(store, email);
      await startSync('C');
    }, { store, email, mock: installMock.toString() });
    await p.waitForTimeout(400);
    return p;
  }
  const grupos = { lista: {
    g1: { id: 'g1', nombre: 'Grupo 1', encargado: 'p1', miembros: ['p1', 'p2'] }, g2: { id: 'g2', nombre: 'Grupo 2', encargado: 'p3', miembros: ['p3', 'p0'] },
    g3: { id: 'g3', nombre: 'Grupo 3', encargado: 'p5', miembros: ['p5'] } } };
  const store = { docs: { 'congregations/C': JSON.parse(JSON.stringify(data)), 'congregations/C/terr/grupos': grupos }, writes: [], uploads: [] };
  const click = async (p, sel) => { await p.click(sel); await p.waitForTimeout(150); };
  const modal = (p) => p.locator('.slmodal').last();

  console.log('\nSuper Admin');
  let p = await open('hugo@x.com', store);
  check('ve la pestaña Salón', await p.evaluate(() => !document.querySelector('.bottom-tabs .tab-btn[data-tab="salon"]').classList.contains('hidden')));
  await click(p, '.bottom-tabs .tab-btn[data-tab="salon"]');
  check('Calendario · Trabajos · Limpieza', await p.evaluate(() => [...document.querySelectorAll('#salonRoot .tseg button')].map(x => x.textContent).join(',') === 'Calendario,Trabajos,Limpieza'));
  check('muestra septiembre 2026 y explica cómo empezar', await p.evaluate(() => /septiembre 2026/i.test($('salonRoot').innerText) && /Todavía no hay trabajos programados/.test($('salonRoot').innerText)));

  // Nuevo trabajo: responsable y auxiliar obligatorios
  await click(p, '#salonRoot .sl-sec [data-s="new"]');
  await p.fill('#slTit', 'Pintura de la entrada');
  await p.fill('#slFec', '2026-09-26'); await p.fill('#slHora', '09:00');
  await p.selectOption('#slResp', 'p2');
  await click(p, '#slSave');
  check('sin auxiliar no deja guardar', await p.evaluate(() => /auxiliar/.test($('slErr').textContent) && !Object.keys(window.__salon.trabajos).length));
  await p.selectOption('#slAux', 'p2');
  await click(p, '#slSave');
  check('responsable y auxiliar tienen que ser distintos', await p.evaluate(() => /distintos/.test($('slErr').textContent)));
  await p.selectOption('#slAux', 'p11');
  await p.fill('#slCupo', '3');
  await p.fill('#slMat', 'Rodillos\nLátex blanco');
  await click(p, '#slSave'); await p.waitForTimeout(200);
  const t1 = await p.evaluate(() => Object.values(window.__salon.trabajos)[0]);
  check('trabajo guardado en salon/trabajos', t1 && t1.titulo === 'Pintura de la entrada' && t1.resp === 'p2' && t1.aux === 'p11' && t1.cupo === 3 && t1.materiales.length === 2 && t1.vista === true && !!store.docs, t1);
  check('aparece en Esta semana con responsable y auxiliar', await p.evaluate(() => { const h = document.querySelector('.sl-hero'); return h && /Pintura de la entrada/.test(h.innerText) && /Gómez/.test(h.innerText) && /Díaz/.test(h.innerText) && /faltan 3/.test(h.innerText); }));
  check('punto de color en el día 26', await p.evaluate(() => document.querySelector('.sl-d[data-f="2026-09-26"] .sl-dots i') !== null));

  // Trabajo que se repite
  await click(p, '#salonRoot .sl-sec [data-s="new"]');
  await p.fill('#slTit', 'Corte de pasto');
  await click(p, '#slTipo [data-k="jardin"]');
  await p.fill('#slFec', '2026-09-24');
  await p.selectOption('#slResp', 'p4'); await p.selectOption('#slAux', 'p8');
  await click(p, '#slRep [data-k="15d"]');
  await click(p, '#slSave'); await p.waitForTimeout(200);
  await click(p, '#salonRoot [data-s="mes"][data-d="1"]');
  check('cada 15 días: aparece solo en octubre (8 y 22)', await p.evaluate(() => ['2026-10-08', '2026-10-22'].every(f => document.querySelector(`.sl-d[data-f="${f}"] .sl-dots i`)) && !document.querySelector('.sl-d[data-f="2026-10-15"] .sl-dots i')));
  await click(p, '#salonRoot [data-s="mes"][data-d="-1"]');

  // Detalle
  const tid = t1.id;
  store.docs[`congregations/C/salonAnotados/${tid}__2026-09-26__u1`] = { tid, fecha: '2026-09-26', pubId: 'p6', nombre: 'Diego Fernández', uid: 'u1', comentario: 'Llevo la escalera', at: 'x' };
  await p.evaluate(() => window.__store && 0);
  await click(p, `#salonRoot .sl-ev[data-id="${tid}"]`);
  await p.waitForTimeout(150);
  const det = await modal(p).innerText();
  check('detalle: estado, responsable, auxiliar y voluntarios', /Programado/.test(det) && /Lucas Gómez/.test(det) && /Mario Díaz/.test(det) && /Voluntarios/i.test(det), det.slice(0, 400));
  await p.screenshot({ path: path.join(SHOTS, 'salon-detalle.png') });
  await click(p, '.slmodal [data-d="agregar"]');
  await click(p, '.slmodal:last-of-type .tpick[data-id="p9"]');
  await p.waitForTimeout(200);
  check('agregar hermano a mano', await p.evaluate((tid) => (window.__salon.trabajos[tid].ocurr['2026-09-26'].vols || []).includes('p9'), tid));
  await click(p, '.slmodal [data-d="wa"]');
  check('pedir por WhatsApp con lo que falta y el link de la vista', await p.evaluate(() => { const u = decodeURIComponent(window.__opened.pop() || ''); return /wa\.me/.test(u) && /Pintura de la entrada/.test(u) && /Hacen falta/.test(u) && /ver\/ver\.html\?codigo=C/.test(u); }));
  await click(p, '.slmodal [data-d="estado"][data-k="hecho"]');
  check('marcar como hecho', await p.evaluate((tid) => window.__salon.trabajos[tid].ocurr['2026-09-26'].estado === 'hecho', tid));
  await p.keyboard.press('Escape');

  // Limpieza por grupos
  await click(p, '#salonRoot [data-s="view"][data-k="limp"]');
  check('limpieza sin responsable ni auxiliar', await p.evaluate(() => !/Responsable|Auxiliar/.test($('salonRoot').innerText)));
  await click(p, '#salonRoot [data-s="rot-add"][data-g="g2"]');
  await click(p, '#salonRoot [data-s="rot-add"][data-g="g3"]');
  await click(p, '#salonRoot [data-s="rot-add"][data-g="g1"]');
  await click(p, '#salonRoot [data-s="rot-up"][data-i="2"]');
  check('rotación ordenada', await p.evaluate(() => JSON.stringify(window.__salon.limpieza.rotacion) === '["g2","g1","g3"]'));
  await click(p, '#salonRoot [data-s="otra"][data-n="4"]'); await p.waitForTimeout(100);
  check('semanas de la otra congregación', await p.evaluate(() => JSON.stringify(window.__salon.limpieza.otra) === '[4]'));
  const prev = await p.evaluate(() => [...document.querySelectorAll('.sl-prev div')].map(d => d.innerText.replace(/\s+/g, ' ')));
  check('así quedan: esta semana otra congregación (sem. 4), después Grupo 2', /Otra congregación/.test(prev[0]) && /Grupo 2/.test(prev[1]) && /jue 1 y dom 4/.test(prev[1]), prev);
  await p.screenshot({ path: path.join(SHOTS, 'salon-limpieza.png'), fullPage: true });
  await click(p, '#salonRoot [data-s="view"][data-k="cal"]');
  await p.screenshot({ path: path.join(SHOTS, 'salon-calendario.png'), fullPage: true });
  check('los 7 botones de abajo entran en el celular', await p.evaluate(() => [...document.querySelectorAll('.bottom-tabs .tab-btn:not(.hidden)')].every(b => b.scrollWidth <= b.clientWidth + 1) && document.documentElement.scrollWidth <= 390));
  check('próximos: una vez por trabajo', await p.evaluate(() => [...document.querySelectorAll('#salonRoot .sl-ev')].filter(e => /Corte de pasto/.test(e.innerText)).length === 1));
  check('sin errores', !p.errs.length, p.errs);
  Object.assign(store, await p.evaluate(() => window.__store));
  await p.context().close();

  console.log('\nAdmin — Salón');
  p = await open('salon@x.com', store);
  const tabs = await p.evaluate(() => [...document.querySelectorAll('.bottom-tabs .tab-btn[data-tab]')].filter(b => !b.classList.contains('hidden')).map(b => b.dataset.tab));
  check('solo ve la pestaña Salón', JSON.stringify(tabs) === '["salon"]', tabs);
  check('abre directo en Salón', await p.evaluate(() => !$('panel-salon').classList.contains('hidden') && /Corte de pasto/.test($('salonRoot').innerText)));
  check('sin errores', !p.errs.length, p.errs);
  await p.context().close();

  console.log('\nSolo ver');
  p = await open('ver@x.com', store);
  check('no ve la pestaña Salón', await p.evaluate(() => [...document.querySelectorAll('.tab-btn[data-tab="salon"]')].every(b => b.classList.contains('hidden'))));
  await p.context().close();

  await b.close();
  console.log(`\n${ok} OK, ${bad} fallaron`);
  process.exitCode = bad ? 1 : 0;
})();
