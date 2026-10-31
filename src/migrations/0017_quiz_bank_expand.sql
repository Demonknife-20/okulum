-- Soru bankası genişletme (v83): zorluk ve puan alanları.
-- Tablo 0012'de oluşturulmuştu; API ve arayüz bu sürümle ekleniyor.
alter table quiz_bank add column if not exists difficulty smallint not null default 3 check (difficulty between 1 and 5);
alter table quiz_bank add column if not exists points integer not null default 1 check (points between 1 and 10);
