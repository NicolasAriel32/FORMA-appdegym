import type { ServerReceipt, SyncOperation } from "../../../../packages/sync/src/outbox.js";
import { ApiClientError } from "./api-client.js";

export type ApiSyncReceipt = ServerReceipt & { nextCursor: string };

export type ApiSyncChange = {
  cursor: string;
  changeId: string;
  aggregateType: string;
  aggregateId: string;
  revision: number;
  payload: Record<string, unknown>;
};

export type ApiSyncChangesPage = {
  scopeId: string;
  fromCursor: string | null;
  nextCursor: string;
  changes: ApiSyncChange[];
};

export async function sendSyncOperation({
  apiBaseUrl,
  accessToken,
  operation,
  fetchImpl = fetch,
}: {
  apiBaseUrl: string;
  accessToken: string;
  operation: SyncOperation;
  fetchImpl?: typeof fetch;
}): Promise<ApiSyncReceipt> {
  const body = await requestJson({ apiBaseUrl, accessToken, path: "/sync/operations", method: "POST", body: operation, fetchImpl });
  if (!isRecord(body) || typeof body.operationId !== "string" || typeof body.receiptId !== "string" || typeof body.nextCursor !== "string" || !isReceiptStatus(body.status) || body.operationId !== operation.operationId) {
    throw new ApiClientError("El API devolvió un recibo de sincronización inválido.", "invalid_response");
  }
  return { operationId: body.operationId, receiptId: body.receiptId, status: body.status, nextCursor: body.nextCursor };
}

export async function fetchSyncChanges({
  apiBaseUrl,
  accessToken,
  cursor,
  limit = 100,
  fetchImpl = fetch,
}: {
  apiBaseUrl: string;
  accessToken: string;
  cursor: string | null;
  limit?: number;
  fetchImpl?: typeof fetch;
}): Promise<ApiSyncChangesPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor !== null) params.set("cursor", cursor);
  const body = await requestJson({ apiBaseUrl, accessToken, path: `/sync/changes?${params.toString()}`, fetchImpl });
  if (!isRecord(body) || typeof body.scopeId !== "string" || (body.fromCursor !== null && typeof body.fromCursor !== "string") || typeof body.nextCursor !== "string" || !Array.isArray(body.changes)) {
    throw new ApiClientError("El API devolvió una página de sincronización inválida.", "invalid_response");
  }
  return { scopeId: body.scopeId, fromCursor: body.fromCursor as string | null, nextCursor: body.nextCursor, changes: body.changes.map(parseChange) };
}

async function requestJson({
  apiBaseUrl,
  accessToken,
  path,
  method = "GET",
  body,
  fetchImpl,
}: {
  apiBaseUrl: string;
  accessToken: string;
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  fetchImpl: typeof fetch;
}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(`${apiBaseUrl}${path}`, {
      method,
      headers: { accept: "application/json", authorization: `Bearer ${accessToken}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError("No se pudo conectar con el API de FORMA.", "unavailable");
  }
  if (response.status === 401) throw new ApiClientError("La sesión ya no es válida.", "unauthenticated");
  if (response.status === 403) throw new ApiClientError("El API rechazó el acceso.", "forbidden");
  if (!response.ok) throw new ApiClientError("El API no pudo completar la sincronización.", "failed");
  try {
    return await response.json();
  } catch {
    throw new ApiClientError("El API devolvió una respuesta inválida.", "invalid_response");
  }
}

function parseChange(value: unknown): ApiSyncChange {
  if (!isRecord(value) || typeof value.cursor !== "string" || typeof value.changeId !== "string" || typeof value.aggregateType !== "string" || typeof value.aggregateId !== "string" || typeof value.revision !== "number" || !Number.isSafeInteger(value.revision) || !isRecord(value.payload)) {
    throw new ApiClientError("El API devolvió un cambio de sincronización inválido.", "invalid_response");
  }
  return { cursor: value.cursor, changeId: value.changeId, aggregateType: value.aggregateType, aggregateId: value.aggregateId, revision: value.revision, payload: value.payload };
}

function isReceiptStatus(value: unknown): value is ServerReceipt["status"] {
  return value === "applied" || value === "already_applied" || value === "retryable" || value === "conflict" || value === "blocked" || value === "unsupported" || value === "recovery_required";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
