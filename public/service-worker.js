/* ============================================================
   LOVE AI — Service Worker
   Handles: caching, offline fallback, PWA install
   ============================================================ */

const CACHE_NAME    = "love-ai-v1";
const OFFLINE_URL   = "/offline.html";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/manifest.json"
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Silently fail if some assets aren't available yet
      });
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  // Skip non-GET and API calls
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("/chat") || event.request.url.includes("groq")) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Return offline page for navigation requests
          if (event.request.mode === "navigate") {
            return new Response(
              `<!DOCTYPE html>
              <html>
              <head><meta charset="UTF-8"><title>LOVE AI — Offline</title>
              <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body { background:#0a0015; color:#e2d9f3; font-family:sans-serif;
                  display:flex; flex-direction:column; align-items:center;
                  justify-content:center; height:100vh; text-align:center; gap:16px; }
                .icon { font-size:64px; }
                h1 { font-size:24px; color:#a78bfa; }
                p  { color:#8b7aaa; font-size:14px; }
              </style>
              </head>
              <body>
                <div class="icon">💜</div>
                <h1>LOVE AI</h1>
                <p>You're offline, Sir.<br/>Please check your connection.</p>
              </body>
              </html>`,
              { headers: { "Content-Type": "text/html" } }
            );
          }
        });
    })
  );
});
