// Service worker de notificaciones — Asignaciones del Salón del Reino
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCw014ucHQKqwsVTq1lEKAnZBl_9gAR01I",
  authDomain: "asignaciones-salon.firebaseapp.com",
  projectId: "asignaciones-salon",
  storageBucket: "asignaciones-salon.firebasestorage.app",
  messagingSenderId: "167010071335",
  appId: "1:167010071335:web:0aca9b8cac2bbf5fd2ef02"
});

const messaging = firebase.messaging();

self.addEventListener('notificationclick', function(event) {
  const action = event.action;
  if (action && action.startsWith('remind-')) {
    event.stopImmediatePropagation();
    event.notification.close();
    
    let rawData = event.notification.data;
    if (rawData && rawData.FCM_MSG && rawData.FCM_MSG.data) {
      rawData = rawData.FCM_MSG.data;
    }
    
    let payloadStr = rawData;
    if (typeof rawData !== 'string') {
      payloadStr = JSON.stringify(rawData);
    }
    
    event.waitUntil(
      fetch('https://southamerica-east1-asignaciones-salon.cloudfunctions.net/saveReminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action,
          payloadStr: payloadStr
        })
      })
    );
  } else {
    event.notification.close();
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(windowClients => {
        for (var i = 0; i < windowClients.length; i++) {
          var client = windowClients[i];
          if (client.url.includes('asignaciones-salon') && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});
