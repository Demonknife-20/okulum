-- Pansiyon: evci ve çarşı izni defteri (talep, onay, çıkış ve dönüş e-imzası)
create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('evci', 'carsi')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '' check (char_length(reason) <= 300),
  status text not null default 'bekliyor' check (status in ('bekliyor', 'onaylandi', 'reddedildi', 'iptal', 'disarida', 'tamamlandi')),
  requested_by uuid references users(id) on delete set null,
  decided_by uuid references users(id) on delete set null,
  decided_at timestamptz,
  decision_note text not null default '' check (char_length(decision_note) <= 200),
  exit_at timestamptz,
  exit_signer text check (exit_signer in ('ogrenci', 'veli', 'diger')),
  exit_name text,
  exit_surname text,
  exit_student_no text,
  exit_signature text check (char_length(exit_signature) <= 150000),
  exit_by uuid references users(id) on delete set null,
  return_at timestamptz,
  return_signer text check (return_signer in ('ogrenci', 'veli', 'diger')),
  return_name text,
  return_surname text,
  return_student_no text,
  return_signature text check (char_length(return_signature) <= 150000),
  return_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists leave_requests_student on leave_requests(student_id, starts_at desc);
create index if not exists leave_requests_status on leave_requests(status, starts_at);
alter table leave_requests enable row level security;
