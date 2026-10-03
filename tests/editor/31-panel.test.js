// Panel del Super Admin: lo que hay que resolver, el estado de cada área, "Sugerir" con Deshacer,
// mandar el link a quien no recibe avisos, "Ver como un hermano" (Panel y ficha del hermano) y
// quién lo ve. Con Firestore y las funciones (copias y celulares) simuladas.
const path = require('path');
const { launch, FILE, SHOTS, fixture } = require('./_helper');
const { installMock } = require('./_mock-firestore');
const data = fixture();
Object.assign(data.settings, { editorEmails: ['hugo@x.com'], tecnicoAdminEmails: ['tec@x.com'], viewerEmails: ['martin@x.com'] });
data.publishers[1].email = 'martin@x.com'; data.publishers[2].email = 'lucas@x.com'; data.publishers[3].email = 'carlos@x.com';
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 500)); } };

(async () => {
  const b = await launch();
  async function open(email, store, vp) {
    const ctx = await b.newContext({ viewport: vp || { width: 1280, height: 900 } });
    await ctx.addInitScript((d) => {
      localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d));
      window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; window.confirm = () => true;
      const real = window.fetch;
      window.fetch = async (url, opt) => {
        const okr = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
        if (/cloudfunctions\.net\/backups/.test(url)) return okr({ backups: [{ file: 'x.json', dateIso: '2026-09-13', time: '03:30', kind: 'auto', label: 'Automática', size: 1000 }] });
        if (/cloudfunctions\.net\/devices/.test(url)) return okr({ devices: [{ pubId: 'p0', token: 't0' }, { pubId: 'p1', token: 't1' }] });
        return real(url, opt);
      };
    }, data);
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.goto(FILE); await p.waitForTimeout(700);
    await p.evaluate(async ({ store, email, mock }) => {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
      window.__store = store;
      eval('(' + mock + ')')(store, email);
      await startSync('C');
    }, { store, email, mock: installMock.toString() });
    await p.waitForTimeout(500);
    return p;
  }
  const store = { docs: {
    'congregations/C': JSON.parse(JSON.stringify(data)),
    'congregations/C/solicitudes/u1': { email: 'nuevo@x.com', name: 'Ariel Núñez', status: 'pendiente', createdAt: 'a', updatedAt: 'a' },
    'congregations/C/terr/grupos': { lista: { g1: { id: 'g1', nombre: 'Grupo 1', encargado: 'p1', miembros: ['p1', 'p5'] } } },
    'congregations/C/terr/territorios': { lista: { t12: { id: 't12', num: '12', nombre: 'Centro Norte', asignado: { tipo: 'hermano', id: 'p1', desde: '2026-09-01' } }, t3: { id: 't3', num: '3', asignado: { tipo: 'hermano', id: 'p2', desde: '2026-01-10' } }, t4: { id: 't4', num: '4', ultimoTerminado: '2026-08-01' } } },
    'congregations/C/terminados/t12': { tid: 't12', pubId: 'p1', nombre: 'Martín Ruiz', email: 'martin@x.com', fecha: '2026-09-22', at: 'x' },
    'congregations/C/salon/limpieza': { rotacion: ['g1'], semanas: { '2026-09-21': { g: 'g1' } } },
    'congregations/C/salon/trabajos': { lista: { w1: { id: 'w1', titulo: 'Pintura', tipo: 'pintura', fecha: '2026-09-26', resp: 'p2', aux: 'p3', cupo: 3, vista: true } } }
  }, writes: [], uploads: [] };

  console.log('\nSuper Admin en la computadora');
  let p = await open('hugo@x.com', store);
  check('abre en el Panel (primera pestaña)', await p.evaluate(() => !$('panel-panel').classList.contains('hidden') && document.querySelector('.tabs .tab-btn').dataset.tab === 'panel' && document.querySelector('.tabs .tab-btn.active').dataset.tab === 'panel'));
  const urg = await p.evaluate(() => $('pnUrg').innerText.replace(/\s+/g, ' '));
  check('para resolver: la reunión de mañana con lo que falta', /Jue 24 \(mañana\): faltan Micrófono 2, Acomodador 2/.test(urg), urg);
  check('para resolver: solicitud, "Lo terminé", copia vieja', /1 solicitud de acceso esperando Ariel Núñez/.test(urg) && /1 aviso de "Lo terminé" para confirmar Territorio 12 · Centro Norte · Martín Ruiz/.test(urg) && /Hace 10 días de la última copia/.test(urg), urg);
  check('para resolver: limpieza sin cargar desde la semana siguiente', /Limpieza sin cargar desde la semana del 28\/9/.test(urg), urg);
  const txt = await p.evaluate(() => $('panelRoot').innerText.replace(/\s+/g, ' '));
  check('tarjetas: reuniones, hermanos, territorios, mantenimiento', /Sem\. 21\/9 \d+ faltan/.test(txt) && /Email vinculado 4 de 16/.test(txt) && /Reciben notificaciones 2/.test(txt) && /1 Disponibles 1 Asignados 1 Vencidos/.test(txt) && /Limpia esta semana Grupo 1/.test(txt) && /Buscan voluntarios 1 · faltan 3/.test(txt), txt);
  check('con email pero sin avisos: Lucas y Carlos, con "Mandar link"', await p.evaluate(() => { const t = $('pnSinAvisos').innerText; return /Lucas Gómez/.test(t) && /Carlos Vega/.test(t) && !/Martín Ruiz/.test(t); }));
  await p.click('#pnSinAvisos [data-pn="wa"][data-id="p2"]');
  check('"Mandar link" abre WhatsApp con el link de la vista y su email', await p.evaluate(() => { const u = decodeURIComponent(window.__opened.pop() || ''); return /wa\.me/.test(u) && /Hola Lucas/.test(u) && /ver\/ver\.html\?codigo=C/.test(u) && /lucas@x\.com/.test(u); }));
  await p.screenshot({ path: path.join(SHOTS, 'panel-pc.png'), fullPage: true });
  // Sugerir
  await p.click('#pnUrg [data-pn="sugerir"][data-t="semana"]'); await p.waitForTimeout(200);
  check('"Sugerir" completa lo que faltaba de esa reunión', await p.evaluate(() => { const r = data.weeks['2026-09-21'].semana.roles; return !!r.mic2 && !!r.usher2; }) && !/Jue 24 \(mañana\)/.test(await p.evaluate(() => $('pnUrg').innerText)));
  await p.evaluate(() => document.querySelector('.toast .toast-undo').click()); await p.waitForTimeout(200);
  check('Deshacer lo vuelve atrás', await p.evaluate(() => { const r = data.weeks['2026-09-21'].semana.roles; return !r.mic2 && !r.usher2; }));
  // Ir a resolver
  await p.click('#pnUrg [data-pn="asignar"][data-t="semana"]'); await p.waitForTimeout(150);
  check('"Asignar" lleva al Programa en esa semana', await p.evaluate(() => !$('panel-programa').classList.contains('hidden') && currentMonday === '2026-09-21' && currentType === 'semana'));
  await p.click('.tabs .tab-btn[data-tab="panel"]'); await p.waitForTimeout(100);
  await p.click('#pnUrg [data-pn="limpieza"]'); await p.waitForTimeout(150);
  check('"Cargar" lleva a Mantenimiento → Limpieza', await p.evaluate(() => !$('panel-salon').classList.contains('hidden') && window.__salon.view === 'limp'));
  await p.click('.tabs .tab-btn[data-tab="panel"]'); await p.waitForTimeout(100);
  // Ver como un hermano
  await p.click('#panelRoot .pn-head [data-pn="vercomo"]'); await p.waitForTimeout(100);
  await p.fill('.pn-pick #pnQ', 'martin'); await p.waitForTimeout(60);
  check('elegir hermano: buscador sin acentos, con su grupo', await p.evaluate(() => { const t = document.querySelector('.pn-pick .tlist').innerText; return /Martín Ruiz/.test(t) && /Grupo 1/.test(t); }));
  await p.click('.pn-pick .tpick[data-id="p1"]');
  check('abre la vista como Martín', await p.evaluate(() => /ver\/ver\.html\?codigo=C&como=p1$/.test(window.__opened.pop() || '')));
  // Desde la ficha del hermano
  await p.evaluate(() => { switchTab('hermanos'); openPubModal('p3'); }); await p.waitForTimeout(100);
  check('ficha del hermano: "Ver como él"', await p.evaluate(() => !$('pubVerComoBtn').classList.contains('hidden')));
  await p.click('#pubVerComoBtn');
  check('abre la vista como Carlos', await p.evaluate(() => /como=p3$/.test(window.__opened.pop() || '')));
  check('sin errores', !p.errs.length, p.errs);
  await p.context().close();

  console.log('\nTodo al día');
  const full = JSON.parse(JSON.stringify(data));
  full.weeks = {};
  ['2026-09-21', '2026-09-28'].forEach(m => { full.weeks[m] = { semana: { roles: {}, program: {} }, finde: { roles: {}, program: {} } }; });
  const keys = ['sonido', 'video', 'mic1', 'mic2', 'plataforma', 'usher1', 'usher2', 'cronometrista'];
  Object.values(full.weeks).forEach(w => ['semana', 'finde'].forEach(t => keys.forEach((k, i) => { w[t].roles[k] = 'p' + (i + 4); })));
  const store2 = { docs: { 'congregations/C': full }, writes: [], uploads: [] };
  p = await open('hugo@x.com', store2, { width: 390, height: 844 });
  await p.evaluate(() => { window.__panel.bk = { dateIso: '2026-09-20' }; window.__panel.errN = 0; panelRender(); });
  check('"✓ Todo al día"', await p.evaluate(() => /Todo al día/.test($('pnUrg').innerText)), await p.evaluate(() => $('pnUrg').innerText));
  check('celular: el Panel se abre con el ícono de arriba (no hay botón abajo)', await p.evaluate(() => getComputedStyle($('panelBtn')).display !== 'none' && !document.querySelector('.bottom-tabs .tab-btn[data-tab="panel"]')));
  check('celular: nada se corre de costado', await p.evaluate(() => document.documentElement.scrollWidth <= 390));
  await p.screenshot({ path: path.join(SHOTS, 'panel-celular.png'), fullPage: true });
  check('sin errores', !p.errs.length, p.errs);
  await p.context().close();

  console.log('\nAdmin técnico');
  p = await open('tec@x.com', store);
  check('no ve el Panel y sigue entrando a su parte', await p.evaluate(() => [...document.querySelectorAll('.tab-btn[data-tab="panel"]')].every(b => b.classList.contains('hidden')) && $('panel-panel').classList.contains('hidden') && getComputedStyle($('panelBtn')).display === 'none'));
  await p.context().close();

  await b.close();
  console.log(`\n${ok} OK, ${bad} fallaron`);
  process.exitCode = bad ? 1 : 0;
})();
