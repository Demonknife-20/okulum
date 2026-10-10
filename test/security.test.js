const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLimiter } = require('../src/security');

test('hız sınırlayıcı: pencere içinde en fazla max istek, sonra engel', () => {
  const limited = createLimiter({ max: 3, windowMs: 60000 });
  assert.equal(limited('1.2.3.4'), false);
  assert.equal(limited('1.2.3.4'), false);
  assert.equal(limited('1.2.3.4'), false);
  assert.equal(limited('1.2.3.4'), true, 'dördüncü istek engellenir');
  assert.equal(limited('5.6.7.8'), false, 'başka IP etkilenmez');
});
