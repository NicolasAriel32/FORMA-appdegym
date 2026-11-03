import type { IdentityRepository } from "./repository.js";
import type {
  ExternalPrincipal,
  InternalUser,
  UserIdFactory,
} from "./types.js";

export class IdentityService {
  public constructor(
    private readonly repository: IdentityRepository,
    private readonly createUserId: UserIdFactory,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  resolveOrCreate(principal: ExternalPrincipal): InternalUser {
    const existing = this.repository.findByExternalIdentity(
      principal.provider,
      principal.subject,
    );
    if (existing !== undefined) {
      return existing;
    }

    return this.repository.insert({
      id: this.createUserId(),
      externalProvider: principal.provider,
      externalSubject: principal.subject,
      email: principal.email ?? null,
      role: "member",
      createdAt: this.now(),
    });
  }

  getById(id: InternalUser["id"]): InternalUser | undefined {
    return this.repository.findById(id);
  }
}
