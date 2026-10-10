const { q, tx } = require('./db');
const sec = require('./security');
const storage = require('./storage');

// ---------- Yardımcılar ----------
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };
const ok = body => ({ status: 200, body });
const escapeLike = value => value.replace(/[\\%_]/g, c => `\\${c}`);
function pageOf(query, defaultSize = 25) {
  const page = Math.max(1, Number.parseInt(query.get('page') || '1', 10) || 1);
  const size = Math.min(100, Math.max(1, Number.parseInt(query.get('size') || String(defaultSize), 10) || defaultSize));
  return { page, size, offset: (page - 1) * size };
}
const created = body => ({ status: 201, body });

const USERNAME = /^[a-z0-9._-]{3,32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const isId = value => typeof value === 'string' && UUID.test(value);
const requireId = (value, label = 'kayıt') => { if (!isId(value)) fail(400, `Geçersiz ${label}.`); return value; };
const requireDate = value => {
  if (typeof value !== 'string' || !DATE.test(value) || Number.isNaN(Date.parse(value))) fail(400, 'Geçersiz tarih.');
  return value;
};
const COMMON_PASSWORDS = new Set(['password', 'password1', '12345678', '123456789', 'qwerty123', 'sifre1234', 'parola123', '11111111', 'mudur1234', 'ogretmen1', 'ogrenci1', 'okulum123']);
const checkPassword = value => {
  const text = typeof value === 'string' ? value : '';
  if (text.length < 8 || text.length > 128) fail(400, 'Şifre 8-128 karakter olmalı.');
  if (!/[A-Za-z]/.test(text) || !/\d/.test(text)) fail(400, 'Şifre en az bir harf ve bir rakam içermeli.');
  if (COMMON_PASSWORDS.has(text.toLowerCase())) fail(400, 'Bu şifre çok yaygın. Daha zor bir şifre seçin.');
  return text;
};
const istanbulDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(date);
const todayIso = () => istanbulDate();
function defaultSchoolYear() {
  const [year, month] = todayIso().split('-').map(Number);
  const start = month >= 8 ? year : year - 1;
  return `${start}–${start + 1}`;
}
function pairs(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set(), out = [];
  for (const item of value.slice(0, 200)) {
    const classId = requireId(item?.classId, 'sınıf'), subjectId = requireId(item?.subjectId, 'ders');
    const key = `${classId}|${subjectId}`;
    if (!seen.has(key)) { seen.add(key); out.push({ classId, subjectId }); }
  }
  return out;
}
const publicUser = u => ({ id: u.id, username: u.username, name: u.name, role: u.role, studentNo: u.student_no ?? null });
function clientIp(req) {
  if (process.env.TRUST_PROXY) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress || 'unknown';
}

// ---------- Yetki kuralları (tek yer) ----------
async function canTeach(user, classId, subjectId) {
  if (user.role !== 'teacher') return false;
  const { rowCount } = await q('select 1 from teaching where teacher_id = $1 and class_id = $2 and subject_id = $3', [user.id, classId, subjectId]);
  return rowCount > 0;
}
async function teachesClass(user, classId) {
  if (user.role !== 'teacher') return false;
  const { rowCount } = await q('select 1 from teaching where teacher_id = $1 and class_id = $2 limit 1', [user.id, classId]);
  return rowCount > 0;
}
async function enrolledIn(userId, classId) {
  const { rowCount } = await q('select 1 from enrollments where student_id = $1 and class_id = $2', [userId, classId]);
  return rowCount > 0;
}
// Öğretmen ↔ öğrenci: öğretmen, öğrencinin sınıfında ders veriyorsa.
async function canDirectMessage(a, b) {
  if (a.id === b.id) return false;
  if (a.role === 'principal' || b.role === 'principal') return true;
  if (a.role === 'teacher' && b.role === 'teacher') return true;
  const teacher = a.role === 'teacher' ? a : b.role === 'teacher' ? b : null;
  const student = a.role === 'student' ? a : b.role === 'student' ? b : null;
  if (!teacher || !student) return false; // öğrenci ↔ öğrenci yasak
  const { rowCount } = await q(`select 1 from enrollments e join teaching t on t.class_id = e.class_id
    where e.student_id = $1 and t.teacher_id = $2 limit 1`, [student.id, teacher.id]);
  return rowCount > 0;
}
// Kullanıcının göreceği kullanıcı listesi.
function visibility(user) {
  if (user.role === 'principal') return { where: 'true', params: [] };
  if (user.role === 'teacher') return {
    where: `(u.role in ('teacher', 'principal') or (u.role = 'student' and u.id in (
      select e.student_id from enrollments e where e.class_id in (select t.class_id from teaching t where t.teacher_id = $1))))`,
    params: [user.id],
  };
  return {
    where: `(u.role = 'principal' or (u.role = 'teacher' and u.id in (
      select t.teacher_id from teaching t where t.class_id = (select e.class_id from enrollments e where e.student_id = $1))))`,
    params: [user.id],
  };
}
// Ödev kapsamı. $1 her zaman kullanıcı kimliği.
function assignmentScope(user) {
  if (user.role === 'principal') return '$1::uuid is not null';
  if (user.role === 'teacher') return `exists (select 1 from teaching t where t.teacher_id = $1 and t.class_id = a.class_id and t.subject_id = a.subject_id)`;
  return 'a.class_id = (select e.class_id from enrollments e where e.student_id = $1)';
}

async function assignmentFiles(ids) {
  if (!ids.length) return [];
  const { rows } = await q(`select file_path as p from assignments where id = any($1::uuid[]) and file_path is not null
    union all select file_path from submissions where assignment_id = any($1::uuid[])`, [ids]);
  return rows.map(r => r.p);
}

const ASSIGNMENT_COLUMNS = `a.id, a.title, a.kind, a.instructions, a.due_at as "dueAt", a.created_at as "createdAt",
  a.file_name as "fileName", (a.file_path is not null) as "hasFile",
  a.class_id as "classId", c.name as "className", a.subject_id as "subjectId", s.name as "subjectName",
  (select count(*)::int from submissions x where x.assignment_id = a.id) as "submissionCount",
  (select count(*)::int from submissions x where x.assignment_id = a.id and x.grade is null) as "ungradedCount",
  (select count(*)::int from enrollments e where e.class_id = a.class_id) as "studentCount",
  (select json_build_object('id', x.id, 'fileName', x.file_name, 'submittedAt', x.submitted_at,
     'grade', x.grade, 'feedback', x.feedback, 'note', x.note)
   from submissions x where x.assignment_id = a.id and x.student_id = $1) as "mySubmission"`;

async function assignmentsFor(user, { limit = 200, upcomingOnly = false } = {}) {
  const extra = upcomingOnly ? ' and (a.due_at is null or a.due_at >= now())' : '';
  const order = upcomingOnly ? 'coalesce(a.due_at, a.created_at) asc' : 'coalesce(a.due_at, a.created_at) desc';
  const { rows } = await q(`select ${ASSIGNMENT_COLUMNS} from assignments a
    join classes c on c.id = a.class_id join subjects s on s.id = a.subject_id
    where (${assignmentScope(user)})${extra} order by ${order} limit ${Math.max(1, Number(limit) | 0)}`, [user.id]);
  return rows;
}

// ---------- Yönlendirici ----------
const routes = [];
const PRINCIPAL = ['principal'], TEACHER = ['teacher'], STUDENT = ['student'], STAFF = ['principal', 'teacher'];
function on(method, pattern, handler, options = {}) {
  const keys = [];
  const source = pattern.replace(/:(\w+)/g, (_, key) => { keys.push(key); return '([^/]+)'; });
  routes.push({ method, re: new RegExp(`^${source}$`), keys, handler, auth: options.auth ?? true, roles: options.roles || null });
}

async function currentUser(req) {
  const data = sec.readToken(sec.readCookie(req));
  if (!data || !isId(data.id)) return null;
  const { rows: [row] } = await q('select id, username, name, role, student_no, password_hash, session_version from users where id = $1', [data.id]);
  if (!row || sec.fingerprint(row.password_hash) !== data.v) return null;
  if ((row.session_version ?? 0) !== (data.s ?? 0)) return null; // tüm cihazlardan çıkış yapıldı
  return row;
}

async function handleApi({ req, res, url, body }) {
  const matching = routes.filter(r => r.re.test(url.pathname));
  const route = matching.find(r => r.method === req.method);
  if (!route) fail(matching.length ? 405 : 404, matching.length ? 'Bu işlem desteklenmiyor.' : 'Uç nokta bulunamadı.');
  const match = url.pathname.match(route.re);
  const params = Object.fromEntries(route.keys.map((key, i) => [key, decodeURIComponent(match[i + 1])]));
  const user = route.auth || route.roles ? await currentUser(req) : null;
  if (route.auth && !user) fail(401, 'Devam etmek için giriş yapmalısın.');
  if (route.roles && !route.roles.includes(user.role)) fail(403, 'Bu işlem için yetkin yok.');
  return route.handler({ req, res, url, body, params, query: url.searchParams, user });
}

// ---------- Kurulum, oturum, hesap ----------
on('GET', '/api/setup', async () => {
  const { rows: [{ n }] } = await q('select count(*)::int as n from users');
  return ok({ setupRequired: n === 0 });
}, { auth: false });

on('POST', '/api/setup', async ({ body, res }) => {
  const schoolName = str(body.schoolName, 120), schoolCity = str(body.schoolCity, 80);
  const schoolYear = str(body.schoolYear, 20) || defaultSchoolYear();
  const name = str(body.name, 80), username = str(body.username, 32).toLowerCase();
  if (schoolName.length < 2 || schoolCity.length < 2) fail(400, 'Okul adı ve şehir zorunlu.');
  if (name.length < 2) fail(400, 'Müdür adı soyadı zorunlu.');
  if (!USERNAME.test(username)) fail(400, 'Kullanıcı adı 3-32 karakter: harf, rakam, nokta, tire veya alt çizgi.');
  const pass = checkPassword(body.password);
  const user = await tx(async client => {
    await client.query('select pg_advisory_xact_lock(7001)'); // iki kurulum aynı anda çalışmasın
    const { rows: [{ n }] } = await client.query('select count(*)::int as n from users');
    if (n > 0) fail(409, 'Okul zaten kurulmuş.');
    await client.query(`insert into school (id, name, city, year) values (1, $1, $2, $3)
      on conflict (id) do update set name = excluded.name, city = excluded.city, year = excluded.year, updated_at = now()`,
      [schoolName, schoolCity, schoolYear]);
    const { rows } = await client.query(`insert into users (username, password_hash, name, role) values ($1, $2, $3, 'principal')
      returning id, username, name, role, student_no, password_hash, session_version`, [username, sec.hashPassword(pass), name]);
    return rows[0];
  });
  await audit(user, 'setup', schoolName, { city: schoolCity, year: schoolYear });
  sec.setSessionCookie(res, user);
  return created({ user: publicUser(user) });
}, { auth: false });

on('POST', '/api/login', async ({ req, res, body }) => {
  const username = str(body.username, 40).toLowerCase();
  const pass = typeof body.password === 'string' ? body.password : '';
  const ipKey = `ip:${clientIp(req)}`, userKey = `user:${username}`;
  if (sec.isLimited(ipKey) || sec.isLimited(userKey)) fail(429, 'Çok fazla deneme yaptın. 15 dakika sonra tekrar dene.');
  const { rows: [user] } = await q('select id, username, name, role, student_no, password_hash, session_version from users where username = $1', [username]);
  let valid = false;
  if (user) valid = sec.verifyPassword(pass, user.password_hash);
  else sec.burnTime(pass);
  if (!valid) {
    await audit({ name: username || '?', role: 'anonymous' }, 'login_failed', username, { ip: clientIp(req) });
    sec.recordFailure(ipKey);
    sec.recordFailure(userKey);
    fail(401, 'Kullanıcı adı veya şifre hatalı.');
  }
  sec.clearFailures(userKey);
  const portal = body.portal === 'principal' ? 'principal' : 'member';
  if (portal === 'principal' && user.role !== 'principal') {
    fail(403, 'Bu hesap öğretmen veya öğrenci hesabı. Lütfen "Öğretmen / Öğrenci girişi" sayfasını kullan.');
  }
  if (portal === 'member' && user.role === 'principal') {
    fail(403, 'Bu hesap müdür hesabı. Lütfen "Müdür girişi" sayfasını kullan.');
  }
  await q('update users set last_login_at = now(), last_login_ip = $2 where id = $1', [user.id, clientIp(req)]);
  if (user.role === 'principal') await audit({ id: user.id, name: user.name, role: 'principal' }, 'login_success', user.username, { ip: clientIp(req) });
  sec.setSessionCookie(res, user);
  return ok({ user: publicUser(user), portal });
}, { auth: false });

on('POST', '/api/logout', async ({ res }) => {
  sec.clearSessionCookie(res);
  return ok({ loggedOut: true });
}, { auth: false });

on('GET', '/api/me', async ({ user }) => {
  const school = (await q('select name, city, year from school where id = 1')).rows[0] || null;
  const { rows: [login] } = await q('select last_login_at as "lastLoginAt", last_login_ip as "lastLoginIp" from users where id = $1', [user.id]);
  let classId = null, className = null, teaching = [], classes = [], subjects = [];
  if (user.role === 'student') {
    const { rows: [row] } = await q(`select c.id, c.name from enrollments e join classes c on c.id = e.class_id where e.student_id = $1`, [user.id]);
    if (row) { classId = row.id; className = row.name; }
  }
  if (user.role === 'teacher') {
    teaching = (await q(`select t.class_id as "classId", c.name as "className", t.subject_id as "subjectId", s.name as "subjectName"
      from teaching t join classes c on c.id = t.class_id join subjects s on s.id = t.subject_id
      where t.teacher_id = $1 order by c.name, s.name`, [user.id])).rows;
  }
  if (user.role === 'principal') {
    classes = (await q('select id, name from classes order by length(name), name')).rows;
    subjects = (await q('select id, name from subjects order by name')).rows;
  }
  return ok({ user: { ...publicUser(user), classId, className, lastLoginAt: login?.lastLoginAt ?? null, lastLoginIp: login?.lastLoginIp ?? null }, school, teaching, classes, subjects });
});

on('PUT', '/api/me/password', async ({ res, body, user }) => {
  const { rows: [row] } = await q('select password_hash, session_version from users where id = $1', [user.id]);
  if (!sec.verifyPassword(typeof body.current === 'string' ? body.current : '', row.password_hash)) fail(401, 'Mevcut şifre hatalı.');
  const hash = sec.hashPassword(checkPassword(body.next));
  await q('update users set password_hash = $2 where id = $1', [user.id, hash]);
  await audit(user, 'password_changed', user.name);
  sec.setSessionCookie(res, { id: user.id, password_hash: hash, session_version: row.session_version }); // bu oturum açık kalır, diğerleri düşer
  return ok({ changed: true });
});

// ---------- Okul, sınıf, ders ----------
on('GET', '/api/school', async () => ok((await q('select name, city, year from school where id = 1')).rows[0] || null));

on('PUT', '/api/school', async ({ body, user }) => {
  const name = str(body.name, 120), city = str(body.city, 80), year = str(body.year, 20);
  if (name.length < 2 || city.length < 2 || year.length < 4) fail(400, 'Okul adı, şehir ve eğitim yılı zorunlu.');
  await q(`insert into school (id, name, city, year) values (1, $1, $2, $3)
    on conflict (id) do update set name = excluded.name, city = excluded.city, year = excluded.year, updated_at = now()`, [name, city, year]);
  await audit(user, 'school_updated', name, { city, year });
  return ok({ saved: true });
}, { roles: PRINCIPAL });

on('GET', '/api/classes', async () => ok({ classes: (await q(`select c.id, c.name,
    (select count(*)::int from enrollments e where e.class_id = c.id) as "studentCount"
  from classes c order by length(c.name), c.name`)).rows }));

on('POST', '/api/classes', async ({ body, user }) => {
  const name = str(body.name, 20);
  if (!name) fail(400, 'Sınıf adı zorunlu (en fazla 20 karakter).');
  const { rows: [row] } = await q('insert into classes (name) values ($1) returning id, name', [name]);
  await audit(user, 'class_created', row.name);
  return created({ class: row });
}, { roles: PRINCIPAL });

on('DELETE', '/api/classes/:id', async ({ params, user }) => {
  const id = requireId(params.id, 'sınıf');
  const { rows: ids } = await q('select id from assignments where class_id = $1', [id]);
  const files = await assignmentFiles(ids.map(r => r.id));
  const { rowCount } = await q('delete from classes where id = $1', [id]);
  if (!rowCount) fail(404, 'Sınıf bulunamadı.');
  await audit(user, 'class_deleted', id);
  await Promise.all(files.map(storage.remove));
  return ok({ deleted: true });
}, { roles: PRINCIPAL });

on('GET', '/api/subjects', async () => ok({ subjects: (await q('select id, name from subjects order by name')).rows }));

on('POST', '/api/subjects', async ({ body, user }) => {
  const name = str(body.name, 40);
  if (!name) fail(400, 'Ders adı zorunlu (en fazla 40 karakter).');
  const { rows: [row] } = await q('insert into subjects (name) values ($1) returning id, name', [name]);
  await audit(user, 'subject_created', row.name);
  return created({ subject: row });
}, { roles: PRINCIPAL });

on('DELETE', '/api/subjects/:id', async ({ params, user }) => {
  const id = requireId(params.id, 'ders');
  const { rows: ids } = await q('select id from assignments where subject_id = $1', [id]);
  const files = await assignmentFiles(ids.map(r => r.id));
  const { rowCount } = await q('delete from subjects where id = $1', [id]);
  if (!rowCount) fail(404, 'Ders bulunamadı.');
  await audit(user, 'subject_deleted', id);
  await Promise.all(files.map(storage.remove));
  return ok({ deleted: true });
}, { roles: PRINCIPAL });

on('GET', '/api/classes/:id/students', async ({ params, user }) => {
  const classId = requireId(params.id, 'sınıf');
  if (user.role === 'teacher' && !(await teachesClass(user, classId))) fail(403, 'Bu sınıfın öğrencilerine erişimin yok.');
  const { rows } = await q(`select u.id, u.name, u.student_no as "studentNo",
      (select count(*)::int from attendance a where a.student_id = u.id and a.class_id = $1) as total,
      (select count(*)::int from attendance a where a.student_id = u.id and a.class_id = $1 and a.present) as present
    from enrollments e join users u on u.id = e.student_id
    where e.class_id = $1 order by u.name`, [classId]);
  return ok({ students: rows });
}, { roles: STAFF });

// ---------- Kişiler ----------
on('GET', '/api/users', async ({ user, query }) => {
  const scope = visibility(user);
  const params = [...scope.params];
  const conditions = [scope.where];
  const role = query.get('role');
  if (['teacher', 'student', 'principal'].includes(role)) { params.push(role); conditions.push(`u.role = $${params.length}`); }
  const term = str(query.get('q'), 60).toLocaleLowerCase('tr-TR');
  if (term) {
    params.push(`%${escapeLike(term)}%`);
    conditions.push(`(lower(u.name) like $${params.length} or lower(coalesce(u.student_no, '')) like $${params.length})`);
  }
  const where = conditions.join(' and ');
  const { page, size, offset } = pageOf(query);
  const { rows: [{ n }] } = await q(`select count(*)::int as n from users u where ${where}`, params);
  params.push(size, offset);
  const { rows } = await q(`select u.id, u.name, u.role, u.username, u.student_no as "studentNo",
      (select c.id from enrollments e join classes c on c.id = e.class_id where e.student_id = u.id) as "classId",
      (select c.name from enrollments e join classes c on c.id = e.class_id where e.student_id = u.id) as "className",
      (select coalesce(json_agg(json_build_object('classId', t.class_id, 'subjectId', t.subject_id,
          'className', c.name, 'subjectName', s.name) order by c.name, s.name), '[]'::json)
        from teaching t join classes c on c.id = t.class_id join subjects s on s.id = t.subject_id
        where t.teacher_id = u.id) as teaching
    from users u where ${where}
    order by case u.role when 'principal' then 0 when 'teacher' then 1 else 2 end, u.name
    limit $${params.length - 1} offset $${params.length}`, params);
  // Kullanıcı adı ve ders atamaları yalnızca müdüre gösterilir.
  const list = rows.map(row => user.role === 'principal' ? row : { ...row, username: undefined, teaching: undefined });
  return ok({ users: list, total: n, page, size });
});

on('POST', '/api/users', async ({ body, user }) => {
  const role = body.role;
  if (!['teacher', 'student', 'principal'].includes(role)) fail(400, 'Rol müdür, öğretmen veya öğrenci olmalı.');
  const name = str(body.name, 80);
  if (name.length < 2) fail(400, 'Ad soyad en az 2 karakter olmalı.');
  const username = str(body.username, 32).toLowerCase();
  if (!USERNAME.test(username)) fail(400, 'Kullanıcı adı 3-32 karakter: harf, rakam, nokta, tire veya alt çizgi.');
  const pass = checkPassword(body.password);
  const studentNo = role === 'student' ? str(body.studentNo, 20) : null;
  if (role === 'student' && !studentNo) fail(400, 'Öğrenci için okul numarası zorunlu.');
  const classId = role === 'student' && body.classId ? requireId(body.classId, 'sınıf') : null;
  const teaching = role === 'teacher' ? pairs(body.teaching) : [];
  const result = await tx(async client => {
    const { rows: [u] } = await client.query(`insert into users (username, password_hash, name, role, student_no)
      values ($1, $2, $3, $4, $5) returning id, username, name, role, student_no`, [username, sec.hashPassword(pass), name, role, studentNo]);
    if (classId) await client.query('insert into enrollments (student_id, class_id) values ($1, $2)', [u.id, classId]);
    for (const p of teaching) await client.query('insert into teaching (teacher_id, class_id, subject_id) values ($1, $2, $3)', [u.id, p.classId, p.subjectId]);
    return u;
  });
  await audit(user, 'user_created', result.name, { role, username, className: classId ? 'atandı' : null, teachingPairs: role === 'teacher' ? teaching.length : undefined });
  return created({ user: { ...result, studentNo: result.student_no ?? null } });
}, { roles: PRINCIPAL });

on('PATCH', '/api/users/:id', async ({ params, body, user }) => {
  const id = requireId(params.id, 'kullanıcı');
  const { rows: [target] } = await q('select id, role, name, student_no from users where id = $1', [id]);
  if (!target) fail(404, 'Kullanıcı bulunamadı.');
  const name = body.name !== undefined ? str(body.name, 80) : target.name;
  if (name.length < 2) fail(400, 'Ad soyad en az 2 karakter olmalı.');
  const studentNo = target.role === 'student'
    ? (body.studentNo !== undefined ? str(body.studentNo, 20) : target.student_no)
    : null;
  if (target.role === 'student' && !studentNo) fail(400, 'Öğrenci için okul numarası zorunlu.');
  await tx(async client => {
    await client.query('update users set name = $2, student_no = $3 where id = $1', [id, name, studentNo]);
    if (target.role === 'student' && body.classId !== undefined) {
      await client.query('delete from enrollments where student_id = $1', [id]);
      if (body.classId) await client.query('insert into enrollments (student_id, class_id) values ($1, $2)', [id, requireId(body.classId, 'sınıf')]);
    }
    if (target.role === 'teacher' && body.teaching !== undefined) {
      await client.query('delete from teaching where teacher_id = $1', [id]);
      for (const p of pairs(body.teaching)) await client.query('insert into teaching (teacher_id, class_id, subject_id) values ($1, $2, $3)', [id, p.classId, p.subjectId]);
    }
  });
  await audit(user, 'user_updated', name, { classChanged: body.classId !== undefined, teachingPairs: target.role === 'teacher' && body.teaching !== undefined ? pairs(body.teaching).length : undefined });
  return ok({ updated: true });
}, { roles: PRINCIPAL });

on('PUT', '/api/users/:id/password', async ({ params, body, user }) => {
  const id = requireId(params.id, 'kullanıcı');
  if (id === user.id) fail(400, 'Kendi şifreni "Şifremi değiştir" bölümünden değiştir.');
  const pass = checkPassword(body.password);
  const { rowCount } = await q(`update users set password_hash = $2 where id = $1`, [id, sec.hashPassword(pass)]);
  if (!rowCount) fail(404, 'Kullanıcı bulunamadı.');
  const { rows: [target] } = await q('select name from users where id = $1', [id]);
  await audit(user, 'password_reset', target?.name || id);
  return ok({ changed: true }); // eski oturumlar parola özetiyle eşleşmediği için düşer
}, { roles: PRINCIPAL });

on('DELETE', '/api/users/:id', async ({ params, user }) => {
  const id = requireId(params.id, 'kullanıcı');
  const { rows: [target] } = await q('select role, name from users where id = $1', [id]);
  if (!target) fail(404, 'Kullanıcı bulunamadı.');
  if (id === user.id) fail(403, 'Kendi hesabını silemezsin.');
  const { rows: files } = await q('select file_path as p from submissions where student_id = $1', [id]);
  await q('delete from users where id = $1', [id]);
  await audit(user, 'user_deleted', target.name, { role: target.role });
  await Promise.all(files.map(f => storage.remove(f.p)));
  return ok({ deleted: true });
}, { roles: PRINCIPAL });

// ---------- Ödevler ----------
async function assignmentPage(user, query) {
  const { page, size, offset } = pageOf(query, 20);
  const params = [user.id];
  const conditions = [`(${assignmentScope(user)})`];
  const classId = query.get('classId');
  if (classId) { params.push(requireId(classId, 'sınıf')); conditions.push(`a.class_id = $${params.length}`); }
  const term = str(query.get('q'), 80).toLocaleLowerCase('tr-TR');
  if (term) { params.push(`%${escapeLike(term)}%`); conditions.push(`lower(a.title) like $${params.length}`); }
  const where = conditions.join(' and ');
  const { rows: [{ n }] } = await q(`select count(*)::int as n from assignments a where ${where}`, params);
  params.push(size, offset);
  const { rows } = await q(`select ${ASSIGNMENT_COLUMNS} from assignments a
    join classes c on c.id = a.class_id join subjects s on s.id = a.subject_id
    where ${where} order by coalesce(a.due_at, a.created_at) desc
    limit $${params.length - 1} offset $${params.length}`, params);
  return { assignments: rows, total: n, page, size };
}
on('GET', '/api/assignments', async ({ user, query }) => ok(await assignmentPage(user, query)));

on('POST', '/api/assignments', async ({ body, user }) => {
  const classId = requireId(body.classId, 'sınıf'), subjectId = requireId(body.subjectId, 'ders');
  if (!(await canTeach(user, classId, subjectId))) fail(403, 'Bu sınıf ve ders için ödev verme yetkin yok.');
  const title = str(body.title, 160);
  if (title.length < 2) fail(400, 'Ödev başlığı en az 2 karakter olmalı.');
  const kind = body.kind === 'paper' ? 'paper' : 'online';
  const instructions = str(body.instructions, 2000);
  let dueAt = null;
  if (body.dueAt) {
    const date = new Date(body.dueAt);
    if (Number.isNaN(date.getTime())) fail(400, 'Son teslim tarihi geçersiz.');
    dueAt = date.toISOString();
  }
  const upload = body.file ? storage.parseUpload(body.file) : null;
  let filePath = null;
  if (upload) {
    filePath = storage.newPath('assignments', upload.ext, upload.name);
    await storage.put(filePath, upload.buffer, upload.mime);
  }
  try {
    const { rows: [row] } = await q(`insert into assignments (title, class_id, subject_id, created_by, kind, instructions, due_at,
        file_path, file_name, file_mime, file_size)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
      [title, classId, subjectId, user.id, kind, instructions, dueAt, filePath,
        upload?.name ?? null, upload?.mime ?? null, upload?.buffer.length ?? null]);
    await audit(user, 'assignment_created', title, { kind, dueAt });
  return created({ id: row.id });
  } catch (error) {
    if (filePath) await storage.remove(filePath);
    throw error;
  }
}, { roles: TEACHER });

on('DELETE', '/api/assignments/:id', async ({ params, user }) => {
  const id = requireId(params.id, 'ödev');
  const { rows: [a] } = await q('select class_id, subject_id, title from assignments where id = $1', [id]);
  if (!a) fail(404, 'Ödev bulunamadı.');
  if (!(await canTeach(user, a.class_id, a.subject_id))) fail(403, 'Bu ödevi silme yetkin yok.');
  const files = await assignmentFiles([id]);
  await q('delete from assignments where id = $1', [id]);
  await audit(user, 'assignment_deleted', a.title);
  await Promise.all(files.map(storage.remove));
  return ok({ deleted: true });
}, { roles: TEACHER });

on('GET', '/api/assignments/:id/submissions', async ({ params, user }) => {
  const id = requireId(params.id, 'ödev');
  const { rows: [a] } = await q(`select id, title, class_id, subject_id, kind, due_at as "dueAt" from assignments where id = $1`, [id]);
  if (!a) fail(404, 'Ödev bulunamadı.');
  if (user.role === 'teacher' && !(await canTeach(user, a.class_id, a.subject_id))) fail(403, 'Bu ödevin teslimlerine erişimin yok.');
  const submitted = (await q(`select x.id, x.file_name as "fileName", x.file_size as "fileSize", x.note, x.grade, x.feedback,
      x.submitted_at as "submittedAt", u.id as "studentId", u.name as "studentName", u.student_no as "studentNo"
    from submissions x join users u on u.id = x.student_id where x.assignment_id = $1 order by u.name`, [id])).rows;
  const missing = (await q(`select u.id as "studentId", u.name as "studentName", u.student_no as "studentNo"
    from enrollments e join users u on u.id = e.student_id
    where e.class_id = $1 and u.id not in (select student_id from submissions where assignment_id = $2) order by u.name`,
    [a.class_id, id])).rows;
  return ok({ assignment: a, submitted, missing });
}, { roles: STAFF });

on('POST', '/api/assignments/:id/submission', async ({ params, body, user }) => {
  const id = requireId(params.id, 'ödev');
  const { rows: [a] } = await q(`select a.kind, a.due_at from assignments a
    where a.id = $1 and a.class_id = (select e.class_id from enrollments e where e.student_id = $2)`, [id, user.id]);
  if (!a) fail(404, 'Bu ödev sana ait değil ya da bulunamadı.');
  if (a.kind !== 'online') fail(400, 'Bu ödev kağıt üzerinde; dosya teslimi gerekmiyor.');
  if (a.due_at && new Date(a.due_at) < new Date()) fail(400, 'Son teslim tarihi geçti.');
  const upload = storage.parseUpload(body.file);
  const note = str(body.note, 500);
  const { rows: [old] } = await q('select file_path from submissions where assignment_id = $1 and student_id = $2', [id, user.id]);
  const filePath = storage.newPath('submissions', upload.ext, upload.name);
  await storage.put(filePath, upload.buffer, upload.mime);
  try {
    const { rows: [row] } = await q(`insert into submissions (assignment_id, student_id, file_path, file_name, file_mime, file_size, note)
      values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (assignment_id, student_id) do update set file_path = excluded.file_path, file_name = excluded.file_name,
        file_mime = excluded.file_mime, file_size = excluded.file_size, note = excluded.note,
        grade = null, feedback = '', submitted_at = now(), graded_at = null
      returning id, file_name as "fileName", submitted_at as "submittedAt"`,
      [id, user.id, filePath, upload.name, upload.mime, upload.buffer.length, note]);
    if (old) await storage.remove(old.file_path);
    return ok({ submission: row });
  } catch (error) {
    await storage.remove(filePath);
    throw error;
  }
}, { roles: STUDENT });

on('PUT', '/api/submissions/:id/grade', async ({ params, body, user }) => {
  const id = requireId(params.id, 'teslim');
  const { rows: [s] } = await q(`select a.class_id, a.subject_id from submissions x
    join assignments a on a.id = x.assignment_id where x.id = $1`, [id]);
  if (!s) fail(404, 'Teslim bulunamadı.');
  if (!(await canTeach(user, s.class_id, s.subject_id))) fail(403, 'Bu teslimi notlandırma yetkin yok.');
  const grade = str(body.grade, 10) || null;
  await q('update submissions set grade = $2, feedback = $3, graded_at = case when $2::text is null then null else now() end where id = $1', [id, grade, str(body.feedback, 1000)]);
  const { rows: [t] } = await q('select a.title from assignments a join submissions x on x.assignment_id = a.id where x.id = $1', [id]);
  await audit(user, 'grades_saved', t?.title || id, { count: 1 });
  return ok({ saved: true });
}, { roles: TEACHER });

// ---------- Dosyalar (yetki kontrollü indirme) ----------
async function fileOf(storagePath, mime, name) {
  return { file: { buffer: await storage.get(storagePath), mime, name } };
}

on('GET', '/api/files/assignment/:id', async ({ params, user }) => {
  const id = requireId(params.id, 'ödev');
  const { rows: [a] } = await q('select class_id, subject_id, file_path, file_name, file_mime from assignments where id = $1', [id]);
  if (!a || !a.file_path) fail(404, 'Dosya bulunamadı.');
  const allowed = user.role === 'principal'
    || (await canTeach(user, a.class_id, a.subject_id))
    || (user.role === 'student' && await enrolledIn(user.id, a.class_id));
  if (!allowed) fail(403, 'Bu dosyaya erişimin yok.');
  return fileOf(a.file_path, a.file_mime, a.file_name);
});

on('GET', '/api/files/submission/:id', async ({ params, user }) => {
  const id = requireId(params.id, 'teslim');
  const { rows: [s] } = await q(`select x.student_id, x.file_path, x.file_name, x.file_mime, a.class_id, a.subject_id
    from submissions x join assignments a on a.id = x.assignment_id where x.id = $1`, [id]);
  if (!s) fail(404, 'Dosya bulunamadı.');
  const allowed = user.role === 'principal' || s.student_id === user.id || (await canTeach(user, s.class_id, s.subject_id));
  if (!allowed) fail(403, 'Bu dosyaya erişimin yok.');
  return fileOf(s.file_path, s.file_mime, s.file_name);
});

// ---------- Yoklama ----------
on('GET', '/api/attendance/roster', async ({ query, user }) => {
  const classId = requireId(query.get('classId'), 'sınıf'), subjectId = requireId(query.get('subjectId'), 'ders');
  const date = requireDate(query.get('date') || todayIso());
  if (user.role === 'teacher' && !(await canTeach(user, classId, subjectId))) fail(403, 'Bu sınıf ve ders için yoklama yetkin yok.');
  const students = (await q(`select u.id, u.name, u.student_no as "studentNo" from enrollments e
    join users u on u.id = e.student_id where e.class_id = $1 order by u.name`, [classId])).rows;
  const records = (await q(`select student_id, present from attendance
    where class_id = $1 and subject_id = $2 and lesson_date = $3`, [classId, subjectId, date])).rows;
  const totals = (await q(`select student_id, count(*)::int as total, count(*) filter (where present)::int as present
    from attendance where class_id = $1 and subject_id = $2 group by student_id`, [classId, subjectId])).rows;
  const statusOf = new Map(records.map(r => [r.student_id, r.present ? 'present' : 'absent']));
  const totalOf = new Map(totals.map(t => [t.student_id, t]));
  return ok({
    date,
    recorded: records.length > 0,
    students: students.map(s => ({
      ...s,
      status: statusOf.get(s.id) ?? null,
      present: totalOf.get(s.id)?.present ?? 0,
      total: totalOf.get(s.id)?.total ?? 0,
    })),
  });
}, { roles: STAFF });

on('PUT', '/api/attendance', async ({ body, user }) => {
  const classId = requireId(body.classId, 'sınıf'), subjectId = requireId(body.subjectId, 'ders');
  const date = requireDate(body.date);
  if (date > todayIso()) fail(400, 'Gelecek bir tarihe yoklama girilemez.');
  if (!(await canTeach(user, classId, subjectId))) fail(403, 'Bu sınıf ve ders için yoklama yetkin yok.');
  if (!body.records || typeof body.records !== 'object' || Array.isArray(body.records)) fail(400, 'Yoklama kayıtları geçersiz.');
  const entries = Object.entries(body.records);
  if (entries.length > 500) fail(400, 'Tek seferde en fazla 500 kayıt gönderilebilir.');
  const enrolled = new Set((await q('select student_id from enrollments where class_id = $1', [classId])).rows.map(r => r.student_id));
  for (const [studentId, value] of entries) {
    if (!isId(studentId) || !enrolled.has(studentId)) fail(400, 'Kayıtlardan biri bu sınıfa ait değil.');
    if (![null, 'present', 'absent'].includes(value)) fail(400, 'Geçersiz yoklama değeri.');
  }
  await tx(async client => {
    for (const [studentId, value] of entries) {
      if (value === null) {
        await client.query('delete from attendance where class_id = $1 and subject_id = $2 and lesson_date = $3 and student_id = $4',
          [classId, subjectId, date, studentId]);
      } else {
        await client.query(`insert into attendance (class_id, subject_id, lesson_date, student_id, present, recorded_by)
          values ($1, $2, $3, $4, $5, $6)
          on conflict (class_id, subject_id, lesson_date, student_id)
          do update set present = excluded.present, recorded_by = excluded.recorded_by`,
          [classId, subjectId, date, studentId, value === 'present', user.id]);
      }
    }
  });
  const { rows: [names] } = await q('select (select name from classes where id = $1) as c, (select name from subjects where id = $2) as s', [classId, subjectId]);
  await audit(user, 'attendance_saved', `${names.c} · ${names.s}`, { date, count: entries.length });
  return ok({ saved: entries.length });
}, { roles: TEACHER });

on('GET', '/api/attendance/me', async ({ user }) => {
  const subjects = (await q(`select s.id as "subjectId", s.name as "subjectName",
      count(*)::int as total, count(*) filter (where a.present)::int as present
    from attendance a join subjects s on s.id = a.subject_id
    where a.student_id = $1 group by s.id, s.name order by s.name`, [user.id])).rows;
  const recent = (await q(`select s.name as "subjectName", a.lesson_date as date, a.present
    from attendance a join subjects s on s.id = a.subject_id
    where a.student_id = $1 order by a.lesson_date desc, s.name limit 30`, [user.id])).rows;
  return ok({ subjects, recent });
}, { roles: STUDENT });

// ---------- Mesajlaşma (özel, yetki kontrollü) ----------
async function ensureClassConversations(user) {
  if (user.role === 'student') {
    await q(`insert into conversations (kind, class_id)
      select distinct 'class'::text, e.class_id from enrollments e where e.student_id = $1
      on conflict (class_id) do nothing`, [user.id]);
  }
  if (user.role === 'teacher') {
    await q(`insert into conversations (kind, class_id)
      select distinct 'class'::text, t.class_id from teaching t where t.teacher_id = $1
      on conflict (class_id) do nothing`, [user.id]);
  }
}

async function conversationFor(user, id) {
  requireId(id, 'sohbet');
  const { rows: [c] } = await q('select id, kind, class_id from conversations where id = $1', [id]);
  if (!c) fail(404, 'Sohbet bulunamadı.');
  let allowed;
  if (c.kind === 'direct') {
    allowed = (await q('select 1 from conversation_members where conversation_id = $1 and user_id = $2', [id, user.id])).rowCount > 0;
  } else {
    allowed = (await q(`select 1 from enrollments where student_id = $1 and class_id = $2
      union all select 1 from teaching where teacher_id = $1 and class_id = $2 limit 1`, [user.id, c.class_id])).rowCount > 0;
  }
  if (!allowed) fail(403, 'Bu sohbete erişimin yok.');
  return c;
}

async function titleFor(user, c) {
  if (c.kind === 'class') {
    const { rows: [row] } = await q('select name from classes where id = $1', [c.class_id]);
    return `${row?.name || ''} sınıf grubu`;
  }
  const { rows: [row] } = await q(`select u.name from conversation_members m join users u on u.id = m.user_id
    where m.conversation_id = $1 and m.user_id <> $2 limit 1`, [c.id, user.id]);
  return row?.name || 'Silinmiş kullanıcı';
}

on('GET', '/api/conversations', async ({ user }) => {
  await ensureClassConversations(user);
  const { rows } = await q(`
    with mine as (
      select c.id, c.kind, c.class_id, c.created_at from conversations c
      where (c.kind = 'direct' and exists (select 1 from conversation_members m where m.conversation_id = c.id and m.user_id = $1))
         or (c.kind = 'class' and c.class_id in (
              select e.class_id from enrollments e where e.student_id = $1
              union select t.class_id from teaching t where t.teacher_id = $1))
    )
    select m.id, m.kind,
      case when m.kind = 'class'
        then (select cl.name from classes cl where cl.id = m.class_id) || ' sınıf grubu'
        else (select u.name from conversation_members cm join users u on u.id = cm.user_id
              where cm.conversation_id = m.id and cm.user_id <> $1 limit 1)
      end as title,
      last.body as "lastBody", last.created_at as "lastAt"
    from mine m
    left join lateral (select msg.body, msg.created_at from messages msg
      where msg.conversation_id = m.id order by msg.id desc limit 1) last on true
    order by last.created_at desc nulls last, m.created_at desc`, [user.id]);
  return ok({ conversations: rows });
});

on('POST', '/api/conversations', async ({ body, user }) => {
  const otherId = requireId(body.userId, 'kullanıcı');
  if (otherId === user.id) fail(400, 'Kendinle sohbet açamazsın.');
  const { rows: [other] } = await q('select id, role, name from users where id = $1', [otherId]);
  if (!other) fail(404, 'Kullanıcı bulunamadı.');
  if (!(await canDirectMessage(user, other))) fail(403, 'Bu kişiye mesaj gönderemezsin.');
  const { rows: [existing] } = await q(`select c.id from conversations c
    where c.kind = 'direct'
      and exists (select 1 from conversation_members m where m.conversation_id = c.id and m.user_id = $1)
      and exists (select 1 from conversation_members m where m.conversation_id = c.id and m.user_id = $2)
      and (select count(*) from conversation_members m where m.conversation_id = c.id) = 2
    limit 1`, [user.id, otherId]);
  if (existing) return ok({ id: existing.id });
  const id = await tx(async client => {
    const { rows: [c] } = await client.query(`insert into conversations (kind) values ('direct') returning id`);
    await client.query('insert into conversation_members (conversation_id, user_id) values ($1, $2), ($1, $3)', [c.id, user.id, otherId]);
    return c.id;
  });
  return created({ id });
});

on('GET', '/api/conversations/:id/messages', async ({ params, query, user }) => {
  const c = await conversationFor(user, params.id);
  const after = query.get('after'), before = query.get('before');
  if ((after && !/^\d+$/.test(after)) || (before && !/^\d+$/.test(before))) fail(400, 'Geçersiz mesaj kimliği.');
  const columns = `m.id, m.body, m.created_at as "createdAt", m.sender_id as "senderId", u.name as "senderName"`;
  const base = `select ${columns} from messages m left join users u on u.id = m.sender_id where m.conversation_id = $1`;
  let rows;
  let size = 100;
  if (after) {
    rows = (await q(`${base} and m.id > $2 order by m.id asc limit 200`, [c.id, after])).rows;
  } else if (before) {
    size = 50;
    rows = (await q(`${base} and m.id < $2 order by m.id desc limit ${size}`, [c.id, before])).rows.reverse();
  } else {
    rows = (await q(`${base} order by m.id desc limit ${size}`, [c.id])).rows.reverse();
  }
  const more = !after && rows.length === size;
  return ok({ conversation: { id: c.id, kind: c.kind, title: await titleFor(user, c) }, messages: rows, more });
});

on('POST', '/api/conversations/:id/messages', async ({ params, body, user }) => {
  const c = await conversationFor(user, params.id);
  const raw = String(body.body ?? '').trim();
  if (!raw) fail(400, 'Mesaj boş olamaz.');
  if (raw.length > 2000) fail(400, 'Mesaj en fazla 2000 karakter olabilir.');
  const { rows: [m] } = await q(`insert into messages (conversation_id, sender_id, body) values ($1, $2, $3)
    returning id, body, created_at as "createdAt", sender_id as "senderId"`, [c.id, user.id, raw]);
  return created({ message: { ...m, senderName: user.name } });
});

// ---------- Genel bakış (rol bazlı, gerçek veriden) ----------
on('GET', '/api/overview', async ({ user }) => {
  if (user.role === 'principal') {
    const { rows: [stats] } = await q(`select
        (select count(*)::int from users where role = 'teacher') as teachers,
        (select count(*)::int from users where role = 'student') as students,
        (select count(*)::int from classes) as classes,
        (select count(*)::int from subjects) as subjects,
        (select count(*)::int from assignments) as assignments,
        (select count(*)::int from submissions where grade is null) as ungraded,
        (select count(*)::int from attendance where lesson_date >= current_date - 30) as "attTotal",
        (select count(*)::int from attendance where lesson_date >= current_date - 30 and present) as "attPresent"`);
    return ok({ role: 'principal', stats, recent: await assignmentsFor(user, { limit: 5 }) });
  }
  if (user.role === 'teacher') {
    const scope = `exists (select 1 from teaching t where t.teacher_id = $1 and t.class_id = a.class_id and t.subject_id = a.subject_id)`;
    const { rows: [stats] } = await q(`select
        (select count(*)::int from assignments a where ${scope}) as assignments,
        (select count(*)::int from submissions x join assignments a on a.id = x.assignment_id where x.grade is null and ${scope}) as ungraded,
        (select count(*)::int from attendance a where a.lesson_date >= current_date - 30 and ${scope}) as "attTotal",
        (select count(*)::int from attendance a where a.lesson_date >= current_date - 30 and a.present and ${scope}) as "attPresent",
        (select count(distinct class_id)::int from teaching where teacher_id = $1) as classes`, [user.id]);
    const classes = (await q(`select c.id, c.name, array_agg(s.name order by s.name) as subjects
      from teaching t join classes c on c.id = t.class_id join subjects s on s.id = t.subject_id
      where t.teacher_id = $1 group by c.id, c.name order by length(c.name), c.name`, [user.id])).rows;
    return ok({ role: 'teacher', stats, classes, upcoming: await assignmentsFor(user, { upcomingOnly: true, limit: 5 }) });
  }
  const { rows: [cls] } = await q(`select c.name from enrollments e join classes c on c.id = e.class_id where e.student_id = $1`, [user.id]);
  const { rows: [att] } = await q(`select count(*)::int as total, count(*) filter (where present)::int as present
    from attendance where student_id = $1 and lesson_date >= current_date - 30`, [user.id]);
  const { rows: [pending] } = await q(`select count(*)::int as n from assignments a
    where (${assignmentScope(user)}) and a.kind = 'online' and (a.due_at is null or a.due_at >= now())
      and not exists (select 1 from submissions x where x.assignment_id = a.id and x.student_id = $1)`, [user.id]);
  const grades = (await q(`select a.title, s.name as "subjectName", x.grade, x.feedback
    from submissions x join assignments a on a.id = x.assignment_id join subjects s on s.id = a.subject_id
    where x.student_id = $1 and x.grade is not null order by x.submitted_at desc limit 5`, [user.id])).rows;
  return ok({
    role: 'student',
    className: cls?.name || null,
    stats: { pending: pending.n, attTotal: att.total, attPresent: att.present },
    upcoming: await assignmentsFor(user, { upcomingOnly: true, limit: 5 }),
    grades,
  });
});


// ---------- Toplu not ve ödev düzenleme ----------
on('PUT', '/api/assignments/:id/grades', async ({ params, body, user }) => {
  const id = requireId(params.id, 'ödev');
  const { rows: [a] } = await q('select class_id, subject_id from assignments where id = $1', [id]);
  if (!a) fail(404, 'Ödev bulunamadı.');
  if (!(await canTeach(user, a.class_id, a.subject_id))) fail(403, 'Bu ödevin notlarını girme yetkin yok.');
  if (!Array.isArray(body.grades) || !body.grades.length) fail(400, 'Kaydedilecek not yok.');
  if (body.grades.length > 300) fail(400, 'Tek seferde en fazla 300 not kaydedilebilir.');
  const items = body.grades.map(g => ({
    id: requireId(g?.id, 'teslim'),
    grade: str(g?.grade, 10) || null,
    feedback: str(g?.feedback, 1000),
  }));
  if (new Set(items.map(i => i.id)).size !== items.length) fail(400, 'Aynı teslim birden fazla kez gönderilmiş.');
  await tx(async client => {
    const { rows } = await client.query('select id from submissions where assignment_id = $1 and id = any($2::uuid[])', [id, items.map(i => i.id)]);
    if (rows.length !== items.length) fail(400, 'Listede bu ödeve ait olmayan bir teslim var. Hiçbir not kaydedilmedi.');
    for (const item of items) {
      await client.query('update submissions set grade = $2, feedback = $3, graded_at = case when $2::text is null then null else now() end where id = $1', [item.id, item.grade, item.feedback]);
    }
  });
  const { rows: [t] } = await q('select title from assignments where id = $1', [id]);
  await audit(user, 'grades_saved', t?.title || id, { count: items.length });
  return ok({ saved: items.length });
}, { roles: TEACHER });

on('PATCH', '/api/assignments/:id', async ({ params, body, user }) => {
  const id = requireId(params.id, 'ödev');
  const { rows: [a] } = await q('select class_id, subject_id from assignments where id = $1', [id]);
  if (!a) fail(404, 'Ödev bulunamadı.');
  if (!(await canTeach(user, a.class_id, a.subject_id))) fail(403, 'Bu ödevi düzenleme yetkin yok.');
  const values = [id];
  const sets = [];
  if (body.title !== undefined) {
    const title = str(body.title, 160);
    if (title.length < 2) fail(400, 'Ödev başlığı en az 2 karakter olmalı.');
    values.push(title); sets.push(`title = $${values.length}`);
  }
  if (body.instructions !== undefined) { values.push(str(body.instructions, 2000)); sets.push(`instructions = $${values.length}`); }
  if (body.dueAt !== undefined) {
    let dueAt = null;
    if (body.dueAt) {
      const date = new Date(body.dueAt);
      if (Number.isNaN(date.getTime())) fail(400, 'Son teslim tarihi geçersiz.');
      dueAt = date.toISOString();
    }
    values.push(dueAt); sets.push(`due_at = $${values.length}`);
  }
  if (!sets.length) fail(400, 'Güncellenecek alan yok.');
  await q(`update assignments set ${sets.join(', ')} where id = $1`, values);
  const { rows: [t] } = await q('select title from assignments where id = $1', [id]);
  await audit(user, 'assignment_updated', t?.title || id, { fields: sets.length });
  return ok({ updated: true });
}, { roles: TEACHER });

// ---------- Devamsızlık uyarıları ----------
const ALERT = { lessons: 5, rate: 80, streak: 3, days: 90 };
// Veri her değiştiğinde artar; uyarı önbelleği bu sayı değişince geçersiz olur.
let dataVersion = 0;
const alertCache = new Map();
const ALERT_TTL_MS = 60 * 1000;

// Her önemli işlem burada kaydedilir. Hata denetim yüzünden asıl işlemi bozmaz.
async function audit(actor, action, target = '', details = {}) {
  dataVersion += 1;
  try {
    await q(`insert into audit_log (actor_id, actor_name, actor_role, action, target, details) values ($1, $2, $3, $4, $5, $6)`,
      [actor?.id ?? null, actor?.name ?? 'Sistem', actor?.role ?? 'sistem', action, String(target).slice(0, 200), JSON.stringify(details)]);
  } catch (error) {
    console.error('Denetim kaydı yazılamadı:', error.message);
  }
}

async function computeAlerts(user) {
  const key = `${user.role}:${user.id}`;
  const cached = alertCache.get(key);
  if (cached && cached.version === dataVersion && Date.now() - cached.at < ALERT_TTL_MS) return cached.value;

  let scope;
  if (user.role === 'principal') scope = '$1::uuid is not null';
  else if (user.role === 'teacher') scope = `exists (select 1 from teaching t where t.teacher_id = $1
    and t.class_id = a.class_id and t.subject_id = a.subject_id)`;
  else scope = 'a.student_id = $1';
  // Veritabanı öğrenci-ders başına toplam, devam ve son devam dizisini döndürür; ham ders kayıtları taşınmaz.
  const { rows } = await q(`select a.student_id as "studentId", a.class_id as "classId", a.subject_id as "subjectId",
      u.name as "studentName", u.student_no as "studentNo", c.name as "className", s.name as "subjectName",
      count(*)::int as total, count(*) filter (where a.present)::int as present,
      array_agg(a.present order by a.lesson_date desc) as recent
    from attendance a
    join users u on u.id = a.student_id join classes c on c.id = a.class_id join subjects s on s.id = a.subject_id
    where (${scope}) and a.lesson_date >= current_date - ${ALERT.days}
    group by a.student_id, a.class_id, a.subject_id, u.name, u.student_no, c.name, s.name`, [user.id]);
  const alerts = [];
  for (const r of rows) {
    const rate = Math.round((r.present / r.total) * 100);
    let streak = 0;
    for (const present of r.recent) { if (present) break; streak += 1; }
    const reason = streak >= ALERT.streak ? 'streak' : (r.total >= ALERT.lessons && rate < ALERT.rate ? 'low_rate' : null);
    if (!reason) continue;
    alerts.push({
      studentId: r.studentId, studentName: r.studentName, studentNo: r.studentNo,
      classId: r.classId, className: r.className, subjectId: r.subjectId, subjectName: r.subjectName,
      reason, rate, total: r.total, present: r.present, streak,
    });
  }
  alerts.sort((x, y) => (y.streak - x.streak) || (x.rate - y.rate));
  alertCache.set(key, { version: dataVersion, at: Date.now(), value: alerts });
  return alerts;
}

on('GET', '/api/alerts', async ({ user }) => ok({ alerts: await computeAlerts(user), thresholds: ALERT }));

// ---------- Bildirimler ----------
async function notificationsFor(user) {
  const seenAt = async scope => (await q('select seen_at from seen_marks where user_id = $1 and scope = $2', [user.id, scope])).rows[0]?.seen_at ?? new Date(0);
  const access = `((c.kind = 'direct' and exists (select 1 from conversation_members cm where cm.conversation_id = c.id and cm.user_id = $1))
    or (c.kind = 'class' and c.class_id in (select e.class_id from enrollments e where e.student_id = $1
        union select t.class_id from teaching t where t.teacher_id = $1)))`;
  const { rows: convRows } = await q(`select m.conversation_id as id, count(*)::int as n from messages m
    join conversations c on c.id = m.conversation_id
    left join conversation_reads r on r.user_id = $1 and r.conversation_id = m.conversation_id
    where m.sender_id is distinct from $1 and m.id > coalesce(r.last_read_id, 0) and ${access}
    group by m.conversation_id`, [user.id]);
  const byConversation = Object.fromEntries(convRows.map(r => [r.id, r.n]));
  const messages = convRows.reduce((sum, r) => sum + r.n, 0);
  let assignments = 0, grades = 0, submissions = 0;
  if (user.role === 'student') {
    assignments = (await q(`select count(*)::int as n from assignments a
      where a.class_id = (select e.class_id from enrollments e where e.student_id = $1) and a.created_at > $2`,
      [user.id, await seenAt('assignments')])).rows[0].n;
    grades = (await q(`select count(*)::int as n from submissions x where x.student_id = $1 and x.graded_at > $2`,
      [user.id, await seenAt('grades')])).rows[0].n;
  }
  if (user.role === 'teacher') {
    submissions = (await q(`select count(*)::int as n from submissions x join assignments a on a.id = x.assignment_id
      where x.submitted_at > $2 and exists (select 1 from teaching t where t.teacher_id = $1
        and t.class_id = a.class_id and t.subject_id = a.subject_id)`, [user.id, await seenAt('submissions')])).rows[0].n;
  }
  return { messages, byConversation, assignments, grades, submissions };
}

on('GET', '/api/notifications', async ({ user }) => ok(await notificationsFor(user)));

on('POST', '/api/notifications/seen', async ({ body, user }) => {
  const allowed = { student: ['assignments', 'grades'], teacher: ['submissions'] }[user.role] || [];
  if (!allowed.includes(body.scope)) fail(400, 'Geçersiz bildirim türü.');
  await q(`insert into seen_marks (user_id, scope, seen_at) values ($1, $2, now())
    on conflict (user_id, scope) do update set seen_at = now()`, [user.id, body.scope]);
  return ok({ seen: true });
});

on('POST', '/api/conversations/:id/read', async ({ params, user }) => {
  const c = await conversationFor(user, params.id);
  await q(`insert into conversation_reads (user_id, conversation_id, last_read_id)
    values ($1, $2, (select coalesce(max(id), 0) from messages where conversation_id = $2))
    on conflict (user_id, conversation_id) do update set last_read_id = excluded.last_read_id`, [user.id, c.id]);
  return ok({ read: true });
});

// ---------- Denetim kaydı (yalnızca müdür) ----------
on('GET', '/api/audit', async ({ query }) => {
  const { page, size, offset } = pageOf(query, 30);
  const params = [];
  let where = 'true';
  const action = query.get('action');
  if (action) { params.push(str(action, 60)); where = `action = $${params.length}`; }
  const { rows: [{ n }] } = await q(`select count(*)::int as n from audit_log where ${where}`, params);
  params.push(size, offset);
  const { rows } = await q(`select id, actor_name as "actorName", actor_role as "actorRole", action, target, details,
      created_at as "createdAt"
    from audit_log where ${where} order by id desc limit $${params.length - 1} offset $${params.length}`, params);
  return ok({ entries: rows, total: n, page, size });
}, { roles: PRINCIPAL });


// ---------- CSV dışa aktarma ----------
// Excel'in Türkçe açabilmesi için noktalı virgül ayırıcı ve BOM kullanılır.
// Formül enjeksiyonunu önlemek için = + - @ ile başlayan hücreler metin olarak işaretlenir.
const csvCell = value => {
  const text = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};
const trDateTime = value => value ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '';
const EXPORT_LIMIT = 20000;
function csvOut(filename, headers, rows) {
  const lines = [headers.map(csvCell).join(';'), ...rows.map(row => row.map(csvCell).join(';'))];
  return { csv: { body: '\uFEFF' + lines.join('\r\n') + '\r\n', filename } };
}
const slug = value => String(value || 'genel').normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(0, 60) || 'genel';

on('GET', '/api/export/:dataset', async ({ params, query, user }) => {
  const dataset = params.dataset;
  const stamp = todayIso();

  if (dataset === 'attendance') {
    const classId = requireId(query.get('classId'), 'sınıf');
    const subjectId = query.get('subjectId') ? requireId(query.get('subjectId'), 'ders') : null;
    if (user.role === 'teacher') {
      if (!subjectId) fail(400, 'Öğretmen için ders seçmek zorunlu.');
      if (!(await canTeach(user, classId, subjectId))) fail(403, 'Bu sınıf ve ders için dışa aktarma yetkin yok.');
    } else if (user.role !== 'principal') {
      fail(403, 'Bu veriyi dışa aktarma yetkin yok.');
    }
    const params2 = [classId];
    let subjectSql = '';
    if (subjectId) { params2.push(subjectId); subjectSql = ` and a.subject_id = $${params2.length}`; }
    params2.push(EXPORT_LIMIT);
    const { rows } = await q(`select a.lesson_date as date, u.student_no as "studentNo", u.name, c.name as "className",
        s.name as "subjectName", a.present
      from attendance a join users u on u.id = a.student_id join classes c on c.id = a.class_id join subjects s on s.id = a.subject_id
      where a.class_id = $1${subjectSql} order by a.lesson_date, s.name, u.name limit $${params2.length}`, params2);
    const label = rows[0]?.className || 'sinif';
    return csvOut(`yoklama-${slug(label)}-${subjectId ? 'ders' : 'tum-dersler'}-${stamp}.csv`,
      ['Tarih', 'Okul no', 'Ad soyad', 'Sınıf', 'Ders', 'Durum'],
      rows.map(r => [r.date, r.studentNo, r.name, r.className, r.subjectName, r.present ? 'Geldi' : 'Gelmedi']));
  }

  if (dataset === 'grades') {
    const assignmentId = requireId(query.get('assignmentId'), 'ödev');
    const { rows: [a] } = await q('select title, class_id, subject_id from assignments where id = $1', [assignmentId]);
    if (!a) fail(404, 'Ödev bulunamadı.');
    if (user.role === 'teacher') {
      if (!(await canTeach(user, a.class_id, a.subject_id))) fail(403, 'Bu ödevin notlarını dışa aktarma yetkin yok.');
    } else if (user.role !== 'principal') {
      fail(403, 'Bu veriyi dışa aktarma yetkin yok.');
    }
    const { rows } = await q(`select u.name, u.student_no as "studentNo", x.submitted_at as "submittedAt", x.file_name as "fileName",
        x.grade, x.feedback
      from enrollments e join users u on u.id = e.student_id
      left join submissions x on x.student_id = e.student_id and x.assignment_id = $1
      where e.class_id = $2 order by u.name limit $3`, [assignmentId, a.class_id, EXPORT_LIMIT]);
    return csvOut(`notlar-${slug(a.title)}-${stamp}.csv`,
      ['Okul no', 'Ad soyad', 'Durum', 'Teslim tarihi', 'Dosya', 'Not', 'Geri bildirim'],
      rows.map(r => [r.studentNo, r.name, r.submittedAt ? 'Teslim edildi' : 'Teslim yok', trDateTime(r.submittedAt), r.fileName, r.grade, r.feedback]));
  }

  if (dataset === 'users') {
    if (user.role !== 'principal') fail(403, 'Kullanıcı listesini yalnızca müdür dışa aktarabilir.');
    const { rows } = await q(`select u.name, u.role, u.username, u.student_no as "studentNo",
        (select c.name from enrollments e join classes c on c.id = e.class_id where e.student_id = u.id) as "className",
        (select string_agg(c.name || ' · ' || s.name, ', ' order by c.name, s.name) from teaching t
          join classes c on c.id = t.class_id join subjects s on s.id = t.subject_id where t.teacher_id = u.id) as teaching,
        u.created_at as "createdAt"
      from users u order by case u.role when 'principal' then 0 when 'teacher' then 1 else 2 end, u.name limit $1`, [EXPORT_LIMIT]);
    const roleName = { principal: 'Müdür', teacher: 'Öğretmen', student: 'Öğrenci' };
    return csvOut(`kullanicilar-${stamp}.csv`,
      ['Ad soyad', 'Rol', 'Kullanıcı adı', 'Okul no', 'Sınıf', 'Ders atamaları', 'Hesap açılış'],
      rows.map(r => [r.name, roleName[r.role], r.username, r.studentNo, r.className, r.teaching, trDateTime(r.createdAt)]));
  }

  if (dataset === 'audit') {
    if (user.role !== 'principal') fail(403, 'Denetim kaydını yalnızca müdür dışa aktarabilir.');
    const { rows } = await q(`select created_at as "createdAt", actor_name as "actorName", actor_role as "actorRole",
        action, target, details from audit_log order by id desc limit $1`, [EXPORT_LIMIT]);
    return csvOut(`denetim-${stamp}.csv`, ['Zaman', 'Kişi', 'Rol', 'İşlem', 'Hedef', 'Ayrıntı'],
      rows.map(r => [trDateTime(r.createdAt), r.actorName, r.actorRole, r.action, r.target, JSON.stringify(r.details)]));
  }

  fail(404, 'Bu veri türü dışa aktarılamaz.');
});

// Tüm cihazlardan çıkış: oturum sürümü artar, bütün çerezler geçersiz olur.
on('POST', '/api/me/sessions/revoke', async ({ res, user }) => {
  await q('update users set session_version = session_version + 1 where id = $1', [user.id]);
  await audit(user, 'sessions_revoked', user.name);
  sec.clearSessionCookie(res);
  return ok({ revoked: true });
});

// Hesabım: kendi adını değiştirme
on('PATCH', '/api/me', async ({ body, user }) => {
  const name = str(body.name, 80);
  if (name.length < 2) fail(400, 'Ad soyad en az 2 karakter olmalı.');
  await q('update users set name = $2 where id = $1', [user.id, name]);
  await audit(user, 'profile_updated', name);
  return ok({ name });
});

// ---------- Panolar (sınıf ve okul panoları) ----------
const NOTE_COLORS = ['sun', 'mint', 'coral', 'sky', 'lilac'];

// Kullanıcının sınıf üyelikleri: öğrenci olarak kayıtlı sınıflar ve öğretmen olarak verdiği sınıflar.
async function membership(user) {
  const { rows: member } = await q(`select class_id from teaching where teacher_id = $1
    union select class_id from enrollments where student_id = $1`, [user.id]);
  const { rows: taught } = await q('select class_id from teaching where teacher_id = $1', [user.id]);
  return { member: new Set(member.map(r => r.class_id)), taught: new Set(taught.map(r => r.class_id)) };
}

// Yetki kuralları: müdür her panoyu yönetir. Okul panosunu yalnızca müdür yazar, herkes okur.
// Sınıf panosunu o sınıfın öğretmenleri ve öğrencileri görür ve not ekler; yönetim öğretmene aittir.
function rightsFor(user, board, mine) {
  if (user.role === 'principal') return { view: true, post: true, moderate: true };
  if (board.scope === 'school') return { view: true, post: false, moderate: false };
  const inClass = mine.member.has(board.classId);
  return { view: inClass, post: inClass, moderate: mine.taught.has(board.classId) };
}

// Öğrenci, atama modunda yalnızca öğretmenin atadığı panoda not ekleyebilir.
async function studentCanPost(user, board, rights) {
  if (user.role !== 'student' || !rights.post || !board.assignedOnly) return rights;
  const { rowCount } = await q('select 1 from board_members where board_id = $1 and student_id = $2', [board.id, user.id]);
  return { ...rights, post: rowCount > 0 };
}

async function loadBoard(id) {
  const { rows: [b] } = await q(`select b.id, b.title, b.description, b.scope, b.class_id as "classId",
      c.name as "className", u.name as "createdBy", b.created_by as "createdById", b.created_at as "createdAt",
      b.assigned_only as "assignedOnly", b.moderated
    from boards b left join classes c on c.id = b.class_id left join users u on u.id = b.created_by where b.id = $1`, [id]);
  if (!b) fail(404, 'Pano bulunamadı.');
  return b;
}

function parseLink(value) {
  const text = str(value, 500);
  if (!text) return null;
  let url;
  try { url = new URL(text); } catch { fail(400, 'Bağlantı geçerli bir adres olmalı.'); }
  if (!['http:', 'https:'].includes(url.protocol)) fail(400, 'Bağlantı http veya https ile başlamalı.');
  return url.toString();
}

on('GET', '/api/boards', async ({ user, query }) => {
  const mine = await membership(user);
  const conditions = [];
  const params = [user.id];
  if (user.role === 'principal') {
    conditions.push('$1::uuid is not null'); // müdür her panoyu görür; $1 yine de kullanılmalı
  } else {
    conditions.push(`(b.scope = 'school' or b.class_id in (select class_id from teaching where teacher_id = $1
      union select class_id from enrollments where student_id = $1))`);
  }
  const scope = query.get('scope');
  if (scope === 'school' || scope === 'class') { params.push(scope); conditions.push(`b.scope = $${params.length}`); }
  const term = str(query.get('q'), 80).toLocaleLowerCase('tr-TR');
  if (term) { params.push(`%${escapeLike(term)}%`); conditions.push(`lower(b.title) like $${params.length}`); }
  const where = conditions.length ? conditions.join(' and ') : 'true';
  const { rows } = await q(`select b.id, b.title, b.description, b.scope, b.class_id as "classId", c.name as "className",
      u.name as "createdBy", b.created_at as "createdAt", b.assigned_only as "assignedOnly", b.moderated,
      (select count(*)::int from board_notes n where n.board_id = b.id) as "noteCount",
      (select max(n.created_at) from board_notes n where n.board_id = b.id) as "lastNoteAt"
    from boards b left join classes c on c.id = b.class_id left join users u on u.id = b.created_by
    where ${where} order by case b.scope when 'school' then 0 else 1 end, b.created_at desc limit 200`, params);
  const boards = rows
    .map(b => ({ ...b, rights: rightsFor(user, { scope: b.scope, classId: b.classId }, mine) }))
    .filter(b => b.rights.view);
  return ok({ boards });
});

on('POST', '/api/boards', async ({ body, user }) => {
  const title = str(body.title, 120);
  if (title.length < 2) fail(400, 'Pano başlığı en az 2 karakter olmalı.');
  const description = str(body.description, 500);
  let classId = null;
  if (body.scope === 'school') {
    if (user.role !== 'principal') fail(403, 'Okul panosunu yalnızca müdür açabilir.');
  } else if (body.scope === 'class') {
    classId = requireId(body.classId, 'sınıf');
    if (user.role !== 'principal' && !(await teachesClass(user, classId))) {
      fail(403, 'Yalnızca verdiğiniz sınıflar için pano açabilirsiniz.');
    }
  } else {
    fail(400, 'Pano türü sınıf veya okul olmalı.');
  }
  const assignedOnly = body.scope === 'class' && body.assignedOnly === true;
  const moderated = body.scope === 'class' && body.moderated === true;
  const { rows: [row] } = await q(`insert into boards (title, description, scope, class_id, created_by, assigned_only, moderated)
    values ($1, $2, $3, $4, $5, $6, $7) returning id`, [title, description, body.scope, classId, user.id, assignedOnly, moderated]);
  await audit(user, 'board_created', title, { scope: body.scope, assignedOnly, moderated });
  return created({ id: row.id });
}, { roles: STAFF });

on('PATCH', '/api/boards/:id', async ({ params, body, user }) => {
  const id = requireId(params.id, 'pano');
  const board = await loadBoard(id);
  if (!rightsFor(user, { scope: board.scope, classId: board.classId }, await membership(user)).moderate) {
    fail(403, 'Bu panoyu düzenleme yetkin yok.');
  }
  const title = body.title !== undefined ? str(body.title, 120) : board.title;
  if (title.length < 2) fail(400, 'Pano başlığı en az 2 karakter olmalı.');
  const description = body.description !== undefined ? str(body.description, 500) : board.description;
  const assignedOnly = board.scope === 'class' && (body.assignedOnly !== undefined ? body.assignedOnly === true : board.assignedOnly);
  const moderated = board.scope === 'class' && (body.moderated !== undefined ? body.moderated === true : board.moderated);
  await q('update boards set title = $2, description = $3, assigned_only = $4, moderated = $5 where id = $1', [id, title, description, assignedOnly, moderated]);
  await audit(user, 'board_updated', title, { assignedOnly, moderated });
  return ok({ updated: true });
});

on('DELETE', '/api/boards/:id', async ({ params, user }) => {
  const id = requireId(params.id, 'pano');
  const board = await loadBoard(id);
  if (!rightsFor(user, { scope: board.scope, classId: board.classId }, await membership(user)).moderate) {
    fail(403, 'Bu panoyu silme yetkin yok.');
  }
  const { rows: files } = await q('select file_path as p from board_notes where board_id = $1 and file_path is not null', [id]);
  await q('delete from boards where id = $1', [id]);
  await Promise.all(files.map(f => storage.remove(f.p)));
  await audit(user, 'board_deleted', board.title, { scope: board.scope, notes: files.length });
  return ok({ deleted: true });
});

on('GET', '/api/boards/:id/notes', async ({ params, user }) => {
  const id = requireId(params.id, 'pano');
  const board = await loadBoard(id);
  const base = rightsFor(user, { scope: board.scope, classId: board.classId }, await membership(user));
  if (!base.view) fail(403, 'Bu panoyu görme yetkin yok.');
  const rights = await studentCanPost(user, board, base);
  // Onay bekleyen notları yalnızca yöneticiler ve yazarın kendisi görür.
  const { rows } = await q(`select n.id, n.title, n.body, n.link, n.color, n.file_name as "fileName", n.file_mime as "fileMime",
      (n.file_path is not null) as "hasFile", n.approved, n.created_at as "createdAt", n.author_id as "authorId",
      u.name as "authorName", u.role as "authorRole"
    from board_notes n left join users u on u.id = n.author_id
    where n.board_id = $1 and (${rights.moderate ? 'true' : 'n.approved or n.author_id = $2'})
    order by n.created_at desc limit 300`, rights.moderate ? [id] : [id, user.id]);
  const pendingCount = rights.moderate ? rows.filter(n => !n.approved).length : 0;
  const notes = rows.map(n => ({ ...n, canDelete: rights.moderate || n.authorId === user.id, canApprove: rights.moderate && !n.approved }));
  return ok({ board: { ...board, rights: { ...rights, pendingCount } }, notes });
});

// Atanabilir öğrenciler ve mevcut atamalar (yalnızca sınıf panosu yöneticisi)
on('GET', '/api/boards/:id/members', async ({ params, user }) => {
  const id = requireId(params.id, 'pano');
  const board = await loadBoard(id);
  if (!rightsFor(user, { scope: board.scope, classId: board.classId }, await membership(user)).moderate) fail(403, 'Bu panonun atamalarını görme yetkin yok.');
  if (board.scope !== 'class') fail(400, 'Okul panosunda öğrenci ataması yapılmaz.');
  const { rows } = await q(`select u.id, u.name, u.student_no as "studentNo", (bm.student_id is not null) as assigned
    from enrollments e join users u on u.id = e.student_id
    left join board_members bm on bm.board_id = $1 and bm.student_id = u.id
    where e.class_id = $2 order by u.name`, [id, board.classId]);
  return ok({ students: rows });
}, { roles: STAFF });

on('PUT', '/api/boards/:id/members', async ({ params, body, user }) => {
  const id = requireId(params.id, 'pano');
  const board = await loadBoard(id);
  if (!rightsFor(user, { scope: board.scope, classId: board.classId }, await membership(user)).moderate) fail(403, 'Bu panonun atamalarını değiştirme yetkin yok.');
  if (board.scope !== 'class') fail(400, 'Okul panosunda öğrenci ataması yapılmaz.');
  const ids = Array.isArray(body.studentIds) ? body.studentIds.map(v => requireId(v, 'öğrenci')) : fail(400, 'Öğrenci listesi geçersiz.');
  if (ids.length > 300) fail(400, 'Tek seferde en fazla 300 öğrenci atanabilir.');
  const { rows: enrolled } = await q('select student_id from enrollments where class_id = $1', [board.classId]);
  const allowed = new Set(enrolled.map(r => r.student_id));
  if (ids.some(v => !allowed.has(v))) fail(400, 'Listede bu sınıfa ait olmayan bir öğrenci var.');
  await tx(async client => {
    await client.query('delete from board_members where board_id = $1 and not (student_id = any($2::uuid[]))', [id, ids]);
    for (const studentId of ids) {
      await client.query('insert into board_members (board_id, student_id) values ($1, $2) on conflict do nothing', [id, studentId]);
    }
  });
  await audit(user, 'board_members_saved', board.title, { count: ids.length });
  return ok({ saved: ids.length });
}, { roles: STAFF });

// Onay: yalnızca pano yöneticisi bekleyen notu onaylar veya geri çeker
on('PATCH', '/api/board-notes/:id', async ({ params, body, user }) => {
  const id = requireId(params.id, 'not');
  const { rows: [n] } = await q('select board_id from board_notes where id = $1', [id]);
  if (!n) fail(404, 'Not bulunamadı.');
  const board = await loadBoard(n.board_id);
  if (!rightsFor(user, { scope: board.scope, classId: board.classId }, await membership(user)).moderate) fail(403, 'Bu notu onaylama yetkin yok.');
  if (typeof body.approved !== 'boolean') fail(400, 'Onay durumu geçersiz.');
  await q('update board_notes set approved = $2 where id = $1', [id, body.approved]);
  return ok({ approved: body.approved });
});

on('POST', '/api/boards/:id/notes', async ({ params, body, user }) => {
  const id = requireId(params.id, 'pano');
  const board = await loadBoard(id);
  const rights = await studentCanPost(user, board, rightsFor(user, { scope: board.scope, classId: board.classId }, await membership(user)));
  if (!rights.post) {
    fail(403, board.assignedOnly ? 'Bu panoya yalnızca öğretmeninin atadığı öğrenciler not ekleyebilir.' : 'Bu panoya not ekleme yetkin yok.');
  }
  const approved = !(user.role === 'student' && board.moderated);
  const title = str(body.title, 120);
  const text = String(body.body ?? '').trim();
  if (text.length > 2000) fail(400, 'Not metni en fazla 2000 karakter olabilir.');
  const link = parseLink(body.link);
  const color = NOTE_COLORS.includes(body.color) ? body.color : 'sun';
  const upload = body.file ? storage.parseUpload(body.file) : null;
  if (!title && !text && !link && !upload) fail(400, 'Not boş olamaz: başlık, metin, bağlantı veya dosya ekleyin.');
  let filePath = null;
  if (upload) {
    filePath = storage.newPath('boards', upload.ext, upload.name);
    await storage.put(filePath, upload.buffer, upload.mime);
  }
  try {
    const { rows: [row] } = await q(`insert into board_notes (board_id, author_id, title, body, link, color, file_path, file_name, file_mime, file_size, approved)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
      [id, user.id, title, text, link, color, filePath, upload?.name ?? null, upload?.mime ?? null, upload?.buffer.length ?? null, approved]);
    return created({ id: row.id, approved });
  } catch (error) {
    if (filePath) await storage.remove(filePath);
    throw error;
  }
});

on('DELETE', '/api/board-notes/:id', async ({ params, user }) => {
  const id = requireId(params.id, 'not');
  const { rows: [n] } = await q('select id, board_id, author_id, file_path, title from board_notes where id = $1', [id]);
  if (!n) fail(404, 'Not bulunamadı.');
  const board = await loadBoard(n.board_id);
  const rights = rightsFor(user, { scope: board.scope, classId: board.classId }, await membership(user));
  const own = n.author_id === user.id;
  if (!(own || rights.moderate)) fail(403, 'Bu notu silme yetkin yok.');
  await q('delete from board_notes where id = $1', [id]);
  if (n.file_path) await storage.remove(n.file_path);
  if (!own) await audit(user, 'board_note_deleted', `${board.title}: ${n.title || 'başlıksız not'}`);
  return ok({ deleted: true });
});

on('GET', '/api/files/board-note/:id', async ({ params, query, user }) => {
  const id = requireId(params.id, 'not');
  const { rows: [n] } = await q('select board_id, file_path, file_name, file_mime, approved, author_id from board_notes where id = $1', [id]);
  if (!n || !n.file_path) fail(404, 'Dosya bulunamadı.');
  const board = await loadBoard(n.board_id);
  const rights = rightsFor(user, { scope: board.scope, classId: board.classId }, await membership(user));
  if (!rights.view) fail(403, 'Bu dosyaya erişimin yok.');
  if (!rights.moderate && !n.approved && n.author_id !== user.id) fail(403, 'Bu not henüz onaylanmadı.');
  const result = await fileOf(n.file_path, n.file_mime, n.file_name);
  // Yalnızca resimler sayfa içinde gösterilir; diğer dosyalar her zaman indirme olarak sunulur.
  result.file.inline = query.get('inline') === '1' && ['image/png', 'image/jpeg'].includes(n.file_mime);
  return result;
});

// Ana sayfadaki okul duyuruları: yalnızca okul panolarındaki notlar, giriş gerektirmez.
on('GET', '/api/public/announcements', async () => {
  const { rows } = await q(`select n.title, n.body, n.link, n.color, n.created_at as "createdAt",
      b.title as "boardTitle", (n.file_path is not null) as "hasFile"
    from board_notes n join boards b on b.id = n.board_id
    where b.scope = 'school' order by n.created_at desc limit 6`);
  return ok({ announcements: rows });
}, { auth: false });

// ---------- Hata eşleme ----------
function toHttpError(error) {
  if (error instanceof HttpError) return error;
  if (error instanceof storage.UploadError) return new HttpError(400, error.message);
  if (error.code === 'ENOENT') return new HttpError(404, 'Dosya bulunamadı.');
  switch (error.code) {
    case '23505': return new HttpError(409, 'Bu kayıt zaten var.');
    case '23503': return new HttpError(400, 'Bağlı kayıt bulunamadı.');
    case '23514': return new HttpError(400, 'Girilen değer kurallara uymuyor.');
    case '22P02': return new HttpError(400, 'Geçersiz biçim.');
    default: return null;
  }
}

module.exports = { handleApi, toHttpError, HttpError };
