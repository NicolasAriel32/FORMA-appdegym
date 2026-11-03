import assert from "node:assert/strict";
import test from "node:test";
import { canReadPersonalResource } from "../src/modules/authorization/service.js";
import { InMemoryIdentityRepository } from "../src/modules/identity/repository.js";
import { IdentityService } from "../src/modules/identity/service.js";
import type { UserId } from "../src/modules/identity/types.js";

function testUserIdFactory(): () => UserId {
  let sequence = 0;
  return () => `user-${++sequence}` as UserId;
}

function createIdentityService(): IdentityService {
  return new IdentityService(
    new InMemoryIdentityRepository(),
    testUserIdFactory(),
    () => "2026-11-03T00:00:00.000Z",
  );
}

test("the same external identity resolves to one stable internal identity", () => {
  const service = createIdentityService();
  const principal = {
    provider: "managed-auth",
    subject: "subject-1",
    email: "member@example.test",
  };

  const first = service.resolveOrCreate(principal);
  const second = service.resolveOrCreate(principal);

  assert.equal(first.id, second.id);
  assert.equal(first.createdAt, "2026-11-03T00:00:00.000Z");
  assert.equal(first.role, "member");
});

test("different external identities receive different internal identities", () => {
  const service = createIdentityService();

  const member = service.resolveOrCreate({
    provider: "managed-auth",
    subject: "member-1",
  });
  const otherMember = service.resolveOrCreate({
    provider: "managed-auth",
    subject: "member-2",
  });

  assert.notEqual(member.id, otherMember.id);
});

test("a member can read only their own personal resources", () => {
  const service = createIdentityService();
  const member = service.resolveOrCreate({
    provider: "managed-auth",
    subject: "member-1",
  });
  const otherMember = service.resolveOrCreate({
    provider: "managed-auth",
    subject: "member-2",
  });

  assert.equal(
    canReadPersonalResource(member, {
      type: "profile",
      ownerId: member.id,
    }),
    true,
  );
  assert.equal(
    canReadPersonalResource(member, {
      type: "personal_session",
      ownerId: otherMember.id,
    }),
    false,
  );
});

test("a trainer role does not grant access to a member's personal session", () => {
  const service = createIdentityService();
  const trainer = service.resolveOrCreate({
    provider: "managed-auth",
    subject: "trainer-1",
  });
  const member = service.resolveOrCreate({
    provider: "managed-auth",
    subject: "member-1",
  });
  const trainerWithRole = { ...trainer, role: "trainer" as const };

  assert.equal(
    canReadPersonalResource(trainerWithRole, {
      type: "personal_session",
      ownerId: member.id,
    }),
    false,
  );
});
