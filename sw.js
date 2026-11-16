// Guarda la app en el celular para que abra sin internet.
const VERSION = "obras-v9";
const ARCHIVOS = ["./", "index.html", "css/app.css", "js/app.js", "js/db.js", "js/vendor/xlsx.full.min.js", "js/vendor/jszip.min.js", "js/contrato.js", "js/miexcel.js", "js/vendor/pdf.min.mjs", "js/vendor/pdf.worker.min.mjs",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Primero la red (para recibir actualizaciones); si no hay señal o tarda, lo guardado en el celular.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const guardado = await caches.match(e.request, { ignoreSearch: true });
    try {
      const r = await Promise.race([fetch(e.request),
        new Promise((_, no) => setTimeout(() => no(new Error("lento")), guardado ? 2500 : 20000))]);
      if (r.ok) { const copia = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); }
      return r;
    } catch (err) {
      return guardado || caches.match("index.html");
    }
  })());
});
