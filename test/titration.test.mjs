import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titrationState } from '../public/titration.js';

test('titrasyon: başta asit pH düşük (≈0,7 değil ama asidik)', () => {
  const s = titrationState({ acidMl: 20, acidM: 0.1, baseMl: 0, baseM: 0.1 });
  assert.ok(s.pH < 3);
  assert.equal(s.endpointReached, false);
});

test('titrasyon: dönüm noktasında pH ≈ 7 ve dönüm noktası işaretlenir', () => {
  const s = titrationState({ acidMl: 20, acidM: 0.1, baseMl: 20, baseM: 0.1 });
  assert.equal(s.equivalenceMl, 20);
  assert.equal(s.endpointReached, true);
  assert.ok(Math.abs(s.pH - 7) < 0.1);
});

test('titrasyon: dönüm noktasını aşınca fenolftalein pembe ve pH > 10', () => {
  const s = titrationState({ acidMl: 20, acidM: 0.1, baseMl: 25, baseM: 0.1 });
  assert.equal(s.phenolphthaleinPink, true);
  assert.ok(s.pH > 10);
});

test('titrasyon: geçersiz girdi hata verir', () => {
  assert.throws(() => titrationState({ acidMl: 0, acidM: 0.1, baseMl: 1, baseM: 0.1 }), /Asit hacmi/);
  assert.throws(() => titrationState({ acidMl: 10, acidM: 0.1, baseMl: -1, baseM: 0.1 }), /negatif/);
});
