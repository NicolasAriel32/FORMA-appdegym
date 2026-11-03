import type { InternalUser, UserId } from "./types.js";

export interface IdentityRepository {
  findByExternalIdentity(
    provider: string,
    subject: string,
  ): Promise<InternalUser | undefined>;
  findById(id: UserId): Promise<InternalUser | undefined>;
  insertIfAbsent(user: InternalUser): Promise<InternalUser>;
}

export class InMemoryIdentityRepository implements IdentityRepository {
  private readonly byId = new Map<UserId, InternalUser>();
  private readonly byExternalIdentity = new Map<string, UserId>();

  async findByExternalIdentity(
    provider: string,
    subject: string,
  ): Promise<InternalUser | undefined> {
    const id = this.byExternalIdentity.get(this.externalKey(provider, subject));
    const user = id === undefined ? undefined : this.byId.get(id);
    return user === undefined ? undefined : { ...user };
  }

  async findById(id: UserId): Promise<InternalUser | undefined> {
    const user = this.byId.get(id);
    return user === undefined ? undefined : { ...user };
  }

  async insertIfAbsent(user: InternalUser): Promise<InternalUser> {
    const key = this.externalKey(user.externalProvider, user.externalSubject);
    const existingId = this.byExternalIdentity.get(key);
    if (existingId !== undefined) {
      const existing = this.byId.get(existingId);
      if (existing === undefined) {
        throw new Error("identity index is inconsistent");
      }
      return { ...existing };
    }
    if (this.byId.has(user.id)) {
      throw new Error("internal user id already exists");
    }

    this.byId.set(user.id, { ...user });
    this.byExternalIdentity.set(key, user.id);
    return { ...user };
  }

  private externalKey(provider: string, subject: string): string {
    return `${provider}\u0000${subject}`;
  }
}
