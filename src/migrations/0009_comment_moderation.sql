-- Yorum moderasyonu: onaylanmamış yorumlar yalnızca yazarına ve pano yöneticisine görünür
alter table board_note_comments add column if not exists approved boolean not null default true;
