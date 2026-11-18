-- Veli hesapları: ilk girişte kendi şifrelerini belirlemeleri zorunlu.
-- Otomatik oluşturulan veli hesapları bu bayrakla işaretlenir; şifre değişince bayrak kalkar.
alter table users add column if not exists must_change_password boolean not null default false;
