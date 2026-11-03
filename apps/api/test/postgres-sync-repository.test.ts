import assert from "node:assert/strict";
import test from "node:test";
import { PostgresSyncRepository } from "../src/modules/sync/postgres-repository.js";
import type { TransactionalSqlClient } from "../src/platform/sql-client.js";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const exerciseId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const startOperationId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function makeClient() {
  const operations = new Map<string, Record<string, unknown>>();
  const sessions = new Map<string, Record<string, unknown>>();
  const sets = new Map<string, Record<string, unknown>>();
  const changes: Array<Record<string, unknown>> = [];
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const client: TransactionalSqlClient = {
    query: async <Row extends Record<string, unknown>>(text: string, values: readonly unknown[]) => {
      queries.push({ text, values });
      if (text.includes("from public.sync_operations")) {
        const row = operations.get(String(values[0]));
        return { rows: row === undefined ? [] as Row[] : [row as Row] };
      }
      if (text.includes("insert into public.sync_operations")) {
        operations.set(String(values[0]), { operation_id: values[0], owner_id: values[1], client_instance_id: values[2], aggregate_type: values[3], aggregate_id: values[4], sequence: values[5], base_revision: values[6], contract_version: values[7], payload: values[8], result_status: "received", receipt_id: values[9] });
        return { rows: [] as Row[] };
      }
      if (text.includes("from public.workout_sessions")) {
        const row = sessions.get(String(values[0]));
        if (row === undefined || (values.length > 1 && row.owner_id !== values[1])) return { rows: [] as Row[] };
        return { rows: [row as Row] };
      }
      if (text.includes("insert into public.workout_sessions")) {
        sessions.set(String(values[0]), { id: values[0], owner_id: values[1], status: "in_progress", server_revision: 1 });
        return { rows: [] as Row[] };
      }
      if (text.includes("from public.exercises")) return { rows: [{ id: exerciseId }] as unknown as Row[] };
      if (text.includes("from public.workout_sets where id")) {
        const row = sets.get(String(values[0]));
        return { rows: row === undefined ? [] as Row[] : [row as Row] };
      }
      if (text.includes("insert into public.workout_sets")) {
        sets.set(String(values[0]), { id: values[0] });
        return { rows: [] as Row[] };
      }
      if (text.startsWith("update public.workout_sessions")) {
        const row = sessions.get(String(values[0] === ownerId ? values[1] : values[0]));
        if (row !== undefined) {
          if (text.includes("finished_confirmed")) row.status = "finished_confirmed";
          row.server_revision = Number(row.server_revision) + 1;
        }
        return { rows: [] as Row[] };
      }
      if (text.startsWith("update public.sync_operations")) {
        const row = operations.get(String(values[2]));
        if (row !== undefined) row.result_status = values[0];
        return { rows: [] as Row[] };
      }
      if (text.includes("insert into public.sync_changes")) {
        const cursor = String(changes.length + 1);
        changes.push({ cursor, change_id: values[1], aggregate_type: values[2], aggregate_id: values[3], aggregate_revision: values[4], payload: values[5] });
        return { rows: [{ cursor }] as unknown as Row[] };
      }
      if (text.includes("select coalesce(max(cursor)")) return { rows: [{ cursor: String(changes.length) }] as unknown as Row[] };
      if (text.includes("from public.sync_changes")) {
        const after = BigInt(String(values[1] ?? "0"));
        const page = changes.filter((change) => BigInt(String(change.cursor)) > after).slice(0, Number(values[2]));
        return { rows: page as Row[] };
      }
      return { rows: [] as Row[] };
    },
    transaction: async <T>(callback: (transaction: TransactionalSqlClient) => Promise<T>) => callback(client),
  };
  return { client, operations, sessions, changes, queries };
}

function startOperation(operationId = startOperationId) {
  return {
    operationId,
    clientInstanceId: "device-1",
    aggregateType: "workout_session",
    aggregateId: sessionId,
    sequence: 0,
    baseRevision: 0,
    contractVersion: "workout-session-v1",
    createdAt: "2026-11-03T00:00:00.000Z",
    payload: { kind: "workout_session_started", startEvidence: "local_time_unverified", session: { id: sessionId, ownerId, status: "in_progress", createdAt: "2026-11-03T00:00:00.000Z", startedAt: "2026-11-03T00:01:00.000Z", finishedAt: null, sets: [] } },
  };
}

test("postgres sync repository applies once and returns already_applied on retry", async () => {
  const { client, sessions, changes } = makeClient();
  const repository = new PostgresSyncRepository(client, (() => { let n = 0; return () => `id-${++n}`; })(), () => "2026-11-03T00:02:00.000Z");
  const first = await repository.processOperation(ownerId, startOperation());
  const second = await repository.processOperation(ownerId, startOperation());

  assert.equal(first.status, "applied");
  assert.equal(first.nextCursor, "1");
  assert.equal(second.status, "already_applied");
  assert.equal(second.receiptId, first.receiptId);
  assert.equal(sessions.get(sessionId)?.status, "in_progress");
  assert.equal(changes.length, 1);
});

test("postgres sync repository rejects operation id reuse with different content", async () => {
  const { client } = makeClient();
  const repository = new PostgresSyncRepository(client, () => "receipt-1", () => "2026-11-03T00:02:00.000Z");
  await repository.processOperation(ownerId, startOperation());
  const reused = startOperation();
  reused.payload.kind = "different";
  const result = await repository.processOperation(ownerId, reused);
  assert.equal(result.status, "conflict");
});

test("postgres sync repository keeps page cursor at the last returned change", async () => {
  const { client, changes } = makeClient();
  changes.push(
    { cursor: "1", change_id: "change-1", aggregate_type: "workout_session", aggregate_id: sessionId, aggregate_revision: 1, payload: { kind: "one" } },
    { cursor: "2", change_id: "change-2", aggregate_type: "workout_session", aggregate_id: sessionId, aggregate_revision: 2, payload: { kind: "two" } },
    { cursor: "3", change_id: "change-3", aggregate_type: "workout_session", aggregate_id: sessionId, aggregate_revision: 3, payload: { kind: "three" } },
  );
  const repository = new PostgresSyncRepository(client);
  const page = await repository.listChanges(ownerId, null, 2);
  assert.equal(page.nextCursor, "2");
  assert.equal(page.changes.length, 2);
});
