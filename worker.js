/* Hume settings + TMDB-cache Worker (Cloudflare Workers + KV)
   ------------------------------------------------------------------
   Two jobs:
   1. Per-user settings store  (GET/PUT /?token=<opaque-key>) backed by KV
   2. TMDB edge-cache proxy    (GET /tmdb?path=/search/person?query=...)
      — public, identical for every user, so Cloudflare caches it at the
        edge: popular actors load from cache instead of hitting TMDB.

   Bindings required (Worker → Settings → Bindings):
     - KV namespace,  variable name: HUME_SETTINGS
     - (optional) Secret/var,        name: TMDB_KEY  (else the default below) */

const TMDB_FALLBACK_KEY = "a9263943cdfdc2dd3d836e06a2cdb10b";

export default {
  async fetch(request, env, ctx) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);

    // ---- 1. TMDB edge-cache proxy -------------------------------------
    if (url.pathname === "/tmdb") {
      const path = url.searchParams.get("path");
      if (!path) return new Response("missing path", { status: 400, headers: cors });

      const cache = caches.default;
      const cacheKey = new Request("https://tmdb.cache/" + encodeURIComponent(path));
      let res = await cache.match(cacheKey);

      if (!res) {
        const key = env.TMDB_KEY || TMDB_FALLBACK_KEY;
        const sep = path.includes("?") ? "&" : "?";
        const upstream = await fetch(`https://api.themoviedb.org/3${path}${sep}api_key=${key}`);
        const body = await upstream.text();
        res = new Response(body, {
          status: upstream.status,
          headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
        });
        if (upstream.ok) ctx.waitUntil(cache.put(cacheKey, res.clone()));
      }

      const h = new Headers(res.headers);
      for (const [k, v] of Object.entries(cors)) h.set(k, v);
      return new Response(res.body, { status: res.status, headers: h });
    }

    // ---- 1b. Plex image edge-cache proxy ------------------------------
    //   GET /img?u=<full Plex transcode URL>
    //   The Plex server transcodes each poster once; Cloudflare then serves it
    //   from the edge to every device/user. Big win for remote/relay clients
    //   and it offloads the server's transcoder. Cache key drops the token so
    //   the same art is shared regardless of who requested it.
    if (url.pathname === "/img") {
      const u = url.searchParams.get("u");
      if (!u) return new Response("missing u", { status: 400, headers: cors });
      let target;
      try { target = new URL(u); } catch (_) { return new Response("bad url", { status: 400, headers: cors }); }
      // Lock the proxy down to Plex image endpoints so it can't be abused as a
      // general-purpose open proxy.
      const okHost = target.hostname.endsWith(".plex.direct") || target.hostname.endsWith(".plex.tv");
      const okPath = target.pathname.includes("/photo/:/transcode") || target.pathname.includes("/composite");
      if (!okHost || !okPath) return new Response("forbidden", { status: 403, headers: cors });

      const cache = caches.default;
      const keyUrl = new URL(u);
      keyUrl.searchParams.delete("X-Plex-Token");
      const cacheKey = new Request("https://img.cache/" + encodeURIComponent(keyUrl.toString()));
      let res = await cache.match(cacheKey);

      if (!res) {
        let upstream;
        try { upstream = await fetch(u); } catch (_) { return new Response("upstream unreachable", { status: 502, headers: cors }); }
        if (!upstream.ok) return new Response("upstream error", { status: upstream.status, headers: cors });
        const buf = await upstream.arrayBuffer();
        res = new Response(buf, {
          status: 200,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") || "image/jpeg",
            "Cache-Control": "public, max-age=2592000, immutable",
          },
        });
        ctx.waitUntil(cache.put(cacheKey, res.clone()));
      }

      const h = new Headers(res.headers);
      for (const [k, v] of Object.entries(cors)) h.set(k, v);
      return new Response(res.body, { status: res.status, headers: h });
    }

    // ---- 2. Per-user settings store -----------------------------------
    const token = url.searchParams.get("token");
    if (!token) return new Response("missing token", { status: 400, headers: cors });

    // Hash again server-side so the stored key is opaque even in KV.
    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const kvKey = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);

    if (request.method === "GET") {
      const val = await env.HUME_SETTINGS.get(kvKey);
      return new Response(val || "{}", { headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (request.method === "PUT") {
      const body = await request.text();
      // Settings are tiny; cap the body so the endpoint can't be abused as
      // free arbitrary storage.
      if (body.length > 16384) return new Response("payload too large", { status: 413, headers: cors });
      await env.HUME_SETTINGS.put(kvKey, body);
      return new Response("ok", { headers: cors });
    }
    return new Response("method not allowed", { status: 405, headers: cors });
  },
};
