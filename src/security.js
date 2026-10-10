const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scryptAsync = promisify(crypto.scrypt);

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SESSION_MS = 12 * 60 * 60 * 1000;
const COOKIE = 'okulum_session';

const SECRET = process.env.SESSION_SECRET
  || (process.env.NODE_ENV === 'production' ? null : crypto.randomBytes(32).toString('hex'));
if (!SECRET) throw new Error('Üretimde SESSION_SECRET tanımlı olmalı.');

// ---- Parola ----
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64, SCRYPT).toString('hex')}`;
}

// Toplu işlemlerde paralel hesaplama için eşzamansız sürüm (olay döngüsünü tıkamaz).
async function hashPasswordAsync(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scryptAsync(password, salt, 64, SCRYPT);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [alg, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const actual = crypto.scryptSync(String(password), salt, 64, SCRYPT);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

// Kullanıcı bulunamadığında da aynı süre harcansın diye (zamanlama saldırısına karşı).
const DUMMY_HASH = hashPassword(crypto.randomBytes(12).toString('hex'));
const burnTime = password => verifyPassword(password, DUMMY_HASH);

// ---- Oturum (imzalı çerez) ----
const sign = data => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
const fingerprint = hash => crypto.createHash('sha256').update(hash).digest('hex').slice(0, 24);

function makeToken(user) {
  const body = Buffer.from(JSON.stringify({
    id: user.id,
    v: fingerprint(user.password_hash), // parola değişince eski oturumlar geçersiz olur
    s: user.session_version ?? 0,       // "tüm cihazlardan çıkış" bu sayıyı artırır
    e: Date.now() + SESSION_MS,
  })).toString('base64url');
  return `${body}.${sign(body)}`;
}

function readToken(token) {
  const [body, signature] = String(token || '').split('.');
  if (!body || !signature) return null;
  const given = Buffer.from(signature), expected = Buffer.from(sign(body));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    return data.e > Date.now() ? data : null;
  } catch {
    return null;
  }
}

const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
function setSessionCookie(res, user) {
  res.setHeader('Set-Cookie', `${COOKIE}=${makeToken(user)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS / 1000}${secureFlag}`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`);
}
function readCookie(req, name = COOKIE) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

// ---- Hız sınırı (yalnızca başarısız girişler sayılır) ----
const WINDOW_MS = 15 * 60 * 1000, LIMIT = 10;
const failures = new Map();
function isLimited(key) {
  const entry = failures.get(key);
  return Boolean(entry && entry.reset > Date.now() && entry.count >= LIMIT);
}
function recordFailure(key) {
  const now = Date.now();
  const entry = failures.get(key);
  if (!entry || entry.reset <= now) failures.set(key, { count: 1, reset: now + WINDOW_MS });
  else entry.count += 1;
}
function clearFailures(key) { failures.delete(key); }
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of failures) if (entry.reset <= now) failures.delete(key);
}, 10 * 60 * 1000).unref();

// Basit sabit pencereli sınırlayıcı. Anahtar başına, pencere içinde en fazla `max` istek.
function createLimiter({ max, windowMs }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
  }, 60 * 1000).unref();
  return key => {
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) { entry = { count: 0, reset: now + windowMs }; hits.set(key, entry); }
    entry.count += 1;
    return entry.count > max;
  };
}


// Kişisel veriyi yapay zekâya göndermeden maskeler (T.C. kimlik, e-posta, telefon, okul no).
const REDACTIONS = [
  [/\b[1-9]\d{10}\b/g, '[kimlik no]'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[e-posta]'],
  [/(\+?90[\s-]?)?0?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g, '[telefon]'],
  [/okul\s*no\s*[:=]?\s*\d+/gi, '[okul no]'],
];
function redact(text) {
  let out = String(text ?? '');
  for (const [pattern, replacement] of REDACTIONS) out = out.replace(pattern, replacement);
  return out;
}

module.exports = {
  redact,
  createLimiter,
  COOKIE, hashPassword, hashPasswordAsync, verifyPassword, burnTime, fingerprint,
  readToken, setSessionCookie, clearSessionCookie, readCookie,
  isLimited, recordFailure, clearFailures,
};
