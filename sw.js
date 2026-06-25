/* Hume service worker — app shell + targeted cross-origin caching.
   Philosophy:
   - Same-origin app shell: stale-while-revalidate (fonts, icons, manifest)
   - index.html navigation: network-first → offline fallback
   - HLS.js from CDN: cache-on-first-fetch, then serve forever from cache
   - TMDB-proxy Worker (/tmdb): stale-while-revalidate for instant repeats
   - Plex posters/art: cache-first on a capped, durable store (the native feel)
   - Plex API JSON + video streams: never cached here (JSON handled in-app) */
const CACHE = "hume-v5";
const RUNTIME = "hume-runtime-v5";
// Dedicated, durable poster/art cache — this is what makes revisits feel
// native: an image is fetched (and transcoded by Plex) once, then served from
// disk forever. Capped so it can't grow without bound (oldest evicted first).
const IMG_CACHE = "hume-img-v1";
const IMG_MAX = 800;
// The settings/TMDB Worker. Its /tmdb responses are public and shared across
// users, so we stale-while-revalidate them for instant repeat loads + offline.
const TMDB_PROXY_HOST = "hume-settings.contactdavidbusch.workers.dev";

// Live connection info, pushed from the page. Lets the SW decide whether to
// route images through the Cloudflare edge-cache proxy (remote/relay only —
// the Worker can't reach a LAN server, and local is already fast).
let SERVER = null;
const SHELL = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
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
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== RUNTIME && k !== IMG_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", e => {
  if (e.data === "skipWaiting") { self.skipWaiting(); return; }
  if (e.data && e.data.type === "server") SERVER = e.data;
});

// Token-independent cache key: the X-Plex-Token doesn't change the pixels, and
// stripping it dedupes across token refreshes (and keeps tokens out of keys).
function imgCacheKey(rawUrl) {
  const u = new URL(rawUrl);
  u.searchParams.delete("X-Plex-Token");
  return new Request(u.toString());
}

async function trimImgCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= IMG_MAX) return;
  // Cache.keys() preserves insertion order → delete the oldest overflow (FIFO).
  const remove = keys.length - IMG_MAX;
  for (let i = 0; i < remove; i++) await cache.delete(keys[i]);
}

// Cache-first poster/art delivery. On miss we refetch in CORS mode so we can
// read the real status and cache only genuine 200s (a no-cors opaque response
// would hide 404/500s and we'd cache broken art). If CORS isn't available we
// fall back to a plain pass-through so nothing ever breaks — just uncached.
async function handleImage(req) {
  const keyReq = imgCacheKey(req.url);
  try {
    const cache = await caches.open(IMG_CACHE);
    const cached = await cache.match(keyReq);
    if (cached) return cached;

    let res = null;
    const u = new URL(req.url);
    const viaProxy = SERVER && !SERVER.local && SERVER.workerImg && u.hostname.endsWith(".plex.direct");

    // Remote/relay: let Cloudflare transcode-once/serve-from-edge. The Worker
    // returns a real CORS response with an accurate status.
    if (viaProxy) {
      try {
        const pr = await fetch(SERVER.workerImg + "?u=" + encodeURIComponent(req.url), { mode: "cors" });
        if (pr && pr.status === 200) res = pr;
      } catch (_) {}
    }
    // Direct CORS fetch (local connections, or proxy miss/failure).
    if (!res) {
      try {
        const dr = await fetch(req.url, { mode: "cors", credentials: "omit" });
        if (dr && dr.status === 200) res = dr;
      } catch (_) {}
    }
    if (res) {
      cache.put(keyReq, res.clone());
      trimImgCache(cache);
      return res;
    }
  } catch (_) {}
  // Last resort: original request, uncached. Opaque is fine for <img>.
  return fetch(req);
}

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

  // Plex poster/art (transcoded thumbs + composite/playlist art): cache-first
  // on a dedicated, capped store. This is the single biggest perceived-speed
  // win — second views paint from disk with zero network + zero transcode.
  if (url.pathname.includes("/photo/:/transcode") || url.pathname.includes("/composite")) {
    e.respondWith(handleImage(req));
    return;
  }

  // Everything else (Plex API, video streams): pass through untouched.
  // Never cache auth'd JSON or large media.
});
