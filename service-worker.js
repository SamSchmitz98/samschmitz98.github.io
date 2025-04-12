const CACHE_NAME = "duck-cache-v1";
const OFFLINE_URL = "/offline.html";

const urlsToCache = [
  "/",
  "/index.html",
  "/duck.html",
  "/myducks.html",
  "/scan.html",
  "/style.css",
  "/ducks.js",
  "/cardRenderer.js",
  "/app.js",
  OFFLINE_URL,
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

const normalizeUrl = (request) => {
  const url = new URL(request.url);
  if (url.pathname === "/duck.html") {
    return "/duck.html";
  }
  return request;
};

self.addEventListener("fetch", (event) => {
  const normalizedRequest = normalizeUrl(event.request);
  
  event.respondWith(
    caches.match(normalizedRequest).then((cached) => {
      return cached || fetch(event.request).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match(OFFLINE_URL).then(response => {
            return response || new Response("Offline and no offline page available.", {
              headers: { "Content-Type": "text/html" }
            });
          });
        }
      });
    })
  );
});
  
