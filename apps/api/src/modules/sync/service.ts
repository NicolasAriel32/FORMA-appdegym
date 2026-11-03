import type {
  SyncChangesPage,
  SyncOperationInput,
  SyncReceipt,
  SyncRepository,
} from "./types.js";

export class SyncValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SyncValidationError";
  }
}

export class SyncService {
  public constructor(private readonly repository: SyncRepository) {}

  receive(ownerId: string, value: unknown): Promise<SyncReceipt> {
    return this.repository.processOperation(ownerId, parseOperation(value));
  }

  listChanges(
    scopeId: string,
    cursorValue: string | null,
    limitValue: string | null,
  ): Promise<SyncChangesPage> {
    const cursor = parseCursor(cursorValue);
    const limit = parseLimit(limitValue);
    return this.repository.listChanges(scopeId, cursor, limit);
  }
}

function parseOperation(value: unknown): SyncOperationInput {
  if (!isRecord(value)) throw new SyncValidationError("sync operation must be an object");
  const operationId = readIdentifier(value.operationId, "operationId", true);
  const clientInstanceId = readIdentifier(value.clientInstanceId, "clientInstanceId", false);
  const aggregateType = readIdentifier(value.aggregateType, "aggregateType", false);
  const aggregateId = readIdentifier(value.aggregateId, "aggregateId", true);
  const contractVersion = readIdentifier(value.contractVersion, "contractVersion", false);
  const createdAt = readTimestamp(value.createdAt, "createdAt");
  const payload = readRecord(value.payload, "payload");
  const sequence = readNonNegativeInteger(value.sequence, "sequence");
  const baseRevision = readNonNegativeInteger(value.baseRevision, "baseRevision");
  return {
    operationId,
    clientInstanceId,
    aggregateType,
    aggregateId,
    sequence,
    baseRevision,
    contractVersion,
    payload: cloneRecord(payload),
    createdAt,
  };
}

function readIdentifier(value: unknown, name: string, requireUuid: boolean): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 255) {
    throw new SyncValidationError(`${name} is invalid`);
  }
  const normalized = value.trim();
  if (requireUuid && !isUuid(normalized)) throw new SyncValidationError(`${name} must be a UUID`);
  return normalized;
}

function readTimestamp(value: unknown, name: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new SyncValidationError(`${name} is invalid`);
  }
  return value;
}

function readNonNegativeInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new SyncValidationError(`${name} is invalid`);
  }
  return value as number;
}

function parseCursor(value: string | null): string | null {
  if (value === null || value.trim() === "") return null;
  if (!/^\d+$/.test(value) || value.length > 30) {
    throw new SyncValidationError("cursor is invalid");
  }
  try {
    return BigInt(value).toString();
  } catch {
    throw new SyncValidationError("cursor is invalid");
  }
}

function parseLimit(value: string | null): number {
  if (value === null || value.trim() === "") return 100;
  if (!/^\d+$/.test(value)) throw new SyncValidationError("limit is invalid");
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
    throw new SyncValidationError("limit is invalid");
  }
  return limit;
}

function readRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) throw new SyncValidationError(`${name} is invalid`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
