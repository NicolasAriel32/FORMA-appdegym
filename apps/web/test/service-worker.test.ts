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
