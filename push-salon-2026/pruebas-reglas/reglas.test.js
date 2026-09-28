/* =====================================================================
   Pruebas de las reglas de seguridad (Firestore y Storage)
   ---------------------------------------------------------------------
   Corren contra los emuladores de Firebase (en tu PC, sin tocar la base
   real: el proyecto es "demo-asignaciones", que no existe en la nube).

   Una sola vez, en esta carpeta (push-salon-2026/pruebas-reglas):
       npm install
   Cada vez:
       npm test

   Hace falta Java 21 instalado (lo usan los emuladores).
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');

const C = 'congregations/C';
const S = {
  super: 'super@x.com', tec: 'tec@x.com', aco: 'aco@x.com', asig: 'asig@x.com', terr: 'terr@x.com',
  anun: 'anun@x.com', ver: 'ver@x.com', ver2: 'ver2@x.com', enc: 'enc@x.com', afuera: 'afuera@x.com'
};
const SETTINGS = {
  editorEmails: [S.super], tecnicoAdminEmails: [S.tec], acomodadoresAdminEmails: [S.aco],
  asignacionesAdminEmails: [S.asig], territoriosAdminEmails: [S.terr], anunciosOnlyEmails: [S.anun],
  anunciosEmails: [S.asig], viewerEmails: [S.ver, S.ver2, S.enc]
};

let ok = 0, bad = 0;
async function check(label, promise) {
  try { await promise; ok++; console.log('  ✅', label); }
  catch (e) { bad++; console.log('  ❌', label, '—', (e && e.message ? e.message : String(e)).split('\n')[0].slice(0, 200)); }
}
const section = (t) => console.log('\n' + t);

(async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-asignaciones',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
    storage: { rules: fs.readFileSync(path.join(__dirname, '..', 'storage.rules'), 'utf8') }
  });
  const uid = (email) => 'uid-' + email.split('@')[0];
  const db = (email) => email ? env.authenticatedContext(uid(email), { email }).firestore() : env.unauthenticatedContext().firestore();
  const st = (email) => email ? env.authenticatedContext(uid(email), { email }).storage() : env.unauthenticatedContext().storage();

  async function seed() {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const f = ctx.firestore();
      await f.doc(C).set({ settings: SETTINGS, publishers: [{ id: 'p1', name: 'Hugo' }], weeks: { '2026-09-21': { semana: { roles: {} } } }, anuncios: [], timerLog: [] });
      await f.doc('congregations/SIN').set({ settings: { editorEmails: [] }, weeks: {} });
      await f.doc(C + '/terr/grupos').set({ lista: { g1: { id: 'g1', nombre: 'Grupo 1', editores: [S.enc] }, g2: { id: 'g2', nombre: 'Grupo 2', editores: [] } }, editoresTodos: [S.enc] });
      await f.doc(C + '/terr/territorios').set({ lista: { t1: { id: 't1', num: '1' } } });
      await f.doc(C + '/terr/lugares').set({ lista: {} });
      await f.doc(C + '/salidas/g1').set({ plantilla: {} });
      await f.doc(C + '/terminados/t1').set({ tid: 't1', pubId: 'p1', nombre: 'Ver', email: S.ver, fecha: '2026-09-28', at: '2026-09-28T10:00:00Z' });
      await f.doc(C + '/errores/e1').set({ at: 'x', app: 'ver', kind: 'error', msg: 'algo' });
      await f.doc(C + '/solicitudes/' + uid(S.afuera)).set({ email: S.afuera, name: 'Alguien Nuevo', createdAt: 'a', updatedAt: 'a', status: 'pendiente' });
      await f.doc('pushSubscriptions/tok1').set({ code: 'C', pubId: 'p1' });
    });
  }
  await seed();

  section('1) Documento de la congregación: quién lo ve');
  await check('sin iniciar sesión: no', assertFails(db(null).doc(C).get()));
  await check('alguien que no está en Acceso: no', assertFails(db(S.afuera).doc(C).get()));
  for (const r of ['super', 'tec', 'aco', 'asig', 'terr', 'anun', 'ver']) await check(`${r}: sí`, assertSucceeds(db(S[r]).doc(C).get()));

  section('2) Documento de la congregación: quién cambia qué');
  await check('Super Admin cambia los ajustes', assertSucceeds(db(S.super).doc(C).update({ 'settings.congregationName': 'San Agustín' })));
  await check('Super Admin cambia los hermanos', assertSucceeds(db(S.super).doc(C).update({ publishers: [{ id: 'p1', name: 'Hugo E.' }] })));
  await check('Admin técnico cambia las semanas', assertSucceeds(db(S.tec).doc(C).update({ 'weeks.2026-09-21.semana.roles.sonido': 'p1' })));
  await check('Admin técnico NO cambia los ajustes', assertFails(db(S.tec).doc(C).update({ 'settings.congregationName': 'X' })));
  await check('Admin técnico NO se agrega a Acceso', assertFails(db(S.tec).doc(C).update({ 'settings.editorEmails': [S.super, S.tec] })));
  await check('Admin técnico NO cambia los hermanos', assertFails(db(S.tec).doc(C).update({ publishers: [] })));
  await check('Admin técnico NO publica anuncios (sin permiso)', assertFails(db(S.tec).doc(C).update({ anuncios: [{ id: 'a' }] })));
  await check('Admin técnico NO toca el cronómetro', assertFails(db(S.tec).doc(C).update({ timerLog: [{ id: 'x' }] })));
  await check('Admin de asignaciones con permiso publica anuncios', assertSucceeds(db(S.asig).doc(C).update({ anuncios: [{ id: 'a1' }] })));
  await check('"Solo anuncios" publica anuncios', assertSucceeds(db(S.anun).doc(C).update({ anuncios: [{ id: 'a2' }] })));
  await check('"Solo anuncios" NO cambia las semanas', assertFails(db(S.anun).doc(C).update({ 'weeks.2026-09-21.semana.roles.sonido': 'p1' })));
  await check('Admin de territorios NO cambia las semanas', assertFails(db(S.terr).doc(C).update({ 'weeks.2026-09-21.semana.roles.sonido': 'p1' })));
  await check('Admin de territorios NO publica anuncios (sin permiso)', assertFails(db(S.terr).doc(C).update({ anuncios: [] })));
  await check('Solo ver: NO cambia nada', assertFails(db(S.ver).doc(C).update({ 'weeks.2026-09-21.semana.roles.sonido': 'p1' })));
  await check('Nadie borra la congregación (ni el Super Admin)', assertFails(db(S.super).doc(C).delete()));
  await check('Alguien de afuera NO puede pisar la congregación', assertFails(db(S.afuera).doc(C).set({ settings: { editorEmails: [S.afuera] } })));

  section('3) Crear una congregación nueva');
  await check('se puede crear una nueva siendo su Super Admin', assertSucceeds(db(S.afuera).doc('congregations/NUEVA').set({ settings: { editorEmails: [S.afuera] } })));
  await check('NO se puede crear una nueva a nombre de otro', assertFails(db(S.afuera).doc('congregations/OTRA').set({ settings: { editorEmails: [S.super] } })));
  await check('sin sesión NO se crea nada', assertFails(db(null).doc('congregations/X').set({ settings: { editorEmails: ['a@x.com'] } })));
  await check('(de antes del login) congregación sin editores: la puede abrir quien entra', assertSucceeds(db(S.afuera).doc('congregations/SIN').get()));

  section('4) Registro de errores');
  const err = { at: '2026-09-28', app: 'ver', kind: 'error', msg: 'falló algo', where: 'ver.html:10', role: '', device: 'Android', online: true };
  await check('un hermano con acceso anota un error', assertSucceeds(db(S.ver).collection(C + '/errores').add(err)));
  await check('alguien de afuera NO anota errores', assertFails(db(S.afuera).collection(C + '/errores').add(err)));
  await check('NO se aceptan campos de más (datos personales)', assertFails(db(S.ver).collection(C + '/errores').add(Object.assign({ email: S.ver }, err))));
  await check('NO se aceptan mensajes larguísimos', assertFails(db(S.ver).collection(C + '/errores').add(Object.assign({}, err, { msg: 'x'.repeat(501) }))));
  await check('el Super Admin los lee', assertSucceeds(db(S.super).doc(C + '/errores/e1').get()));
  await check('un Admin NO los lee', assertFails(db(S.tec).doc(C + '/errores/e1').get()));
  await check('nadie los modifica', assertFails(db(S.super).doc(C + '/errores/e1').update({ msg: 'otro' })));
  await check('el Super Admin los borra', assertSucceeds(db(S.super).doc(C + '/errores/e1').delete()));

  section('5) Territorios, grupos y lugares');
  await check('un hermano con acceso los ve', assertSucceeds(db(S.ver).doc(C + '/terr/territorios').get()));
  await check('alguien de afuera NO', assertFails(db(S.afuera).doc(C + '/terr/territorios').get()));
  await check('el Admin de territorios los cambia', assertSucceeds(db(S.terr).doc(C + '/terr/territorios').set({ lista: { t1: { id: 't1', num: '1', asignado: null } } })));
  await check('el Super Admin los cambia', assertSucceeds(db(S.super).doc(C + '/terr/grupos').update({ 'lista.g2.nombre': 'Grupo Dos' })));
  await check('un Admin técnico NO los cambia', assertFails(db(S.tec).doc(C + '/terr/territorios').set({ lista: {} })));
  await check('el encargado de grupo cambia los lugares', assertSucceeds(db(S.enc).doc(C + '/terr/lugares').set({ lista: { L1: { id: 'L1', nombre: 'Casa' } } })));
  await check('el encargado de grupo NO cambia los territorios', assertFails(db(S.enc).doc(C + '/terr/territorios').set({ lista: {} })));
  await check('el encargado de grupo NO se agrega a otro grupo', assertFails(db(S.enc).doc(C + '/terr/grupos').update({ 'lista.g2.editores': [S.enc] })));
  await check('Solo ver NO cambia los lugares', assertFails(db(S.ver).doc(C + '/terr/lugares').set({ lista: {} })));

  section('6) Salidas al servicio');
  await check('un hermano con acceso las ve', assertSucceeds(db(S.ver).doc(C + '/salidas/g1').get()));
  await check('alguien de afuera NO', assertFails(db(S.afuera).doc(C + '/salidas/g1').get()));
  await check('el encargado cambia las de SU grupo', assertSucceeds(db(S.enc).doc(C + '/salidas/g1').set({ plantilla: { s1: { dia: 5 } } })));
  await check('el encargado NO cambia las de otro grupo', assertFails(db(S.enc).doc(C + '/salidas/g2').set({ plantilla: {} })));
  await check('el encargado NO cambia las de congregación', assertFails(db(S.enc).doc(C + '/salidas/congregacion').set({ plantilla: {} })));
  await check('el Admin de territorios cambia las de congregación', assertSucceeds(db(S.terr).doc(C + '/salidas/congregacion').set({ plantilla: {} })));
  await check('Solo ver NO cambia salidas', assertFails(db(S.ver).doc(C + '/salidas/g1').set({ plantilla: {} })));

  section('7) "Lo terminé"');
  const aviso = (email, tid) => ({ tid, pubId: 'p2', nombre: 'Ver Dos', email, fecha: '2026-09-28', at: '2026-09-28T11:00:00Z' });
  await check('un hermano avisa con SU email', assertSucceeds(db(S.ver2).doc(C + '/terminados/t2').set(aviso(S.ver2, 't2'))));
  await check('NO puede avisar a nombre de otro', assertFails(db(S.ver2).doc(C + '/terminados/t3').set(aviso(S.ver, 't3'))));
  await check('NO puede avisar con otro territorio en el contenido', assertFails(db(S.ver2).doc(C + '/terminados/t4').set(aviso(S.ver2, 't9'))));
  await check('NO se aceptan campos de más', assertFails(db(S.ver2).doc(C + '/terminados/t5').set(Object.assign({ extra: 1 }, aviso(S.ver2, 't5')))));
  await check('alguien de afuera NO avisa', assertFails(db(S.afuera).doc(C + '/terminados/t6').set(aviso(S.afuera, 't6'))));
  await check('el hermano ve su aviso', assertSucceeds(db(S.ver).doc(C + '/terminados/t1').get()));
  await check('otro hermano NO ve un aviso ajeno', assertFails(db(S.ver2).doc(C + '/terminados/t1').get()));
  await check('el Super Admin los ve', assertSucceeds(db(S.super).doc(C + '/terminados/t1').get()));
  await check('el hermano NO puede borrar su aviso', assertFails(db(S.ver).doc(C + '/terminados/t1').delete()));
  await check('el Admin de territorios lo confirma (lo borra)', assertSucceeds(db(S.terr).doc(C + '/terminados/t1').delete()));

  section('8) Solicitudes de acceso');
  const pedido = (email, status) => ({ email, name: 'Alguien Nuevo', createdAt: 'b', updatedAt: 'b', status: status || 'pendiente' });
  await check('alguien nuevo pide acceso con SU cuenta', assertSucceeds(db(S.ver2).doc(C + '/solicitudes/' + uid(S.ver2)).set(pedido(S.ver2))));
  await check('NO puede pedir a nombre de otra cuenta', assertFails(db(S.ver2).doc(C + '/solicitudes/' + uid(S.ver)).set(pedido(S.ver2))));
  await check('NO puede pedir con otro email', assertFails(db(S.afuera).doc(C + '/solicitudes/' + uid(S.afuera)).set(pedido(S.super))));
  await check('NO puede aprobarse solo', assertFails(db(S.afuera).doc(C + '/solicitudes/' + uid(S.afuera)).update({ status: 'aprobado' })));
  await check('ve su propio pedido', assertSucceeds(db(S.afuera).doc(C + '/solicitudes/' + uid(S.afuera)).get()));
  await check('otro NO ve pedidos ajenos', assertFails(db(S.ver).doc(C + '/solicitudes/' + uid(S.afuera)).get()));
  await check('el Super Admin lo rechaza', assertSucceeds(db(S.super).doc(C + '/solicitudes/' + uid(S.afuera)).update({ status: 'rechazado' })));
  await check('ya rechazado, el pedido no se puede reescribir', assertFails(db(S.afuera).doc(C + '/solicitudes/' + uid(S.afuera)).set(Object.assign(pedido(S.afuera), { createdAt: 'a' }))));
  await check('el Super Admin lo borra', assertSucceeds(db(S.super).doc(C + '/solicitudes/' + uid(S.afuera)).delete()));

  section('9) Avisos push');
  await check('nadie lee los registros de celulares', assertFails(db(S.super).doc('pushSubscriptions/tok1').get()));
  await check('con sesión se registra un celular', assertSucceeds(db(S.ver).doc('pushSubscriptions/tok2').set({ code: 'C', pubId: 'p1' })));
  await check('sin sesión NO', assertFails(db(null).doc('pushSubscriptions/tok3').set({ code: 'C', pubId: 'p1' })));
  await check('sin código o hermano NO', assertFails(db(S.ver).doc('pushSubscriptions/tok4').set({ code: 'C' })));

  section('10) Archivos (Storage)');
  const img = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  await check('el Super Admin sube una imagen a un anuncio', assertSucceeds(st(S.super).ref('congregations/C/anuncios/a.png').put(img, { contentType: 'image/png' })));
  await check('"Solo anuncios" sube un PDF', assertSucceeds(st(S.anun).ref('congregations/C/anuncios/b.pdf').put(img, { contentType: 'application/pdf' })));
  await check('un hermano NO sube adjuntos', assertFails(st(S.ver).ref('congregations/C/anuncios/c.png').put(img, { contentType: 'image/png' })));
  await check('NO se aceptan otros tipos de archivo', assertFails(st(S.super).ref('congregations/C/anuncios/d.exe').put(img, { contentType: 'application/octet-stream' })));
  await check('con sesión se ve un adjunto', assertSucceeds(st(S.ver).ref('congregations/C/anuncios/a.png').getMetadata()));
  await check('el Admin de territorios sube la foto de una tarjeta', assertSucceeds(st(S.terr).ref('congregations/C/territorios/t1.jpg').put(img, { contentType: 'image/jpeg' })));
  await check('un Admin técnico NO sube fotos de territorios', assertFails(st(S.tec).ref('congregations/C/territorios/t2.jpg').put(img, { contentType: 'image/jpeg' })));
  await check('las copias de seguridad NO se leen desde la app (ni el Super Admin)', assertFails(st(S.super).ref('backups/C/2026-09-27_0330-auto.json').getMetadata()));
  await check('ni se escriben', assertFails(st(S.super).ref('backups/C/x.json').put(img, { contentType: 'application/json' })));

  await env.cleanup();
  console.log(`\n${ok} OK, ${bad} fallaron`);
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error('Error al correr las pruebas:', e.message); process.exitCode = 1; });
