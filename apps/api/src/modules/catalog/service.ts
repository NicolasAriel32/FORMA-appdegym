import type { ExerciseCatalogRepository } from "./repository.js";
import type { CatalogExercise } from "./types.js";

export class ExerciseCatalogService {
  public constructor(private readonly repository: ExerciseCatalogRepository) {}

  async listPublished(): Promise<CatalogExercise[]> {
    const exercises = await this.repository.listAll();
    return exercises
      .filter((exercise) => exercise.status === "published")
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((exercise) => ({ ...exercise }));
  }
}
