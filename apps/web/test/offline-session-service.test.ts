import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { indexedDB } from "fake-indexeddb";
import {
  getOutboxOperation,
  getSession,
  openLocalDatabase,
} from "../src/platform/local-db.js";
import { startOfflineWorkoutSession } from "../src/workout/offline-session-service.js";
import type { SessionId, UserId } from "../../../packages/domain/src/workout.js";

test("starting a workout offline persists the session and outbox together", async () => {
  const database = await openLocalDatabase(indexedDB, `forma-test-${randomUUID()}`);
  try {
    const result = await startOfflineWorkoutSession({
      database,
      ownerId: "user-1" as UserId,
      sessionId: "session-1" as SessionId,
      operationId: "operation-1",
      clientInstanceId: "client-1",
      createdAt: "2026-11-03T10:00:00.000Z",
      startedAt: "2026-11-03T10:01:00.000Z",
    });

    assert.equal(result.session.status, "in_progress");
    assert.equal(result.operation.state, "pending");
    assert.equal(result.operation.payload.startEvidence, "local_time_unverified");
    assert.deepEqual(await getSession(database, "session-1"), result.session);
    assert.deepEqual(await getOutboxOperation(database, "operation-1"), result.operation);
  } finally {
    database.close();
  }
});
