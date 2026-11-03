-- FORMA: allow online routine edits to preserve removed exercise rows.
-- Only active rows may occupy a position; removed history may retain it.

alter table public.routine_exercises
  drop constraint routine_exercises_position_unique;

create unique index routine_exercises_active_position_unique
  on public.routine_exercises(routine_id, position)
  where status = 'active';
