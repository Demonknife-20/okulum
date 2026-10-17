const crypto = require('node:crypto');
const { q, tx } = require('./db');
const sec = require('./security');
const storage = require('./storage');
const ai = require('./ai');
const push = require('./push');
const { runBackup, listBackups, readBackup } = require('./backup');
const mail = require('./mail');
const mfa = require('./mfa');
const { KVKK_VERSION, KVKK_NOTICE } = require('./kvkk');
const PDFDocument = require('pdfkit');
const FONT_REGULAR = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
const FONT_BOLD = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');

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
const passwordProblem = value => {
  const text = typeof value === 'string' ? value : '';
  if (text.length < 8 || text.length > 128) return 'Şifre 8-128 karakter olmalı.';
  if (!/[A-Za-z]/.test(text) || !/\d/.test(text)) return 'Şifre en az bir harf ve bir rakam içermeli.';
  if (COMMON_PASSWORDS.has(text.toLowerCase())) return 'Bu şifre çok yaygın. Daha zor bir şifre seçin.';
  return null;
};
const checkPassword = value => {
  const problem = passwordProblem(value);
  if (problem) fail(400, problem);
  return value;
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
  if (a.role === 'parent' || b.role === 'parent') {
    const parent = a.role === 'parent' ? a : b;
    const other = parent === a ? b : a;
    if (other.role !== 'teacher') return false;
    const { rowCount } = await q(`select 1 from parent_links pl join enrollments e on e.student_id = pl.student_id
      join teaching t on t.class_id = e.class_id where pl.parent_id = $1 and t.teacher_id = $2 limit 1`, [parent.id, other.id]);
    return rowCount > 0;
  }
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
      select e.student_id from enrollments e where e.class_id in (select t.class_id from teaching t where t.teacher_id = $1)))
      or (u.role = 'parent' and u.id in (
      select pl.parent_id from parent_links pl join enrollments e on e.student_id = pl.student_id
      where e.class_id in (select t.class_id from teaching t where t.teacher_id = $1))))`,
    params: [user.id],
  };
  if (user.role === 'parent') return {
    where: `(u.role = 'principal' or (u.role = 'teacher' and u.id in (
      select t.teacher_id from teaching t join enrollments e on e.class_id = t.class_id
      join parent_links pl on pl.student_id = e.student_id where pl.parent_id = $1)))`,
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
  const { rows: [user] } = await q('select id, username, name, role, student_no, password_hash, session_version, totp_enabled, totp_secret from users where username = $1', [username]);
  let valid = false;
  if (user) valid = await sec.verifyPasswordAsync(pass, user.password_hash);
  else await sec.burnTimeAsync(pass);
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
  if (user.role === 'principal' && user.totp_enabled) {
    if (!body.totp) return ok({ mfaRequired: true });
    if (!mfa.verifyTotp(mfa.openSecret(user.totp_secret), body.totp)) {
      sec.recordFailure(ipKey);
      sec.recordFailure(userKey);
      fail(401, 'Doğrulama kodu hatalı.');
    }
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
  const { rows: [login] } = await q('select last_login_at as "lastLoginAt", last_login_ip as "lastLoginIp", totp_enabled as "totpEnabled" from users where id = $1', [user.id]);
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
  return ok({ user: { ...publicUser(user), classId, className, lastLoginAt: login?.lastLoginAt ?? null, lastLoginIp: login?.lastLoginIp ?? null, totpEnabled: login?.totpEnabled === true }, school, teaching, classes, subjects });
});

on('PUT', '/api/me/password', async ({ res, body, user }) => {
  const { rows: [row] } = await q('select password_hash, session_version from users where id = $1', [user.id]);
  if (!(await sec.verifyPasswordAsync(typeof body.current === 'string' ? body.current : '', row.password_hash))) fail(401, 'Mevcut şifre hatalı.');
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
// E-posta: küçük harfe çevrilir, biçimi denetlenir; boş bırakılırsa adres kaldırılır.
const emailOf = value => {
  const email = str(value, 120).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail(400, 'E-posta adresi geçersiz.');
  return email || null;
};
async function assertEmailFree(email, exceptId = null) {
  if (!email) return;
  const { rowCount } = await q('select 1 from users where lower(email) = $1 and ($2::uuid is null or id <> $2)', [email, exceptId]);
  if (rowCount) fail(409, 'Bu e-posta adresi başka bir hesapta kayıtlı.');
}

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
  const { rows } = await q(`select u.id, u.name, u.role, u.username, u.email, u.student_no as "studentNo",
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
  const list = rows.map(row => user.role === 'principal' ? row : { ...row, username: undefined, teaching: undefined, email: undefined });
  return ok({ users: list, total: n, page, size });
});

on('POST', '/api/users', async ({ body, user }) => {
  const role = body.role;
  if (!['teacher', 'student', 'principal', 'parent'].includes(role)) fail(400, 'Rol müdür, öğretmen, öğrenci veya veli olmalı.');
  const name = str(body.name, 80);
  if (name.length < 2) fail(400, 'Ad soyad en az 2 karakter olmalı.');
  const username = str(body.username, 32).toLowerCase();
  if (!USERNAME.test(username)) fail(400, 'Kullanıcı adı 3-32 karakter: harf, rakam, nokta, tire veya alt çizgi.');
  const pass = checkPassword(body.password);
  const email = emailOf(body.email);
  await assertEmailFree(email);
  const studentNo = role === 'student' ? str(body.studentNo, 20) : null;
  if (role === 'student' && !studentNo) fail(400, 'Öğrenci için okul numarası zorunlu.');
  const classId = role === 'student' && body.classId ? requireId(body.classId, 'sınıf') : null;
  const teaching = role === 'teacher' ? pairs(body.teaching) : [];
  const childIds = role === 'parent' ? await studentIdsOf(body.childIds, false) : [];
  const result = await tx(async client => {
    const { rows: [u] } = await client.query(`insert into users (username, password_hash, name, role, student_no, email)
      values ($1, $2, $3, $4, $5, $6) returning id, username, name, role, student_no`, [username, sec.hashPassword(pass), name, role, studentNo, email]);
    if (classId) await client.query('insert into enrollments (student_id, class_id) values ($1, $2)', [u.id, classId]);
    for (const p of teaching) await client.query('insert into teaching (teacher_id, class_id, subject_id) values ($1, $2, $3)', [u.id, p.classId, p.subjectId]);
    for (const childId of childIds) await client.query('insert into parent_links (parent_id, student_id) values ($1, $2)', [u.id, childId]);
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
  const emailValue = body.email !== undefined ? emailOf(body.email) : undefined;
  await assertEmailFree(emailValue, id);
  await tx(async client => {
    await client.query('update users set name = $2, student_no = $3 where id = $1', [id, name, studentNo]);
    if (emailValue !== undefined) await client.query('update users set email = $2 where id = $1', [id, emailValue]);
    if (target.role === 'student' && body.classId !== undefined) {
      await client.query('delete from enrollments where student_id = $1', [id]);
      if (body.classId) await client.query('insert into enrollments (student_id, class_id) values ($1, $2)', [id, requireId(body.classId, 'sınıf')]);
    }
    if (target.role === 'parent' && body.childIds !== undefined) {
      const childIds = await studentIdsOf(body.childIds, true);
      await client.query('delete from parent_links where parent_id = $1', [id]);
      for (const childId of childIds) await client.query('insert into parent_links (parent_id, student_id) values ($1, $2)', [id, childId]);
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
    const { rows: classStudents } = await q('select student_id from enrollments where class_id = $1', [classId]);
    push.notify(classStudents.map(s => s.student_id), { title: 'Yeni ödev', body: dueAt ? `${title} · son teslim ${new Date(dueAt).toLocaleDateString('tr-TR')}` : title, url: '/#/assignments', tag: `odev-${row.id}` }).catch(() => {});
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
  const records = (await q(`select student_id, present, excused from attendance
    where class_id = $1 and subject_id = $2 and lesson_date = $3`, [classId, subjectId, date])).rows;
  const totals = (await q(`select student_id, count(*)::int as total, count(*) filter (where present)::int as present
    from attendance where class_id = $1 and subject_id = $2 group by student_id`, [classId, subjectId])).rows;
  const statusOf = new Map(records.map(r => [r.student_id, r.excused ? 'excused' : r.present ? 'present' : 'absent']));
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
    if (![null, 'present', 'absent', 'excused'].includes(value)) fail(400, 'Geçersiz yoklama değeri.');
  }
  await tx(async client => {
    for (const [studentId, value] of entries) {
      if (value === null) {
        await client.query('delete from attendance where class_id = $1 and subject_id = $2 and lesson_date = $3 and student_id = $4',
          [classId, subjectId, date, studentId]);
      } else {
        await client.query(`insert into attendance (class_id, subject_id, lesson_date, student_id, present, excused, recorded_by)
          values ($1, $2, $3, $4, $5, $6, $7)
          on conflict (class_id, subject_id, lesson_date, student_id)
          do update set present = excluded.present, excused = excluded.excused, recorded_by = excluded.recorded_by`,
          [classId, subjectId, date, studentId, value === 'present' || value === 'excused', value === 'excused', user.id]);
      }
    }
  });
  const { rows: [names] } = await q('select (select name from classes where id = $1) as c, (select name from subjects where id = $2) as s', [classId, subjectId]);
  await audit(user, 'attendance_saved', `${names.c} · ${names.s}`, { date, count: entries.length });
  const absentIds = entries.filter(([, value]) => value === 'absent').map(([studentId]) => studentId);
  if (absentIds.length) {
    const { rows: guardians } = await q(`select pl.parent_id, pl.student_id, u.name as student from parent_links pl
      join users u on u.id = pl.student_id where pl.student_id = any($1::uuid[])`, [absentIds]);
    for (const guardian of guardians) {
      push.notify([guardian.parent_id], { title: 'Devamsızlık bildirimi', body: `${guardian.student} · ${names.s} dersine katılmadı (${date})`, url: '/#/cocuklar', tag: `devamsiz-${guardian.student_id}-${date}-${subjectId}` }).catch(() => {});
    }
  }
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
  const { rows: recipients } = await q('select user_id from conversation_members where conversation_id = $1 and user_id <> $2', [c.id, user.id]);
  push.notify(recipients.map(r => r.user_id), { title: `Yeni mesaj · ${user.name}`, body: raw.slice(0, 120), url: '/#/messages', tag: `mesaj-${c.id}` }).catch(() => {});
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

// ---------- Okulum Asistanı (Gemini) ----------
on('GET', '/api/ai/status', async ({ user }) => {
  const { rows: [consent] } = await q('select 1 from ai_consents where user_id = $1 and version = $2', [user.id, ai.NOTICE_VERSION]);
  const { rows: [usage] } = await q('select used from ai_usage where user_id = $1 and day = current_date', [user.id]);
  const used = usage?.used ?? 0;
  return ok({
    enabled: ai.enabled(), notice: ai.NOTICE, accepted: Boolean(consent),
    limit: ai.DAILY_LIMIT, usedToday: used, remaining: Math.max(0, ai.DAILY_LIMIT - used),
  });
});

on('POST', '/api/ai/consent', async ({ body, user }) => {
  if (body.version !== ai.NOTICE_VERSION) fail(400, 'Bildirim sürümü güncel değil. Sayfayı yenileyip tekrar okuyun.');
  await q('insert into ai_consents (user_id, version) values ($1, $2) on conflict do nothing', [user.id, body.version]);
  return ok({ accepted: true });
});

// Sohbet isteğini doğrular, kotayı kontrol eder ve konuşmayı çözümler. Yapay zekâya henüz gitmez.
async function aiPrepare(user, body) {
  if (!ai.enabled()) fail(503, 'Asistan henüz etkin değil. Okul yöneticinizle konuşun.');
  const { rowCount: accepted } = await q('select 1 from ai_consents where user_id = $1 and version = $2', [user.id, ai.NOTICE_VERSION]);
  if (!accepted) fail(403, 'Asistanı kullanmadan önce kullanım bildirimini kabul etmelisiniz.');
  const text = String(body.message ?? '').trim();
  if (!text) fail(400, 'Mesaj boş olamaz.');
  if (text.length > 2000) fail(400, 'Mesaj en fazla 2000 karakter olabilir.');
  const { rows: [usage] } = await q('select used from ai_usage where user_id = $1 and day = current_date', [user.id]);
  if ((usage?.used ?? 0) >= ai.DAILY_LIMIT) fail(429, `Bugünkü ${ai.DAILY_LIMIT} soru hakkınızı kullandınız. Yarın tekrar deneyin.`);
  const { rows: [all] } = await q('select coalesce(sum(used), 0)::int as n from ai_usage where day = current_date');
  if (all.n >= ai.GLOBAL_DAILY) fail(429, 'Asistan bugün çok yoğun. Lütfen yarın tekrar deneyin.');
  const conversationId = body.conversationId ? requireId(body.conversationId, 'sohbet') : null;
  let history = [];
  if (conversationId) {
    const { rowCount } = await q('select 1 from ai_conversations where id = $1 and user_id = $2', [conversationId, user.id]);
    if (!rowCount) fail(404, 'Sohbet bulunamadı.');
    history = (await q('select role, content from ai_messages where conversation_id = $1 order by id desc limit 12', [conversationId])).rows.reverse();
  }
  const safe = sec.redact(text);
  return { text, safe, conversationId, history, injection: ai.isInjection(text), redacted: safe !== text };
}

// Kullanım sayacını artırır (yapay zekâya gitmeden önce; kota korunur).
async function aiSpend(userId) {
  await q(`insert into ai_usage (user_id, day, used) values ($1, current_date, 1)
    on conflict (user_id, day) do update set used = ai_usage.used + 1`, [userId]);
}

// Başarılı yanıtı kaydeder. Yeni konuşmaysa önce konuşmayı oluşturur ve kimliğini döner.
async function aiSave(user, conversationId, safe, reply) {
  let id = conversationId;
  await tx(async client => {
    if (!id) {
      const { rows: [row] } = await client.query('insert into ai_conversations (user_id, title) values ($1, $2) returning id', [user.id, safe.slice(0, 60)]);
      id = row.id;
    }
    await client.query(`insert into ai_messages (conversation_id, role, content) values ($1, 'user', $2), ($1, 'assistant', $3)`, [id, safe, reply]);
    await client.query('update ai_conversations set updated_at = now() where id = $1', [id]);
  });
  return id;
}

on('POST', '/api/ai/chat', async ({ body, user }) => {
  const p = await aiPrepare(user, body);
  let reply = ai.INJECTION_REPLY;
  if (!p.injection) {
    await aiSpend(user.id);
    try {
      reply = await ai.askGemini({ role: user.role, history: p.history, message: p.safe });
    } catch (error) {
      if (error instanceof ai.AiError) fail(error.status, error.message);
      throw error;
    }
  }
  const conversationId = await aiSave(user, p.conversationId, p.safe, reply);
  return ok({ conversationId, reply, redacted: p.redacted });
});

// Akış (SSE): yanıt parça parça gelir. Olaylar: delta (metin parçası), done (kayıt kimliği), error (hata).
// Doğrulama hataları normal JSON olarak döner; akış yalnızca yanıt başladıktan sonra açılır.
on('POST', '/api/ai/chat/stream', async ({ body, user, res }) => {
  const p = await aiPrepare(user, body);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const emit = (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); }); // istemci ayrılınca yukarı akışı da kes
  try {
    let reply = ai.INJECTION_REPLY;
    if (p.injection) {
      emit('delta', { text: reply });
    } else {
      await aiSpend(user.id);
      reply = await ai.streamGemini({ role: user.role, history: p.history, message: p.safe, signal: controller.signal, onDelta: text => emit('delta', { text }) });
    }
    const conversationId = await aiSave(user, p.conversationId, p.safe, reply);
    emit('done', { conversationId, redacted: p.redacted });
  } catch (error) {
    const isAi = error instanceof ai.AiError;
    if (!isAi) console.error('Asistan akışı hatası:', error.name);
    emit('error', {
      status: isAi ? error.status : 502,
      message: isAi ? error.message : 'Asistan şu an yanıt veremiyor. Lütfen daha sonra tekrar deneyin.',
    });
  } finally {
    res.end();
  }
  return { streamed: true };
});

on('GET', '/api/ai/conversations', async ({ user }) => {
  const { rows } = await q(`select c.id, c.title, c.updated_at as "updatedAt",
      (select count(*)::int from ai_messages m where m.conversation_id = c.id) as "messageCount"
    from ai_conversations c where c.user_id = $1 order by c.updated_at desc limit 50`, [user.id]);
  return ok({ conversations: rows });
});

on('GET', '/api/ai/conversations/:id/messages', async ({ params, user }) => {
  const id = requireId(params.id, 'sohbet');
  const { rows: [c] } = await q(`select c.id, c.title, c.user_id, u.name as "userName", u.role as "userRole"
    from ai_conversations c join users u on u.id = c.user_id where c.id = $1`, [id]);
  if (!c) fail(404, 'Sohbet bulunamadı.');
  const own = c.user_id === user.id;
  if (!own && user.role !== 'principal') fail(403, 'Bu sohbeti görme yetkin yok.');
  if (!own) await audit(user, 'ai_logs_viewed', c.title, { owner: c.userName });
  const { rows: messages } = await q('select id, role, content, created_at as "createdAt" from ai_messages where conversation_id = $1 order by id asc', [id]);
  return ok({ conversation: { id: c.id, title: c.title, userName: c.userName, userRole: c.userRole }, messages, readOnly: !own });
});

on('DELETE', '/api/ai/conversations/:id', async ({ params, user }) => {
  const id = requireId(params.id, 'sohbet');
  const { rowCount } = await q('delete from ai_conversations where id = $1 and user_id = $2', [id, user.id]);
  if (!rowCount) fail(404, 'Sohbet bulunamadı.');
  return ok({ deleted: true });
});

on('GET', '/api/ai/logs', async ({ query }) => {
  const { page, size, offset } = pageOf(query, 25);
  const { rows: [{ n }] } = await q('select count(*)::int as n from ai_conversations');
  const { rows } = await q(`select c.id, c.title, c.updated_at as "updatedAt", u.name as "userName", u.role as "userRole",
      (select count(*)::int from ai_messages m where m.conversation_id = c.id) as "messageCount"
    from ai_conversations c join users u on u.id = c.user_id order by c.updated_at desc limit $1 offset $2`, [size, offset]);
  return ok({ conversations: rows, total: n, page, size });
}, { roles: PRINCIPAL });

// ---------- Toplu kullanıcı içe aktarma (CSV) ----------
// Sütunlar: ad_soyad, rol (öğrenci/öğretmen), kullanici_adi, parola (boşsa üretilir), okul_no, sinif, ders_atamalari
// Ders atamaları: "6/A:Matematik|7/B:Türkçe"
const IMPORT_MAX_ROWS = 500;
const IMPORT_MAX_CHARS = 300000;
const normKey = value => String(value ?? '').trim().toLocaleLowerCase('tr-TR')
  .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .replace(/[\s-]+/g, '_');

function parseCsvText(text) {
  const clean = String(text ?? '').replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/)[0] || '';
  const delimiter = firstLine.includes(';') ? ';' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i += 1; } else { quoted = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(cells => cells.some(cell => cell.trim() !== ''));
}

const GENERATED_CHARS = 'abcdefghjkmnpqrstuvwxyz';
const GENERATED_DIGITS = '23456789';
function generatePassword() {
  for (;;) {
    const bytes = crypto.randomBytes(10);
    let out = '';
    for (let i = 0; i < 8; i += 1) out += GENERATED_CHARS[bytes[i] % GENERATED_CHARS.length];
    out += GENERATED_DIGITS[bytes[8] % GENERATED_DIGITS.length] + GENERATED_DIGITS[bytes[9] % GENERATED_DIGITS.length];
    if (!passwordProblem(out)) return out;
  }
}

// Dosyayı kayda dönüştürür ve her satırı doğrular. Veritabanına yazmaz.
async function planImport(text) {
  const rows = parseCsvText(text);
  if (rows.length < 2) fail(400, 'Dosyada başlık satırı ve en az bir kayıt olmalı.');
  if (rows.length - 1 > IMPORT_MAX_ROWS) fail(400, `Tek seferde en fazla ${IMPORT_MAX_ROWS} kayıt içe aktarılabilir.`);
  const header = rows[0].map(normKey);
  for (const required of ['ad_soyad', 'rol', 'kullanici_adi']) {
    if (!header.includes(required)) fail(400, `Başlık satırında "${required}" sütunu eksik.`);
  }
  const classes = new Map((await q('select id, name from classes')).rows.map(r => [normKey(r.name), r.id]));
  const subjects = new Map((await q('select id, name from subjects')).rows.map(r => [normKey(r.name), r.id]));
  const taken = await q('select username, student_no from users');
  const takenUsernames = new Set(taken.rows.map(r => r.username));
  const takenNumbers = new Set(taken.rows.map(r => r.student_no).filter(Boolean));
  const fileUsernames = new Set();
  const fileNumbers = new Set();

  return rows.slice(1).map((cells, index) => {
    const get = key => (header.includes(key) ? String(cells[header.indexOf(key)] ?? '').trim() : '');
    const item = { line: index + 2, name: get('ad_soyad'), username: get('kullanici_adi').toLocaleLowerCase('tr-TR'), errors: [] };
    if (item.name.length < 2 || item.name.length > 80) item.errors.push('Ad soyad 2-80 karakter olmalı.');
    const roleKey = normKey(get('rol'));
    item.role = ['ogrenci', 'student'].includes(roleKey) ? 'student' : (['ogretmen', 'teacher'].includes(roleKey) ? 'teacher' : null);
    if (!item.role) item.errors.push('Rol "öğrenci" veya "öğretmen" olmalı.');
    if (!USERNAME.test(item.username)) item.errors.push('Kullanıcı adı 3-32 karakter: küçük harf, rakam, nokta, tire, alt çizgi.');
    else if (takenUsernames.has(item.username) || fileUsernames.has(item.username)) item.errors.push('Bu kullanıcı adı zaten kullanılıyor.');
    else fileUsernames.add(item.username);
    const password = get('parola');
    if (password) {
      const problem = passwordProblem(password);
      if (problem) item.errors.push(problem);
      item.password = password;
    } else {
      item.password = generatePassword();
      item.generated = true;
    }
    if (item.role === 'student') {
      item.studentNo = get('okul_no');
      if (!item.studentNo) item.errors.push('Öğrenci için okul no zorunlu.');
      else if (takenNumbers.has(item.studentNo) || fileNumbers.has(item.studentNo)) item.errors.push('Bu okul no zaten kayıtlı.');
      else fileNumbers.add(item.studentNo);
      const classId = classes.get(normKey(get('sinif')));
      if (!classId) item.errors.push(`Sınıf bulunamadı: "${get('sinif') || '(boş)'}".`);
      item.classId = classId || null;
    }
    if (item.role === 'teacher') {
      item.teaching = [];
      for (const part of get('ders_atamalari').split('|').map(v => v.trim()).filter(Boolean)) {
        const [className, subjectName] = part.split(':').map(v => (v || '').trim());
        const classId = classes.get(normKey(className));
        const subjectId = subjects.get(normKey(subjectName));
        if (!classId || !subjectId) { item.errors.push(`Ders ataması geçersiz: "${part}" (sınıf:ders biçiminde yazın).`); continue; }
        item.teaching.push({ classId, subjectId });
      }
    }
    item.status = item.errors.length ? 'hata' : 'ok';
    item.message = item.errors.join(' ') || 'Eklenebilir';
    return item;
  });
}

on('POST', '/api/import/users', async ({ body, user }) => {
  const text = String(body.csv ?? '');
  if (text.length > IMPORT_MAX_CHARS) fail(400, 'Dosya çok büyük. En fazla 300 KB olmalı.');
  const plan = await planImport(text);
  const errorCount = plan.filter(item => item.status === 'hata').length;
  const preview = plan.map(({ line, name, username, role, status, message, generated }) => ({ line, name, username, role, status, message, generated: Boolean(generated) }));
  if (body.dryRun !== false) return ok({ dryRun: true, rows: preview, okCount: plan.length - errorCount, errorCount });
  if (errorCount) fail(400, `Dosyada ${errorCount} hatalı satır var. Önce hataları düzeltin; hiçbir kayıt eklenmedi.`);

  // Parolalar paralel hesaplanır; yazma tek işlemde, hepsi ya da hiçbiri
  const hashes = [];
  for (let i = 0; i < plan.length; i += 8) {
    hashes.push(...await Promise.all(plan.slice(i, i + 8).map(item => sec.hashPasswordAsync(item.password))));
  }
  await tx(async client => {
    for (let i = 0; i < plan.length; i += 1) {
      const item = plan[i];
      const { rows: [row] } = await client.query(`insert into users (username, password_hash, name, role, student_no)
        values ($1, $2, $3, $4, $5) returning id`, [item.username, hashes[i], item.name, item.role, item.studentNo || null]);
      if (item.role === 'student') await client.query('insert into enrollments (student_id, class_id) values ($1, $2)', [row.id, item.classId]);
      for (const pair of item.teaching || []) {
        await client.query('insert into teaching (teacher_id, class_id, subject_id) values ($1, $2, $3)', [row.id, pair.classId, pair.subjectId]);
      }
    }
  });
  const credentials = plan.filter(item => item.generated).map(item => ({ name: item.name, username: item.username, role: item.role, password: item.password }));
  await audit(user, 'users_imported', `${plan.length} kayıt`, { students: plan.filter(i => i.role === 'student').length, teachers: plan.filter(i => i.role === 'teacher').length, generatedPasswords: credentials.length });
  return created({ created: plan.length, credentials });
}, { roles: PRINCIPAL });

// ---------- Veli, not özetleri, sınav ve quiz ----------
async function studentIdsOf(list, allowEmpty) {
  if (!Array.isArray(list)) fail(400, 'Çocuk listesi geçersiz.');
  const ids = [...new Set(list.map(v => requireId(v, 'öğrenci')))];
  if (!allowEmpty && !ids.length) fail(400, 'Veli hesabı en az bir öğrenciye bağlanmalı.');
  if (ids.length > 10) fail(400, 'Bir veli en fazla 10 öğrenciye bağlanabilir.');
  if (!ids.length) return ids;
  const { rows } = await q("select id from users where id = any($1::uuid[]) and role = 'student'", [ids]);
  if (rows.length !== ids.length) fail(400, 'Bağlanacak öğrencilerden biri bulunamadı.');
  return ids;
}

async function linkedStudent(user, studentId) {
  const { rowCount } = await q('select 1 from parent_links where parent_id = $1 and student_id = $2', [user.id, studentId]);
  if (!rowCount) fail(403, 'Bu öğrenciye erişim yetkiniz yok.');
}

const numericGrade = value => {
  const n = Number(String(value ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};

async function attendanceSummaryFor(studentId) {
  const subjects = (await q(`select s.id as "subjectId", s.name as "subjectName", count(*)::int as total,
      count(*) filter (where a.present)::int as present
    from attendance a join subjects s on s.id = a.subject_id where a.student_id = $1 group by s.id, s.name order by s.name`, [studentId])).rows;
  const recent = (await q(`select s.name as "subjectName", a.lesson_date as date, a.present from attendance a
    join subjects s on s.id = a.subject_id where a.student_id = $1 order by a.lesson_date desc, s.name limit 30`, [studentId])).rows;
  return { subjects, recent };
}

// Öğrencinin not özeti: ödev notları (0-100) ve quiz yüzdeleri, derslere göre ortalama ile birlikte.
async function gradeSummaryFor(studentId) {
  const { rows: items } = await q(`select a.title, s.name as "subjectName", x.grade, x.feedback, x.graded_at as "gradedAt"
    from submissions x join assignments a on a.id = x.assignment_id join subjects s on s.id = a.subject_id
    where x.student_id = $1 and x.grade is not null order by x.submitted_at desc limit 100`, [studentId]);
  const { rows: quizzes } = await q(`select qz.title, s.name as "subjectName", at.score, at.max_score as "maxScore", at.submitted_at as "submittedAt"
    from quiz_attempts at join quizzes qz on qz.id = at.quiz_id join subjects s on s.id = qz.subject_id
    where at.student_id = $1 and at.submitted_at is not null order by at.submitted_at desc limit 100`, [studentId]);
  const subjects = new Map();
  const add = (name, value) => {
    const entry = subjects.get(name) || { subjectName: name, total: 0, count: 0 };
    entry.total += value; entry.count += 1; subjects.set(name, entry);
  };
  for (const item of items) { const value = numericGrade(item.grade); if (value !== null) add(item.subjectName, value); }
  const quizItems = quizzes.map(z => ({ ...z, percent: z.maxScore ? Math.round((z.score / z.maxScore) * 100) : 0 }));
  for (const z of quizItems) add(z.subjectName, z.percent);
  return {
    subjects: [...subjects.values()].map(e => ({ subjectName: e.subjectName, average: Math.round(e.total / e.count), count: e.count }))
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'tr')),
    assignments: items.map(i => ({ title: i.title, subjectName: i.subjectName, grade: i.grade, feedback: i.feedback, gradedAt: i.gradedAt })),
    quizzes: quizItems.map(z => ({ title: z.title, subjectName: z.subjectName, score: z.score, maxScore: z.maxScore, percent: z.percent, submittedAt: z.submittedAt })),
  };
}

on('GET', '/api/grades/me', async ({ user }) => ok(await gradeSummaryFor(user.id)), { roles: STUDENT });

// Sınıf not grafiği: öğretmen kendi derslerini, müdür tüm dersleri görür
on('GET', '/api/grades/class', async ({ query, user }) => {
  const classId = requireId(query.get('classId'), 'sınıf');
  if (user.role === 'teacher' && !(await teachesClass(user, classId))) fail(403, 'Bu sınıfın notlarını görme yetkin yok.');
  const scope = user.role === 'teacher'
    ? 'and a.subject_id in (select t.subject_id from teaching t where t.teacher_id = $2 and t.class_id = $1)'
    : '';
  const params = user.role === 'teacher' ? [classId, user.id] : [classId];
  const { rows: assignmentRows } = await q(`select a.id, a.title, s.name as "subjectName", x.grade
    from assignments a join subjects s on s.id = a.subject_id left join submissions x on x.assignment_id = a.id
    where a.class_id = $1 ${scope} order by a.created_at`, params);
  const byAssignment = new Map();
  const all = [];
  for (const row of assignmentRows) {
    const entry = byAssignment.get(row.id) || { title: row.title, subjectName: row.subjectName, total: 0, count: 0 };
    const value = numericGrade(row.grade);
    if (value !== null) { entry.total += value; entry.count += 1; all.push(value); }
    byAssignment.set(row.id, entry);
  }
  const quizRows = (await q(`select qz.title, s.name as "subjectName", avg(at.score * 100.0 / nullif(at.max_score, 0))::float as average,
      count(at.id)::int as count
    from quizzes qz join subjects s on s.id = qz.subject_id
    left join quiz_attempts at on at.quiz_id = qz.id and at.submitted_at is not null
    where qz.class_id = $1 ${user.role === 'teacher' ? 'and qz.subject_id in (select t.subject_id from teaching t where t.teacher_id = $2 and t.class_id = $1)' : ''}
    group by qz.id, qz.title, s.name order by qz.title`, params)).rows;
  const bins = [['0-19', 0, 19], ['20-39', 20, 39], ['40-59', 40, 59], ['60-79', 60, 79], ['80-100', 80, 100]]
    .map(([label, min, max]) => ({ label, count: all.filter(v => v >= min && v <= max).length }));
  return ok({
    assignments: [...byAssignment.values()].map(e => ({ title: e.title, subjectName: e.subjectName, average: e.count ? Math.round(e.total / e.count) : null, count: e.count })),
    quizzes: quizRows.map(r => ({ title: r.title, subjectName: r.subjectName, average: r.average === null ? null : Math.round(r.average), count: r.count })),
    distribution: bins,
  });
}, { roles: STAFF });

// Veli: çocuklarım
on('GET', '/api/parent/children', async ({ user }) => {
  const { rows } = await q(`select u.id, u.name, u.student_no as "studentNo", c.name as "className",
      (select count(*)::int from attendance a where a.student_id = u.id and a.lesson_date >= current_date - 30) as total,
      (select count(*)::int from attendance a where a.student_id = u.id and a.lesson_date >= current_date - 30 and a.present) as present
    from parent_links pl join users u on u.id = pl.student_id
    left join enrollments e on e.student_id = u.id left join classes c on c.id = e.class_id
    where pl.parent_id = $1 order by u.name`, [user.id]);
  return ok({ children: rows });
}, { roles: ['parent'] });

on('GET', '/api/parent/children/:id', async ({ params, user }) => {
  const studentId = requireId(params.id, 'öğrenci');
  await linkedStudent(user, studentId);
  const { rows: [child] } = await q(`select u.id, u.name, u.student_no as "studentNo", c.name as "className"
    from users u left join enrollments e on e.student_id = u.id left join classes c on c.id = e.class_id where u.id = $1`, [studentId]);
  const { rows: assignments } = await q(`select a.id, a.title, a.kind, a.due_at as "dueAt", s.name as "subjectName",
      x.grade, x.feedback, x.submitted_at as "submittedAt"
    from assignments a join subjects s on s.id = a.subject_id
    left join submissions x on x.assignment_id = a.id and x.student_id = $1
    where a.class_id = (select e.class_id from enrollments e where e.student_id = $1)
    order by coalesce(a.due_at, a.created_at) desc limit 50`, [studentId]);
  const { rows: quizzes } = await q(`select qz.id, qz.title, qz.closes_at as "closesAt", s.name as "subjectName",
      at.score, at.max_score as "maxScore", at.submitted_at as "submittedAt"
    from quizzes qz join subjects s on s.id = qz.subject_id
    left join quiz_attempts at on at.quiz_id = qz.id and at.student_id = $1
    where qz.published and qz.class_id = (select e.class_id from enrollments e where e.student_id = $1)
    order by qz.closes_at desc limit 50`, [studentId]);
  return ok({
    child, assignments, quizzes,
    attendance: await attendanceSummaryFor(studentId),
    grades: await gradeSummaryFor(studentId),
  });
}, { roles: ['parent'] });

// ---------- Sınav ve quiz ----------
const QUIZ_GRACE_MS = 15 * 1000;

function parseQuizQuestions(list) {
  if (!Array.isArray(list) || !list.length) fail(400, 'Sınavda en az bir soru olmalı.');
  if (list.length > 50) fail(400, 'Bir sınavda en fazla 50 soru olabilir.');
  return list.map((item, index) => {
    const text = str(item?.text, 1000);
    if (!text) fail(400, `${index + 1}. sorunun metni boş.`);
    const points = Number.isInteger(item?.points) ? item.points : 1;
    if (points < 1 || points > 10) fail(400, `${index + 1}. sorunun puanı 1-10 arasında olmalı.`);
    const timeLimit = Number.isInteger(item?.timeLimit) ? item.timeLimit : 20;
    if (timeLimit < 5 || timeLimit > 120) fail(400, `${index + 1}. sorunun süresi 5-120 saniye arasında olmalı.`);
    const image = item?.image || null;
    if (item?.kind === 'text') {
      return { kind: 'text', text, options: null, correctIndex: null, points, timeLimit, image, position: index + 1 };
    }
    const options = Array.isArray(item?.options) ? item.options.map(v => str(v, 300)) : [];
    if (options.length < 2 || options.length > 5 || options.some(v => !v)) fail(400, `${index + 1}. soruda 2-5 dolu seçenek olmalı.`);
    const correctIndex = Number.isInteger(item?.correctIndex) ? item.correctIndex : -1;
    if (correctIndex < 0 || correctIndex >= options.length) fail(400, `${index + 1}. sorunun doğru cevabı seçilmemiş.`);
    return { kind: 'choice', text, options, correctIndex, points, timeLimit, image, position: index + 1 };
  });
}

// Süresi dolan ve teslim edilmemiş denemeyi, kayıtlı cevaplarla otomatik teslim eder.
// Puanı yeniden hesaplar: çoktan seçmeli sorular anında, açık uçlu sorular öğretmen puanladıkça eklenir.
async function recalcAttempt(client, attemptId) {
  const { rows } = await client.query(`select qq.points, qq.kind, qq.correct_index, a.selected, a.awarded
    from quiz_attempts at join quiz_questions qq on qq.quiz_id = at.quiz_id
    left join quiz_answers a on a.question_id = qq.id and a.attempt_id = at.id
    where at.id = $1`, [attemptId]);
  const maxScore = rows.reduce((sum, r) => sum + r.points, 0);
  const score = rows.reduce((sum, r) => sum + (r.kind === 'text' ? (r.awarded ?? 0) : (r.selected === r.correct_index ? r.points : 0)), 0);
  const graded = rows.every(r => r.kind !== 'text' || r.awarded !== null);
  await client.query('update quiz_attempts set score = $2, max_score = $3, graded = $4 where id = $1', [attemptId, score, maxScore, graded]);
}

async function finalizeAttempt(attemptId) {
  await tx(async client => {
    const { rows: [attempt] } = await client.query('select id, quiz_id, submitted_at from quiz_attempts where id = $1 for update', [attemptId]);
    if (!attempt || attempt.submitted_at) return;
    await client.query('update quiz_attempts set submitted_at = now() where id = $1', [attemptId]);
    await recalcAttempt(client, attemptId);
  });
}

async function settleExpired(studentId, quizId) {
  const { rows } = await q(`select id from quiz_attempts where student_id = $1 and quiz_id = $2 and submitted_at is null
    and deadline + make_interval(secs => $3) < now()`, [studentId, quizId, QUIZ_GRACE_MS / 1000]);
  for (const row of rows) await finalizeAttempt(row.id);
}

async function quizAccess(user, quiz) {
  if (user.role === 'principal') return 'full';
  if (user.role === 'teacher') return (await canTeach(user, quiz.class_id, quiz.subject_id)) ? 'full' : null;
  if (user.role === 'student' && quiz.published && (await enrolledIn(user.id, quiz.class_id))) return 'student';
  return null;
}

async function loadQuiz(id) {
  const { rows: [quiz] } = await q('select * from quizzes where id = $1', [id]);
  if (!quiz) fail(404, 'Sınav bulunamadı.');
  return quiz;
}

on('POST', '/api/quizzes', async ({ body, user }) => {
  const classId = requireId(body.classId, 'sınıf');
  const subjectId = requireId(body.subjectId, 'ders');
  if (!(await canTeach(user, classId, subjectId))) fail(403, 'Bu sınıf ve ders için sınav oluşturma yetkin yok.');
  const title = str(body.title, 160);
  if (title.length < 2) fail(400, 'Sınav başlığı en az 2 karakter olmalı.');
  const opensAt = new Date(body.opensAt);
  const closesAt = new Date(body.closesAt);
  if (Number.isNaN(opensAt.getTime()) || Number.isNaN(closesAt.getTime())) fail(400, 'Açılış ve kapanış tarihleri geçersiz.');
  if (closesAt <= opensAt) fail(400, 'Kapanış zamanı açılış zamanından sonra olmalı.');
  const timeLimit = Number.isInteger(body.timeLimitMinutes) ? body.timeLimitMinutes : 20;
  if (timeLimit < 1 || timeLimit > 240) fail(400, 'Süre 1-240 dakika arasında olmalı.');
  const questions = parseQuizQuestions(body.questions);
  const imagePaths = [];
  try {
    for (const question of questions) {
      if (!question.image) continue;
      const upload = storage.parseUpload(question.image);
      if (!['image/png', 'image/jpeg'].includes(upload.mime)) fail(400, `${question.position}. sorunun görseli PNG veya JPG olmalı.`);
      question.imagePath = storage.newPath('quiz', upload.ext, upload.name);
      question.imageMime = upload.mime;
      question.imageName = upload.name;
      await storage.put(question.imagePath, upload.buffer, upload.mime);
      imagePaths.push(question.imagePath);
    }
    const quizId = await tx(async client => {
      const { rows: [row] } = await client.query(`insert into quizzes (title, class_id, subject_id, created_by, opens_at, closes_at, time_limit_minutes, published, shuffle_options)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`, [title, classId, subjectId, user.id, opensAt.toISOString(), closesAt.toISOString(), timeLimit, body.published === true, body.shuffleOptions === true]);
      for (const question of questions) {
        await client.query(`insert into quiz_questions (quiz_id, position, text, options, correct_index, points, time_limit, image_path, image_mime, image_name, kind)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [row.id, question.position, question.text, question.options ? JSON.stringify(question.options) : null, question.correctIndex,
          question.points, question.timeLimit, question.imagePath || null, question.imageMime || null, question.imageName || null, question.kind]);
      }
      return row.id;
    });
    await audit(user, 'quiz_created', title, { questions: questions.length, published: body.published === true });
    if (body.published === true) {
      const { rows: students } = await q('select student_id from enrollments where class_id = $1', [classId]);
      push.notify(students.map(s => s.student_id), { title: 'Yeni sınav yayınlandı', body: title, url: '/#/sinavlar', tag: `quiz-${quizId}` }).catch(() => {});
    }
    return created({ id: quizId });
  } catch (error) {
    for (const path of imagePaths) await storage.remove(path).catch(() => {});
    throw error;
  }
}, { roles: STAFF });

on('GET', '/api/quizzes', async ({ user }) => {
  const scope = user.role === 'principal' ? 'true'
    : user.role === 'teacher' ? 'exists (select 1 from teaching t where t.teacher_id = $1 and t.class_id = qz.class_id and t.subject_id = qz.subject_id)'
    : 'qz.published and qz.class_id = (select e.class_id from enrollments e where e.student_id = $1)';
  const { rows } = await q(`select qz.id, qz.title, qz.class_id as "classId", qz.subject_id as "subjectId", c.name as "className",
      s.name as "subjectName", qz.opens_at as "opensAt", qz.closes_at as "closesAt", qz.time_limit_minutes as "timeLimitMinutes",
      qz.published, (select count(*)::int from quiz_questions x where x.quiz_id = qz.id) as "questionCount",
      (select count(*)::int from quiz_attempts x where x.quiz_id = qz.id and x.submitted_at is not null) as "submittedCount",
      (select json_build_object('id', x.id, 'score', x.score, 'maxScore', x.max_score, 'submittedAt', x.submitted_at, 'deadline', x.deadline)
         from quiz_attempts x where x.quiz_id = qz.id and x.student_id = $1) as "mine"
    from quizzes qz join classes c on c.id = qz.class_id join subjects s on s.id = qz.subject_id
    where ${scope} order by qz.closes_at desc limit 200`, [user.id]);
  return ok({ quizzes: rows.map(r => ({ ...r, state: Date.now() < new Date(r.opensAt) ? 'yakında' : Date.now() <= new Date(r.closesAt) ? 'açık' : 'kapandı' })) });
});

on('GET', '/api/quizzes/:id', async ({ params, user }) => {
  const id = requireId(params.id, 'sınav');
  const quiz = await loadQuiz(id);
  const access = await quizAccess(user, quiz);
  if (!access) fail(403, 'Bu sınavı görme yetkin yok.');
  if (access === 'student') await settleExpired(user.id, id);
  const { rows: questions } = await q(`select id, position, text, options, correct_index as "correctIndex", points, time_limit as "timeLimit",
    (image_path is not null) as "hasImage", kind from quiz_questions where quiz_id = $1 order by position`, [id]);
  const detail = { id: quiz.id, title: quiz.title, classId: quiz.class_id, subjectId: quiz.subject_id, opensAt: quiz.opens_at, closesAt: quiz.closes_at, timeLimitMinutes: quiz.time_limit_minutes, published: quiz.published };
  if (access === 'full') return ok({ quiz: detail, questions });
  // Öğrenci: doğru cevaplar yalnızca kendi teslimi bittikten sonra görünür
  const { rows: [attempt] } = await q('select id, deadline, submitted_at, score, max_score, option_order, graded from quiz_attempts where quiz_id = $1 and student_id = $2', [id, user.id]);
  const finished = Boolean(attempt?.submitted_at);
  const answers = attempt ? (await q('select question_id, selected, text_answer, awarded from quiz_answers where attempt_id = $1', [attempt.id])).rows : [];
  return ok({
    quiz: detail,
    questions: questions.map(qq => ({ id: qq.id, position: qq.position, text: qq.text, kind: qq.kind, options: shownOptions(qq, attempt, finished), points: qq.points, timeLimit: qq.timeLimit, hasImage: qq.hasImage,
      textAnswer: answers.find(a => a.question_id === qq.id)?.text_answer ?? null,
      awarded: answers.find(a => a.question_id === qq.id)?.awarded ?? null,
      ...(finished ? { correctIndex: qq.correctIndex, selected: answers.find(a => a.question_id === qq.id)?.selected ?? null } : {}) })),
    attempt: attempt ? { id: attempt.id, deadline: attempt.deadline, submittedAt: attempt.submitted_at, graded: attempt.graded, score: attempt.graded ? attempt.score : null, maxScore: attempt.max_score } : null,
  });
}, { auth: true });

on('PATCH', '/api/quizzes/:id', async ({ params, body, user }) => {
  const id = requireId(params.id, 'sınav');
  const quiz = await loadQuiz(id);
  if (!(await canTeach(user, quiz.class_id, quiz.subject_id))) fail(403, 'Bu sınavı düzenleme yetkin yok.');
  const sets = [];
  const values = [id];
  if (body.published !== undefined) { values.push(body.published === true); sets.push(`published = $${values.length}`); }
  if (body.closesAt !== undefined) {
    const closesAt = new Date(body.closesAt);
    if (Number.isNaN(closesAt.getTime()) || closesAt <= new Date(quiz.opens_at)) fail(400, 'Kapanış zamanı açılıştan sonra olmalı.');
    values.push(closesAt.toISOString()); sets.push(`closes_at = $${values.length}`);
  }
  if (!sets.length) fail(400, 'Güncellenecek alan yok.');
  await q(`update quizzes set ${sets.join(', ')} where id = $1`, values);
  if (body.published === true && !quiz.published) {
    const { rows: students } = await q('select student_id from enrollments where class_id = $1', [quiz.class_id]);
    push.notify(students.map(s => s.student_id), { title: 'Yeni sınav yayınlandı', body: quiz.title, url: '/#/sinavlar', tag: `quiz-${id}` }).catch(() => {});
  }
  return ok({ updated: true });
}, { roles: STAFF });

on('DELETE', '/api/quizzes/:id', async ({ params, user }) => {
  const id = requireId(params.id, 'sınav');
  const quiz = await loadQuiz(id);
  if (!(await canTeach(user, quiz.class_id, quiz.subject_id))) fail(403, 'Bu sınavı silme yetkin yok.');
  await q('delete from quizzes where id = $1', [id]);
  await audit(user, 'quiz_deleted', quiz.title);
  return ok({ deleted: true });
}, { roles: TEACHER });

on('POST', '/api/quizzes/:id/attempts', async ({ params, user }) => {
  const id = requireId(params.id, 'sınav');
  const quiz = await loadQuiz(id);
  if (!(await quizAccess(user, quiz)) || (await quizAccess(user, quiz)) !== 'student') fail(403, 'Bu sınava giremezsiniz.');
  const now = Date.now();
  const { rows: [existing] } = await q('select id, deadline, submitted_at from quiz_attempts where quiz_id = $1 and student_id = $2', [id, user.id]);
  if (existing?.submitted_at) fail(409, 'Bu sınavı zaten tamamladınız.');
  if (existing && new Date(existing.deadline).getTime() + QUIZ_GRACE_MS > now) return ok({ attemptId: existing.id, deadline: existing.deadline, resumed: true });
  if (existing) { await finalizeAttempt(existing.id); fail(409, 'Süreniz dolduğu için bu sınav tamamlandı.'); }
  if (now < new Date(quiz.opens_at).getTime()) fail(400, 'Sınav henüz açılmadı.');
  if (now > new Date(quiz.closes_at).getTime()) fail(400, 'Sınavın süresi doldu.');
  const deadline = new Date(Math.min(now + quiz.time_limit_minutes * 60 * 1000, new Date(quiz.closes_at).getTime()));
  const order = quiz.shuffle_options ? await shuffledOrders(id) : null;
  const { rows: [attempt] } = await q('insert into quiz_attempts (quiz_id, student_id, deadline, option_order) values ($1, $2, $3, $4) returning id', [id, user.id, deadline.toISOString(), order ? JSON.stringify(order) : null]);
  return created({ attemptId: attempt.id, deadline: deadline.toISOString(), resumed: false });
}, { roles: STUDENT });

on('PUT', '/api/quiz-attempts/:id/answers', async ({ params, body, user }) => {
  const id = requireId(params.id, 'deneme');
  const { rows: [attempt] } = await q('select id, quiz_id, student_id, deadline, submitted_at, option_order from quiz_attempts where id = $1', [id]);
  if (!attempt || attempt.student_id !== user.id) fail(404, 'Deneme bulunamadı.');
  if (attempt.submitted_at) fail(400, 'Bu deneme zaten teslim edildi.');
  if (Date.now() > new Date(attempt.deadline).getTime() + QUIZ_GRACE_MS) { await finalizeAttempt(id); fail(400, 'Süreniz doldu, cevaplarınız teslim edildi.'); }
  const answers = Array.isArray(body.answers) ? body.answers.slice(0, 50) : fail(400, 'Cevap listesi geçersiz.');
  const { rows: questions } = await q('select id, options, kind from quiz_questions where quiz_id = $1', [attempt.quiz_id]);
  const meta = new Map(questions.map(qq => [qq.id, { kind: qq.kind, options: qq.options?.length || 0 }]));
  const stored = [];
  for (const answer of answers) {
    const questionId = requireId(answer?.questionId, 'soru');
    const info = meta.get(questionId);
    if (!info) fail(400, 'Cevap bu sınavın sorusu değil.');
    if (info.kind === 'text') {
      const text = typeof answer.text === 'string' ? answer.text.trim() : '';
      if (text.length > 2000) fail(400, 'Açık uçlu cevap en fazla 2000 karakter olabilir.');
      if (text) stored.push({ questionId, text });
    } else {
      const selected = answer?.selected;
      if (!Number.isInteger(selected) || selected < 0 || selected >= info.options) fail(400, 'Seçilen şık geçersiz.');
      stored.push({ questionId, selected: originalIndex(attempt, questionId, selected) });
    }
  }
  await tx(async client => {
    for (const answer of stored) {
      if ('text' in answer) {
        await client.query(`insert into quiz_answers (attempt_id, question_id, text_answer) values ($1, $2, $3)
          on conflict (attempt_id, question_id) do update set text_answer = excluded.text_answer`, [id, answer.questionId, answer.text]);
      } else {
        await client.query(`insert into quiz_answers (attempt_id, question_id, selected) values ($1, $2, $3)
          on conflict (attempt_id, question_id) do update set selected = excluded.selected`, [id, answer.questionId, answer.selected]);
      }
    }
  });
  return ok({ saved: stored.length });
}, { roles: STUDENT });

async function attemptResult(attemptId) {
  const { rows: [attempt] } = await q('select id, quiz_id, score, max_score, submitted_at, graded from quiz_attempts where id = $1', [attemptId]);
  const { rows } = await q(`select qq.id, qq.position, qq.text, qq.options, qq.correct_index as "correctIndex", qq.points, qq.kind,
      a.selected, a.text_answer as "textAnswer", a.awarded
    from quiz_questions qq left join quiz_answers a on a.question_id = qq.id and a.attempt_id = $1
    where qq.quiz_id = $2 order by qq.position`, [attemptId, attempt.quiz_id]);
  return {
    score: attempt.graded ? attempt.score : null,
    maxScore: attempt.max_score,
    submittedAt: attempt.submitted_at,
    graded: attempt.graded,
    questions: rows.map(r => ({
      position: r.position, text: r.text, kind: r.kind, points: r.points,
      options: r.options, correctIndex: r.correctIndex, selected: r.selected,
      correct: r.kind === 'choice' && r.selected === r.correctIndex,
      textAnswer: r.textAnswer, awarded: r.awarded,
    })),
  };
}

on('POST', '/api/quiz-attempts/:id/submit', async ({ params, user }) => {
  const id = requireId(params.id, 'deneme');
  const { rows: [attempt] } = await q('select id, student_id from quiz_attempts where id = $1', [id]);
  if (!attempt || attempt.student_id !== user.id) fail(404, 'Deneme bulunamadı.');
  await finalizeAttempt(id);
  return ok(await attemptResult(id));
}, { roles: STUDENT });

on('GET', '/api/quizzes/:id/results', async ({ params, user }) => {
  const id = requireId(params.id, 'sınav');
  const quiz = await loadQuiz(id);
  if (!(await quizAccess(user, quiz)) || (await quizAccess(user, quiz)) !== 'full') fail(403, 'Bu sınavın sonuçlarını görme yetkin yok.');
  const { rows: attempts } = await q(`select at.id, at.score, at.max_score as "maxScore", at.submitted_at as "submittedAt", at.deadline,
      u.name as "studentName", u.student_no as "studentNo"
    from quiz_attempts at join users u on u.id = at.student_id where at.quiz_id = $1 order by u.name`, [id]);
  const { rows: [{ n }] } = await q('select count(*)::int as n from enrollments where class_id = $1', [quiz.class_id]);
  const percents = attempts.filter(a => a.submittedAt && a.maxScore).map(a => Math.round((a.score / a.maxScore) * 100));
  const bins = [['0-19', 0, 19], ['20-39', 20, 39], ['40-59', 40, 59], ['60-79', 60, 79], ['80-100', 80, 100]]
    .map(([label, min, max]) => ({ label, count: percents.filter(v => v >= min && v <= max).length }));
  return ok({
    quiz: { id: quiz.id, title: quiz.title },
    attempts: attempts.map(a => ({ ...a, percent: a.submittedAt && a.maxScore ? Math.round((a.score / a.maxScore) * 100) : null })),
    stats: { classSize: n, submitted: percents.length, average: percents.length ? Math.round(percents.reduce((x, y) => x + y, 0) / percents.length) : null, distribution: bins },
  });
}, { auth: true });

// ---------- Davranış, gözlem notları, ders programı, takvim, karne (v16) ----------
const BADGE_RULES = [[1, 'İlk adım'], [10, 'Yıldız'], [25, 'Usta'], [50, 'Efsane']];
const badgesFor = total => BADGE_RULES.filter(([min]) => total >= min).map(([, name]) => name);
const isoDateParam = value => (/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) && !Number.isNaN(Date.parse(value)) ? value : null);
const clockParam = value => {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? ''));
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) fail(400, 'Saat SS:DD biçiminde olmalı.');
  return `${match[1]}:${match[2]}`;
};
const EVENT_KINDS = ['sinav', 'tatil', 'etkinlik', 'toplanti'];

// Kullanıcının görebileceği sınıflar. Müdür için null (hepsi).
async function visibleClassIds(user) {
  if (user.role === 'principal') return null;
  const { rows } = await q(`select class_id from teaching where teacher_id = $1
    union select class_id from enrollments where student_id = $1
    union select e.class_id from enrollments e join parent_links pl on pl.student_id = e.student_id where pl.parent_id = $1`, [user.id]);
  return rows.map(r => r.class_id);
}

// Bir öğrencinin bilgilerini kimin görebileceği: müdür, öğrencinin kendisi, bağlı veli, öğrencinin öğretmeni.
async function requireStudentView(user, studentId) {
  if (user.role === 'principal' || user.id === studentId) return;
  const sql = user.role === 'parent'
    ? 'select 1 from parent_links where parent_id = $1 and student_id = $2'
    : user.role === 'teacher'
      ? 'select 1 from enrollments e join teaching t on t.class_id = e.class_id where t.teacher_id = $1 and e.student_id = $2 limit 1'
      : null;
  if (!sql) fail(403, 'Bu öğrenciyi görme yetkin yok.');
  const { rowCount } = await q(sql, [user.id, studentId]);
  if (!rowCount) fail(403, 'Bu öğrenciyi görme yetkin yok.');
}

async function behaviorFor(studentId) {
  const { rows: [t] } = await q(`select coalesce(sum(points), 0)::int as total,
      count(*) filter (where points > 0)::int as positive, count(*) filter (where points < 0)::int as negative
    from behavior_points where student_id = $1`, [studentId]);
  const { rows: events } = await q(`select b.id, b.points, b.reason, b.created_at as "createdAt", c.name as "className",
      u.name as "teacherName", b.teacher_id as "teacherId"
    from behavior_points b join classes c on c.id = b.class_id left join users u on u.id = b.teacher_id
    where b.student_id = $1 order by b.created_at desc limit 60`, [studentId]);
  return { total: t.total, positive: t.positive, negative: t.negative, badges: badgesFor(t.total), events };
}

// Davranış puanı: öğretmen (kendi sınıfı) ya da müdür verir
on('POST', '/api/behavior', async ({ body, user }) => {
  const studentId = requireId(body.studentId, 'öğrenci');
  const classId = requireId(body.classId, 'sınıf');
  if (user.role !== 'principal' && !(await teachesClass(user, classId))) fail(403, 'Bu sınıfa puan verme yetkin yok.');
  const points = Number.isInteger(body.points) ? body.points : 0;
  if (points === 0 || Math.abs(points) > 10) fail(400, 'Puan -10 ile 10 arasında ve sıfırdan farklı olmalı.');
  if (!(await enrolledIn(studentId, classId))) fail(400, 'Öğrenci bu sınıfta kayıtlı değil.');
  const reason = str(body.reason, 120);
  const { rows: [row] } = await q(`insert into behavior_points (student_id, class_id, teacher_id, points, reason)
    values ($1, $2, $3, $4, $5) returning id`, [studentId, classId, user.id, points, reason]);
  push.notify([studentId], { title: 'Yeni puan', body: `${points > 0 ? '+' : ''}${points} puan: ${reason || 'Öğretmeniniz puan verdi'}`, url: '/#/puanlarim', tag: `behavior-${row.id}` }).catch(() => {});
  return created({ id: row.id });
}, { roles: STAFF });

// Sınıf özeti: öğrenci toplamları, rozetler ve son hareketler
on('GET', '/api/behavior/class', async ({ query, user }) => {
  const classId = requireId(query.get('classId'), 'sınıf');
  if (user.role !== 'principal' && !(await teachesClass(user, classId))) fail(403, 'Bu sınıfın davranış kayıtlarını görme yetkin yok.');
  const { rows: students } = await q(`select u.id, u.name, u.student_no as "studentNo",
      coalesce((select sum(b.points) from behavior_points b where b.student_id = u.id and b.class_id = $1), 0)::int as total
    from enrollments e join users u on u.id = e.student_id where e.class_id = $1 order by u.name`, [classId]);
  const { rows: recent } = await q(`select b.id, b.points, b.reason, b.created_at as "createdAt", b.student_id as "studentId",
      u.name as "studentName", t.name as "teacherName", b.teacher_id as "teacherId"
    from behavior_points b join users u on u.id = b.student_id left join users t on t.id = b.teacher_id
    where b.class_id = $1 order by b.created_at desc limit 40`, [classId]);
  return ok({
    students: students.map(s => ({ ...s, badges: badgesFor(s.total) })),
    recent: recent.map(r => ({ ...r, canDelete: user.role === 'principal' || r.teacherId === user.id })),
  });
}, { roles: STAFF });

on('GET', '/api/behavior/student/:id', async ({ params, user }) => {
  const studentId = requireId(params.id, 'öğrenci');
  await requireStudentView(user, studentId);
  return ok(await behaviorFor(studentId));
});

on('DELETE', '/api/behavior/:id', async ({ params, user }) => {
  const id = requireId(params.id, 'puan');
  const { rows: [row] } = await q('select teacher_id from behavior_points where id = $1', [id]);
  if (!row) fail(404, 'Puan kaydı bulunamadı.');
  if (user.role !== 'principal' && row.teacher_id !== user.id) fail(403, 'Bu kaydı silme yetkin yok.');
  await q('delete from behavior_points where id = $1', [id]);
  return ok({ deleted: true });
}, { roles: STAFF });

// Gözlem notları: öğretmen ve müdür yazar. Veli yalnızca paylaşılanları görür.
on('POST', '/api/student-notes', async ({ body, user }) => {
  const studentId = requireId(body.studentId, 'öğrenci');
  await requireStudentView(user, studentId);
  const text = str(body.body, 1000);
  if (!text) fail(400, 'Not boş olamaz.');
  const { rows: [row] } = await q(`insert into student_notes (student_id, teacher_id, body, shared_with_parent)
    values ($1, $2, $3, $4) returning id`, [studentId, user.id, text, body.sharedWithParent === true]);
  return created({ id: row.id });
}, { roles: STAFF });

on('GET', '/api/student-notes', async ({ query, user }) => {
  const studentId = requireId(query.get('studentId'), 'öğrenci');
  if (user.role === 'student') fail(403, 'Gözlem notlarını görme yetkin yok.');
  await requireStudentView(user, studentId);
  const sharedOnly = user.role === 'parent' ? 'and n.shared_with_parent' : '';
  const { rows } = await q(`select n.id, n.body, n.shared_with_parent as "shared", n.created_at as "createdAt",
      n.teacher_id as "teacherId", u.name as "teacherName"
    from student_notes n left join users u on u.id = n.teacher_id
    where n.student_id = $1 ${sharedOnly} order by n.created_at desc limit 100`, [studentId]);
  return ok({ notes: rows.map(n => ({ ...n, canDelete: user.role === 'principal' || n.teacherId === user.id })) });
});

on('DELETE', '/api/student-notes/:id', async ({ params, user }) => {
  const id = requireId(params.id, 'not');
  const { rows: [row] } = await q('select teacher_id from student_notes where id = $1', [id]);
  if (!row) fail(404, 'Not bulunamadı.');
  if (user.role !== 'principal' && row.teacher_id !== user.id) fail(403, 'Bu notu silme yetkin yok.');
  await q('delete from student_notes where id = $1', [id]);
  return ok({ deleted: true });
}, { roles: STAFF });

// Ders programı: öğretmen kendi dersleri, öğrenci ve veli sınıfının programı, müdür hepsi
on('GET', '/api/timetable', async ({ query, user }) => {
  const params = [];
  const conditions = [];
  const classId = query.get('classId') ? requireId(query.get('classId'), 'sınıf') : null;
  if (classId) {
    if (user.role !== 'principal' && !(await visibleClassIds(user)).includes(classId)) fail(403, 'Bu sınıfın programını görme yetkin yok.');
    params.push(classId); conditions.push(`s.class_id = $${params.length}`);
  } else if (user.role === 'teacher') {
    params.push(user.id); conditions.push(`s.teacher_id = $${params.length}`);
  } else if (user.role !== 'principal') {
    params.push(await visibleClassIds(user)); conditions.push(`s.class_id = any($${params.length}::uuid[])`);
  }
  const where = conditions.length ? conditions.join(' and ') : 'true';
  const { rows } = await q(`select s.id, s.weekday, to_char(s.starts_at, 'HH24:MI') as "startsAt", to_char(s.ends_at, 'HH24:MI') as "endsAt",
      s.room, s.class_id as "classId", c.name as "className", s.subject_id as "subjectId", sj.name as "subjectName",
      s.teacher_id as "teacherId", u.name as "teacherName"
    from timetable_slots s join classes c on c.id = s.class_id join subjects sj on sj.id = s.subject_id join users u on u.id = s.teacher_id
    where ${where} order by s.weekday, s.starts_at limit 1000`, params);
  return ok({ slots: rows.map(r => ({ ...r, canDelete: user.role === 'principal' || r.teacherId === user.id })) });
});

on('POST', '/api/timetable', async ({ body, user }) => {
  const classId = requireId(body.classId, 'sınıf');
  const subjectId = requireId(body.subjectId, 'ders');
  const weekday = Number(body.weekday);
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 5) fail(400, 'Gün 1 (Pazartesi) ile 5 (Cuma) arasında olmalı.');
  const startsAt = clockParam(body.startsAt);
  const endsAt = clockParam(body.endsAt);
  if (endsAt <= startsAt) fail(400, 'Bitiş saati başlangıç saatinden sonra olmalı.');
  const room = str(body.room, 40);
  let teacherId;
  if (user.role === 'teacher') {
    if (!(await canTeach(user, classId, subjectId))) fail(403, 'Bu sınıf ve ders için program ekleme yetkin yok.');
    teacherId = user.id;
  } else {
    const { rows: [pair] } = await q('select teacher_id from teaching where class_id = $1 and subject_id = $2 limit 1', [classId, subjectId]);
    if (!pair) fail(400, 'Bu sınıf ve ders için bir öğretmen atanmamış.');
    teacherId = pair.teacher_id;
  }
  const { rows: [clash] } = await q(`select c.name as "className" from timetable_slots s join classes c on c.id = s.class_id
    where s.weekday = $1 and (s.class_id = $2 or s.teacher_id = $3) and s.starts_at < $5::time and s.ends_at > $4::time limit 1`,
  [weekday, classId, teacherId, startsAt, endsAt]);
  if (clash) fail(409, `Bu saat aralığında çakışma var (${clash.className}).`);
  const { rows: [row] } = await q(`insert into timetable_slots (class_id, subject_id, teacher_id, weekday, starts_at, ends_at, room)
    values ($1, $2, $3, $4, $5, $6, $7) returning id`, [classId, subjectId, teacherId, weekday, startsAt, endsAt, room]);
  return created({ id: row.id });
}, { roles: STAFF });

on('DELETE', '/api/timetable/:id', async ({ params, user }) => {
  const id = requireId(params.id, 'ders');
  const { rows: [row] } = await q('select teacher_id from timetable_slots where id = $1', [id]);
  if (!row) fail(404, 'Program kaydı bulunamadı.');
  if (user.role !== 'principal' && row.teacher_id !== user.id) fail(403, 'Bu kaydı silme yetkin yok.');
  await q('delete from timetable_slots where id = $1', [id]);
  return ok({ deleted: true });
}, { roles: STAFF });

// Takvim: okul etkinlikleri, ödev teslimleri ve sınav açılış/kapanışları (kullanıcının sınıflarına göre)
on('GET', '/api/calendar', async ({ query, user }) => {
  const from = isoDateParam(query.get('from'));
  const to = isoDateParam(query.get('to'));
  if (!from || !to || to < from) fail(400, 'Tarih aralığı geçersiz.');
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 62) fail(400, 'En fazla 62 günlük aralık sorgulanabilir.');
  const classIds = await visibleClassIds(user);
  const { rows: events } = await q(`select e.id, e.title, e.kind, to_char(e.event_date, 'YYYY-MM-DD') as date, e.description,
      e.class_id as "classId", c.name as "className", e.created_by as "createdBy"
    from school_events e left join classes c on c.id = e.class_id
    where e.event_date between $1 and $2 and (e.class_id is null or $3::uuid[] is null or e.class_id = any($3::uuid[]))`, [from, to, classIds]);
  const { rows: tasks } = await q(`select a.id, a.title, to_char((a.due_at at time zone 'Europe/Istanbul')::date, 'YYYY-MM-DD') as date,
      a.class_id as "classId", c.name as "className", s.name as "subjectName"
    from assignments a join classes c on c.id = a.class_id join subjects s on s.id = a.subject_id
    where a.due_at is not null and (a.due_at at time zone 'Europe/Istanbul')::date between $1 and $2
      and ($3::uuid[] is null or a.class_id = any($3::uuid[]))`, [from, to, classIds]);
  const { rows: quizzes } = await q(`select qz.id, qz.title, qz.class_id as "classId", c.name as "className",
      to_char((qz.opens_at at time zone 'Europe/Istanbul')::date, 'YYYY-MM-DD') as "opensOn",
      to_char((qz.closes_at at time zone 'Europe/Istanbul')::date, 'YYYY-MM-DD') as "closesOn"
    from quizzes qz join classes c on c.id = qz.class_id
    where qz.published and ($3::uuid[] is null or qz.class_id = any($3::uuid[]))
      and (((qz.opens_at at time zone 'Europe/Istanbul')::date between $1 and $2) or ((qz.closes_at at time zone 'Europe/Istanbul')::date between $1 and $2))`, [from, to, classIds]);
  const items = [
    ...events.map(e => ({ id: e.id, kind: e.kind, title: e.title, date: e.date, className: e.className, classId: e.classId, description: e.description, origin: 'etkinlik', canDelete: user.role === 'principal' || e.createdBy === user.id })),
    ...tasks.map(t => ({ id: t.id, kind: 'odev', title: `Ödev teslimi: ${t.title}`, date: t.date, className: t.className, classId: t.classId, origin: 'odev' })),
    ...quizzes.flatMap(z => [
      ...(z.opensOn >= from && z.opensOn <= to ? [{ id: z.id, kind: 'sinav', title: `Sınav açılıyor: ${z.title}`, date: z.opensOn, className: z.className, classId: z.classId, origin: 'sinav' }] : []),
      ...(z.closesOn >= from && z.closesOn <= to ? [{ id: z.id, kind: 'sinav', title: `Sınav kapanıyor: ${z.title}`, date: z.closesOn, className: z.className, classId: z.classId, origin: 'sinav' }] : []),
    ]),
  ];
  return ok({ items: items.sort((a, b) => a.date.localeCompare(b.date)) });
});

on('POST', '/api/calendar', async ({ body, user }) => {
  const title = str(body.title, 140);
  if (title.length < 2) fail(400, 'Etkinlik adı en az 2 karakter olmalı.');
  if (!EVENT_KINDS.includes(body.kind)) fail(400, 'Etkinlik türü geçersiz.');
  const date = isoDateParam(body.date);
  if (!date) fail(400, 'Tarih geçersiz.');
  const classId = body.classId ? requireId(body.classId, 'sınıf') : null;
  if (user.role !== 'principal') {
    if (!classId) fail(403, 'Öğretmenler etkinliği yalnızca kendi sınıfına ekleyebilir.');
    if (!(await teachesClass(user, classId))) fail(403, 'Bu sınıfa etkinlik ekleme yetkin yok.');
  }
  const description = str(body.description, 500);
  const { rows: [row] } = await q(`insert into school_events (title, kind, event_date, class_id, description, created_by)
    values ($1, $2, $3, $4, $5, $6) returning id`, [title, body.kind, date, classId, description, user.id]);
  return created({ id: row.id });
}, { roles: STAFF });

on('DELETE', '/api/calendar/:id', async ({ params, user }) => {
  const id = requireId(params.id, 'etkinlik');
  const { rows: [row] } = await q('select created_by from school_events where id = $1', [id]);
  if (!row) fail(404, 'Etkinlik bulunamadı.');
  if (user.role !== 'principal' && row.created_by !== user.id) fail(403, 'Bu etkinliği silme yetkin yok.');
  await q('delete from school_events where id = $1', [id]);
  return ok({ deleted: true });
}, { roles: STAFF });

// Karne: yazdırılabilir öğrenci özeti (notlar, devam, davranış, paylaşılan gözlemler)
on('GET', '/api/reports/student/:id', async ({ params, user }) => {
  const studentId = requireId(params.id, 'öğrenci');
  await requireStudentView(user, studentId);
  const { rows: [student] } = await q(`select u.id, u.name, u.student_no as "studentNo", c.name as "className"
    from users u left join enrollments e on e.student_id = u.id left join classes c on c.id = e.class_id
    where u.id = $1 and u.role = 'student'`, [studentId]);
  if (!student) fail(404, 'Öğrenci bulunamadı.');
  const { rows: notes } = await q(`select n.body, n.created_at as "createdAt", u.name as "teacherName"
    from student_notes n left join users u on u.id = n.teacher_id where n.student_id = $1 and n.shared_with_parent
    order by n.created_at desc limit 20`, [studentId]);
  const behavior = await behaviorFor(studentId);
  return ok({
    student,
    generatedAt: new Date().toISOString(),
    grades: await gradeSummaryFor(studentId),
    attendance: await attendanceSummaryFor(studentId),
    behavior: { total: behavior.total, positive: behavior.positive, negative: behavior.negative, badges: behavior.badges },
    notes,
  });
});

// ---------- Canlı yarışma (Kahoot tarzı), soru görselleri, bildirimler (v17) ----------
const LIVE_TOLERANCE_MS = 1000;

async function newLivePin() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const pin = String(crypto.randomInt(100000, 1000000));
    const { rowCount } = await q("select 1 from live_games where pin = $1 and status <> 'finished'", [pin]);
    if (!rowCount) return pin;
  }
  fail(503, 'PIN üretilemedi. Lütfen tekrar deneyin.');
}

async function liveGame(id) {
  const { rows: [g] } = await q(`select g.id, g.quiz_id, g.class_id, g.host_id, g.pin, g.status, g.current_index, g.question_started_at,
      qz.title as quiz_title, c.name as class_name, s.name as subject_name
    from live_games g join quizzes qz on qz.id = g.quiz_id join classes c on c.id = g.class_id join subjects s on s.id = qz.subject_id
    where g.id = $1`, [id]);
  if (!g) fail(404, 'Yarışma bulunamadı.');
  return g;
}

async function liveQuestion(quizId, index) {
  const { rows: [qq] } = await q(`select id, text, options, correct_index as "correctIndex", points, time_limit as "timeLimit",
      (image_path is not null) as "hasImage" from quiz_questions where quiz_id = $1 and position = $2`, [quizId, index + 1]);
  return qq || null;
}

// Yarışmayı bitirir. Her katılımcının doğru cevaplarının puanı sınav sonucu olarak kaydedilir (notlara yansır).
async function finishLive(g) {
  await tx(async client => {
    await client.query("update live_games set status = 'finished', ended_at = now() where id = $1", [g.id]);
    const { rows: [maxRow] } = await client.query('select coalesce(sum(points), 0)::int as total from quiz_questions where quiz_id = $1', [g.quiz_id]);
    const { rows: players } = await client.query('select student_id from live_players where game_id = $1', [g.id]);
    for (const player of players) {
      const { rows: [got] } = await client.query(`select coalesce(sum(qq.points), 0)::int as score
        from live_answers la join quiz_questions qq on qq.quiz_id = $2 and qq.position = la.question_index + 1
        where la.game_id = $1 and la.student_id = $3 and la.correct`, [g.id, g.quiz_id, player.student_id]);
      await client.query(`insert into quiz_attempts (quiz_id, student_id, started_at, deadline, submitted_at, score, max_score)
        values ($1, $2, now(), now(), now(), $3, $4) on conflict (quiz_id, student_id) do nothing`, [g.quiz_id, player.student_id, got.score, maxRow.total]);
    }
  });
}

function requireLiveHost(user, g) {
  if (user.role !== 'principal' && user.id !== g.host_id) fail(403, 'Bu yarışmayı yönetme yetkin yok.');
}

// Ekran (öğretmen) ve öğrenci (telefon) için farklı durum: öğrenci soru metnini ve doğru cevabı
// yalnızca gösterim aşamasında görür. Soru metni ve görseli yalnızca öğretmen ekranına gider.
async function liveState(g, user) {
  const isHost = user.role === 'principal' || user.id === g.host_id;
  const { rows: [{ total }] } = await q('select count(*)::int as total from quiz_questions where quiz_id = $1', [g.quiz_id]);
  const { rows: [{ playersCount }] } = await q('select count(*)::int as "playersCount" from live_players where game_id = $1', [g.id]);
  const { rows: leaderboard } = await q(`select u.name, p.score from live_players p join users u on u.id = p.student_id
    where p.game_id = $1 order by p.score desc, u.name limit 10`, [g.id]);
  const qq = g.current_index >= 0 ? await liveQuestion(g.quiz_id, g.current_index) : null;
  const state = {
    id: g.id, status: g.status, quizTitle: g.quiz_title, className: g.class_name, subjectName: g.subject_name,
    total, index: g.current_index, playersCount, serverNow: new Date().toISOString(),
  };
  if (qq && (g.status === 'question' || g.status === 'reveal')) {
    state.timeLimit = qq.timeLimit;
    state.endsAt = new Date(new Date(g.question_started_at).getTime() + qq.timeLimit * 1000).toISOString();
  }
  if (isHost) {
    state.pin = g.pin;
    state.leaderboard = leaderboard;
    if (g.status === 'lobby') {
      const { rows: players } = await q(`select u.name from live_players p join users u on u.id = p.student_id
        where p.game_id = $1 order by p.joined_at limit 80`, [g.id]);
      state.players = players;
    }
    if (qq) {
      state.question = {
        text: qq.text, options: qq.options, points: qq.points,
        imageUrl: qq.hasImage ? `/api/files/quiz-question/${qq.id}` : null,
        correctIndex: g.status === 'reveal' ? qq.correctIndex : null,
      };
      const { rows: [{ answered }] } = await q('select count(*)::int as answered from live_answers where game_id = $1 and question_index = $2', [g.id, g.current_index]);
      state.answered = answered;
      const { rows: counts } = await q('select selected, count(*)::int as n from live_answers where game_id = $1 and question_index = $2 group by selected', [g.id, g.current_index]);
      state.breakdown = qq.options.map((_, i) => counts.find(c => c.selected === i)?.n || 0);
    }
    return state;
  }
  const { rows: [me] } = await q('select score from live_players where game_id = $1 and student_id = $2', [g.id, user.id]);
  const { rows: [{ rank }] } = await q('select (count(*) + 1)::int as rank from live_players where game_id = $1 and score > $2', [g.id, me.score]);
  state.score = me.score;
  state.rank = rank;
  state.leaderboard = leaderboard.slice(0, 5).map(({ name, score }) => ({ name, score }));
  if (qq && (g.status === 'question' || g.status === 'reveal')) {
    state.options = qq.options;
    const { rows: [mine] } = await q('select selected, correct, points from live_answers where game_id = $1 and question_index = $2 and student_id = $3', [g.id, g.current_index, user.id]);
    state.answered = Boolean(mine);
    state.myCorrect = mine ? mine.correct : null;
    state.myPoints = mine ? mine.points : 0;
    if (g.status === 'reveal') state.correctIndex = qq.correctIndex;
  }
  return state;
}

// Canlı durum önbelleği: aynı yarışmayı çok sayıda telefon yoklarken veritabanı yükünü 1 saniyeye indirir.
const liveCache = new Map();
function invalidateLive(gameId) {
  for (const key of liveCache.keys()) if (key.startsWith(`${gameId}:`)) liveCache.delete(key);
}

// Yarışma başlatma: öğretmen (kendi sınavı) ya da müdür. Sınıfın öğrencilerine bildirim gider.
on('POST', '/api/live', async ({ body, user }) => {
  const quizId = requireId(body.quizId, 'sınav');
  const quiz = await loadQuiz(quizId);
  if (!(await canTeach(user, quiz.class_id, quiz.subject_id))) fail(403, 'Bu sınav için yarışma başlatma yetkin yok.');
  const { rows: [{ n }] } = await q('select count(*)::int as n from quiz_questions where quiz_id = $1', [quizId]);
  if (!n) fail(400, 'Yarışma için en az bir soru olmalı.');
  const { rows: [{ textCount }] } = await q("select count(*)::int as \"textCount\" from quiz_questions where quiz_id = $1 and kind = 'text'", [quizId]);
  if (textCount) fail(400, 'Açık uçlu soru içeren sınavlar canlı yarışmada kullanılamaz.');
  const pin = await newLivePin();
  const { rows: [row] } = await q('insert into live_games (quiz_id, class_id, host_id, pin) values ($1, $2, $3, $4) returning id', [quizId, quiz.class_id, user.id, pin]);
  const { rows: students } = await q('select student_id from enrollments where class_id = $1', [quiz.class_id]);
  push.notify(students.map(s => s.student_id), { title: 'Canlı yarışma başladı', body: `${quiz.title} · PIN: ${pin}`, url: '/#/canli', tag: `live-${row.id}` }).catch(() => {});
  return created({ id: row.id, pin });
}, { roles: STAFF });

on('GET', '/api/live/active', async ({ user }) => {
  const { rows } = await q(`select g.id, g.status, qz.title as "quizTitle", s.name as "subjectName", c.name as "className"
    from live_games g join quizzes qz on qz.id = g.quiz_id join subjects s on s.id = qz.subject_id join classes c on c.id = g.class_id
    where g.status <> 'finished' and g.class_id in (select class_id from enrollments where student_id = $1)
    order by g.created_at desc limit 5`, [user.id]);
  return ok({ games: rows });
}, { roles: STUDENT });

on('POST', '/api/live/join', async ({ body, user }) => {
  const pin = String(body.pin ?? '').trim();
  if (!/^\d{6}$/.test(pin)) fail(400, 'PIN 6 haneli bir sayı olmalı.');
  const { rows: [g] } = await q("select id, class_id from live_games where pin = $1 and status <> 'finished'", [pin]);
  if (!g) fail(404, 'Bu PIN ile açık bir yarışma yok.');
  if (!(await enrolledIn(user.id, g.class_id))) fail(403, 'Bu yarışma sizin sınıfınız için değil.');
  await q('insert into live_players (game_id, student_id) values ($1, $2) on conflict do nothing', [g.id, user.id]);
  invalidateLive(g.id);
  return ok({ id: g.id });
}, { roles: STUDENT });

on('GET', '/api/live/:id/state', async ({ params, user }) => {
  const g = await liveGame(requireId(params.id, 'yarışma'));
  if (user.role !== 'principal' && user.id !== g.host_id) {
    if (user.role !== 'student') fail(403, 'Bu yarışmayı görme yetkin yok.');
    const { rowCount } = await q('select 1 from live_players where game_id = $1 and student_id = $2', [g.id, user.id]);
    if (!rowCount) fail(403, 'Bu yarışmaya katılmadınız.');
  }
  const cacheKey = `${g.id}:${user.role === 'principal' || user.id === g.host_id ? 'host' : user.id}`;
  const hit = liveCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 1000) return ok(hit.state);
  const state = await liveState(g, user);
  liveCache.set(cacheKey, { at: Date.now(), state });
  return ok(state);
});

// Ekran denetimi: başlat, cevabı göster, sonraki soru, bitir
function liveHostAction(name, allowedStatuses, run) {
  on('POST', `/api/live/:id/${name}`, async ({ params, user }) => {
    const g = await liveGame(requireId(params.id, 'yarışma'));
    requireLiveHost(user, g);
    if (!allowedStatuses.includes(g.status)) fail(400, 'Bu işlem şu anki aşamada yapılamaz.');
    await run(g);
    invalidateLive(g.id);
    return ok(await liveState(await liveGame(g.id), user));
  }, { roles: STAFF });
}
liveHostAction('start', ['lobby'], async g => {
  await q("update live_games set status = 'question', current_index = 0, question_started_at = now() where id = $1", [g.id]);
});
liveHostAction('reveal', ['question'], async g => {
  await q("update live_games set status = 'reveal' where id = $1", [g.id]);
});
liveHostAction('next', ['reveal'], async g => {
  const { rows: [{ total }] } = await q('select count(*)::int as total from quiz_questions where quiz_id = $1', [g.quiz_id]);
  if (g.current_index + 1 < total) {
    await q("update live_games set status = 'question', current_index = current_index + 1, question_started_at = now() where id = $1", [g.id]);
  } else {
    await finishLive(g);
  }
});
liveHostAction('end', ['lobby', 'question', 'reveal'], async g => {
  await finishLive(g);
});

// Öğrenci cevabı: süre içinde, bir kez. Puan: doğru cevap 500-1000 arası (hız bonusu), yanlış 0.
on('POST', '/api/live/:id/answer', async ({ params, body, user }) => {
  const g = await liveGame(requireId(params.id, 'yarışma'));
  if (g.status !== 'question') fail(400, 'Şu anda cevap verilemez.');
  const qq = await liveQuestion(g.quiz_id, g.current_index);
  const limitMs = qq.timeLimit * 1000;
  const elapsed = Date.now() - new Date(g.question_started_at).getTime();
  if (elapsed > limitMs + LIVE_TOLERANCE_MS) fail(400, 'Süre doldu.');
  const selected = body.selected;
  if (!Number.isInteger(selected) || selected < 0 || selected >= qq.options.length) fail(400, 'Seçilen şık geçersiz.');
  const { rowCount: joined } = await q('select 1 from live_players where game_id = $1 and student_id = $2', [g.id, user.id]);
  if (!joined) fail(403, 'Bu yarışmaya katılmadınız.');
  const correct = selected === qq.correctIndex;
  const points = correct ? Math.max(500, Math.round(1000 - (Math.min(elapsed, limitMs) / limitMs) * 500)) : 0;
  const saved = await tx(async client => {
    const { rowCount } = await client.query(`insert into live_answers (game_id, question_index, student_id, selected, correct, points)
      values ($1, $2, $3, $4, $5, $6) on conflict do nothing`, [g.id, g.current_index, user.id, selected, correct, points]);
    if (!rowCount) return false;
    await client.query('update live_players set score = score + $3 where game_id = $1 and student_id = $2', [g.id, user.id, points]);
    return true;
  });
  invalidateLive(g.id);
  if (!saved) fail(409, 'Bu soruya zaten cevap verdiniz.');
  return ok({ correct, points });
}, { roles: STUDENT });

// Soru görseli: yetkili kişiler (sınavı görebilenler) için satır içi PNG/JPG
on('GET', '/api/files/quiz-question/:id', async ({ params, user }) => {
  const id = requireId(params.id, 'soru');
  const { rows: [row] } = await q(`select qq.image_path, qq.image_mime, qq.image_name, qz.class_id, qz.subject_id, qz.published
    from quiz_questions qq join quizzes qz on qz.id = qq.quiz_id where qq.id = $1`, [id]);
  if (!row || !row.image_path) fail(404, 'Görsel bulunamadı.');
  if (!(await quizAccess(user, row))) fail(403, 'Bu görsele erişim yetkin yok.');
  const result = await fileOf(row.image_path, row.image_mime, row.image_name);
  result.file.inline = true;
  return result;
});

// Bildirim aboneliği (Web Push). Anahtar sunucuda üretilir; abonelik tarayıcının verdiği uçtur.
on('GET', '/api/push/key', async () => ok({ publicKey: push.publicKey() }));

on('POST', '/api/push/subscribe', async ({ body, user }) => {
  const sub = body.subscription && typeof body.subscription === 'object' ? body.subscription : {};
  const endpoint = str(sub.endpoint, 500);
  const p256dh = str(sub.keys?.p256dh, 200);
  const auth = str(sub.keys?.auth, 100);
  if (!endpoint.startsWith('https://') || !p256dh || !auth) fail(400, 'Bildirim aboneliği geçersiz.');
  await q(`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`, [user.id, endpoint, p256dh, auth]);
  return created({ subscribed: true });
});

on('POST', '/api/push/unsubscribe', async ({ body, user }) => {
  await q('delete from push_subscriptions where endpoint = $1 and user_id = $2', [str(body.endpoint, 500), user.id]);
  return ok({ removed: true });
});

on('POST', '/api/push/test', async ({ user }) => {
  await push.notify([user.id], { title: 'Okulum', body: 'Bildirimler çalışıyor.', url: '/#/overview', tag: 'test' });
  return ok({ sent: true });
});

// ---------- Yedekleme (v19): yalnızca müdür ----------
on('GET', '/api/backups', async () => ok({ backups: await listBackups() }), { roles: ['principal'] });

on('POST', '/api/backups/run', async ({ user }) => {
  const backup = await runBackup('elle');
  await audit(user, 'backup_created', backup.path, { sizeBytes: backup.sizeBytes, encrypted: backup.encrypted });
  return created(backup);
}, { roles: ['principal'] });

on('GET', '/api/backups/:id/download', async ({ params }) => {
  const backup = await readBackup(requireId(params.id, 'yedek'));
  if (!backup) fail(404, 'Yedek bulunamadı.');
  return { file: { buffer: backup.buffer, mime: 'application/octet-stream', name: backup.name } };
}, { roles: ['principal'] });

// ---------- Güvenlik ve veri hakları (v20) ----------
const RESET_MINUTES = 15;
const resetCodeHash = (code, userId) => crypto.createHmac('sha256', process.env.SESSION_SECRET || 'gelistirme-anahtari').update(`${userId}:${code}`).digest('hex');

function requestOrigin(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http');
  return `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}

// Şifremi unuttum: e-posta adresi kayıtlıysa 15 dakika geçerli 6 haneli kod gönderilir. Yanıt her durumda aynıdır.
on('POST', '/api/password/forgot', async ({ body }) => {
  if (!mail.configured()) fail(503, 'E-posta ile şifre sıfırlama kapalı. Lütfen okul müdürünüze başvurun.');
  const generic = { sent: true, message: 'Bu adresle kayıtlı bir hesap varsa sıfırlama kodu gönderildi.' };
  const email = str(body.email, 120).toLowerCase();
  if (!email) return ok(generic);
  const { rows: [user] } = await q('select id, name from users where lower(email) = $1', [email]);
  if (!user) return ok(generic);
  const { rows: [{ recent }] } = await q(`select count(*)::int as recent from password_resets where user_id = $1 and created_at > now() - interval '15 minutes'`, [user.id]);
  if (recent >= 3) return ok(generic);
  const code = String(crypto.randomInt(100000, 1000000));
  await tx(async client => {
    await client.query('delete from password_resets where user_id = $1', [user.id]);
    await client.query(`insert into password_resets (user_id, code_hash, expires_at) values ($1, $2, now() + interval '15 minutes')`, [user.id, resetCodeHash(code, user.id)]);
  });
  await mail.send({
    to: email,
    subject: 'Okulum şifre sıfırlama kodu',
    text: `Merhaba ${user.name},\n\nŞifre sıfırlama kodunuz: ${code}\nKod ${RESET_MINUTES} dakika geçerlidir.\n\nBu isteği siz yapmadıysanız bu e-postayı yok sayın.`,
  }).catch(error => console.error('E-posta gönderilemedi:', error.message));
  return ok(generic);
}, { auth: false });

// Kodu doğrular (en fazla 5 deneme), yeni şifreyi kaydeder ve tüm eski oturumları düşürür.
on('POST', '/api/password/reset', async ({ body }) => {
  const email = str(body.email, 120).toLowerCase();
  const code = String(body.code ?? '').trim();
  const invalid = () => fail(400, 'Kod hatalı veya süresi dolmuş.');
  const { rows: [user] } = await q('select id from users where lower(email) = $1', [email]);
  if (!user) invalid();
  const { rows: [reset] } = await q('select id, code_hash, attempts from password_resets where user_id = $1 and expires_at > now() order by created_at desc limit 1', [user.id]);
  if (!reset) invalid();
  if (reset.attempts >= 5) fail(429, 'Çok fazla hatalı deneme. Yeni kod isteyin.');
  if (reset.code_hash !== resetCodeHash(code, user.id)) {
    await q('update password_resets set attempts = attempts + 1 where id = $1', [reset.id]);
    invalid();
  }
  const hash = await sec.hashPasswordAsync(checkPassword(body.password));
  await tx(async client => {
    await client.query('update users set password_hash = $2, session_version = session_version + 1 where id = $1', [user.id, hash]);
    await client.query('delete from password_resets where user_id = $1', [user.id]);
  });
  await audit({ id: user.id, name: 'Şifre sıfırlama', role: 'system' }, 'password_reset', email, {});
  return ok({ reset: true });
}, { auth: false });

on('POST', '/api/me/email', async ({ body, user }) => {
  const email = str(body.email, 120).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail(400, 'E-posta adresi geçersiz.');
  try {
    await q('update users set email = $2 where id = $1', [user.id, email || null]);
  } catch (error) {
    if (error.code === '23505') fail(409, 'Bu e-posta adresi başka bir hesapta kayıtlı.');
    throw error;
  }
  return ok({ email: email || null });
});

// İki adımlı doğrulama (yalnızca müdür hesapları)
on('POST', '/api/me/2fa/setup', async ({ user }) => {
  if (user.role !== 'principal') fail(403, 'İki adımlı doğrulama şimdilik müdür hesapları için.');
  const { rows: [me] } = await q('select totp_enabled from users where id = $1', [user.id]);
  if (me.totp_enabled) fail(409, 'İki adımlı doğrulama zaten açık. Önce kapatın.');
  const secret = mfa.newSecret();
  await q('update users set totp_secret = $2 where id = $1', [user.id, mfa.sealSecret(secret)]);
  return ok({ secret, uri: mfa.otpauthUri(secret, user.username || user.name) });
}, { roles: ['principal'] });

on('POST', '/api/me/2fa/enable', async ({ body, user }) => {
  const { rows: [me] } = await q('select totp_secret, totp_enabled from users where id = $1', [user.id]);
  if (!me?.totp_secret) fail(400, 'Önce kurulumu başlatın.');
  if (me.totp_enabled) fail(409, 'İki adımlı doğrulama zaten açık.');
  if (!mfa.verifyTotp(mfa.openSecret(me.totp_secret), body.code)) fail(400, 'Doğrulama kodu hatalı.');
  await q('update users set totp_enabled = true where id = $1', [user.id]);
  await audit(user, 'mfa_enabled', user.username || user.name, {});
  return ok({ enabled: true });
}, { roles: ['principal'] });

on('POST', '/api/me/2fa/disable', async ({ body, user }) => {
  const { rows: [me] } = await q('select password_hash, totp_secret, totp_enabled from users where id = $1', [user.id]);
  if (!me?.totp_enabled) fail(400, 'İki adımlı doğrulama açık değil.');
  if (!(await sec.verifyPasswordAsync(typeof body.password === 'string' ? body.password : '', me.password_hash))) fail(401, 'Parola hatalı.');
  if (!mfa.verifyTotp(mfa.openSecret(me.totp_secret), body.code)) fail(400, 'Doğrulama kodu hatalı.');
  await q('update users set totp_enabled = false, totp_secret = null where id = $1', [user.id]);
  await audit(user, 'mfa_disabled', user.username || user.name, {});
  return ok({ enabled: false });
}, { roles: ['principal'] });

// KVKK aydınlatma metni: onay ve sürüm takibi
on('GET', '/api/kvkk', async ({ user }) => {
  const { rows: [row] } = await q('select 1 from kvkk_consents where user_id = $1 and version = $2', [user.id, KVKK_VERSION]);
  return ok({ notice: KVKK_NOTICE, accepted: Boolean(row) });
});

on('POST', '/api/kvkk/accept', async ({ body, user }) => {
  if (body.version !== KVKK_VERSION) fail(400, 'Aydınlatma metni sürümü güncel değil. Sayfayı yenileyin.');
  await q('insert into kvkk_consents (user_id, version) values ($1, $2) on conflict do nothing', [user.id, KVKK_VERSION]);
  return created({ accepted: true });
});

// Erişim hakkı: kişinin hakkındaki verilerin dökümü (JSON)
on('GET', '/api/me/export', async ({ user }) => {
  const id = user.id;
  const data = {
    exportedAt: new Date().toISOString(),
    profile: (await q('select name, username, role, student_no as "studentNo", email, created_at as "createdAt" from users where id = $1', [id])).rows[0] || null,
    classes: (await q('select c.name as "className" from enrollments e join classes c on c.id = e.class_id where e.student_id = $1', [id])).rows,
    attendance: (await q('select sj.name as "subjectName", a.lesson_date as date, a.present from attendance a join subjects sj on sj.id = a.subject_id where a.student_id = $1 order by a.lesson_date', [id])).rows,
    behaviorPoints: (await q('select points, reason, created_at as "createdAt" from behavior_points where student_id = $1', [id])).rows,
    teacherNotes: (await q('select body, created_at as "createdAt" from student_notes where student_id = $1', [id])).rows,
    quizResults: (await q('select qz.title, a.score, a.max_score as "maxScore", a.submitted_at as "submittedAt" from quiz_attempts a join quizzes qz on qz.id = a.quiz_id where a.student_id = $1', [id])).rows,
    messagesSent: (await q('select body, created_at as "createdAt" from messages where sender_id = $1 order by created_at', [id])).rows,
    assistantChats: (await q('select c.title, m.role, m.content, m.created_at as "createdAt" from ai_messages m join ai_conversations c on c.id = m.conversation_id where c.user_id = $1 order by m.created_at', [id])).rows,
    consents: (await q('select version, accepted_at as "acceptedAt" from kvkk_consents where user_id = $1', [id])).rows,
  };
  await audit(user, 'data_exported', user.username || user.name, {});
  return { file: { buffer: Buffer.from(JSON.stringify(data, null, 2), 'utf8'), mime: 'application/json; charset=utf-8', name: 'verilerim.json' } };
});

// Silme talebi: müdür onaylayınca hesap anonimleştirilir (kayıtlar kalır, kişi tanımlanamaz hâle gelir)
async function anonymizeUser(userId) {
  await tx(async client => {
    await client.query('delete from push_subscriptions where user_id = $1', [userId]);
    await client.query('delete from ai_messages where conversation_id in (select id from ai_conversations where user_id = $1)', [userId]);
    await client.query('delete from ai_conversations where user_id = $1', [userId]);
    await client.query('delete from ai_consents where user_id = $1', [userId]);
    await client.query('delete from kvkk_consents where user_id = $1', [userId]);
    await client.query('delete from parent_links where parent_id = $1 or student_id = $1', [userId]);
    await client.query("update messages set body = '[silindi]' where sender_id = $1", [userId]);
    const passwordHash = await sec.hashPasswordAsync(crypto.randomBytes(24).toString('hex'));
    await client.query(`update users set name = 'Silinmiş kullanıcı', username = $2, password_hash = $3, email = null, student_no = null,
      calendar_token = null, totp_enabled = false, totp_secret = null, session_version = session_version + 1 where id = $1`,
    [userId, `silindi-${userId.slice(0, 8)}`, passwordHash]);
  });
}

on('POST', '/api/me/delete-request', async ({ user }) => {
  if (user.role === 'principal') fail(403, 'Müdür hesabı için silme talebini başka bir müdür değerlendirir. Lütfen okul yönetimiyle görüşün.');
  const { rows: [pending] } = await q("select 1 from deletion_requests where user_id = $1 and status = 'bekliyor'", [user.id]);
  if (pending) fail(409, 'Bekleyen bir silme talebiniz zaten var.');
  await q('insert into deletion_requests (user_id, user_name) values ($1, $2)', [user.id, user.name]);
  return created({ requested: true });
});

on('GET', '/api/deletion-requests', async () => {
  const { rows } = await q('select id, user_name as "userName", status, created_at as "createdAt", decided_at as "decidedAt" from deletion_requests order by created_at desc limit 100');
  return ok({ requests: rows });
}, { roles: ['principal'] });

on('POST', '/api/deletion-requests/:id/decide', async ({ params, body, user }) => {
  const id = requireId(params.id, 'talep');
  const { rows: [item] } = await q('select user_id, status from deletion_requests where id = $1', [id]);
  if (!item || item.status !== 'bekliyor') fail(404, 'Bekleyen talep bulunamadı.');
  if (item.user_id === user.id) fail(403, 'Kendi talebinizi değerlendiremezsiniz.');
  const approve = body.approve === true;
  if (approve && item.user_id) await anonymizeUser(item.user_id);
  await q('update deletion_requests set status = $2, decided_at = now() where id = $1', [id, approve ? 'onaylandi' : 'reddedildi']);
  await audit(user, approve ? 'deletion_approved' : 'deletion_rejected', id, {});
  return ok({ status: approve ? 'onaylandi' : 'reddedildi' });
}, { roles: ['principal'] });

// Takvim bağlantısı (ICS): Google/Apple/Outlook takvimine abone olunabilen kişisel adres
on('POST', '/api/me/calendar-link', async ({ user, req }) => {
  const { rows: [row] } = await q('select calendar_token from users where id = $1', [user.id]);
  let token = row.calendar_token;
  if (!token) {
    token = crypto.randomBytes(24).toString('hex');
    await q('update users set calendar_token = $2 where id = $1', [user.id, token]);
  }
  return ok({ url: `${requestOrigin(req)}/api/calendar/feed/${token}.ics` });
});

async function feedItems(user) {
  const from = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10);
  const classIds = await visibleClassIds(user);
  const { rows: events } = await q(`select e.id, e.title, to_char(e.event_date, 'YYYY-MM-DD') as date, e.description from school_events e
    where e.event_date between $1 and $2 and ($3::uuid[] is null or e.class_id is null or e.class_id = any($3::uuid[]))`, [from, to, classIds]);
  const { rows: tasks } = await q(`select a.id, a.title, to_char((a.due_at at time zone 'Europe/Istanbul')::date, 'YYYY-MM-DD') as date from assignments a
    where a.due_at is not null and (a.due_at at time zone 'Europe/Istanbul')::date between $1 and $2 and ($3::uuid[] is null or a.class_id = any($3::uuid[]))`, [from, to, classIds]);
  return [
    ...events.map(e => ({ uid: `e-${e.id}`, date: e.date, summary: e.title, description: e.description || '' })),
    ...tasks.map(t => ({ uid: `o-${t.id}`, date: t.date, summary: `Ödev teslimi: ${t.title}`, description: '' })),
  ];
}

function buildIcs(items) {
  const escape = value => String(value).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const nextDay = date => new Date(Date.parse(date) + 864e5).toISOString().slice(0, 10).replace(/-/g, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Okulum//TR//TR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const item of items) {
    lines.push('BEGIN:VEVENT', `UID:${item.uid}@okulum`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${item.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${nextDay(item.date)}`,
      `SUMMARY:${escape(item.summary)}`, `DESCRIPTION:${escape(item.description)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

on('GET', '/api/calendar/feed/:file', async ({ params }) => {
  const token = String(params.file || '').replace(/\.ics$/i, '');
  if (!/^[a-f0-9]{48}$/.test(token)) fail(404, 'Takvim bulunamadı.');
  const { rows: [owner] } = await q('select id, role from users where calendar_token = $1', [token]);
  if (!owner) fail(404, 'Takvim bulunamadı.');
  const ics = buildIcs(await feedItems(owner));
  return { file: { buffer: Buffer.from(ics, 'utf8'), mime: 'text/calendar; charset=utf-8', name: 'okulum.ics', inline: true } };
}, { auth: false });

// Müdür analizi: sınıf bazında devam oranı, sınav ortalaması ve en çok devamsızlığı olan öğrenciler (son 30 gün)
on('GET', '/api/analytics/school', async () => {
  const { rows: classes } = await q(`select c.id, c.name, count(e.student_id)::int as students from classes c
    left join enrollments e on e.class_id = c.id group by c.id, c.name order by length(c.name), c.name`);
  const { rows: attendance } = await q(`select class_id as "classId", count(*)::int as total, count(*) filter (where present)::int as present
    from attendance where lesson_date >= current_date - 30 group by class_id`);
  const { rows: quizzes } = await q(`select qz.class_id as "classId", count(*)::int as attempts,
    avg(100.0 * a.score / nullif(a.max_score, 0))::float as average from quiz_attempts a join quizzes qz on qz.id = a.quiz_id
    where a.submitted_at is not null and a.graded group by qz.class_id`);
  const { rows: topAbsent } = await q(`select u.name as "studentName", c.name as "className", count(*) filter (where not a.present)::int as absences,
    count(*)::int as total from attendance a join users u on u.id = a.student_id join classes c on c.id = a.class_id
    where a.lesson_date >= current_date - 30 group by u.name, c.name having count(*) filter (where not a.present) > 0
    order by absences desc, u.name limit 10`);
  const byClass = (rows, key) => Object.fromEntries(rows.map(r => [r[key], r]));
  const att = byClass(attendance, 'classId');
  const quiz = byClass(quizzes, 'classId');
  const school = attendance.reduce((acc, r) => ({ total: acc.total + r.total, present: acc.present + r.present }), { total: 0, present: 0 });
  return ok({
    schoolAttendanceRate: school.total ? Math.round((school.present / school.total) * 100) : null,
    classes: classes.map(c => ({
      ...c,
      attendanceRate: att[c.id]?.total ? Math.round((att[c.id].present / att[c.id].total) * 100) : null,
      quizAverage: quiz[c.id]?.average != null ? Math.round(quiz[c.id].average) : null,
    })),
    topAbsent,
  });
}, { roles: ['principal'] });

// ---------- Veli haftalık özeti (v21) ----------
// Son 7 gün devam ve davranış, önümüzdeki 7 gün ödev durumu; her velinin cihazlarına push bildirimi olarak gider.
async function sendWeeklyDigest() {
  const { rows: links } = await q(`select pl.parent_id, pl.student_id, u.name as "studentName"
    from parent_links pl join users u on u.id = pl.student_id`);
  let sent = 0;
  for (const link of links) {
    const { rows: [att] } = await q(`select count(*)::int as total, count(*) filter (where not present)::int as absent
      from attendance where student_id = $1 and lesson_date >= current_date - 7`, [link.student_id]);
    const { rows: [beh] } = await q(`select coalesce(sum(points), 0)::int as points from behavior_points
      where student_id = $1 and created_at >= now() - interval '7 days'`, [link.student_id]);
    const { rows: [hw] } = await q(`select count(*)::int as due, count(*) filter (where s.id is null)::int as missing
      from assignments a join enrollments e on e.class_id = a.class_id and e.student_id = $1
      left join submissions s on s.assignment_id = a.id and s.student_id = $1
      where a.due_at between now() and now() + interval '7 days'`, [link.student_id]);
    const parts = [
      att.total ? `devam ${att.total - att.absent}/${att.total} ders` : 'bu hafta yoklama yok',
      `davranış ${beh.points > 0 ? '+' : ''}${beh.points} puan`,
      hw.due ? `önümüzdeki hafta ${hw.due} ödev${hw.missing ? `, ${hw.missing} tanesi henüz teslim edilmedi` : ''}` : 'önümüzdeki hafta ödev yok',
    ];
    push.notify([link.parent_id], { title: `Haftalık özet · ${link.studentName}`, body: parts.join(' · '), url: '/#/cocuklar', tag: `ozet-${link.student_id}-${new Date().toISOString().slice(0, 10)}` }).catch(() => {});
    sent += 1;
  }
  return sent;
}

// Her Pazar 17:00'den sonra (İstanbul saatiyle) bir kez gönderilir; saatte bir kontrol edilir.
function istanbulNow(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false })
    .formatToParts(date).map(p => [p.type, p.value]));
  return { weekday: parts.weekday, day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

function startDigestSchedule() {
  const tick = async () => {
    const now = istanbulNow(new Date());
    if (now.weekday !== 'Sun' || now.hour < 17) return;
    const { rows: [last] } = await q("select value from app_settings where key = 'digest_last'");
    if (last?.value === now.day) return;
    await q(`insert into app_settings (key, value) values ('digest_last', $1) on conflict (key) do update set value = excluded.value`, [now.day]);
    await sendWeeklyDigest();
  };
  const safeTick = () => tick().catch(error => console.error('Haftalık özet hatası:', error.message));
  setTimeout(safeTick, 2 * 60 * 1000).unref();
  setInterval(safeTick, 30 * 60 * 1000).unref();
}

on('POST', '/api/digest/run', async () => ok({ sent: await sendWeeklyDigest() }), { roles: ['principal'] });

// E-posta durumu ve test gönderimi (müdür). Test, müdürün kendi adresine gider.
on('GET', '/api/mail/status', async () => ok({
  configured: mail.configured(),
  mode: process.env.MAIL_OUTBOX_FILE ? 'test' : (process.env.SMTP_HOST ? 'smtp' : 'kapalı'),
}), { roles: ['principal'] });

on('POST', '/api/mail/test', async ({ user }) => {
  if (!mail.configured()) fail(503, 'E-posta gönderimi ayarlı değil. SMTP bilgilerini Render ortam değişkenlerine ekleyin.');
  const { rows: [me] } = await q('select email from users where id = $1', [user.id]);
  if (!me?.email) fail(400, 'Önce kendi hesabınıza bir e-posta adresi ekleyin.');
  try {
    await mail.send({ to: me.email, subject: 'Okulum test e-postası', text: 'Bu bir test e-postasıdır. E-posta gönderimi çalışıyor.' });
  } catch (error) {
    fail(502, `E-posta gönderilemedi (${error.code || 'bağlantı hatası'}). SMTP bilgilerini kontrol edin.`);
  }
  return ok({ sent: true, to: me.email });
}, { roles: ['principal'] });

// ---------- Karne PDF ve ödev hatırlatması (v23) ----------
async function studentReportData(studentId) {
  const { rows: [student] } = await q(`select u.id, u.name, u.student_no as "studentNo", c.name as "className"
    from users u left join enrollments e on e.student_id = u.id left join classes c on c.id = e.class_id
    where u.id = $1 and u.role = 'student'`, [studentId]);
  if (!student) fail(404, 'Öğrenci bulunamadı.');
  const behavior = await behaviorFor(studentId);
  const { rows: notes } = await q(`select n.body, n.created_at as "createdAt", u.name as "teacherName"
    from student_notes n left join users u on u.id = n.teacher_id where n.student_id = $1 and n.shared_with_parent
    order by n.created_at desc limit 20`, [studentId]);
  return {
    student,
    generatedAt: new Date().toISOString(),
    grades: await gradeSummaryFor(studentId),
    attendance: await attendanceSummaryFor(studentId),
    behavior: { total: behavior.total, positive: behavior.positive, negative: behavior.negative, badges: behavior.badges },
    notes,
  };
}

function buildReportPdf(report) {
  return new Promise(resolve => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Karne · ${report.student.name}`, Author: 'Okulum' } });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.registerFont('regular', FONT_REGULAR).registerFont('bold', FONT_BOLD);
    const ensureSpace = height => { if (doc.y + height > 770) doc.addPage(); };
    const heading = title => {
      ensureSpace(40);
      doc.moveDown(0.6).font('bold').fontSize(12).fillColor('#1b6b50').text(title);
      doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).lineWidth(0.6).strokeColor('#1b6b50').stroke();
      doc.moveDown(0.6).fillColor('#000000');
    };
    const row = (cells, widths, bold = false) => {
      ensureSpace(20);
      const y = doc.y;
      let x = 50;
      doc.font(bold ? 'bold' : 'regular').fontSize(10);
      cells.forEach((cell, i) => {
        doc.text(String(cell ?? '—'), x + 4, y, { width: widths[i] - 8, lineBreak: false, ellipsis: true });
        x += widths[i];
      });
      doc.y = y + 18;
    };
    const dateTr = value => new Date(value).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
    doc.font('bold').fontSize(18).fillColor('#1b6b50').text('Öğrenci Karnesi');
    doc.font('regular').fontSize(11).fillColor('#000000').moveDown(0.3)
      .text(`${report.student.name} · ${report.student.className || 'Sınıfsız'} · Okul no: ${report.student.studentNo || '—'}`);
    doc.fontSize(9).fillColor('#555555').text(`Oluşturulma: ${new Date(report.generatedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}`);
    doc.fillColor('#000000');
    heading('Derslere göre başarı');
    const gradeWidths = [250, 120, 125];
    row(['Ders', 'Not sayısı', 'Ortalama'], gradeWidths, true);
    if (!report.grades.subjects.length) doc.font('regular').fontSize(10).text('Henüz not yok.');
    for (const s of report.grades.subjects) row([s.subjectName, s.count, s.average], gradeWidths);
    heading('Devam');
    const attWidths = [200, 110, 110, 90];
    row(['Ders', 'Toplam ders', 'Geldi', 'Devam'], attWidths, true);
    if (!report.attendance.subjects.length) doc.font('regular').fontSize(10).text('Henüz yoklama yok.');
    for (const s of report.attendance.subjects) {
      row([s.subjectName, s.total, s.present, s.total ? `%${Math.round((s.present / s.total) * 100)}` : '—'], attWidths);
    }
    heading('Davranış');
    doc.font('regular').fontSize(10).text(`Toplam puan: ${report.behavior.total} · Olumlu: ${report.behavior.positive} · Olumsuz: ${report.behavior.negative}`);
    doc.text(`Rozetler: ${report.behavior.badges.length ? report.behavior.badges.join(', ') : 'Henüz rozet yok'}`);
    heading('Öğretmen notları (veliyle paylaşılan)');
    if (!report.notes.length) doc.font('regular').fontSize(10).text('Paylaşılmış not yok.');
    for (const note of report.notes) {
      ensureSpace(40);
      doc.font('bold').fontSize(9).fillColor('#555555').text(`${dateTr(note.createdAt)} · ${note.teacherName || ''}`);
      doc.font('regular').fontSize(10).fillColor('#000000').text(note.body, { width: 495 }).moveDown(0.4);
    }
    doc.end();
  });
}

on('GET', '/api/reports/student/:id/pdf', async ({ params, user }) => {
  const studentId = requireId(params.id, 'öğrenci');
  await requireStudentView(user, studentId);
  const report = await studentReportData(studentId);
  const buffer = await buildReportPdf(report);
  await audit(user, 'report_pdf', report.student.name, {});
  return { file: { buffer, mime: 'application/pdf', name: `karne-${studentId.slice(0, 8)}.pdf` } };
});

// Ödev teslim hatırlatması: 24 saat içinde son teslimi olan ve teslim etmemiş öğrencilere bildirim
async function sendDueReminders() {
  const { rows } = await q(`select a.title, e.student_id from assignments a
    join enrollments e on e.class_id = a.class_id
    left join submissions s on s.assignment_id = a.id and s.student_id = e.student_id
    where a.due_at > now() and a.due_at <= now() + interval '24 hours' and s.id is null`);
  const byStudent = new Map();
  for (const row of rows) byStudent.set(row.student_id, [...(byStudent.get(row.student_id) || []), row.title]);
  for (const [studentId, titles] of byStudent) {
    push.notify([studentId], {
      title: 'Teslim yaklaşıyor',
      body: titles.length === 1 ? `${titles[0]} · son teslim 24 saat içinde` : `${titles.length} ödevin son teslimi 24 saat içinde`,
      url: '/#/assignments',
      tag: `hatirlatma-${studentId}`,
    }).catch(() => {});
  }
  return byStudent.size;
}

// Her gün 18:00'den sonra (İstanbul) bir kez çalışır.
function startReminderSchedule() {
  const tick = async () => {
    const now = istanbulNow(new Date());
    if (now.hour < 18) return;
    const { rows: [last] } = await q("select value from app_settings where key = 'reminder_last'");
    if (last?.value === now.day) return;
    await q(`insert into app_settings (key, value) values ('reminder_last', $1) on conflict (key) do update set value = excluded.value`, [now.day]);
    await sendDueReminders();
  };
  const safeTick = () => tick().catch(error => console.error('Hatırlatma hatası:', error.message));
  setTimeout(safeTick, 3 * 60 * 1000).unref();
  setInterval(safeTick, 30 * 60 * 1000).unref();
}

on('POST', '/api/reminders/run', async () => ok({ students: await sendDueReminders() }), { roles: ['principal'] });

// Seçenek karıştırma: her soru için öğrenciye gösterilen sıra (gösterilen dizin -> özgün dizin).
async function shuffledOrders(quizId) {
  const { rows } = await q('select id, options from quiz_questions where quiz_id = $1', [quizId]);
  return Object.fromEntries(rows.map(question => {
    const order = Array.from({ length: question.options.length }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = crypto.randomInt(i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    return [question.id, order];
  }));
}
// Teslimden önce öğrenci kendi sırasını görür; teslimden sonra özgün sıra gösterilir.
const shownOptions = (question, attempt, finished) => {
  const order = !finished && attempt?.option_order?.[question.id];
  return order ? order.map(i => question.options[i]) : question.options;
};
const originalIndex = (attempt, questionId, shown) => {
  const order = attempt?.option_order?.[questionId];
  return order ? order[shown] : shown;
};

// ---------- Pansiyon: evci ve çarşı izni defteri (v25) ----------
const LEAVE_KINDS = { evci: 'Evci izni', carsi: 'Çarşı izni' };
const LEAVE_SIGNERS = ['ogrenci', 'veli', 'diger'];
const SIGNER_LABEL = { ogrenci: 'Öğrenci', veli: 'Veli', diger: 'Diğer' };

async function boardingOn() {
  const { rows: [row] } = await q("select value from app_settings where key = 'boarding'");
  return row?.value === 'true';
}

async function requireBoarding() {
  if (!(await boardingOn())) fail(400, 'Okul pansiyonlu olarak ayarlanmamış. Müdür pansiyon modunu açabilir.');
}

// İzinleri yönetme yetkisi: müdür, ya da öğrencinin sınıfını okutan öğretmen
async function requireStaffForStudent(user, studentId) {
  if (user.role === 'principal') return;
  if (user.role !== 'teacher') fail(403, 'Bu işlem için yetkin yok.');
  const { rowCount } = await q('select 1 from enrollments e join teaching t on t.class_id = e.class_id where t.teacher_id = $1 and e.student_id = $2 limit 1', [user.id, studentId]);
  if (!rowCount) fail(403, 'Bu öğrencinin izinlerini yönetme yetkin yok.');
}

async function leaveRow(id) {
  const { rows: [row] } = await q(`select l.id, l.student_id, l.kind, l.starts_at, l.ends_at, l.status, l.requested_by,
      u.name as student_name, u.student_no as student_no_value
    from leave_requests l join users u on u.id = l.student_id where l.id = $1`, [id]);
  if (!row) fail(404, 'İzin kaydı bulunamadı.');
  return row;
}

// Bildirimler hiçbir zaman işlemi bozmaz: hata yalnızca günlüğe yazılır.
async function notifyFamily(studentId, payload) {
  try {
    const { rows } = await q('select parent_id from parent_links where student_id = $1', [studentId]);
    await push.notify([studentId, ...rows.map(r => r.parent_id)], payload);
  } catch (error) {
    console.error('İzin bildirimi gönderilemedi:', error.message);
  }
}

async function notifyStaff(studentId, payload) {
  try {
    const { rows } = await q(`select distinct t.teacher_id as id from teaching t join enrollments e on e.class_id = t.class_id where e.student_id = $1
      union select id from users where role = 'principal'`, [studentId]);
    await push.notify(rows.map(r => r.id), payload);
  } catch (error) {
    console.error('İzin bildirimi gönderilemedi:', error.message);
  }
}

// İmza kaydı: imzalayanın adı, soyadı ve e-imza (PNG). Öğrenci imzalıyorsa öğrenci numarası kayıtla eşleşmelidir.
function signatureRecord(body, leave) {
  const signer = LEAVE_SIGNERS.includes(body.signerRole) ? body.signerRole : fail(400, 'İmzalayan kişi türü geçersiz.');
  const name = str(body.name, 60);
  const surname = str(body.surname, 60);
  if (!name || !surname) fail(400, 'İmzalayanın adı ve soyadı zorunlu.');
  const studentNo = str(body.studentNo, 20);
  if (signer === 'ogrenci' && (!studentNo || studentNo.toLowerCase() !== String(leave.student_no_value || '').toLowerCase())) {
    fail(400, 'Öğrenci numarası kayıtla eşleşmiyor.');
  }
  const signature = body.signature;
  if (typeof signature !== 'string' || !signature.startsWith('data:image/png;base64,') || signature.length > 150000) {
    fail(400, 'Geçerli bir e-imza gerekli.');
  }
  return { signer, name, surname, studentNo: studentNo || null, signature };
}

on('GET', '/api/boarding', async () => ok({ enabled: await boardingOn() }));

on('PUT', '/api/boarding', async ({ body, user }) => {
  const enabled = body.enabled === true;
  await q(`insert into app_settings (key, value) values ('boarding', $1) on conflict (key) do update set value = excluded.value`, [String(enabled)]);
  await audit(user, 'boarding_changed', 'pansiyon', { enabled });
  return ok({ enabled });
}, { roles: ['principal'] });

// Talep: öğrenci kendisi, veli bağlı çocuğu adına. Çıkış-dönüş en fazla 14 gün.
on('POST', '/api/leaves', async ({ body, user }) => {
  await requireBoarding();
  const studentId = user.role === 'student' ? user.id : requireId(body.studentId, 'öğrenci');
  if (user.role === 'parent') {
    const { rowCount } = await q('select 1 from parent_links where parent_id = $1 and student_id = $2', [user.id, studentId]);
    if (!rowCount) fail(403, 'Bu öğrenci için izin talep edemezsiniz.');
  }
  if (!Object.hasOwn(LEAVE_KINDS, body.kind)) fail(400, 'İzin türü geçersiz.');
  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) fail(400, 'Çıkış ve dönüş zamanı geçersiz.');
  if (endsAt <= startsAt) fail(400, 'Dönüş zamanı çıkıştan sonra olmalı.');
  if (endsAt - startsAt > 14 * 864e5) fail(400, 'Bir izin en fazla 14 gün olabilir.');
  const reason = str(body.reason, 300);
  const { rows: [row] } = await q(`insert into leave_requests (student_id, kind, starts_at, ends_at, reason, requested_by)
    values ($1, $2, $3, $4, $5, $6) returning id`, [studentId, body.kind, startsAt.toISOString(), endsAt.toISOString(), reason, user.id]);
  const { rows: [student] } = await q('select name from users where id = $1', [studentId]);
  notifyStaff(studentId, { title: 'Yeni izin talebi', body: `${student.name} · ${LEAVE_KINDS[body.kind]} · onayınızı bekliyor`, url: '/#/izin', tag: `izin-talep-${row.id}` });
  return created({ id: row.id });
}, { roles: ['student', 'parent'] });

// Liste: öğrenci ve veli kendi kayıtlarını, öğretmen sınıflarını, müdür hepsini görür.
on('GET', '/api/leaves', async ({ query, user }) => {
  const params = [];
  const conditions = [];
  if (user.role === 'student') {
    params.push(user.id);
    conditions.push(`l.student_id = $${params.length}`);
  } else if (user.role === 'parent') {
    params.push(user.id);
    conditions.push(`l.student_id in (select student_id from parent_links where parent_id = $${params.length})`);
  } else if (user.role === 'teacher') {
    params.push(await visibleClassIds(user));
    conditions.push(`exists (select 1 from enrollments en where en.student_id = l.student_id and en.class_id = any($${params.length}::uuid[]))`);
  }
  const status = query.get('status');
  if (status) {
    params.push(status);
    conditions.push(`l.status = $${params.length}`);
  }
  const where = conditions.length ? conditions.join(' and ') : 'true';
  const { rows } = await q(`select l.id, l.student_id as "studentId", u.name as "studentName", u.student_no as "studentNo", c.name as "className",
      l.kind, l.starts_at as "startsAt", l.ends_at as "endsAt", l.reason, l.status, l.decision_note as "decisionNote", l.requested_by as "requestedBy",
      l.exit_at as "exitAt", l.exit_signer as "exitSigner", l.exit_name as "exitName", l.exit_surname as "exitSurname",
      l.return_at as "returnAt", l.return_signer as "returnSigner", l.return_name as "returnName", l.return_surname as "returnSurname"
    from leave_requests l join users u on u.id = l.student_id
    left join enrollments e on e.student_id = l.student_id left join classes c on c.id = e.class_id
    where ${where} order by l.starts_at desc limit 300`, params);
  const staff = user.role === 'principal' || user.role === 'teacher';
  return ok({
    leaves: rows.map(r => ({
      ...r,
      canDecide: staff && r.status === 'bekliyor',
      canExit: staff && r.status === 'onaylandi',
      canReturn: staff && r.status === 'disarida',
      canCancel: r.status === 'bekliyor' && r.requestedBy === user.id,
    })),
  });
});

on('POST', '/api/leaves/:id/decide', async ({ params, body, user }) => {
  const leave = await leaveRow(requireId(params.id, 'izin'));
  await requireStaffForStudent(user, leave.student_id);
  if (leave.status !== 'bekliyor') fail(400, 'Bu talep zaten karara bağlanmış.');
  const approve = body.approve === true;
  await q('update leave_requests set status = $2, decided_by = $3, decided_at = now(), decision_note = $4 where id = $1',
    [leave.id, approve ? 'onaylandi' : 'reddedildi', user.id, str(body.note, 200)]);
  await audit(user, approve ? 'leave_approved' : 'leave_rejected', leave.student_name, { kind: leave.kind });
  notifyFamily(leave.student_id, { title: approve ? 'İzin onaylandı' : 'İzin reddedildi', body: `${leave.student_name} · ${LEAVE_KINDS[leave.kind]}`, url: '/#/izin', tag: `izin-karar-${leave.id}` });
  return ok({ status: approve ? 'onaylandi' : 'reddedildi' });
}, { roles: STAFF });

on('POST', '/api/leaves/:id/cancel', async ({ params, user }) => {
  const leave = await leaveRow(requireId(params.id, 'izin'));
  if (leave.requested_by !== user.id) fail(403, 'Bu talebi iptal edemezsiniz.');
  if (leave.status !== 'bekliyor') fail(400, 'Yalnızca bekleyen talep iptal edilebilir.');
  await q("update leave_requests set status = 'iptal' where id = $1", [leave.id]);
  return ok({ status: 'iptal' });
}, { roles: ['student', 'parent'] });

// Çıkış: onaylı izin, nöbetçi personel e-imzayı alır. Dönüş: dışarıdaki öğrenci için aynı işlem.
on('POST', '/api/leaves/:id/exit', async ({ params, body, user }) => {
  const leave = await leaveRow(requireId(params.id, 'izin'));
  await requireStaffForStudent(user, leave.student_id);
  if (leave.status !== 'onaylandi') fail(400, 'Çıkış kaydı yalnızca onaylı izin için alınabilir.');
  const sig = signatureRecord(body, leave);
  await q(`update leave_requests set status = 'disarida', exit_at = now(), exit_signer = $2, exit_name = $3, exit_surname = $4,
    exit_student_no = $5, exit_signature = $6, exit_by = $7 where id = $1`, [leave.id, sig.signer, sig.name, sig.surname, sig.studentNo, sig.signature, user.id]);
  await audit(user, 'leave_exit', leave.student_name, { kind: leave.kind, signer: sig.signer });
  notifyFamily(leave.student_id, { title: 'Öğrenci izne çıktı', body: `${leave.student_name} · ${LEAVE_KINDS[leave.kind]} · imzalayan: ${sig.name} ${sig.surname}`, url: '/#/izin', tag: `izin-cikis-${leave.id}` });
  return ok({ status: 'disarida' });
}, { roles: STAFF });

on('POST', '/api/leaves/:id/return', async ({ params, body, user }) => {
  const leave = await leaveRow(requireId(params.id, 'izin'));
  await requireStaffForStudent(user, leave.student_id);
  if (leave.status !== 'disarida') fail(400, 'Dönüş kaydı yalnızca dışarıdaki öğrenci için alınabilir.');
  const sig = signatureRecord(body, leave);
  await q(`update leave_requests set status = 'tamamlandi', return_at = now(), return_signer = $2, return_name = $3, return_surname = $4,
    return_student_no = $5, return_signature = $6, return_by = $7 where id = $1`, [leave.id, sig.signer, sig.name, sig.surname, sig.studentNo, sig.signature, user.id]);
  await audit(user, 'leave_return', leave.student_name, { kind: leave.kind, signer: sig.signer });
  notifyFamily(leave.student_id, { title: 'Öğrenci döndü', body: `${leave.student_name} · dönüş imzası: ${sig.name} ${sig.surname}`, url: '/#/izin', tag: `izin-donus-${leave.id}` });
  return ok({ status: 'tamamlandi' });
}, { roles: STAFF });

// E-imzalar: yalnızca müdür ve ilgili öğretmen görür
on('GET', '/api/leaves/:id/signatures', async ({ params, user }) => {
  const leave = await leaveRow(requireId(params.id, 'izin'));
  await requireStaffForStudent(user, leave.student_id);
  const { rows: [s] } = await q(`select exit_signer as "exitSigner", exit_name as "exitName", exit_surname as "exitSurname",
      exit_student_no as "exitStudentNo", exit_at as "exitAt", exit_signature as "exitSignature",
      return_signer as "returnSigner", return_name as "returnName", return_surname as "returnSurname",
      return_student_no as "returnStudentNo", return_at as "returnAt", return_signature as "returnSignature"
    from leave_requests where id = $1`, [leave.id]);
  return ok(s);
}, { roles: STAFF });

// Defter dışa aktarımı (CSV, Excel uyumlu)
on('GET', '/api/leaves/export', async ({ query, user }) => {
  const from = isoDateParam(query.get('from')) || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const to = isoDateParam(query.get('to')) || new Date().toISOString().slice(0, 10);
  const classIds = await visibleClassIds(user);
  const { rows } = await q(`select u.name as "studentName", u.student_no as "studentNo", c.name as "className", l.kind, l.status,
      l.starts_at as "startsAt", l.exit_at as "exitAt", l.exit_signer as "exitSigner", l.exit_name as "exitName",
      l.exit_surname as "exitSurname", l.exit_student_no as "exitStudentNo", l.return_at as "returnAt",
      l.return_name as "returnName", l.return_surname as "returnSurname"
    from leave_requests l join users u on u.id = l.student_id
    left join enrollments e on e.student_id = l.student_id left join classes c on c.id = e.class_id
    where l.starts_at::date between $1 and $2
      and ($3::uuid[] is null or exists (select 1 from enrollments en where en.student_id = l.student_id and en.class_id = any($3::uuid[])))
    order by l.starts_at`, [from, to, classIds]);
  const cell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const when = value => (value ? new Date(value).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '');
  const lines = ['Öğrenci,Okul no,Sınıf,İzin türü,Başlangıç,Durum,Çıkış zamanı,Çıkışı imzalayan,Çıkış okul no,Dönüş zamanı,Dönüşü imzalayan'];
  for (const r of rows) {
    lines.push([r.studentName, r.studentNo, r.className, LEAVE_KINDS[r.kind], when(r.startsAt), r.status, when(r.exitAt),
      r.exitAt ? `${r.exitName} ${r.exitSurname} (${SIGNER_LABEL[r.exitSigner] || ''})` : '', r.exitStudentNo,
      when(r.returnAt), r.returnAt ? `${r.returnName} ${r.returnSurname}` : ''].map(cell).join(','));
  }
  return { file: { buffer: Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8'), mime: 'text/csv; charset=utf-8', name: `izin-defteri-${from}-${to}.csv` } };
}, { roles: STAFF });

// ---------- Pansiyon: gece yoklaması (v26) ----------
const NIGHT_STATUSES = ['var', 'yok', 'izinli'];

// Gece yoklama penceresi: seçilen günün 21:00'i ile ertesi günün 07:00'si (İstanbul saati)
on('GET', '/api/night-roll', async ({ query, user }) => {
  await requireBoarding();
  const classId = requireId(query.get('classId'), 'sınıf');
  if (user.role !== 'principal' && !(await teachesClass(user, classId))) fail(403, 'Bu sınıfın gece yoklamasını görme yetkin yok.');
  const date = isoDateParam(query.get('date')) || istanbulNow(new Date()).day;
  const { rows: students } = await q(`select u.id, u.name, u.student_no as "studentNo" from enrollments e
    join users u on u.id = e.student_id where e.class_id = $1 order by u.name`, [classId]);
  const ids = students.map(s => s.id);
  const { rows: saved } = await q('select student_id, status from night_roll where roll_date = $1 and student_id = any($2::uuid[])', [date, ids]);
  const { rows: onLeave } = await q(`select distinct student_id from leave_requests
    where status in ('onaylandi', 'disarida') and student_id = any($1::uuid[])
      and starts_at <= (($2::date + time '07:00' + interval '1 day') at time zone 'Europe/Istanbul')
      and ends_at >= (($2::date + time '21:00') at time zone 'Europe/Istanbul')`, [ids, date]);
  const savedMap = new Map(saved.map(r => [r.student_id, r.status]));
  const leaveSet = new Set(onLeave.map(r => r.student_id));
  return ok({
    date,
    students: students.map(s => ({
      ...s,
      status: savedMap.get(s.id) || (leaveSet.has(s.id) ? 'izinli' : null),
      saved: savedMap.has(s.id),
      suggested: !savedMap.has(s.id) && leaveSet.has(s.id) ? 'izinli' : null,
    })),
  });
});

on('PUT', '/api/night-roll', async ({ body, user }) => {
  await requireBoarding();
  const classId = requireId(body.classId, 'sınıf');
  if (user.role !== 'principal' && !(await teachesClass(user, classId))) fail(403, 'Bu sınıfın gece yoklamasını kaydetme yetkin yok.');
  const date = isoDateParam(body.date);
  if (!date) fail(400, 'Tarih geçersiz.');
  if (date > istanbulNow(new Date()).day) fail(400, 'Gelecek bir gün için gece yoklaması alınamaz.');
  const records = body.records && typeof body.records === 'object' ? body.records : {};
  const { rows: enrolled } = await q(`select e.student_id, u.name from enrollments e join users u on u.id = e.student_id where e.class_id = $1`, [classId]);
  const names = new Map(enrolled.map(r => [r.student_id, r.name]));
  const entries = Object.entries(records);
  for (const [studentId, status] of entries) {
    if (!names.has(studentId)) fail(400, 'Seçilen öğrenci bu sınıfta değil.');
    if (!NIGHT_STATUSES.includes(status)) fail(400, 'Geçersiz gece yoklama değeri.');
  }
  await tx(async client => {
    for (const [studentId, status] of entries) {
      await client.query(`insert into night_roll (student_id, roll_date, status, recorded_by) values ($1, $2, $3, $4)
        on conflict (student_id, roll_date) do update set status = excluded.status, recorded_by = excluded.recorded_by, recorded_at = now()`,
      [studentId, date, status, user.id]);
    }
  });
  for (const [studentId, status] of entries) {
    if (status === 'yok') notifyFamily(studentId, { title: 'Gece yoklaması', body: `${names.get(studentId)} gece yoklamasında yoklandı (${date})`, url: '/#/cocuklar', tag: `gece-${studentId}-${date}` });
  }
  await audit(user, 'night_roll_saved', date, { classId, count: entries.length });
  return ok({ saved: entries.length });
});

// Açık uçlu sorular: öğretmen, sınavın tüm teslim edilmiş denemelerindeki metin cevaplarını görür ve puanlar
on('GET', '/api/quizzes/:id/grading', async ({ params, user }) => {
  const quiz = await loadQuiz(requireId(params.id, 'sınav'));
  if ((await quizAccess(user, quiz)) !== 'full') fail(403, 'Bu sınavı değerlendirme yetkin yok.');
  const { rows: questions } = await q("select id, position, text, points from quiz_questions where quiz_id = $1 and kind = 'text' order by position", [quiz.id]);
  if (!questions.length) return ok({ questions: [], attempts: [] });
  const { rows: attempts } = await q(`select at.id as "attemptId", u.name as "studentName", at.submitted_at as "submittedAt"
    from quiz_attempts at join users u on u.id = at.student_id
    where at.quiz_id = $1 and at.submitted_at is not null order by u.name`, [quiz.id]);
  const { rows: answers } = await q(`select a.attempt_id as "attemptId", a.question_id as "questionId", a.text_answer as "textAnswer", a.awarded
    from quiz_answers a join quiz_questions qq on qq.id = a.question_id where qq.quiz_id = $1 and qq.kind = 'text'`, [quiz.id]);
  const byKey = new Map(answers.map(a => [`${a.attemptId}:${a.questionId}`, a]));
  return ok({
    questions,
    attempts: attempts.map(at => ({
      ...at,
      answers: questions.map(qq => {
        const a = byKey.get(`${at.attemptId}:${qq.id}`);
        return { questionId: qq.id, textAnswer: a?.textAnswer ?? '', awarded: a?.awarded ?? null };
      }),
    })),
  });
});

on('POST', '/api/quizzes/:id/grade', async ({ params, body, user }) => {
  const quiz = await loadQuiz(requireId(params.id, 'sınav'));
  if ((await quizAccess(user, quiz)) !== 'full') fail(403, 'Bu sınavı değerlendirme yetkin yok.');
  const grades = Array.isArray(body.grades) ? body.grades.slice(0, 500) : fail(400, 'Puan listesi geçersiz.');
  const { rows: questions } = await q("select id, points from quiz_questions where quiz_id = $1 and kind = 'text'", [quiz.id]);
  const maxPoints = new Map(questions.map(qq => [qq.id, qq.points]));
  const { rows: submitted } = await q('select id from quiz_attempts where quiz_id = $1 and submitted_at is not null', [quiz.id]);
  const validAttempts = new Set(submitted.map(r => r.id));
  for (const g of grades) {
    const attemptId = requireId(g?.attemptId, 'deneme');
    const questionId = requireId(g?.questionId, 'soru');
    if (!validAttempts.has(attemptId)) fail(400, 'Deneme bu sınava ait değil ya da teslim edilmemiş.');
    if (!maxPoints.has(questionId)) fail(400, 'Bu soru açık uçlu değil, elle puanlanamaz.');
    if (!Number.isInteger(g.points) || g.points < 0 || g.points > maxPoints.get(questionId)) {
      fail(400, `Puan 0 ile ${maxPoints.get(questionId)} arasında olmalı.`);
    }
  }
  const touched = new Set();
  await tx(async client => {
    for (const g of grades) {
      await client.query(`insert into quiz_answers (attempt_id, question_id, awarded) values ($1, $2, $3)
        on conflict (attempt_id, question_id) do update set awarded = excluded.awarded`, [g.attemptId, g.questionId, g.points]);
      touched.add(g.attemptId);
    }
    for (const attemptId of touched) await recalcAttempt(client, attemptId);
  });
  await audit(user, 'quiz_graded', quiz.title, { count: grades.length });
  return ok({ graded: grades.length });
}, { roles: STAFF });

// ---------- GeoGebra paneli (v29) ----------
const GEOGEBRA_APPS = { graphing: 'Grafik', calculator: 'Hesap makinesi', geometry: 'Geometri', '3d': '3B', classic: 'Klasik', cas: 'CAS' };

// Yalnızca https ve geogebra.org (ya da alt alan adı) bağlantıları kabul edilir
function geogebraUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(400, 'Bağlantı geçersiz.');
  }
  if (parsed.protocol !== 'https:' || !(parsed.hostname === 'geogebra.org' || parsed.hostname.endsWith('.geogebra.org'))) {
    fail(400, 'Yalnızca geogebra.org bağlantıları eklenebilir.');
  }
  return parsed.toString();
}

on('GET', '/api/geogebra/apps', async () => ok({
  apps: Object.entries(GEOGEBRA_APPS).map(([key, label]) => ({ key, label, url: `https://www.geogebra.org/${key}` })),
}));

on('GET', '/api/geogebra/materials', async ({ query, user }) => {
  const classParam = query.get('classId') ? requireId(query.get('classId'), 'sınıf') : null;
  const classIds = await visibleClassIds(user);
  if (classParam && classIds !== null && !classIds.includes(classParam)) fail(403, 'Bu sınıfın materyallerini görme yetkin yok.');
  const { rows } = await q(`select g.id, g.title, g.url, g.kind, g.content, g.created_by as "createdBy", c.name as "className"
    from geogebra_materials g join classes c on c.id = g.class_id
    where ($1::uuid is null or g.class_id = $1) and ($2::uuid[] is null or g.class_id = any($2::uuid[]))
    order by c.name, g.created_at desc limit 300`, [classParam, classIds]);
  return ok({ materials: rows.map(r => ({ ...r, canDelete: user.role === 'principal' || r.createdBy === user.id })) });
});

on('POST', '/api/geogebra/materials', async ({ body, user }) => {
  const classId = requireId(body.classId, 'sınıf');
  if (user.role !== 'principal' && !(await teachesClass(user, classId))) fail(403, 'Bu sınıfa materyal ekleme yetkin yok.');
  const title = str(body.title, 120);
  if (title.length < 2) fail(400, 'Başlık en az 2 karakter olmalı.');
  const url = geogebraUrl(str(body.url, 500));
  const { rows: [row] } = await q('insert into geogebra_materials (class_id, title, url, created_by) values ($1, $2, $3, $4) returning id', [classId, title, url, user.id]);
  const { rows: students } = await q('select student_id from enrollments where class_id = $1', [classId]);
  push.notify(students.map(s => s.student_id), { title: 'Yeni GeoGebra materyali', body: title, url: '/#/geogebra', tag: `ggb-${row.id}` }).catch(() => {});
  return created({ id: row.id });
}, { roles: STAFF });

on('DELETE', '/api/geogebra/materials/:id', async ({ params, user }) => {
  const id = requireId(params.id, 'materyal');
  const { rows: [row] } = await q('select created_by from geogebra_materials where id = $1', [id]);
  if (!row) fail(404, 'Materyal bulunamadı.');
  if (user.role !== 'principal' && row.created_by !== user.id) fail(403, 'Bu materyali silme yetkin yok.');
  await q('delete from geogebra_materials where id = $1', [id]);
  return ok({ deleted: true });
}, { roles: STAFF });

// Çalışma kaydı: yalnızca grafik aracının satırları (harf, rakam ve matematik işaretleri)
const WORKSHEET_LINE = /^[A-Za-z0-9\s+\-*/^().,=_]{1,200}$/;

on('POST', '/api/geogebra/worksheets', async ({ body, user }) => {
  const classId = requireId(body.classId, 'sınıf');
  if (user.role !== 'principal' && !(await teachesClass(user, classId))) fail(403, 'Bu sınıfa çalışma ekleme yetkin yok.');
  const title = str(body.title, 120);
  if (title.length < 2) fail(400, 'Başlık en az 2 karakter olmalı.');
  if (!Array.isArray(body.lines)) fail(400, 'Çalışma satırları geçersiz.');
  if (body.lines.length > 60) fail(400, 'Bir çalışmada en fazla 60 satır olabilir.');
  const lines = body.lines.map(line => {
    if (typeof line !== 'string') fail(400, 'Her satır metin olmalı.');
    const text = line.trim();
    if (text && !WORKSHEET_LINE.test(text)) fail(400, `Satırda izin verilmeyen karakter var: "${text.slice(0, 40)}"`);
    return text;
  }).filter(Boolean);
  const { rows: [row] } = await q(`insert into geogebra_materials (class_id, title, kind, content, created_by)
    values ($1, $2, 'worksheet', $3, $4) returning id`, [classId, title, JSON.stringify({ lines }), user.id]);
  const { rows: students } = await q('select student_id from enrollments where class_id = $1', [classId]);
  push.notify(students.map(s => s.student_id), { title: 'Yeni grafik çalışması', body: title, url: '/#/geogebra', tag: `ggb-ws-${row.id}` }).catch(() => {});
  return created({ id: row.id, lines: lines.length });
}, { roles: STAFF });

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

module.exports = { handleApi, toHttpError, HttpError, startDigestSchedule, startReminderSchedule };
