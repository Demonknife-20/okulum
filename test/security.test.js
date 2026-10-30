const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createLimiter, redact, sameOriginRequest } = require('../src/security');

test('hız sınırlayıcı: pencere içinde en fazla max istek, sonra engel', () => {
  const limited = createLimiter({ max: 3, windowMs: 60000 });
  assert.equal(limited('1.2.3.4'), false);
  assert.equal(limited('1.2.3.4'), false);
  assert.equal(limited('1.2.3.4'), false);
  assert.equal(limited('1.2.3.4'), true, 'dördüncü istek engellenir');
  assert.equal(limited('5.6.7.8'), false, 'başka IP etkilenmez');
});

test('hız sınırlayıcı: farklı anahtarlar sınırlayıcı belleğini sınırsız büyütmez', () => {
  const limited = createLimiter({ max: 1, windowMs: 60000 });
  for (let i = 0; i < 12000; i += 1) limited(`source-${i}`);
  assert.equal(limited('source-11999'), true, 'son anahtarın sayacı korunur');
  assert.equal(limited('new-source'), false, 'yeni kaynak için alan açılır');
});

test('durum değiştiren istekler aynı-origin olmalı; Origin/Referer eksik veya çapraz kaynaklıysa reddedilir', () => {
  const request = headers => ({
    headers: { host: 'okulum.example', ...headers },
    socket: { encrypted: true },
  });
  assert.equal(sameOriginRequest(request({ origin: 'https://okulum.example' })), true);
  assert.equal(sameOriginRequest(request({ referer: 'https://okulum.example/login' })), true);
  assert.equal(sameOriginRequest(request({ origin: 'https://attacker.example' })), false);
  assert.equal(sameOriginRequest(request({ origin: 'http://okulum.example' })), false);
  assert.equal(sameOriginRequest(request({ origin: 'https://okulum.example', 'sec-fetch-site': 'cross-site' })), false);
  assert.equal(sameOriginRequest(request({})), false);
});

test('kişisel veri maskeleme: kimlik no, e-posta, telefon ve okul no gizlenir', () => {
  assert.equal(redact('TC 12345678901'), 'TC [kimlik no]');
  assert.equal(redact('mail ali@okul.k12.tr'), 'mail [e-posta]');
  assert.equal(redact('telefonum 0532 123 45 67'), 'telefonum [telefon]');
  assert.equal(redact('okul no: 1042 soruyorum'), '[okul no] soruyorum');
  assert.equal(redact('kesir nedir?'), 'kesir nedir?', 'normal metin değişmez');
});

test('şema ve migrasyonlarda oluşturulan her uygulama tablosu için RLS açılır', () => {
  const root = path.join(__dirname, '..', 'src');
  const files = [
    path.join(root, 'schema.sql'),
    ...fs.readdirSync(path.join(root, 'migrations'))
      .filter(file => file.endsWith('.sql'))
      .map(file => path.join(root, 'migrations', file)),
  ];
  const sql = files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
  const created = new Set([...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi)].map(match => match[1].toLowerCase()));
  const secured = new Set([...sql.matchAll(/alter\s+table\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+enable\s+row\s+level\s+security/gi)].map(match => match[1].toLowerCase()));
  for (const table of created) assert.ok(secured.has(table), `${table} için RLS açılmamış`);
  assert.match(sql, /alter\s+table\s+schema_migrations\s+enable\s+row\s+level\s+security/i);
});
