const CACHE_NAME = "forma-shell-v6";
const SQUAT_VIDEO = "/media/exercises/squat-back-barbell/repetition-pilot.mp4";
const SHELL = [
  "/",
  "/manifest.webmanifest",
  SQUAT_VIDEO,
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

  if (url.pathname === SQUAT_VIDEO) {
    event.respondWith(serveSquatVideo(event.request));
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

async function serveSquatVideo(request) {
  const cached = await caches.match(SQUAT_VIDEO);
  if (!cached) return fetch(request);

  const range = request.headers.get("range");
  if (!range) return cached;

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const bytes = await cached.arrayBuffer();
  const length = bytes.byteLength;
  const start = match?.[1] ? Number(match[1]) : Math.max(0, length - Number(match?.[2]));
  const end = match?.[1] && match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
  if (!match || (!match[1] && !match[2]) || start >= length || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${length}` } });
  }

  return new Response(bytes.slice(start, end + 1), {
    status: 206,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${length}`,
      "Content-Type": "video/mp4",
    },
  });
}
