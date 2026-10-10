const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = process.env.SUPABASE_BUCKET || 'okulum-files';
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const useSupabase = Boolean(SB_URL && SB_KEY);
const localRoot = path.join(__dirname, '..', 'data', 'uploads');

// Uzantı -> içerik türü ve dosya imzası (magic bytes). İkisi de tutmalı.
const TYPES = {
  pdf: { mime: 'application/pdf', test: b => b.subarray(0, 4).toString('latin1') === '%PDF' },
  png: { mime: 'image/png', test: b => b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) },
  jpg: { mime: 'image/jpeg', test: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', test: b => b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) },
  doc: { mime: 'application/msword', test: b => b.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex')) },
};
TYPES.jpeg = TYPES.jpg;

class UploadError extends Error {}

// {name, data(base64)} -> { buffer, mime, ext, name }
function parseUpload(file) {
  if (!file || typeof file.name !== 'string' || typeof file.data !== 'string') throw new UploadError('Geçerli bir dosya gönderilmedi.');
  const buffer = Buffer.from(file.data.replace(/^data:[^,]*,/, ''), 'base64');
  if (!buffer.length) throw new UploadError('Dosya boş.');
  if (buffer.length > MAX_BYTES) throw new UploadError('Dosya 5 MB sınırını aşıyor.');
  const name = path.basename(file.name).slice(-120) || 'dosya';
  const ext = path.extname(name).slice(1).toLowerCase();
  const type = TYPES[ext];
  if (!type) throw new UploadError('Yalnızca PDF, Word (.doc/.docx) veya JPG/PNG dosyası yüklenebilir.');
  if (!type.test(buffer)) throw new UploadError('Dosya içeriği uzantısıyla uyuşmuyor.');
  return { buffer, mime: type.mime, ext, name };
}

const safeName = name => name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(-80) || 'dosya';
const newPath = (kind, ext, name) => `${kind}/${crypto.randomUUID()}/${safeName(name).replace(/\.[^.]+$/, '')}.${ext}`;

async function put(storagePath, buffer, mime) {
  if (useSupabase) {
    const res = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': mime, 'Cache-Control': 'private, max-age=0' },
      body: buffer,
    });
    if (!res.ok) throw new Error(`Depolama yüklemesi başarısız (${res.status}).`);
    return;
  }
  const file = path.join(localRoot, storagePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buffer);
}

async function get(storagePath) {
  if (useSupabase) {
    const res = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    if (!res.ok) throw new Error(`Dosya alınamadı (${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFileSync(path.join(localRoot, storagePath));
}

async function remove(storagePath) {
  if (!storagePath) return;
  try {
    if (useSupabase) {
      await fetch(`${SB_URL}/storage/v1/object/${BUCKET}`, {
        method: 'DELETE',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: [storagePath] }),
      });
    } else {
      fs.rmSync(path.join(localRoot, storagePath), { force: true });
    }
  } catch (error) {
    console.error('Dosya silinemedi:', storagePath, error.message);
  }
}

// Kova yoksa oluşturur (özel, 5 MB sınırlı). Zaten varsa sessizce geçer.
async function ensureBucket() {
  if (!useSupabase) return;
  try {
    const res = await fetch(`${SB_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: MAX_BYTES }),
    });
    if (res.ok) console.log(`Supabase kovası oluşturuldu: ${BUCKET}`);
    else if (res.status !== 409 && res.status !== 400) console.warn(`Kova kontrolü uyarısı (${res.status}). Kovayı Supabase panelinden "${BUCKET}" adıyla özel olarak oluşturun.`);
  } catch (error) {
    console.warn('Kova kontrolü yapılamadı:', error.message);
  }
}

module.exports = { UploadError, parseUpload, newPath, put, get, remove, ensureBucket, useSupabase, MAX_BYTES };
