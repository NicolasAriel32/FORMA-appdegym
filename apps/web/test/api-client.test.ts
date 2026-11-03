import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchCurrentUser,
  readApiBaseUrl,
} from "../src/platform/api-client.js";

test("API base URL is optional, validated, and normalized", () => {
  assert.equal(readApiBaseUrl({}), undefined);
  assert.equal(readApiBaseUrl({ VITE_FORMA_API_URL: "ftp://forma.test" }), undefined);
  assert.equal(
    readApiBaseUrl({ VITE_FORMA_API_URL: " https://api.forma.test/// " }),
    "https://api.forma.test",
  );
});

test("current user requests use the bearer token and never permit cache reuse", async () => {
  let receivedUrl = "";
  let receivedInit: RequestInit | undefined;
  const user = {
    id: "internal-user-1",
    email: "member@example.test",
    role: "member",
    createdAt: "2026-11-03T00:00:00.000Z",
  };

  const result = await fetchCurrentUser({
    apiBaseUrl: "https://api.forma.test",
    accessToken: "access-token",
    fetchImpl: async (input, init) => {
      receivedUrl = String(input);
      receivedInit = init;
      return new Response(JSON.stringify(user), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.deepEqual(result, user);
  assert.equal(receivedUrl, "https://api.forma.test/me");
  assert.equal(receivedInit?.cache, "no-store");
  assert.equal(
    new Headers(receivedInit?.headers).get("authorization"),
    "Bearer access-token",
  );
});

test("API errors fail closed and malformed identities are rejected", async () => {
  await assert.rejects(
    () => fetchCurrentUser({
      apiBaseUrl: "https://api.forma.test",
      accessToken: "access-token",
      fetchImpl: async () => new Response("", { status: 401 }),
    }),
    { code: "unauthenticated" },
  );

  await assert.rejects(
    () => fetchCurrentUser({
      apiBaseUrl: "https://api.forma.test",
      accessToken: "access-token",
      fetchImpl: async () => new Response(JSON.stringify({ id: "missing-role" }), { status: 200 }),
    }),
    { code: "invalid_response" },
  );
});
