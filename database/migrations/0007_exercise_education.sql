-- FORMA: structured professional educational content for official exercises.
-- Content is catalog data, not user-generated workout data.

alter table public.exercises
  add column movement_pattern text not null default '',
  add column target_muscles text[] not null default '{}',
  add column secondary_muscles text[] not null default '{}',
  add column instructions text not null default '',
  add column common_mistakes text[] not null default '{}',
  add column safety_notes text[] not null default '{}',
  add column equipment text not null default '',
  add column difficulty text not null default 'intermediate';

alter table public.exercises
  add constraint exercises_difficulty_check
    check (difficulty in ('beginner', 'intermediate', 'advanced'));

comment on column public.exercises.instructions is
  'Editorial movement instructions requiring review before publication.';
comment on column public.exercises.common_mistakes is
  'Editorial list of frequent technique errors and corrective cues.';
comment on column public.exercises.safety_notes is
  'General safety cues; not a diagnosis or substitute for professional care.';
