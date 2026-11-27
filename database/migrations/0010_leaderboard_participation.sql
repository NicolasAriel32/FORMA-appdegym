-- Aplicada en Supabase el 2026-11-20 (versión 20261120114736). Copiada al repositorio el 2026-11-27.
create table public.leaderboard_participants (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  enabled boolean not null default false
);
alter table public.leaderboard_participants enable row level security;
revoke all on public.leaderboard_participants from public, anon;
grant select, insert, update on public.leaderboard_participants to authenticated;
create policy participants_read_own on public.leaderboard_participants for select to authenticated using ((select auth.uid()) = owner_id);
create policy participants_insert_own on public.leaderboard_participants for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy participants_update_own on public.leaderboard_participants for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

drop policy leaderboard_insert_own on public.leaderboard_marks;
drop policy leaderboard_update_own on public.leaderboard_marks;
create policy leaderboard_insert_own on public.leaderboard_marks for insert to authenticated
  with check ((select auth.uid()) = owner_id and exists (select 1 from public.leaderboard_participants p where p.owner_id = (select auth.uid()) and p.enabled));
create policy leaderboard_update_own on public.leaderboard_marks for update to authenticated
  using ((select auth.uid()) = owner_id and exists (select 1 from public.leaderboard_participants p where p.owner_id = (select auth.uid()) and p.enabled))
  with check ((select auth.uid()) = owner_id and exists (select 1 from public.leaderboard_participants p where p.owner_id = (select auth.uid()) and p.enabled));

create function public.join_shared_leaderboard(p_display_name text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.leaderboard_participants (owner_id,display_name,enabled)
  values ((select auth.uid()),btrim(p_display_name),true)
  on conflict (owner_id) do update set display_name=excluded.display_name, enabled=true;
  update public.leaderboard_marks set display_name=btrim(p_display_name) where owner_id=(select auth.uid());
end; $$;
create function public.leave_shared_leaderboard() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.leaderboard_participants set enabled=false where owner_id=(select auth.uid());
  delete from public.leaderboard_marks where owner_id=(select auth.uid());
end; $$;

create or replace function public.publish_leaderboard_mark(p_display_name text, p_exercise text, p_load_kg numeric, p_repetitions integer, p_recorded_at timestamptz)
returns void language plpgsql security invoker set search_path = '' as $$
declare visible_name text;
begin
  select display_name into visible_name from public.leaderboard_participants
    where owner_id=(select auth.uid()) and enabled=true for share;
  if not found then raise exception 'Participation is disabled'; end if;
  insert into public.leaderboard_marks as marks (owner_id,exercise,display_name,load_kg,repetitions,recorded_at)
  values ((select auth.uid()),p_exercise,visible_name,p_load_kg,p_repetitions,p_recorded_at)
  on conflict (owner_id,exercise) do update set
    display_name=excluded.display_name,
    load_kg=greatest(marks.load_kg,excluded.load_kg),
    repetitions=case when excluded.load_kg>marks.load_kg or (excluded.load_kg=marks.load_kg and excluded.repetitions>marks.repetitions) then excluded.repetitions else marks.repetitions end,
    recorded_at=case when excluded.load_kg>marks.load_kg or (excluded.load_kg=marks.load_kg and excluded.repetitions>marks.repetitions) or (excluded.load_kg=marks.load_kg and excluded.repetitions=marks.repetitions and excluded.recorded_at<marks.recorded_at) then excluded.recorded_at else marks.recorded_at end,
    updated_at=now();
end; $$;
revoke all on function public.join_shared_leaderboard(text) from public, anon;
revoke all on function public.leave_shared_leaderboard() from public, anon;
grant execute on function public.join_shared_leaderboard(text) to authenticated;
grant execute on function public.leave_shared_leaderboard() to authenticated;
