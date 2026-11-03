import assert from "node:assert/strict";
import test from "node:test";
import {
  addSet,
  confirmSessionFromServer,
  createPreparedSession,
  finishSessionLocally,
  markSessionRecoveryRequired,
  pauseSession,
  resumeSession,
  startSession,
  type ExerciseId,
  type SessionId,
  type SetId,
  type UserId,
} from "../src/workout.js";

const owner = "user-1" as UserId;
const otherUser = "user-2" as UserId;
const sessionId = "session-1" as SessionId;
const exerciseId = "exercise-1" as ExerciseId;

function startedSession() {
  return startSession(
    createPreparedSession(sessionId, owner, "2026-11-03T10:00:00.000Z"),
    owner,
    "2026-11-03T10:01:00.000Z",
  );
}

test("a personal session follows the approved local lifecycle", () => {
  const paused = pauseSession(startedSession(), owner);
  const resumed = resumeSession(paused, owner);
  const finished = finishSessionLocally(
    resumed,
    owner,
    "2026-11-03T11:00:00.000Z",
  );
  const confirmed = confirmSessionFromServer(finished, "finished_confirmed");

  assert.equal(confirmed.status, "finished_confirmed");
  assert.equal(confirmed.startedAt, "2026-11-03T10:01:00.000Z");
  assert.equal(confirmed.finishedAt, "2026-11-03T11:00:00.000Z");
});

test("only the owner may modify a personal session", () => {
  assert.throws(
    () => pauseSession(startedSession(), otherUser),
    /only the session owner may modify it/,
  );
});

test("a set requires a published official exercise", () => {
  const session = startedSession();
  const set = {
    id: "set-1" as SetId,
    exerciseId,
    repetitions: 8,
    loadKg: 40,
    createdAt: "2026-11-03T10:15:00.000Z",
  };

  const withSet = addSet(
    session,
    owner,
    { id: exerciseId, status: "published" },
    set,
  );
  assert.equal(withSet.sets.length, 1);

  assert.throws(
    () =>
      addSet(
        withSet,
        owner,
        { id: exerciseId, status: "retired" },
        { ...set, id: "set-2" as SetId },
      ),
    /not currently published/,
  );
  assert.equal(withSet.sets.length, 1);
});

test("a paused or finished session cannot receive a new set", () => {
  const paused = pauseSession(startedSession(), owner);
  const set = {
    id: "set-1" as SetId,
    exerciseId,
    repetitions: 8,
    loadKg: 40,
    createdAt: "2026-11-03T10:15:00.000Z",
  };

  assert.throws(
    () => addSet(paused, owner, { id: exerciseId, status: "published" }, set),
    /session must be in_progress/,
  );
});

test("a duplicate set id cannot be appended locally", () => {
  const session = startedSession();
  const set = {
    id: "set-1" as SetId,
    exerciseId,
    repetitions: 8,
    loadKg: 40,
    createdAt: "2026-11-03T10:15:00.000Z",
  };
  const withSet = addSet(
    session,
    owner,
    { id: exerciseId, status: "published" },
    set,
  );

  assert.throws(
    () => addSet(withSet, owner, { id: exerciseId, status: "published" }, set),
    /set id already exists/,
  );
});

test("a local conflict can require recovery but confirmed data cannot be downgraded", () => {
  const local = finishSessionLocally(
    startedSession(),
    owner,
    "2026-11-03T11:00:00.000Z",
  );
  assert.equal(markSessionRecoveryRequired(local).status, "recovery_required");

  const confirmed = confirmSessionFromServer(local, "finished_confirmed");
  assert.throws(
    () => markSessionRecoveryRequired(confirmed),
    /confirmed session cannot enter recovery/,
  );
});
