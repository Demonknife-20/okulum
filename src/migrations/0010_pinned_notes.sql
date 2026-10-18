-- Pano: öğretmen notları üstte sabitleyebilir
alter table board_notes add column if not exists pinned boolean not null default false;
