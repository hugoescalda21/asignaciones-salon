// Service worker de notificaciones — Asignaciones del Salón del Reino
// ---------------------------------------------------------------------
// Necesario para que las notificaciones lleguen aunque la app esté
// cerrada o en segundo plano. Debe vivir en la raíz del sitio (junto
// a ver.html), con exactamente este nombre.

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
    icon: '/icon-192.png',
    badge: '/badge-icon.png',
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    requireInteraction: true
  });
});
