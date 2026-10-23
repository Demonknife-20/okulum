-- Öğretmenin kayıtlı örnek soruları (yapay zekâya örnek olarak verilir, sınava da eklenebilir).
create table if not exists quiz_bank (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  topic text not null check (char_length(topic) between 1 and 160),
  subject_id uuid references subjects(id) on delete set null,
  kind text not null default 'choice' check (kind in ('choice', 'text')),
  text text not null check (char_length(text) between 1 and 1000),
  options jsonb,
  correct_index integer,
  explanation text,
  created_at timestamptz not null default now()
);
create index if not exists quiz_bank_owner on quiz_bank(owner_id, topic);
