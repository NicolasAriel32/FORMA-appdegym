import {
  createPreparedSession,
  startSession,
  type SessionId,
  type UserId,
  type WorkoutSession,
} from "../../../../packages/domain/src/workout.js";
import {
  createPendingOperation,
  type SyncOperation,
} from "../../../../packages/sync/src/outbox.js";
import {
  persistSessionAndOperation,
  type LocalDatabase,
} from "../platform/local-db.js";

export type OfflineSessionStartInput = {
  database: LocalDatabase;
  ownerId: UserId;
  sessionId: SessionId;
  operationId: string;
  clientInstanceId: string;
  createdAt: string;
  startedAt: string;
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

  await persistSessionAndOperation(database, session, operation);
  return { session, operation };
}
