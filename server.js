const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { q, pool, withTenant } = require('./src/db');
const storage = require('./src/storage');
const { handleApi, toHttpError, HttpError } = require('./src/api');
const { createLimiter } = require('./src/security');
const seo = require('./src/seo');
const tenancy = require('./src/tenancy');
const platform = require('./src/platform');
// Ortak içerik (ES modülü): sunucu tarafında bir kez yüklenir
const contentReady = import(require('node:url').pathToFileURL(path.join(__dirname, 'public', 'content.mjs')).href);

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1');
const PUBLIC = fs.existsSync(path.join(__dirname, 'dist', 'index.html')) ? path.join(__dirname, 'dist') : path.join(__dirname, 'public');
const robotsPath = path.join(PUBLIC, 'robots.txt');
const ROBOTS = fs.readFileSync(fs.existsSync(robotsPath) ? robotsPath : path.join(__dirname, 'public', 'robots.txt'), 'utf8');
const BODY_LIMIT = 8 * 1024 * 1024;
// Varsayılanlar bilinçli olarak sıkı; Render panelinde env değişkenleriyle yükseltilebilir.
// Eski varsayılanlar (30000/dk, 3000/dk, 600/dk) tek bir IP'nin okulu çökertmesine
// veya anonim AI/eposta harcaması yapmasına izin verecek kadar yüksekti.
const IP_BACKSTOP = createLimiter({ max: Number(process.env.IP_RATE_PER_MIN || 1200), windowMs: 60 * 1000 });
const API_LIMIT = createLimiter({ max: Number(process.env.API_RATE_PER_MIN || 300), windowMs: 60 * 1000 });
const WRITE_LIMIT = createLimiter({ max: Number(process.env.WRITE_RATE_PER_MIN || 60), windowMs: 60 * 1000 });
// Oturumsuz istekler için ek katman: cookie yoksa IP daha sıkı sayılır.
const ANON_LIMIT = createLimiter({ max: Number(process.env.ANON_RATE_PER_MIN || 30), windowMs: 60 * 1000 });
const ANON_DAY_LIMIT = createLimiter({ max: Number(process.env.ANON_RATE_PER_DAY || 3000), windowMs: 24 * 60 * 60 * 1000 });
// ---- Kopyalama (HTTrack, wget, WebCopier vb.) koruması ----
const STATIC_LIMIT = createLimiter({ max: Number(process.env.STATIC_RATE_PER_MIN || 600), windowMs: 60 * 1000 });
const HASHED_ASSET = /\.[A-Za-z0-9]{8,}\.(js|css|woff2?|png|jpg)$/;
const BOT_UA = /httrack|webcopier|teleport|offline\s?explorer|sitesucker|webzip|webreaper|grab-site|getleft|website\s?quester|wget|scrapy|sitesnagger/i;
// Gizli tuzak: normal kullanıcı bu adresleri görmez; kopyalayıcılar bağlantıları izleyince yakalanır.
const TRAP = /^\/(gizli-dizin|wp-admin|wp-login\.php|\.env|\.git|phpmyadmin)(\/|$)/i;
const BAN_MS = 60 * 60 * 1000;
const bans = new Map();
const isBanned = key => (bans.get(key) ?? 0) > Date.now();
setInterval(() => { const now = Date.now(); for (const [key, until] of bans) if (until <= now) bans.delete(key); }, 10 * 60 * 1000).unref();
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

function sendNotFound(res, base) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(seo.notFoundPage(base));
}

function serveStatic(res, pathname, base) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const file = path.normalize(path.join(PUBLIC, requested));
  if (!file.startsWith(PUBLIC + path.sep)) return sendNotFound(res, base);
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) return sendNotFound(res, base);
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
  // Android APK (Trusted Web Activity): paket imzası doğrulaması için dijital varlık bağlantısı
  if (url.pathname === '/.well-known/assetlinks.json') {
    const fingerprint = (process.env.ANDROID_SHA256 || '').trim();
    if (!fingerprint) return send(res, 404, { error: 'Bulunamadı.' });
    return send(res, 200, [{
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: process.env.ANDROID_PACKAGE || 'com.okulum.app',
        sha256_cert_fingerprints: [fingerprint],
      },
    }]);
  }
  if (url.pathname === '/healthz') {
    try {
      const started = Date.now();
      await q('select 1');
      return send(res, 200, {
        ok: true,
        version: require('./package.json').version,
        db: 'ok',
        dbMs: Date.now() - started,
        storage: storage.useSupabase ? 'supabase' : 'local',
        uptimeSec: Math.round(process.uptime()),
      });
    } catch {
      return send(res, 503, { ok: false, error: 'Veritabanına ulaşılamıyor.' });
    }
  }

  // robots.txt ve site haritası her zaman yanıtlanır (yasak/bot filtresinden önce)
  const base = siteBase(req);
  if (url.pathname === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    return res.end(ROBOTS.replaceAll('{{SITE_URL}}', base));
  }
  if (url.pathname === '/ads.txt') {
    const pub = (process.env.ADSENSE_PUB || 'pub-8081727348742880').trim();
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    return res.end(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`);
  }
  if (url.pathname === '/sitemap.xml') {
    try {
      const schools = await tenancy.listSchools();
      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
      return res.end(seo.sitemap(base, schools));
    } catch (error) {
      console.error(new Date().toISOString(), 'site haritası', error);
      return send(res, 500, { error: 'Site haritası oluşturulamadı.' });
    }
  }
  // Yasaklı IP'ler ve kopyalama araçları tüm uygulamaya erişemez
  if (isBanned(key0)) return send(res, 403, { error: 'Erişim geçici olarak engellendi.' });
  if (BOT_UA.test(req.headers['user-agent'] || '')) {
    return send(res, 403, { error: 'Bu istemciye izin verilmiyor.' });
  }
  if (TRAP.test(url.pathname) && /googlebot|google-inspectiontool|bingbot/i.test(req.headers['user-agent'] || '')) {
    return send(res, 404, { error: 'Bulunamadı.' });
  }
  if (TRAP.test(url.pathname)) {
    bans.set(key0, Date.now() + BAN_MS);
    console.warn(new Date().toISOString(), 'kopyalama tuzağı tetiklendi:', key0, url.pathname);
    return send(res, 403, { error: 'Erişim engellendi.' });
  }
  if (url.pathname === '/platform' || url.pathname === '/platform/') {
    return serveStatic(res, '/platform.html', base);
  }
  if (url.pathname === '/api/schools' && req.method === 'GET') {
    try {
      return send(res, 200, { schools: await tenancy.listSchools() });
    } catch (error) {
      console.error(new Date().toISOString(), 'okul listesi', error);
      return send(res, 500, { error: 'Okul listesi yüklenemedi.' });
    }
  }
  if (url.pathname.startsWith('/api/platform/')) {
    try {
      if (!['GET', 'HEAD'].includes(req.method) && !sameOrigin(req)) return send(res, 403, { error: 'İstek kaynağı doğrulanamadı.' });
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
      return await platform.handlePlatformApi({ req, res, url, body });
    } catch (error) {
      console.error(new Date().toISOString(), 'platform API', error);
      return send(res, 500, { error: 'Platform işlemi tamamlanamadı.' });
    }
  }
  // Google için: gerçek adresli sayfalar, site haritası ve robots.txt
  if (url.pathname === '/gizlilik') {
    try {
      const schools = await tenancy.listSchools();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
      return res.end(seo.privacyPage(base, { schools }));
    } catch (error) {
      console.error(new Date().toISOString(), 'gizlilik sayfası', error);
      return send(res, 500, { error: 'Gizlilik sayfası hazırlanamadı.' });
    }
  }
  const schoolPrivacy = url.pathname.match(/^\/([a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9]))\/gizlilik\/?$/);
  if (schoolPrivacy) {
    try {
      const tenant = await tenancy.findSchoolBySlug(schoolPrivacy[1]);
      if (!tenant) return sendNotFound(res, base);
      const school = await withTenant(tenant.schema_name, async () => (await q(`select name, city, year,
        controller_name as "controllerName", controller_address as "controllerAddress",
        controller_email as "controllerEmail", controller_phone as "controllerPhone" from school where id = 1`)).rows[0]);
      if (!school) return sendNotFound(res, base);
      school.slug = tenant.slug;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
      return res.end(seo.privacyPage(base, { school, path: `/${tenant.slug}/gizlilik` }));
    } catch (error) {
      console.error(new Date().toISOString(), 'okul gizlilik sayfası', error);
      return send(res, 500, { error: 'Okulun gizlilik sayfası hazırlanamadı.' });
    }
  }
  if (url.pathname === '/kullanim' || url.pathname === '/hakkinda') {
    return contentReady.then(content => {
      const html = url.pathname === '/kullanim' ? seo.usagePage(base, content) : seo.aboutPage(base, content);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' });
      res.end(html);
    }).catch(() => send(res, 500, { error: 'Sayfa hazırlanamadı.' }));
  }

  const tenantApiMatch = url.pathname.match(/^\/([a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9]))\/api(\/.*)?$/);
  let tenantSchema = null;
  if (tenantApiMatch) {
    const school = await tenancy.findSchoolBySlug(tenantApiMatch[1]);
    if (!school) return sendNotFound(res, base);
    tenantSchema = school.schema_name;
    url.pathname = `/api${tenantApiMatch[2] || ''}`;
  } else if (url.pathname.startsWith('/api/')) {
    const { rows } = await pool.query('select schema_name from platform.schools');
    if (rows.length > 1) return send(res, 404, { error: 'İşlem için okul adresini kullanın.' });
    tenantSchema = rows[0]?.schema_name || 'public';
  } else {
    // Okul uygulama sayfası: `/slug` → `/slug/`'e yönlendir, `/slug/` → SPA'yı döndür.
    // Regex grup 2 = slug'dan sonraki bölüm (`undefined`, `''` ya da `/foo/...`).
    const schoolMatch = url.pathname.match(/^\/([a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9]))(\/.*)?$/);
    if (schoolMatch) {
      const school = await tenancy.findSchoolBySlug(schoolMatch[1]);
      if (!school) return sendNotFound(res, base);
      // `suffix` = '/' (trailing slash), '' (boş grup) ya da '/xyz/...' (alt yol).
      const suffix = schoolMatch[2] == null ? '' : schoolMatch[2];
      if (suffix && suffix !== '/') return sendNotFound(res, base);
      if (!suffix) {
        res.writeHead(308, { Location: `${tenancy.schoolUrl(school.slug)}${url.search}`, 'Cache-Control': 'public, max-age=300' });
        return res.end();
      }
      try {
        const html = await fs.promises.readFile(path.join(PUBLIC, 'index.html'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        return res.end(seo.schoolAppPage(html, base, school));
      } catch (error) {
        console.error(new Date().toISOString(), 'okul uygulama sayfası', error);
        return send(res, 500, { error: 'Okul sayfası hazırlanamadı.' });
      }
    }
  }

  if (!url.pathname.startsWith('/api/')) {
    if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, { error: 'Bu işlem desteklenmiyor.' });
    if (!HASHED_ASSET.test(url.pathname) && STATIC_LIMIT(key0)) return send(res, 429, { error: 'Çok fazla istek. Lütfen biraz bekleyin.' });
    return serveStatic(res, url.pathname, base);
  }
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  try {
    const key = clientKey(req);
    // Oturumu olan kullanıcılar kendi sınırlarıyla sayılır: aynı okul ağındaki herkes birbirini engellemez.
    const hasSession = Boolean(req.headers.cookie && req.headers.cookie.includes('okulum_session='));
    const sessionKey = req.headers.cookie
      ? `s:${require('node:crypto').createHash('sha256').update(req.headers.cookie).digest('hex').slice(0, 32)}`
      : key;
    const anonTripped = !hasSession && (ANON_LIMIT(key) || ANON_DAY_LIMIT(key));
    if (IP_BACKSTOP(key) || API_LIMIT(sessionKey) || anonTripped
      || (!['GET', 'HEAD'].includes(req.method) && WRITE_LIMIT(sessionKey))) {
      throw new HttpError(429, 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.');
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      if (!sameOrigin(req)) throw new HttpError(403, 'İstek kaynağı doğrulanamadı.');
      if (req.method !== 'DELETE' && !/application\/json/i.test(req.headers['content-type'] || '')) {
        throw new HttpError(415, 'JSON içerik türü gerekli.');
      }
    }
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
    const result = await withTenant(tenantSchema || 'public', () => handleApi({ req, res, url, body }));
    if (result && result.streamed) return; // akış yanıtı zaten gönderildi
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
      if (result.file.frameable) {
        // Pano PDF önizlemesi: yalnızca aynı site çerçevesinde gösterilebilir
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'self'");
      }
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

async function waitForDb({ maxDelayMs = 30_000, deadlineMs = 60_000 } = {}) {
  // Supabase anlık koparsa sürecin sonsuz restart-döngüsüne girmesini engeller:
  // üstel geri çekilme ile en fazla `deadlineMs` kadar sabreder, sonra patlar.
  const started = Date.now();
  let delay = 500;
  for (;;) {
    try { await q('select 1'); return; }
    catch (error) {
      const waited = Date.now() - started;
      if (waited >= deadlineMs) throw error;
      console.warn(`Veritabanına ulaşılamadı; ${delay}ms sonra tekrar denenecek (toplam ${waited}ms).`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, maxDelayMs);
    }
  }
}

async function start() {
  if (process.env.NODE_ENV === 'production' && !storage.useSupabase) {
    throw new Error('Üretimde SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY zorunlu (dosyalar Supabase Storage\'da tutulur).');
  }
  await waitForDb();
  await tenancy.initializeTenancy();
  await platform.bootstrapPlatformAdmin();
  await storage.ensureBucket();
  await require('./src/push').init();
  require('./src/ai').startRetention();
  require('./src/backup').startBackupSchedule();
  require('./src/api').startDigestSchedule();
  require('./src/api').startReminderSchedule();
  server.listen(PORT, HOST, () => {
    console.log(`Okulum hazır: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT} · depolama: ${storage.useSupabase ? 'Supabase' : 'yerel (geliştirme)'}`);
  });
}

function shutdown() {
  server.close(() => pool.end().then(() => process.exit(0)));
  setTimeout(() => process.exit(0), 5000).unref();
}
// Hata raporu: isteğe bağlı webhook (ERROR_WEBHOOK_URL, ör. Slack/Discord). Kullanıcı verisi gönderilmez.
// Aynı context 5 dakika içinde tekrar gelirse yutulur — boot-loop sırasında webhook'un patlamasını engeller.
const webhookSeen = new Map();
const WEBHOOK_COOLDOWN_MS = 5 * 60 * 1000;
function reportError(context, error) {
  console.error(new Date().toISOString(), context, error?.stack || error);
  const hook = process.env.ERROR_WEBHOOK_URL || '';
  if (!hook.startsWith('https://')) return;
  const last = webhookSeen.get(context) || 0;
  if (Date.now() - last < WEBHOOK_COOLDOWN_MS) return;
  webhookSeen.set(context, Date.now());
  if (webhookSeen.size > 200) for (const [k, t] of webhookSeen) if (Date.now() - t > WEBHOOK_COOLDOWN_MS) webhookSeen.delete(k);
  fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: `Okulum hatası · ${context} · ${error?.name || 'Hata'}` }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}
process.on('unhandledRejection', error => reportError('unhandledRejection', error));
process.on('uncaughtException', error => {
  reportError('uncaughtException', error);
  setTimeout(() => process.exit(1), 1000).unref(); // platform sunucuyu yeniden başlatır
});
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

if (require.main === module) {
  start().catch(error => {
    console.error('Başlatma hatası:', error.message);
    process.exit(1);
  });
}

module.exports = { server, start };
