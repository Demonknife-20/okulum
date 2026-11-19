// Güvenlik fonksiyonlarının birim testleri (ağ ve veritabanı gerektirmez).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sec from '../src/security.js';

test('parola: doğru parola kabul, yanlış parola reddedilir', () => {
  const h = sec.hashPassword('Gizli-parola-1');
  assert.equal(sec.verifyPassword('Gizli-parola-1', h), true);
  assert.equal(sec.verifyPassword('Gizli-parola-2', h), false);
  assert.equal(sec.verifyPassword('', h), false);
});

test('parola: aynı parola her seferinde farklı özetlenir (rastgele tuz)', () => {
  assert.notEqual(sec.hashPassword('ayni-parola-1'), sec.hashPassword('ayni-parola-1'));
});

test('parola: özet düz metin içermez', () => {
  const h = sec.hashPassword('cok-gizli-kelime');
  assert.ok(!h.includes('cok-gizli-kelime'));
});

test('oturum çerezi: HttpOnly ve SameSite=Lax ile yazılır', () => {
  let header = '';
  const res = { setHeader: (_, value) => { header = value; } };
  sec.setSessionCookie(res, { id: 'u1', password_hash: 'h', session_version: 0 });
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
});

test('oturum çerezi: değiştirilmiş jeton kabul edilmez', () => {
  let header = '';
  sec.setSessionCookie({ setHeader: (_, v) => { header = v; } }, { id: 'u1', password_hash: 'h', session_version: 0 });
  const token = header.split(';')[0].split('=').slice(1).join('=');
  const genuine = sec.readToken(token);
  assert.ok(genuine && genuine.id === 'u1', 'gerçek jeton okunmalı');
  const tampered = token.slice(0, -2) + (token.slice(-2) === 'AA' ? 'BB' : 'AA');
  assert.equal(sec.readToken(tampered), null);
});

test('deneme sınırı: çok fazla başarısız deneme sonrası kilitlenir', () => {
  const key = `test-limit-${Math.random()}`;
  for (let i = 0; i < 50; i += 1) sec.recordFailure(key);
  assert.equal(sec.isLimited(key), true);
  sec.clearFailures(key);
  assert.equal(sec.isLimited(key), false);
});
