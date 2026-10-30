const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLimiter, redact } = require('../src/security');

test('hız sınırlayıcı: pencere içinde en fazla max istek, sonra engel', () => {
  const limited = createLimiter({ max: 3, windowMs: 60000 });
  assert.equal(limited('1.2.3.4'), false);
  assert.equal(limited('1.2.3.4'), false);
  assert.equal(limited('1.2.3.4'), false);
  assert.equal(limited('1.2.3.4'), true, 'dördüncü istek engellenir');
  assert.equal(limited('5.6.7.8'), false, 'başka IP etkilenmez');
});

test('kişisel veri maskeleme: kimlik no, e-posta, telefon ve okul no gizlenir', () => {
  assert.equal(redact('TC 12345678901'), 'TC [kimlik no]');
  assert.equal(redact('mail ali@okul.k12.tr'), 'mail [e-posta]');
  assert.equal(redact('telefonum 0532 123 45 67'), 'telefonum [telefon]');
  assert.equal(redact('okul no: 1042 soruyorum'), '[okul no] soruyorum');
  assert.equal(redact('kesir nedir?'), 'kesir nedir?', 'normal metin değişmez');
});
