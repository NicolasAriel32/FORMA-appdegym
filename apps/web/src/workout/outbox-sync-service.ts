import {
  applyServerReceipt,
  markBlockedAfterTransportError,
  markRetryableAfterTransportError,
  markSending,
  type SyncOperation,
} from "../../../../packages/sync/src/outbox.js";
import { ApiClientError } from "../platform/api-client.js";
import { fetchSyncChanges, type ApiSyncReceipt, sendSyncOperation } from "../platform/sync-client.js";
import { applySyncChanges, getSyncMetadata, listOutboxOperations, saveOutboxOperation, type LocalDatabase } from "../platform/local-db.js";

export type OutboxDrainResult = {
  confirmed: number;
  retryable: number;
  blocked: number;
  recoveryRequired: number;
};

type OutboxDrainInput = {
  database: LocalDatabase;
  apiBaseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
};

const activeDrains = new WeakMap<LocalDatabase, Promise<OutboxDrainResult>>();
const activePulls = new WeakMap<LocalDatabase, Promise<number>>();

export function drainOutbox(input: OutboxDrainInput): Promise<OutboxDrainResult> {
  const running = activeDrains.get(input.database);
  if (running !== undefined) return running;
  const promise = performDrain(input).finally(() => {
    if (activeDrains.get(input.database) === promise) activeDrains.delete(input.database);
  });
  activeDrains.set(input.database, promise);
  return promise;
}

async function performDrain({
  database,
  apiBaseUrl,
  accessToken,
  fetchImpl = fetch,
}: OutboxDrainInput): Promise<OutboxDrainResult> {
  const operations = (await listOutboxOperations(database))
    .filter((operation) => operation.state !== "confirmed" && operation.state !== "blocked" && operation.state !== "recovery_required")
    .sort(compareOperations);
  const stoppedAggregates = new Set<string>();
  const result: OutboxDrainResult = { confirmed: 0, retryable: 0, blocked: 0, recoveryRequired: 0 };

  for (const original of operations) {
    if (stoppedAggregates.has(original.aggregateId)) continue;
    let operation = original;
    if (operation.state === "sending") {
      operation = markRetryableAfterTransportError(operation);
      await saveOutboxOperation(database, operation);
    }
    const sending = markSending(operation);
    await saveOutboxOperation(database, sending);
    try {
      const receipt = await sendSyncOperation({ apiBaseUrl, accessToken, operation: sending, fetchImpl });
      const next = applyServerReceipt(sending, toServerReceipt(receipt));
      await saveOutboxOperation(database, next);
      if (next.state === "confirmed") result.confirmed += 1;
      if (next.state === "retryable_error") result.retryable += 1;
      if (next.state === "blocked") result.blocked += 1;
      if (next.state === "recovery_required") result.recoveryRequired += 1;
      if (next.state !== "confirmed") stoppedAggregates.add(operation.aggregateId);
    } catch (error) {
      const next = error instanceof ApiClientError && error.code === "unavailable"
        ? markRetryableAfterTransportError(sending)
        : markBlockedAfterTransportError(sending);
      await saveOutboxOperation(database, next);
      if (next.state === "retryable_error") result.retryable += 1;
      else result.blocked += 1;
      stoppedAggregates.add(operation.aggregateId);
    }
  }
  return result;
}

export function pullSyncChanges(input: {
  database: LocalDatabase;
  scopeId: string;
  apiBaseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<number> {
  const running = activePulls.get(input.database);
  if (running !== undefined) return running;
  const promise = performPull(input).finally(() => {
    if (activePulls.get(input.database) === promise) activePulls.delete(input.database);
  });
  activePulls.set(input.database, promise);
  return promise;
}

async function performPull({ database, scopeId, apiBaseUrl, accessToken, fetchImpl = fetch }: {
  database: LocalDatabase;
  scopeId: string;
  apiBaseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<number> {
  const metadata = await getSyncMetadata(database, scopeId);
  const page = await fetchSyncChanges({ apiBaseUrl, accessToken, cursor: metadata?.cursor ?? null, fetchImpl });
  if (page.scopeId !== scopeId) throw new Error("sync page scope does not match the local identity");
  await applySyncChanges(database, page);
  return page.changes.length;
}

function toServerReceipt(receipt: ApiSyncReceipt) {
  return { operationId: receipt.operationId, receiptId: receipt.receiptId, status: receipt.status };
}

function compareOperations(left: SyncOperation, right: SyncOperation): number {
  return left.aggregateId.localeCompare(right.aggregateId) || left.sequence - right.sequence || left.createdAt.localeCompare(right.createdAt) || left.operationId.localeCompare(right.operationId);
}
