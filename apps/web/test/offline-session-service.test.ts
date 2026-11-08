import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { indexedDB } from "fake-indexeddb";
import {
  getOutboxOperation,
  getSession,
  getWorkoutPlan,
  listOutboxOperations,
  openLocalDatabase,
} from "../src/platform/local-db.js";
import { appendOfflineWorkoutSet, finishOfflineWorkoutSession, startOfflineWorkoutSession } from "../src/workout/offline-session-service.js";
import type { ExerciseId, SessionId, SetId, UserId } from "../../../packages/domain/src/workout.js";

test("starting a workout offline persists the session and outbox together", async () => {
  const database = await openLocalDatabase(indexedDB, `forma-test-${randomUUID()}`);
  try {
    const plan = { name: "Plan de fuerza", exercises: [{ id: "exercise-2", name: "Remo", muscle: "Espalda", color: "green", targetSets: 4 }] };
    const result = await startOfflineWorkoutSession({
      database,
      ownerId: "user-1" as UserId,
      sessionId: "session-1" as SessionId,
      operationId: "operation-1",
      clientInstanceId: "client-1",
      createdAt: "2026-11-03T10:00:00.000Z",
      startedAt: "2026-11-03T10:01:00.000Z",
      plan,
    });

    assert.equal(result.session.status, "in_progress");
    assert.equal(result.operation.state, "pending");
    assert.equal(result.operation.payload.startEvidence, "local_time_unverified");
    assert.deepEqual(await getSession(database, "session-1"), result.session);
    assert.deepEqual(await getOutboxOperation(database, "operation-1"), result.operation);
    assert.deepEqual(await getWorkoutPlan(database, result.session.id), { ...plan, sessionId: result.session.id });
  } finally {
    database.close();
  }
});

test("offline set and finish commands preserve aggregate ordering", async () => {
  const database = await openLocalDatabase(indexedDB, `forma-test-${randomUUID()}`);
  try {
    await startOfflineWorkoutSession({
      database,
      ownerId: "user-1" as UserId,
      sessionId: "session-1" as SessionId,
      operationId: "operation-1",
      clientInstanceId: "client-1",
      createdAt: "2026-11-03T10:00:00.000Z",
      startedAt: "2026-11-03T10:01:00.000Z",
    });
    const exerciseId = "exercise-1" as ExerciseId;
    await appendOfflineWorkoutSet({
      database,
      ownerId: "user-1" as UserId,
      sessionId: "session-1" as SessionId,
      operationId: "operation-2",
      clientInstanceId: "client-1",
      setId: "set-1" as SetId,
      exercise: { id: exerciseId, status: "published" },
      exerciseId,
      repetitions: 8,
      loadKg: 80,
      createdAt: "2026-11-03T10:02:00.000Z",
    });
    const finished = await finishOfflineWorkoutSession({
      database,
      ownerId: "user-1" as UserId,
      sessionId: "session-1" as SessionId,
      operationId: "operation-3",
      clientInstanceId: "client-1",
      finishedAt: "2026-11-03T10:03:00.000Z",
    });
    assert.equal(finished.session.status, "finished_local");
    assert.deepEqual((await listOutboxOperations(database)).map((operation) => operation.sequence), [0, 1, 2]);
    assert.equal((await getSession(database, "session-1"))?.sets.length, 1);
  } finally {
    database.close();
  }
});


test("concurrent set commands cannot overwrite a committed set", async () => {
  const database = await openLocalDatabase(indexedDB, `forma-test-${randomUUID()}`);
  const ownerId = "user-1" as UserId;
  const sessionId = "session-1" as SessionId;
  const exerciseId = "exercise-1" as ExerciseId;
  const createdAt = "2026-11-03T10:00:00.000Z";
  try {
    const start = { database, ownerId, sessionId, operationId: "start", clientInstanceId: "client-1", createdAt, startedAt: createdAt };
    await startOfflineWorkoutSession(start);
    const input = { database, ownerId, sessionId, clientInstanceId: "client-1", exerciseId, exercise: { id: exerciseId, status: "published" as const }, repetitions: 8, loadKg: 80, createdAt };
    const results = await Promise.allSettled([
      appendOfflineWorkoutSet({ ...input, operationId: "append-1", setId: "set-1" as SetId }),
      appendOfflineWorkoutSet({ ...input, operationId: "append-2", setId: "set-2" as SetId }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    await startOfflineWorkoutSession(start);
    assert.equal((await getSession(database, sessionId))?.sets.length, 1);
    assert.deepEqual((await listOutboxOperations(database)).map((operation) => operation.sequence).sort(), [0, 1]);
  } finally {
    database.close();
  }
});
