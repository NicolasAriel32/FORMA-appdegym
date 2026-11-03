-- FORMA: make the deny-by-default publication log explicit and index FK joins.

create index gym_memberships_user_idx
  on public.gym_memberships(user_id);

create index workout_sets_exercise_idx
  on public.workout_sets(exercise_id);

create policy sync_changes_deny_client_read
  on public.sync_changes for select to authenticated
  using (false);
