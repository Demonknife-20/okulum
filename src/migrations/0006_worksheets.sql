-- Sınıf çalışmaları: kendi grafik aracımızın satırları (bağlantı yerine içerik)
alter table geogebra_materials alter column url drop not null;
alter table geogebra_materials add column if not exists kind text not null default 'link' check (kind in ('link', 'worksheet'));
alter table geogebra_materials add column if not exists content jsonb;
