-- Ranking de pesos pesados: 1RM estimado (Epley), tablas por sexo, press militar
-- y lectura pública del ranking (solo participantes que se sumaron).

-- 1RM estimado. Una repetición cuenta como el peso levantado; más de 12 no se acepta.
create function public.estimate_1rm(p_load_kg numeric, p_repetitions integer)
returns numeric language sql immutable set search_path = '' as $$
  select case when p_repetitions = 1 then round(p_load_kg, 1)
              else round(p_load_kg * (1 + p_repetitions / 30.0), 1) end;
$$;

alter table public.leaderboard_participants
  add column sex text check (sex in ('M', 'F'));

alter table public.leaderboard_marks drop constraint leaderboard_marks_exercise_check;
alter table public.leaderboard_marks
  add constraint leaderboard_marks_exercise_check check (exercise in ('bench', 'squat', 'deadlift', 'ohp')),
  add constraint leaderboard_marks_repetitions_range check (repetitions between 1 and 12),
  add constraint leaderboard_marks_load_range check (load_kg <= 600),
  add column estimated_1rm numeric(10,1) generated always as (public.estimate_1rm(load_kg, repetitions)) stored;

drop index public.leaderboard_marks_order_idx;
create index leaderboard_marks_rank_idx on public.leaderboard_marks (exercise, estimated_1rm desc, recorded_at asc);

-- Sumarse al ranking pide nombre visible y sexo (para la tabla correspondiente).
drop function public.join_shared_leaderboard(text);
create function public.join_shared_leaderboard(p_display_name text, p_sex text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if p_sex not in ('M', 'F') then raise exception 'Invalid sex'; end if;
  insert into public.leaderboard_participants (owner_id, display_name, sex, enabled)
  values ((select auth.uid()), btrim(p_display_name), p_sex, true)
  on conflict (owner_id) do update set display_name = excluded.display_name, sex = excluded.sex, enabled = true;
  update public.leaderboard_marks set display_name = btrim(p_display_name) where owner_id = (select auth.uid());
end; $$;
revoke all on function public.join_shared_leaderboard(text, text) from public, anon;
grant execute on function public.join_shared_leaderboard(text, text) to authenticated;

-- Guarda la marca solo si mejora el 1RM estimado. Devuelve true si es un récord nuevo.
drop function public.publish_leaderboard_mark(text, text, numeric, integer, timestamptz);
create function public.publish_leaderboard_mark(p_exercise text, p_load_kg numeric, p_repetitions integer, p_recorded_at timestamptz)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  visible_name text;
  changed integer;
begin
  select display_name into visible_name from public.leaderboard_participants
    where owner_id = (select auth.uid()) and enabled = true for share;
  if not found then raise exception 'Participation is disabled'; end if;
  insert into public.leaderboard_marks as marks (owner_id, exercise, display_name, load_kg, repetitions, recorded_at)
  values ((select auth.uid()), p_exercise, visible_name, p_load_kg, p_repetitions, p_recorded_at)
  on conflict (owner_id, exercise) do update set
    display_name = excluded.display_name,
    load_kg = excluded.load_kg,
    repetitions = excluded.repetitions,
    recorded_at = excluded.recorded_at,
    updated_at = now()
  where public.estimate_1rm(excluded.load_kg, excluded.repetitions) > marks.estimated_1rm;
  get diagnostics changed = row_count;
  return changed > 0;
end; $$;
revoke all on function public.publish_leaderboard_mark(text, numeric, integer, timestamptz) from public, anon;
grant execute on function public.publish_leaderboard_mark(text, numeric, integer, timestamptz) to authenticated;

-- Tabla pública: solo nombre visible y marca de quienes se sumaron. Cualquiera puede verla.
create function public.get_leaderboard(p_exercise text, p_sex text, p_limit integer default 50)
returns table (rank_position bigint, display_name text, load_kg numeric, repetitions integer, estimated_1rm numeric, recorded_at timestamptz, is_me boolean)
language sql stable security definer set search_path = '' as $$
  select rank() over (order by m.estimated_1rm desc, m.recorded_at asc),
         p.display_name, m.load_kg, m.repetitions, m.estimated_1rm, m.recorded_at,
         coalesce(m.owner_id = (select auth.uid()), false)
  from public.leaderboard_marks m
  join public.leaderboard_participants p on p.owner_id = m.owner_id and p.enabled
  where m.exercise = p_exercise and p.sex = p_sex
  order by m.estimated_1rm desc, m.recorded_at asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
revoke all on function public.get_leaderboard(text, text, integer) from public;
grant execute on function public.get_leaderboard(text, text, integer) to anon, authenticated;
