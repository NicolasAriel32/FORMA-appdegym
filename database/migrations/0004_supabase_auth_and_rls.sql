-- FORMA: Supabase Auth binding and defense-in-depth RLS.
-- The application API must still enforce authorization explicitly.

alter table public.app_users
  add column auth_user_id uuid references auth.users(id) on delete restrict;

create unique index app_users_auth_user_id_unique
  on public.app_users(auth_user_id)
  where auth_user_id is not null;

alter table public.app_users enable row level security;
alter table public.gym_memberships enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;
alter table public.sync_operations enable row level security;
alter table public.sync_changes enable row level security;

revoke all on public.app_users from anon;
revoke all on public.app_users from authenticated;
revoke all on public.gym_memberships from anon;
revoke all on public.gym_memberships from authenticated;
revoke all on public.exercises from anon;
revoke all on public.exercises from authenticated;
revoke all on public.workout_sessions from anon;
revoke all on public.workout_sessions from authenticated;
revoke all on public.workout_sets from anon;
revoke all on public.workout_sets from authenticated;
revoke all on public.sync_operations from anon;
revoke all on public.sync_operations from authenticated;
revoke all on public.sync_changes from anon;
revoke all on public.sync_changes from authenticated;

grant select, update on public.app_users to authenticated;
grant select on public.gym_memberships to authenticated;
grant select on public.exercises to authenticated;
grant select, insert, update on public.workout_sessions to authenticated;
grant select, insert, update on public.workout_sets to authenticated;
grant select on public.sync_operations to authenticated;

create policy app_users_select_own
  on public.app_users for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = auth_user_id);

create policy app_users_update_own
  on public.app_users for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = auth_user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = auth_user_id);

create policy gym_memberships_select_own
  on public.gym_memberships for select to authenticated
  using (exists (
    select 1
    from public.app_users u
    where u.id = gym_memberships.user_id
      and u.auth_user_id = (select auth.uid())
  ));

create policy exercises_select_published
  on public.exercises for select to authenticated
  using (status = 'published');

create policy workout_sessions_select_own
  on public.workout_sessions for select to authenticated
  using (exists (
    select 1
    from public.app_users u
    where u.id = workout_sessions.owner_id
      and u.auth_user_id = (select auth.uid())
  ));

create policy workout_sessions_insert_own
  on public.workout_sessions for insert to authenticated
  with check (exists (
    select 1
    from public.app_users u
    where u.id = workout_sessions.owner_id
      and u.auth_user_id = (select auth.uid())
  ));

create policy workout_sessions_update_own
  on public.workout_sessions for update to authenticated
  using (exists (
    select 1
    from public.app_users u
    where u.id = workout_sessions.owner_id
      and u.auth_user_id = (select auth.uid())
  ))
  with check (exists (
    select 1
    from public.app_users u
    where u.id = workout_sessions.owner_id
      and u.auth_user_id = (select auth.uid())
  ));

create policy workout_sets_select_own
  on public.workout_sets for select to authenticated
  using (exists (
    select 1
    from public.workout_sessions s
    join public.app_users u on u.id = s.owner_id
    where s.id = workout_sets.session_id
      and u.auth_user_id = (select auth.uid())
  ));

create policy workout_sets_insert_own
  on public.workout_sets for insert to authenticated
  with check (exists (
    select 1
    from public.workout_sessions s
    join public.app_users u on u.id = s.owner_id
    where s.id = workout_sets.session_id
      and u.auth_user_id = (select auth.uid())
  ));

create policy workout_sets_update_own
  on public.workout_sets for update to authenticated
  using (exists (
    select 1
    from public.workout_sessions s
    join public.app_users u on u.id = s.owner_id
    where s.id = workout_sets.session_id
      and u.auth_user_id = (select auth.uid())
  ))
  with check (exists (
    select 1
    from public.workout_sessions s
    join public.app_users u on u.id = s.owner_id
    where s.id = workout_sets.session_id
      and u.auth_user_id = (select auth.uid())
  ));

create policy sync_operations_select_own
  on public.sync_operations for select to authenticated
  using (exists (
    select 1
    from public.app_users u
    where u.id = sync_operations.owner_id
      and u.auth_user_id = (select auth.uid())
  ));

-- sync_changes intentionally has no client policy. It is a server-side
-- publication log and must not be readable through a publishable key.
