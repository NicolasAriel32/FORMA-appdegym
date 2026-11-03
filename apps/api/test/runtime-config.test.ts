import assert from "node:assert/strict";
import test from "node:test";
import { ApiConfigurationError, readApiRuntimeConfig } from "../src/runtime-config.js";

test("API runtime configuration requires server-side database settings", () => {
  assert.deepEqual(readApiRuntimeConfig({
    SUPABASE_URL: "https://tdujzupsvzxrrbnhmtoj.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    DATABASE_URL: "postgresql://server-only@example.test/db",
  }), {
    supabaseUrl: "https://tdujzupsvzxrrbnhmtoj.supabase.co",
    supabasePublishableKey: "publishable-key",
    databaseUrl: "postgresql://server-only@example.test/db",
    port: 8080,
  });
});

test("API runtime configuration fails closed for invalid public configuration", () => {
  assert.throws(
    () => readApiRuntimeConfig({ SUPABASE_URL: "http://example.test", SUPABASE_PUBLISHABLE_KEY: "key", DATABASE_URL: "db" }),
    ApiConfigurationError,
  );
  assert.throws(
    () => readApiRuntimeConfig({ SUPABASE_URL: "https://example.test", SUPABASE_PUBLISHABLE_KEY: "key", DATABASE_URL: "db", PORT: "70000" }),
    ApiConfigurationError,
  );
});
