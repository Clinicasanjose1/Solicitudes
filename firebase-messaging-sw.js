/*
 * Service worker: recibe las notificaciones push aunque la app esté cerrada.
 * No es necesario editar este archivo (toma la configuración de config.js).
 */
importScripts('config.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

try {
  firebase.initializeApp(self.APP_CONFIG.FIREBASE);
  // Las notificaciones enviadas por el servidor traen título y texto:
  // Firebase las muestra solas y, al tocarlas, abre la solicitud en la app.
  firebase.messaging();
} catch (e) {
  // Firebase aún no está configurado en config.js
}
