import type { IdentityRepository } from "./repository.js";
import type {
  ExternalPrincipal,
  InternalUser,
  UserIdFactory,
} from "./types.js";

export class InvalidExternalPrincipalError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidExternalPrincipalError";
  }
}

export class IdentityService {
  public constructor(
    private readonly repository: IdentityRepository,
    private readonly createUserId: UserIdFactory,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async resolveOrCreate(principal: ExternalPrincipal): Promise<InternalUser> {
    this.validatePrincipal(principal);

    const existing = await this.repository.findByExternalIdentity(
      principal.provider,
      principal.subject,
    );
    if (existing !== undefined) {
      return existing;
    }

    return this.repository.insertIfAbsent({
      id: this.createUserId(),
      externalProvider: principal.provider,
      externalSubject: principal.subject,
      email: principal.email ?? null,
      role: "member",
      createdAt: this.now(),
    });
  }

  async getById(id: InternalUser["id"]): Promise<InternalUser | undefined> {
    return this.repository.findById(id);
  }

  private validatePrincipal(principal: ExternalPrincipal): void {
    if (principal.provider.length === 0 || principal.provider.length > 255) {
      throw new InvalidExternalPrincipalError("invalid identity provider");
    }
    if (principal.subject.length === 0 || principal.subject.length > 255) {
      throw new InvalidExternalPrincipalError("invalid identity subject");
    }
    if (principal.email !== undefined && principal.email.length > 320) {
      throw new InvalidExternalPrincipalError("invalid identity email");
    }
  }
}
