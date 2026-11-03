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
