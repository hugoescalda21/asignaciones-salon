// Territorios, grupos, lugares y salidas (tanda A), con un Firestore simulado en memoria.
const { launch, FILE, SHOTS, fixture } = require('./_helper');
const data = fixture();
data.publishers[1].email = 'martin@x.com';   // Martín Ruiz: encargado del Grupo 1
Object.assign(data.settings, { editorEmails: ['hugo@x.com'], territoriosAdminEmails: ['terr@x.com'], viewerEmails: ['martin@x.com', 'ver@x.com'] });
data.publishers[0].email = 'hugo@x.com';
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 500)); } };

// Firestore y Storage falsos, compartidos por varias pestañas mediante window.__store (cada contexto tiene el suyo;
// para simular "otro usuario" se copia el estado de uno a otro).
function installMock(store, email) {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const listeners = [];
  const notify = () => setTimeout(() => listeners.forEach(fn => fn()), 0);
  function getPath(path) { return path.split('/').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), store.docs); }
  function docGet(path) { return store.docs[path]; }
  function setDeep(obj, keys, v) { let o = obj; keys.slice(0, -1).forEach(k => { if (typeof o[k] !== 'object' || o[k] === null || Array.isArray(o[k])) o[k] = {}; o = o[k]; }); if (v && v.__del) delete o[keys[keys.length - 1]]; else o[keys[keys.length - 1]] = clone(v); }
  function merge(a, b) { Object.keys(b).forEach(k => { if (b[k] && b[k].__del) delete a[k]; else if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], b[k]); else a[k] = clone(b[k]); }); }
  function snap(path) { const d = docGet(path); return { exists: d !== undefined, id: path.split('/').pop(), data: () => (d === undefined ? undefined : clone(d)) }; }
  function docRef(path) {
    return {
      id: path.split('/').pop(),
      get: async () => snap(path),
      onSnapshot: (cb) => { const fn = () => cb(snap(path)); listeners.push(fn); fn(); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
      update: async (...args) => {
        if (docGet(path) === undefined) { const e = new Error('not found'); e.code = 'not-found'; throw e; }
        store.writes.push({ path, args: args.map(a => a && a.s ? a.s.join('.') : a) });
        if (args.length === 1 && typeof args[0] === 'object' && !args[0].s) { Object.keys(args[0]).forEach(k => setDeep(store.docs[path], k.split('.'), args[0][k])); }
        else for (let i = 0; i < args.length; i += 2) setDeep(store.docs[path], args[i].s, args[i + 1]);
        notify();
      },
      set: async (obj, opt) => { store.writes.push({ path, set: true }); if (opt && opt.merge && docGet(path)) merge(store.docs[path], obj); else store.docs[path] = clone(obj); notify(); },
      delete: async () => { delete store.docs[path]; notify(); },
      collection: (n) => colRef(path + '/' + n)
    };
  }
  function colRef(path) {
    return {
      doc: (id) => docRef(path + '/' + id),
      add: async () => ({}),
      where: () => colRef(path),
      onSnapshot: (cb) => {
        const fn = () => cb({ docs: Object.keys(store.docs).filter(k => k.startsWith(path + '/') && !k.slice(path.length + 1).includes('/')).map(k => snap(k)), forEach(f) { this.docs.forEach(f); } });
        listeners.push(fn); fn(); return () => {};
      }
    };
  }
  window.firebase = {
    firestore: Object.assign(() => fbDb, { FieldPath: function (...s) { this.s = s; }, FieldValue: { delete: () => ({ __del: true }), arrayUnion: (x) => x } }),
    storage: () => ({ ref: (p) => ({ put: async () => { store.uploads.push(p); }, getDownloadURL: async () => 'https://example.com/' + p, delete: async () => {} }) })
  };
  fbDb = { collection: (n) => colRef(n) };
  currentUser = { email, getIdToken: async () => 't' };
}

(async () => {
  const b = await launch();
  async function open(email, store) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; window.confirm = () => true; }, data);
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
  const store = { docs: { 'congregations/C': JSON.parse(JSON.stringify(data)) }, writes: [], uploads: [] };
  const clickT = async (p, sel) => { await p.click(sel); await p.waitForTimeout(150); };
  const modal = (p) => p.locator('.tmodal').last();

  console.log('\nSuper Admin');
  let p = await open('hugo@x.com', store);
  check('ve la pestaña Territorios', await p.evaluate(() => !document.querySelector('.bottom-tabs .tab-btn[data-tab="territorios"]').classList.contains('hidden')));
  await clickT(p, '.bottom-tabs .tab-btn[data-tab="territorios"]');
  check('Salidas · Territorios · Grupos · Lugares', await p.evaluate(() => [...document.querySelectorAll('#terrRoot .tseg button')].map(x => x.textContent).join(',') === 'Salidas,Territorios,Grupos,Lugares'));
  check('sin salidas: explica qué hacer', await p.evaluate(() => /Todavía no hay salidas/.test($('terrRoot').innerText)));

  // Lugares
  await clickT(p, '#terrRoot [data-t="view"][data-k="lugares"]');
  await clickT(p, '#terrRoot [data-t="l-new"]');
  await p.fill('#lN', 'Casa de la familia Gómez'); await p.fill('#lD', 'Belgrano 450');
  await clickT(p, '#lOk');
  await clickT(p, '#terrRoot [data-t="l-new"]');
  await p.click('#lT [data-k="salon"]'); await clickT(p, '#lOk');
  check('dos lugares cargados', await p.evaluate(() => Object.keys(window.__terr.lugares).length === 2 && /Casa de la familia Gómez/.test($('terrRoot').innerText) && /Salón del Reino/.test($('terrRoot').innerText)));

  // Grupos
  await clickT(p, '#terrRoot [data-t="view"][data-k="grupos"]');
  await clickT(p, '#terrRoot [data-t="g-new"]');
  await p.selectOption('#gE', 'p1'); await p.selectOption('#gA', 'p12');
  await clickT(p, '#gMBtn');
  await p.check('.tmodal:last-child [data-id="p5"]'); await p.check('.tmodal:last-child [data-id="p6"]');
  await clickT(p, '#ppOk');
  await clickT(p, '#gCBtn');
  await p.check('.tmodal:last-child [data-id="p5"]');
  await clickT(p, '#ppOk');
  await clickT(p, '#gOk');
  let g = await p.evaluate(() => Object.values(window.__terr.grupos)[0]);
  check('Grupo 1 con encargado, auxiliar, miembros y conductores', g && g.nombre === 'Grupo 1' && g.encargado === 'p1' && g.auxiliar === 'p12' && ['p1', 'p12', 'p5', 'p6'].every(x => g.miembros.includes(x)) && g.conductores.join() === 'p5', g);
  check('el email del encargado queda como editor del grupo (para las reglas)', g.editores.join() === 'martin@x.com' && JSON.stringify(store.docs) !== '' && await p.evaluate(() => window.__store.docs['congregations/C/terr/grupos'].editoresTodos.join() === 'martin@x.com'));
  check('"Sin grupo" muestra a los que faltan', await p.evaluate(() => /Sin grupo · \d+ hermanos/.test($('terrRoot').innerText)));
  await clickT(p, '#terrRoot [data-t="g-cong"]');
  await p.check('.tmodal:last-child [data-id="p4"]'); await clickT(p, '#ppOk');
  check('conductores de congregación', await p.evaluate(() => (window.__terr.gruposMeta.conductoresCongregacion || []).join() === 'p4'));
  const gid = g.id;

  // Territorios
  await clickT(p, '#terrRoot [data-t="view"][data-k="territorios"]');
  check('sin territorios: explica cómo cargarlos (foto de la tarjeta)', await p.evaluate(() => /foto de la tarjeta/.test($('terrRoot').innerText)));
  await clickT(p, '#terrRoot [data-t="t-new"]');
  await p.fill('#tfNum', '12'); await p.fill('#tfNom', 'Centro Norte'); await p.fill('#tfUlt', '2025-03-01');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEIGBmhDAYGAEIQBP/8Y2O8AAAAAElFTkSuQmCC', 'base64');
  await p.setInputFiles('#tfFoto', { name: 'tarjeta.png', mimeType: 'image/png', buffer: png });
  await p.click('#tfSave'); await p.waitForTimeout(500);
  await clickT(p, '#terrRoot [data-t="t-new"]');
  check('número siguiente sugerido', await p.inputValue('#tfNum') === '13');
  await p.fill('#tfNum', '22'); await p.fill('#tfNom', 'Edificios Av. Mitre'); await p.selectOption('#tfTipo', 'edificios'); await p.fill('#tfUlt', '2026-08-01');
  await p.click('#tfSave'); await p.waitForTimeout(300);
  await clickT(p, '#terrRoot [data-t="t-new"]');
  await p.fill('#tfNum', '12'); await clickT(p, '#tfSave');
  check('no deja repetir el número', await p.evaluate(() => /Ya existe el territorio 12/.test(document.body.innerText)));
  await clickT(p, '.tmodal [data-tclose]');
  const T1 = await p.evaluate(() => Object.values(window.__terr.territorios).find(t => t.num === '12'));
  check('la foto se sube achicada a Storage', T1.foto && /territorios\/.*\.jpg$/.test(T1.foto.path) && store.uploads !== undefined && await p.evaluate(() => window.__store.uploads.length === 1));
  let rows = await p.evaluate(() => [...document.querySelectorAll('#tList .trow')].map(r => r.innerText.replace(/\s+/g, ' ')));
  check('semáforo: 12 "+1 año" (sin trabajar desde mar 2025), 22 disponible', /^12 Centro Norte Sin trabajar desde mar 2025.*\+1 año$/.test(rows[0]) && /Disponible$/.test(rows[1]), rows);
  // Asignar el 12 a un hermano
  await clickT(p, '#tList [data-id="' + T1.id + '"]');
  await clickT(p, '#tAsg');
  const firstFree = await p.evaluate(() => document.querySelector('.tmodal #taList .tpick').innerText);
  check('para asignar, primero los que no tienen territorio', /Todavía no tuvo/.test(firstFree), firstFree);
  await p.click('#taList [data-id="p6"]'); await p.waitForTimeout(80);
  check('el botón dice a quién', /Asignar a Diego Fernández/.test(await p.textContent('#taOk')));
  await clickT(p, '#taOk');
  // Asignar el 22 a un grupo, hace 5 meses → vencido
  const T2id = await p.evaluate(() => Object.values(window.__terr.territorios).find(t => t.num === '22').id);
  await clickT(p, '#tList [data-id="' + T2id + '"]'); await clickT(p, '#tAsg');
  await clickT(p, '#taSeg [data-k="grupo"]'); await p.click('#taList [data-id="' + gid + '"]'); await p.fill('#taDate', '2026-04-10'); await clickT(p, '#taOk');
  rows = await p.evaluate(() => [...document.querySelectorAll('#tList .trow')].map(r => r.innerText.replace(/\s+/g, ' ')));
  check('12 asignado a Diego; 22 del Grupo 1 vencido', /Diego Fernández · hoy.*Asignado$/.test(rows[0]) && /Grupo 1 \(Martín Ruiz\).*Vencido$/.test(rows[1]), rows);
  check('números arriba: 0 disponibles, 2 asignados, 1 vencido', await p.evaluate(() => [...document.querySelectorAll('.tkpi b')].map(x => x.textContent).join() === '0,2,1,0'));
  await p.screenshot({ path: SHOTS + '/territorios-lista.png' });
  // Terminar el 12
  await clickT(p, '#tList [data-id="' + T1.id + '"]');
  await p.screenshot({ path: SHOTS + '/territorios-ficha.png' });
  await clickT(p, '#tDone'); await clickT(p, '#tDoneOk');
  const T1b = await p.evaluate((id) => window.__terr.territorios[id], T1.id);
  check('terminado: disponible, con fecha y en el historial', !T1b.asignado && T1b.ultimoTerminado === '2026-09-23' && T1b.historial[0].nombre === 'Diego Fernández' && T1b.historial[0].hasta === '2026-09-23', T1b);
  await clickT(p, '#terrRoot [data-t="t-filter"][data-k="primero"]');
  check('"Para dar primero" muestra el que hace más que no se trabaja', await p.evaluate(() => document.querySelectorAll('#tList .trow').length === 1));

  // Salidas
  await clickT(p, '#terrRoot [data-t="view"][data-k="salidas"]');
  const lugares = await p.evaluate(() => Object.values(window.__terr.lugares).map(l => [l.id, l.nombre]));
  const lGomez = lugares.find(l => /Gómez/.test(l[1]))[0], lSalon = lugares.find(l => /Salón/.test(l[1]))[0];
  await clickT(p, '#terrRoot [data-t="s-new"]');
  await p.click('#tsG [data-g="' + gid + '"]');
  await p.selectOption('#tsDia', '2'); await p.fill('#tsHora', '09:30'); await p.selectOption('#tsLugar', lGomez);
  await clickT(p, '#tsSave');
  await clickT(p, '#terrRoot [data-t="s-new"]');
  await p.click('#tsG [data-g="congregacion"]');
  await p.selectOption('#tsDia', '6'); await p.fill('#tsHora', '09:30'); await p.selectOption('#tsLugar', lSalon);
  await p.selectOption('#tsCond', 'p4'); await p.check('#tsSiempre');
  await p.selectOption('#tsTerr', T1.id);
  await clickT(p, '#tsSave');
  rows = await p.evaluate(() => [...document.querySelectorAll('#terrRoot .trow')].map(r => r.innerText.replace(/\s+/g, ' ')));
  check('dos salidas en la semana, ordenadas por día', rows.length === 2 && /^MAR 22 09:30 🏠 Casa de la familia Gómez Belgrano 450 · Conduce falta asignar/.test(rows[0]) && /^SÁB 26 09:30 🏛 Salón del Reino Conduce Tomás Bravo Territorio 12/.test(rows[1]), rows);
  check('la que no tiene conductor dice "Falta"', /Falta/.test(rows[0]));
  await clickT(p, '#terrRoot [data-t="s-auto"]');
  rows = await p.evaluate(() => [...document.querySelectorAll('#terrRoot .trow')].map(r => r.innerText.replace(/\s+/g, ' ')));
  check('Auto-asignar pone al que hace más que no conduce del grupo', /Conduce (Martín Ruiz|Jorge López|Sofía Abad)/.test(rows[0]) && !/Falta/.test(rows[0]), rows[0]);
  await p.screenshot({ path: SHOTS + '/territorios-salidas.png' });
  await clickT(p, '#terrRoot [data-t="wk"][data-d="7"]');
  rows = await p.evaluate(() => [...document.querySelectorAll('#terrRoot .trow')].map(r => r.innerText.replace(/\s+/g, ' ')));
  check('la semana siguiente se repiten solas (el conductor fijo sigue, el otro vuelve a faltar)', rows.length === 2 && /falta asignar/.test(rows[0]) && /Conduce Tomás Bravo/.test(rows[1]), rows);
  // Suspender la de congregación solo esa semana
  const sids = await p.evaluate(() => [...document.querySelectorAll('#terrRoot .trow[data-t="s-edit"]')].map(r => [r.dataset.g, r.dataset.id]));
  await clickT(p, `#terrRoot .trow[data-id="${sids[1][1]}"]`);
  await p.check('#tsCancel'); await clickT(p, '#tsSave');
  check('suspendida esa semana', await p.evaluate(() => /Suspendida/.test($('terrRoot').innerText)));
  await clickT(p, '#terrRoot [data-t="wk"][data-d="-7"]');
  check('la semana anterior sigue igual', await p.evaluate(() => !/Suspendida/.test($('terrRoot').innerText)));
  await clickT(p, '#terrRoot [data-t="s-share"]');
  const wa = await p.evaluate(() => decodeURIComponent((window.__opened.pop() || '').split('text=')[1] || ''));
  check('Compartir arma el mensaje con lugar, dirección y conductor', /\*Salidas al servicio\*/.test(wa) && /Martes 22 · 09:30\* — Grupo 1/.test(wa) && /Belgrano 450/.test(wa) && /Conduce: Tomás Bravo/.test(wa), wa);
  check('filtro por grupo', await p.evaluate(() => { document.querySelector('#terrRoot [data-t="s-filter"][data-k="congregacion"]').click(); return true; }) && await p.evaluate(() => new Promise(r => setTimeout(() => r(document.querySelectorAll('#terrRoot .trow').length === 1), 50))));
  // Un hermano avisó desde la vista que terminó el 22
  await p.evaluate((id) => { window.__store.docs['congregations/C/terminados/' + id] = { tid: id, pubId: 'p1', nombre: 'Martín Ruiz', email: 'martin@x.com', fecha: '2026-09-20', at: '2026-09-21T10:00:00Z' }; window.__terr.started = true; }, T2id);
  await p.evaluate(() => fbDb.collection('congregations').doc('C').collection('terr').doc('grupos').update(new firebase.firestore.FieldPath('x'), 1));
  await p.waitForTimeout(200);
  await clickT(p, '#terrRoot [data-t="view"][data-k="territorios"]');
  check('aviso "Lo terminé" para confirmar (y contador en la sección)', await p.evaluate(() => /Avisaron que lo terminaron/.test($('terrRoot').innerText) && /Martín Ruiz · el 20 sept/.test($('terrRoot').innerText) && /Territorios · 1/.test(document.querySelector('#terrRoot .tseg').innerText)));
  await clickT(p, '#terrRoot [data-t="tt-ok"]'); await p.waitForTimeout(200);
  const T2b = await p.evaluate((id) => ({ t: window.__terr.territorios[id], aviso: window.__store.docs['congregations/C/terminados/' + id] }), T2id);
  check('Confirmar lo marca terminado en esa fecha y borra el aviso', !T2b.t.asignado && T2b.t.ultimoTerminado === '2026-09-20' && !T2b.aviso, T2b);
  check('sin errores (Super Admin)', p.errs.length === 0, p.errs);

  console.log('\nEncargado de grupo con "Solo ver"');
  const s2 = await p.evaluate(() => JSON.parse(JSON.stringify(window.__store)));
  const e = await open('martin@x.com', s2);
  await e.waitForTimeout(300);
  check('no lo manda a la vista: entra como encargado de grupo', await e.evaluate(() => currentUserRole === 'grupo' && !document.getElementById('viewerRedirect')));
  check('solo ve la pestaña Territorios', await e.evaluate(() => [...document.querySelectorAll('.bottom-tabs .tab-btn[data-tab]')].filter(x => !x.classList.contains('hidden')).map(x => x.dataset.tab).join() === 'territorios'));
  check('solo Salidas y Lugares', await e.evaluate(() => [...document.querySelectorAll('#terrRoot .tseg button')].map(x => x.textContent).join() === 'Salidas,Lugares'));
  check('la de su grupo se edita; la de congregación no', await e.evaluate(() => { const r = [...document.querySelectorAll('#terrRoot .trow')]; return r.length === 2 && r[0].dataset.t === 's-edit' && !r[1].dataset.t; }));
  await e.click('#terrRoot [data-t="s-new"]'); await e.waitForTimeout(100);
  check('una salida nueva solo puede ser de su grupo', await e.evaluate(() => [...document.querySelectorAll('#tsG button')].map(x => x.textContent).join() === 'Grupo 1'));
  await e.screenshot({ path: SHOTS + '/territorios-grupo.png' });
  check('no sube nada al documento de la congregación', await e.evaluate(() => { saveData(); return !window.__store.writes.some(w => w.path === 'congregations/C'); }));
  check('sin errores (encargado)', e.errs.length === 0, e.errs);

  console.log('\nSolo ver (sin grupo) y Admin — Territorios');
  const v = await open('ver@x.com', s2);
  await v.waitForTimeout(200);
  check('"Solo ver" sin grupo sigue yendo a la vista', await v.evaluate(() => !!document.getElementById('viewerRedirect')));
  const t = await open('terr@x.com', s2);
  check('Admin — Territorios: rol y solo su pestaña', await t.evaluate(() => currentUserRole === 'territorios' && [...document.querySelectorAll('.bottom-tabs .tab-btn[data-tab]')].filter(x => !x.classList.contains('hidden')).map(x => x.dataset.tab).join() === 'territorios' && !$('panel-territorios').classList.contains('hidden')));
  check('ve las 4 secciones', await t.evaluate(() => document.querySelectorAll('#terrRoot .tseg button').length === 4));
  check('sin errores (territorios)', t.errs.length === 0, t.errs);
  await b.close(); console.log(`\n${ok} OK, ${bad} fallaron`);
})();
