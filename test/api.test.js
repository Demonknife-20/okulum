const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const PORT = 3299;
const BASE = `http://127.0.0.1:${PORT}`;
const DB = process.env.TEST_DATABASE_URL;
const ROOT = path.join(__dirname, '..');
let child;

if (!DB || !/test/.test(DB)) {
  throw new Error('TEST_DATABASE_URL tanımlı olmalı ve veritabanı adı "test" içermeli (veri silinir!).');
}

const PDF = Buffer.from('%PDF-1.4\n% okulum test\n');
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('docx-body')]);
const b64 = buffer => buffer.toString('base64');

async function call(method, route, { body, cookie, origin = BASE, raw } = {}) {
  const headers = {};
  if (method !== 'GET' && method !== 'HEAD') headers['Content-Type'] = raw ?? 'application/json';
  if (cookie) headers.Cookie = cookie;
  if (origin) headers.Origin = origin;
  let payload;
  if (body !== undefined) payload = typeof body === 'string' ? body : JSON.stringify(body);
  else if (method === 'POST' || method === 'PUT' || method === 'PATCH') payload = '{}';
  const res = await fetch(BASE + route, { method, headers, body: payload });
  const setCookie = res.headers.get('set-cookie');
  const buffer = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get('content-type') || '';
  let data = buffer;
  if (type.includes('application/json')) { try { data = JSON.parse(buffer.toString('utf8')); } catch { data = buffer.toString('utf8'); } }
  else if (type.startsWith('text/')) data = buffer.toString('utf8');
  return { status: res.status, data, headers: res.headers, cookie: setCookie ? setCookie.split(';')[0] : null };
}

async function resetDatabase() {
  const client = new Client({ connectionString: DB, ssl: false });
  await client.connect();
  await client.query('drop schema public cascade; create schema public;');
  await client.end();
}

before(async () => {
  await resetDatabase();
  fs.rmSync(path.join(ROOT, 'data'), { recursive: true, force: true });
  child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: DB, PORT: String(PORT), HOST: '127.0.0.1', SESSION_SECRET: 'test-secret-value-0123456789' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Sunucu zamanında başlamadı')), 15000);
    child.stdout.on('data', chunk => { if (String(chunk).includes('Okulum hazır')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Sunucu kapandı: ${code}`)); });
  });
});

after(() => {
  child?.kill('SIGTERM');
  fs.rmSync(path.join(ROOT, 'data'), { recursive: true, force: true });
});

const state = {};

async function login(username, password) {
  const r = await call('POST', '/api/login', { body: { username, password } });
  assert.equal(r.status, 200, `giriş başarısız: ${username} ${JSON.stringify(r.data)}`);
  return r.cookie;
}

// ---------- Testler (sıra önemli: her biri öncekinin verisine dayanır) ----------

test('sağlık ve güvenlik başlıkları', async () => {
  const health = await call('GET', '/healthz');
  assert.equal(health.status, 200);
  const page = await call('GET', '/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(page.headers.get('x-frame-options'), 'DENY');
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
});

test('kurulum: müdür hesabı oluşur, ikinci kurulum reddedilir', async () => {
  assert.equal((await call('GET', '/api/setup')).data.setupRequired, true);
  const setup = { schoolName: 'Yıldız Akademi', schoolCity: 'İstanbul', schoolYear: '2026–2027', name: 'Murat Aydın', username: 'murat', password: 'mudur-sifresi-1' };
  const r = await call('POST', '/api/setup', { body: setup });
  assert.equal(r.status, 201);
  assert.ok(r.cookie);
  state.principal = r.cookie;
  assert.equal((await call('POST', '/api/setup', { body: { ...setup, username: 'baska' } })).status, 409);
  assert.equal((await call('GET', '/api/setup')).data.setupRequired, false);
});

test('demo içerik yok: boş okulda gösterge sıfır, kaynak kodda demo adı yok', async () => {
  const overview = await call('GET', '/api/overview', { cookie: state.principal });
  assert.equal(overview.status, 200);
  for (const value of Object.values(overview.data.stats)) assert.equal(value, 0);
  const sources = ['public/index.html', 'public/app.js', 'public/core.js', 'public/views.js', 'src/schema.sql'];
  const forbidden = ['Atatürk', 'Ayşe Yılmaz', 'Mehmet Demir', '6/A Sınıfı', 'Kesirlerle', 'Doğal sayılar', 'Yıldız Akademi\'nin'];
  for (const file of sources) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const word of forbidden) assert.ok(!text.includes(word), `${file} içinde demo kalıntısı: ${word}`);
    assert.ok(!/style="/.test(text), `${file}: CSP için satır içi style yasak`);
    assert.ok(!/\son[a-z]+=/.test(text), `${file}: satır içi olay niteliği yasak`);
  }
});

test('güvenlik: çapraz kaynak yazma, yanlış içerik türü, kimliksiz erişim', async () => {
  const cross = await call('POST', '/api/login', { body: { username: 'murat', password: 'x' }, origin: 'https://kotu.example' });
  assert.equal(cross.status, 403);
  const plain = await call('POST', '/api/login', { body: 'username=murat', raw: 'text/plain' });
  assert.equal(plain.status, 415);
  assert.equal((await call('GET', '/api/me')).status, 401);
  assert.equal((await call('GET', '/api/nope')).status, 404);
  assert.equal((await call('GET', '/../../etc/passwd')).status, 404);
});

test('katalog: sınıf ve ders eklenir, tekrar eden sınıf reddedilir', async () => {
  const a = await call('POST', '/api/classes', { body: { name: '6/A' }, cookie: state.principal });
  assert.equal(a.status, 201);
  state.class6A = a.data.class.id;
  state.class7B = (await call('POST', '/api/classes', { body: { name: '7/B' }, cookie: state.principal })).data.class.id;
  assert.equal((await call('POST', '/api/classes', { body: { name: '6/A' }, cookie: state.principal })).status, 409);
  state.math = (await call('POST', '/api/subjects', { body: { name: 'Matematik' }, cookie: state.principal })).data.subject.id;
  state.turkish = (await call('POST', '/api/subjects', { body: { name: 'Türkçe' }, cookie: state.principal })).data.subject.id;
  const list = await call('GET', '/api/classes', { cookie: state.principal });
  assert.equal(list.data.classes.length, 2);
});

test('kişiler: öğretmen ve öğrenci oluşturma, doğrulama kuralları', async () => {
  const ayse = await call('POST', '/api/users', { cookie: state.principal, body: {
    role: 'teacher', name: 'Ayşe Hoca', username: 'ayse', password: 'ogretmen-1234',
    teaching: [{ classId: state.class6A, subjectId: state.math }],
  } });
  assert.equal(ayse.status, 201);
  state.ayseId = ayse.data.user.id;
  const ali = await call('POST', '/api/users', { cookie: state.principal, body: {
    role: 'teacher', name: 'Ali Usta', username: 'ali', password: 'ogretmen-5678',
    teaching: [{ classId: state.class7B, subjectId: state.turkish }],
  } });
  state.aliId = ali.data.user.id;
  const ece = await call('POST', '/api/users', { cookie: state.principal, body: {
    role: 'student', name: 'Ece Yılmaz', username: 'ece', password: 'ogrenci-1234', studentNo: '101', classId: state.class6A,
  } });
  state.eceId = ece.data.user.id;
  state.burakId = (await call('POST', '/api/users', { cookie: state.principal, body: {
    role: 'student', name: 'Burak Demir', username: 'burak', password: 'ogrenci-5678', studentNo: '102', classId: state.class6A,
  } })).data.user.id;
  state.canId = (await call('POST', '/api/users', { cookie: state.principal, body: {
    role: 'student', name: 'Can Arslan', username: 'can', password: 'ogrenci-9012', studentNo: '201', classId: state.class7B,
  } })).data.user.id;
  assert.equal((await call('POST', '/api/users', { cookie: state.principal, body: { role: 'student', name: 'Eksik No', username: 'eksik', password: 'ogrenci-1234' } })).status, 400);
  assert.equal((await call('POST', '/api/users', { cookie: state.principal, body: { role: 'teacher', name: 'Kötü Ad', username: 'A B', password: 'ogretmen-1234' } })).status, 400);
  assert.equal((await call('POST', '/api/users', { cookie: state.principal, body: { role: 'teacher', name: 'Kısa Şifre', username: 'kisa', password: '123' } })).status, 400);
  assert.equal((await call('POST', '/api/users', { cookie: state.principal, body: { role: 'teacher', name: 'Mükerrer', username: 'ayse', password: 'ogretmen-1234' } })).status, 409);
  state.ayse = await login('ayse', 'ogretmen-1234');
  state.ali = await login('ali', 'ogretmen-5678');
  state.ece = await login('ece', 'ogrenci-1234');
  state.burak = await login('burak', 'ogrenci-5678');
  state.can = await login('can', 'ogrenci-9012');
});

test('kişi görünürlüğü: öğrenci yalnızca kendi öğretmenini ve müdürü görür', async () => {
  const names = r => r.data.users.map(u => u.name);
  const forAyse = names(await call('GET', '/api/users', { cookie: state.ayse }));
  assert.ok(forAyse.includes('Ece Yılmaz') && forAyse.includes('Burak Demir') && forAyse.includes('Ali Usta'));
  assert.ok(!forAyse.includes('Can Arslan'), 'öğretmen başka sınıfın öğrencisini görmemeli');
  const forEce = names(await call('GET', '/api/users', { cookie: state.ece }));
  assert.deepEqual(forEce.sort(), ['Ayşe Hoca', 'Murat Aydın'].sort());
  const ayseView = (await call('GET', '/api/users', { cookie: state.ayse })).data.users.find(u => u.name === 'Ece Yılmaz');
  assert.equal(ayseView.username, undefined, 'kullanıcı adı öğretmene gösterilmemeli');
});

test('ödev: yalnızca verdiği sınıf ve derse ödev oluşturabilir, dosya içeriği doğrulanır', async () => {
  const ok = await call('POST', '/api/assignments', { cookie: state.ayse, body: {
    title: 'Kesirler çalışma kâğıdı', classId: state.class6A, subjectId: state.math, kind: 'online',
    instructions: 'Sayfa 42', dueAt: new Date(Date.now() + 86400e3).toISOString(),
    file: { name: 'kesirler.pdf', data: b64(PDF) },
  } });
  assert.equal(ok.status, 201);
  state.assignment = ok.data.id;
  assert.equal((await call('POST', '/api/assignments', { cookie: state.ali, body: { title: 'Yetkisiz', classId: state.class6A, subjectId: state.math } })).status, 403);
  assert.equal((await call('POST', '/api/assignments', { cookie: state.ayse, body: { title: 'Yanlış ders', classId: state.class7B, subjectId: state.turkish } })).status, 403);
  assert.equal((await call('POST', '/api/assignments', { cookie: state.ayse, body: { title: 'Sahte', classId: state.class6A, subjectId: state.math, file: { name: 'sahte.pdf', data: b64(Buffer.from('merhaba')) } } })).status, 400);
  assert.equal((await call('POST', '/api/assignments', { cookie: state.ayse, body: { title: 'Zararlı', classId: state.class6A, subjectId: state.math, file: { name: 'a.exe', data: b64(PDF) } } })).status, 400);
  assert.equal((await call('GET', '/api/assignments', { cookie: state.ece })).data.assignments.length, 1);
  assert.equal((await call('GET', '/api/assignments', { cookie: state.can })).data.assignments.length, 0);
});

test('ödev dosyası: yetkisiz indirme engellenir, yetkili indirme çalışır', async () => {
  const yes = await call('GET', `/api/files/assignment/${state.assignment}`, { cookie: state.ece });
  assert.equal(yes.status, 200);
  assert.ok(yes.data.equals(PDF), 'indirilen dosya yüklenenle birebir aynı olmalı');
  assert.match(yes.headers.get('content-disposition'), /attachment/);
  assert.equal((await call('GET', `/api/files/assignment/${state.assignment}`, { cookie: state.can })).status, 403);
  assert.equal((await call('GET', `/api/files/assignment/${state.assignment}`, { cookie: state.ali })).status, 403);
});

test('teslim: öğrenci yükler, başka öğrenci göremez, öğretmen notlandırır', async () => {
  const sub = await call('POST', `/api/assignments/${state.assignment}/submission`, { cookie: state.ece, body: { file: { name: 'odev.docx', data: b64(DOCX) }, note: 'İyi çalışmalar' } });
  assert.equal(sub.status, 200);
  state.submission = sub.data.submission.id;
  const again = await call('POST', `/api/assignments/${state.assignment}/submission`, { cookie: state.ece, body: { file: { name: 'odev2.pdf', data: b64(PDF) } } });
  assert.equal(again.status, 200, 'yeniden gönderim kabul edilmeli');
  assert.equal((await call('POST', `/api/assignments/${state.assignment}/submission`, { cookie: state.can, body: { file: { name: 'o.pdf', data: b64(PDF) } } })).status, 404);
  assert.equal((await call('GET', `/api/files/submission/${state.submission}`, { cookie: state.burak })).status, 403, 'başka öğrenci teslimi indiremez');
  assert.equal((await call('GET', `/api/files/submission/${state.submission}`, { cookie: state.ece })).status, 200);
  const list = (await call('GET', `/api/assignments/${state.assignment}/submissions`, { cookie: state.ayse })).data;
  assert.equal(list.submitted.length, 1);
  assert.deepEqual(list.missing.map(m => m.studentName), ['Burak Demir']);
  assert.equal((await call('PUT', `/api/submissions/${state.submission}/grade`, { cookie: state.ali, body: { grade: '100' } })).status, 403, 'başka öğretmen notlandıramaz');
  assert.equal((await call('PUT', `/api/submissions/${state.submission}/grade`, { cookie: state.principal, body: { grade: '100' } })).status, 403, 'müdür notlandıramaz');
  assert.equal((await call('GET', `/api/assignments/${state.assignment}/submissions`, { cookie: state.ali })).status, 403);
  assert.equal((await call('GET', `/api/assignments/${state.assignment}/submissions`, { cookie: state.principal })).status, 200);
  assert.equal((await call('PUT', `/api/submissions/${state.submission}/grade`, { cookie: state.ayse, body: { grade: '85', feedback: 'Güzel' } })).status, 200);
  const mine = (await call('GET', '/api/assignments', { cookie: state.ece })).data.assignments[0];
  assert.equal(mine.mySubmission.grade, '85');
  assert.equal(mine.mySubmission.feedback, 'Güzel');
});

test('teslim kuralları: kağıt ödev ve süresi geçmiş ödev kabul edilmez', async () => {
  const paper = await call('POST', '/api/assignments', { cookie: state.ayse, body: { title: 'Sınıf içi yazılı', classId: state.class6A, subjectId: state.math, kind: 'paper', instructions: 'Ders kitabı 10' } });
  assert.equal((await call('POST', `/api/assignments/${paper.data.id}/submission`, { cookie: state.ece, body: { file: { name: 'a.pdf', data: b64(PDF) } } })).status, 400);
  const late = await call('POST', '/api/assignments', { cookie: state.ayse, body: { title: 'Geçmiş ödev', classId: state.class6A, subjectId: state.math, dueAt: '2020-01-01T00:00:00Z' } });
  const res = await call('POST', `/api/assignments/${late.data.id}/submission`, { cookie: state.ece, body: { file: { name: 'a.pdf', data: b64(PDF) } } });
  assert.equal(res.status, 400);
  assert.match(res.data.error, /geçti/);
});

test('yoklama: yalnızca dersi veren öğretmen kaydeder, sınıf dışı öğrenci reddedilir', async () => {
  const roster = await call('GET', `/api/attendance/roster?classId=${state.class6A}&subjectId=${state.math}`, { cookie: state.ayse });
  assert.equal(roster.status, 200);
  assert.equal(roster.data.students.length, 2);
  assert.equal(roster.data.recorded, false);
  assert.equal((await call('GET', `/api/attendance/roster?classId=${state.class6A}&subjectId=${state.math}`, { cookie: state.ali })).status, 403);
  const date = roster.data.date;
  assert.equal((await call('PUT', '/api/attendance', { cookie: state.ayse, body: { classId: state.class6A, subjectId: state.math, date, records: { [state.canId]: 'present' } } })).status, 400);
  assert.equal((await call('PUT', '/api/attendance', { cookie: state.ayse, body: { classId: state.class6A, subjectId: state.math, date: '2099-01-01', records: {} } })).status, 400);
  assert.equal((await call('PUT', '/api/attendance', { cookie: state.ali, body: { classId: state.class6A, subjectId: state.math, date, records: {} } })).status, 403);
  const save = await call('PUT', '/api/attendance', { cookie: state.ayse, body: { classId: state.class6A, subjectId: state.math, date, records: { [state.eceId]: 'present', [state.burakId]: 'absent' } } });
  assert.equal(save.status, 200);
  const after = (await call('GET', `/api/attendance/roster?classId=${state.class6A}&subjectId=${state.math}`, { cookie: state.ayse })).data;
  assert.equal(after.recorded, true);
  assert.equal(after.students.find(s => s.name === 'Ece Yılmaz').status, 'present');
  assert.equal(after.students.find(s => s.name === 'Burak Demir').status, 'absent');
  const eceView = (await call('GET', '/api/attendance/me', { cookie: state.ece })).data;
  assert.equal(eceView.subjects[0].present, 1);
  assert.equal(eceView.subjects[0].total, 1);
  await call('PUT', '/api/attendance', { cookie: state.ayse, body: { classId: state.class6A, subjectId: state.math, date, records: { [state.burakId]: null } } });
  const cleared = (await call('GET', `/api/attendance/roster?classId=${state.class6A}&subjectId=${state.math}`, { cookie: state.ayse })).data;
  assert.equal(cleared.students.find(s => s.name === 'Burak Demir').status, null);
});

test('sayfalama: kullanıcı ve ödev listeleri sayfalı, filtreler çalışır', async () => {
  const p1 = (await call('GET', '/api/users?page=1&size=2', { cookie: state.principal })).data;
  assert.equal(p1.users.length, 2);
  assert.equal(p1.total, 6);
  const p2 = (await call('GET', '/api/users?page=2&size=2', { cookie: state.principal })).data;
  assert.notEqual(p2.users[0].id, p1.users[0].id);
  assert.equal((await call('GET', '/api/users?role=teacher', { cookie: state.principal })).data.total, 2);
  assert.equal((await call('GET', '/api/users?q=ece', { cookie: state.principal })).data.total, 1);
  assert.equal((await call('GET', '/api/users?q=%25', { cookie: state.principal })).data.total, 0, '% joker karakter olarak yorumlanmaz');
  const page = (await call('GET', `/api/assignments?size=1&classId=${state.class6A}`, { cookie: state.ayse })).data;
  assert.equal(page.assignments.length, 1);
  assert.ok(page.total >= 2);
  assert.equal((await call('GET', `/api/assignments?classId=${state.class7B}`, { cookie: state.ayse })).data.total, 0);
});

test('toplu not: tek işlemde kaydedilir, yabancı teslim varsa hiçbiri kaydedilmez', async () => {
  const created = await call('POST', '/api/assignments', { cookie: state.ayse, body: { title: 'Toplu not ödevi', classId: state.class6A, subjectId: state.math, dueAt: new Date(Date.now() + 86400e3).toISOString() } });
  const bulkId = created.data.id;
  await call('POST', `/api/assignments/${bulkId}/submission`, { cookie: state.ece, body: { file: { name: 'a.pdf', data: b64(PDF) } } });
  await call('POST', `/api/assignments/${bulkId}/submission`, { cookie: state.burak, body: { file: { name: 'b.pdf', data: b64(PDF) } } });
  const list = (await call('GET', `/api/assignments/${bulkId}/submissions`, { cookie: state.ayse })).data.submitted;
  const ece = list.find(x => x.studentName === 'Ece Yılmaz');
  const burak = list.find(x => x.studentName === 'Burak Demir');
  assert.equal((await call('PUT', `/api/assignments/${bulkId}/grades`, { cookie: state.ali, body: { grades: [{ id: ece.id, grade: '50' }] } })).status, 403);
  const bad = await call('PUT', `/api/assignments/${bulkId}/grades`, { cookie: state.ayse, body: { grades: [
    { id: ece.id, grade: '1' }, { id: '00000000-0000-4000-8000-000000000000', grade: '2' }] } });
  assert.equal(bad.status, 400);
  const still = (await call('GET', `/api/assignments/${bulkId}/submissions`, { cookie: state.ayse })).data.submitted;
  assert.equal(still.find(x => x.studentName === 'Ece Yılmaz').grade, null, 'hata durumunda kısmi kayıt olmamalı');
  assert.equal((await call('PUT', `/api/assignments/${bulkId}/grades`, { cookie: state.ayse, body: { grades: [{ id: ece.id, grade: '5' }, { id: ece.id, grade: '6' }] } })).status, 400, 'tekrar eden teslim reddedilir');
  assert.equal((await call('PUT', `/api/assignments/${bulkId}/grades`, { cookie: state.ayse, body: { grades: [] } })).status, 400);
  const good = await call('PUT', `/api/assignments/${bulkId}/grades`, { cookie: state.ayse, body: { grades: [
    { id: ece.id, grade: '70', feedback: 'İyi' }, { id: burak.id, grade: '60', feedback: 'Tekrar bak' }] } });
  assert.equal(good.status, 200);
  assert.equal(good.data.saved, 2);
  const mine = (await call('GET', '/api/assignments?size=50', { cookie: state.ece })).data.assignments.find(a => a.id === bulkId);
  assert.equal(mine.mySubmission.grade, '70');
  assert.equal(mine.ungradedCount, 0);
  state.bulkAssignment = bulkId;
});

test('ödev düzenleme: yalnızca ders öğretmeni değiştirir', async () => {
  assert.equal((await call('PATCH', `/api/assignments/${state.assignment}`, { cookie: state.ayse, body: { title: 'Kesirler (güncel)', dueAt: null } })).status, 200);
  assert.equal((await call('PATCH', `/api/assignments/${state.assignment}`, { cookie: state.ali, body: { title: 'Ali' } })).status, 403);
  assert.equal((await call('PATCH', `/api/assignments/${state.assignment}`, { cookie: state.ayse, body: {} })).status, 400);
  const mine = (await call('GET', '/api/assignments?size=50', { cookie: state.ece })).data.assignments.find(a => a.id === state.assignment);
  assert.equal(mine.title, 'Kesirler (güncel)');
});

test('devamsızlık uyarıları: üst üste 3 devamsızlık ve %80 altı devam işaretlenir', async () => {
  assert.deepEqual((await call('GET', '/api/alerts', { cookie: state.ayse })).data.alerts, [], 'önbelleği ısıt: başlangıçta uyarı yok');
  const day = n => new Date(Date.now() - n * 86400e3).toISOString().slice(0, 10);
  for (let n = 5; n >= 1; n -= 1) {
    await call('PUT', '/api/attendance', { cookie: state.ayse, body: { classId: state.class6A, subjectId: state.math, date: day(n),
      records: { [state.burakId]: 'absent', [state.eceId]: n === 1 ? 'absent' : 'present' } } });
  }
  const alerts = (await call('GET', '/api/alerts', { cookie: state.ayse })).data;
  const burak = alerts.alerts.find(a => a.studentName === 'Burak Demir');
  assert.ok(burak, 'Burak için uyarı olmalı');
  assert.equal(burak.reason, 'streak');
  assert.ok(burak.streak >= 5);
  assert.equal(alerts.thresholds.streak, 3);
  assert.ok(!alerts.alerts.some(a => a.studentName === 'Ece Yılmaz'), 'eşik üstündeki öğrenci için uyarı olmamalı (83%)');
  assert.deepEqual((await call('GET', '/api/alerts', { cookie: state.ali })).data.alerts, [], 'başka öğretmenin sınıfı görünmez');
  const own = (await call('GET', '/api/alerts', { cookie: state.burak })).data.alerts;
  assert.equal(own[0].reason, 'streak', 'öğrenci kendi uyarısını görür');
  assert.ok(own.every(a => a.studentName === 'Burak Demir'));
});

test('mesajlaşma: kurallar uygulanır, öğrenciler birbirine yazamaz, sohbet gizli kalır', async () => {
  const direct = await call('POST', '/api/conversations', { cookie: state.ece, body: { userId: state.ayseId } });
  assert.equal(direct.status, 201);
  state.dm = direct.data.id;
  assert.equal((await call('POST', '/api/conversations', { cookie: state.ece, body: { userId: state.ayseId } })).data.id, state.dm, 'aynı çift tek sohbet');
  assert.equal((await call('POST', '/api/conversations', { cookie: state.ece, body: { userId: state.aliId } })).status, 403);
  assert.equal((await call('POST', '/api/conversations', { cookie: state.ece, body: { userId: state.burakId } })).status, 403);
  assert.equal((await call('POST', '/api/conversations', { cookie: state.ayse, body: { userId: state.canId } })).status, 403);
  assert.equal((await call('POST', '/api/conversations', { cookie: state.ayse, body: { userId: state.aliId } })).status, 201);
  assert.equal((await call('POST', '/api/conversations', { cookie: state.principal, body: { userId: state.canId } })).status, 201);
  const sent = await call('POST', `/api/conversations/${state.dm}/messages`, { cookie: state.ece, body: { body: 'Hocam, ödev teslimi hakkında soru var.' } });
  assert.equal(sent.status, 201);
  const readByTeacher = (await call('GET', `/api/conversations/${state.dm}/messages`, { cookie: state.ayse })).data;
  assert.equal(readByTeacher.messages.at(-1).body, 'Hocam, ödev teslimi hakkında soru var.');
  assert.equal((await call('GET', `/api/conversations/${state.dm}/messages`, { cookie: state.burak })).status, 403, 'üçüncü kişi okuyamaz');
  assert.equal((await call('POST', `/api/conversations/${state.dm}/messages`, { cookie: state.burak, body: { body: 'merhaba' } })).status, 403);
  assert.equal((await call('POST', `/api/conversations/${state.dm}/messages`, { cookie: state.ece, body: { body: 'x'.repeat(2001) } })).status, 400);
  const eceList = (await call('GET', '/api/conversations', { cookie: state.ece })).data.conversations;
  assert.ok(eceList.some(c => c.title === '6/A sınıf grubu'), 'sınıf grubu listede');
  assert.ok(eceList.some(c => c.title === 'Ayşe Hoca'));
  const group = eceList.find(c => c.title === '6/A sınıf grubu').id;
  assert.equal((await call('POST', `/api/conversations/${group}/messages`, { cookie: state.burak, body: { body: 'Yarın sınav var mı?' } })).status, 201);
  const eceGroup = (await call('GET', `/api/conversations/${group}/messages?after=0`, { cookie: state.ece })).data.messages;
  assert.equal(eceGroup.at(-1).body, 'Yarın sınav var mı?');
  assert.equal((await call('GET', `/api/conversations/${group}/messages`, { cookie: state.can })).status, 403, 'başka sınıf grubunu okuyamaz');
  const lastSeen = eceGroup.at(-1).id;
  assert.equal((await call('GET', `/api/conversations/${group}/messages?after=${lastSeen}`, { cookie: state.ece })).data.messages.length, 0, 'yeni mesaj yokken boş döner');
  await call('POST', `/api/conversations/${group}/messages`, { cookie: state.ece, body: { body: 'Evet, 9. ders' } });
  const polled = (await call('GET', `/api/conversations/${group}/messages?after=${lastSeen}`, { cookie: state.ece })).data.messages;
  assert.equal(polled.length, 1, 'yoklama ile yalnızca yeni mesaj gelir');
  assert.equal(polled[0].body, 'Evet, 9. ders');
});

test('mesaj geçmişi: before ile eski mesajlar sayfalanır', async () => {
  const list = (await call('GET', '/api/conversations', { cookie: state.ece })).data.conversations;
  const group = list.find(c => c.title === '6/A sınıf grubu').id;
  const all = (await call('GET', `/api/conversations/${group}/messages`, { cookie: state.ece })).data.messages;
  assert.ok(all.length >= 2);
  const older = (await call('GET', `/api/conversations/${group}/messages?before=${all[1].id}`, { cookie: state.ece })).data;
  assert.equal(older.messages.length, 1);
  assert.equal(older.messages[0].id, all[0].id);
  assert.equal(older.more, false);
});

test('bildirimler: okunmamış mesaj ve yeni ödev/not sayılır, okununca sıfırlanır', async () => {
  const before = (await call('GET', '/api/notifications', { cookie: state.ayse })).data;
  assert.ok(before.messages >= 1, 'öğretmen okunmamış mesaj görmeli');
  assert.ok(before.byConversation[state.dm] >= 1, 'özel sohbet için sayı olmalı');
  assert.equal((await call('POST', `/api/conversations/${state.dm}/read`, { cookie: state.ayse, body: {} })).status, 200);
  const after = (await call('GET', '/api/notifications', { cookie: state.ayse })).data;
  assert.equal(after.byConversation[state.dm], undefined, 'okunan sohbet sayılmamalı');
  assert.equal((await call('POST', `/api/conversations/${state.dm}/read`, { cookie: state.can, body: {} })).status, 403);

  const eceBefore = (await call('GET', '/api/notifications', { cookie: state.ece })).data;
  assert.ok(eceBefore.assignments >= 1, 'öğrenci yeni ödevleri görmeli');
  assert.ok(eceBefore.grades >= 1, 'öğrenci yeni notları görmeli');
  assert.equal((await call('POST', '/api/notifications/seen', { cookie: state.ece, body: { scope: 'assignments' } })).status, 200);
  assert.equal((await call('POST', '/api/notifications/seen', { cookie: state.ece, body: { scope: 'grades' } })).status, 200);
  const eceAfter = (await call('GET', '/api/notifications', { cookie: state.ece })).data;
  assert.equal(eceAfter.assignments, 0);
  assert.equal(eceAfter.grades, 0);
  assert.equal((await call('POST', '/api/notifications/seen', { cookie: state.ece, body: { scope: 'submissions' } })).status, 400, 'öğrenci teslim bildirimi işaretleyemez');

  const teacherSubs = (await call('GET', '/api/notifications', { cookie: state.ayse })).data;
  assert.ok(teacherSubs.submissions >= 1, 'öğretmen yeni teslimleri görmeli');
  assert.equal((await call('GET', '/api/notifications', { cookie: state.ali })).data.submissions, 0, 'başka öğretmen görmez');
});

test('denetim kaydı: önemli işlemler kaydedilir, yalnızca müdür görür', async () => {
  const log = (await call('GET', '/api/audit?size=100', { cookie: state.principal })).data;
  const actions = new Set(log.entries.map(e => e.action));
  for (const expected of ['setup', 'class_created', 'subject_created', 'user_created', 'assignment_created', 'grades_saved', 'attendance_saved']) {
    assert.ok(actions.has(expected), `denetim kaydında eksik işlem: ${expected}`);
  }
  assert.ok(!JSON.stringify(log).includes('ogretmen-1234'), 'parola denetim kaydında olmamalı');
  assert.equal((await call('GET', '/api/audit', { cookie: state.ayse })).status, 403);
  assert.equal((await call('GET', '/api/audit?action=grades_saved', { cookie: state.principal })).data.entries.every(e => e.action === 'grades_saved'), true);
});

test('genel bakış rol bazlı gerçek veri döner', async () => {
  const principal = (await call('GET', '/api/overview', { cookie: state.principal })).data;
  assert.equal(principal.stats.teachers, 2);
  assert.equal(principal.stats.students, 3);
  assert.equal(principal.stats.classes, 2);
  const teacher = (await call('GET', '/api/overview', { cookie: state.ayse })).data;
  assert.equal(teacher.stats.assignments >= 2, true);
  assert.equal(teacher.stats.ungraded, 0, 'yalnızca bir teslim var ve notlandı; notsuz teslim yok');
  const student = (await call('GET', '/api/overview', { cookie: state.ece })).data;
  assert.equal(student.className, '6/A');
  assert.ok(student.grades.some(g => g.grade === '85'), 'Kesirler ödevinin notu listede olmalı');
});

test('şifre değişimi: eski oturum düşer, yeni oturum çalışır', async () => {
  const old = await login('ayse', 'ogretmen-1234');
  assert.equal((await call('PUT', '/api/me/password', { cookie: old, body: { current: 'yanlış-şifre', next: 'yeni-sifre-999' } })).status, 401);
  const changed = await call('PUT', '/api/me/password', { cookie: old, body: { current: 'ogretmen-1234', next: 'yeni-sifre-999' } });
  assert.equal(changed.status, 200);
  assert.equal((await call('GET', '/api/me', { cookie: old })).status, 401, 'parola değişince eski oturum geçersiz');
  assert.equal((await call('GET', '/api/me', { cookie: state.ayse })).status, 401, 'ilk oturum da düşmüş olmalı');
  assert.equal((await call('GET', '/api/me', { cookie: changed.cookie })).status, 200, 'değişimi yapan tarayıcı yeni çerezle devam eder');
  state.ayse = changed.cookie;
  assert.equal((await call('POST', '/api/login', { body: { username: 'ayse', password: 'ogretmen-1234' } })).status, 401);
  await login('ayse', 'yeni-sifre-999');
});

test('müdür şifre sıfırlar, öğrenci hesabını siler, yetkisiz silme engellenir', async () => {
  assert.equal((await call('PUT', `/api/users/${state.burakId}/password`, { cookie: state.principal, body: { password: 'sifirlanmis-123' } })).status, 200);
  assert.equal((await call('GET', '/api/me', { cookie: state.burak })).status, 401);
  state.burak = await login('burak', 'sifirlanmis-123');
  assert.equal((await call('DELETE', `/api/users/${state.burakId}`, { cookie: state.ayse })).status, 403);
  const principalId = (await call('GET', '/api/users', { cookie: state.principal })).data.users.find(u => u.role === 'principal').id;
  assert.equal((await call('DELETE', `/api/users/${principalId}`, { cookie: state.principal })).status, 403, 'müdür hesabı silinemez');
  assert.equal((await call('DELETE', `/api/users/${state.burakId}`, { cookie: state.principal })).status, 200);
  assert.equal((await call('GET', '/api/me', { cookie: state.burak })).status, 401);
  assert.equal((await call('POST', '/api/login', { body: { username: 'burak', password: 'sifirlanmis-123' } })).status, 401);
});

test('sınıf silinince bağlı ödev ve yetkiler temizlenir', async () => {
  assert.equal((await call('DELETE', `/api/classes/${state.class7B}`, { cookie: state.principal })).status, 200);
  const aliList = (await call('GET', '/api/me', { cookie: state.ali })).data;
  assert.equal(aliList.teaching.length, 0);
  assert.equal((await call('DELETE', `/api/classes/${state.class7B}`, { cookie: state.principal })).status, 404);
});

test('denetim: parola, silme ve başarısız girişler kaydedilir', async () => {
  const all = (await call('GET', '/api/audit?size=100', { cookie: state.principal })).data;
  const actions = new Set(all.entries.map(e => e.action));
  for (const expected of ['password_changed', 'password_reset', 'user_deleted']) assert.ok(actions.has(expected), `eksik: ${expected}`);
  assert.equal(all.entries.find(e => e.action === 'password_reset').actorName, 'Murat Aydın');
  const log = (await call('GET', '/api/audit?action=login_failed&size=100', { cookie: state.principal })).data;
  assert.ok(log.total >= 1, 'önceki başarısız girişler görünmeli');
  assert.ok(log.entries.every(e => e.actorRole === 'anonymous'));
});

test('hız sınırı: çok sayıda başarısız girişten sonra 429', async () => {
  const statuses = [];
  for (let i = 0; i < 14; i += 1) {
    statuses.push((await call('POST', '/api/login', { body: { username: `yok${i}`, password: 'yanlis-sifre' } })).status);
  }
  assert.ok(statuses.includes(429), `429 beklendi, gelen: ${statuses.join(',')}`);
  assert.equal(statuses.at(-1), 429);
});
