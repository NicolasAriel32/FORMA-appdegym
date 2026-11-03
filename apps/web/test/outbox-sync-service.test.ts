import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { indexedDB } from "fake-indexeddb";
import { getOutboxOperation, openLocalDatabase } from "../src/platform/local-db.js";
import { drainOutbox } from "../src/workout/outbox-sync-service.js";
import { startOfflineWorkoutSession } from "../src/workout/offline-session-service.js";
import type { SessionId, UserId } from "../../../packages/domain/src/workout.js";

async function createDatabase() {
  return openLocalDatabase(indexedDB, `forma-sync-test-${randomUUID()}`);
}

test("outbox drain confirms only after a matching server receipt", async () => {
  const database = await createDatabase();
  try {
    const created = await startOfflineWorkoutSession({ database, ownerId: "user-1" as UserId, sessionId: "session-1" as SessionId, operationId: "operation-1", clientInstanceId: "client-1", createdAt: "2026-11-03T10:00:00.000Z", startedAt: "2026-11-03T10:01:00.000Z" });
    let requestInit: RequestInit | undefined;
    const result = await drainOutbox({
      database,
      apiBaseUrl: "https://api.forma.test",
      accessToken: "access-token",
      fetchImpl: async (_input, init) => {
        requestInit = init;
        return new Response(JSON.stringify({ operationId: "operation-1", receiptId: "receipt-1", status: "applied", nextCursor: "1" }), { status: 200 });
      },
    });
    assert.deepEqual(result, { confirmed: 1, retryable: 0, blocked: 0, recoveryRequired: 0 });
    assert.equal((await getOutboxOperation(database, created.operation.operationId))?.state, "confirmed");
    assert.equal(requestInit?.cache, "no-store");
    assert.equal(new Headers(requestInit?.headers).get("authorization"), "Bearer access-token");
  } finally {
    database.close();
  }
});

test("outbox drain preserves a pending operation after a transport failure", async () => {
  const database = await createDatabase();
  try {
    await startOfflineWorkoutSession({ database, ownerId: "user-1" as UserId, sessionId: "session-1" as SessionId, operationId: "operation-1", clientInstanceId: "client-1", createdAt: "2026-11-03T10:00:00.000Z", startedAt: "2026-11-03T10:01:00.000Z" });
    const result = await drainOutbox({ database, apiBaseUrl: "https://api.forma.test", accessToken: "access-token", fetchImpl: async () => { throw new TypeError("offline"); } });
    assert.deepEqual(result, { confirmed: 0, retryable: 1, blocked: 0, recoveryRequired: 0 });
    assert.equal((await getOutboxOperation(database, "operation-1"))?.state, "retryable_error");
  } finally {
    database.close();
  }
});

test("outbox drain preserves an incompatible server response for recovery", async () => {
  const database = await createDatabase();
  try {
    await startOfflineWorkoutSession({ database, ownerId: "user-1" as UserId, sessionId: "session-1" as SessionId, operationId: "operation-1", clientInstanceId: "client-1", createdAt: "2026-11-03T10:00:00.000Z", startedAt: "2026-11-03T10:01:00.000Z" });
    const result = await drainOutbox({ database, apiBaseUrl: "https://api.forma.test", accessToken: "access-token", fetchImpl: async () => new Response(JSON.stringify({ operationId: "operation-1", receiptId: "receipt-1", status: "conflict", nextCursor: "0" }), { status: 200 }) });
    assert.deepEqual(result, { confirmed: 0, retryable: 0, blocked: 0, recoveryRequired: 1 });
    assert.equal((await getOutboxOperation(database, "operation-1"))?.state, "recovery_required");
  } finally {
    database.close();
  }
});
