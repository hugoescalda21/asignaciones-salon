// Hermanos de otra congregación en los trabajos del Salón:
//  · Editor: "Invitar a otra congregación" (enlace por trabajo y día), anularla, quién se anotó con el enlace,
//    y el voluntario del salón (email + tilde) en la lista de hermanos de otra congregación.
//  · Vista con la invitación (sin cuenta): ve solo ese trabajo, "Me anoto", "✓ Anotado", baja, vencida, completo.
//  · Vista del voluntario del salón (entra con su email): solo Mantenimiento, "Me sumo".
// La función salonExterno se simula acá con la misma lógica de functions/lib.js.
const path = require('path');
const { launch, FILE, SHOTS, fixture } = require('./_helper');
const { installMock } = require('./_mock-firestore');
const L = require('../../push-salon-2026/functions/lib.js');
const SC = require('../../salon-core.js');
const VER = 'file://' + path.resolve(__dirname, '../../ver/ver.html');
const data = fixture();
Object.assign(data.settings, { editorEmails: ['hugo@x.com'], salonAdminEmails: ['salon@x.com'], viewerEmails: ['ver@x.com'], congregationName: 'San Agustín' });
let ok = 0, bad = 0; const check = (l, c, x) => { if (c) { ok++; console.log('  ✅', l); } else { bad++; console.log('  ❌', l, x === undefined ? '' : JSON.stringify(x).slice(0, 500)); } };

const W1 = { id: 'w1', titulo: 'Limpieza de canaletas', tipo: 'profunda', fecha: '2026-09-26', hora: '08:00', resp: 'p3', aux: 'p9', cupo: 3, repite: 'no', vista: true, fichaCod: '03.F', tareas: ['TECHOS', 'Limpiar la basura'], materiales: ['Escalera larga'] };
const W2 = { id: 'w2', titulo: 'Driver de emergencia', tipo: 'reparacion', fecha: '2026-09-30', hora: '18:30', resp: 'p3', aux: 'p4', cupo: 2, repite: 'no', vista: false };
const W3 = { id: 'w3', titulo: 'Pintura de rejas', tipo: 'pintura', fecha: '2026-10-03', hora: '09:00', resp: 'p4', aux: 'p6', cupo: 2, repite: 'no', vista: true };
const EXT = { e1: { id: 'e1', nombre: 'Juan Ramírez', cong: 'Norte', tel: '343 555-1234', email: 'juan@gmail.com', vol: true }, e2: { id: 'e2', nombre: 'Esteban Ríos', cong: 'Norte' } };

(async () => {
  const b = await launch();
  const click = async (p, sel) => { await p.click(sel); await p.waitForTimeout(150); };

  /* ======================= Editor ======================= */
  console.log('\nEditor: invitar a otra congregación');
  const store = { docs: { 'congregations/C': JSON.parse(JSON.stringify(data)), 'congregations/C/terr/grupos': { lista: {} },
    'congregations/C/salon/trabajos': { lista: { w1: W1, w2: W2, w3: W3 } }, 'congregations/C/salon/limpieza': { rotacion: [], semanas: {}, otraNombre: 'Norte' },
    'congregations/C/salon/externos': { lista: JSON.parse(JSON.stringify(EXT)) },
    'congregations/C/salonAnotados/w1__2026-09-26__x-e2': { tid: 'w1', fecha: '2026-09-26', pubId: 'x:e2', nombre: 'Esteban Ríos', uid: 'x-e2', comentario: 'Llevo la hidrolavadora', cong: 'Norte', inv: 'OLDKEY', at: 'x' } }, writes: [], uploads: [] };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((d) => { localStorage.setItem('kh-schedule-data-v2', JSON.stringify(d)); localStorage.setItem('kh-welcome-salon', '1'); window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; window.confirm = () => true; window.__clip = ''; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (x) => { window.__clip = x; } } }); }, data);
  let p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(FILE); await p.waitForTimeout(700);
  await p.evaluate(async ({ store, mock }) => { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden')); window.__store = store; eval('(' + mock + ')')(store, 'hugo@x.com'); await startSync('C'); }, { store, mock: installMock.toString() });
  await p.waitForTimeout(400);
  await p.evaluate(() => { switchTab('salon'); window.__salon.view = 'trab'; salonRender(); });
  await p.waitForTimeout(150);
  await click(p, '#salonRoot [data-id="w1"]');
  const md = () => p.evaluate(() => [...document.querySelectorAll('.slmodal')].pop().innerText.replace(/\s+/g, ' '));
  let t = await md();
  check('detalle publicado con voluntarios: "Invitar a otra congregación"', /Invitar a otra congregación/.test(t) && /sin cuenta/.test(t), t.slice(0, 600));
  check('el que se anotó con el enlace: su congregación y "Se anotó con la invitación"', /Esteban Ríos Cong\. Norte 🔗 Se anotó con la invitación "Llevo la hidrolavadora"/.test(t), t);
  await click(p, '.slmodal [data-d="invitar"]');
  t = await md();
  check('ventana: para la Cong. Norte (la del salón compartido), lugares y teléfono', /Para Cong\. Norte Cualquier congregación/i.test(t) && /Los que falten \(2\)/.test(t) && /Sí \(opcional para ellos\)/.test(t), t);
  const msg = await p.evaluate(() => document.querySelector('.slmodal:last-child .sl-wamsg').textContent);
  check('mensaje: trabajo, día, quiénes, lo que falta, qué llevar y el enlace con la invitación', /\*Limpieza de canaletas\* — Salón del Reino/.test(msg) && /Sábado 26 de septiembre · 08:00/.test(msg) && /Hacen falta 2 voluntarios más\. Qué llevar: escalera larga\./.test(msg) && /ver\/ver\.html\?codigo=C&inv=[A-Za-z0-9]{12}/.test(msg) && /¡Gracias, hermanos de Norte!/.test(msg), msg);
  await p.screenshot({ path: path.join(SHOTS, 'otra-cong-invitar.png'), fullPage: true });
  await click(p, '.slmodal:last-child [data-iv="lugares"][data-v="1"]');
  await click(p, '.slmodal:last-child #slIvW');
  const inv = await p.evaluate(() => Object.values(window.__salon.invit));
  check('se guarda en salon/invitaciones (trabajo, día, para, lugares)', inv.length === 1 && inv[0].tid === 'w1' && inv[0].fecha === '2026-09-26' && inv[0].para === 'Norte' && inv[0].lugares === 1 && inv[0].tel === true && inv[0].k.length === 12, inv);
  const wa = await p.evaluate(() => window.__opened.slice(-1)[0] || '');
  check('abre WhatsApp con el mensaje y el enlace', /^https:\/\/wa\.me\/\?text=/.test(wa) && decodeURIComponent(wa).includes('&inv=' + (inv[0] && inv[0].k)), wa.slice(0, 200));
  t = await md();
  check('el detalle muestra la invitación activa (de 1 lugar, vence el sáb 26)', /Invitación para la Cong\. Norte/.test(t) && /todavía no se anotó nadie \(de 1 lugar\) · vence el sáb 26/.test(t), t.slice(0, 700));
  await click(p, '.slmodal [data-d="invitar"]');
  t = await md();
  check('volver a abrirla: la misma (no se puede cambiar a quién ni los lugares) y "Anular"', /Invitación a otra congregación/.test(t) && /Anular/.test(t) && await p.evaluate(() => document.querySelector('.slmodal:last-child [data-iv="lugares"]').disabled) && (await p.evaluate(() => document.querySelector('.slmodal:last-child .sl-wamsg').textContent)).includes(inv[0].k));
  await click(p, '.slmodal:last-child #slIvC');
  check('copiar enlace: el mismo mensaje al portapapeles', (await p.evaluate(() => window.__clip)).includes('&inv=' + inv[0].k));
  await click(p, '.slmodal [data-d="invitar"]');
  await click(p, '.slmodal:last-child #slIvX');
  check('anular: queda anulada y vuelve el botón "Invitar"', await p.evaluate(() => Object.values(window.__salon.invit)[0].anulada === true) && /Invitar a otra congregación/.test(await md()));
  await p.evaluate(() => document.querySelectorAll('.slmodal').forEach(m => m.remove()));
  await click(p, '#salonRoot [data-id="w2"]');
  check('un trabajo que ve solo el comité no tiene invitación', !/Invitar a otra congregación/.test(await md()));
  await p.evaluate(() => document.querySelectorAll('.slmodal').forEach(m => m.remove()));

  console.log('\nEditor: voluntario del salón');
  await p.evaluate(() => { window.__salon.view = 'limp'; window.__salon.lAjustes = true; salonRender(); });
  await p.waitForTimeout(150);
  t = await p.evaluate(() => $('salonRoot').innerText.replace(/\s+/g, ' '));
  check('lista: "Entra como voluntario" en el que tiene email y tilde', /Juan Ramírez Cong\. Norte · 📱 343 555-1234 · 👁 Entra como voluntario/.test(t) && !/Esteban Ríos Cong\. Norte · 👁/.test(t), t.slice(-500));
  await click(p, '#salonRoot [data-s="x-edit"][data-id="e2"]');
  await click(p, '.slmodal:last-child #slXv');
  await click(p, '.slmodal:last-child #slXs');
  check('con la tilde y sin email: pide el email', /escribí su email/.test(await p.evaluate(() => document.querySelector('.slmodal:last-child #slXe').textContent)));
  await p.fill('.slmodal:last-child #slXm', '  Esteban.Rios@Gmail.com ');
  await click(p, '.slmodal:last-child #slXs');
  const e2 = await p.evaluate(() => window.__salon.externos.e2);
  check('se guarda el email (en minúsculas) y la tilde, sin perder lo demás', e2 && e2.email === 'esteban.rios@gmail.com' && e2.vol === true && e2.cong === 'Norte' && e2.nombre === 'Esteban Ríos', e2);
  check('editor sin errores', !p.errs.length, p.errs);
  await ctx.close();

  /* ======================= Vista (función simulada) ======================= */
  const HOY_ISO = '2026-09-23';
  function server() {
    const st = { trabajos: { w1: JSON.parse(JSON.stringify(W1)), w2: JSON.parse(JSON.stringify(W2)), w3: JSON.parse(JSON.stringify(W3)) }, externos: JSON.parse(JSON.stringify(EXT)),
      invit: { K1: { k: 'K1', tid: 'w1', fecha: '2026-09-26', para: 'Norte', lugares: 0, tel: true }, KV: { k: 'KV', tid: 'w1', fecha: '2026-09-20', para: '' }, KX: { k: 'KX', tid: 'w1', fecha: '2026-09-26', anulada: true } },
      anotados: { 'w1__2026-09-26__u9': { tid: 'w1', fecha: '2026-09-26', pubId: 'p1', nombre: 'Martín Ruiz', uid: 'u9', comentario: '', at: 'x' } }, fichas: {}, calls: [] };
    const sha = (s) => require('crypto').createHash('sha256').update(String(s)).digest('hex');
    st.handle = (body, auth) => {
      st.calls.push(Object.assign({ auth: auth || '' }, body));
      let modo, ext = null, inv = null;
      if (body.k) { modo = 'inv'; inv = st.invit[body.k] ? Object.assign({}, st.invit[body.k]) : null; }
      else { const em = (auth || '').replace('Bearer tok-', ''); ext = L.extVoluntario(st.externos, em); if (!ext) return [403, { error: 'Sin acceso' }]; modo = 'vol'; }
      const pubs = data.publishers;
      if (body.action === 'ver') {
        if (modo === 'inv') {
          const e = L.estadoInvitacion(inv, st.trabajos, HOY_ISO);
          if (e.estado !== 'ok') return [200, { modo, cong: 'San Agustín', estado: e.estado, titulo: e.t ? e.t.titulo : '', fecha: inv ? inv.fecha : '' }];
          const mia = body.aid && st.anotados[body.aid];
          const proj = L.proyeccionExterno([{ tid: inv.tid, fecha: inv.fecha }], st.trabajos, st.anotados, st.fichas, pubs, mia && mia.inv === inv.k ? mia.uid : null);
          return [200, Object.assign({ modo, cong: 'San Agustín', estado: 'ok', para: inv.para || '', tel: inv.tel !== false, lugares: L.lugaresInvitacion(inv, e.t, st.anotados) }, proj)];
        }
        const occ = L.occVoluntario(st.trabajos, st.anotados, ext.id, HOY_ISO);
        const proj = L.proyeccionExterno(occ, st.trabajos, st.anotados, st.fichas, pubs, 'x-' + ext.id);
        proj.pubs.push({ id: 'x:' + ext.id, name: ext.nombre, email: ext.email });
        return [200, Object.assign({ modo, cong: 'San Agustín', estado: 'ok', yo: { id: 'x:' + ext.id, nombre: ext.nombre, cong: ext.cong } }, proj)];
      }
      if (body.action === 'anotar') {
        const t = st.trabajos[body.tid]; let persona;
        if (modo === 'inv') {
          const d = L.datosInvitado(body); if (d.error) return [400, { error: d.error }];
          if (L.estadoInvitacion(inv, st.trabajos, HOY_ISO).estado !== 'ok') return [409, { error: 'Esta invitación ya no está activa.', estado: 'vencida' }];
          if (L.lugaresInvitacion(inv, t, st.anotados) <= 0) return [409, { error: 'Ya se completaron los lugares.', completo: true }];
          persona = L.extBuscar(st.externos, d.nombre, d.cong) || { id: 'i1', nombre: d.nombre, cong: d.cong, tel: d.tel, origen: 'invitacion' };
          st.externos[persona.id] = persona;
        } else {
          persona = ext;
          if (SC.cupoInfo(t, body.fecha, st.anotados).faltan <= 0) return [409, { error: 'Ya se completaron los lugares.', completo: true }];
        }
        const aid = SC.anotadoId(body.tid, body.fecha, 'x-' + persona.id);
        if (st.anotados[aid]) return [409, { error: 'Ya estás anotado en este trabajo.' }];
        const bk = modo === 'inv' ? 'secreto' + Object.keys(st.anotados).length : '';
        st.anotados[aid] = Object.assign({ tid: body.tid, fecha: body.fecha, pubId: 'x:' + persona.id, nombre: persona.nombre, uid: 'x-' + persona.id, comentario: body.comentario || '', cong: persona.cong, at: 'x' }, modo === 'inv' ? { inv: body.k, bk: sha(bk) } : {});
        return [200, Object.assign({ ok: true, aid, nombre: persona.nombre }, bk ? { bk } : {})];
      }
      if (body.action === 'baja') {
        const a = st.anotados[body.aid]; if (!a) return [200, { ok: true }];
        const puede = modo === 'vol' ? a.uid === 'x-' + ext.id : (a.inv === body.k && a.bk === sha(body.bk));
        if (!puede) return [403, { error: 'No se puede dar de baja a otro hermano.' }];
        delete st.anotados[body.aid]; return [200, { ok: true }];
      }
      return [400, { error: 'Acción desconocida' }];
    };
    return st;
  }
  async function openVer(srv, query, ctxIn) {
    const c = ctxIn || await b.newContext({ viewport: { width: 390, height: 844 } });
    if (!ctxIn) {
      await c.route(/googleapis|gstatic|tile\.openstreetmap/, r => r.abort());
      await c.route(/salonExterno/, async (r) => { const [code, j] = srv.handle(r.request().postDataJSON() || {}, r.request().headers().authorization); await r.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(j) }); });
      await c.addInitScript(() => { localStorage.setItem('welcome-seen-C', '1'); window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; window.confirm = () => true; });
    }
    const pg = await c.newPage(); pg.errs = []; pg.on('pageerror', e => { if (!/firebase is not defined/.test(e.message)) pg.errs.push(e.message); });
    await pg.goto(VER + query); await pg.waitForTimeout(500);
    if (/inv=/.test(query)) await pg.waitForSelector('#salonBox .sv-teaser', { timeout: 5000 }).catch(() => {});
    return pg;
  }
  const boxTxt = (pg) => pg.evaluate(() => (document.getElementById('salonBox') || {}).innerText.replace(/\s+/g, ' '));
  const sheetTxt = (pg) => pg.evaluate(() => { const s = [...document.querySelectorAll('.sv-sheet')].pop(); return s ? s.innerText.replace(/\s+/g, ' ') : ''; });

  console.log('\nVista: invitación (sin cuenta)');
  let srv = server();
  p = await openVer(srv, '?codigo=C&inv=K1');
  t = await boxTxt(p);
  const head = await p.evaluate(() => ({ tag: document.querySelector('.readonly-tag').textContent, cong: $('congTitle').textContent, tabs: getComputedStyle($('bottomTabs')).display, main: !$('mainView').classList.contains('hidden'), auth: !$('authGateView').classList.contains('hidden') }));
  check('entra sin iniciar sesión: "Invitación", nombre de la congregación, sin pestañas', head.main && !head.auth && head.tag === 'Invitación' && head.cong === 'San Agustín' && head.tabs === 'none', head);
  await p.screenshot({ path: path.join(SHOTS, 'otra-cong-enlace.png'), fullPage: true });
  check('ve solo ese trabajo, con "Me anoto", qué llevar y quiénes', /Hola, hermanos de la Cong\. Norte/.test(t) && /Limpieza de canaletas/.test(t) && /Me anoto/.test(t) && /Qué llevar: Escalera larga/.test(t) && /Responsable: Carlos Vega · Auxiliar: Nicolás Paz/.test(t) && !/Pintura de rejas|Driver/.test(t) && /vence el sábado 26 de septiembre/.test(t), t);
  check('lo pidió la función con la invitación (sin cuenta)', srv.calls[0] && srv.calls[0].k === 'K1' && srv.calls[0].action === 'ver' && !srv.calls[0].auth, srv.calls[0]);
  await click(p, '#salonBox [data-sv="ficha"]');
  t = await sheetTxt(p);
  check('ve la ficha, sin poder tildar', /FICHA DE TRABAJO/.test(t) && /La completan el responsable y el auxiliar/.test(t) && !/Terminé/.test(t) && await p.evaluate(() => [...document.querySelectorAll('.sv-sheet input[type=checkbox]')].every(x => x.disabled)), t.slice(0, 300));
  await p.evaluate(() => document.querySelectorAll('.sv-ov').forEach(x => x.remove()));
  await click(p, '#salonBox [data-sv="sumo"]');
  t = await sheetTxt(p);
  check('"Me anoto": nombre, congregación (ya con Norte) y teléfono', /Anotate en este trabajo/.test(t) && await p.evaluate(() => $('svIC').value === 'Norte' && !!$('svIT') && !!$('svIN')));
  await p.screenshot({ path: path.join(SHOTS, 'otra-cong-anoto.png') });
  await p.fill('#svIN', 'Juan'); await click(p, '#svOk');
  check('pide nombre y apellido', /nombre y apellido/.test(await p.evaluate(() => $('svIE').textContent)));
  await p.fill('#svIN', 'Juan Ramírez'); await p.fill('#svIT', '343 555-1234'); await p.fill('#svCom', 'Llevo la hidrolavadora');
  await click(p, '#svOk'); await p.waitForTimeout(300);
  t = await sheetTxt(p);
  const an = srv.anotados['w1__2026-09-26__x-e1'];
  check('se anota (reconoce que ya estaba en la lista de Norte) y avisa al responsable', /¡Listo, Juan!/.test(t) && /Carlos Vega ya sabe que vas/.test(t) && an && an.pubId === 'x:e1' && an.inv === 'K1' && an.comentario === 'Llevo la hidrolavadora' && an.cong === 'Norte', { t, an });
  await p.evaluate(() => document.querySelectorAll('.sv-ov').forEach(x => x.remove()));
  t = await boxTxt(p);
  check('ahora "✓ Anotado", "Ya estás anotado, Juan" y va con su congregación', /✓ Anotado/.test(t) && /Ya estás anotado, Juan/.test(t) && /Van: Ruiz, Ramírez \(Norte\)/.test(t), t);
  const ctxI = p.context();
  await p.reload(); await p.waitForTimeout(500);
  await p.waitForSelector('#salonBox .sv-teaser', { timeout: 5000 }).catch(() => {});
  t = await boxTxt(p);
  check('al volver a abrir el enlace en el mismo teléfono, sigue "✓ Anotado"', /✓ Anotado/.test(t) && srv.calls.slice(-1)[0].aid === 'w1__2026-09-26__x-e1', srv.calls.slice(-1)[0]);
  await click(p, '#salonBox [data-sv="anotado"]');
  check('opciones: descargar la ficha y "Ya no puedo ir" (sin cambiar comentario)', /Descargar la ficha/.test(await sheetTxt(p)) && /Ya no puedo ir/.test(await sheetTxt(p)) && !/Cambiar mi comentario/.test(await sheetTxt(p)));
  await click(p, '#svNo'); await click(p, '#svBaja'); await p.waitForTimeout(300);
  check('se da de baja con su clave: se libera el lugar', !srv.anotados['w1__2026-09-26__x-e1'] && /Me anoto/.test(await boxTxt(p)) && srv.calls.some(c => c.action === 'baja' && c.bk === 'secreto1'), srv.calls.filter(c => c.action === 'baja'));
  check('vista con invitación sin errores', !p.errs.length, p.errs);
  await ctxI.close();

  srv = server();
  srv.invit.K1.lugares = 1;
  srv.anotados.x = { tid: 'w1', fecha: '2026-09-26', pubId: 'x:e2', nombre: 'Esteban Ríos', uid: 'x-e2', cong: 'Norte', inv: 'K1' };
  p = await openVer(srv, '?codigo=C&inv=K1');
  t = await boxTxt(p);
  check('sin lugares para la invitación: "Completo" y "Ya se completaron los lugares"', /Completo/.test(t) && !/Me anoto/.test(t) && /Ya se completaron los lugares/.test(t) && /Ríos \(Norte\)/.test(t), t);
  await p.context().close();
  p = await openVer(server(), '?codigo=C&inv=KV');
  check('vencida: "ya no está activa"', /Esta invitación ya no está activa/.test(await boxTxt(p)) && /pedile un enlace nuevo/.test(await boxTxt(p)));
  await p.context().close();
  p = await openVer(server(), '?codigo=C&inv=KX');
  check('anulada: "se anuló"', /Esta invitación se anuló/.test(await boxTxt(p)));
  await p.context().close();

  console.log('\nVista: voluntario del salón (entra con su email)');
  srv = server();
  const entrarComo = async (email) => {
    const pg = await openVer(srv, '?codigo=C');
    await pg.evaluate(async (email) => { currentUser = { uid: 'uid-' + email, email, getIdToken: async () => 'tok-' + email }; try { await showAccessDenied(); } catch (e) { /* sin Firebase en la prueba: el pedido de acceso no carga */ } }, email);
    await pg.waitForTimeout(400);
    return pg;
  };
  p = await entrarComo('juan@gmail.com');
  const vh = await p.evaluate(() => ({ tag: document.querySelector('.readonly-tag').textContent, tabs: [...document.querySelectorAll('.bt-btn')].filter(x => !x.classList.contains('hidden') && getComputedStyle(x).display !== 'none').map(x => x.dataset.tab), main: !$('mainView').classList.contains('hidden'), denied: !$('authGateView').classList.contains('hidden') }));
  check('entra solo a Mantenimiento: "Voluntario · Cong. Norte"', vh.main && !vh.denied && vh.tag === 'Voluntario · Cong. Norte' && vh.tabs.join() === 'salon', vh);
  t = await boxTxt(p);
  await p.screenshot({ path: path.join(SHOTS, 'otra-cong-voluntario.png'), fullPage: true });
  check('ve los publicados que piden voluntarios, no los del comité', /Hola, Juan/.test(t) && /Limpieza de canaletas/.test(t) && /Pintura de rejas/.test(t) && !/Driver/.test(t) && (t.match(/Me sumo/g) || []).length === 2, t);
  check('pidió los datos con su sesión', /^Bearer tok-juan@gmail\.com$/.test(srv.calls[0].auth), srv.calls[0]);
  await click(p, '#salonBox [data-sv="sumo"][data-id="w3"]');
  t = await sheetTxt(p);
  check('"Me sumo": se anota como Juan Ramírez', /Te anotás como Juan Ramírez/.test(t), t);
  await click(p, '#svOk'); await p.waitForTimeout(300);
  check('anotado por la función (con su id de afuera)', !!srv.anotados['w3__2026-10-03__x-e1'] && /¡Listo, te anotaste!/.test(await sheetTxt(p)));
  await p.evaluate(() => document.querySelectorAll('.sv-ov').forEach(x => x.remove()));
  check('ahora "✓ Anotado" en Pintura de rejas', await p.evaluate(() => /✓ Anotado/.test(document.getElementById('sv-w3-2026-10-03').innerText)));
  await click(p, '#salonBox [data-sv="anotado"][data-id="w3"]');
  await click(p, '#svNo'); await click(p, '#svBaja'); await p.waitForTimeout(300);
  check('"Ya no puedo ir": se da de baja', !srv.anotados['w3__2026-10-03__x-e1']);
  check('vista del voluntario sin errores', !p.errs.length, p.errs);
  await p.context().close();
  p = await entrarComo('otro@gmail.com');
  check('alguien que no está en la lista: la pantalla de siempre para pedir acceso', await p.evaluate(() => !$('authGateView').classList.contains('hidden') && !$('authStepDenied').classList.contains('hidden') && $('mainView').classList.contains('hidden')));
  await p.context().close();

  await b.close();
  console.log(`\n${ok} OK, ${bad} fallaron`);
  process.exitCode = bad ? 1 : 0;
})();
