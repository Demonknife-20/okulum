-- Pano: öğretmen notları akış ve ızgara düzeninde elle sıralayabilir
alter table board_notes add column if not exists sort_order integer;
create index if not exists board_notes_order on board_notes(board_id, sort_order);
