const VERSION = "forkworld-v4";
const CACHE = `forkworld-${VERSION}`;
const SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/apple-touch-icon.png",
  "/icons/dotti-splash.png",
  "/fonts/fusion-pixel-sc.woff2",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("forkworld-") && key !== CACHE)
          .map(key => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/training-api/")) return;

  if (request.mode === "navigate") {
    const network = fetch(request).then(response => {
      if (response.ok && response.type === "basic") {
        caches.open(CACHE)
          .then(cache => cache.put("/index.html", response.clone()))
          .catch(() => undefined);
      }
      return response;
    });

    event.respondWith(
      network.catch(() => caches.match("/index.html").then(response => response || caches.match("/"))),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(request).then(cached => {
        const network = fetch(request)
          .then(response => {
            if (response.ok && response.type === "basic") {
              cache.put(request, response.clone()).catch(() => undefined);
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    ),
  );
});
