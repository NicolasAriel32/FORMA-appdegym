import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { indexedDB } from "fake-indexeddb";
import {
  getOutboxOperation,
  getSession,
  getSyncMetadata,
  listOutboxOperations,
  openLocalDatabase,
  persistSessionAndOperation,
  saveSyncMetadata,
} from "../src/platform/local-db.js";
import type { WorkoutSession } from "../../../packages/domain/src/workout.js";
import type { SyncOperation } from "../../../packages/sync/src/outbox.js";

function session(): WorkoutSession {
  return {
    id: "session-1" as WorkoutSession["id"],
    ownerId: "user-1" as WorkoutSession["ownerId"],
    status: "in_progress",
    createdAt: "2026-11-03T10:00:00.000Z",
    startedAt: "2026-11-03T10:01:00.000Z",
    finishedAt: null,
    sets: [],
  };
}

function operation(): SyncOperation {
  return {
    operationId: "op-1",
    clientInstanceId: "client-1",
    aggregateType: "workout_session",
    aggregateId: "session-1",
    sequence: 0,
    baseRevision: 0,
    contractVersion: "sync-v1",
    payload: { action: "start" },
    createdAt: "2026-11-03T10:01:00.000Z",
    state: "pending",
    attemptCount: 0,
    receiptId: null,
  };
}

test("session and outbox operation persist atomically in IndexedDB", async () => {
  const database = await openLocalDatabase(indexedDB, `forma-test-${randomUUID()}`);
  try {
    await persistSessionAndOperation(database, session(), operation());

    assert.deepEqual(await getSession(database, "session-1"), session());
    assert.deepEqual(await getOutboxOperation(database, "op-1"), operation());
    assert.deepEqual(await listOutboxOperations(database), [operation()]);
  } finally {
    database.close();
  }
});

test("sync cursor metadata is durable and scoped", async () => {
  const database = await openLocalDatabase(indexedDB, `forma-test-${randomUUID()}`);
  try {
    await saveSyncMetadata(database, { scopeId: "catalog", cursor: "cursor-1" });
    assert.deepEqual(await getSyncMetadata(database, "catalog"), {
      scopeId: "catalog",
      cursor: "cursor-1",
    });
    assert.equal(await getSyncMetadata(database, "another-scope"), undefined);
  } finally {
    database.close();
  }
});

test("an invalid outbox key aborts the combined transaction", async () => {
  const database = await openLocalDatabase(indexedDB, `forma-test-${randomUUID()}`);
  try {
    await assert.rejects(() =>
      persistSessionAndOperation(database, session(), {
        ...operation(),
        payload: { invalid: Symbol("not-clonable") },
      }),
    );
    assert.equal(await getSession(database, "session-1"), undefined);
  } finally {
    database.close();
  }
});
