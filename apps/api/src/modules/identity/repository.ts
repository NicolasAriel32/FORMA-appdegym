import type { InternalUser, UserId } from "./types.js";

export interface IdentityRepository {
  findByExternalIdentity(
    provider: string,
    subject: string,
  ): InternalUser | undefined;
  findById(id: UserId): InternalUser | undefined;
  insert(user: InternalUser): InternalUser;
}

export class InMemoryIdentityRepository implements IdentityRepository {
  private readonly byId = new Map<UserId, InternalUser>();
  private readonly byExternalIdentity = new Map<string, UserId>();

  findByExternalIdentity(
    provider: string,
    subject: string,
  ): InternalUser | undefined {
    const id = this.byExternalIdentity.get(this.externalKey(provider, subject));
    return id === undefined ? undefined : this.byId.get(id);
  }

  findById(id: UserId): InternalUser | undefined {
    return this.byId.get(id);
  }

  insert(user: InternalUser): InternalUser {
    const key = this.externalKey(user.externalProvider, user.externalSubject);
    if (this.byExternalIdentity.has(key)) {
      throw new Error("external identity already exists");
    }
    if (this.byId.has(user.id)) {
      throw new Error("internal user id already exists");
    }

    this.byId.set(user.id, user);
    this.byExternalIdentity.set(key, user.id);
    return user;
  }

  private externalKey(provider: string, subject: string): string {
    return `${provider}\u0000${subject}`;
  }
}
