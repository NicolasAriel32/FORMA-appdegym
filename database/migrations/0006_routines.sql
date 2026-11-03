-- FORMA: online structural routine editing.
-- Routines are owner-scoped. Archiving/removing rows is represented as a
-- status so a future sync/history layer never needs destructive deletion.

create table public.routines (
  id uuid primary key,
  owner_id uuid not null references public.app_users(id) on delete restrict,
  name text not null,
  description text not null default '',
  status text not null default 'active',
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routines_status_check check (status in ('active', 'archived')),
  constraint routines_name_check check (char_length(btrim(name)) between 1 and 120),
  constraint routines_description_check check (char_length(description) <= 1000),
  constraint routines_revision_check check (revision >= 0)
);

create table public.routine_exercises (
  id uuid primary key,
  routine_id uuid not null references public.routines(id) on delete restrict,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  position integer not null,
  target_sets integer not null default 3,
  repetitions_min integer not null default 8,
  repetitions_max integer not null default 12,
  rest_seconds integer not null default 90,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routine_exercises_position_check check (position >= 0),
  constraint routine_exercises_sets_check check (target_sets > 0),
  constraint routine_exercises_repetitions_check check (
    repetitions_min > 0 and repetitions_max >= repetitions_min
  ),
  constraint routine_exercises_rest_check check (rest_seconds >= 0),
  constraint routine_exercises_status_check check (status in ('active', 'removed')),
  constraint routine_exercises_position_unique unique (routine_id, position)
);

create index routines_owner_updated_idx
  on public.routines(owner_id, updated_at desc);

create index routine_exercises_routine_position_idx
  on public.routine_exercises(routine_id, position);

create index routine_exercises_exercise_idx
  on public.routine_exercises(exercise_id);

alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;

revoke all on public.routines from anon;
revoke all on public.routines from authenticated;
revoke all on public.routine_exercises from anon;
revoke all on public.routine_exercises from authenticated;

grant select, insert, update on public.routines to authenticated;
grant select, insert, update on public.routine_exercises to authenticated;

create policy routines_select_own
  on public.routines for select to authenticated
  using (exists (
    select 1
    from public.app_users u
    where u.id = routines.owner_id
      and u.auth_user_id = (select auth.uid())
  ));

create policy routines_insert_own
  on public.routines for insert to authenticated
  with check (exists (
    select 1
    from public.app_users u
    where u.id = routines.owner_id
      and u.auth_user_id = (select auth.uid())
  ));

create policy routines_update_own
  on public.routines for update to authenticated
  using (exists (
    select 1
    from public.app_users u
    where u.id = routines.owner_id
      and u.auth_user_id = (select auth.uid())
  ))
  with check (exists (
    select 1
    from public.app_users u
    where u.id = routines.owner_id
      and u.auth_user_id = (select auth.uid())
  ));

create policy routine_exercises_select_own
  on public.routine_exercises for select to authenticated
  using (exists (
    select 1
    from public.routines r
    join public.app_users u on u.id = r.owner_id
    where r.id = routine_exercises.routine_id
      and u.auth_user_id = (select auth.uid())
  ));

create policy routine_exercises_insert_own
  on public.routine_exercises for insert to authenticated
  with check (exists (
    select 1
    from public.routines r
    join public.app_users u on u.id = r.owner_id
    where r.id = routine_exercises.routine_id
      and u.auth_user_id = (select auth.uid())
  ));

create policy routine_exercises_update_own
  on public.routine_exercises for update to authenticated
  using (exists (
    select 1
    from public.routines r
    join public.app_users u on u.id = r.owner_id
    where r.id = routine_exercises.routine_id
      and u.auth_user_id = (select auth.uid())
  ))
  with check (exists (
    select 1
    from public.routines r
    join public.app_users u on u.id = r.owner_id
    where r.id = routine_exercises.routine_id
      and u.auth_user_id = (select auth.uid())
  ));
