import {
  addSet,
  createPreparedSession,
  finishSessionLocally,
  startSession,
  type ExerciseId,
  type SessionId,
  type SetId,
  type UserId,
  type WorkoutSet,
  type WorkoutSession,
  type OfficialExercise,
} from "../../../../packages/domain/src/workout.js";
import {
  createPendingOperation,
  type SyncOperation,
} from "../../../../packages/sync/src/outbox.js";
import {
  persistSessionAndOperation,
  getSession,
  listOutboxOperations,
  type LocalDatabase,
  type WorkoutPlanSnapshot,
} from "../platform/local-db.js";

export type OfflineSessionStartInput = {
  database: LocalDatabase;
  ownerId: UserId;
  sessionId: SessionId;
  operationId: string;
  clientInstanceId: string;
  createdAt: string;
  startedAt: string;
  plan?: Omit<WorkoutPlanSnapshot, "sessionId">;
};

export type OfflineSessionStartResult = {
  session: WorkoutSession;
  operation: SyncOperation;
};

export async function startOfflineWorkoutSession({
  database,
  ownerId,
  sessionId,
  operationId,
  clientInstanceId,
  createdAt,
  startedAt,
  plan,
}: OfflineSessionStartInput): Promise<OfflineSessionStartResult> {
  const session = startSession(
    createPreparedSession(sessionId, ownerId, createdAt),
    ownerId,
    startedAt,
  );
  const operation = createPendingOperation({
    operationId,
    clientInstanceId,
    aggregateType: "workout_session",
    aggregateId: session.id,
    sequence: 0,
    baseRevision: 0,
    contractVersion: "workout-session-v1",
    payload: {
      kind: "workout_session_started",
      startEvidence: "local_time_unverified",
      session,
    },
    createdAt: startedAt,
  });

  await persistSessionAndOperation(database, session, operation, { expectedSession: null, ...(plan ? { plan: { ...plan, sessionId } } : {}) });
  return { session, operation };
}

export type OfflineWorkoutSetInput = {
  database: LocalDatabase;
  ownerId: UserId;
  sessionId: SessionId;
  operationId: string;
  clientInstanceId: string;
  setId: SetId;
  exercise: OfficialExercise;
  exerciseId: ExerciseId;
  repetitions: number;
  loadKg: number;
  createdAt: string;
};

export async function appendOfflineWorkoutSet({
  database,
  ownerId,
  sessionId,
  operationId,
  clientInstanceId,
  setId,
  exercise,
  exerciseId,
  repetitions,
  loadKg,
  createdAt,
}: OfflineWorkoutSetInput): Promise<OfflineSessionStartResult> {
  const current = await getSession(database, sessionId);
  if (current === undefined) throw new Error("local workout session was not found");
  const set: WorkoutSet = { id: setId, exerciseId, repetitions, loadKg, createdAt };
  const session = addSet(current, ownerId, exercise, set);
  const operation = createPendingOperation({
    operationId,
    clientInstanceId,
    aggregateType: "workout_session",
    aggregateId: session.id,
    sequence: await nextSequence(database, session.id),
    baseRevision: 0,
    contractVersion: "workout-session-v1",
    payload: { kind: "workout_set_added", sessionId: session.id, set },
    createdAt,
  });
  await persistSessionAndOperation(database, session, operation, { expectedSession: current });
  return { session, operation };
}

export type FinishOfflineWorkoutSessionInput = {
  database: LocalDatabase;
  ownerId: UserId;
  sessionId: SessionId;
  operationId: string;
  clientInstanceId: string;
  finishedAt: string;
};

export async function finishOfflineWorkoutSession({
  database,
  ownerId,
  sessionId,
  operationId,
  clientInstanceId,
  finishedAt,
}: FinishOfflineWorkoutSessionInput): Promise<OfflineSessionStartResult> {
  const current = await getSession(database, sessionId);
  if (current === undefined) throw new Error("local workout session was not found");
  const session = finishSessionLocally(current, ownerId, finishedAt);
  const operation = createPendingOperation({
    operationId,
    clientInstanceId,
    aggregateType: "workout_session",
    aggregateId: session.id,
    sequence: await nextSequence(database, session.id),
    baseRevision: 0,
    contractVersion: "workout-session-v1",
    payload: { kind: "workout_session_finished", sessionId: session.id, finishedAt },
    createdAt: finishedAt,
  });
  await persistSessionAndOperation(database, session, operation, { expectedSession: current });
  return { session, operation };
}

async function nextSequence(database: LocalDatabase, aggregateId: string): Promise<number> {
  const operations = await listOutboxOperations(database);
  return operations
    .filter((operation) => operation.aggregateId === aggregateId)
    .reduce((max, operation) => Math.max(max, operation.sequence + 1), 0);
}
