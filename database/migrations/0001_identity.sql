-- FORMA I1: internal identity and gym membership boundaries.
-- Provider-specific auth tables are intentionally not referenced here.

create table app_users (
  id uuid primary key,
  external_provider text not null,
  external_subject text not null,
  email text,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  constraint app_users_external_identity_unique
    unique (external_provider, external_subject),
  constraint app_users_role_check
    check (role in ('member', 'trainer'))
);

create table gym_memberships (
  gym_id uuid not null,
  user_id uuid not null references app_users(id),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  primary key (gym_id, user_id),
  constraint gym_memberships_status_check
    check (status in ('active', 'inactive', 'blocked'))
);

-- Membership is intentionally not a grant to personal workout data.
-- Resource-specific authorization belongs to the API policy layer.
