import assert from "node:assert/strict";
import test from "node:test";
import type { Session } from "@supabase/supabase-js";
import {
  loadCurrentSession,
  signInWithPassword,
  signOut,
  subscribeToAuthChanges,
  type AuthGateway,
} from "../src/platform/auth.js";

function session(): Session {
  return {
    access_token: "access-token",
    expires_at: 1_800_000_000,
    expires_in: 3600,
    refresh_token: "refresh-token",
    token_type: "bearer",
    user: {
      id: "auth-user-1",
      aud: "authenticated",
      role: "authenticated",
      email: "member@example.test",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-11-03T00:00:00.000Z",
    },
  };
}

function gateway(overrides: Partial<AuthGateway["auth"]> = {}): AuthGateway {
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async () => ({ data: { session: session() }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      ...overrides,
    },
  };
}

test("sign in validates input and returns a verified provider session", async () => {
  let receivedEmail = "";
  const auth = gateway({
    signInWithPassword: async (credentials) => {
      receivedEmail = credentials.email;
      return { data: { session: session() }, error: null };
    },
  });

  const result = await signInWithPassword(auth, " member@example.test ", "password");

  assert.equal(receivedEmail, "member@example.test");
  assert.equal(result.access_token, "access-token");
  await assert.rejects(
    () => signInWithPassword(auth, "", "password"),
    { code: "invalid_input" },
  );
});

test("auth failures do not expose provider error text to the UI", async () => {
  const auth = gateway({
    signInWithPassword: async () => ({
      data: { session: null },
      error: { message: "provider details that should not leak" },
    }),
  });

  await assert.rejects(
    () => signInWithPassword(auth, "member@example.test", "wrong"),
    (error: unknown) => {
      assert.equal((error as Error).message, "No se pudo iniciar sesión con esos datos.");
      assert.equal((error as { code: string }).code, "auth_failed");
      return true;
    },
  );
});

test("session loading, state subscription cleanup, and sign out are explicit", async () => {
  let unsubscribed = false;
  let receivedSession: Session | null = null;
  const current = session();
  const auth = gateway({
    getSession: async () => ({ data: { session: current }, error: null }),
    onAuthStateChange: (callback) => {
      callback("SIGNED_IN", current);
      return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } };
    },
  });

  assert.equal(await loadCurrentSession(auth), current);
  const cleanup = subscribeToAuthChanges(auth, (next) => { receivedSession = next; });
  cleanup();
  await signOut(auth);

  assert.equal(receivedSession, current);
  assert.equal(unsubscribed, true);
});
