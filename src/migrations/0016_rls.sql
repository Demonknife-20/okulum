-- 0016_rls.sql — Savunma derinliği: supabase_anon / supabase_authenticated rolleri
-- yanlışlıkla ya da sızdırılmış bir anahtarla tablolardan veri okuyamasın.
--
-- Bu uygulama veritabanına her zaman DATABASE_URL (postgres rolü, session pooler)
-- üzerinden bağlanır; postgres rolü tablo sahibi olduğu için RLS'i atlar, dolayısıyla
-- iş akışında hiçbir değişiklik olmaz. service_role de Supabase'de BYPASSRLS'tir.
-- Yalnızca PostgREST (anon/authenticated) yolu denenecek olursa 0 satır döner.
--
-- Not: Migrasyon her kiracı şeması için ayrıca çalışır; `current_schema()` doğru
-- şemayı verir. Zaman damgalı tablolar ve şema gözetimi hariç.

do $$
declare
  r record;
begin
  for r in
    select c.relname as tbl
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = current_schema()
       and c.relkind = 'r'
       and c.relname not in ('schema_migrations')
  loop
    execute format('alter table %I enable row level security', r.tbl);
  end loop;
end$$;
