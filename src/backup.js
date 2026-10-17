// Zamanlanmış veritabanı yedeği: tabloları JSON olarak alır, gzip ile sıkıştırır ve BACKUP_KEY varsa
// AES-256-GCM ile şifreler. Son 30 yedek saklanır. Geçici tablolar (oturum/parola sıfırlama) yedeklenmez.
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { promisify } = require('node:util');
const { q } = require('./db');
const storage = require('./storage');

const gzip = promisify(zlib.gzip);
const SKIP_TABLES = new Set(['app_settings', 'push_subscriptions', 'password_resets', 'backups', 'ai_usage']);
const KEEP = 30;

function cipherKey() {
  return process.env.BACKUP_KEY ? crypto.createHash('sha256').update(process.env.BACKUP_KEY).digest() : null;
}

async function dumpDatabase() {
  const { rows: tables } = await q("select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name");
  const dump = { createdAt: new Date().toISOString(), tables: {} };
  for (const { table_name: name } of tables) {
    if (SKIP_TABLES.has(name)) continue;
    const { rows } = await q(`select * from "${name.replace(/"/g, '""')}"`);
    dump.tables[name] = rows;
  }
  return dump;
}

function encrypt(buffer, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

function decrypt(buffer, key) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, buffer.subarray(0, 12));
  decipher.setAuthTag(buffer.subarray(12, 28));
  return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]);
}

async function enforceRetention() {
  const { rows } = await q('select id, path from backups order by created_at desc offset $1', [KEEP]);
  for (const row of rows) {
    await storage.remove(row.path).catch(() => {});
    await q('delete from backups where id = $1', [row.id]);
  }
}

async function runBackup(reason = 'elle') {
  const packed = await gzip(Buffer.from(JSON.stringify(await dumpDatabase())));
  const key = cipherKey();
  if (!key) console.warn('Uyarı: BACKUP_KEY tanımlı değil, yedek şifrelenmeden kaydediliyor.');
  const payload = key ? encrypt(packed, key) : packed;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `backups/okulum-${stamp}.json.gz${key ? '.enc' : ''}`;
  await storage.put(path, payload, 'application/octet-stream');
  const { rows: [row] } = await q('insert into backups (path, size_bytes, encrypted) values ($1, $2, $3) returning id, created_at as "createdAt"',
    [path, payload.length, Boolean(key)]);
  await enforceRetention();
  return { id: row.id, path, sizeBytes: payload.length, encrypted: Boolean(key), createdAt: row.createdAt, reason };
}

async function listBackups() {
  const { rows } = await q('select id, path, size_bytes as "sizeBytes", encrypted, created_at as "createdAt" from backups order by created_at desc limit 60');
  return rows;
}

async function readBackup(id) {
  const { rows: [row] } = await q('select path, encrypted from backups where id = $1', [id]);
  if (!row) return null;
  return { buffer: await storage.get(row.path), name: row.path.split('/').pop(), encrypted: row.encrypted };
}

// Son yedek 24 saatten eskiyse yenisini alır. Saatte bir kontrol eder.
function startBackupSchedule() {
  const tick = async () => {
    const { rows: [last] } = await q('select created_at from backups order by created_at desc limit 1');
    if (!last || Date.now() - new Date(last.created_at).getTime() > 24 * 3600e3) await runBackup('zamanlanmış');
  };
  const safeTick = () => tick().catch(error => console.error('Yedek hatası:', error.message));
  setTimeout(safeTick, 60 * 1000).unref();
  setInterval(safeTick, 60 * 60 * 1000).unref();
}

module.exports = { runBackup, listBackups, readBackup, startBackupSchedule, decrypt, cipherKey };
