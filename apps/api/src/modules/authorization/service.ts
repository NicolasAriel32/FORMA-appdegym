import type { InternalUser, UserId } from "../identity/types.js";

export type PersonalResource = {
  type: "profile" | "personal_session";
  ownerId: UserId;
};

/**
 * I1 policy: only the owner may read personal resources.
 * Trainer relationships and consent are intentionally not consulted here;
 * those rules belong to the future F5 authorization module and must not be
 * accidentally inferred from a role or program assignment.
 */
export function canReadPersonalResource(
  actor: InternalUser,
  resource: PersonalResource,
): boolean {
  return actor.id === resource.ownerId;
}

export function assertCanReadPersonalResource(
  actor: InternalUser,
  resource: PersonalResource,
): void {
  if (!canReadPersonalResource(actor, resource)) {
    throw new Error("forbidden personal resource");
  }
}
