-- Quiz Bankası ve migration kayıtları anon REST erişimine açık kalmamalı.
alter table quiz_bank enable row level security;
alter table schema_migrations enable row level security;

-- Sağlayıcı kotası ve IP limitleri okul şemalarından bağımsız, uygulama genelinde tutulur.
create table if not exists public.ai_global_usage (
  day date primary key,
  used integer not null default 0 check (used >= 0)
);
alter table public.ai_global_usage enable row level security;

create table if not exists public.ai_request_limits (
  window_start timestamptz not null,
  window_type text not null check (window_type in ('minute', 'day')),
  scope text not null check (scope in ('user', 'ip')),
  key_hash text not null check (char_length(key_hash) = 64),
  request_count integer not null default 0 check (request_count >= 0),
  primary key (window_start, window_type, scope, key_hash)
);
create index if not exists ai_request_limits_window on public.ai_request_limits(window_start);
alter table public.ai_request_limits enable row level security;
