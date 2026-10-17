-- Sınav seçenek karıştırma: sınav ayarı ve her denemenin soru bazlı şık sırası (öğrenciye gösterilen -> özgün dizin)
alter table quizzes add column if not exists shuffle_options boolean not null default false;
alter table quiz_attempts add column if not exists option_order jsonb;
