/**
 * Función en la nube — Avisos push y recordatorios
 */
const { onDocumentUpdated, onDocumentDeleted, onDocumentUpdatedWithAuthContext, onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

const REGION = 'southamerica-east1';
const { roleLabel, collectNewlyAssignedIds, avisoPreview, selectNewAvisos, notificationForNewAvisos, validateReminder, reminderDocId, ROLES_MAP,
  arParts, addDaysIso, remindersDue, reminderMessage, sentReminderId, roleAreasFor, disallowedWeekChanges, guardSummary, accessRequestMessage,
  conductorAssignments, newConductors, conductorMessage, newTerritoryAssignments,
  BACKUP_SUBS, ALL_SUBS, backupName, parseBackupName, buildBackup, backupsToPrune, restorePlan, isRestoreWrite,
  salonAssignments, newSalonAssignments, salonAssignMessage, anotadoMessage, resumenSemanal, newPublished, publishedMessage,
  fichaCambio, fichaMessage, comiteIds,
  occComite, puedeFichaExt, fichaDeExt, extVoluntario, extBuscar, estadoInvitacion, lugaresInvitacion, occVoluntario, proyeccionExterno, datosInvitado } = require('./lib');
const crypto = require('crypto');
const SalonCore = require('./salon-core');

// La app vive en GitHub Pages bajo /asignaciones-salon/, no en la raíz del
// dominio: un link o ícono con "/" apunta a hugoescalda21.github.io/ y no a la app.
const APP_BASE = 'https://hugoescalda21.github.io/asignaciones-salon/';
function verLink(code, tab) {
  let url = APP_BASE + 'ver/ver.html' + (code ? '?codigo=' + encodeURIComponent(code) : '');
  if (tab) url += (code ? '&' : '?') + 'tab=' + encodeURIComponent(tab);   // abre directo en esa pestaña: inicio | calendario | anuncios | salon (Mantenimiento)
  return url;
}
const BADGE_URL = APP_BASE + 'badge-icon.png';

// Deja anotado en el registro del celular cómo salió el último envío, para que el
// Super Admin pueda ver en la app qué dispositivos reciben bien los avisos.
const STALE_CODES = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];
function markSent(token, kind) {
  return db.collection('pushSubscriptions').doc(token)
    .update({ lastOkAt: new Date().toISOString(), lastKind: kind || '', lastErr: admin.firestore.FieldValue.delete(), lastErrAt: admin.firestore.FieldValue.delete() })
    .catch(() => { /* el registro ya no existe */ });
}
function markFailed(token, err, kind) {
  if (err && STALE_CODES.includes(err.code)) return Promise.resolve();   // ese registro se borra aparte
  return db.collection('pushSubscriptions').doc(token)
    .update({ lastErrAt: new Date().toISOString(), lastKind: kind || '', lastErr: String((err && (err.code || err.message)) || err).slice(0, 200) })
    .catch(() => { /* el registro ya no existe */ });
}

// Avisos nuevos (tablero de anuncios): llegan a TODOS los dispositivos suscriptos
// de la congregación, solo si quien lo publicó dejó marcado "Avisar por notificación".
async function notifyNewAvisos(code, before, after) {
  const nuevos = selectNewAvisos(before, after, Date.now());
  if (nuevos.length === 0) return;
  console.log('[push] avisos nuevos con notificación:', nuevos.length);

  const tokensAll = await db.collection('pushSubscriptions').where('code', '==', code).get();
  // Los voluntarios de otra congregación ("x:…") solo reciben avisos del Salón, no los anuncios.
  const tokensSnap = { docs: tokensAll.docs.filter((d) => !String(d.data().pubId || '').startsWith('x:')) };
  tokensSnap.size = tokensSnap.docs.length; tokensSnap.empty = !tokensSnap.size;
  console.log('[push] avisos: celulares suscriptos en la congregación:', tokensSnap.size);
  if (tokensSnap.empty) return;

  const first = nuevos[0];
  const { title, body } = notificationForNewAvisos(nuevos);

  const staleTokens = [];
  const sends = tokensSnap.docs.map((doc) => messaging.send({
    token: doc.id,
    notification: { title, body },
    android: { priority: 'high' },
    webpush: {
      headers: { Urgency: 'high', TTL: '86400' },
      fcmOptions: { link: verLink(code, 'anuncios') },
      notification: {
        badge: BADGE_URL,
        vibrate: [200, 100, 200],
        tag: `aviso-${first.id}`
      }
    }
  }).then(() => {
    console.log('[push] aviso enviado OK al celular', String(doc.id).slice(0, 12) + '…');
    return markSent(doc.id, 'anuncio');
  }).catch((err) => {
    console.error('ERROR ENVIANDO PUSH DE AVISO:', err && err.code, err && err.message);
    markFailed(doc.id, err, 'anuncio');
    if (err && (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token')) {
      staleTokens.push(doc.id);
    }
  }));
  await Promise.allSettled(sends);
  if (staleTokens.length) {
    await Promise.allSettled(staleTokens.map((t) => db.collection('pushSubscriptions').doc(t).delete()));
  }
}

exports.onCongregationWrite = onDocumentUpdated({ document: 'congregations/{code}', region: REGION }, async (event) => {
  const code = event.params.code;
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};
  const beforeWeeks = before.weeks || {};
  const afterWeeks = after.weeks || {};
  console.log('[push] guardado en la congregación', code);
  // Un guardado que es solo la corrección de guardRoles (deshacer un cambio que no
  // correspondía) no tiene que avisarle a nadie de nada.
  if (after._guard && (!before._guard || after._guard.at !== before._guard.at)) {
    console.log('[push] es una corrección de permisos: no se avisa a nadie');
    return null;
  }
  // Restaurar una copia de seguridad tampoco avisa a nadie.
  if (isRestoreWrite(before, after)) { console.log('[push] es una restauración: no se avisa a nadie'); return null; }
  try { await notifyNewAvisos(code, before, after); }
  catch (e) { console.error('[push] error avisando de un aviso nuevo:', e && e.message); }

  const newlyAssigned = {}; 
  Object.keys(afterWeeks).forEach((monday) => {
    ['semana', 'finde'].forEach((type) => {
      const beforeWeek = (beforeWeeks[monday] || {})[type];
      const afterWeek = (afterWeeks[monday] || {})[type];
      if (!afterWeek) return;
      const assignments = collectNewlyAssignedIds(beforeWeek, afterWeek, type, monday);
      Object.keys(assignments).forEach(pubId => {
        if (!newlyAssigned[pubId]) newlyAssigned[pubId] = [];
        newlyAssigned[pubId].push(...assignments[pubId]);
      });
    });
  });

  const resumen = {};
  Object.keys(newlyAssigned).forEach((id) => { resumen[id] = newlyAssigned[id].map((a) => a.label); });
  if (Object.keys(newlyAssigned).length === 0) {
    console.log('[push] este guardado no trae asignaciones nuevas: no se avisa a nadie');
    return null;
  }
  console.log('[push] asignaciones nuevas detectadas:', JSON.stringify(resumen));

  const tokensSnap = await db.collection('pushSubscriptions').where('code', '==', code).get();
  console.log('[push] celulares suscriptos en la congregación:', tokensSnap.size,
    JSON.stringify(tokensSnap.docs.map((d) => d.data().pubId)));
  if (tokensSnap.empty) return null;

  const tokensByPub = {};
  tokensSnap.forEach((doc) => {
    const data = doc.data();
    if (!newlyAssigned[data.pubId]) return;
    (tokensByPub[data.pubId] = tokensByPub[data.pubId] || []).push(doc.id);
  });

  console.log('[push] celulares que coinciden con quienes recibieron asignación:', JSON.stringify(Object.keys(tokensByPub).map((id) => [id, tokensByPub[id].length])));
  if (Object.keys(tokensByPub).length === 0) {
    console.log('[push] ninguno de los asignados tiene celular suscripto (el pubId no coincide)');
  }

  const publishers = after.publishers || [];
  const getPubName = (pubId) => {
    const pub = publishers.find(p => p.id === pubId);
    if (!pub || !pub.name) return '';
    return pub.name.split(' ')[0];
  };

  const staleTokens = [];
  const sendPromises = [];

  Object.keys(tokensByPub).forEach((pubId) => {
    const name = getPubName(pubId);
    const greeting = name ? `Hola ${name}, ` : '';
    const assignments = newlyAssigned[pubId];
    
    let title = '';
    let body = '';
    let meetingDateIso = '';
    
    if (assignments.length === 1) {
      const assig = assignments[0];
      title = `${greeting}tienes una asignación: ${assig.label}`;
      
      const settings = after.settings || {};
      const weekday = assig.meetingType === 'semana' ? (settings.weekdaySemana || 4) : (settings.weekdayFinde || 7);
      const meetingDate = new Date(assig.monday);
      meetingDate.setDate(meetingDate.getDate() + (weekday - 1));
      meetingDateIso = meetingDate.toISOString();
      
      const typeStr = assig.meetingType === 'semana' ? 'Entre semana' : 'Fin de semana';
      const dateStr = meetingDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
      body = `Reunión de ${typeStr} (${dateStr}).`;
    } else {
      title = `${greeting}tienes ${assignments.length} nuevas asignaciones`;
      const assigTypes = [...new Set(assignments.map(a => a.label))].slice(0, 2);
      body = assigTypes.join(' y ') + (assignments.length > 2 ? ' y más...' : '.');
      
      const settings = after.settings || {};
      const assig = assignments[0];
      const weekday = assig.meetingType === 'semana' ? (settings.weekdaySemana || 4) : (settings.weekdayFinde || 7);
      const meetingDate = new Date(assig.monday);
      meetingDate.setDate(meetingDate.getDate() + (weekday - 1));
      meetingDateIso = meetingDate.toISOString();
    }

    tokensByPub[pubId].forEach((token) => {
      const promise = messaging.send({
        token,
        notification: {
          title: title,
          body: body
        },
        android: { priority: 'high' },
        webpush: {
          headers: { Urgency: 'high' },
          fcmOptions: { link: verLink(code) },
          notification: {
            badge: BADGE_URL,
            vibrate: [200, 100, 200, 100, 200, 100, 200],
            requireInteraction: true,
            tag: `asignacion-${Date.now()}`
            // Ya no lleva los botones "Recordar 1/3 días antes": los recordatorios
            // ahora se eligen una sola vez en la app (ver sendScheduledReminders).
          }
        }
      }).then((resp) => {
        if (resp) console.log('[push] enviado OK al celular', String(token).slice(0, 12) + '…', 'a', pubId);
        return markSent(token, 'asignacion');
      }).catch((err) => {
        console.error('ERROR ENVIANDO PUSH:', err && err.code, err && err.message);
        markFailed(token, err, 'asignacion');
        if (err && (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token')) {
          staleTokens.push(token);
        }
      });
      sendPromises.push(promise);
    });
  });

  await Promise.allSettled(sendPromises);

  if (staleTokens.length) {
    await Promise.allSettled(staleTokens.map((t) => db.collection('pushSubscriptions').doc(t).delete()));
  }

  return null;
});

// Solo deja rastro en el registro: avisa cuándo se borra el registro de un celular
// (y de quién era), para poder averiguar qué lo está borrando.
/* ---------- Control de permisos por rol ----------
   Las reglas de Firestore dejan a un Admin cambiar solo "weeks" (y "anuncios" si tiene
   el permiso), pero no pueden mirar más adentro. Esta función revisa cada guardado:
   si un Admin de Equipo técnico cambió el Programa (o al revés), lo deshace al instante
   y lo anota en el Registro de errores para que el Super Admin lo vea.
   Quien guardó llega en authId (el uid de Firebase Auth); de ahí se saca el email. */
exports.guardRoles = onDocumentUpdatedWithAuthContext({ document: 'congregations/{code}', region: REGION }, async (event) => {
  const code = event.params.code;
  if (!event.authId || event.authType === 'service_account' || event.authType === 'system') return null;
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};
  let email = null;
  try { email = (await admin.auth().getUser(event.authId)).email || null; }
  catch (e) { console.log('[permisos] no se pudo identificar a quien guardó:', event.authType, e && e.message); return null; }
  const areas = roleAreasFor(before.settings, email);
  const changes = disallowedWeekChanges(before.weeks, after.weeks, areas);
  if (!changes.length) return null;
  const now = new Date().toISOString();
  const args = [];
  changes.forEach((c) => {
    args.push(new admin.firestore.FieldPath('weeks', ...c.path), c.before === undefined ? admin.firestore.FieldValue.delete() : c.before);
  });
  args.push('_guard', { at: now, by: email, n: changes.length });
  const msg = guardSummary(email, changes);
  console.warn('[permisos]', code, msg);
  try { await db.collection('congregations').doc(code).update(...args); }
  catch (e) { console.error('[permisos] no se pudo deshacer:', e && e.message); }
  try {
    await db.collection('congregations').doc(code).collection('errores').add({
      at: now, app: 'servidor', kind: 'permiso', msg: msg.slice(0, 500),
      where: changes.slice(0, 20).map(c => c.path.join(' › ')).join('\n').slice(0, 1000),
      role: (areas || []).join(', ') || 'sin rol de admin', device: '', online: true
    });
  } catch (e) { console.error('[permisos] no se pudo anotar en el registro:', e && e.message); }
  return null;
});

/* ---------- Aviso al Super Admin: alguien pidió acceso ----------
   Les llega a los celulares con avisos activados de los hermanos cuyo email está en
   editorEmails. Tocándolo se abre la app de asignaciones en Ajustes → Acceso. */
exports.onAccessRequest = onDocumentCreated({ document: 'congregations/{code}/solicitudes/{uid}', region: REGION }, async (event) => {
  const code = event.params.code;
  const req = event.data && event.data.data();
  if (!req) return null;
  const cong = (await db.collection('congregations').doc(code).get()).data() || {};
  const supers = ((cong.settings || {}).editorEmails || []).map(e => String(e).toLowerCase());
  const pubIds = (cong.publishers || []).filter(p => p.email && supers.includes(String(p.email).toLowerCase())).map(p => p.id);
  if (!pubIds.length) { console.log('[solicitud] ningún Super Admin vinculado a un hermano: no se avisa'); return null; }
  let pending = 1;
  try { pending = (await db.collection('congregations').doc(code).collection('solicitudes').where('status', '==', 'pendiente').get()).size || 1; } catch (e) { /* nada */ }
  const tokensSnap = await db.collection('pushSubscriptions').where('code', '==', code).get();
  const tokens = tokensSnap.docs.filter(d => pubIds.includes(d.data().pubId)).map(d => d.id);
  console.log('[solicitud] nueva de', req.name, '· pendientes:', pending, '· celulares de Super Admin:', tokens.length);
  if (!tokens.length) return null;
  const { title, body } = accessRequestMessage(req.name, pending);
  await Promise.allSettled(tokens.map((token) => messaging.send({
    token,
    notification: { title, body },
    android: { priority: 'high' },
    webpush: {
      headers: { Urgency: 'high', TTL: '86400' },
      fcmOptions: { link: APP_BASE + 'asignaciones-salon.html#solicitudes' },
      notification: { badge: BADGE_URL, tag: 'solicitudes-' + code, renotify: true }
    }
  }).then(() => markSent(token, 'solicitud')).catch((err) => {
    console.error('[solicitud] error enviando:', err && err.code, err && err.message);
    markFailed(token, err, 'solicitud');
    if (err && STALE_CODES.includes(err.code)) return db.collection('pushSubscriptions').doc(token).delete().catch(() => {});
  })));
  return null;
});

/* ---------- Avisos de salidas y territorios ---------- */
// Manda un aviso a todos los celulares de esos hermanos.
async function sendToPubs(code, pubIds, msg, link, kind, tag) {
  const ids = [...new Set(pubIds.filter(Boolean))];
  if (!ids.length) return 0;
  const snap = await db.collection('pushSubscriptions').where('code', '==', code).get();
  const tokens = snap.docs.filter((d) => ids.includes(d.data().pubId)).map((d) => d.id);
  await Promise.allSettled(tokens.map((token) => messaging.send({
    token, notification: msg, android: { priority: 'high' },
    webpush: { headers: { Urgency: 'high', TTL: '86400' }, fcmOptions: { link }, notification: { badge: BADGE_URL, vibrate: [200, 100, 200], tag } }
  }).then(() => markSent(token, kind)).catch((err) => {
    console.error('[' + kind + '] error enviando:', err && err.code, err && err.message);
    markFailed(token, err, kind);
    if (err && STALE_CODES.includes(err.code)) return db.collection('pushSubscriptions').doc(token).delete().catch(() => {});
  })));
  return tokens.length;
}
const firstName = (cong, pubId) => { const p = ((cong && cong.publishers) || []).find((x) => x.id === pubId); return p && p.name ? p.name.split(' ')[0] : ''; };

// Conductor nuevo en una salida → le avisa ("Hola Martín, conducís la salida del martes 7").
exports.onSalidasWrite = onDocumentWritten({ document: 'congregations/{code}/salidas/{gid}', region: REGION }, async (event) => {
  const code = event.params.code;
  const before = event.data.before.exists ? event.data.before.data() : {};
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!after || isRestoreWrite(before, after)) return null;
  const { dateIso: hoyIso } = arParts(new Date());
  const nuevos = newConductors(before, after, hoyIso, 56);
  if (!nuevos.length) return null;
  const ref = db.collection('congregations').doc(code);
  const [congSnap, lugSnap] = await Promise.all([ref.get(), ref.collection('terr').doc('lugares').get()]);
  const cong = congSnap.data() || {};
  const lugares = (lugSnap.exists && lugSnap.data().lista) || {};
  for (const a of nuevos) {
    const msg = conductorMessage(a, firstName(cong, a.pubId), lugares[a.lugar] ? lugares[a.lugar].nombre : '');
    const n = await sendToPubs(code, [a.pubId], msg, verLink(code), 'asignacion', `salida-${a.id}-${a.dateIso}`);
    console.log('[salidas] conductor nuevo', a.pubId, a.dateIso, '· celulares:', n);
  }
  return null;
});

// Territorio asignado → aviso al hermano (o al encargado y auxiliar del grupo).
exports.onTerritoriosWrite = onDocumentWritten({ document: 'congregations/{code}/terr/{docId}', region: REGION }, async (event) => {
  if (event.params.docId !== 'territorios') return null;
  if (isRestoreWrite(event.data.before.exists ? event.data.before.data() : {}, event.data.after.exists ? event.data.after.data() : null)) return null;
  const code = event.params.code;
  const before = event.data.before.exists ? (event.data.before.data().lista || {}) : {};
  const after = event.data.after.exists ? (event.data.after.data().lista || {}) : {};
  const nuevos = newTerritoryAssignments(before, after);
  if (!nuevos.length) return null;
  const ref = db.collection('congregations').doc(code);
  const [congSnap, grSnap] = await Promise.all([ref.get(), ref.collection('terr').doc('grupos').get()]);
  const cong = congSnap.data() || {};
  const grupos = (grSnap.exists && grSnap.data().lista) || {};
  for (const t of nuevos) {
    const nombre = `${t.num}${t.nombre ? ' · ' + t.nombre : ''}`;
    if (t.tipo === 'grupo') {
      const g = grupos[t.to] || {};
      await sendToPubs(code, [g.encargado, g.auxiliar], { title: `${g.nombre || 'Tu grupo'} tiene un territorio nuevo`, body: `Territorio ${nombre}` }, verLink(code, 'territorios'), 'asignacion', `territorio-${t.id}`);
    } else {
      const fn = firstName(cong, t.to);
      await sendToPubs(code, [t.to], { title: `${fn ? 'Hola ' + fn + ', te' : 'Te'} asignaron un territorio`, body: `Territorio ${nombre}` }, verLink(code, 'territorios'), 'asignacion', `territorio-${t.id}`);
    }
  }
  return null;
});

// Salón: responsable, auxiliar o voluntario agregado a mano → aviso a ese hermano.
exports.onSalonWrite = onDocumentWritten({ document: 'congregations/{code}/salon/{docId}', region: REGION }, async (event) => {
  if (event.params.docId !== 'trabajos') return null;
  const beforeDoc = event.data.before.exists ? event.data.before.data() : {};
  const afterDoc = event.data.after.exists ? event.data.after.data() : null;
  if (!afterDoc || isRestoreWrite(beforeDoc, afterDoc)) return null;
  const code = event.params.code;
  const { dateIso: hoyIso } = arParts(new Date());
  const nuevos = newSalonAssignments(beforeDoc.lista || {}, afterDoc.lista || {}, hoyIso);
  const publicados = newPublished(beforeDoc.lista || {}, afterDoc.lista || {}, hoyIso);
  if (!nuevos.length && !publicados.length) return null;
  const [cs, xs] = await Promise.all([db.collection('congregations').doc(code).get(), db.collection('congregations').doc(code).collection('salon').doc('externos').get()]);
  const cong = cs.data() || {};
  const vols = Object.values((xs.exists && xs.data().lista) || {}).filter((x) => x && x.id && (x.vol || x.comite) && x.email).map((x) => 'x:' + x.id);
  for (const a of nuevos) {
    const n = await sendToPubs(code, [a.pubId], salonAssignMessage(a, firstName(cong, a.pubId)), verLink(code, 'salon'), 'asignacion', `salon-${a.t.id}-${a.fecha}-${a.rol}`);
    console.log('[salón]', a.rol, a.pubId, a.fecha, '· celulares:', n);
  }
  // Publicado en la vista y pide voluntarios → aviso a todos (menos el responsable y el auxiliar, que ya saben).
  for (const p of publicados) {
    const ids = ((cong.publishers) || []).filter((x) => x.status !== 'inactivo' && x.id !== p.t.resp && x.id !== p.t.aux).map((x) => x.id)
      .concat(vols.filter((id) => id !== p.t.resp && id !== p.t.aux));   // y los voluntarios del salón de otra congregación
    const n = await sendToPubs(code, ids, publishedMessage(p), verLink(code, 'salon'), 'aviso', `salon-pub-${p.t.id}-${p.fecha}`);
    console.log('[salón] publicado', p.t.id, p.fecha, '· celulares:', n);
  }
  return null;
});

// Ficha completada desde el celular (vista) → aviso al comité de mantenimiento cuando empieza y cuando termina.
exports.onSalonFicha = onDocumentWritten({ document: 'congregations/{code}/salonFichas/{fid}', region: REGION }, async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!after || after._restoredAt || isRestoreWrite(before || {}, after)) return null;
  const kind = fichaCambio(before, after);
  if (!kind) return null;
  const code = event.params.code;
  const ref = db.collection('congregations').doc(code);
  const [cs, ts, xs] = await Promise.all([ref.get(), ref.collection('salon').doc('trabajos').get(), ref.collection('salon').doc('externos').get()]);
  const cong = cs.data() || {};
  const t = ((ts.exists && ts.data().lista) || {})[after.tid];
  const ids = comiteIds(cong, after.pubId, (xs.exists && xs.data().lista) || {});
  const n = await sendToPubs(code, ids, fichaMessage(kind, after, t), APP_BASE + 'asignaciones-salon.html', 'aviso', `ficha-${event.params.fid}-${kind}`);
  console.log('[ficha]', kind, event.params.fid, '· celulares:', n);
  return null;
});

// "Me sumo" o "Ya no puedo ir" desde la vista → aviso al responsable y al auxiliar del trabajo.
exports.onSalonAnotado = onDocumentWritten({ document: 'congregations/{code}/salonAnotados/{aid}', region: REGION }, async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (before && after) return null;   // solo cambió el comentario
  const r = after || before;
  if (!r || r._restoredAt || (after && isRestoreWrite(before || {}, after))) return null;
  const code = event.params.code;
  const ref = db.collection('congregations').doc(code);
  const [trSnap, anSnap] = await Promise.all([ref.collection('salon').doc('trabajos').get(), ref.collection('salonAnotados').where('tid', '==', r.tid).get()]);
  const t = ((trSnap.exists && trSnap.data().lista) || {})[r.tid];
  if (!t) return null;
  const anotados = {}; anSnap.forEach((d) => { anotados[d.id] = d.data(); });
  const ci = SalonCore.cupoInfo(t, r.fecha, anotados);
  // Si se anotó un hermano de otra congregación (con la invitación o como voluntario), también se entera el comité.
  let ids = [t.resp, t.aux];
  if (String(r.pubId || '').startsWith('x:')) {
    const [cs, xs] = await Promise.all([ref.get(), ref.collection('salon').doc('externos').get()]);
    ids = ids.concat(comiteIds(cs.data() || {}, null, (xs.exists && xs.data().lista) || {}));
  }
  await sendToPubs(code, ids.filter(pid => pid !== r.pubId), anotadoMessage(r, t, !!after, ci.van, ci.cupo), APP_BASE + 'asignaciones-salon.html', 'aviso', `anotado-${event.params.aid}`);
  return null;
});

// "Lo terminé" desde la vista → aviso al Super Admin y a los Admin de Territorios.
exports.onTerminado = onDocumentCreated({ document: 'congregations/{code}/terminados/{tid}', region: REGION }, async (event) => {
  const code = event.params.code;
  const r = event.data && event.data.data();
  if (!r || r._restoredAt) return null;
  const ref = db.collection('congregations').doc(code);
  const [congSnap, terSnap] = await Promise.all([ref.get(), ref.collection('terr').doc('territorios').get()]);
  const cong = congSnap.data() || {};
  const s = cong.settings || {};
  const gestores = [...(s.editorEmails || []), ...(s.territoriosAdminEmails || [])].map((e) => String(e).toLowerCase());
  const pubIds = (cong.publishers || []).filter((p) => p.email && gestores.includes(String(p.email).toLowerCase())).map((p) => p.id);
  const t = ((terSnap.exists && terSnap.data().lista) || {})[event.params.tid] || {};
  await sendToPubs(code, pubIds, { title: `${r.nombre || 'Un hermano'} terminó el territorio ${t.num || ''}`.trim(), body: 'Tocá para confirmarlo en Territorios.' }, APP_BASE + 'asignaciones-salon.html#terminados', 'aviso', `terminado-${event.params.tid}`);
  return null;
});

exports.onPushSubscriptionDeleted = onDocumentDeleted({ document: 'pushSubscriptions/{token}', region: REGION }, (event) => {
  const d = (event.data && event.data.data()) || {};
  console.log('[push] SUSCRIPCIÓN BORRADA:', String(event.params.token).slice(0, 12) + '…',
    'pubId=' + d.pubId, 'code=' + d.code, 'creada=' + d.createdAt);
  return null;
});

// Llamada desde el service worker cuando alguien toca "Recordar 1/3 días antes" en una notificación.
// No hay sesión iniciada en ese contexto, así que la comprobación es: (1) el pedido viene del sitio de
// la app, (2) los datos tienen el formato esperado, y (3) el token del celular ya está registrado en
// pushSubscriptions con el mismo código y publicador (solo el propio celular conoce su token).
exports.saveReminder = onRequest({ cors: ['https://hugoescalda21.github.io'], region: REGION, maxInstances: 5 }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
  try {
    const body = req.body || {};
    let payload;
    try { payload = JSON.parse(body.payloadStr); } catch (e) { res.status(400).send({ error: 'Datos no válidos' }); return; }

    const v = validateReminder(body.action, payload, new Date());
    if (!v.ok) { res.status(400).send({ error: v.error }); return; }
    const r = v.value;

    const sub = await db.collection('pushSubscriptions').doc(r.token).get();
    const s = sub.exists ? sub.data() : null;
    if (!s || s.code !== r.code || s.pubId !== r.pubId) { res.status(403).send({ error: 'Dispositivo no registrado' }); return; }

    await db.collection('reminders').doc(reminderDocId(r.token, r.meetingDateIso, r.daysBefore)).set({
      code: r.code,
      pubId: r.pubId,
      token: r.token,
      remindAt: r.remindAtIso,
      meetingDateIso: r.meetingDateIso,
      createdAt: new Date().toISOString()
    });

    res.status(200).send({ success: true });
  } catch (err) {
    console.error('[reminder] error:', err && err.message);
    res.status(500).send({ error: 'Error interno' });
  }
});

exports.sendDailyReminders = onSchedule({ schedule: '0 8 * * *', timeZone: 'America/Argentina/Buenos_Aires', region: REGION }, async (event) => {
  const now = new Date();
  const todayIso = now.toISOString();

  const remindersSnap = await db.collection('reminders').where('remindAt', '<=', todayIso).get();
  if (remindersSnap.empty) return;

  const sendPromises = [];
  const deletePromises = [];

  remindersSnap.forEach(doc => {
    const data = doc.data();
    deletePromises.push(doc.ref.delete());

    const meetingDate = new Date(data.meetingDateIso);
    const diffTime = Math.abs(meetingDate - now);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const timeStr = diffDays <= 1 ? 'mañana' : `en ${diffDays} días`;

    const promise = messaging.send({
      token: data.token,
      notification: {
        title: `¡Recordatorio de Asignación!`,
        body: `Recuerda que tienes una asignación ${timeStr}. Revisa la app para más detalles.`
      },
      android: { priority: 'high' },
      webpush: {
        headers: { Urgency: 'high' },
        fcmOptions: { link: verLink(data.code) },
        notification: {
          badge: BADGE_URL,
          vibrate: [200, 100, 200, 100, 200, 100, 200],
          requireInteraction: true,
          tag: 'recordatorio-asignacion'
        }
      }
    }).catch(err => {
      if (err && (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token')) {
        db.collection('pushSubscriptions').doc(data.token).delete();
      }
    });
    sendPromises.push(promise);
  });

  await Promise.allSettled(sendPromises);
  await Promise.allSettled(deletePromises);
});


// Recordatorios automáticos. Corre cada media hora y, para cada celular
// suscripto, calcula con los datos ACTUALES si le toca un aviso en esta franja:
// el día anterior (20:00), el mismo día a la mañana (8:00) o unas horas antes
// de la reunión (si el editor cargó el horario). Cada hermano elige cuáles en
// la vista pública; sin elegir nada recibe solo el del día anterior.
// Cada aviso enviado queda anotado en sentReminders para no repetirlo.
exports.sendScheduledReminders = onSchedule({ schedule: '0,30 * * * *', timeZone: 'America/Argentina/Buenos_Aires', region: REGION }, async () => {
  const SLOT_MS = 30 * 60000;
  const slot = new Date(Math.round(Date.now() / SLOT_MS) * SLOT_MS);   // tolera que el disparo llegue unos segundos antes o después

  const subsSnap = await db.collection('pushSubscriptions').get();
  const congCache = {};
  const getCong = async (code) => {
    if (!(code in congCache)) {
      const snap = await db.collection('congregations').doc(code).get();
      congCache[code] = snap.exists ? snap.data() : null;
      if (congCache[code]) {
        // Las salidas que conduce cada hermano (hoy y mañana) también tienen recordatorio.
        try {
          const ref = db.collection('congregations').doc(code);
          const [sal, lug] = await Promise.all([ref.collection('salidas').get(), ref.collection('terr').doc('lugares').get()]);
          const docs = {}; sal.forEach((d) => { docs[d.id] = d.data(); });
          const lugares = (lug.exists && lug.data().lista) || {};
          const { dateIso: hoyIso } = arParts(new Date());
          congCache[code].__salidas = conductorAssignments(docs, hoyIso, addDaysIso(hoyIso, 2))
            .map((a) => Object.assign(a, { lugarName: lugares[a.lugar] ? lugares[a.lugar].nombre : '' }));
        } catch (e) { console.warn('[recordatorio] salidas', code, e && e.message); }
        // Y los trabajos del Salón (responsable, auxiliar, voluntarios) y la limpieza del grupo.
        try {
          const ref = db.collection('congregations').doc(code);
          const [tr, lz, an, gr, xs] = await Promise.all([ref.collection('salon').doc('trabajos').get(), ref.collection('salon').doc('limpieza').get(), ref.collection('salonAnotados').get(), ref.collection('terr').doc('grupos').get(), ref.collection('salon').doc('externos').get()]);
          const anotados = {}; an.forEach((d) => { anotados[d.id] = d.data(); });
          const { dateIso: hoyIso } = arParts(new Date());
          congCache[code].__salon = salonAssignments(congCache[code], (tr.exists && tr.data().lista) || {}, anotados, lz.exists ? lz.data() : {}, (gr.exists && gr.data().lista) || {}, hoyIso, addDaysIso(hoyIso, 2), (xs.exists && xs.data().lista) || {});
        } catch (e) { console.warn('[recordatorio] salón', code, e && e.message); }
      }
    }
    return congCache[code];
  };

  const staleTokens = [];
  const sends = [];
  let enviados = 0;
  for (const doc of subsSnap.docs) {
    const sub = doc.data();
    if (!sub.code || !sub.pubId) continue;
    const cong = await getCong(sub.code);
    if (!cong) continue;
    const token = doc.id;
    for (const due of remindersDue(cong, sub, slot)) {
      const markRef = db.collection('sentReminders').doc(sentReminderId(token, due.kind, due.dateIso));
      try {
        await markRef.create({ token, kind: due.kind, dateIso: due.dateIso, pubId: sub.pubId, code: sub.code, sentAt: new Date().toISOString() });
      } catch (e) {
        continue;   // ya se había mandado este mismo aviso
      }
      const { title, body } = reminderMessage(due);
      sends.push(messaging.send({
        token,
        notification: { title, body },
        android: { priority: 'high' },
        webpush: {
          headers: { Urgency: 'high', TTL: '10800' },
          // Si todo lo que se recuerda es de mantenimiento (limpieza o trabajos), abre esa pestaña.
          fcmOptions: { link: verLink(sub.code, due.items.every((i) => i.type === 'salon') ? 'salon' : undefined) },
          notification: { badge: BADGE_URL, vibrate: [200, 100, 200], tag: `recordatorio-${due.dateIso}-${due.kind}` }
        }
      }).then(() => { enviados++; return markSent(token, 'recordatorio'); }).catch((err) => {
        console.error('[recordatorio] error enviando:', err && err.code, err && err.message);
        markFailed(token, err, 'recordatorio');
        if (err && (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token')) {
          staleTokens.push(token);
        }
      }));
    }
  }
  await Promise.allSettled(sends);
  if (staleTokens.length) {
    await Promise.allSettled([...new Set(staleTokens)].map((t) => db.collection('pushSubscriptions').doc(t).delete()));
  }
  if (sends.length) console.log('[recordatorio] franja', slot.toISOString(), '— enviados:', enviados, 'de', sends.length);

  // Limpieza una vez por día (franja de las 3:00): borra las marcas de avisos viejos.
  const { dateIso: today, minutes } = arParts(slot);
  if (minutes === 3 * 60) {
    const old = await db.collection('sentReminders').where('dateIso', '<', addDaysIso(today, -3)).limit(400).get();
    await Promise.allSettled(old.docs.map((d) => d.ref.delete()));
  }
});


// ---------------------------------------------------------------------------
// Dispositivos con notificaciones (Ajustes → Notificaciones de los hermanos).
// Solo para Super Admin de la congregación. Acciones:
//   list   → los celulares registrados, de quién son y cómo salió el último aviso
//   test   → manda una notificación de prueba a un celular
//   remove → borra el registro de un celular (por ejemplo, uno viejo o repetido)
// La app manda el token de sesión de Firebase (Authorization: Bearer ...).
exports.devices = onRequest({ cors: ['https://hugoescalda21.github.io'], region: REGION, maxInstances: 5 }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send({ error: 'Método no permitido' }); return; }
  try {
    const m = String(req.get('Authorization') || '').match(/^Bearer (.+)$/);
    if (!m) { res.status(401).send({ error: 'Falta iniciar sesión' }); return; }
    let decoded;
    try { decoded = await admin.auth().verifyIdToken(m[1]); } catch (e) { res.status(401).send({ error: 'Sesión vencida' }); return; }
    const email = String(decoded.email || '').toLowerCase();
    const body = req.body || {};
    const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code || !email) { res.status(400).send({ error: 'Datos no válidos' }); return; }
    const cong = await db.collection('congregations').doc(code).get();
    const editors = ((cong.exists && cong.data().settings) || {}).editorEmails || [];
    if (!editors.map((e) => String(e).toLowerCase()).includes(email)) { res.status(403).send({ error: 'Solo para Super Admin' }); return; }

    if (body.action === 'list') {
      const snap = await db.collection('pushSubscriptions').where('code', '==', code).get();
      const devices = snap.docs.map((d) => {
        const x = d.data();
        return { id: d.id, pubId: x.pubId || '', createdAt: x.createdAt || '', updatedAt: x.updatedAt || '', device: x.device || '',
          lastOkAt: x.lastOkAt || '', lastErrAt: x.lastErrAt || '', lastErr: x.lastErr || '', lastKind: x.lastKind || '', reminderPrefs: x.reminderPrefs || null };
      });
      res.status(200).send({ devices });
      return;
    }

    const token = String(body.token || '');
    if (!token) { res.status(400).send({ error: 'Falta el dispositivo' }); return; }
    const sub = await db.collection('pushSubscriptions').doc(token).get();
    if (!sub.exists || sub.data().code !== code) { res.status(404).send({ error: 'Ese dispositivo ya no está registrado' }); return; }

    if (body.action === 'remove') {
      await sub.ref.delete();
      res.status(200).send({ ok: true });
      return;
    }
    if (body.action === 'test') {
      const pubs = ((cong.data() || {}).publishers) || [];
      const pub = pubs.find((p) => p.id === sub.data().pubId);
      const first = pub && pub.name ? pub.name.split(' ')[0] : '';
      try {
        await messaging.send({
          token,
          notification: { title: '🔔 Prueba de notificación', body: `${first ? first + ', si' : 'Si'} ves este aviso, las notificaciones de Asignaciones funcionan en este celular.` },
          android: { priority: 'high' },
          webpush: { headers: { Urgency: 'high', TTL: '600' }, fcmOptions: { link: verLink(code) }, notification: { badge: BADGE_URL, vibrate: [200, 100, 200], tag: 'prueba-' + Date.now() } }
        });
        await markSent(token, 'prueba');
        res.status(200).send({ ok: true });
      } catch (err) {
        const stale = err && STALE_CODES.includes(err.code);
        if (stale) await sub.ref.delete().catch(() => {});
        else await markFailed(token, err, 'prueba');
        res.status(200).send({ ok: false, error: (err && err.code) || String(err), removed: !!stale });
      }
      return;
    }
    res.status(400).send({ error: 'Acción desconocida' });
  } catch (err) {
    console.error('[devices] error:', err && err.message);
    res.status(500).send({ error: 'Error interno' });
  }
});

// Prueba desde la vista de la congregación ("Probar en este celular"): cualquier persona
// con acceso a la congregación puede mandarse una notificación de prueba a SU celular.
// Espera unos segundos antes de enviarla, para que la persona alcance a salir de la app
// (así se ve como un aviso normal del sistema y no como cartel dentro de la página).
exports.testMyDevice = onRequest({ cors: ['https://hugoescalda21.github.io'], region: REGION, maxInstances: 5, timeoutSeconds: 60 }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send({ error: 'Método no permitido' }); return; }
  try {
    const m = String(req.get('Authorization') || '').match(/^Bearer (.+)$/);
    if (!m) { res.status(401).send({ error: 'Falta iniciar sesión' }); return; }
    let decoded;
    try { decoded = await admin.auth().verifyIdToken(m[1]); } catch (e) { res.status(401).send({ error: 'Sesión vencida' }); return; }
    const email = String(decoded.email || '').toLowerCase();
    const body = req.body || {};
    const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const token = String(body.token || '');
    if (!code || !token || !email) { res.status(400).send({ error: 'Datos no válidos' }); return; }
    const cong = await db.collection('congregations').doc(code).get();
    const s = ((cong.exists && cong.data().settings) || {});
    const lists = ['editorEmails', 'tecnicoAdminEmails', 'acomodadoresAdminEmails', 'asignacionesAdminEmails', 'territoriosAdminEmails', 'anunciosOnlyEmails', 'viewerEmails'];
    if (!lists.some((k) => (s[k] || []).map((e) => String(e).toLowerCase()).includes(email))) { res.status(403).send({ error: 'Sin acceso a la congregación' }); return; }
    const sub = await db.collection('pushSubscriptions').doc(token).get();
    if (!sub.exists || sub.data().code !== code) { res.status(404).send({ error: 'Este celular no está registrado' }); return; }
    const delay = Math.min(15, Math.max(0, Number(body.delaySec) || 0));
    if (delay) await new Promise((r) => setTimeout(r, delay * 1000));
    try {
      await messaging.send({
        token,
        notification: { title: '🔔 Prueba 2 de 2', body: 'Si ves este aviso, las notificaciones de las asignaciones te llegan a este celular.' },
        android: { priority: 'high' },
        webpush: { headers: { Urgency: 'high', TTL: '600' }, fcmOptions: { link: verLink(code) }, notification: { badge: BADGE_URL, vibrate: [200, 100, 200], tag: 'prueba-' + Date.now() } }
      });
      await markSent(token, 'prueba');
      res.status(200).send({ ok: true });
    } catch (err) {
      const stale = err && STALE_CODES.includes(err.code);
      if (stale) await sub.ref.delete().catch(() => {});
      else await markFailed(token, err, 'prueba');
      res.status(200).send({ ok: false, error: (err && err.code) || String(err) });
    }
  } catch (err) {
    console.error('[testMyDevice] error:', err && err.message);
    res.status(500).send({ error: 'Error interno' });
  }
});

/* =====================================================================
   Copias de seguridad
   ---------------------------------------------------------------------
   Todos los domingos a la madrugada se guarda una copia de cada congregación
   (programa, hermanos, anuncios, ajustes, territorios, grupos, lugares, campañas
   y salidas) en Storage: backups/{código}/… Solo el servidor lee y escribe ahí.
   El Super Admin las ve, descarga y restaura desde Ajustes (función "backups").
   ===================================================================== */
async function snapshotCongregation(code) {
  const ref = db.collection('congregations').doc(code);
  const main = await ref.get();
  const subs = {};
  for (const c of ALL_SUBS) {
    const qs = await ref.collection(c).get();
    subs[c] = {};
    qs.forEach((d) => { subs[c][d.id] = d.data(); });
  }
  return { exists: main.exists, backup: buildBackup(code, main.exists ? main.data() : {}, subs, new Date()) };
}
async function saveBackup(code, kind) {
  const snap = await snapshotCongregation(code);
  if (!snap.exists) throw new Error('No existe la congregación');
  const name = backupName(code, new Date(), kind);
  const body = JSON.stringify(snap.backup);
  await admin.storage().bucket().file(name).save(body, { contentType: 'application/json', resumable: false, metadata: { cacheControl: 'no-store' } });
  return { name, size: Buffer.byteLength(body) };
}
async function listBackups(code) {
  const [files] = await admin.storage().bucket().getFiles({ prefix: `backups/${code}/` });
  return files.map((f) => Object.assign({ size: Number(f.metadata.size || 0) }, parseBackupName(f.name)))
    .filter((x) => x.file).sort((a, b) => b.file.localeCompare(a.file));
}
async function pruneBackups(code) {
  const [files] = await admin.storage().bucket().getFiles({ prefix: `backups/${code}/` });
  const del = backupsToPrune(files.map(f => f.name), arParts(new Date()).dateIso);
  for (const n of del) await admin.storage().bucket().file(n).delete().catch(() => {});
  return del.length;
}

// Resumen semanal: los lunes a las 7:50, al Super Admin, lo que hay para resolver esa semana (abre el Panel).
exports.weeklySummary = onSchedule({ schedule: '50 7 * * 1', timeZone: 'America/Argentina/Buenos_Aires', region: REGION, timeoutSeconds: 300 }, async () => {
  const { dateIso: hoyIso } = arParts(new Date());
  const qs = await db.collection('congregations').get();
  for (const d of qs.docs) {
    try {
      const cong = d.data() || {};
      const s = cong.settings || {};
      const supers = (s.editorEmails || []).map((e) => String(e).toLowerCase());
      const pubIds = (cong.publishers || []).filter((p) => p.email && supers.includes(String(p.email).toLowerCase())).map((p) => p.id);
      if (!pubIds.length) continue;
      const ref = d.ref;
      const [sol, ter, tr, lz, gr, an] = await Promise.all([
        ref.collection('solicitudes').where('status', '==', 'pendiente').get(), ref.collection('terminados').get(),
        ref.collection('salon').doc('trabajos').get(), ref.collection('salon').doc('limpieza').get(), ref.collection('terr').doc('grupos').get(), ref.collection('salonAnotados').get()]);
      const trabajos = (tr.exists && tr.data().lista) || {}, limpieza = lz.exists ? lz.data() : {}, grupos = (gr.exists && gr.data().lista) || {};
      const anotados = {}; an.forEach((x) => { anotados[x.id] = x.data(); });
      const occ = SalonCore.trabajosEntre(trabajos, hoyIso, SalonCore.addDays(hoyIso, 6)).filter((o) => !o.cancelada && o.estado !== 'hecho' && o.pub);
      const buscan = occ.filter((o) => { const ci = SalonCore.cupoInfo(o.t, o.fecha, anotados); return ci.cupo && !ci.completo; }).length;
      const quien = SalonCore.limpiezasSemana(limpieza, SalonCore.mondayOf(hoyIso), s).map((l) => l.quien).filter((q) => q && q.g !== 'nadie')
        .map((q) => (q.g === 'otra' ? (limpieza.otraNombre || 'otra congregación') : ((grupos[q.g] || {}).nombre || '')));
      const msg = resumenSemanal(cong, hoyIso, { solicitudes: sol.size, terminados: ter.size, buscan, limpia: [...new Set(quien.filter(Boolean))].join(' y ') });
      if (!msg) continue;
      const n = await sendToPubs(d.id, pubIds, msg, APP_BASE + 'asignaciones-salon.html#panel', 'aviso', 'resumen-' + hoyIso);
      console.log('[resumen]', d.id, msg.title, '· celulares:', n);
    } catch (e) { console.error('[resumen]', d.id, e && e.message); }
  }
});

exports.weeklyBackups = onSchedule({ schedule: '30 3 * * 0', timeZone: 'America/Argentina/Buenos_Aires', region: REGION, timeoutSeconds: 540, memory: '512MiB' }, async () => {
  const qs = await db.collection('congregations').select().get();
  for (const d of qs.docs) {
    try {
      const r = await saveBackup(d.id, 'auto');
      const n = await pruneBackups(d.id);
      console.log('[copias]', d.id, r.name, r.size, 'bytes · borradas', n);
    } catch (e) { console.error('[copias] falló', d.id, e && e.message); }
  }
});

exports.backups = onRequest({ cors: ['https://hugoescalda21.github.io'], region: REGION, maxInstances: 3, timeoutSeconds: 120, memory: '512MiB' }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send({ error: 'Método no permitido' }); return; }
  try {
    const m = String(req.get('Authorization') || '').match(/^Bearer (.+)$/);
    if (!m) { res.status(401).send({ error: 'Falta iniciar sesión' }); return; }
    let decoded;
    try { decoded = await admin.auth().verifyIdToken(m[1]); } catch (e) { res.status(401).send({ error: 'Sesión vencida' }); return; }
    const email = String(decoded.email || '').toLowerCase();
    const body = req.body || {};
    const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code || !email) { res.status(400).send({ error: 'Datos no válidos' }); return; }
    const cong = await db.collection('congregations').doc(code).get();
    const editors = ((cong.exists && cong.data().settings) || {}).editorEmails || [];
    if (!editors.map((e) => String(e).toLowerCase()).includes(email)) { res.status(403).send({ error: 'Solo para Super Admin' }); return; }

    if (body.action === 'list') { res.status(200).send({ backups: await listBackups(code) }); return; }
    if (body.action === 'create') {
      const r = await saveBackup(code, 'manual');
      await pruneBackups(code);
      res.status(200).send({ ok: true, file: r.name.split('/').pop(), size: r.size });
      return;
    }
    const file = String(body.file || '');
    if (!parseBackupName(file) || file.includes('/')) { res.status(400).send({ error: 'Copia no válida' }); return; }
    const f = admin.storage().bucket().file(`backups/${code}/${file}`);
    const [exists] = await f.exists();
    if (!exists) { res.status(404).send({ error: 'Esa copia ya no existe' }); return; }
    const [buf] = await f.download();
    const backup = JSON.parse(buf.toString('utf8'));

    if (body.action === 'get') { res.status(200).send({ backup }); return; }
    if (body.action === 'restore') {
      const parts = (Array.isArray(body.parts) ? body.parts : []).filter(x => x === 'programa' || x === 'territorios' || x === 'salon');
      if (!parts.length) { res.status(400).send({ error: 'Elegí qué restaurar' }); return; }
      if (backup.code && backup.code !== code) { res.status(400).send({ error: 'Esa copia es de otra congregación' }); return; }
      // Antes de tocar nada, una copia de cómo está todo ahora (por si hay que volver atrás).
      const previa = await saveBackup(code, 'previa');
      const ref = db.collection('congregations').doc(code);
      const current = {};
      for (const c of ALL_SUBS) current[c] = (await ref.collection(c).listDocuments()).map(d => d.id);
      const plan = restorePlan(backup, parts, current, email, new Date().toISOString());
      if (plan.main) await ref.set(plan.main);
      let batch = db.batch(), n = 0;
      for (const d of plan.docs) {
        const dr = ref.collection(d.col).doc(d.id);
        if (d.data) batch.set(dr, d.data); else batch.delete(dr);
        if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
      }
      await batch.commit();
      console.warn('[copias] restaurada', code, file, parts.join('+'), 'por', email, '· previa', previa.name);
      res.status(200).send({ ok: true, previa: previa.name.split('/').pop() });
      return;
    }
    res.status(400).send({ error: 'Acción desconocida' });
  } catch (err) {
    console.error('[copias] error:', err && err.message);
    res.status(500).send({ error: 'Error interno' });
  }
});

// ---------------------------------------------------------------------------
// Hermanos de otra congregación en los trabajos del Salón. No leen la base de la congregación:
// todo pasa por acá, y solo reciben los trabajos que les tocan.
//   · Invitación (body.k): enlace de un trabajo y un día, sin cuenta. El hermano pone su nombre y
//     su congregación y se anota; el teléfono recuerda que se anotó (clave de baja "bk").
//   · Voluntario del salón (Authorization: Bearer …): un hermano de la lista "externos" con email
//     y la tilde "Voluntario del salón". Ve los trabajos publicados que piden voluntarios.
// Acciones: ver | anotar | baja.
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
exports.salonExterno = onRequest({ cors: ['https://hugoescalda21.github.io'], region: REGION, maxInstances: 5 }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send({ error: 'Método no permitido' }); return; }
  try {
    const body = req.body || {};
    const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const k = String(body.k || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
    if (!code) { res.status(400).send({ error: 'Datos no válidos' }); return; }
    const ref = db.collection('congregations').doc(code);
    const salon = ref.collection('salon');
    const [cs, tr, xs, iv] = await Promise.all([ref.get(), salon.doc('trabajos').get(), salon.doc('externos').get(), k ? salon.doc('invitaciones').get() : Promise.resolve(null)]);
    if (!cs.exists) { res.status(404).send({ error: 'No existe esa congregación' }); return; }
    const cong = cs.data() || {};
    const congName = ((cong.settings || {}).congregationName) || '';
    const trabajos = (tr.exists && tr.data().lista) || {};
    const externos = (xs.exists && xs.data().lista) || {};
    const { dateIso: hoyIso } = arParts(new Date());
    let modo, ext = null, inv = null, email = '';
    if (k) {
      modo = 'inv';
      const x = ((iv && iv.exists && iv.data().lista) || {})[k];
      inv = x ? Object.assign({}, x, { k }) : null;
    } else {
      const m = String(req.get('Authorization') || '').match(/^Bearer (.+)$/);
      if (!m) { res.status(401).send({ error: 'Falta iniciar sesión' }); return; }
      let decoded;
      try { decoded = await admin.auth().verifyIdToken(m[1]); } catch (e) { res.status(401).send({ error: 'Sesión vencida' }); return; }
      email = String(decoded.email || '');
      ext = extVoluntario(externos, email);
      if (!ext) { res.status(403).send({ error: 'Sin acceso' }); return; }
      modo = 'vol';
    }
    const action = String(body.action || 'ver');

    if (action === 'ver') {
      if (modo === 'inv') {
        const st = estadoInvitacion(inv, trabajos, hoyIso);
        if (st.estado !== 'ok') { res.status(200).send({ modo, cong: congName, estado: st.estado, titulo: (st.t && st.t.titulo) || '', fecha: (inv && inv.fecha) || '' }); return; }
        const [an, fi] = await Promise.all([ref.collection('salonAnotados').where('tid', '==', inv.tid).get(), ref.collection('salonFichas').doc(inv.tid + '__' + inv.fecha).get()]);
        const anotados = {}; an.forEach((d) => { anotados[d.id] = d.data(); });
        const fichas = fi.exists ? { [fi.id]: fi.data() } : {};
        // El teléfono que ya se anotó con esta invitación manda su anotación para reconocerla ("✓ Anotado").
        const mia = body.aid && anotados[String(body.aid)];
        const miUid = mia && mia.inv === k ? mia.uid : null;
        const proj = proyeccionExterno([{ tid: inv.tid, fecha: inv.fecha }], trabajos, anotados, fichas, cong.publishers || [], miUid);
        res.status(200).send(Object.assign({ modo, cong: congName, estado: 'ok', para: inv.para || '', tel: inv.tel !== false, lugares: lugaresInvitacion(inv, st.t, anotados) }, proj));
        return;
      }
      const [an, fi] = await Promise.all([ref.collection('salonAnotados').get(), ref.collection('salonFichas').get()]);
      const anotados = {}; an.forEach((d) => { anotados[d.id] = d.data(); });
      const fichas = {}; fi.forEach((d) => { fichas[d.id] = d.data(); });
      // Del comité: todo el cronograma. Voluntario: lo publicado que pide ayuda y lo suyo.
      const occ = ext.comite ? occComite(trabajos, hoyIso) : occVoluntario(trabajos, anotados, ext.id, hoyIso);
      const proj = proyeccionExterno(occ, trabajos, anotados, fichas, cong.publishers || [], 'x-' + ext.id, !!ext.comite);
      if (!proj.pubs.some((p) => p.id === 'x:' + ext.id)) proj.pubs.push({ id: 'x:' + ext.id, name: ext.nombre || '', email });
      else proj.pubs.forEach((p) => { if (p.id === 'x:' + ext.id) p.email = email; });
      res.status(200).send(Object.assign({ modo, cong: congName, estado: 'ok', yo: { id: 'x:' + ext.id, nombre: ext.nombre || '', cong: ext.cong || '', comite: !!ext.comite } }, proj));
      return;
    }

    if (action === 'anotar') {
      const tid = String(body.tid || ''), fecha = String(body.fecha || '');
      let datos = null;
      if (modo === 'inv') {
        datos = datosInvitado(body);
        if (datos.error) { res.status(400).send({ error: datos.error }); return; }
        if (!inv || inv.tid !== tid || inv.fecha !== fecha) { res.status(400).send({ error: 'Esta invitación es para otro trabajo.' }); return; }
      }
      const comentario = String(body.comentario || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      const bk = modo === 'inv' ? crypto.randomBytes(16).toString('hex') : '';
      const out = await db.runTransaction(async (tx) => {
        const reads = [tx.get(salon.doc('trabajos')), tx.get(ref.collection('salonAnotados').where('tid', '==', tid)), tx.get(salon.doc('externos'))];
        if (modo === 'inv') reads.push(tx.get(salon.doc('invitaciones')));
        const [trS, anS, xS, ivS] = await Promise.all(reads);
        const lista = (trS.exists && trS.data().lista) || {};
        const xl = (xS.exists && xS.data().lista) || {};
        const anotados = {}; anS.forEach((d) => { anotados[d.id] = d.data(); });
        const t = lista[tid];
        if (!t) return { error: 'Ese trabajo ya no está.' };
        let persona;
        if (modo === 'inv') {
          const iv2 = ((ivS && ivS.exists && ivS.data().lista) || {})[k];
          const inv2 = iv2 ? Object.assign({}, iv2, { k }) : null;
          const st = estadoInvitacion(inv2, lista, hoyIso);
          if (st.estado !== 'ok') return { error: 'Esta invitación ya no está activa.', estado: st.estado };
          if (lugaresInvitacion(inv2, t, anotados) <= 0) return { error: 'Ya se completaron los lugares.', completo: true };
          persona = extBuscar(xl, datos.nombre, datos.cong);
          const nueva = !persona;
          persona = Object.assign({}, persona || { id: 'i' + crypto.randomBytes(5).toString('hex'), nombre: datos.nombre, cong: datos.cong, origen: 'invitacion' });
          if (datos.tel && !persona.tel) persona.tel = datos.tel;
          if (nueva || datos.tel) tx.set(salon.doc('externos'), { lista: { [persona.id]: persona } }, { merge: true });
        } else {
          persona = extVoluntario(xl, email);
          if (!persona) return { error: 'Sin acceso' };
          const o = SalonCore.trabajosEntre({ [t.id]: t }, fecha, fecha)[0];
          if (!o || fecha < hoyIso || o.cancelada || o.estado === 'hecho' || o.sinDia || !o.pub) return { error: 'Ese trabajo ya no busca voluntarios.' };
          if (SalonCore.cupoInfo(t, fecha, anotados).faltan <= 0) return { error: 'Ya se completaron los lugares.', completo: true };
        }
        const pid = 'x:' + persona.id;
        if (t.resp === pid || t.aux === pid || SalonCore.voluntarios(t, fecha, anotados).some((v) => v.pubId === pid)) return { error: 'Ya estás anotado en este trabajo.', ya: true };
        const aid = SalonCore.anotadoId(tid, fecha, 'x-' + persona.id);
        const doc = { tid, fecha, pubId: pid, nombre: persona.nombre || '', uid: 'x-' + persona.id, comentario, cong: persona.cong || '', at: new Date().toISOString() };
        if (modo === 'inv') { doc.inv = k; doc.bk = sha(bk); }
        tx.set(ref.collection('salonAnotados').doc(aid), doc);
        return { ok: true, aid, nombre: persona.nombre || '' };
      });
      if (out.error) { res.status(409).send(out); return; }
      if (bk) out.bk = bk;
      res.status(200).send(out);
      return;
    }

    // Ficha completada desde el celular por un hermano de afuera: del comité, o responsable o auxiliar de ese trabajo.
    if (action === 'ficha') {
      if (modo !== 'vol') { res.status(403).send({ error: 'Sin permiso' }); return; }
      const t = trabajos[String(body.tid || '')];
      const fecha = String(body.fecha || '');
      if (!t || !SalonCore.trabajosEntre({ [t.id]: t }, fecha, fecha).length) { res.status(404).send({ error: 'Ese trabajo ya no está.' }); return; }
      if (!puedeFichaExt(ext, t)) { res.status(403).send({ error: 'La completan el responsable, el auxiliar y el comité.' }); return; }
      const d = fichaDeExt(body, ext, email, new Date().toISOString());
      await ref.collection('salonFichas').doc(t.id + '__' + fecha).set(d);
      res.status(200).send({ ok: true });
      return;
    }

    if (action === 'baja') {
      const aid = String(body.aid || '').slice(0, 140);
      if (!aid) { res.status(400).send({ error: 'Datos no válidos' }); return; }
      const aref = ref.collection('salonAnotados').doc(aid);
      const a = await aref.get();
      if (!a.exists) { res.status(200).send({ ok: true }); return; }
      const d = a.data() || {};
      const puede = modo === 'vol' ? d.uid === 'x-' + ext.id : (d.inv === k && !!body.bk && d.bk === sha(body.bk));
      if (!puede) { res.status(403).send({ error: 'No se puede dar de baja a otro hermano.' }); return; }
      await aref.delete();
      res.status(200).send({ ok: true });
      return;
    }
    res.status(400).send({ error: 'Acción desconocida' });
  } catch (err) {
    console.error('[salonExterno] error:', err && err.message);
    res.status(500).send({ error: 'Error interno' });
  }
});
