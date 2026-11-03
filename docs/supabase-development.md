# Supabase development environment

## Project

- Name: FORMA
- Project ID: `tdujzupsvzxrrbnhmtoj`
- Region: `sa-east-1`
- API URL: `https://tdujzupsvzxrrbnhmtoj.supabase.co`
- Organization: `GestionInt.00`

The project is a development environment. No production deployment or production data should be connected to it.

## Credentials

The publishable key is intentionally not stored in this repository. Copy it into a local environment file based on `.env.example`. Never put a `service_role` or secret key in `apps/web`, a public build, or GitHub.

## Database state

The following schema is present in the project:

- internal users and gym memberships;
- official exercises;
- structured educational content for official exercises;
- owner-scoped routines and routine exercises;
- workout sessions and sets;
- idempotency evidence and incremental change log;
- Supabase Auth binding through `app_users.auth_user_id`;
- RLS policies for owner-scoped data.

The initial schema was bootstrapped through the Supabase SQL connection after inspecting the empty project. The routine and educational extensions were applied as tracked Supabase migrations `routines_owner_scoped_structural_editing` and `exercise_education_content`. The repository migrations `0001` through `0005` remain the source record of the initial bootstrap and should be formalized in the project migration history before production use. The active-position index for routine exercise history was also applied to the development database as `0008_routine_exercise_history_index.sql`; it is currently visible in the live schema but is not yet represented in Supabase migration history, so this must be reconciled before production promotion.

## Web authentication boundary

The PWA uses the project URL and publishable key only through `VITE_SUPABASE_*` build variables. The browser client deliberately uses `persistSession: false`, `autoRefreshToken: false`, and `detectSessionInUrl: false` for this increment. This keeps the offline unlock and credential-storage policy explicit; it does not claim that authenticated offline training is implemented.

The API-side resolver validates the received bearer token with Supabase Auth and maps the external Auth UUID to the stable internal `app_users.id`. No service key is used by the web client, and no provider error text is shown as an authentication result to the user.

## Server persistence boundary

The API runtime reads `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and an optional `PORT` from the server environment. `DATABASE_URL` is never exposed to Vite, the browser, or a public build. The PostgreSQL adapter uses TLS verification, a bounded pool, a statement timeout, parameterized queries, and explicit `BEGIN`/`COMMIT`/`ROLLBACK` handling. For a persistent API process, use Supabase's direct connection when the runtime has IPv6 or use the session-mode pooler when it only has IPv4; keep SSL enabled in both cases. Transaction-mode pooler URLs are intended for short-lived/serverless transactions and should not be used as a long-lived application pool without validating the provider's limits.

The application API is not deployed yet. A local start requires a real server-only connection string copied into a non-committed environment file. Do not use the database password in `VITE_*` variables, and do not put a `service_role` key in the repository or browser.

The web API client sends `Authorization: Bearer <access token>` to `/me` only when `VITE_FORMA_API_URL` is configured. It sets `cache: no-store`, validates the response shape, and never stores the returned private identity in a browser cache. The endpoint remains unverified end-to-end until the application API is deployed.

## Verification

- All public tables have RLS enabled.
- Security advisors currently report no findings.
- Performance advisors only report unused indexes because the development database is empty; the foreign-key indexes are intentional.
- The project contains no application users or workout data.
- The live `routine_exercises_active_position_unique` partial index was checked directly after the routine history change.
- The API's PostgreSQL repositories and runtime configuration are verified locally with fake clients; no production data path is claimed until the API is deployed and exercised against a test user.
