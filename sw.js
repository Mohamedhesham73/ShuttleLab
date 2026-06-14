// ShuttleLab service worker — makes the app installable and usable offline.
// Strategy: network-first for our own files (so a new deploy is always seen
// when online), falling back to the cached copy when offline. Data, the API,
// and third-party CDNs (Firebase, Chart.js, fonts) always go straight to the
// network and are never cached here.
const CACHE = "shuttlelab-v4";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;      // CDNs / Firebase → untouched
  if (url.pathname.startsWith("/api/")) return;     // serverless API → untouched

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const net = await fetch(req);
      if (net && net.status === 200) cache.put(req, net.clone());
      return net;
    } catch (_) {
      const cached = await cache.match(req);
      if (cached) return cached;
      if (req.mode === "navigate") {
        const shell = await cache.match("./index.html");
        if (shell) return shell;
      }
      return Response.error();
    }
  })());
});
