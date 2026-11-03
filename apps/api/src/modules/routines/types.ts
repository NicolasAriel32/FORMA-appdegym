export type RoutineStatus = "active" | "archived";

export type RoutineExercise = {
  id: string;
  exerciseId: string;
  position: number;
  targetSets: number;
  repetitionsMin: number;
  repetitionsMax: number;
  restSeconds: number;
  status: "active" | "removed";
};

export type Routine = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  status: RoutineStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
  exercises: RoutineExercise[];
};

export type RoutineInput = {
  name: string;
  description: string;
  exerciseIds: string[];
};
