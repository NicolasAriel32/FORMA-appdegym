import { randomUUID } from "node:crypto";
import type { SqlClient, TransactionalSqlClient } from "../../platform/sql-client.js";
import type { RoutineRepository } from "./repository.js";
import type { Routine, RoutineInput, RoutineExercise } from "./types.js";

type RoutineRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  status: string;
  revision: number | string;
  created_at: string | Date;
  updated_at: string | Date;
};

type RoutineExerciseRow = {
  id: string;
  routine_id: string;
  exercise_id: string;
  position: number;
  target_sets: number;
  repetitions_min: number;
  repetitions_max: number;
  rest_seconds: number;
  status: string;
};

export class PostgresRoutineRepository implements RoutineRepository {
  public constructor(
    private readonly client: TransactionalSqlClient,
    private readonly idFactory: () => string = () => randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async listByOwner(ownerId: string): Promise<Routine[]> {
    const routines = await this.client.query<RoutineRow>(
      `select id, owner_id, name, description, status, revision, created_at, updated_at
       from public.routines
       where owner_id = $1 and status = 'active'
       order by updated_at desc, id asc`,
      [ownerId],
    );
    if (routines.rows.length === 0) return [];
    const routineIds = routines.rows.map((routine) => routine.id);
    const exercises = await this.client.query<RoutineExerciseRow>(
      `select id, routine_id, exercise_id, position, target_sets, repetitions_min,
              repetitions_max, rest_seconds, status
       from public.routine_exercises
       where routine_id = any($1::uuid[]) and status = 'active'
       order by routine_id asc, position asc`,
      [routineIds],
    );
    return routines.rows.map((routine) => toRoutine(routine, exercises.rows.filter((exercise) => exercise.routine_id === routine.id)));
  }

  async create(ownerId: string, input: RoutineInput): Promise<Routine> {
    const routineId = this.idFactory();
    const timestamp = this.now();
    const exercises = input.exerciseIds.map((exerciseId, position) => this.createExercise(exerciseId, position));
    await this.client.transaction(async (client) => {
      await insertRoutine(client, routineId, ownerId, input, timestamp);
      await insertExercises(client, routineId, exercises, timestamp);
    });
    return toRoutine({ id: routineId, owner_id: ownerId, name: input.name, description: input.description, status: "active", revision: 0, created_at: timestamp, updated_at: timestamp }, exercises.map((exercise) => toExerciseRow(exercise, routineId)));
  }

  async update(ownerId: string, routineId: string, input: RoutineInput): Promise<Routine | undefined> {
    const timestamp = this.now();
    return this.client.transaction(async (client) => {
      const existing = await client.query<RoutineRow>(
        `select id, owner_id, name, description, status, revision, created_at, updated_at
         from public.routines
         where id = $1 and owner_id = $2 and status = 'active'
         for update`,
        [routineId, ownerId],
      );
      const row = existing.rows[0];
      if (row === undefined) return undefined;
      await client.query(
        `update public.routines
         set name = $1, description = $2, revision = revision + 1, updated_at = $3
         where id = $4 and owner_id = $5 and status = 'active'`,
        [input.name, input.description, timestamp, routineId, ownerId],
      );
      await client.query(
        `update public.routine_exercises
         set status = 'removed', updated_at = $1
         where routine_id = $2 and status = 'active'`,
        [timestamp, routineId],
      );
      const exercises = input.exerciseIds.map((exerciseId, position) => this.createExercise(exerciseId, position));
      await insertExercises(client, routineId, exercises, timestamp);
      return toRoutine({ ...row, name: input.name, description: input.description, revision: Number(row.revision) + 1, updated_at: timestamp }, exercises.map((exercise) => toExerciseRow(exercise, routineId)));
    });
  }

  private createExercise(exerciseId: string, position: number): RoutineExercise {
    return { id: this.idFactory(), exerciseId, position, targetSets: 3, repetitionsMin: 8, repetitionsMax: 12, restSeconds: 90, status: "active" };
  }
}

async function insertRoutine(client: SqlClient, id: string, ownerId: string, input: RoutineInput, timestamp: string): Promise<void> {
  await client.query(
    `insert into public.routines (id, owner_id, name, description, status, revision, created_at, updated_at)
     values ($1, $2, $3, $4, 'active', 0, $5, $5)`,
    [id, ownerId, input.name, input.description, timestamp],
  );
}

async function insertExercises(client: SqlClient, routineId: string, exercises: readonly RoutineExercise[], timestamp: string): Promise<void> {
  for (const exercise of exercises) {
    await client.query(
      `insert into public.routine_exercises
       (id, routine_id, exercise_id, position, target_sets, repetitions_min, repetitions_max, rest_seconds, status, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $9)`,
      [exercise.id, routineId, exercise.exerciseId, exercise.position, exercise.targetSets, exercise.repetitionsMin, exercise.repetitionsMax, exercise.restSeconds, timestamp],
    );
  }
}

function toExerciseRow(exercise: RoutineExercise, routineId: string): RoutineExerciseRow {
  return {
    id: exercise.id,
    routine_id: routineId,
    exercise_id: exercise.exerciseId,
    position: exercise.position,
    target_sets: exercise.targetSets,
    repetitions_min: exercise.repetitionsMin,
    repetitions_max: exercise.repetitionsMax,
    rest_seconds: exercise.restSeconds,
    status: exercise.status,
  };
}

function toRoutine(row: RoutineRow, exercises: readonly RoutineExerciseRow[]): Routine {
  if (row.status !== "active" && row.status !== "archived") throw new Error("database returned an invalid routine status");
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    status: row.status,
    revision: Number(row.revision),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    exercises: exercises.map((exercise) => {
      if (exercise.status !== "active" && exercise.status !== "removed") {
        throw new Error("database returned an invalid routine exercise status");
      }
      return { id: exercise.id, exerciseId: exercise.exercise_id, position: exercise.position, targetSets: exercise.target_sets, repetitionsMin: exercise.repetitions_min, repetitionsMax: exercise.repetitions_max, restSeconds: exercise.rest_seconds, status: exercise.status };
    }),
  };
}
