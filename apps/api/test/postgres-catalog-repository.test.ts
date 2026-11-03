import assert from "node:assert/strict";
import test from "node:test";
import { PostgresExerciseCatalogRepository } from "../src/modules/catalog/postgres-repository.js";
import type { SqlClient } from "../src/platform/sql-client.js";

test("postgres catalog repository maps educational fields and uses a fixed query", async () => {
  let receivedQuery = "";
  let receivedValues: readonly unknown[] = [];
  const client: SqlClient = {
    query: async <Row extends Record<string, unknown>>(text: string, values: readonly unknown[]) => {
      receivedQuery = text;
      receivedValues = values;
      return {
        rows: [{
          id: "exercise-1",
          slug: "back-squat",
          name: "Sentadilla",
          description: "Dominante de rodilla",
          status: "published",
          created_at: "2026-11-03T00:00:00.000Z",
          published_at: "2026-11-03T00:00:00.000Z",
          retired_at: null,
          movement_pattern: "squat",
          target_muscles: ["quadriceps"],
          secondary_muscles: ["gluteus maximus"],
          instructions: "Descender con control",
          common_mistakes: ["Colapsar rodillas"],
          safety_notes: ["Usar carga controlable"],
          equipment: "barbell",
          difficulty: "intermediate",
        }] as unknown as Row[],
      };
    },
  };

  const exercises = await new PostgresExerciseCatalogRepository(client).listAll();

  assert.equal(receivedValues.length, 0);
  assert.match(receivedQuery, /from public\.exercises/);
  assert.deepEqual(exercises[0], {
    id: "exercise-1",
    slug: "back-squat",
    name: "Sentadilla",
    description: "Dominante de rodilla",
    status: "published",
    createdAt: "2026-11-03T00:00:00.000Z",
    publishedAt: "2026-11-03T00:00:00.000Z",
    retiredAt: null,
    movementPattern: "squat",
    targetMuscles: ["quadriceps"],
    secondaryMuscles: ["gluteus maximus"],
    instructions: "Descender con control",
    commonMistakes: ["Colapsar rodillas"],
    safetyNotes: ["Usar carga controlable"],
    equipment: "barbell",
    difficulty: "intermediate",
  });
});
