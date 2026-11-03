import assert from "node:assert/strict";
import test from "node:test";
import {
  readWebSupabaseConfig,
  WEB_AUTH_OPTIONS,
} from "../src/platform/supabase-client.js";

test("web Supabase config requires both runtime values and a valid URL", () => {
  assert.equal(readWebSupabaseConfig({}), undefined);
  assert.equal(
    readWebSupabaseConfig({
      VITE_SUPABASE_URL: "not-a-url",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    }),
    undefined,
  );
  assert.deepEqual(
    readWebSupabaseConfig({
      VITE_SUPABASE_URL: " https://forma.supabase.co/ ",
      VITE_SUPABASE_PUBLISHABLE_KEY: " sb_publishable_test ",
    }),
    {
      url: "https://forma.supabase.co/",
      publishableKey: "sb_publishable_test",
    },
  );
});

test("web auth does not persist a session until offline unlock policy is approved", () => {
  assert.deepEqual(WEB_AUTH_OPTIONS, {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  });
});
