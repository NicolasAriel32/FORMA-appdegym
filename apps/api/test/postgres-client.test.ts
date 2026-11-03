import assert from "node:assert/strict";
import test from "node:test";
import { createPostgresSqlClientFromPool } from "../src/platform/postgres-client.js";

function fakePool() {
  const calls: string[] = [];
  const connection = {
    query: async <Row extends Record<string, unknown>>(text: string, _values?: readonly unknown[]) => {
      calls.push(`connection:${text}`);
      return { rows: [] as Row[] };
    },
    release: () => calls.push("release"),
  };
  const pool = {
    query: async <Row extends Record<string, unknown>>(text: string, _values?: readonly unknown[]) => {
      calls.push(`pool:${text}`);
      return { rows: [] as Row[] };
    },
    connect: async () => connection,
    end: async () => { calls.push("end"); },
  };
  return { pool, calls };
}

test("postgres adapter commits a successful transaction and releases the connection", async () => {
  const { pool, calls } = fakePool();
  const client = createPostgresSqlClientFromPool(pool);

  await client.transaction(async (transaction) => {
    await transaction.query("select 1", []);
  });

  assert.deepEqual(calls, ["connection:begin", "connection:select 1", "connection:commit", "release"]);
  await client.close();
  assert.equal(calls.at(-1), "end");
});

test("postgres adapter rolls back and preserves the original transaction error", async () => {
  const { pool, calls } = fakePool();
  const client = createPostgresSqlClientFromPool(pool);
  const error = new Error("write failed");

  await assert.rejects(
    () => client.transaction(async () => { throw error; }),
    error,
  );
  assert.deepEqual(calls, ["connection:begin", "connection:rollback", "release"]);
});
