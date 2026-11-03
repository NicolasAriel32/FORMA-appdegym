import type { IdentityRepository } from "./repository.js";
import type { InternalUser, UserId } from "./types.js";

export type SqlClient = {
  query<Row extends Record<string, unknown>>(
    text: string,
    values: readonly unknown[],
  ): Promise<{ rows: Row[] }>;
};

type IdentityRow = {
  id: string;
  external_provider: string;
  external_subject: string;
  email: string | null;
  role: string;
  created_at: string | Date;
};

export class PostgresIdentityRepository implements IdentityRepository {
  public constructor(private readonly client: SqlClient) {}

  async findByExternalIdentity(
    provider: string,
    subject: string,
  ): Promise<InternalUser | undefined> {
    const result = await this.client.query<IdentityRow>(
      `select id, external_provider, external_subject, email, role, created_at
       from app_users
       where external_provider = $1 and external_subject = $2`,
      [provider, subject],
    );
    const row = result.rows[0];
    return row === undefined ? undefined : toInternalUser(row);
  }

  async findById(id: UserId): Promise<InternalUser | undefined> {
    const result = await this.client.query<IdentityRow>(
      `select id, external_provider, external_subject, email, role, created_at
       from app_users
       where id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row === undefined ? undefined : toInternalUser(row);
  }

  async insertIfAbsent(user: InternalUser): Promise<InternalUser> {
    const inserted = await this.client.query<IdentityRow>(
      `insert into app_users
         (id, external_provider, external_subject, email, role, created_at)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (external_provider, external_subject) do nothing
       returning id, external_provider, external_subject, email, role, created_at`,
      [
        user.id,
        user.externalProvider,
        user.externalSubject,
        user.email,
        user.role,
        user.createdAt,
      ],
    );
    const insertedRow = inserted.rows[0];
    if (insertedRow !== undefined) {
      return toInternalUser(insertedRow);
    }

    const existing = await this.findByExternalIdentity(
      user.externalProvider,
      user.externalSubject,
    );
    if (existing === undefined) {
      throw new Error("identity conflict did not produce an existing user");
    }
    return existing;
  }
}

function toInternalUser(row: IdentityRow): InternalUser {
  if (row.role !== "member" && row.role !== "trainer") {
    throw new Error("database returned an invalid application role");
  }
  return {
    id: row.id as UserId,
    externalProvider: row.external_provider,
    externalSubject: row.external_subject,
    email: row.email,
    role: row.role,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
  };
}
