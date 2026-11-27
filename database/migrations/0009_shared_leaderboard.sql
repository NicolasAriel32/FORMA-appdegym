-- Aplicada en Supabase el 2026-11-20 (versión 20261120114010). Copiada al repositorio el 2026-11-27.
-- Public-facing marks are deliberately separate from private workout history.
create table public.leaderboard_marks (
  owner_id uuid not null references auth.users(id) on delete cascade,
  exercise text not null check (exercise in ('bench', 'squat', 'deadlift')),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  load_kg numeric(10,3) not null check (load_kg > 0 and load_kg <> 'NaN'::numeric),
  repetitions integer not null check (repetitions > 0),
  recorded_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, exercise)
);
create index leaderboard_marks_order_idx on public.leaderboard_marks (exercise, load_kg desc, repetitions desc, recorded_at asc, owner_id);
alter table public.leaderboard_marks enable row level security;
revoke all on public.leaderboard_marks from public, anon;
grant select, insert, update, delete on public.leaderboard_marks to authenticated;
create policy leaderboard_read_participants on public.leaderboard_marks for select to authenticated using (true);
create policy leaderboard_insert_own on public.leaderboard_marks for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy leaderboard_update_own on public.leaderboard_marks for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy leaderboard_delete_own on public.leaderboard_marks for delete to authenticated using ((select auth.uid()) = owner_id);

-- Atomic best-mark update avoids an older device replacing a higher mark.
create function public.publish_leaderboard_mark(p_display_name text, p_exercise text, p_load_kg numeric, p_repetitions integer, p_recorded_at timestamptz)
returns void language sql security invoker set search_path = '' as $$
  insert into public.leaderboard_marks as marks (owner_id, exercise, display_name, load_kg, repetitions, recorded_at)
  values ((select auth.uid()), p_exercise, btrim(p_display_name), p_load_kg, p_repetitions, p_recorded_at)
  on conflict (owner_id, exercise) do update set
    display_name = excluded.display_name,
    load_kg = greatest(marks.load_kg, excluded.load_kg),
    repetitions = case when excluded.load_kg > marks.load_kg or (excluded.load_kg = marks.load_kg and excluded.repetitions > marks.repetitions) then excluded.repetitions else marks.repetitions end,
    recorded_at = case when excluded.load_kg > marks.load_kg or (excluded.load_kg = marks.load_kg and excluded.repetitions > marks.repetitions) or (excluded.load_kg = marks.load_kg and excluded.repetitions = marks.repetitions and excluded.recorded_at < marks.recorded_at) then excluded.recorded_at else marks.recorded_at end,
    updated_at = now();
$$;
revoke all on function public.publish_leaderboard_mark(text,text,numeric,integer,timestamptz) from public, anon;
grant execute on function public.publish_leaderboard_mark(text,text,numeric,integer,timestamptz) to authenticated;
