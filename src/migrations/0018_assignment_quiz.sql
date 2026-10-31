-- Ödev içine gömülü quiz (v84): bir ödev, öğretmenin aynı sınıf-ders çiftindeki
-- yayınlanmış bir sınavıyla ilişkilendirilebilir. Sınav silinirse bağlantı kalkar.
alter table assignments add column if not exists quiz_id uuid references quizzes(id) on delete set null;
