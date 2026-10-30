alter table ai_consents add column if not exists withdrawn_at timestamptz;

create table if not exists ai_consent_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references users(id) on delete cascade,
  version text not null,
  action text not null check (action in ('granted', 'withdrawn')),
  created_at timestamptz not null default now()
);
create index if not exists ai_consent_events_user on ai_consent_events(user_id, created_at desc);
alter table ai_consent_events enable row level security;
