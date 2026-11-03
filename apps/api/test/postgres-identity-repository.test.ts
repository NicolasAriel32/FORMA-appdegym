import assert from "node:assert/strict";
import test from "node:test";
import { PostgresIdentityRepository, type SqlClient } from "../src/modules/identity/postgres-repository.js";
import type { InternalUser } from "../src/modules/identity/types.js";

class FakeSqlClient implements SqlClient {
  public readonly calls: Array<{ text: string; values: readonly unknown[] }> = [];

  public constructor(private readonly responses: Array<Array<Record<string, unknown>>>) {}

  async query<Row extends Record<string, unknown>>(
    text: string,
    values: readonly unknown[],
  ): Promise<{ rows: Row[] }> {
    this.calls.push({ text, values });
    return { rows: (this.responses.shift() ?? []) as Row[] };
  }
}

const row = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "00000000-0000-0000-0000-000000000001",
  auth_user_id: null,
  external_provider: "managed-auth",
  external_subject: "subject-1",
  email: "member@example.test",
  role: "member",
  created_at: "2026-11-03T10:00:00.000Z",
  ...overrides,
});

const user: InternalUser = {
  id: row().id as InternalUser["id"],
  authUserId: null,
  externalProvider: "managed-auth",
  externalSubject: "subject-1",
  email: "member@example.test",
  role: "member",
  createdAt: "2026-11-03T10:00:00.000Z",
};

test("findByExternalIdentity uses parameters and maps the database row", async () => {
  const client = new FakeSqlClient([[row()]]);
  const repository = new PostgresIdentityRepository(client);

  const result = await repository.findByExternalIdentity("managed-auth", "subject-1");

  assert.deepEqual(result, user);
  assert.deepEqual(client.calls[0]?.values, ["managed-auth", "subject-1"]);
  assert.match(client.calls[0]?.text ?? "", /where external_provider = \$1/);
});

test("insertIfAbsent returns the inserted user without a second lookup", async () => {
  const client = new FakeSqlClient([[row()]]);
  const repository = new PostgresIdentityRepository(client);

  const result = await repository.insertIfAbsent(user);

  assert.deepEqual(result, user);
  assert.equal(client.calls.length, 1);
  assert.match(client.calls[0]?.text ?? "", /on conflict \(external_provider, external_subject\) do nothing/);
  assert.deepEqual(client.calls[0]?.values, [
    user.id,
    user.authUserId,
    user.externalProvider,
    user.externalSubject,
    user.email,
    user.role,
    user.createdAt,
  ]);
});

test("insertIfAbsent resolves the existing row after a concurrent conflict", async () => {
  const client = new FakeSqlClient([[], [row()]]);
  const repository = new PostgresIdentityRepository(client);

  const result = await repository.insertIfAbsent(user);

  assert.deepEqual(result, user);
  assert.equal(client.calls.length, 2);
});

test("an invalid database role fails closed", async () => {
  const client = new FakeSqlClient([[row({ role: "admin" })]]);
  const repository = new PostgresIdentityRepository(client);

  await assert.rejects(
    () => repository.findByExternalIdentity("managed-auth", "subject-1"),
    /invalid application role/,
  );
});
