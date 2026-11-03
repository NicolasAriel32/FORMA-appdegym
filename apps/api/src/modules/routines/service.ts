import type { RoutineRepository } from "./repository.js";
import type { Routine, RoutineInput } from "./types.js";

export class RoutineValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RoutineValidationError";
  }
}

export class RoutineService {
  public constructor(private readonly repository: RoutineRepository) {}

  async listOwned(ownerId: string): Promise<Routine[]> {
    return this.repository.listByOwner(ownerId);
  }

  async createOwned(ownerId: string, input: RoutineInput): Promise<Routine> {
    validateRoutineInput(input);
    return this.repository.create(ownerId, normalizeInput(input));
  }

  async updateOwned(ownerId: string, routineId: string, input: RoutineInput): Promise<Routine | undefined> {
    validateRoutineInput(input);
    return this.repository.update(ownerId, routineId, normalizeInput(input));
  }
}

function validateRoutineInput(input: RoutineInput): void {
  if (input.name.trim().length < 1 || input.name.trim().length > 120) {
    throw new RoutineValidationError("routine name must contain between 1 and 120 characters");
  }
  if (input.description.length > 1000) {
    throw new RoutineValidationError("routine description is too long");
  }
  if (input.exerciseIds.length > 100) {
    throw new RoutineValidationError("routine contains too many exercises");
  }
  if (input.exerciseIds.some((exerciseId) => exerciseId.trim().length === 0)) {
    throw new RoutineValidationError("routine exercise ids must not be empty");
  }
  if (new Set(input.exerciseIds).size !== input.exerciseIds.length) {
    throw new RoutineValidationError("routine cannot contain the same exercise twice");
  }
}

function normalizeInput(input: RoutineInput): RoutineInput {
  return {
    name: input.name.trim(),
    description: input.description.trim(),
    exerciseIds: input.exerciseIds.map((exerciseId) => exerciseId.trim()),
  };
}
