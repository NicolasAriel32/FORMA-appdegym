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
};

type PublicUser = Pick<InternalUser, "id" | "email" | "role" | "createdAt">;

export function createApiServer({
  identityService,
  resolvePrincipal,
  exerciseCatalogService,
}: ApiDependencies): Server {
  return createServer((request, response) => {
    void handleRequest(
      request,
      response,
      identityService,
      resolvePrincipal,
      exerciseCatalogService,
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
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://forma.local");

  if (request.method === "GET" && url.pathname === "/health") {
    writeJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method !== "GET") {
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

  if (request.method === "GET" && url.pathname === "/exercises") {
    if (exerciseCatalogService === undefined) {
      writeJson(response, 503, { error: "catalog_unavailable" });
      return;
    }
    writeJson(response, 200, { exercises: await exerciseCatalogService.listPublished() });
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
