-- Padlet benzeri pano: düzen, arka plan, kart konumu, beğeni ve yorumlar
alter table boards add column if not exists layout text not null default 'grid' check (layout in ('grid', 'wall', 'stream'));
alter table boards add column if not exists background text not null default 'paper' check (background in ('paper', 'mint', 'sky', 'lilac', 'sun', 'dark'));
alter table board_notes add column if not exists pos_x integer check (pos_x is null or pos_x between 0 and 4000);
alter table board_notes add column if not exists pos_y integer check (pos_y is null or pos_y between 0 and 4000);

create table if not exists board_note_likes (
  note_id uuid not null references board_notes(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);
alter table board_note_likes enable row level security;

create table if not exists board_note_comments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references board_notes(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists board_note_comments_note on board_note_comments(note_id, created_at);
alter table board_note_comments enable row level security;
