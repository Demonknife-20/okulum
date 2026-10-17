-- GeoGebra paneli: sınıf materyalleri (yalnızca geogebra.org bağlantıları)
create table if not exists geogebra_materials (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  url text not null check (char_length(url) <= 500),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists geogebra_materials_class on geogebra_materials(class_id, created_at desc);
alter table geogebra_materials enable row level security;
