/* Hume service worker.
   Scope: same-origin app shell ONLY. All Plex traffic (API, images, video)
   lives on a different origin (the user's server) and is deliberately ignored
   here, so nothing auth'd, dynamic, or huge is ever cached. */
const CACHE = "hume-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/favicon.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon.png",
  "./assets/fonts/Circular/Circular-Book.ttf",
  "./assets/fonts/Circular/Circular-Medium.ttf",
  "./assets/fonts/Circular/Circular-Bold.ttf",
  "./assets/fonts/Circular/Circular-Black.ttf"
];

self.addEventListener("install", e => {
  // Best-effort precache: a missing optional asset must not abort the install.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ignore Plex server, CDN, etc.

  // App boot: network-first so a freshly deployed index.html always wins;
  // fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); return res; })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // Same-origin static assets (fonts, icons, manifest): stale-while-revalidate.
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req)
        .then(res => { if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
        .catch(() => cached);
      return cached || net;
    })
  );
});
