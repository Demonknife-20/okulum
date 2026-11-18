-- Deney raporları ve öğrenci ilerlemesi.
-- Her kayıt bir öğrenciye aittir; öğrenci silinince raporları da silinir.
create table if not exists lab_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references users(id) on delete cascade,
  experiment text not null check (char_length(experiment) between 2 and 40),
  title text not null check (char_length(title) between 1 and 120),
  summary jsonb not null default '{}'::jsonb,
  lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists lab_reports_student_idx on lab_reports (student_id, created_at desc);

create table if not exists lab_progress (
  student_id uuid not null references users(id) on delete cascade,
  experiment text not null,
  completed_count integer not null default 0 check (completed_count >= 0),
  last_at timestamptz not null default now(),
  primary key (student_id, experiment)
);
