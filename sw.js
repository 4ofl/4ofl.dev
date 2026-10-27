/* 4ofl.dev service worker: the site keeps working offline.
   html: network first (4s), then cache. assets: cache first, refreshed in the background.
   bump V when you want every visitor's cache dropped. */
const V = "4ofl-v6";
const CORE = [
  "/",
  "/work/citecamp/",
  "/work/johns-fitness/",
  "/work/june/",
  "/css/style.css",
  "/js/lenis.min.js",
  "/js/common.js",
  "/js/app.js",
  "/assets/fonts/bricolage-grotesque.woff2",
  "/assets/fonts/jetbrains-mono-400.woff2",
  "/assets/fonts/newsreader-400.woff2",
  "/assets/fonts/newsreader-400-italic.woff2",
  "/assets/favicon.svg",
  "/assets/apple-touch-icon.png",
  "/site.webmanifest",
];
const EXTRA = ["/js/vendor/sql-wasm.js", "/js/vendor/sql-wasm.wasm"]; // best effort, ~650 KB

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(V)
      .then((c) => c.addAll(CORE).then(() => Promise.allSettled(EXTRA.map((u) => c.add(u)))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // worker api etc. go straight to the network

  if (req.mode === "navigate") {
    e.respondWith(
      withTimeout(fetch(req), 4000)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(V).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(async () => {
          const hit =
            (await caches.match(req)) ||
            (await caches.match(url.pathname.endsWith("/") ? url.pathname : url.pathname + "/")) ||
            (await caches.match("/"));
          return hit || new Response("offline", { status: 503, headers: { "Content-Type": "text/plain" } });
        }),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(V).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    }),
  );
});
