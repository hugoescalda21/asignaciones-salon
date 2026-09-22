/**
 * Función en la nube — Avisos push y recordatorios
 */
const { onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

const REGION = 'southamerica-east1';
const { roleLabel, collectNewlyAssignedIds, avisoPreview, selectNewAvisos, notificationForNewAvisos, validateReminder, reminderDocId, ROLES_MAP } = require('./lib');

// La app vive en GitHub Pages bajo /asignaciones-salon/, no en la raíz del
// dominio: un link o ícono con "/" apunta a hugoescalda21.github.io/ y no a la app.
const APP_BASE = 'https://hugoescalda21.github.io/asignaciones-salon/';
function verLink(code, tab) {
  let url = APP_BASE + 'ver/ver.html' + (code ? '?codigo=' + encodeURIComponent(code) : '');
  if (tab) url += (code ? '&' : '?') + 'tab=' + encodeURIComponent(tab);   // abre directo en esa pestaña: inicio | calendario | anuncios
  return url;
}
const BADGE_URL = APP_BASE + 'badge-icon.png';

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
  }).catch((err) => {
    console.error('ERROR ENVIANDO PUSH DE AVISO:', err && err.code, err && err.message);
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
            tag: `asignacion-${Date.now()}`,
            data: JSON.stringify({
              code: code,
              pubId: pubId,
              token: token,
              assignments: assignments,
              meetingDateIso: meetingDateIso
            }),
            actions: [
              { action: 'remind-1d', title: 'Recordar 1 día antes' },
              { action: 'remind-3d', title: 'Recordar 3 días antes' }
            ]
          }
        }
      }).then((resp) => {
        if (resp) console.log('[push] enviado OK al celular', String(token).slice(0, 12) + '…', 'a', pubId);
        return resp;
      }).catch((err) => {
        console.error('ERROR ENVIANDO PUSH:', err && err.code, err && err.message);
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
