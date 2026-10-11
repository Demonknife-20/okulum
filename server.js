const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { migrate, q, pool } = require('./src/db');
const storage = require('./src/storage');
const { handleApi, toHttpError, HttpError } = require('./src/api');
const { createLimiter } = require('./src/security');
const seo = require('./src/seo');
// Ortak içerik (ES modülü): sunucu tarafında bir kez yüklenir
const contentReady = import(require('node:url').pathToFileURL(path.join(__dirname, 'public', 'content.mjs')).href);

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1');
const PUBLIC = fs.existsSync(path.join(__dirname, 'dist', 'index.html')) ? path.join(__dirname, 'dist') : path.join(__dirname, 'public');
const BODY_LIMIT = 8 * 1024 * 1024;
const API_LIMIT = createLimiter({ max: Number(process.env.API_RATE_PER_MIN || 900), windowMs: 60 * 1000 });
const WRITE_LIMIT = createLimiter({ max: Number(process.env.WRITE_RATE_PER_MIN || 240), windowMs: 60 * 1000 });
// ---- Kopyalama (HTTrack, wget, WebCopier vb.) koruması ----
const STATIC_LIMIT = createLimiter({ max: Number(process.env.STATIC_RATE_PER_MIN || 600), windowMs: 60 * 1000 });
const BOT_UA = /httrack|webcopier|teleport|offline\s?explorer|sitesucker|webzip|webreaper|grab-site|getleft|website\s?quester|wget|scrapy|sitesnagger/i;
// Gizli tuzak: normal kullanıcı bu adresleri görmez; kopyalayıcılar bağlantıları izleyince yakalanır.
const TRAP = /^\/(gizli-dizin|wp-admin|wp-login\.php|\.env|\.git|phpmyadmin)(\/|$)/i;
const BAN_MS = 60 * 60 * 1000;
const bans = new Map();
const isBanned = key => (bans.get(key) ?? 0) > Date.now();
setInterval(() => { const now = Date.now(); for (const [key, until] of bans) if (until <= now) bans.delete(key); }, 10 * 60 * 1000).unref();
const ROBOTS = `User-agent: *
Disallow: /api/
Disallow: /gizli-dizin/
Crawl-delay: 10
`;
// Site adresi: PUBLIC_URL tanımlıysa o, değilse istek adresi (Render'da https).
const siteBase = req => {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  return `${proto}://${req.headers['x-forwarded-host'] || req.headers.host || 'localhost'}`;
};
const clientKey = req => {
  if (process.env.TRUST_PROXY) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress || 'unknown';
};
const MIME = {
  '.mjs': 'text/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};
const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': [
    "default-src 'self'", "script-src 'self'", "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data:", "connect-src 'self'",
    "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
  ].join('; '),
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    return host === req.headers.host || host === req.headers['x-forwarded-host'];
  } catch {
    return false;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > BODY_LIMIT) { reject(new HttpError(413, 'İstek boyutu çok büyük.')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!size) return resolve({});
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
      } catch {
        reject(new HttpError(400, 'Geçerli bir JSON gönderilmeli.'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const file = path.normalize(path.join(PUBLIC, requested));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 404, { error: 'Bulunamadı.' });
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) return send(res, 404, { error: 'Bulunamadı.' });
    const hashed = /\.[A-Za-z0-9]{8,}\.(js|css)$/.test(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  for (const [key, value] of Object.entries(SECURITY)) res.setHeader(key, value);
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  const url = new URL(req.url, 'http://localhost');

  const key0 = clientKey(req);
  if (url.pathname === '/healthz') {
    try {
      await q('select 1');
      return send(res, 200, { ok: true, storage: storage.useSupabase ? 'supabase' : 'local' });
    } catch {
      return send(res, 503, { ok: false, error: 'Veritabanına ulaşılamıyor.' });
    }
  }

  // Yasaklı IP'ler ve kopyalama araçları tüm uygulamaya erişemez
  if (isBanned(key0)) return send(res, 403, { error: 'Erişim geçici olarak engellendi.' });
  if (BOT_UA.test(req.headers['user-agent'] || '')) {
    return send(res, 403, { error: 'Bu istemciye izin verilmiyor.' });
  }
  if (TRAP.test(url.pathname)) {
    bans.set(key0, Date.now() + BAN_MS);
    console.warn(new Date().toISOString(), 'kopyalama tuzağı tetiklendi:', key0, url.pathname);
    return send(res, 403, { error: 'Erişim engellendi.' });
  }
  // Google için: gerçek adresli sayfalar, site haritası ve robots.txt
  const base = siteBase(req);
  if (url.pathname === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    return res.end(seo.robots(base));
  }
  if (url.pathname === '/sitemap.xml') {
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    return res.end(seo.sitemap(base));
  }
  if (url.pathname === '/kullanim' || url.pathname === '/hakkinda') {
    return contentReady.then(content => {
      const html = url.pathname === '/kullanim' ? seo.usagePage(base, content) : seo.aboutPage(base, content);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' });
      res.end(html);
    }).catch(() => send(res, 500, { error: 'Sayfa hazırlanamadı.' }));
  }

  if (!url.pathname.startsWith('/api/')) {
    if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, { error: 'Bu işlem desteklenmiyor.' });
    if (STATIC_LIMIT(key0)) return send(res, 429, { error: 'Çok fazla istek. Lütfen biraz bekleyin.' });
    return serveStatic(res, url.pathname);
  }
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  try {
    const key = clientKey(req);
    if (API_LIMIT(key) || (!['GET', 'HEAD'].includes(req.method) && WRITE_LIMIT(key))) {
      throw new HttpError(429, 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.');
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      if (!sameOrigin(req)) throw new HttpError(403, 'İstek kaynağı doğrulanamadı.');
      if (req.method !== 'DELETE' && !/application\/json/i.test(req.headers['content-type'] || '')) {
        throw new HttpError(415, 'JSON içerik türü gerekli.');
      }
    }
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
    const result = await handleApi({ req, res, url, body });
    if (result.csv) {
      const { body, filename } = result.csv;
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'private, no-store',
      });
      return res.end(body);
    }
    if (result.file) {
      const { buffer, mime, name, inline } = result.file;
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': buffer.length,
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, no-store',
      });
      return res.end(buffer);
    }
    return send(res, result.status || 200, result.body ?? {});
  } catch (error) {
    const mapped = toHttpError(error);
    if (mapped) return send(res, mapped.status, { error: mapped.message });
    console.error(new Date().toISOString(), req.method, url.pathname, error);
    return send(res, 500, { error: 'Beklenmeyen bir hata oluştu.' });
  }
});

async function start() {
  if (process.env.NODE_ENV === 'production' && !storage.useSupabase) {
    throw new Error('Üretimde SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY zorunlu (dosyalar Supabase Storage\'da tutulur).');
  }
  await migrate();
  await storage.ensureBucket();
  require('./src/ai').startRetention();
  server.listen(PORT, HOST, () => {
    console.log(`Okulum hazır: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT} · depolama: ${storage.useSupabase ? 'Supabase' : 'yerel (geliştirme)'}`);
  });
}

function shutdown() {
  server.close(() => pool.end().then(() => process.exit(0)));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

if (require.main === module) {
  start().catch(error => {
    console.error('Başlatma hatası:', error.message);
    process.exit(1);
  });
}

module.exports = { server, start };
