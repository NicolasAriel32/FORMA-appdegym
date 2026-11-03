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
  movementPattern: string;
  targetMuscles: string[];
  secondaryMuscles: string[];
  instructions: string;
  commonMistakes: string[];
  safetyNotes: string[];
  equipment: string;
  difficulty: "beginner" | "intermediate" | "advanced";
};
