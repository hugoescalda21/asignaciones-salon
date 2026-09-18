// --- Notificaciones push (Firebase Cloud Messaging) ---
// Unificado en este mismo service worker (en vez de uno aparte) para que
// no compitan dos "trabajadores" por el mismo sitio — eso hacía que las
// notificaciones nunca llegaran, porque este archivo (el de siempre, para
// que la app funcione offline) le ganaba el lugar al de mensajería.
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

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'Asignaciones — Salón del Reino';
  const body = (payload.notification && payload.notification.body) || 'Tenés una novedad en tus asignaciones.';
  self.registration.showNotification(title, {
    body,
    icon: './icon-192.png',
    badge: './badge-icon.png',
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    requireInteraction: true
  });
});

const CACHE_NAME = 'asignaciones-salon-v7';
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
  // No skipWaiting acá: se queda "esperando" hasta que la página lo confirme,
  // así podemos avisarle al usuario antes de activar la versión nueva.
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

// Cache-first para que la app abra igual sin conexión; intenta la red primero
// solo para asegurarse de traer una versión más nueva cuando hay señal.
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
