import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quadraticRoots, solveLinearSystem, triangleFromSides, describeNumbers, percentChange, compoundGrowth, primeFactors, gcdLcm, combinatorics } from '../public/math-tools.js';

test('ikinci derece: iki kök, çakışık, karmaşık', () => {
  const r = quadraticRoots(1, -3, 2);
  assert.deepEqual([r.x1, r.x2].sort(), [1, 2]);
  assert.equal(quadraticRoots(1, -2, 1).type, 'çakışık (tek) kök');
  const c = quadraticRoots(1, 0, 1);
  assert.equal(c.type, 'karmaşık kökler');
  assert.equal(c.imagPart, 1);
  assert.throws(() => quadraticRoots(0, 1, 1), /ikinci/);
});

test('doğrusal sistem: çözüm ve tekil durum', () => {
  const s = solveLinearSystem(1, 1, 3, 1, -1, 1);
  assert.equal(s.x, 2);
  assert.equal(s.y, 1);
  assert.throws(() => solveLinearSystem(1, 2, 3, 2, 4, 6), /determinant/i);
});

test('üçgen: alan, çevre, açı toplamı ve tür', () => {
  const t = triangleFromSides(3, 4, 5);
  assert.equal(t.area, 6);
  assert.equal(t.perimeter, 12);
  assert.equal(t.type, 'dik üçgen');
  assert.ok(Math.abs(t.angles.reduce((s, v) => s + v, 0) - 180) < 0.05);
  assert.throws(() => triangleFromSides(1, 2, 10), /çizilemez/);
});

test('istatistik: ortalama, medyan, standart sapma', () => {
  const d = describeNumbers([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.equal(d.mean, 5);
  assert.equal(d.median, 4.5);
  assert.equal(d.range, 7);
  assert.throws(() => describeNumbers([]), /sayı/);
});

test('yüzde değişim ve bileşik faiz', () => {
  assert.equal(percentChange(50, 75), 50);
  assert.equal(percentChange(80, 60), -25);
  assert.throws(() => percentChange(0, 5), /sıfır/);
  const g = compoundGrowth(1000, 10, 2);
  assert.equal(g.amount, 1210);
  assert.equal(g.interest, 210);
});

test('asal çarpanlar, EBOB ve EKOK, kombinasyon', () => {
  assert.deepEqual(primeFactors(360), [2, 2, 2, 3, 3, 5]);
  assert.deepEqual(gcdLcm(12, 18), { gcd: 6, lcm: 36 });
  const c = combinatorics(5, 2);
  assert.equal(c.permutations, 20);
  assert.equal(c.combinations, 10);
  assert.throws(() => combinatorics(3, 5), /büyük/);
});

import { quadraticSteps } from '../public/math-tools.js';

test('adım adım çözüm: iki gerçek kök adımları', () => {
  const s = quadraticSteps(1, -3, 2);
  assert.equal(s.length, 5);
  assert.ok(s.some(l => l.includes('= 1')));
  assert.ok(s.at(-1).includes('x₁ = 2') || s.at(-1).includes('x₁ = 1'));
});

test('adım adım çözüm: çakışık ve karmaşık durumlar', () => {
  assert.ok(quadraticSteps(1, -2, 1).some(l => l.includes('tek')));
  assert.ok(quadraticSteps(1, 0, 1).some(l => l.includes('karmaşık')));
  assert.throws(() => quadraticSteps(0, 1, 1), /ikinci/);
});
