export type SyncResultStatus =
  | "applied"
  | "already_applied"
  | "retryable"
  | "conflict"
  | "blocked"
  | "unsupported"
  | "recovery_required";

export type SyncOperationInput = {
  operationId: string;
  clientInstanceId: string;
  aggregateType: string;
  aggregateId: string;
  sequence: number;
  baseRevision: number;
  contractVersion: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type SyncReceipt = {
  operationId: string;
  receiptId: string;
  status: SyncResultStatus;
  nextCursor: string;
};

export type SyncChange = {
  cursor: string;
  changeId: string;
  aggregateType: string;
  aggregateId: string;
  revision: number;
  payload: Record<string, unknown>;
};

export type SyncChangesPage = {
  scopeId: string;
  fromCursor: string | null;
  nextCursor: string;
  changes: SyncChange[];
};

export type SyncRepository = {
  processOperation: (
    ownerId: string,
    operation: SyncOperationInput,
  ) => Promise<SyncReceipt>;
  listChanges: (
    scopeId: string,
    afterCursor: string | null,
    limit: number,
  ) => Promise<SyncChangesPage>;
};
