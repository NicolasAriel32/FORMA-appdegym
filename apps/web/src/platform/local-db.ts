import type { IDBFactory, IDBDatabase, IDBRequest, IDBTransaction } from "fake-indexeddb";
import type { ExerciseId, SessionId, SetId, WorkoutSession } from "../../../../packages/domain/src/workout.js";
import type { SyncOperation } from "../../../../packages/sync/src/outbox.js";
import type { ApiExercise, ApiRoutine } from "./api-client.js";
import type { ApiSyncChangesPage } from "./sync-client.js";

export const LOCAL_DATABASE_VERSION = 3;
export const LOCAL_STORE_NAMES = {
  workoutSessions: "workoutSessions",
  outbox: "outbox",
  syncMetadata: "syncMetadata",
  exercises: "exercises",
  workoutPlans: "workoutPlans",
} as const;

export type WorkoutPlanSnapshot = {
  sessionId: SessionId;
  name: string;
  exercises: { id: string; name: string; muscle: string; color: string; targetSets?: number }[];
};

export type SyncMetadata = {
  scopeId: string;
  cursor: string | null;
};

export type LocalDatabase = {
  raw: IDBDatabase;
  close: () => void;
};

export class LocalPersistenceError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "LocalPersistenceError";
  }
}

export function openLocalDatabase(
  indexedDBFactory: IDBFactory,
  databaseName: string,
): Promise<LocalDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDBFactory.open(databaseName, LOCAL_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LOCAL_STORE_NAMES.workoutSessions)) {
        const sessions = database.createObjectStore(LOCAL_STORE_NAMES.workoutSessions, {
          keyPath: "id",
        });
        sessions.createIndex("byOwnerId", "ownerId", { unique: false });
      }
      if (!database.objectStoreNames.contains(LOCAL_STORE_NAMES.outbox)) {
        const outbox = database.createObjectStore(LOCAL_STORE_NAMES.outbox, {
          keyPath: "operationId",
        });
        outbox.createIndex("byState", "state", { unique: false });
      }
      if (!database.objectStoreNames.contains(LOCAL_STORE_NAMES.syncMetadata)) {
        database.createObjectStore(LOCAL_STORE_NAMES.syncMetadata, {
          keyPath: "scopeId",
        });
      }
      if (!database.objectStoreNames.contains(LOCAL_STORE_NAMES.workoutPlans)) {
        database.createObjectStore(LOCAL_STORE_NAMES.workoutPlans, { keyPath: "sessionId" });
      }
      if (!database.objectStoreNames.contains(LOCAL_STORE_NAMES.exercises)) {
        const exercises = database.createObjectStore(LOCAL_STORE_NAMES.exercises, {
          keyPath: "id",
        });
        exercises.createIndex("byName", "name", { unique: false });
      }
    };
    request.onerror = () => reject(request.error ?? new Error("failed to open local database"));
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve({ raw: database, close: () => database.close() });
    };
  });
}

export async function persistSessionAndOperation(
  database: LocalDatabase,
  session: WorkoutSession,
  operation: SyncOperation,
  options: { plan?: WorkoutPlanSnapshot; expectedSession?: WorkoutSession | null } = {},
): Promise<void> {
  if (options.plan && options.plan.sessionId !== session.id) throw new LocalPersistenceError("workout plan does not match its session");
  const transaction = database.raw.transaction(
    [LOCAL_STORE_NAMES.workoutSessions, LOCAL_STORE_NAMES.outbox, LOCAL_STORE_NAMES.workoutPlans],
    "readwrite",
  );
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const resolveOnce = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    const rejectOnce = (error: unknown) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    transaction.oncomplete = resolveOnce;
    transaction.onerror = () => rejectOnce(
      transaction.error ?? new Error("indexedDB transaction failed"),
    );
    transaction.onabort = () => rejectOnce(
      transaction.error ?? new Error("indexedDB transaction aborted"),
    );

    try {
      const outboxStore = transaction.objectStore(LOCAL_STORE_NAMES.outbox);
      const existingRequest = outboxStore.get(operation.operationId);
      existingRequest.onerror = () => rejectOnce(
        existingRequest.error ?? new Error("failed to read outbox operation"),
      );
      existingRequest.onsuccess = () => {
        try {
          const existing = existingRequest.result as SyncOperation | undefined;
          if (
            existing !== undefined &&
            canonicalJson(existing) !== canonicalJson(operation)
          ) {
            throw new LocalPersistenceError(
              "operation id reused with different content",
            );
          }

          if (existing !== undefined) return;

          const sessions = transaction.objectStore(LOCAL_STORE_NAMES.workoutSessions);
          const currentRequest = sessions.get(session.id);
          currentRequest.onsuccess = () => {
            try {
              if (options.expectedSession !== undefined &&
                canonicalJson(currentRequest.result ?? null) !== canonicalJson(options.expectedSession)) {
                throw new LocalPersistenceError("La sesión cambió en otra pestaña. Recargá antes de volver a intentar.");
              }
              sessions.put(session);
              outboxStore.add(operation);
              if (options.plan) transaction.objectStore(LOCAL_STORE_NAMES.workoutPlans).add(options.plan);
            } catch (error) {
              rejectOnce(error);
              transaction.abort();
            }
          };
        } catch (error) {
          rejectOnce(error);
          transaction.abort();
        }
      };
    } catch (error) {
      rejectOnce(error);
      transaction.abort();
    }
  });
}

export async function getWorkoutPlan(database: LocalDatabase, sessionId: SessionId): Promise<WorkoutPlanSnapshot | undefined> {
  const transaction = database.raw.transaction(LOCAL_STORE_NAMES.workoutPlans, "readonly");
  const [plan] = await Promise.all([
    requestValue<WorkoutPlanSnapshot | undefined>(transaction.objectStore(LOCAL_STORE_NAMES.workoutPlans).get(sessionId)),
    transactionComplete(transaction),
  ]);
  return plan;
}

export async function getSession(
  database: LocalDatabase,
  sessionId: string,
): Promise<WorkoutSession | undefined> {
  const transaction = database.raw.transaction(LOCAL_STORE_NAMES.workoutSessions, "readonly");
  const complete = transactionComplete(transaction);
  const value = await requestValue<WorkoutSession | undefined>(
    transaction.objectStore(LOCAL_STORE_NAMES.workoutSessions).get(sessionId),
  );
  await complete;
  return value;
}

export async function listSessionsByOwner(
  database: LocalDatabase,
  ownerId: string,
): Promise<WorkoutSession[]> {
  const transaction = database.raw.transaction(LOCAL_STORE_NAMES.workoutSessions, "readonly");
  const complete = transactionComplete(transaction);
  const values = await requestValue<WorkoutSession[]>(
    transaction.objectStore(LOCAL_STORE_NAMES.workoutSessions).index("byOwnerId").getAll(ownerId),
  );
  await complete;
  return values;
}

export async function getOutboxOperation(
  database: LocalDatabase,
  operationId: string,
): Promise<SyncOperation | undefined> {
  const transaction = database.raw.transaction(LOCAL_STORE_NAMES.outbox, "readonly");
  const complete = transactionComplete(transaction);
  const value = await requestValue<SyncOperation | undefined>(
    transaction.objectStore(LOCAL_STORE_NAMES.outbox).get(operationId),
  );
  await complete;
  return value;
}

export async function listOutboxOperations(
  database: LocalDatabase,
): Promise<SyncOperation[]> {
  const transaction = database.raw.transaction(LOCAL_STORE_NAMES.outbox, "readonly");
  const complete = transactionComplete(transaction);
  const values = await requestValue<SyncOperation[]>(
    transaction.objectStore(LOCAL_STORE_NAMES.outbox).getAll(),
  );
  await complete;
  return values;
}

export async function saveOutboxOperation(
  database: LocalDatabase,
  operation: SyncOperation,
): Promise<void> {
  const transaction = database.raw.transaction(LOCAL_STORE_NAMES.outbox, "readwrite");
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      callback();
    };
    transaction.oncomplete = () => finish(resolve);
    transaction.onerror = () => finish(() => reject(transaction.error ?? new LocalPersistenceError("failed to save outbox operation")));
    transaction.onabort = () => finish(() => reject(transaction.error ?? new LocalPersistenceError("outbox transaction aborted")));
    try {
      const store = transaction.objectStore(LOCAL_STORE_NAMES.outbox);
      const request = store.get(operation.operationId);
      request.onerror = () => finish(() => reject(request.error ?? new LocalPersistenceError("failed to read outbox operation")));
      request.onsuccess = () => {
        const existing = request.result as SyncOperation | undefined;
        try {
          if (existing === undefined) throw new LocalPersistenceError("cannot save an unknown outbox operation");
          if (canonicalOperationContent(existing) !== canonicalOperationContent(operation)) throw new LocalPersistenceError("outbox operation content changed unexpectedly");
          store.put(operation);
        } catch (error) {
          finish(() => reject(error));
          transaction.abort();
        }
      };
    } catch (error) {
      finish(() => reject(error));
      transaction.abort();
    }
  });
}

export async function savePublishedExercises(
  database: LocalDatabase,
  exercises: readonly ApiExercise[],
): Promise<void> {
  const transaction = database.raw.transaction(LOCAL_STORE_NAMES.exercises, "readwrite");
  try {
    const store = transaction.objectStore(LOCAL_STORE_NAMES.exercises);
    for (const exercise of exercises) store.put(exercise);
  } catch (error) {
    transaction.abort();
    throw error;
  }
  await transactionComplete(transaction);
}

const publishedCatalogScope = "published-catalog";

export async function savePublishedCatalog(database: LocalDatabase, exercises: readonly ApiExercise[]): Promise<void> {
  const transaction = database.raw.transaction([LOCAL_STORE_NAMES.exercises, LOCAL_STORE_NAMES.syncMetadata], "readwrite");
  const store = transaction.objectStore(LOCAL_STORE_NAMES.exercises);
  for (const exercise of exercises) store.put(exercise);
  transaction.objectStore(LOCAL_STORE_NAMES.syncMetadata).put({
    scopeId: publishedCatalogScope, exerciseIds: exercises.map((exercise) => exercise.id),
  });
  await transactionComplete(transaction);
}

export async function readPublishedCatalog(database: LocalDatabase): Promise<ApiExercise[] | null> {
  const transaction = database.raw.transaction([LOCAL_STORE_NAMES.exercises, LOCAL_STORE_NAMES.syncMetadata], "readonly");
  const [exercises, membership] = await Promise.all([
    requestValue<ApiExercise[]>(transaction.objectStore(LOCAL_STORE_NAMES.exercises).getAll()),
    requestValue<{ exerciseIds: string[] } | undefined>(transaction.objectStore(LOCAL_STORE_NAMES.syncMetadata).get(publishedCatalogScope)),
    transactionComplete(transaction),
  ]);
  if (!membership) return null;
  const published = new Set(membership.exerciseIds);
  return exercises.filter((exercise) => exercise.status === "published" && published.has(exercise.id));
}

const personalRoutinesScope = "personal-routines";

export async function readCachedRoutines(database: LocalDatabase): Promise<ApiRoutine[] | null> {
  const transaction = database.raw.transaction(LOCAL_STORE_NAMES.syncMetadata, "readonly");
  const [snapshot] = await Promise.all([
    requestValue<{ routines: ApiRoutine[] } | undefined>(transaction.objectStore(LOCAL_STORE_NAMES.syncMetadata).get(personalRoutinesScope)),
    transactionComplete(transaction),
  ]);
  return snapshot?.routines ?? null;
}

export async function saveCachedRoutines(database: LocalDatabase, routines: ApiRoutine[]): Promise<void> {
  const transaction = database.raw.transaction(LOCAL_STORE_NAMES.syncMetadata, "readwrite");
  transaction.objectStore(LOCAL_STORE_NAMES.syncMetadata).put({ scopeId: personalRoutinesScope, routines });
  await transactionComplete(transaction);
}

export async function listCachedExercises(
  database: LocalDatabase,
): Promise<ApiExercise[]> {
  const transaction = database.raw.transaction(LOCAL_STORE_NAMES.exercises, "readonly");
  const complete = transactionComplete(transaction);
  const values = await requestValue<ApiExercise[]>(
    transaction.objectStore(LOCAL_STORE_NAMES.exercises).getAll(),
  );
  await complete;
  return values.filter((exercise) => exercise.status === "published");
}

export async function saveSyncMetadata(
  database: LocalDatabase,
  metadata: SyncMetadata,
): Promise<void> {
  const transaction = database.raw.transaction(LOCAL_STORE_NAMES.syncMetadata, "readwrite");
  try {
    transaction.objectStore(LOCAL_STORE_NAMES.syncMetadata).put(metadata);
  } catch (error) {
    transaction.abort();
    throw error;
  }
  await transactionComplete(transaction);
}

export async function getSyncMetadata(
  database: LocalDatabase,
  scopeId: string,
): Promise<SyncMetadata | undefined> {
  const transaction = database.raw.transaction(LOCAL_STORE_NAMES.syncMetadata, "readonly");
  const complete = transactionComplete(transaction);
  const value = await requestValue<SyncMetadata | undefined>(
    transaction.objectStore(LOCAL_STORE_NAMES.syncMetadata).get(scopeId),
  );
  await complete;
  return value;
}

export async function applySyncChanges(
  database: LocalDatabase,
  page: ApiSyncChangesPage,
): Promise<void> {
  const transaction = database.raw.transaction(
    [LOCAL_STORE_NAMES.workoutSessions, LOCAL_STORE_NAMES.syncMetadata],
    "readwrite",
  );
  const sessions = transaction.objectStore(LOCAL_STORE_NAMES.workoutSessions);
  const metadataStore = transaction.objectStore(LOCAL_STORE_NAMES.syncMetadata);
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      callback();
    };
    transaction.oncomplete = () => finish(resolve);
    transaction.onerror = () => finish(() => reject(transaction.error ?? new LocalPersistenceError("failed to apply sync changes")));
    transaction.onabort = () => finish(() => reject(transaction.error ?? new LocalPersistenceError("sync change transaction aborted")));
    const metadataRequest = metadataStore.get(page.scopeId);
    metadataRequest.onerror = () => finish(() => reject(metadataRequest.error ?? new LocalPersistenceError("failed to read sync cursor")));
    metadataRequest.onsuccess = () => {
      try {
        const metadata = metadataRequest.result as SyncMetadata | undefined;
        const currentCursor = metadata?.cursor ?? null;
        if (page.fromCursor !== currentCursor) throw new LocalPersistenceError("sync page starts from an unexpected cursor");
        validateSyncPage(page);
        let index = 0;
        const applyNext = () => {
          if (index >= page.changes.length) {
            metadataStore.put({ scopeId: page.scopeId, cursor: page.nextCursor } satisfies SyncMetadata);
            return;
          }
          const change = page.changes[index]!;
          index += 1;
          const sessionRequest = sessions.get(change.aggregateId);
          sessionRequest.onerror = () => finish(() => reject(sessionRequest.error ?? new LocalPersistenceError("failed to read local workout session")));
          sessionRequest.onsuccess = () => {
            try {
              const session = sessionRequest.result as WorkoutSession | undefined;
              sessions.put(applySyncChange(session, page.scopeId, change));
              applyNext();
            } catch (error) {
              finish(() => reject(error));
              transaction.abort();
            }
          };
        };
        applyNext();
      } catch (error) {
        finish(() => reject(error));
        transaction.abort();
      }
    };
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexedDB request failed"));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("indexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("indexedDB transaction aborted"));
  });
}

function validateSyncPage(page: ApiSyncChangesPage): void {
  if (page.scopeId.length === 0 || !isCursor(page.nextCursor)) throw new LocalPersistenceError("sync page cursor is invalid");
  let previous = page.fromCursor === null ? 0n : parseCursor(page.fromCursor);
  for (const change of page.changes) {
    const cursor = parseCursor(change.cursor);
    if (cursor <= previous || cursor > parseCursor(page.nextCursor)) throw new LocalPersistenceError("sync page changes are not contiguous");
    previous = cursor;
  }
}

function applySyncChange(
  session: WorkoutSession | undefined,
  ownerId: string,
  change: ApiSyncChangesPage["changes"][number],
): WorkoutSession {
  if (change.aggregateType !== "workout_session") throw new LocalPersistenceError("unsupported sync aggregate");
  const payload = change.payload;
  const kind = typeof payload.kind === "string" ? payload.kind : undefined;
  if (kind === "workout_session_started") {
    const sessionId = readString(payload.sessionId);
    const createdAt = readString(payload.createdAt);
    const startedAt = readString(payload.startedAt);
    if (sessionId === undefined || sessionId !== change.aggregateId || payload.ownerId !== ownerId || createdAt === undefined || startedAt === undefined) throw new LocalPersistenceError("invalid workout session start change");
    if (session === undefined) return { id: sessionId as SessionId, ownerId: ownerId as WorkoutSession["ownerId"], status: "in_progress", createdAt, startedAt, finishedAt: null, sets: [] };
    assertSessionOwner(session, ownerId);
    if (session.status === "finished_confirmed" || session.status === "discarded_confirmed") return session;
    return { ...session, startedAt: session.startedAt ?? startedAt, status: session.status === "prepared" ? "in_progress" : session.status };
  }
  if (session === undefined) throw new LocalPersistenceError("workout change arrived before its session");
  assertSessionOwner(session, ownerId);
  if (kind === "workout_set_added") {
    const set = readWorkoutSet(payload.set);
    if (readString(payload.sessionId) !== change.aggregateId || set === undefined) throw new LocalPersistenceError("invalid workout set change");
    const existing = session.sets.find((candidate) => candidate.id === set.id);
    if (existing !== undefined) {
      if (canonicalJson(existing) !== canonicalJson(set)) throw new LocalPersistenceError("workout set changed after publication");
      return session;
    }
    if (session.status === "finished_confirmed" || session.status === "discarded_confirmed" || session.status === "recovery_required") throw new LocalPersistenceError("cannot append a set to the local session state");
    return { ...session, sets: [...session.sets, set] };
  }
  if (kind === "workout_session_finished") {
    const finishedAt = readString(payload.finishedAt);
    if (readString(payload.sessionId) !== change.aggregateId || finishedAt === undefined) throw new LocalPersistenceError("invalid workout session finish change");
    if (session.status === "finished_confirmed") return session;
    if (session.status === "discarded_confirmed" || session.status === "recovery_required") throw new LocalPersistenceError("cannot confirm the local workout session state");
    return { ...session, status: "finished_confirmed", finishedAt };
  }
  throw new LocalPersistenceError("unsupported workout change");
}

function assertSessionOwner(session: WorkoutSession, ownerId: string): void {
  if (session.ownerId !== ownerId) throw new LocalPersistenceError("sync change owner does not match local session");
}

function readWorkoutSet(value: unknown): WorkoutSession["sets"][number] | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.exerciseId !== "string" || !Number.isSafeInteger(value.repetitions) || (value.repetitions as number) <= 0 || typeof value.loadKg !== "number" || !Number.isFinite(value.loadKg) || value.loadKg < 0 || typeof value.createdAt !== "string") return undefined;
  return { id: value.id as SetId, exerciseId: value.exerciseId as ExerciseId, repetitions: value.repetitions as number, loadKg: value.loadKg, createdAt: value.createdAt };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCursor(value: string): boolean {
  return /^\d+$/.test(value) && value.length <= 30;
}

function parseCursor(value: string): bigint {
  if (!isCursor(value)) throw new LocalPersistenceError("invalid sync cursor");
  return BigInt(value);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function canonicalOperationContent(operation: SyncOperation): string {
  return canonicalJson({
    operationId: operation.operationId,
    clientInstanceId: operation.clientInstanceId,
    aggregateType: operation.aggregateType,
    aggregateId: operation.aggregateId,
    sequence: operation.sequence,
    baseRevision: operation.baseRevision,
    contractVersion: operation.contractVersion,
    payload: operation.payload,
    createdAt: operation.createdAt,
  });
}
