import assert from "node:assert/strict";
import test from "node:test";
import {
  createSupabasePrincipalResolver,
  type SupabaseAuthGateway,
} from "../src/modules/identity/supabase-auth.js";

test("Supabase resolver verifies a bearer token and maps the Auth user", async () => {
  let receivedToken: string | undefined;
  const gateway: SupabaseAuthGateway = {
    auth: {
      getUser: async (token) => {
        receivedToken = token;
        return {
          data: { user: { id: "auth-user-1", email: "member@example.test" } },
          error: null,
        };
      },
    },
  };

  const principal = await createSupabasePrincipalResolver(gateway)("Bearer access-token");

  assert.equal(receivedToken, "access-token");
  assert.deepEqual(principal, {
    provider: "supabase",
    subject: "auth-user-1",
    authUserId: "auth-user-1",
    email: "member@example.test",
  });
});

test("Supabase resolver rejects malformed or invalid tokens without throwing", async () => {
  let calls = 0;
  const gateway: SupabaseAuthGateway = {
    auth: {
      getUser: async () => {
        calls += 1;
        return { data: { user: null }, error: new Error("invalid token") };
      },
    },
  };
  const resolve = createSupabasePrincipalResolver(gateway);

  assert.equal(await resolve(undefined), undefined);
  assert.equal(await resolve("Basic access-token"), undefined);
  assert.equal(await resolve("Bearer "), undefined);
  assert.equal(await resolve("Bearer invalid"), undefined);
  assert.equal(calls, 1);
});
