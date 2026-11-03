import { createServer, type Server, type ServerResponse } from "node:http";
import type { IdentityService } from "../modules/identity/service.js";
import {
  assertCanReadPersonalResource,
  type PersonalResource,
} from "../modules/authorization/service.js";
import type {
  ExternalPrincipal,
  InternalUser,
  UserId,
} from "../modules/identity/types.js";

export type PrincipalResolver = (
  authorizationHeader: string | undefined,
) => ExternalPrincipal | undefined;

export type ApiDependencies = {
  identityService: IdentityService;
  resolvePrincipal: PrincipalResolver;
};

type PublicUser = Pick<InternalUser, "id" | "email" | "role" | "createdAt">;

export function createApiServer({
  identityService,
  resolvePrincipal,
}: ApiDependencies): Server {
  return createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://forma.local");

    if (request.method === "GET" && url.pathname === "/health") {
      return writeJson(response, 200, { status: "ok" });
    }

    if (request.method !== "GET") {
      return writeJson(response, 405, { error: "method_not_allowed" });
    }

    const principal = resolvePrincipal(request.headers.authorization);
    if (principal === undefined) {
      return writeJson(response, 401, { error: "unauthenticated" });
    }

    const actor = identityService.resolveOrCreate(principal);

    if (url.pathname === "/me") {
      return writeJson(response, 200, toPublicUser(actor));
    }

    const profileMatch = /^\/profiles\/([^/]+)$/.exec(url.pathname);
    if (profileMatch !== null) {
      const ownerId = decodeURIComponent(profileMatch[1]!) as UserId;
      const owner = identityService.getById(ownerId);
      if (owner === undefined) {
        return writeJson(response, 404, { error: "not_found" });
      }

      const resource: PersonalResource = { type: "profile", ownerId };
      try {
        assertCanReadPersonalResource(actor, resource);
      } catch {
        return writeJson(response, 403, { error: "forbidden" });
      }
      return writeJson(response, 200, toPublicUser(owner));
    }

    return writeJson(response, 404, { error: "not_found" });
  });
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
