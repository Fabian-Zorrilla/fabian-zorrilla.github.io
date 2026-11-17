// sw.js — Guarda la app en el teléfono para que abra al instante y sin internet.
// IMPORTANTE: cada vez que cambie un archivo de Decile, subir VERSION.
// Así el teléfono baja la versión nueva (si no, sigue usando la guardada).

const VERSION = 'decile-v2';
const ARCHIVOS = [
  './', 'index.html', 'estilos.css', 'manifest.webmanifest',
  'iconos/icono.svg', 'iconos/icono-192.png', 'iconos/icono-512.png', 'iconos/icono-maskable-512.png', 'iconos/apple-touch-icon.png',
  'js/app.js', 'js/parser.js', 'js/texto.js', 'js/contactos.js', 'js/telefono.js', 'js/fechas.js',
  'js/apps.js', 'js/acciones.js', 'js/vcard.js', 'js/voz.js', 'js/almacen.js', 'js/clima.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(ARCHIVOS.map((a) => new Request(a, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k.startsWith('decile-') && !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const pedido = e.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);

  // La app: primero lo guardado; si no está, de internet.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(pedido, { ignoreSearch: true }).then((guardado) => guardado || fetch(pedido).catch(() =>
        pedido.mode === 'navigate' ? caches.match('index.html') : Response.error())),
    );
    return;
  }

  // Tipografías de Google: se guardan la primera vez que se usan.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(`${VERSION}-fuentes`).then(async (c) => {
      const guardado = await c.match(pedido);
      const deRed = fetch(pedido).then((r) => { if (r.ok) c.put(pedido, r.clone()); return r; }).catch(() => guardado);
      return guardado || deRed;
    }));
  }
  // El resto (clima, etc.) va directo a internet.
});
