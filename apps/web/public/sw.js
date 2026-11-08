const CACHE_NAME = "forma-shell-v9";
const EXERCISE_VIDEOS = new Set([
  "/media/exercises/squat-back-barbell/repetition-pilot.mp4",
  "/media/exercises/bench-press-barbell/repetition-pilot.mp4",
  "/media/exercises/romanian-deadlift-barbell/repetition-pilot.mp4",
]);
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/forma-icon-180.png",
  "/forma-icon-192.png",
  "/forma-icon-512.png",
  ...EXERCISE_VIDEOS,
  "/media/exercises/bench-press-barbell/poster.webp",
  "/media/exercises/romanian-deadlift-barbell/poster.webp",
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
const BUILD_ASSETS = [/* build assets */];
const OFFLINE_PATHS = new Set([...SHELL, ...BUILD_ASSETS]);
const PRIVATE_PATHS = new Set(["/me", "/profiles", "/exercises"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([...OFFLINE_PATHS])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("forma-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
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

  if (EXERCISE_VIDEOS.has(url.pathname)) {
    event.respondWith(serveExerciseVideo(event.request, url.pathname));
    return;
  }

  if (OFFLINE_PATHS.has(url.pathname)) {
    event.respondWith(matchShell(url.pathname).then((cached) => cached ?? fetch(event.request)));
  }
});

async function matchShell(path) {
  return (await caches.open(CACHE_NAME)).match(path);
}

async function serveExerciseVideo(request, path) {
  const cached = await matchShell(path);
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
