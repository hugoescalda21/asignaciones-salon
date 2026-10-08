// Limpieza del Salón con dos congregaciones: cada una limpia después de sus propias reuniones (con un grupo por
// semana) y la limpieza semanal se turna semana por semana. Editor (Ajustes, mes, elegir, turno, enlace, PDF),
// enlace para la otra congregación (sin cuenta), comité de la otra congregación (elige sus grupos) y la vista
// de un hermano de acá (la semana que le toca a la otra congregación).
const path = require('path');
const fs = require('fs');
const { launch, FILE, SHOTS, fixture } = require('./_helper');
const { installMock } = require('./_mock-firestore');
const L = require('../../push-salon-2026/functions/lib.js');
const VER = 'file://' + path.resolve(__dirname, '../../ver/ver.html');
const data = fixture();
data.publishers[1].email = 'martin@x.com';
Object.assign(data.settings, { editorEmails: ['hugo@x.com'], viewerEmails: ['martin@x.com'], congregationName: 'San Agustín', weekdaySemana: 4, weekdayFinde: 0 });
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 500)); } };
const GR = { lista: { g1: { id: 'g1', nombre: 'Grupo 1', encargado: 'p0', miembros: ['p0', 'p1'] }, g2: { id: 'g2', nombre: 'Grupo 2', encargado: 'p3', miembros: ['p3'] }, g3: { id: 'g3', nombre: 'Grupo 3', encargado: 'p5', miembros: ['p5'] } } };
const TIPOS = [{ id: 'reu', nombre: 'Después de las reuniones', modo: 'reunion', tareas: ['Barrer y trapear', 'Baños'] }, { id: 'sem', nombre: 'Limpieza semanal', modo: 'semana', dia: 6, hora: '09:00', tareas: ['Vidrios', 'Cocina'], mismoGrupo: true }];

(async () => {
  const b = await launch();
  const click = async (p, sel) => { await p.click(sel); await p.waitForTimeout(150); };
  const jd = process.env.JSPDF_DIR;
  const rutasPdf = async (ctx) => { if (!jd) return; await ctx.route(/jspdf\.umd\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(jd, 'jspdf.umd.min.js')) })); await ctx.route(/jspdf\.plugin\.autotable\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(jd, 'jspdf.plugin.autotable.min.js')) })); };

  /* ======================= Editor ======================= */
  console.log('\nEditor: congregaciones del Salón');
  const store = { docs: { 'congregations/C': JSON.parse(JSON.stringify(data)), 'congregations/C/terr/grupos': GR, 'congregations/C/salon/trabajos': { lista: {} },
    'congregations/C/salon/limpieza': { rotacion: ['g1', 'g2', 'g3'], tipos: TIPOS, semanas: {}, otraNombre: 'Norte' },
    'congregations/C/salon/externos': { lista: { e5: { id: 'e5', nombre: 'Pedro Sosa', cong: 'Norte', email: 'pedro@gmail.com', vol: true, comite: true } } } }, writes: [], uploads: [] };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await rutasPdf(ctx);
  await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); localStorage.setItem('kh-welcome-salon', '1'); window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; window.confirm = () => true; window.__clip = ''; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (x) => { window.__clip = x; } } }); }, data);
  let p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(FILE); await p.waitForTimeout(700);
  await p.evaluate(async ({ store, mock }) => { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden')); window.__store = store; eval('(' + mock + ')')(store, 'hugo@x.com'); await startSync('C'); }, { store, mock: installMock.toString() });
  await p.waitForTimeout(400);
  await p.evaluate(() => { switchTab('salon'); window.__salon.view = 'limp'; window.__salon.lAjustes = true; salonRender(); });
  await p.waitForTimeout(150);
  const root = () => p.evaluate(() => $('salonRoot').innerText.replace(/\s+/g, ' '));
  let t = await root();
  check('Ajustes: "Congregaciones que usan el Salón" con la de acá (grupos de Territorios)', /Congregaciones que usan el Salón/i.test(t) && /San Agustín · esta congregación/.test(t) && /Grupo 1\s*Grupo 2\s*Grupo 3/.test(t), t.slice(0, 500));
  await click(p, '#salonRoot .sl-sec [data-s="lz-cong"]');
  check('agregar: el nombre ya viene con la otra congregación', await p.evaluate(() => $('lzCn').value === 'Norte'));
  for (const [n, e, tel] of [['Grupo A', 'Esteban Ríos', '343 555-1111'], ['Grupo B', 'Walter Godoy', '343 555-2222'], ['Grupo C', 'Pedro Sosa', '']]) {
    await click(p, '#lzCadd');
    await p.evaluate(({ n, e, tel }) => { const f = [...document.querySelectorAll('.lz-gfila')].pop(); f.querySelector('[data-f="nombre"]').value = n; f.querySelector('[data-f="encargado"]').value = e; f.querySelector('[data-f="tel"]').value = tel; }, { n, e, tel });
  }
  await p.selectOption('#lzCs', '2'); await p.selectOption('#lzCf', '6');
  await click(p, '#lzCok');
  let lz = await p.evaluate(() => window.__salon.limpieza);
  const n1 = (lz.congs || [])[0] || {};
  check('se guarda Norte con sus días de reunión y sus grupos (encargado y teléfono)', lz.congs.length === 1 && n1.nombre === 'Norte' && n1.dias.semana === 2 && n1.dias.finde === 6 && n1.grupos.map(g => g.nombre).join() === 'Grupo A,Grupo B,Grupo C' && n1.grupos[0].tel === '343 555-1111' && !('tel' in n1.grupos[2]), lz.congs);
  t = await root();
  check('en Ajustes: Norte con sus grupos y su comité', /Norte · Editar ›/.test(t) && /Grupo A\s*· Ríos/.test(t) && /Comité: Pedro Sosa/.test(t), t.slice(0, 900));
  check('la semanal dice "solo esta congregación" hasta que se turnen', /cada congregación después de sus reuniones/.test(t) && /solo esta congregación/.test(t));
  await click(p, '#salonRoot [data-s="lz-tipo"][data-i="1"]');
  check('editar la semanal: "Se turnan las congregaciones"', await p.evaluate(() => !!$('lzTu') && getComputedStyle($('lzTurnoBox')).display !== 'none' && getComputedStyle($('lzTuOpts')).display === 'none'));
  await click(p, '#lzTu');
  await p.selectOption('#lzTu1', 'local'); await p.fill('#lzTu2', '2026-09-21');
  await click(p, '#lzOk');
  lz = await p.evaluate(() => window.__salon.limpieza);
  check('se guarda el turno: empieza San Agustín la semana del 21/9', JSON.stringify(lz.tipos[1].turno) === JSON.stringify({ orden: ['local', n1.id], inicio: '2026-09-21' }), lz.tipos[1]);
  check('y en Ajustes dice "se turnan las congregaciones"', /se turnan las congregaciones/.test(await root()));

  console.log('\nEditor: el mes');
  await p.evaluate(() => { window.__salon.lAjustes = false; window.__salon.lMonth = '2026-10'; salonRender(); });
  await p.waitForTimeout(150);
  t = await root();
  check('"Limpieza del Salón" con las dos congregaciones y "la semanal se turnan"', /Limpieza del Salón/.test(t) && /San Agustín Norte · la semanal se turnan/.test(t), t.slice(0, 300));
  const semana = (m) => p.evaluate((m) => document.getElementById('lz-' + m).innerText.replace(/\s+/g, ' '), m);
  t = await semana('2026-10-05');
  check('cada semana: reuniones de acá, reuniones de Norte (mar y sáb) y la semanal de quien le toca', /Reuniones San Agustín Elegir grupo › · jue 8 y dom 11/.test(t) && /Reuniones Norte Elegir grupo › · mar 6 y sáb 10/.test(t) && /Semanal San Agustín Elegir grupo › · sáb 10 · 09:00/.test(t), t);
  check('la semana siguiente la semanal es de Norte', /Semanal Norte .* · sáb 17 · 09:00/.test(await semana('2026-10-12')), await semana('2026-10-12'));
  await click(p, '#salonRoot [data-s="lz-sug"]');
  lz = await p.evaluate(() => window.__salon.limpieza);
  check('"Sugerir" completa los grupos de acá y los de Norte', ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].every(m => lz.semanas[m] && lz.semanas[m].g && lz.semanas[m].c && lz.semanas[m].c[n1.id]), lz.semanas);
  t = await semana('2026-10-12');
  check('después de sugerir: "Grupo X ✨" en cada línea', /Reuniones Norte Grupo [ABC] ✨ · mar 13 y sáb 17/.test(t) && /Semanal Norte Grupo [ABC] ✨ · sáb 17 · 09:00/.test(t), t);
  await p.screenshot({ path: path.join(SHOTS, 'limpieza-salon-mes.png'), fullPage: true });
  // Elegir el grupo de Norte una semana
  await click(p, `#lz-2026-10-12 [data-s="lz-cpick"][data-c="${n1.id}"]`);
  t = await p.evaluate(() => [...document.querySelectorAll('.slmodal')].pop().innerText.replace(/\s+/g, ' '));
  check('elegir: grupos de Norte con su encargado; y la semanal de esa semana', /Norte · semana del 12\/10/.test(t) && /mar 13 y sáb 17/.test(t) && /limpieza semanal \(sáb 17 · 09:00\)/.test(t) && /Encargado: Walter Godoy/.test(t), t);
  check('"Avisar por WhatsApp" al encargado (si tiene teléfono)', await p.evaluate(() => !![...document.querySelectorAll('.slmodal')].pop().querySelector('#lzAvisar')) || /Pedro Sosa/.test(t));
  const gB = n1.grupos[1].id;
  await click(p, `.slmodal:last-child .tpick[data-v="${gB}"]`);
  lz = await p.evaluate(() => window.__salon.limpieza);
  check('se guarda el grupo B esa semana (cargado a mano)', JSON.stringify(lz.semanas['2026-10-12'].c[n1.id]) === JSON.stringify({ g: gB }), lz.semanas['2026-10-12']);
  await click(p, `#lz-2026-10-12 [data-s="lz-cpick"][data-c="${n1.id}"]`);
  await click(p, '.slmodal:last-child #lzAvisar');
  const wa = await p.evaluate(() => decodeURIComponent(window.__opened.slice(-1)[0] || ''));
  check('aviso por WhatsApp a Walter: la semana, las reuniones de Norte, la semanal y las tareas', /wa\.me\/549343 ?5552222|wa\.me\/5493435552222/.test(wa) && /Hola Walter, la semana del 12\/10 le toca la limpieza del Salón al Grupo B de Norte/.test(wa) && /después de las reuniones del mar 13 y sáb 17/.test(wa) && /limpieza semanal del sáb 17 a las 09:00/.test(wa) && /Tareas: Barrer y trapear, Baños, Vidrios, Cocina/.test(wa), wa);
  await p.evaluate(() => document.querySelectorAll('.slmodal').forEach(m => m.remove()));
  // Cambiar el turno una semana
  await click(p, '#lz-2026-10-26 [data-s="lz-tpick"]');
  await click(p, '.slmodal:last-child .tpick[data-v="local"]');
  lz = await p.evaluate(() => window.__salon.limpieza);
  check('cambiar el turno solo esa semana: la semanal la hace San Agustín', lz.semanas['2026-10-26'].t.sem === 'local' && /Semanal San Agustín/.test(await semana('2026-10-26')), lz.semanas['2026-10-26']);
  await click(p, '#lz-2026-10-26 [data-s="lz-tpick"]');
  await click(p, '.slmodal:last-child #lzTnormal');
  check('"Volver al turno normal"', await p.evaluate(() => !(window.__salon.limpieza.semanas['2026-10-26'].t || {}).sem) && /Semanal Norte/.test(await semana('2026-10-26')), await semana('2026-10-26'));
  // Enlace para Norte
  await click(p, '#salonRoot [data-s="lz-enlace"]');
  lz = await p.evaluate(() => window.__salon.limpieza);
  const msg = await p.evaluate(() => document.querySelector('.slmodal:last-child .sl-wamsg').textContent);
  check('enlace para Norte: se crea y el mensaje trae ver.html?codigo=C&lz=…', /^[A-Za-z0-9]{12}$/.test(lz.enlace || '') && msg.includes('ver/ver.html?codigo=C&lz=' + lz.enlace) && /San Agustín y Norte/.test(msg), msg);
  await click(p, '.slmodal:last-child #lzEnW');
  check('se manda por WhatsApp', (await p.evaluate(() => decodeURIComponent(window.__opened.slice(-1)[0] || ''))).includes('&lz=' + lz.enlace));
  // PDF
  if (await p.evaluate(() => !!window.jspdf)) {
    await click(p, '#salonRoot [data-s="lz-pdf"]');
    await click(p, '#pdfMeses [data-k="1"]');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#pdfOk')]);
    const txt = fs.readFileSync(await dl.path()).toString('latin1');
    if (!/turnan/.test(txt)) console.log((txt.match(/\((.*?)\) Tj/g) || []).slice(0, 30));
    check('PDF del mes: las dos congregaciones y la semanal que se turnan', /SAN AGUST.N Y NORTE/.test(txt) && /Norte/.test(txt) && /turnan/.test(txt) && /Grupo B/.test(txt), dl.suggestedFilename());
  } else console.log('  (sin jsPDF: se salta el PDF)');
  check('editor sin errores', !p.errs.length, p.errs);
  const LZ = await p.evaluate(() => JSON.parse(JSON.stringify(window.__salon.limpieza)));
  LZ.semanas['2026-09-21'] = { g: 'g1', c: { [n1.id]: { g: n1.grupos[0].id } } };
  await ctx.close();

  /* ======================= Vista ======================= */
  const HOY = '2026-09-23';
  const ext = { e5: { id: 'e5', nombre: 'Pedro Sosa', cong: 'Norte', email: 'pedro@gmail.com', vol: true, comite: true } };
  function server(Lz) {
    const st = { L: JSON.parse(JSON.stringify(Lz)), calls: [] };
    st.handle = (body, auth) => {
      st.calls.push(Object.assign({ auth: auth || '' }, body));
      const lim = () => L.limpiezaExterna(st.L, GR.lista, data.settings, 'San Agustín', HOY);
      if (body.lz) return body.lz === st.L.enlace ? [200, { modo: 'lz', cong: 'San Agustín', estado: 'ok', limpieza: lim() }] : [200, { modo: 'lz', cong: 'San Agustín', estado: 'nohay' }];
      const e = L.extVoluntario(ext, (auth || '').replace('Bearer tok-', ''));
      if (!e) return [403, {}];
      if (body.action === 'ver') return [200, { modo: 'vol', cong: 'San Agustín', estado: 'ok', yo: { id: 'x:e5', nombre: e.nombre, cong: e.cong, comite: true }, trabajos: {}, anotados: {}, fichas: {}, pubs: [{ id: 'x:e5', name: e.nombre, email: e.email }], occ: [], limpieza: lim(), miCong: L.congDeExt(st.L, e).id }];
      if (body.action === 'limpieza') {
        const v = L.grupoLimpiezaValido(st.L, e, body); if (v.error) return [403, { error: v.error }];
        const w = st.L.semanas[v.m] = st.L.semanas[v.m] || {}; w.c = w.c || {}; if (v.g) w.c[v.cong] = { g: v.g }; else delete w.c[v.cong];
        return [200, { ok: true }];
      }
      return [400, {}];
    };
    return st;
  }
  async function openVer(srv, query) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    await rutasPdf(c);
    await c.route(/googleapis|gstatic|tile\.openstreetmap/, r => r.abort());
    await c.route(/salonExterno/, async (r) => { const [code, j] = srv.handle(r.request().postDataJSON() || {}, r.request().headers().authorization); await r.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(j) }); });
    await c.addInitScript(() => { localStorage.setItem('welcome-seen-C', '1'); window.confirm = () => true; });
    const pg = await c.newPage(); pg.errs = []; pg.on('pageerror', e => { if (!/firebase is not defined/.test(e.message)) pg.errs.push(e.message); });
    await pg.goto(VER + query); await pg.waitForTimeout(800);
    return pg;
  }
  const box = (pg) => pg.evaluate(() => (document.getElementById('salonBox') || {}).innerText.replace(/\s+/g, ' '));

  console.log('\nVista: enlace de la limpieza (sin cuenta)');
  let srv = server(LZ);
  p = await openVer(srv, '?codigo=C&lz=' + LZ.enlace);
  t = await box(p);
  const head = await p.evaluate(() => ({ tag: document.querySelector('.readonly-tag').textContent, cong: $('congTitle').textContent, tabs: getComputedStyle($('bottomTabs')).display }));
  check('entra sin cuenta: "Limpieza del Salón", "San Agustín y Norte", sin pestañas', head.tag === 'Limpieza del Salón' && head.cong === 'San Agustín y Norte' && head.tabs === 'none', head);
  check('el mes con las dos congregaciones, la semanal y las tareas', /Septiembre 2026/.test(t) && /ESTA 21\/9 Reuniones San Agustín Grupo 1 · jue 24 y dom 27 Reuniones Norte Grupo A · mar 22 y sáb 26 Semanal San Agustín Grupo 1 · sáb 26 · 09:00/.test(t) && /Barrer y trapear, Baños/.test(t) && !/teléfono|343/.test(t), t.slice(0, 700));
  await click(p, '#salonBox [data-lz="fil"][data-v="' + n1.id + '"]');
  t = await box(p);
  check('"Solo Norte": esta semana y solo las líneas de Norte', /Esta semana en Norte limpia el Grupo A/.test(t) && !/Reuniones San Agustín/.test(t) && /Reuniones Norte/.test(t), t.slice(0, 500));
  await click(p, '#salonBox [data-lz="mes"][data-d="1"]');
  t = await box(p);
  check('mes siguiente: octubre, con el grupo B de Norte cargado a mano el 12/10', /Octubre 2026/.test(t) && /SEM 12\/10 Reuniones Norte Grupo B · mar 13 y sáb 17 Semanal Norte Grupo B · sáb 17 · 09:00/.test(t), t.slice(0, 900));
  await p.screenshot({ path: path.join(SHOTS, 'limpieza-salon-enlace.png'), fullPage: true });
  if (jd) {
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#salonBox [data-lz="pdf"]')]);
    const txt = fs.readFileSync(await dl.path()).toString('latin1');
    if (!/turnan/.test(txt)) console.log((txt.match(/\((.*?)\) Tj/g) || []).slice(0, 30));
    check('PDF del mes desde el enlace', dl.suggestedFilename() === 'Limpieza del Salon - Octubre 2026.pdf' && /Norte/.test(txt) && /turnan/.test(txt), dl.suggestedFilename());
  }
  check('enlace sin errores', !p.errs.length, p.errs);
  await p.context().close();
  p = await openVer(server(LZ), '?codigo=C&lz=VIEJO');
  check('un enlace viejo: "ya no está activo"', /Este enlace ya no está activo/.test(await box(p)));
  await p.context().close();

  console.log('\nVista: comité de Norte');
  srv = server(Object.assign({}, LZ, { semanas: Object.assign({}, LZ.semanas, { '2026-09-21': { g: 'g1' } }) }));
  p = await openVer(srv, '?codigo=C');
  await p.evaluate(async () => { currentUser = { uid: 'u5', email: 'pedro@gmail.com', getIdToken: async () => 'tok-pedro@gmail.com' }; try { await showAccessDenied(); } catch (e) { /* sin Firebase */ } });
  await p.waitForTimeout(500);
  t = await box(p);
  check('ve la limpieza arriba de los trabajos: esta semana de Norte y "falta elegir"', /Limpieza del Salón/.test(t) && /Esta semana en Norte: falta elegir el grupo/.test(t) && /Falta elegir 1 semana de Norte/.test(t) && /Trabajos de mantenimiento/.test(t), t.slice(0, 600));
  check('solo puede tocar las líneas de Norte (las de San Agustín no)', await p.evaluate(() => { const bs = [...document.querySelectorAll('#salonBox [data-lz="pick"]')]; return bs.length >= 1 && bs.every(x => /Norte/.test(x.textContent)) && !bs.some(x => /Semanal/.test(x.textContent)); }));
  await p.screenshot({ path: path.join(SHOTS, 'limpieza-salon-comite.png'), fullPage: true });
  await click(p, '#salonBox [data-lz="pick"][data-m="2026-09-21"]');
  t = await p.evaluate(() => [...document.querySelectorAll('.sv-sheet')].pop().innerText.replace(/\s+/g, ' '));
  check('elegir: los grupos de Norte con su encargado', /Norte · semana del 21\/9/.test(t) && /Grupo A/.test(t) && /Encargado: Esteban Ríos/.test(t) && !/Grupo 1/.test(t), t);
  const gA = n1.grupos[0].id;
  await click(p, `.sv-sheet [data-g="${gA}"]`); await p.waitForTimeout(400);
  check('se guarda por la función y se ve', srv.calls.some(c => c.action === 'limpieza' && c.m === '2026-09-21' && c.g === gA) && srv.L.semanas['2026-09-21'].c[n1.id].g === gA && !/Falta elegir/.test(await box(p)), srv.calls.filter(c => c.action === 'limpieza'));
  check('comité sin errores', !p.errs.length, p.errs);
  await p.context().close();

  console.log('\nVista: un hermano de San Agustín');
  const verDocs = { 'congregations/C/terr/grupos': GR, 'congregations/C/salon/trabajos': { lista: {} }, 'congregations/C/salon/limpieza': LZ };
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c2.route(/googleapis|gstatic|tile\.openstreetmap/, r => r.abort());
  await c2.addInitScript(() => { localStorage.setItem('welcome-seen-C', '1'); });
  p = await c2.newPage(); p.errs = []; p.on('pageerror', e => { if (!/firebase is not defined/.test(e.message)) p.errs.push(e.message); });
  await p.goto(VER + '?codigo=C'); await p.waitForTimeout(500);
  await p.evaluate(({ store, main }) => {
    const clone = (x) => JSON.parse(JSON.stringify(x));
    const snap = (k) => ({ exists: store[k] !== undefined, id: k.split('/').pop(), data: () => clone(store[k]) });
    const col = (k) => ({ doc: (id) => dc(k + '/' + id), where: () => col(k), onSnapshot: (cb) => { const docs = Object.keys(store).filter(x => x.startsWith(k + '/') && !x.slice(k.length + 1).includes('/')).map(snap); cb({ docs, forEach(f) { docs.forEach(f); } }); return () => {}; } });
    const dc = (k) => ({ collection: (n) => col(k + '/' + n), onSnapshot: (cb) => { cb(snap(k)); return () => {}; } });
    initFirebase = () => ({ collection: (n) => col(n) });
    data = main; currentUser = { uid: 'u1', email: 'martin@x.com' }; currentMonday = mondayOf(new Date().toISOString().slice(0, 10)); verComoInit();
    hideInitialLoading(); $('gateView').classList.add('hidden'); $('authGateView').classList.add('hidden'); $('mainView').classList.remove('hidden');
    renderCurrent(); window.salonVer.onData('C'); showTab('salon');
  }, { store: verDocs, main: data });
  await p.waitForTimeout(400);
  // 21/9: la semanal es de San Agustín (turno desde el 21/9); 28/9: de Norte.
  const g2109 = LZ.semanas['2026-09-21'] && LZ.semanas['2026-09-21'].g;
  t = await box(p);
  check('esta semana: su grupo hace las reuniones y la semanal (le toca a San Agustín)', !g2109 || (g2109 === 'g1' ? /Le toca a tu grupo/.test(t) : /Limpieza/.test(t)), t.slice(0, 400));
  t = await p.evaluate(() => { const wk = [...document.querySelectorAll('#salonBox .sv-wk')].map(x => x.innerText.replace(/\s+/g, ' ')); return wk.join(' | '); });
  check('en "Próximas limpiezas" aparece Norte la semana que le toca la semanal', /Norte/.test(t), t);
  check('vista del hermano sin errores', !p.errs.length, p.errs);
  await c2.close();

  /* ======================= Un grupo por reunión ======================= */
  console.log('\nUn grupo por reunión');
  const st2 = { docs: { 'congregations/C': JSON.parse(JSON.stringify(data)), 'congregations/C/terr/grupos': GR, 'congregations/C/salon/trabajos': { lista: {} },
    'congregations/C/salon/limpieza': { rotacion: ['g1', 'g2', 'g3'], tipos: TIPOS, semanas: {}, otraNombre: 'Norte' } }, writes: [], uploads: [] };
  const ctx3 = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await rutasPdf(ctx3);
  await ctx3.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); localStorage.setItem('kh-welcome-salon', '1'); window.open = () => null; window.confirm = () => true; }, data);
  p = await ctx3.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(FILE); await p.waitForTimeout(700);
  await p.evaluate(async ({ store, mock }) => { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden')); eval('(' + mock + ')')(store, 'hugo@x.com'); await startSync('C'); }, { store: st2, mock: installMock.toString() });
  await p.waitForTimeout(400);
  await p.evaluate(() => { switchTab('salon'); window.__salon.view = 'limp'; window.__salon.lAjustes = true; salonRender(); });
  await p.waitForTimeout(150);
  await click(p, '#salonRoot [data-s="lz-tipo"][data-i="0"]');
  check('en "Después de las reuniones": la opción "Un grupo por reunión"', await p.evaluate(() => !!$('lzPr') && getComputedStyle($('lzPrBox')).display !== 'none'));
  await click(p, '#lzPr'); await click(p, '#lzOk');
  check('se guarda', await p.evaluate(() => window.__salon.limpieza.tipos[0].porReunion === true));
  check('la semanal la hace el grupo del fin de semana', /\(el de la reunión del fin de semana\)/.test(await root()));
  await p.evaluate(() => { window.__salon.lAjustes = false; window.__salon.lMonth = '2026-10'; salonRender(); });
  await p.waitForTimeout(150);
  await click(p, '#salonRoot [data-s="lz-sug"]');
  const sm = await p.evaluate(() => window.__salon.limpieza.semanas);
  check('"Sugerir": un grupo el jueves y otro el domingo, distintos', ['2026-10-05', '2026-10-12', '2026-10-19'].every(m => sm[m].g && sm[m].r && sm[m].g !== sm[m].r.g), sm);
  t = await semana('2026-10-05');
  check('el mes muestra "Reunión jue" y "Reunión dom" con su grupo', /Reunión jue/.test(t) && /Reunión dom/.test(t) && /jue 8/.test(t) && /dom 11/.test(t), t);
  await click(p, '#lz-2026-10-05 [data-s="lz-pick"][data-k="r"]');
  check('elegir el del fin de semana', /Reunión del fin de semana · semana del 5\/10/.test(await p.evaluate(() => [...document.querySelectorAll('.slmodal')].pop().innerText)));
  const gOtro = ['g1', 'g2', 'g3'].find(g => g !== sm['2026-10-05'].g && g !== sm['2026-10-05'].r.g);
  await click(p, `.slmodal:last-child .tpick[data-v="${gOtro}"]`);
  check('se guarda aparte (semanas.r)', await p.evaluate((g) => window.__salon.limpieza.semanas['2026-10-05'].r.g === g, gOtro));
  if (jd) {
    await click(p, '#salonRoot [data-s="lz-pdf"]'); await click(p, '#pdfMeses [data-k="1"]');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#pdfOk')]);
    const txt = fs.readFileSync(await dl.path()).toString('latin1');
    check('PDF: columnas de entre semana y del fin de semana', /entre semana/.test(txt) && /fin de semana/.test(txt), (txt.match(/\((.*?)\) Tj/g) || []).slice(0, 12));
  }
  check('sin errores', !p.errs.length, p.errs);
  await ctx3.close();

  await b.close();
  console.log(`\n${ok} OK, ${bad} fallaron`);
  process.exitCode = bad ? 1 : 0;
})();
