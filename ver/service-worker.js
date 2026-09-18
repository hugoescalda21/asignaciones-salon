// Service worker de ver/ — separado del de la app principal a propósito,
// para que cada una tenga su propio scope y se puedan instalar como dos
// apps distintas en el mismo celular.
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
    icon: './icon-192-ver.png',
    badge: '../badge-icon.png',
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    requireInteraction: true
  });
});

const CACHE_NAME = 'ver-salon-v1';
const ASSETS = [
  './ver.html',
  './manifest-ver.json',
  './icon-192-ver.png',
  './icon-512-ver.png',
  './icon-512-maskable-ver.png'
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
