import assert from "node:assert/strict";
import test from "node:test";
import { PostgresRoutineRepository } from "../src/modules/routines/postgres-repository.js";
import type { TransactionalSqlClient } from "../src/platform/sql-client.js";

function makeClient() {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const routineRow = {
    id: "routine-1",
    owner_id: "owner-1",
    name: "Fuerza",
    description: "",
    status: "active",
    revision: 0,
    created_at: "2026-11-03T00:00:00.000Z",
    updated_at: "2026-11-03T00:00:00.000Z",
  };
  const exerciseRow = {
    id: "routine-exercise-1",
    routine_id: "routine-1",
    exercise_id: "exercise-1",
    position: 0,
    target_sets: 3,
    repetitions_min: 8,
    repetitions_max: 12,
    rest_seconds: 90,
    status: "active",
  };
  const client: TransactionalSqlClient = {
    query: async <Row extends Record<string, unknown>>(text: string, values: readonly unknown[]) => {
      queries.push({ text, values });
      if (text.includes("from public.routines")) {
        return { rows: [routineRow] as unknown as Row[] };
      }
      if (text.includes("from public.routine_exercises")) {
        return { rows: [exerciseRow] as unknown as Row[] };
      }
      return { rows: [] as Row[] };
    },
    transaction: async <T>(callback: (transaction: TransactionalSqlClient) => Promise<T>) => callback(client),
  };
  return { client, queries };
}

test("postgres routine repository scopes reads by owner and loads active exercises", async () => {
  const { client, queries } = makeClient();
  const repository = new PostgresRoutineRepository(client, () => "unused", () => "2026-11-03T00:00:00.000Z");

  const routines = await repository.listByOwner("owner-1");

  assert.equal(routines.length, 1);
  assert.equal(routines[0]?.ownerId, "owner-1");
  assert.equal(routines[0]?.exercises[0]?.exerciseId, "exercise-1");
  assert.deepEqual(queries[0]?.values, ["owner-1"]);
  assert.deepEqual(queries[1]?.values, [["routine-1"]]);
});

test("postgres routine creation performs routine and exercise writes in one transaction", async () => {
  const { client, queries } = makeClient();
  const repository = new PostgresRoutineRepository(
    client,
    (() => {
      let sequence = 0;
      return () => `generated-${++sequence}`;
    })(),
    () => "2026-11-03T00:00:00.000Z",
  );

  const routine = await repository.create("owner-1", {
    name: "Fuerza",
    description: "",
    exerciseIds: ["exercise-1"],
  });

  assert.equal(routine.id, "generated-1");
  assert.equal(routine.exercises[0]?.id, "generated-2");
  assert.equal(queries.filter((query) => query.text.includes("insert into public.routines")).length, 1);
  assert.equal(queries.filter((query) => query.text.includes("insert into public.routine_exercises")).length, 1);
  assert.ok(queries.every((query) => !query.text.includes("owner-1")));
});
