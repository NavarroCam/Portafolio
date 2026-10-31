/* ==========================================================
   sw.js — service worker mínimo
   Hace que la app se pueda instalar en el celular como una app.
   No guarda nada en caché: siempre trae la última versión.
   ========================================================== */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* sin caché: lo resuelve la red */ });
