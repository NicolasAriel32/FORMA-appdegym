import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLazyAuthGateway, needsEagerAuth } from "../src/platform/lazy-auth-gateway.js";

const config = { url: "https://forma.supabase.co", publishableKey: "sb_publishable_test" };

function fakeClient() {
  let emit: (event: string, session: unknown) => void = () => undefined;
  const client = {
    auth: {
      getSession: async () => ({ data: { session: { user: { email: "a@b.c" } } }, error: null }),
      signInWithPassword: async () => { emit("SIGNED_IN", { user: { email: "a@b.c" } }); return { data: { session: { user: { email: "a@b.c" } } }, error: null }; },
      signUp: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => { emit = callback; return { data: { subscription: { unsubscribe: () => undefined } } }; },
    },
  };
  return client as unknown as SupabaseClient;
}

test("lazy auth gateway does not load Supabase when the app opens", async () => {
  let loads = 0;
  const gateway = createLazyAuthGateway(config, async () => { loads += 1; return fakeClient(); });
  gateway.auth.onAuthStateChange(() => undefined);
  assert.deepEqual(await gateway.auth.getSession(), { data: { session: null }, error: null });
  assert.deepEqual(await gateway.auth.signOut(), { error: null });
  assert.equal(loads, 0);
});

test("lazy auth gateway loads Supabase once on sign in and forwards auth events", async () => {
  let loads = 0;
  const gateway = createLazyAuthGateway(config, async () => { loads += 1; return fakeClient(); });
  const events: string[] = [];
  gateway.auth.onAuthStateChange((event) => events.push(event));
  gateway.preload();
  const result = await gateway.auth.signInWithPassword({ email: "a@b.c", password: "x" });
  assert.equal(result.data.session?.user.email, "a@b.c");
  assert.equal(loads, 1);
  assert.deepEqual(events, ["SIGNED_IN"]);
  assert.equal((await gateway.auth.getSession()).data.session?.user.email, "a@b.c");
});

test("lazy auth gateway retries loading after a network failure", async () => {
  let attempts = 0;
  const gateway = createLazyAuthGateway(config, async () => { attempts += 1; if (attempts === 1) throw new Error("offline"); return fakeClient(); });
  await assert.rejects(gateway.auth.signInWithPassword({ email: "a@b.c", password: "x" }));
  await gateway.auth.signInWithPassword({ email: "a@b.c", password: "x" });
  assert.equal(attempts, 2);
});

test("a stored session or a confirmation link loads Supabase when the app opens", async () => {
  const storage = (keys: string[]) => ({ length: keys.length, key: (index: number) => keys[index] ?? null });
  const here = { hash: "", search: "" };
  assert.equal(needsEagerAuth(storage([]), here), false);
  assert.equal(needsEagerAuth(storage(["forma.demo-plans.v1"]), here), false);
  assert.equal(needsEagerAuth(storage(["sb-tdujzupsvzxrrbnhmtoj-auth-token"]), here), true);
  assert.equal(needsEagerAuth(storage([]), { hash: "#access_token=abc&type=signup", search: "" }), true);
  let loads = 0;
  const gateway = createLazyAuthGateway(config, async () => { loads += 1; return fakeClient(); }, () => true);
  assert.equal((await gateway.auth.getSession()).data.session?.user.email, "a@b.c");
  assert.equal(loads, 1);
});
