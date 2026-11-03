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
- workout sessions and sets;
- idempotency evidence and incremental change log;
- Supabase Auth binding through `app_users.auth_user_id`;
- RLS policies for owner-scoped data.

The initial schema was bootstrapped through the Supabase SQL connection after inspecting the empty project. The repository migrations `0001` through `0005` are the source files and should be formalized in the project migration history before production use.

## Web authentication boundary

The PWA uses the project URL and publishable key only through `VITE_SUPABASE_*` build variables. The browser client deliberately uses `persistSession: false`, `autoRefreshToken: false`, and `detectSessionInUrl: false` for this increment. This keeps the offline unlock and credential-storage policy explicit; it does not claim that authenticated offline training is implemented.

The API-side resolver validates the received bearer token with Supabase Auth and maps the external Auth UUID to the stable internal `app_users.id`. No service key is used by the web client, and no provider error text is shown as an authentication result to the user.

The web API client sends `Authorization: Bearer <access token>` to `/me` only when `VITE_FORMA_API_URL` is configured. It sets `cache: no-store`, validates the response shape, and never stores the returned private identity in a browser cache. The endpoint remains unverified end-to-end until the application API is deployed.

## Verification

- All public tables have RLS enabled.
- Security advisors currently report no findings.
- Performance advisors only report unused indexes because the development database is empty; the foreign-key indexes are intentional.
- The project contains no application users or workout data.
