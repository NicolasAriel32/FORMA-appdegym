const CACHE_NAME = "forma-shell-v5";
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/media/exercises/squat-start.webp",
  "/media/exercises/squat-descent.webp",
  "/media/exercises/squat-return.webp",
  "/media/exercises/squat-muscles.webp",
  "/media/exercises/squat-back-barbell/animation-start.webp",
  "/media/exercises/squat-back-barbell/animation-descent.webp",
  "/media/exercises/squat-back-barbell/animation-return.webp",
  "/media/exercises/squat-back-barbell/muscles.webp",
  "/media/exercises/squat-back-barbell/angles.webp",
  "/media/exercises/squat-back-barbell/poster.webp",
  "/media/exercises/squat-back-barbell/metadata.json",
];
const PRIVATE_PATHS = new Set(["/me", "/profiles", "/exercises"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    PRIVATE_PATHS.has(url.pathname) ||
    url.pathname.startsWith("/profiles/") ||
    event.request.headers.has("authorization") ||
    event.request.headers.has("cookie")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match("/"))),
  );
});
