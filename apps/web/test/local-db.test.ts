import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { indexedDB } from "fake-indexeddb";
import {
  getOutboxOperation,
  getSession,
  getSyncMetadata,
  listOutboxOperations,
  listCachedExercises,
  openLocalDatabase,
  persistSessionAndOperation,
  savePublishedExercises,
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

test("reusing an outbox operation id with different content aborts the transaction", async () => {
  const database = await openLocalDatabase(indexedDB, `forma-test-${randomUUID()}`);
  try {
    await persistSessionAndOperation(database, session(), operation());

    await assert.rejects(() =>
      persistSessionAndOperation(database, {
        ...session(),
        id: "session-2" as WorkoutSession["id"],
      }, {
        ...operation(),
        aggregateId: "session-2",
      }),
      /operation id reused with different content/,
    );

    assert.deepEqual(await getSession(database, "session-2"), undefined);
    assert.deepEqual(await getOutboxOperation(database, "op-1"), operation());
  } finally {
    database.close();
  }
});

test("published catalog entries persist locally without a delete pass", async () => {
  const database = await openLocalDatabase(indexedDB, `forma-test-${randomUUID()}`);
  try {
    const exercise = {
      id: "exercise-1",
      slug: "squat",
      name: "Sentadilla",
      description: "",
      status: "published" as const,
      createdAt: "2026-11-03T00:00:00.000Z",
      publishedAt: "2026-11-03T00:00:00.000Z",
      retiredAt: null,
      movementPattern: "squat",
      targetMuscles: ["quadriceps"],
      secondaryMuscles: ["gluteus maximus"],
      instructions: "Descender con control",
      commonMistakes: ["Colapsar rodillas"],
      safetyNotes: ["Usar carga controlable"],
      equipment: "barbell",
      difficulty: "intermediate" as const,
    };
    await savePublishedExercises(database, [exercise]);
    await savePublishedExercises(database, []);
    assert.deepEqual(await listCachedExercises(database), [exercise]);
  } finally {
    database.close();
  }
});
