// ShuttleLab service worker.
// Strategy: STALE-WHILE-REVALIDATE for our own static files — serve the cached
// copy instantly (so the app opens in ~1s even on slow cellular) and refresh it
// in the background for next time. Trade-off: a new deploy is picked up on the
// NEXT open, not the current one. Data, the API, and third-party CDNs (Firebase,
// Chart.js, fonts) always go straight to the network and are never cached here.
const CACHE = "shuttlelab-v6";

// App shell precached on install, so even a cold open after an update is fast.
const PRECACHE = [
  "./", "./index.html", "./css/styles.css", "./manifest.webmanifest", "./icons/icon-192.png",
  "./js/app.js", "./js/core.js", "./js/shell.js", "./js/auth.js", "./js/firebase.js",
  "./js/config.js", "./js/data.js", "./js/rating.js", "./js/push.js", "./js/r2upload.js",
  "./js/report.js", "./js/court3d.js", "./js/courtlab.js", "./js/solocourt.js", "./js/sidecourt.js",
  "./js/views/login.js", "./js/views/dashboard.js", "./js/views/team.js", "./js/views/log.js",
  "./js/views/training.js", "./js/views/library.js", "./js/views/matches.js",
  "./js/views/leaderboard.js", "./js/views/mindroom.js", "./js/views/support.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // best-effort: one missing asset must not fail the whole install
    await Promise.all(PRECACHE.map(u => cache.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

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
    const cached = await cache.match(req);
    const fromNetwork = fetch(req).then((net) => {
      if (net && net.status === 200) cache.put(req, net.clone());
      return net;
    }).catch(() => null);

    if (cached) {
      e.waitUntil(fromNetwork);   // serve cache now; keep the SW alive to refresh it
      return cached;
    }
    const net = await fromNetwork;
    if (net) return net;
    if (req.mode === "navigate") {
      const shell = await cache.match("./index.html");
      if (shell) return shell;
    }
    return Response.error();
  })());
});

self.addEventListener("push", (e)=>{
  let d = {}; try{ d = e.data ? e.data.json() : {}; }catch(_){}
  e.waitUntil(self.registration.showNotification(d.title || "ShuttleLab", {
    body: d.body || "",
    data: { url: d.url || "/" },
    tag: d.tag || "shuttlelab",
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png"
  }));
});
self.addEventListener("notificationclick", (e)=>{
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async ()=>{
    const all = await self.clients.matchAll({ type:"window", includeUncontrolled:true });
    for(const c of all){ if("focus" in c){ try{ await c.navigate(url); }catch(_){} return c.focus(); } }
    if(self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
