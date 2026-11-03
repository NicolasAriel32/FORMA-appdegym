export type SessionId = string & { readonly __brand: "SessionId" };
export type ExerciseId = string & { readonly __brand: "ExerciseId" };
export type SetId = string & { readonly __brand: "SetId" };
export type UserId = string & { readonly __brand: "WorkoutUserId" };

export type WorkoutSessionStatus =
  | "prepared"
  | "in_progress"
  | "paused"
  | "finished_local"
  | "finished_confirmed"
  | "discarded_local"
  | "discarded_confirmed"
  | "recovery_required";

export type OfficialExercise = {
  id: ExerciseId;
  status: "published" | "retired";
};

export type WorkoutSet = {
  id: SetId;
  exerciseId: ExerciseId;
  repetitions: number;
  loadKg: number;
  createdAt: string;
};

export type WorkoutSession = {
  id: SessionId;
  ownerId: UserId;
  status: WorkoutSessionStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  sets: WorkoutSet[];
};

export class WorkoutDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "WorkoutDomainError";
  }
}

export function createPreparedSession(
  id: SessionId,
  ownerId: UserId,
  createdAt: string,
): WorkoutSession {
  return {
    id,
    ownerId,
    status: "prepared",
    createdAt,
    startedAt: null,
    finishedAt: null,
    sets: [],
  };
}

export function startSession(
  session: WorkoutSession,
  actorId: UserId,
  startedAt: string,
): WorkoutSession {
  assertOwner(session, actorId);
  assertStatus(session, "prepared");
  return { ...session, status: "in_progress", startedAt };
}

export function pauseSession(
  session: WorkoutSession,
  actorId: UserId,
): WorkoutSession {
  assertOwner(session, actorId);
  assertStatus(session, "in_progress");
  return { ...session, status: "paused" };
}

export function resumeSession(
  session: WorkoutSession,
  actorId: UserId,
): WorkoutSession {
  assertOwner(session, actorId);
  assertStatus(session, "paused");
  return { ...session, status: "in_progress" };
}

export function addSet(
  session: WorkoutSession,
  actorId: UserId,
  exercise: OfficialExercise,
  set: WorkoutSet,
): WorkoutSession {
  assertOwner(session, actorId);
  assertStatus(session, "in_progress");
  if (exercise.status !== "published") {
    throw new WorkoutDomainError("exercise is not currently published");
  }
  if (set.exerciseId !== exercise.id) {
    throw new WorkoutDomainError("set exercise does not match catalog exercise");
  }
  if (session.sets.some((existingSet) => existingSet.id === set.id)) {
    throw new WorkoutDomainError("set id already exists in session");
  }
  if (!Number.isInteger(set.repetitions) || set.repetitions <= 0) {
    throw new WorkoutDomainError("repetitions must be a positive integer");
  }
  if (!Number.isFinite(set.loadKg) || set.loadKg < 0) {
    throw new WorkoutDomainError("load must be a finite non-negative number");
  }

  return { ...session, sets: [...session.sets, { ...set }] };
}

export function finishSessionLocally(
  session: WorkoutSession,
  actorId: UserId,
  finishedAt: string,
): WorkoutSession {
  assertOwner(session, actorId);
  if (session.status !== "in_progress" && session.status !== "paused") {
    throw new WorkoutDomainError("session cannot be finished from its current state");
  }
  return { ...session, status: "finished_local", finishedAt };
}

export function discardSessionLocally(
  session: WorkoutSession,
  actorId: UserId,
): WorkoutSession {
  assertOwner(session, actorId);
  if (
    session.status !== "prepared" &&
    session.status !== "in_progress" &&
    session.status !== "paused"
  ) {
    throw new WorkoutDomainError("session cannot be discarded from its current state");
  }
  return { ...session, status: "discarded_local" };
}

export function confirmSessionFromServer(
  session: WorkoutSession,
  serverStatus: "finished_confirmed" | "discarded_confirmed",
): WorkoutSession {
  const validSource =
    (serverStatus === "finished_confirmed" && session.status === "finished_local") ||
    (serverStatus === "discarded_confirmed" && session.status === "discarded_local");
  if (!validSource) {
    throw new WorkoutDomainError("server confirmation does not match local state");
  }
  return { ...session, status: serverStatus };
}

export function markSessionRecoveryRequired(
  session: WorkoutSession,
): WorkoutSession {
  if (
    session.status === "finished_confirmed" ||
    session.status === "discarded_confirmed"
  ) {
    throw new WorkoutDomainError("confirmed session cannot enter recovery");
  }
  return { ...session, status: "recovery_required" };
}

function assertOwner(session: WorkoutSession, actorId: UserId): void {
  if (session.ownerId !== actorId) {
    throw new WorkoutDomainError("only the session owner may modify it");
  }
}

function assertStatus(
  session: WorkoutSession,
  expected: WorkoutSessionStatus,
): void {
  if (session.status !== expected) {
    throw new WorkoutDomainError(
      `session must be ${expected}, current state is ${session.status}`,
    );
  }
}
