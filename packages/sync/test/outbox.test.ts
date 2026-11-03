import assert from "node:assert/strict";
import test from "node:test";
import {
  applyServerReceipt,
  createPendingOperation,
  InMemoryOutbox,
  markSending,
  type SyncOperation,
} from "../src/outbox.js";

function operation(): SyncOperation {
  return createPendingOperation({
    operationId: "op-1",
    clientInstanceId: "client-1",
    aggregateType: "workout_session",
    aggregateId: "session-1",
    sequence: 0,
    baseRevision: 0,
    contractVersion: "sync-v1",
    payload: { value: 1, nested: { b: 2, a: 1 } },
    createdAt: "2026-11-03T10:00:00.000Z",
  });
}

test("an operation is confirmed only after a matching server receipt", () => {
  const sending = markSending(operation());
  const confirmed = applyServerReceipt(sending, {
    operationId: "op-1",
    receiptId: "receipt-1",
    status: "applied",
  });

  assert.equal(confirmed.state, "confirmed");
  assert.equal(confirmed.receiptId, "receipt-1");
});

test("repeating the same operation is idempotent in the outbox", () => {
  const outbox = new InMemoryOutbox();
  const first = outbox.append(operation());
  const second = outbox.append({
    ...operation(),
    payload: { nested: { a: 1, b: 2 }, value: 1 },
  });

  assert.deepEqual(second, first);
  assert.equal(outbox.list().length, 1);
});

test("reusing an operation id with different content is rejected", () => {
  const outbox = new InMemoryOutbox();
  outbox.append(operation());

  assert.throws(
    () => outbox.append({ ...operation(), aggregateId: "session-2" }),
    /operation id reused with different content/,
  );
});

test("conflicts preserve the operation for recovery instead of deleting it", () => {
  const outbox = new InMemoryOutbox();
  const sending = markSending(outbox.append(operation()));
  const recovery = applyServerReceipt(sending, {
    operationId: "op-1",
    receiptId: "receipt-conflict",
    status: "conflict",
  });
  outbox.save(recovery);

  assert.equal(outbox.get("op-1")?.state, "recovery_required");
  assert.equal(outbox.list().length, 1);
});

test("a retryable response can be sent again and increments attempts", () => {
  const firstSending = markSending(operation());
  const retryable = applyServerReceipt(firstSending, {
    operationId: "op-1",
    receiptId: "receipt-retry",
    status: "retryable",
  });
  const secondSending = markSending(retryable);

  assert.equal(secondSending.state, "sending");
  assert.equal(secondSending.attemptCount, 2);
});

test("a receipt for another operation cannot advance local state", () => {
  assert.throws(
    () =>
      applyServerReceipt(markSending(operation()), {
        operationId: "op-2",
        receiptId: "receipt-1",
        status: "applied",
      }),
    /does not match outbox operation/,
  );
});
