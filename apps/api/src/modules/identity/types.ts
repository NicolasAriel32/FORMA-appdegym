export type UserId = string & { readonly __brand: "UserId" };

export type UserRole = "member" | "trainer";

/**
 * Claims resolved by the future managed authentication adapter.
 * Roles are intentionally absent: the client or identity provider must not
 * be able to self-assign an application role.
 */
export type ExternalPrincipal = {
  provider: string;
  subject: string;
  email?: string;
  authUserId?: string | null;
};

export type InternalUser = {
  id: UserId;
  authUserId: string | null;
  externalProvider: string;
  externalSubject: string;
  email: string | null;
  role: UserRole;
  createdAt: string;
};

export type UserIdFactory = () => UserId;
