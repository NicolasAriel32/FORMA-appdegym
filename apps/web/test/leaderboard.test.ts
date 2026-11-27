import assert from "node:assert/strict";
import test from "node:test";
import { bestMarks, estimate1rm, flushPendingMarks, isRankable, liftForDemonstration, queueMarks, readPendingMarks } from "../src/platform/leaderboard.js";
import type { SupabaseClient } from "@supabase/supabase-js";

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

test("estimated 1RM matches the database formula", () => {
  assert.equal(estimate1rm(100, 1), 100);
  assert.equal(estimate1rm(100, 5), 116.7);
  assert.equal(estimate1rm(105, 5), 122.5);
  assert.equal(estimate1rm(120, 3), 132);
});

test("only sets of 1 to 12 reps with a real load can rank", () => {
  assert.equal(isRankable(100, 12), true);
  assert.equal(isRankable(100, 13), false);
  assert.equal(isRankable(0, 5), false);
  assert.equal(isRankable(700, 1), false);
  assert.equal(isRankable(80, 2.5), false);
});

test("the four basics map from their animations", () => {
  assert.equal(liftForDemonstration("bench"), "bench");
  assert.equal(liftForDemonstration("squat"), "squat");
  assert.equal(liftForDemonstration("conventional"), "deadlift");
  assert.equal(liftForDemonstration("ohp"), "ohp");
  assert.equal(liftForDemonstration("deadlift"), undefined, "el peso muerto rumano no entra al ranking");
  assert.equal(liftForDemonstration("lateral"), undefined);
});

test("a workout sends only the best set of each basic", () => {
  const marks = bestMarks([
    { lift: "bench", loadKg: 100, repetitions: 5 },
    { lift: "bench", loadKg: 110, repetitions: 1 },
    { lift: "bench", loadKg: 80, repetitions: 20 },
    { lift: "squat", loadKg: 140, repetitions: 3 },
    { lift: undefined, loadKg: 300, repetitions: 1 },
  ], "2026-11-27T10:00:00.000Z");
  assert.deepEqual(marks.map((mark) => [mark.lift, mark.loadKg, mark.repetitions]), [["squat", 140, 3], ["bench", 100, 5]]);
});

test("pending marks survive a failed send and clear after success", async () => {
  const storage = memoryStorage();
  queueMarks([{ lift: "bench", loadKg: 100, repetitions: 5, recordedAt: "2026-11-27T10:00:00.000Z" }], storage);
  const failing = { rpc: async () => ({ data: null, error: { message: "offline" } }) } as unknown as SupabaseClient;
  assert.deepEqual((await flushPendingMarks(failing, storage)).sent, []);
  assert.equal(readPendingMarks(storage).length, 1);
  const working = { rpc: async () => ({ data: true, error: null }) } as unknown as SupabaseClient;
  const result = await flushPendingMarks(working, storage);
  assert.equal(result.records.length, 1);
  assert.equal(readPendingMarks(storage).length, 0);
});
