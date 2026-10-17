-- Pansiyon gece yoklaması: öğrenci başına, gün başına tek kayıt (yatıyor / yok / izinli)
create table if not exists night_roll (
  student_id uuid not null references users(id) on delete cascade,
  roll_date date not null,
  status text not null check (status in ('var', 'yok', 'izinli')),
  recorded_by uuid references users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  primary key (student_id, roll_date)
);
alter table night_roll enable row level security;
