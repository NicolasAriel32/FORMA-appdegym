import type { CatalogExercise } from "./types.js";

export type ExerciseCatalogRepository = {
  listAll: () => Promise<readonly CatalogExercise[]>;
};

export class InMemoryExerciseCatalogRepository
  implements ExerciseCatalogRepository
{
  private readonly exercises: CatalogExercise[];

  public constructor(exercises: readonly CatalogExercise[] = []) {
    this.exercises = exercises.map(cloneExercise);
  }

  async listAll(): Promise<readonly CatalogExercise[]> {
    return this.exercises.map(cloneExercise);
  }
}

function cloneExercise(exercise: CatalogExercise): CatalogExercise {
  return { ...exercise };
}
