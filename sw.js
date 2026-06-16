/* Hume service worker — app shell + targeted cross-origin caching.
   Philosophy:
   - Same-origin app shell: stale-while-revalidate (fonts, icons, manifest)
   - index.html navigation: network-first → offline fallback
   - HLS.js from CDN: cache-on-first-fetch, then serve forever from cache
   - TMDB-proxy Worker (/tmdb): stale-while-revalidate for instant repeats
   - All other cross-origin traffic (Plex API, images, video): never cached */
const CACHE = "hume-v3";
const RUNTIME = "hume-runtime-v3";
// The settings/TMDB Worker. Its /tmdb responses are public and shared across
// users, so we stale-while-revalidate them for instant repeat loads + offline.
const TMDB_PROXY_HOST = "hume-settings.contactdavidbusch.workers.dev";
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

// Exact CDN URLs to cache on first fetch (version-pinned so no stale risk)
const CDN_CACHE = new Set([
  "https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js"
]);

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== RUNTIME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App boot: network-first so freshly deployed index.html always wins.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(res => { const c = res.clone(); caches.open(CACHE).then(ca => ca.put("./index.html", c)); return res; })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate for instant delivery.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(cached => {
        const net = fetch(req)
          .then(res => { if (res && res.status === 200) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); } return res; })
          .catch(() => cached);
        return cached || net;
      })
    );
    return;
  }

  // TMDB proxy (Worker /tmdb): stale-while-revalidate. Serve cached instantly,
  // refresh in the background. Public data, so caching is safe and fast.
  if (url.host === TMDB_PROXY_HOST && url.pathname === "/tmdb") {
    e.respondWith(
      caches.open(RUNTIME).then(ca =>
        ca.match(req).then(cached => {
          const net = fetch(req)
            .then(res => { if (res && res.status === 200) ca.put(req, res.clone()); return res; })
            .catch(() => cached);
          return cached || net;
        })
      )
    );
    return;
  }

  // Version-pinned CDN assets (HLS.js): cache-on-first-fetch.
  // After first load they're served instantly and work offline.
  if (CDN_CACHE.has(req.url)) {
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res && res.status === 200) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); }
          return res;
        });
      })
    );
    return;
  }

  // Everything else (Plex API, images, video streams): pass through untouched.
  // Never cache auth'd content or large media.
});
