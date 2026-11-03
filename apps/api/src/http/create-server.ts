import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import {
  IdentityService,
  InvalidExternalPrincipalError,
} from "../modules/identity/service.js";
import {
  assertCanReadPersonalResource,
  type PersonalResource,
} from "../modules/authorization/service.js";
import { ExerciseCatalogService } from "../modules/catalog/service.js";
import { RoutineService, RoutineValidationError } from "../modules/routines/service.js";
import type { RoutineInput } from "../modules/routines/types.js";
import { SyncService, SyncValidationError } from "../modules/sync/service.js";
import type {
  ExternalPrincipal,
  InternalUser,
  UserId,
} from "../modules/identity/types.js";

export type PrincipalResolver = (
  authorizationHeader: string | undefined,
) => Promise<ExternalPrincipal | undefined>;

export type ApiDependencies = {
  identityService: IdentityService;
  resolvePrincipal: PrincipalResolver;
  exerciseCatalogService?: ExerciseCatalogService;
  routineService?: RoutineService;
  syncService?: SyncService;
};

type PublicUser = Pick<InternalUser, "id" | "email" | "role" | "createdAt">;

export function createApiServer({
  identityService,
  resolvePrincipal,
  exerciseCatalogService,
  routineService,
  syncService,
}: ApiDependencies): Server {
  return createServer((request, response) => {
    void handleRequest(
      request,
      response,
      identityService,
      resolvePrincipal,
      exerciseCatalogService,
      routineService,
      syncService,
    ).catch(() => {
        if (!response.headersSent) {
          writeJson(response, 500, { error: "internal_error" });
        } else if (!response.writableEnded) {
          response.end();
        }
      });
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  identityService: IdentityService,
  resolvePrincipal: PrincipalResolver,
  exerciseCatalogService: ExerciseCatalogService | undefined,
  routineService: RoutineService | undefined,
  syncService: SyncService | undefined,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://forma.local");

  if (request.method === "GET" && url.pathname === "/health") {
    writeJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method !== "GET" && request.method !== "POST" && request.method !== "PUT") {
    writeJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  const principal = await resolvePrincipal(request.headers.authorization);
  if (principal === undefined) {
    writeJson(response, 401, { error: "unauthenticated" });
    return;
  }

  let actor: InternalUser;
  try {
    actor = await identityService.resolveOrCreate(principal);
  } catch (error) {
    if (error instanceof InvalidExternalPrincipalError) {
      writeJson(response, 401, { error: "invalid_identity" });
      return;
    }
    throw error;
  }

  if (url.pathname === "/me") {
    writeJson(response, 200, toPublicUser(actor));
    return;
  }

  if (url.pathname === "/sync/operations" && request.method === "POST") {
    if (syncService === undefined) {
      writeJson(response, 503, { error: "sync_unavailable" });
      return;
    }
    const body = await readJsonBody(request, 128 * 1024);
    if (body === undefined) {
      writeJson(response, 400, { error: "invalid_sync_operation" });
      return;
    }
    try {
      writeJson(response, 200, await syncService.receive(actor.id, body));
    } catch (error) {
      if (error instanceof SyncValidationError) {
        writeJson(response, 400, { error: "invalid_sync_operation" });
        return;
      }
      throw error;
    }
    return;
  }

  if (url.pathname === "/sync/changes" && request.method === "GET") {
    if (syncService === undefined) {
      writeJson(response, 503, { error: "sync_unavailable" });
      return;
    }
    try {
      writeJson(response, 200, await syncService.listChanges(actor.id, url.searchParams.get("cursor"), url.searchParams.get("limit")));
    } catch (error) {
      if (error instanceof SyncValidationError) {
        writeJson(response, 400, { error: "invalid_sync_cursor" });
        return;
      }
      throw error;
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/exercises") {
    if (exerciseCatalogService === undefined) {
      writeJson(response, 503, { error: "catalog_unavailable" });
      return;
    }
    writeJson(response, 200, { exercises: await exerciseCatalogService.listPublished() });
    return;
  }

  if (url.pathname === "/routines" && request.method === "GET") {
    if (routineService === undefined) {
      writeJson(response, 503, { error: "routines_unavailable" });
      return;
    }
    writeJson(response, 200, { routines: await routineService.listOwned(actor.id) });
    return;
  }

  const routineMatch = /^\/routines\/([^/]+)$/.exec(url.pathname);
  if (routineMatch !== null && request.method === "PUT") {
    if (routineService === undefined) {
      writeJson(response, 503, { error: "routines_unavailable" });
      return;
    }
    const input = await readRoutineInput(request);
    if (input === undefined) {
      writeJson(response, 400, { error: "invalid_routine" });
      return;
    }
    try {
      const routine = await routineService.updateOwned(actor.id, decodeURIComponent(routineMatch[1]!), input);
      if (routine === undefined) {
        writeJson(response, 404, { error: "not_found" });
        return;
      }
      writeJson(response, 200, routine);
    } catch (error) {
      if (error instanceof RoutineValidationError) {
        writeJson(response, 400, { error: "invalid_routine" });
        return;
      }
      throw error;
    }
    return;
  }

  if (url.pathname === "/routines" && request.method === "POST") {
    if (routineService === undefined) {
      writeJson(response, 503, { error: "routines_unavailable" });
      return;
    }
    const input = await readRoutineInput(request);
    if (input === undefined) {
      writeJson(response, 400, { error: "invalid_routine" });
      return;
    }
    try {
      writeJson(response, 201, await routineService.createOwned(actor.id, input));
    } catch (error) {
      if (error instanceof RoutineValidationError) {
        writeJson(response, 400, { error: "invalid_routine" });
        return;
      }
      throw error;
    }
    return;
  }

  const profileMatch = /^\/profiles\/([^/]+)$/.exec(url.pathname);
  if (profileMatch !== null) {
    let ownerId: UserId;
    try {
      ownerId = decodeURIComponent(profileMatch[1]!) as UserId;
    } catch {
      writeJson(response, 400, { error: "invalid_resource_id" });
      return;
    }

    const resource: PersonalResource = { type: "profile", ownerId };
    try {
      assertCanReadPersonalResource(actor, resource);
    } catch {
      writeJson(response, 403, { error: "forbidden" });
      return;
    }

    const owner = await identityService.getById(ownerId);
    if (owner === undefined) {
      writeJson(response, 404, { error: "not_found" });
      return;
    }
    writeJson(response, 200, toPublicUser(owner));
    return;
  }

  writeJson(response, 404, { error: "not_found" });
}

function toPublicUser(user: InternalUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readRoutineInput(request: IncomingMessage): Promise<RoutineInput | undefined> {
  const value = await readJsonBody(request, 64 * 1024);
  if (value === undefined) return undefined;
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.description !== "string" || !Array.isArray(value.exerciseIds) || value.exerciseIds.some((id) => typeof id !== "string")) {
    return undefined;
  }
  return { name: value.name, description: value.description, exerciseIds: value.exerciseIds };
}

async function readJsonBody(request: IncomingMessage, maxBytes: number): Promise<unknown | undefined> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBytes) return undefined;
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
