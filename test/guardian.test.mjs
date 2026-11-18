import { test } from 'node:test';
import assert from 'node:assert/strict';
import g from '../src/guardian.js';

test('veli kullanıcı adı: öğrenci adına veli_ eklenir', () => {
  assert.equal(g.parentUsernameFor('ali'), 'veli_ali');
  assert.equal(g.isGuardianOf('veli_ali', 'ali'), true);
  assert.equal(g.isGuardianOf('veli_ayse', 'ali'), false);
});

test('uzun öğrenci adlarında veli oluşturulamaz (32 karakter sınırı)', () => {
  assert.equal(g.canHaveGuardian('a'.repeat(27)), true);
  assert.equal(g.canHaveGuardian('a'.repeat(28)), false);
  assert.equal(g.canHaveGuardian('ali'), true);
});

test('geçersiz öğrenci adı veli kabul etmez', () => {
  assert.equal(g.canHaveGuardian('Ali Y'), false);
  assert.equal(g.canHaveGuardian('ab'), false);
});

test('veli görünen adı', () => {
  assert.equal(g.guardianNameFor('Ali Yılmaz'), 'Ali Yılmaz (veli)');
});
