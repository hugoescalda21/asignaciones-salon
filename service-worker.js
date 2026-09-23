// --- Notificaciones push (Firebase Cloud Messaging) ---
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

const CACHE_NAME = 'asignaciones-salon-v19';
const ASSETS = [
  './asignaciones-salon.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

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
          return clients.openWindow(new URL('asignaciones-salon.html', self.registration.scope).href);
        }
      })
    );
  }
});
