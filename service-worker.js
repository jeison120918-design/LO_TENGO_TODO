// service-worker.js
// Este proyecto ya NO usa Service Worker (se alinea con la configuración
// de referencia que nunca ha perdido datos: solo IndexedDB, sin nada que
// cachee el "shell" de la app).
//
// Este archivo se conserva únicamente como interruptor de apagado: si tu
// iPhone ya tenía instalado el Service Worker de una versión anterior,
// esta versión se instala en su lugar, borra toda la caché vieja y se
// desregistra a sí misma. Después de eso, la app funciona directo desde
// la red/IndexedDB, igual que el proyecto de referencia.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clientsList = await self.clients.matchAll({ type: 'window' });
      clientsList.forEach((client) => client.navigate(client.url));
    })()
  );
});
