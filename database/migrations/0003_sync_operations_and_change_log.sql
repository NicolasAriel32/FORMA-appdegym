-- FORMA: server-side idempotency evidence and incremental change publication.
-- No remote compaction is introduced by this migration.

create table sync_operations (
  operation_id uuid primary key,
  owner_id uuid not null references app_users(id),
  client_instance_id text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  sequence bigint not null,
  base_revision bigint not null,
  contract_version text not null,
  payload jsonb not null,
  result_status text not null default 'received',
  receipt_id uuid not null unique,
  created_at timestamptz not null,
  processed_at timestamptz not null default now(),
  constraint sync_operations_sequence_check check (sequence >= 0),
  constraint sync_operations_base_revision_check check (base_revision >= 0),
  constraint sync_operations_result_status_check
    check (
      result_status in (
        'received',
        'applied',
        'already_applied',
        'retryable',
        'conflict',
        'blocked',
        'unsupported',
        'recovery_required'
      )
    )
);

create index sync_operations_owner_created_idx
  on sync_operations(owner_id, created_at);

create table sync_changes (
  scope_id text not null,
  cursor bigint generated always as identity,
  change_id uuid not null,
  aggregate_type text not null,
  aggregate_id text not null,
  aggregate_revision bigint not null,
  payload jsonb not null,
  is_tombstone boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (scope_id, cursor),
  unique (scope_id, change_id),
  constraint sync_changes_revision_check check (aggregate_revision >= 0)
);

create index sync_changes_scope_cursor_idx on sync_changes(scope_id, cursor);
