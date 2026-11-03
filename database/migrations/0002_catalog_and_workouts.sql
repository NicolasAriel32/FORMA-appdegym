-- FORMA: official exercise catalog and personal workout records.
-- This migration preserves retired exercises and historical sets.

create table exercises (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  description text not null default '',
  status text not null default 'published',
  created_at timestamptz not null default now(),
  published_at timestamptz,
  retired_at timestamptz,
  constraint exercises_status_check
    check (status in ('published', 'retired')),
  constraint exercises_retirement_dates_check
    check (
      (status = 'published' and retired_at is null)
      or (status = 'retired' and retired_at is not null)
    )
);

create table workout_sessions (
  id uuid primary key,
  owner_id uuid not null references app_users(id),
  status text not null,
  created_at timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz,
  server_revision bigint not null default 0,
  constraint workout_sessions_status_check
    check (
      status in (
        'prepared',
        'in_progress',
        'paused',
        'finished_local',
        'finished_confirmed',
        'discarded_local',
        'discarded_confirmed',
        'recovery_required'
      )
    )
);

create index workout_sessions_owner_idx on workout_sessions(owner_id);

create table workout_sets (
  id uuid primary key,
  session_id uuid not null references workout_sessions(id) on delete restrict,
  exercise_id uuid not null references exercises(id) on delete restrict,
  repetitions integer not null,
  load_kg numeric(10, 3) not null,
  created_at timestamptz not null,
  constraint workout_sets_repetitions_check check (repetitions > 0),
  constraint workout_sets_load_check check (load_kg >= 0)
);

create index workout_sets_session_idx on workout_sets(session_id, created_at);
