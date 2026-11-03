export type OutboxState =
  | "pending"
  | "sending"
  | "retryable_error"
  | "blocked"
  | "confirmed"
  | "recovery_required";

export type SyncOperation = {
  operationId: string;
  clientInstanceId: string;
  aggregateType: string;
  aggregateId: string;
  sequence: number;
  baseRevision: number;
  contractVersion: string;
  payload: Record<string, unknown>;
  createdAt: string;
  state: OutboxState;
  attemptCount: number;
  receiptId: string | null;
};

export type ServerReceipt = {
  operationId: string;
  receiptId: string;
  status:
    | "applied"
    | "already_applied"
    | "retryable"
    | "conflict"
    | "blocked"
    | "unsupported"
    | "recovery_required";
};

export class SyncInvariantError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SyncInvariantError";
  }
}

export function createPendingOperation(
  operation: Omit<SyncOperation, "state" | "attemptCount" | "receiptId">,
): SyncOperation {
  validateOperationIdentifiers(operation);
  return {
    ...operation,
    payload: clonePayload(operation.payload),
    state: "pending",
    attemptCount: 0,
    receiptId: null,
  };
}

export function markSending(operation: SyncOperation): SyncOperation {
  if (
    operation.state !== "pending" &&
    operation.state !== "retryable_error"
  ) {
    throw new SyncInvariantError("only pending operations may be sent");
  }
  return {
    ...operation,
    payload: clonePayload(operation.payload),
    state: "sending",
    attemptCount: operation.attemptCount + 1,
  };
}

export function applyServerReceipt(
  operation: SyncOperation,
  receipt: ServerReceipt,
): SyncOperation {
  if (receipt.operationId !== operation.operationId) {
    throw new SyncInvariantError("receipt operation does not match outbox operation");
  }
  if (receipt.receiptId.length === 0) {
    throw new SyncInvariantError("server receipt must have an id");
  }
  if (operation.state === "confirmed") {
    if (operation.receiptId !== receipt.receiptId) {
      throw new SyncInvariantError("confirmed operation received a different receipt");
    }
    return cloneOperation(operation);
  }
  if (operation.state !== "sending") {
    throw new SyncInvariantError("receipt can only confirm a sending operation");
  }

  const nextState: OutboxState =
    receipt.status === "applied" || receipt.status === "already_applied"
      ? "confirmed"
      : receipt.status === "retryable"
        ? "retryable_error"
        : receipt.status === "conflict" || receipt.status === "recovery_required"
          ? "recovery_required"
          : "blocked";

  return {
    ...operation,
    payload: clonePayload(operation.payload),
    state: nextState,
    receiptId: receipt.receiptId,
  };
}

export class InMemoryOutbox {
  private readonly entries = new Map<string, SyncOperation>();

  append(operation: SyncOperation): SyncOperation {
    const existing = this.entries.get(operation.operationId);
    if (existing !== undefined) {
      if (canonicalJson(existing) !== canonicalJson(operation)) {
        throw new SyncInvariantError("operation id reused with different content");
      }
      return cloneOperation(existing);
    }
    this.entries.set(operation.operationId, cloneOperation(operation));
    return cloneOperation(operation);
  }

  get(operationId: string): SyncOperation | undefined {
    const operation = this.entries.get(operationId);
    return operation === undefined ? undefined : cloneOperation(operation);
  }

  save(operation: SyncOperation): SyncOperation {
    if (!this.entries.has(operation.operationId)) {
      throw new SyncInvariantError("cannot save an unknown operation");
    }
    this.entries.set(operation.operationId, cloneOperation(operation));
    return cloneOperation(operation);
  }

  list(): SyncOperation[] {
    return [...this.entries.values()].map(cloneOperation);
  }
}

function validateOperationIdentifiers(
  operation: Omit<SyncOperation, "state" | "attemptCount" | "receiptId">,
): void {
  for (const [name, value] of [
    ["operationId", operation.operationId],
    ["clientInstanceId", operation.clientInstanceId],
    ["aggregateType", operation.aggregateType],
    ["aggregateId", operation.aggregateId],
    ["contractVersion", operation.contractVersion],
  ] as const) {
    if (value.length === 0 || value.length > 255) {
      throw new SyncInvariantError(`${name} is invalid`);
    }
  }
  if (!Number.isInteger(operation.sequence) || operation.sequence < 0) {
    throw new SyncInvariantError("sequence is invalid");
  }
  if (!Number.isInteger(operation.baseRevision) || operation.baseRevision < 0) {
    throw new SyncInvariantError("base revision is invalid");
  }
}

function cloneOperation(operation: SyncOperation): SyncOperation {
  return { ...operation, payload: clonePayload(operation.payload) };
}

function clonePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
