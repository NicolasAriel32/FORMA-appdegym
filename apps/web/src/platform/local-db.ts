import type { IDBFactory, IDBDatabase, IDBRequest, IDBTransaction } from "fake-indexeddb";
import type { WorkoutSession } from "../../../../packages/domain/src/workout.js";
import type { SyncOperation } from "../../../../packages/sync/src/outbox.js";

export const LOCAL_DATABASE_VERSION = 1;
export const LOCAL_STORE_NAMES = {
  workoutSessions: "workoutSessions",
  outbox: "outbox",
  syncMetadata: "syncMetadata",
} as const;

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
): Promise<void> {
  const transaction = database.raw.transaction(
    [LOCAL_STORE_NAMES.workoutSessions, LOCAL_STORE_NAMES.outbox],
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

          transaction
            .objectStore(LOCAL_STORE_NAMES.workoutSessions)
            .put(session);
          if (existing === undefined) {
            outboxStore.put(operation);
          }
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
