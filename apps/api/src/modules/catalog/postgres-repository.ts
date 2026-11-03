import type { SqlClient } from "../../platform/sql-client.js";
import type { ExerciseCatalogRepository } from "./repository.js";
import type { CatalogExercise } from "./types.js";

type CatalogRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  created_at: string | Date;
  published_at: string | Date | null;
  retired_at: string | Date | null;
  movement_pattern: string;
  target_muscles: string[];
  secondary_muscles: string[];
  instructions: string;
  common_mistakes: string[];
  safety_notes: string[];
  equipment: string;
  difficulty: string;
};

export class PostgresExerciseCatalogRepository implements ExerciseCatalogRepository {
  public constructor(private readonly client: SqlClient) {}

  async listAll(): Promise<readonly CatalogExercise[]> {
    const result = await this.client.query<CatalogRow>(
      `select id, slug, name, description, status, created_at, published_at,
              retired_at, movement_pattern, target_muscles, secondary_muscles,
              instructions, common_mistakes, safety_notes, equipment, difficulty
       from public.exercises
       order by name asc, id asc`,
      [],
    );
    return result.rows.map(toCatalogExercise);
  }
}

function toCatalogExercise(row: CatalogRow): CatalogExercise {
  if (row.status !== "published" && row.status !== "retired") {
    throw new Error("database returned an invalid exercise status");
  }
  if (row.difficulty !== "beginner" && row.difficulty !== "intermediate" && row.difficulty !== "advanced") {
    throw new Error("database returned an invalid exercise difficulty");
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: toIsoString(row.created_at),
    publishedAt: row.published_at === null ? null : toIsoString(row.published_at),
    retiredAt: row.retired_at === null ? null : toIsoString(row.retired_at),
    movementPattern: row.movement_pattern,
    targetMuscles: [...row.target_muscles],
    secondaryMuscles: [...row.secondary_muscles],
    instructions: row.instructions,
    commonMistakes: [...row.common_mistakes],
    safetyNotes: [...row.safety_notes],
    equipment: row.equipment,
    difficulty: row.difficulty,
  };
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}
