export type CatalogExerciseStatus = "published" | "retired";

export type CatalogExercise = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: CatalogExerciseStatus;
  createdAt: string;
  publishedAt: string | null;
  retiredAt: string | null;
};
