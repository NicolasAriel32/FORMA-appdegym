import assert from "node:assert/strict";
import { once } from "node:events";
import test, { after, before } from "node:test";
import type { AddressInfo } from "node:net";
import { createApiServer } from "../src/http/create-server.js";
import { InMemoryIdentityRepository } from "../src/modules/identity/repository.js";
import { IdentityService } from "../src/modules/identity/service.js";
import type { UserId } from "../src/modules/identity/types.js";

let baseUrl: string;
const identityService = new IdentityService(
  new InMemoryIdentityRepository(),
  (() => {
    let sequence = 0;
    return () => `user-${++sequence}` as UserId;
  })(),
  () => "2026-11-03T00:00:00.000Z",
);

const server = createApiServer({
  identityService,
  resolvePrincipal: (authorizationHeader) => {
    const token = authorizationHeader?.replace("Bearer test:", "");
    return token === undefined || token === authorizationHeader
      ? undefined
      : { provider: "test-auth", subject: token, email: `${token}@example.test` };
  },
});

before(async () => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  server.close();
  await once(server, "close");
});

test("health endpoint is public", async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("personal endpoint requires authentication", async () => {
  const response = await fetch(`${baseUrl}/me`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "unauthenticated" });
});

test("me resolves a stable internal identity and does not expose external subject", async () => {
  const headers = { authorization: "Bearer test:member-1" };
  const first = await fetch(`${baseUrl}/me`, { headers });
  const second = await fetch(`${baseUrl}/me`, { headers });
  const firstBody = (await first.json()) as Record<string, unknown>;
  const secondBody = (await second.json()) as Record<string, unknown>;

  assert.equal(first.status, 200);
  assert.equal(firstBody.id, secondBody.id);
  assert.equal(firstBody.email, "member-1@example.test");
  assert.equal("externalSubject" in firstBody, false);
});

test("a user cannot read another user's profile", async () => {
  const member = await fetch(`${baseUrl}/me`, {
    headers: { authorization: "Bearer test:member-2" },
  });
  const memberBody = (await member.json()) as { id: string };

  const response = await fetch(`${baseUrl}/profiles/${memberBody.id}`, {
    headers: { authorization: "Bearer test:member-1" },
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "forbidden" });
});

test("invalid external identity data is rejected", async () => {
  const response = await fetch(`${baseUrl}/me`, {
    headers: { authorization: "Bearer test:" },
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "invalid_identity" });
});
