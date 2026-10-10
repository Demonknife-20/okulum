-- Okulum şeması. Her açılışta idempotent olarak çalışır (create ... if not exists).

create table if not exists school (
  id smallint primary key default 1 check (id = 1),
  name text not null check (char_length(name) between 2 and 120),
  city text not null check (char_length(city) between 2 and 80),
  year text not null check (char_length(year) between 4 and 20),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  password_hash text not null,
  name text not null check (char_length(name) between 2 and 80),
  role text not null check (role in ('principal', 'teacher', 'student')),
  student_no text unique check (student_no is null or char_length(student_no) between 1 and 20),
  created_at timestamptz not null default now()
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 20)
);

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 40)
);

-- Bir öğrenci en fazla bir sınıfta.
create table if not exists enrollments (
  student_id uuid primary key references users(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade
);
create index if not exists enrollments_class on enrollments(class_id);

-- Öğretmenin hangi sınıfta hangi dersi verdiği.
create table if not exists teaching (
  teacher_id uuid not null references users(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  primary key (teacher_id, class_id, subject_id)
);
create index if not exists teaching_pair on teaching(class_id, subject_id);

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  kind text not null default 'online' check (kind in ('online', 'paper')),
  instructions text not null default '' check (char_length(instructions) <= 2000),
  due_at timestamptz,
  file_path text,
  file_name text,
  file_mime text,
  file_size integer,
  created_at timestamptz not null default now()
);
create index if not exists assignments_class on assignments(class_id, subject_id);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_mime text not null,
  file_size integer not null,
  note text not null default '' check (char_length(note) <= 500),
  grade text check (grade is null or char_length(grade) <= 10),
  feedback text not null default '' check (char_length(feedback) <= 1000),
  submitted_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create table if not exists attendance (
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  lesson_date date not null,
  student_id uuid not null references users(id) on delete cascade,
  present boolean not null,
  recorded_by uuid references users(id) on delete set null,
  primary key (class_id, subject_id, lesson_date, student_id)
);
create index if not exists attendance_student on attendance(student_id);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'class')),
  class_id uuid unique references classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((kind = 'class') = (class_id is not null))
);

create table if not exists conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (conversation_id, user_id)
);
create index if not exists conversation_members_user on conversation_members(user_id);

create table if not exists messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid references users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation on messages(conversation_id, id);

-- Supabase: anahtar (anon/authenticated) ile bu tablolara hiçbir erişim olmasın.
-- Sunucu doğrudan veritabanı bağlantısıyla çalışır ve RLS'i aşar.
alter table school enable row level security;
alter table users enable row level security;
alter table classes enable row level security;
alter table subjects enable row level security;
alter table enrollments enable row level security;
alter table teaching enable row level security;
alter table assignments enable row level security;
alter table submissions enable row level security;
alter table attendance enable row level security;
alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;

-- v5: bildirimler, okundu işaretleri, denetim kaydı
alter table submissions add column if not exists graded_at timestamptz;

create table if not exists seen_marks (
  user_id uuid not null references users(id) on delete cascade,
  scope text not null check (scope in ('assignments', 'grades', 'submissions')),
  seen_at timestamptz not null default now(),
  primary key (user_id, scope)
);

create table if not exists conversation_reads (
  user_id uuid not null references users(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  last_read_id bigint not null default 0,
  primary key (user_id, conversation_id)
);

-- Denetim kaydı: kullanıcı silinse de kayıt kalır (actor_id bağlı değil).
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_name text not null,
  actor_role text not null,
  action text not null,
  target text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created on audit_log(created_at desc);

alter table seen_marks enable row level security;
alter table conversation_reads enable row level security;
alter table audit_log enable row level security;

-- v8: panolar (sınıf ve okul panoları) ve pano notları
create table if not exists boards (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 500),
  scope text not null check (scope in ('class', 'school')),
  class_id uuid references classes(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((scope = 'class') = (class_id is not null))
);
create index if not exists boards_class on boards(class_id);

create table if not exists board_notes (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  title text not null default '' check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 2000),
  link text check (link is null or char_length(link) <= 500),
  color text not null default 'sun' check (color in ('sun', 'mint', 'coral', 'sky', 'lilac')),
  file_path text,
  file_name text,
  file_mime text,
  file_size integer,
  created_at timestamptz not null default now(),
  check (char_length(title) + char_length(body) + coalesce(char_length(link), 0) > 0 or file_path is not null)
);
create index if not exists board_notes_board on board_notes(board_id, created_at desc);

alter table boards enable row level security;
alter table board_notes enable row level security;

-- v9: koruma: oturum sürümü (tüm cihazlardan çıkış) ve son giriş bilgisi
alter table users add column if not exists session_version integer not null default 0;
alter table users add column if not exists last_login_at timestamptz;
alter table users add column if not exists last_login_ip text;

-- v10: pano öğrenci atamaları, onay (moderasyon) ve resim önizleme
alter table boards add column if not exists assigned_only boolean not null default false;
alter table boards add column if not exists moderated boolean not null default false;
alter table board_notes add column if not exists approved boolean not null default true;

create table if not exists board_members (
  board_id uuid not null references boards(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  primary key (board_id, student_id)
);
alter table board_members enable row level security;

-- v12: Okulum Asistanı (Gemini): onaylar, sohbetler, mesajlar, günlük kullanım
create table if not exists ai_consents (
  user_id uuid not null references users(id) on delete cascade,
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);

create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null default 'Sohbet' check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_conversations_user on ai_conversations(user_id, updated_at desc);

create table if not exists ai_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 6000),
  created_at timestamptz not null default now()
);
create index if not exists ai_messages_conv on ai_messages(conversation_id, id);

create table if not exists ai_usage (
  user_id uuid not null references users(id) on delete cascade,
  day date not null default current_date,
  used integer not null default 0,
  primary key (user_id, day)
);

alter table ai_consents enable row level security;
alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;
alter table ai_usage enable row level security;
