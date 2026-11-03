import { randomUUID } from "node:crypto";
import type { SqlClient, TransactionalSqlClient } from "../../platform/sql-client.js";
import type {
  SyncChange,
  SyncChangesPage,
  SyncOperationInput,
  SyncReceipt,
  SyncRepository,
  SyncResultStatus,
} from "./types.js";

type SyncOperationRow = {
  operation_id: string;
  owner_id: string;
  client_instance_id: string;
  aggregate_type: string;
  aggregate_id: string;
  sequence: number | string;
  base_revision: number | string;
  contract_version: string;
  payload: unknown;
  result_status: string;
  receipt_id: string;
};

type WorkoutSessionRow = {
  id: string;
  owner_id: string;
  status: string;
  server_revision: number | string;
};

type ChangeRow = {
  cursor: number | string;
  change_id: string;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_revision: number | string;
  payload: unknown;
};

type OperationDecision = {
  status: SyncResultStatus;
  change?: { revision: number; payload: Record<string, unknown> };
};

export class PostgresSyncRepository implements SyncRepository {
  public constructor(
    private readonly client: TransactionalSqlClient,
    private readonly idFactory: () => string = () => randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async processOperation(ownerId: string, operation: SyncOperationInput): Promise<SyncReceipt> {
    return this.client.transaction(async (client) => {
      const existingResult = await client.query<SyncOperationRow>(
        `select operation_id, owner_id, client_instance_id, aggregate_type, aggregate_id,
                sequence, base_revision, contract_version, payload, result_status, receipt_id
         from public.sync_operations
         where operation_id = $1
         for update`,
        [operation.operationId],
      );
      const existing = existingResult.rows[0];
      if (existing !== undefined && !sameOperation(existing, ownerId, operation)) {
        return {
          operationId: operation.operationId,
          receiptId: existing.receipt_id,
          status: "conflict",
          nextCursor: await currentCursor(client, ownerId),
        };
      }

      const receiptId = existing?.receipt_id ?? this.idFactory();
      const shouldProcess = existing === undefined || existing.result_status === "received" || existing.result_status === "retryable";
      if (existing === undefined) {
        await client.query(
          `insert into public.sync_operations
           (operation_id, owner_id, client_instance_id, aggregate_type, aggregate_id,
            sequence, base_revision, contract_version, payload, result_status, receipt_id, created_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'received', $10, $11)`,
          [operation.operationId, ownerId, operation.clientInstanceId, operation.aggregateType, operation.aggregateId, operation.sequence, operation.baseRevision, operation.contractVersion, operation.payload, receiptId, operation.createdAt],
        );
      }

      if (!shouldProcess) {
        return {
          operationId: operation.operationId,
          receiptId,
          status: toReceiptStatus(existing?.result_status),
          nextCursor: await currentCursor(client, ownerId),
        };
      }

      const decision = await this.applyOperation(client, ownerId, operation);
      await client.query(
        `update public.sync_operations
         set result_status = $1, processed_at = $2
         where operation_id = $3`,
        [decision.status, this.now(), operation.operationId],
      );

      let nextCursor = await currentCursor(client, ownerId);
      if (decision.change !== undefined && decision.status === "applied") {
        const inserted = await client.query<{ cursor: string }>(
          `insert into public.sync_changes
           (scope_id, change_id, aggregate_type, aggregate_id, aggregate_revision, payload, is_tombstone, created_at)
           values ($1, $2, $3, $4, $5, $6, false, $7)
           returning cursor::text as cursor`,
          [ownerId, this.idFactory(), operation.aggregateType, operation.aggregateId, decision.change.revision, decision.change.payload, this.now()],
        );
        nextCursor = inserted.rows[0]?.cursor ?? nextCursor;
      }
      return { operationId: operation.operationId, receiptId, status: decision.status, nextCursor };
    });
  }

  async listChanges(scopeId: string, afterCursor: string | null, limit: number): Promise<SyncChangesPage> {
    return this.client.transaction(async (client) => {
      const result = await client.query<ChangeRow>(
        `select cursor::text as cursor, change_id, aggregate_type, aggregate_id,
                aggregate_revision, payload
         from public.sync_changes
         where scope_id = $1 and cursor > coalesce($2::bigint, 0)
         order by cursor asc
         limit $3`,
        [scopeId, afterCursor, limit],
      );
      const nextCursor = await currentCursor(client, scopeId);
      return {
        scopeId,
        fromCursor: afterCursor,
        nextCursor: result.rows.at(-1)?.cursor === undefined ? nextCursor : String(result.rows.at(-1)!.cursor),
        changes: result.rows.map(toChange),
      };
    });
  }

  private async applyOperation(
    client: SqlClient,
    ownerId: string,
    operation: SyncOperationInput,
  ): Promise<OperationDecision> {
    if (operation.aggregateType !== "workout_session" || operation.contractVersion !== "workout-session-v1") {
      return { status: "unsupported" };
    }
    const kind = readString(operation.payload.kind);
    if (kind === "workout_session_started") return this.applyStart(client, ownerId, operation);
    if (kind === "workout_set_added") return this.applySet(client, ownerId, operation);
    if (kind === "workout_session_finished") return this.applyFinish(client, ownerId, operation);
    return { status: "unsupported" };
  }

  private async applyStart(client: SqlClient, ownerId: string, operation: SyncOperationInput): Promise<OperationDecision> {
    const kind = "workout_session_started";
    if (operation.sequence !== 0 || operation.baseRevision !== 0 || operation.payload.startEvidence !== "local_time_unverified") return { status: "conflict" };
    const session = readRecord(operation.payload.session);
    if (session === undefined || session.id !== operation.aggregateId || session.ownerId !== ownerId || session.status !== "in_progress" || !Array.isArray(session.sets) || session.sets.length !== 0) return { status: "conflict" };
    const startedAt = readTimestamp(session.startedAt);
    const createdAt = readTimestamp(session.createdAt);
    const existing = await client.query<WorkoutSessionRow>(
      `select id, owner_id, status, server_revision from public.workout_sessions where id = $1 for update`,
      [operation.aggregateId],
    );
    if (existing.rows[0] !== undefined) return { status: "conflict" };
    await client.query(
      `insert into public.workout_sessions (id, owner_id, status, created_at, started_at, finished_at, server_revision)
       values ($1, $2, 'in_progress', $3, $4, null, 1)`,
      [operation.aggregateId, ownerId, createdAt, startedAt],
    );
    return { status: "applied", change: { revision: 1, payload: { kind, sessionId: operation.aggregateId, status: "in_progress", startedAt } } };
  }

  private async applySet(client: SqlClient, ownerId: string, operation: SyncOperationInput): Promise<OperationDecision> {
    const kind = "workout_set_added";
    const sessionId = readString(operation.payload.sessionId);
    const set = readRecord(operation.payload.set);
    if (sessionId !== operation.aggregateId || set === undefined) return { status: "conflict" };
    const setId = readString(set.id);
    const exerciseId = readString(set.exerciseId);
    const repetitions = readPositiveInteger(set.repetitions);
    const loadKg = readNonNegativeNumber(set.loadKg);
    const createdAt = readTimestamp(set.createdAt);
    if (setId === undefined || exerciseId === undefined || repetitions === undefined || loadKg === undefined || createdAt === undefined || !isUuid(setId) || !isUuid(exerciseId)) return { status: "conflict" };
    const session = await this.getSessionForOwner(client, ownerId, operation.aggregateId);
    if (session === undefined) return { status: operation.sequence > 0 ? "retryable" : "conflict" };
    const revision = safeRevision(session.server_revision);
    if (revision === undefined || operation.sequence < revision) return { status: "conflict" };
    if (operation.sequence > revision) return { status: "retryable" };
    if (session.status !== "in_progress") return { status: "conflict" };
    const exercise = await client.query<{ id: string }>(
      `select id from public.exercises where id = $1 and status = 'published'`,
      [exerciseId],
    );
    if (exercise.rows[0] === undefined) return { status: "blocked" };
    const duplicate = await client.query<{ id: string }>(`select id from public.workout_sets where id = $1`, [setId]);
    if (duplicate.rows[0] !== undefined) return { status: "conflict" };
    await client.query(
      `insert into public.workout_sets (id, session_id, exercise_id, repetitions, load_kg, created_at)
       values ($1, $2, $3, $4, $5, $6)`,
      [setId, operation.aggregateId, exerciseId, repetitions, loadKg, createdAt],
    );
    await client.query(
      `update public.workout_sessions set server_revision = server_revision + 1 where id = $1 and owner_id = $2`,
      [operation.aggregateId, ownerId],
    );
    return { status: "applied", change: { revision: revision + 1, payload: { kind, sessionId: operation.aggregateId, set: { id: setId, exerciseId, repetitions, loadKg, createdAt } } } };
  }

  private async applyFinish(client: SqlClient, ownerId: string, operation: SyncOperationInput): Promise<OperationDecision> {
    const kind = "workout_session_finished";
    const sessionId = readString(operation.payload.sessionId);
    const finishedAt = readTimestamp(operation.payload.finishedAt);
    if (sessionId !== operation.aggregateId || finishedAt === undefined) return { status: "conflict" };
    const session = await this.getSessionForOwner(client, ownerId, operation.aggregateId);
    if (session === undefined) return { status: operation.sequence > 0 ? "retryable" : "conflict" };
    const revision = safeRevision(session.server_revision);
    if (revision === undefined || operation.sequence < revision) return { status: "conflict" };
    if (operation.sequence > revision) return { status: "retryable" };
    if (session.status !== "in_progress" && session.status !== "paused") return { status: "conflict" };
    await client.query(
      `update public.workout_sessions
       set status = 'finished_confirmed', finished_at = $1, server_revision = server_revision + 1
       where id = $2 and owner_id = $3`,
      [finishedAt, operation.aggregateId, ownerId],
    );
    return { status: "applied", change: { revision: revision + 1, payload: { kind, sessionId: operation.aggregateId, status: "finished_confirmed", finishedAt } } };
  }

  private async getSessionForOwner(client: SqlClient, ownerId: string, sessionId: string): Promise<WorkoutSessionRow | undefined> {
    const result = await client.query<WorkoutSessionRow>(
      `select id, owner_id, status, server_revision from public.workout_sessions where id = $1 and owner_id = $2 for update`,
      [sessionId, ownerId],
    );
    return result.rows[0];
  }
}

async function currentCursor(client: SqlClient, scopeId: string): Promise<string> {
  const result = await client.query<{ cursor: string }>(
    `select coalesce(max(cursor), 0)::text as cursor from public.sync_changes where scope_id = $1`,
    [scopeId],
  );
  return result.rows[0]?.cursor ?? "0";
}

function sameOperation(row: SyncOperationRow, ownerId: string, operation: SyncOperationInput): boolean {
  return row.owner_id === ownerId && row.client_instance_id === operation.clientInstanceId && row.aggregate_type === operation.aggregateType && row.aggregate_id === operation.aggregateId && Number(row.sequence) === operation.sequence && Number(row.base_revision) === operation.baseRevision && row.contract_version === operation.contractVersion && canonicalJson(row.payload) === canonicalJson(operation.payload);
}

function toReceiptStatus(status: string | undefined): SyncResultStatus {
  if (status === "applied") return "already_applied";
  if (status === "already_applied" || status === "retryable" || status === "conflict" || status === "blocked" || status === "unsupported" || status === "recovery_required") return status;
  return "recovery_required";
}

function toChange(row: ChangeRow): SyncChange {
  return { cursor: String(row.cursor), changeId: row.change_id, aggregateType: row.aggregate_type, aggregateId: row.aggregate_id, revision: Number(row.aggregate_revision), payload: readRecord(row.payload) ?? {} };
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readTimestamp(value: unknown): string | undefined {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

function readPositiveInteger(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && (value as number) > 0 ? value as number : undefined;
}

function readNonNegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function safeRevision(value: number | string): number | undefined {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : undefined;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
