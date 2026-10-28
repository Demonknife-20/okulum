// İki adımlı doğrulama (TOTP, RFC 6238): SHA-1, 6 hane, 30 saniye. Gizli anahtar veritabanında şifreli saklanır.
const crypto = require('node:crypto');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = 0, value = 0, out = '';
  for (const byte of buffer) {
    value = ((value << 8) | byte) & 0xffffff;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text) {
  let bits = 0, value = 0;
  const out = [];
  for (const ch of String(text).toUpperCase().replace(/=+$/, '')) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = ((value << 5) | idx) & 0xffffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function newSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function totpAt(secret, counter) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 1000000).padStart(6, '0');
}

// Kayma payı: bir önceki ve sonraki 30 saniyelik dilim de kabul edilir (saat farkları için).
<<<<<<< Updated upstream
// Eşleşen 30 saniyelik zaman adımını döndürür; eşleşme yoksa null
function matchStep(secret, code, window = 1) {
  const value = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(value)) return null;
  const counter = Math.floor(Date.now() / 30000);
  for (let step = -window; step <= window; step += 1) {
    if (totpAt(secret, counter + step) === value) return counter + step;
  }
  return null;
}

function verifyTotp(secret, code, window = 1) {
  return matchStep(secret, code, window) !== null;
=======
function verifyTotp(secret, code, window = 1) {
  const value = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(value)) return false;
  const counter = Math.floor(Date.now() / 30000);
  for (let step = -window; step <= window; step += 1) {
    if (totpAt(secret, counter + step) === value) return true;
  }
  return false;
>>>>>>> Stashed changes
}

function otpauthUri(secret, account) {
  return `otpauth://totp/${encodeURIComponent(`Okulum:${account}`)}?secret=${secret}&issuer=Okulum&algorithm=SHA1&digits=6&period=30`;
}

const storeKey = () => crypto.createHash('sha256').update(`${process.env.SESSION_SECRET || 'gelistirme'}:totp`).digest();

function sealSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', storeKey(), iv);
  const body = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

function openSecret(sealed) {
  const buffer = Buffer.from(sealed, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', storeKey(), buffer.subarray(0, 12));
  decipher.setAuthTag(buffer.subarray(12, 28));
  return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString('utf8');
}

<<<<<<< Updated upstream
module.exports = { base32Encode, newSecret, totpAt, verifyTotp, matchStep, otpauthUri, sealSecret, openSecret };
=======
module.exports = { base32Encode, newSecret, totpAt, verifyTotp, otpauthUri, sealSecret, openSecret };
>>>>>>> Stashed changes
