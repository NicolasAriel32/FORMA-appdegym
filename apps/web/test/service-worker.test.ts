import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const serviceWorker = readFileSync(
  resolve(process.cwd(), "apps/web/public/sw.js"),
  "utf8",
);

test("service worker does not cache authenticated or private API responses", () => {
  assert.match(serviceWorker, /PRIVATE_PATHS/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/profiles\/"\)/);
  assert.match(serviceWorker, /event\.request\.headers\.has\("authorization"\)/);
  assert.match(serviceWorker, /event\.request\.headers\.has\("cookie"\)/);
});

test("service worker does not download every exercise video on install", () => {
  const shell = serviceWorker.slice(serviceWorker.indexOf("const SHELL = ["), serviceWorker.indexOf("];", serviceWorker.indexOf("const SHELL = [")));
  assert.doesNotMatch(shell, /EXERCISE_VIDEOS/);
  assert.doesNotMatch(shell, /\.mp4|\.webp/);
});

test("exercise media lives in its own cache that survives app updates", () => {
  assert.match(serviceWorker, /const MEDIA_CACHE = `forma-media-v\$\{MEDIA_VERSION\}`/);
  assert.match(serviceWorker, /key\.startsWith\("forma-media-"\) && key !== MEDIA_CACHE/);
  assert.match(serviceWorker, /cache\.put\(path, full\.clone\(\)\)/);
});

test("download-media message saves every exercise video and poster, then reports status", async () => {
  const { runInNewContext } = await import("node:vm");
  const stored = new Map<string, Response>();
  const listeners = new Map<string, (event: unknown) => void>();
  const fetched: string[] = [];
  const cache = {
    keys: async () => [...stored.keys()].map((path) => new Request(`https://forma.test${path}`)),
    match: async (path: string) => stored.get(path),
    put: async (path: string, response: Response) => { stored.set(path, response); },
  };
  runInNewContext(serviceWorker, {
    self: { addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener), location: { origin: "https://forma.test" } },
    caches: { open: async () => cache },
    fetch: async (path: string) => { fetched.push(path); return new Response(path.endsWith("hip-thrust/poster.webp") && fetched.filter((item) => item === path).length === 1 ? null : "ok", { status: path.endsWith("hip-thrust/poster.webp") && fetched.filter((item) => item === path).length === 1 ? 503 : 200 }); },
    URL, Request, Response, Number, Set, Promise,
  });

  const send = (type: string) => new Promise<unknown[]>((resolveMessages) => {
    const messages: unknown[] = [];
    const waits: Promise<unknown>[] = [];
    listeners.get("message")!({
      data: { type },
      ports: [{ postMessage: (message: unknown) => messages.push(message) }],
      waitUntil: (promise: Promise<unknown>) => waits.push(promise),
    });
    void Promise.all(waits).then(() => resolveMessages(messages));
  });

  const videos = (serviceWorker.match(/repetition-pilot\.mp4"/g) ?? []).length;
  const photos = (serviceWorker.match(/photo\.webp"/g) ?? []).length;
  const files = videos * 2 + photos;
  const first = await send("download-media");
  const done = first.at(-1) as { type: string; done: number; total: number; failed: number };
  assert.equal(done.type, "done");
  assert.equal(done.total, files);
  assert.equal(done.failed, 1, "un archivo que falla se informa y no corta la descarga");
  assert.equal(stored.size, files - 1);

  const retry = await send("download-media");
  assert.deepEqual(JSON.parse(JSON.stringify(retry.at(-1))), { type: "done", done: files, total: files, failed: 0 });
  assert.equal(fetched.length, files + 1, "el reintento solo baja lo que faltaba");

  const [status] = await send("media-status") as Array<{ savedExercises: number; exercises: number }>;
  assert.equal(status!.savedExercises, videos);
  assert.equal(status!.exercises, videos);
});
