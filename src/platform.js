const crypto = require('node:crypto');
const { pool, migrateTenantSchema } = require('./db');
const sec = require('./security');
const { schemaForSlug, validSlug, schoolUrl } = require('./tenancy');
const { createLimiter } = require('./security');

const COOKIE = 'okulum_platform';
const SESSION_MS = 8 * 60 * 60 * 1000;
const failedLogins = createLimiter({ max: 10, windowMs: 15 * 60 * 1000 });
const NAME = /^[a-z0-9._-]{3,32}$/;

const str = (value, max) => String(value ?? '').trim().slice(0, max);
const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
const sign = value => crypto.createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('base64url');

function cookieValue(req) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === COOKIE) return rest.join('=');
  }
  return '';
}

function sessionToken(id) {
  const body = Buffer.from(JSON.stringify({ id, exp: Date.now() + SESSION_MS })).toString('base64url');
  return `${body}.${sign(body)}`;
}

function sessionId(req) {
  const [body, signature] = cookieValue(req).split('.');
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const session = JSON.parse(Buffer.from(body, 'base64url').toString());
    return session.exp > Date.now() ? session.id : null;
  } catch {
    return null;
  }
}

async function requireAdmin(req) {
  const id = sessionId(req);
  if (!id) return false;
  const { rowCount } = await pool.query('select 1 from platform.admins where id = $1', [id]);
  return rowCount > 0;
}

async function bootstrapPlatformAdmin() {
  const username = str(process.env.PLATFORM_ADMIN_USERNAME, 32).toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD || '';
  if (Boolean(username) !== Boolean(password)) {
    throw new Error('PLATFORM_ADMIN_USERNAME ve PLATFORM_ADMIN_PASSWORD birlikte tanımlanmalı.');
  }
  if (!username) return;
  if (!NAME.test(username)) throw new Error('PLATFORM_ADMIN_USERNAME biçimi geçersiz.');
  if (password.length < 16 || password.length > 128) {
    throw new Error('PLATFORM_ADMIN_PASSWORD 16-128 karakter olmalı.');
  }
  const { rows: admins } = await pool.query('select id from platform.admins limit 1');
  if (admins.length) return;
  const hash = await sec.hashPasswordAsync(password);
  await pool.query('insert into platform.admins (username, password_hash) values ($1, $2) on conflict (username) do nothing', [username, hash]);
}

function unauthorized(res) {
  return json(res, 401, { error: 'Platform yöneticisi girişi gerekli.' });
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

async function handlePlatformApi({ req, res, url, body }) {
  if (url.pathname === '/api/platform/login' && req.method === 'POST') {
    const username = str(body.username, 32).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const key = `${req.socket.remoteAddress || 'unknown'}:${username}`;
    if (failedLogins(key)) return json(res, 429, { error: 'Çok fazla deneme. Bir süre sonra tekrar deneyin.' });
    const { rows: configured } = await pool.query('select 1 from platform.admins limit 1');
    if (!configured.length) {
      return json(res, 503, { error: 'Platform yöneticisi ayarlanmamış. Render ortam değişkenlerinde PLATFORM_ADMIN_USERNAME ve PLATFORM_ADMIN_PASSWORD tanımlayın.' });
    }
    const { rows: [admin] } = await pool.query('select id, password_hash from platform.admins where username = $1', [username]);
    const valid = admin
      ? await sec.verifyPasswordAsync(password, admin.password_hash)
      : await sec.burnTimeAsync(password);
    if (!valid) return json(res, 401, { error: 'Kullanıcı adı veya parola hatalı.' });
    res.setHeader('Set-Cookie', `${COOKIE}=${sessionToken(admin.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS / 1000}${secureFlag}`);
    return json(res, 200, { authenticated: true });
  }

  if (url.pathname === '/api/platform/logout' && req.method === 'POST') {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`);
    return json(res, 200, { loggedOut: true });
  }

  if (!await requireAdmin(req)) return unauthorized(res);

  if (url.pathname === '/api/platform/session' && req.method === 'GET') {
    return json(res, 200, { authenticated: true });
  }
  if (url.pathname === '/api/platform/schools' && req.method === 'GET') {
    const { rows } = await pool.query('select slug, name, city, year, created_at as "createdAt" from platform.schools order by created_at desc');
    const schools = rows.map(school => ({ ...school, url: schoolUrl(school.slug) }));
    return json(res, 200, { schools });
  }
  if (url.pathname === '/api/platform/schools' && req.method === 'POST') {
    const name = str(body.schoolName, 120);
    const city = str(body.schoolCity, 80);
    const year = str(body.schoolYear, 20);
    const controllerName = str(body.controllerName, 120);
    const controllerAddress = str(body.controllerAddress, 300);
    const controllerEmail = str(body.controllerEmail, 120).toLowerCase();
    const controllerPhone = str(body.controllerPhone, 40);
    const slug = str(body.slug, 40).toLowerCase();
    const principalName = str(body.principalName, 80);
    const username = str(body.username, 32).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (name.length < 2 || city.length < 2 || year.length < 4 || principalName.length < 2) {
      return json(res, 400, { error: 'Okul, şehir, eğitim yılı ve müdür adı zorunludur.' });
    }
    if (controllerName.length < 2 || controllerAddress.length < 5
      || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(controllerEmail)) {
      return json(res, 400, { error: 'Veri sorumlusu unvanı, adresi ve geçerli başvuru e-postası zorunlu.' });
    }
    if (!validSlug(slug)) return json(res, 400, { error: 'Okul adresi 3-40 karakter olmalı; küçük harf, rakam ve tire kullanın.' });
    if (!NAME.test(username)) return json(res, 400, { error: 'Müdür kullanıcı adı 3-32 karakter olmalı.' });
    if (password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return json(res, 400, { error: 'Müdür parolası en az 8 karakter ve harf-rakam içermeli.' });
    }

    const schema = schemaForSlug(slug);
    await migrateTenantSchema(schema);
    const passwordHash = await sec.hashPasswordAsync(password);
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('select set_config(\'search_path\', $1, true)', [schema]);
      await client.query(`insert into school (id, name, city, year, controller_name, controller_address, controller_email, controller_phone)
        values (1, $1, $2, $3, $4, $5, $6, $7)`,
      [name, city, year, controllerName, controllerAddress, controllerEmail, controllerPhone]);
      await client.query(
        `insert into users (username, password_hash, name, role)
          values ($1, $2, $3, 'principal')`,
        [username, passwordHash, principalName],
      );
      await client.query(
        `insert into platform.schools (slug, schema_name, name, city, year)
          values ($1, $2, $3, $4, $5)`,
        [slug, schema, name, city, year],
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => {});
      if (error.code === '23505') return json(res, 409, { error: 'Bu okul adresi veya kullanıcı adı zaten kullanımda.' });
      throw error;
    } finally {
      client.release();
    }
    return json(res, 201, { school: { slug, name, city, year, url: schoolUrl(slug) } });
  }

  return json(res, 404, { error: 'Platform uç noktası bulunamadı.' });
}

module.exports = { bootstrapPlatformAdmin, handlePlatformApi, json };
