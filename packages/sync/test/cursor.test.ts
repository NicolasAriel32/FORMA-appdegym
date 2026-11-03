import assert from "node:assert/strict";
import test from "node:test";
import {
  applyIncrementalPage,
  CursorInvariantError,
  SnapshotAssembler,
  type ChangeEnvelope,
  type SnapshotManifest,
  type SnapshotPage,
} from "../src/cursor.js";

const change: ChangeEnvelope = {
  changeId: "change-1",
  aggregateType: "exercise",
  aggregateId: "exercise-1",
  revision: 1,
  payload: { name: "Sentadilla" },
};

test("an incremental page advances only from the persisted cursor", () => {
  const result = applyIncrementalPage(
    { scopeId: "catalog", cursor: "cursor-1" },
    {
      kind: "incremental",
      scopeId: "catalog",
      fromCursor: "cursor-1",
      nextCursor: "cursor-2",
      changes: [change],
    },
  );

  assert.deepEqual(result.nextState, { scopeId: "catalog", cursor: "cursor-2" });
  assert.deepEqual(result.changes, [change]);
});

test("an incremental page from an unexpected cursor is rejected", () => {
  assert.throws(
    () =>
      applyIncrementalPage(
        { scopeId: "catalog", cursor: "cursor-1" },
        {
          kind: "incremental",
          scopeId: "catalog",
          fromCursor: "cursor-0",
          nextCursor: "cursor-2",
          changes: [],
        },
      ),
    CursorInvariantError,
  );
});

function manifest(): SnapshotManifest {
  return {
    kind: "snapshot_manifest",
    snapshotId: "snapshot-1",
    scopeId: "catalog",
    cutCursor: "cursor-cut",
    pageCount: 2,
    expiresAt: "2026-11-03T12:00:00.000Z",
    manifestHash: "hash-1",
  };
}

function page(pageNumber: number, snapshotId = "snapshot-1"): SnapshotPage {
  return {
    kind: "snapshot_page",
    snapshotId,
    scopeId: "catalog",
    cutCursor: "cursor-cut",
    pageNumber,
    pageCount: 2,
    integrityVerified: true,
    records: pageNumber === 0 ? [change] : [],
  };
}

test("a snapshot cannot be activated until every verified page is present", () => {
  const assembler = new SnapshotAssembler(manifest(), {
    verifyManifest: () => true,
    now: () => "2026-11-03T11:00:00.000Z",
  });
  assembler.addPage(page(0));
  assert.equal(assembler.isComplete(), false);
  assert.throws(() => assembler.activate(), /snapshot is incomplete/);

  assembler.addPage(page(1));
  const result = assembler.activate();
  assert.deepEqual(result.nextState, { scopeId: "catalog", cursor: "cursor-cut" });
  assert.deepEqual(result.records, [change]);
});

test("snapshot pages from another generation cannot be mixed", () => {
  const assembler = new SnapshotAssembler(manifest(), { verifyManifest: () => true });
  assert.throws(() => assembler.addPage(page(0, "snapshot-other")), /another snapshot/);
});

test("an expired snapshot cannot be activated", () => {
  const expired = new SnapshotAssembler(
    { ...manifest(), expiresAt: "2026-11-03T10:00:00.000Z" },
    {
      verifyManifest: () => true,
      now: () => "2026-11-03T11:00:00.000Z",
    },
  );
  expired.addPage(page(0));
  expired.addPage(page(1));
  assert.throws(() => expired.activate(), /snapshot has expired/);
});

test("an unverified snapshot manifest cannot be assembled", () => {
  assert.throws(
    () =>
      new SnapshotAssembler(manifest(), {
        verifyManifest: () => false,
      }),
    /manifest integrity is not verified/,
  );
});
