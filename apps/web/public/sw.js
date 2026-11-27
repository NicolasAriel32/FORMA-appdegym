const CACHE_NAME = "forma-shell-v31";
const EXERCISE_VIDEOS = new Set([
  "/media/exercises/squat-back-barbell/repetition-pilot.mp4",
  "/media/exercises/bench-press-barbell/repetition-pilot.mp4",
  "/media/exercises/romanian-deadlift-barbell/repetition-pilot.mp4",
  "/media/exercises/bent-over-barbell-row/repetition-pilot.mp4",
  "/media/exercises/leg-press-45/repetition-pilot.mp4",
  "/media/exercises/deadlift-conventional/repetition-pilot.mp4",
  "/media/exercises/pull-up/repetition-pilot.mp4",
  "/media/exercises/lat-pulldown/repetition-pilot.mp4",
  "/media/exercises/overhead-press/repetition-pilot.mp4",
  "/media/exercises/incline-dumbbell-press/repetition-pilot.mp4",
  "/media/exercises/triceps-pushdown/repetition-pilot.mp4",
  "/media/exercises/dumbbell-lunge/repetition-pilot.mp4",
  "/media/exercises/leg-extension/repetition-pilot.mp4",
  "/media/exercises/lying-leg-curl/repetition-pilot.mp4",
  "/media/exercises/hip-thrust/repetition-pilot.mp4",
  "/media/exercises/one-arm-dumbbell-row/repetition-pilot.mp4",
  "/media/exercises/seated-cable-row/repetition-pilot.mp4",
  "/media/exercises/lateral-raise/repetition-pilot.mp4",
  "/media/exercises/face-pull/repetition-pilot.mp4",
  "/media/exercises/barbell-curl/repetition-pilot.mp4",
  "/media/exercises/dumbbell-curl/repetition-pilot.mp4",
  "/media/exercises/hammer-curl/repetition-pilot.mp4",
  "/media/exercises/skull-crusher/repetition-pilot.mp4",
]);
// Solo la app en sí se descarga al instalar. Los videos y portadas de ejercicios
// se guardan recién cuando el usuario abre ese ejercicio (ahorra ~5 MB de datos
// móviles en la primera visita) y viven en un caché propio que no se borra
// cuando se actualiza la app.
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/forma-icon-180.png",
  "/forma-icon-192.png",
  "/forma-icon-512.png",
];
// Subir MEDIA_VERSION solo cuando se reemplaza un video o una portada existente.
const MEDIA_VERSION = 1;
const MEDIA_CACHE = `forma-media-v${MEDIA_VERSION}`;
const EXERCISE_POSTER = /^\/media\/exercises\/[a-z0-9-]+\/(?:poster|photo)\.webp$/;
const ROUTINE_PHOTO = /^\/media\/routines\/[a-z0-9-]+\.webp$/;
// Fotos de las miniaturas de la lista de ejercicios.
const EXERCISE_PHOTOS = [
  "/media/exercises/barbell-curl/photo.webp",
  "/media/exercises/bench-press-barbell/photo.webp",
  "/media/exercises/deadlift-conventional/photo.webp",
  "/media/exercises/dumbbell-curl/photo.webp",
  "/media/exercises/dumbbell-lunge/photo.webp",
  "/media/exercises/face-pull/photo.webp",
  "/media/exercises/hammer-curl/photo.webp",
  "/media/exercises/hip-thrust/photo.webp",
  "/media/exercises/incline-dumbbell-press/photo.webp",
  "/media/exercises/lat-pulldown/photo.webp",
  "/media/exercises/lateral-raise/photo.webp",
  "/media/exercises/leg-extension/photo.webp",
  "/media/exercises/leg-press-45/photo.webp",
  "/media/exercises/lying-leg-curl/photo.webp",
  "/media/exercises/one-arm-dumbbell-row/photo.webp",
  "/media/exercises/overhead-press/photo.webp",
  "/media/exercises/pull-up/photo.webp",
  "/media/exercises/romanian-deadlift-barbell/photo.webp",
  "/media/exercises/seated-cable-row/photo.webp",
  "/media/exercises/skull-crusher/photo.webp",
  "/media/exercises/squat-back-barbell/photo.webp",
  "/media/exercises/triceps-pushdown/photo.webp",
];
const EXERCISE_MEDIA = [...[...EXERCISE_VIDEOS].flatMap((video) => [video, video.replace(/repetition-pilot\.mp4$/, "poster.webp")]), ...EXERCISE_PHOTOS];
// Tamaño total de EXERCISE_MEDIA en bytes; lo calcula el build (0 en desarrollo).
const EXERCISE_MEDIA_BYTES = Number("/* media bytes */") || 0;
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
      .then((keys) => Promise.all(keys.filter((key) => (key.startsWith("forma-shell-") && key !== CACHE_NAME) || (key.startsWith("forma-media-") && key !== MEDIA_CACHE)).map((key) => caches.delete(key))))
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

  if (EXERCISE_POSTER.test(url.pathname) || ROUTINE_PHOTO.test(url.pathname)) {
    event.respondWith(cacheMediaOnFirstUse(event.request, url.pathname));
    return;
  }

  if (OFFLINE_PATHS.has(url.pathname)) {
    event.respondWith(matchShell(url.pathname).then((cached) => cached ?? fetch(event.request)));
  }
});

async function matchShell(path) {
  return (await caches.open(CACHE_NAME)).match(path);
}

async function cacheMediaOnFirstUse(request, path) {
  const cache = await caches.open(MEDIA_CACHE);
  const cached = await cache.match(path);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.status === 200) await cache.put(path, response.clone());
  return response;
}

async function serveExerciseVideo(request, path) {
  const cache = await caches.open(MEDIA_CACHE);
  let cached = await cache.match(path);
  if (!cached) {
    // Primera vez: se baja el video completo una sola vez y se guarda para usarlo sin conexión.
    let full;
    try {
      full = await fetch(path);
    } catch {
      return fetch(request);
    }
    if (!full.ok || full.status !== 200) return full;
    await cache.put(path, full.clone());
    cached = full;
  }

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

// Botón "Descargar ejercicios": la app pide el estado o la descarga por un MessageChannel.
self.addEventListener("message", (event) => {
  const port = event.ports[0];
  const type = event.data?.type;
  if (!port) return;
  if (type === "media-status") {
    event.waitUntil(mediaStatus().then((status) => port.postMessage({ type: "status", ...status })));
  } else if (type === "download-media") {
    event.waitUntil(downloadAllMedia(port));
  }
});

async function mediaStatus() {
  const cache = await caches.open(MEDIA_CACHE);
  const saved = new Set((await cache.keys()).map((request) => new URL(request.url).pathname));
  const savedExercises = [...EXERCISE_VIDEOS].filter((video) => saved.has(video) && saved.has(video.replace(/repetition-pilot\.mp4$/, "poster.webp"))).length;
  return { cached: EXERCISE_MEDIA.filter((path) => saved.has(path)).length, total: EXERCISE_MEDIA.length, exercises: EXERCISE_VIDEOS.size, savedExercises, bytes: EXERCISE_MEDIA_BYTES };
}

const downloadListeners = new Set();
let runningDownload = null;

function downloadAllMedia(port) {
  downloadListeners.add(port);
  runningDownload ??= runMediaDownload().finally(() => {
    runningDownload = null;
    downloadListeners.clear();
  });
  return runningDownload;
}

function notifyDownload(message) {
  for (const port of downloadListeners) port.postMessage(message);
}

async function runMediaDownload() {
  const cache = await caches.open(MEDIA_CACHE);
  const saved = new Set((await cache.keys()).map((request) => new URL(request.url).pathname));
  const pending = EXERCISE_MEDIA.filter((path) => !saved.has(path));
  let done = EXERCISE_MEDIA.length - pending.length;
  let failed = 0;
  notifyDownload({ type: "progress", done, total: EXERCISE_MEDIA.length });

  // De a 3 archivos a la vez: rápido sin saturar conexiones lentas.
  const queue = [...pending];
  const worker = async () => {
    for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
      try {
        const response = await fetch(path, { cache: "no-cache" });
        if (!response.ok || response.status !== 200) throw new Error(`HTTP ${response.status}`);
        await cache.put(path, response);
        done += 1;
      } catch {
        failed += 1;
      }
      notifyDownload({ type: "progress", done, total: EXERCISE_MEDIA.length });
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  notifyDownload({ type: "done", done, total: EXERCISE_MEDIA.length, failed });
}
