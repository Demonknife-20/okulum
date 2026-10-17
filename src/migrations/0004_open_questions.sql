-- Açık uçlu sorular: soru türü, serbest metin cevabı ve öğretmenin verdiği puan
alter table quiz_questions alter column options drop not null;
alter table quiz_questions alter column correct_index drop not null;
alter table quiz_questions add column if not exists kind text not null default 'choice' check (kind in ('choice', 'text'));
alter table quiz_answers alter column selected drop not null;
alter table quiz_answers add column if not exists text_answer text check (char_length(text_answer) <= 2000);
alter table quiz_answers add column if not exists awarded integer check (awarded >= 0);
alter table quiz_attempts add column if not exists graded boolean not null default true;
