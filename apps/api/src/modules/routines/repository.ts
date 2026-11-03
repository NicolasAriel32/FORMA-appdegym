import { randomUUID } from "node:crypto";
import type { Routine, RoutineInput } from "./types.js";

export type RoutineRepository = {
  listByOwner(ownerId: string): Promise<Routine[]>;
  create(ownerId: string, input: RoutineInput): Promise<Routine>;
  update(ownerId: string, routineId: string, input: RoutineInput): Promise<Routine | undefined>;
};

export class InMemoryRoutineRepository implements RoutineRepository {
  private readonly routines = new Map<string, Routine>();

  public constructor(
    private readonly idFactory: () => string = () => randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async listByOwner(ownerId: string): Promise<Routine[]> {
    return [...this.routines.values()]
      .filter((routine) => routine.ownerId === ownerId && routine.status === "active")
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
      .map(cloneRoutine);
  }

  async create(ownerId: string, input: RoutineInput): Promise<Routine> {
    const timestamp = this.now();
    const routine = buildRoutine(this.idFactory, ownerId, input, timestamp, 0);
    this.routines.set(routine.id, routine);
    return cloneRoutine(routine);
  }

  async update(ownerId: string, routineId: string, input: RoutineInput): Promise<Routine | undefined> {
    const existing = this.routines.get(routineId);
    if (existing === undefined || existing.ownerId !== ownerId || existing.status !== "active") {
      return undefined;
    }
    const updated = buildRoutine(this.idFactory, ownerId, input, this.now(), existing.revision + 1, existing);
    this.routines.set(routineId, updated);
    return cloneRoutine(updated);
  }
}

function buildRoutine(
  idFactory: () => string,
  ownerId: string,
  input: RoutineInput,
  timestamp: string,
  revision: number,
  existing?: Routine,
): Routine {
  return {
    id: existing?.id ?? idFactory(),
    ownerId,
    name: input.name,
    description: input.description,
    status: "active",
    revision,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    exercises: input.exerciseIds.map((exerciseId, position) => ({
      id: existing?.exercises[position]?.id ?? idFactory(),
      exerciseId,
      position,
      targetSets: 3,
      repetitionsMin: 8,
      repetitionsMax: 12,
      restSeconds: 90,
      status: "active",
    })),
  };
}

function cloneRoutine(routine: Routine): Routine {
  return {
    ...routine,
    exercises: routine.exercises.map((exercise) => ({ ...exercise })),
  };
}
