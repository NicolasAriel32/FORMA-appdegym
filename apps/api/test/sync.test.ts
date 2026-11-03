import assert from "node:assert/strict";
import { once } from "node:events";
import test, { after, before } from "node:test";
import type { AddressInfo } from "node:net";
import { createApiServer } from "../src/http/create-server.js";
import { InMemoryIdentityRepository } from "../src/modules/identity/repository.js";
import { IdentityService } from "../src/modules/identity/service.js";
import { SyncService } from "../src/modules/sync/service.js";
import type { SyncOperationInput, SyncRepository } from "../src/modules/sync/types.js";
import type { UserId } from "../src/modules/identity/types.js";

const operationId = "11111111-1111-4111-8111-111111111111";
const aggregateId = "22222222-2222-4222-8222-222222222222";
let baseUrl: string;
let received: SyncOperationInput | undefined;

const syncRepository: SyncRepository = {
  processOperation: async (ownerId, operation) => {
    received = operation;
    return { operationId: operation.operationId, receiptId: "33333333-3333-4333-8333-333333333333", status: "applied", nextCursor: ownerId === "sync-owner-1" ? "1" : "0" };
  },
  listChanges: async (scopeId, afterCursor, _limit) => ({ scopeId, fromCursor: afterCursor, nextCursor: "0", changes: [] }),
};

const server = createApiServer({
  identityService: new IdentityService(
    new InMemoryIdentityRepository(),
    (() => {
      let sequence = 0;
      return () => `sync-owner-${++sequence}` as UserId;
    })(),
    () => "2026-11-03T00:00:00.000Z",
  ),
  resolvePrincipal: async (authorizationHeader) => {
    const token = authorizationHeader?.replace("Bearer test:", "");
    return token === undefined || token === authorizationHeader ? undefined : { provider: "test-auth", subject: token };
  },
  syncService: new SyncService(syncRepository),
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

test("sync operations require authentication", async () => {
  const response = await fetch(`${baseUrl}/sync/changes`);
  assert.equal(response.status, 401);
});

test("sync operation validation rejects malformed identifiers", async () => {
  const response = await fetch(`${baseUrl}/sync/operations`, {
    method: "POST",
    headers: { authorization: "Bearer test:member-1", "content-type": "application/json" },
    body: JSON.stringify({ operationId: "not-a-uuid" }),
  });
  assert.equal(response.status, 400);
  assert.equal(received, undefined);
});

test("sync endpoint returns a server receipt and never trusts client identity", async () => {
  const response = await fetch(`${baseUrl}/sync/operations`, {
    method: "POST",
    headers: { authorization: "Bearer test:member-2", "content-type": "application/json" },
    body: JSON.stringify({
      operationId,
      clientInstanceId: "device-1",
      aggregateType: "workout_session",
      aggregateId,
      sequence: 0,
      baseRevision: 0,
      contractVersion: "workout-session-v1",
      payload: { kind: "workout_session_started" },
      createdAt: "2026-11-03T00:00:00.000Z",
    }),
  });
  const body = (await response.json()) as { operationId: string; receiptId: string; status: string; nextCursor: string };
  assert.equal(response.status, 200);
  assert.deepEqual(body, { operationId, receiptId: "33333333-3333-4333-8333-333333333333", status: "applied", nextCursor: "0" });
  assert.equal(received?.operationId, operationId);
  assert.equal(received?.aggregateId, aggregateId);
});

test("sync cursor validation rejects non-numeric cursors", async () => {
  const response = await fetch(`${baseUrl}/sync/changes?cursor=abc`, { headers: { authorization: "Bearer test:member-3" } });
  assert.equal(response.status, 400);
});
