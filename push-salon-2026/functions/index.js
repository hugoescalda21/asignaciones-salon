/**
 * Función en la nube — Avisos push y recordatorios
 */
const { onDocumentUpdated, onDocumentDeleted, onDocumentUpdatedWithAuthContext } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

const REGION = 'southamerica-east1';
const { roleLabel, collectNewlyAssignedIds, avisoPreview, selectNewAvisos, notificationForNewAvisos, validateReminder, reminderDocId, ROLES_MAP,
  arParts, addDaysIso, remindersDue, reminderMessage, sentReminderId, roleAreasFor, disallowedWeekChanges, guardSummary } = require('./lib');

// La app vive en GitHub Pages bajo /asignaciones-salon/, no en la raíz del
// dominio: un link o ícono con "/" apunta a hugoescalda21.github.io/ y no a la app.
const APP_BASE = 'https://hugoescalda21.github.io/asignaciones-salon/';
function verLink(code, tab) {
  let url = APP_BASE + 'ver/ver.html' + (code ? '?codigo=' + encodeURIComponent(code) : '');
  if (tab) url += (code ? '&' : '?') + 'tab=' + encodeURIComponent(tab);   // abre directo en esa pestaña: inicio | calendario | anuncios
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

  const tokensSnap = await db.collection('pushSubscriptions').where('code', '==', code).get();
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
          fcmOptions: { link: verLink(sub.code) },
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
    const lists = ['editorEmails', 'tecnicoAdminEmails', 'acomodadoresAdminEmails', 'asignacionesAdminEmails', 'anunciosOnlyEmails', 'viewerEmails'];
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
