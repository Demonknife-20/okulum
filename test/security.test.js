const { test } = require('node:test');
const assert = require('node:assert/strict');
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

test('güvenilir proxy arkasında dış host ve protokol proxy başlıklarından doğrulanır', () => {
  const previous = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = '1';
  const forwardedRequest = {
    headers: {
      host: 'okulum-internal.onrender.com',
      origin: 'https://okulum.example',
      'x-forwarded-host': 'okulum.example',
      'x-forwarded-proto': 'https',
    },
    socket: { encrypted: false },
  };
  try {
    assert.equal(sameOriginRequest(forwardedRequest), true);
    process.env.TRUST_PROXY = '0';
    assert.equal(sameOriginRequest(forwardedRequest), false, 'proxy host başlığına güven ancak TRUST_PROXY=1 iken verilir');
  } finally {
    if (previous === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previous;
  }
});

test('kişisel veri maskeleme: kimlik no, e-posta, telefon ve okul no gizlenir', () => {
  assert.equal(redact('TC 12345678901'), 'TC [kimlik no]');
  assert.equal(redact('mail ali@okul.k12.tr'), 'mail [e-posta]');
  assert.equal(redact('telefonum 0532 123 45 67'), 'telefonum [telefon]');
  assert.equal(redact('okul no: 1042 soruyorum'), '[okul no] soruyorum');
  assert.equal(redact('kesir nedir?'), 'kesir nedir?', 'normal metin değişmez');
});
