import { test } from 'node:test';
import assert from 'node:assert/strict';
import { springOscillator, springSeries, normalizeSortStep } from '../public/labs.js';

test('yay-kütle: periyot T = 2π√(m/k)', () => {
  const r = springOscillator(1, 4, 0.2);
  assert.equal(r.period, Number((2 * Math.PI / 2).toFixed(4)));
  assert.equal(r.omega, 2);
  assert.equal(r.maxSpeed, 0.4);
  assert.equal(r.maxEnergy, 0.08);
});

test('yay-kütle: kütle arttıkça periyot büyür, yay sabiti arttıkça küçülür', () => {
  assert.ok(springOscillator(4, 1, 0.1).period > springOscillator(1, 1, 0.1).period);
  assert.ok(springOscillator(1, 9, 0.1).period < springOscillator(1, 1, 0.1).period);
});

test('yay-kütle: geçersiz değerler hata verir', () => {
  assert.throws(() => springOscillator(0, 1, 0.1), /Kütle/);
  assert.throws(() => springOscillator(1, 0, 0.1), /Yay sabiti/);
  assert.throws(() => springOscillator(1, 1, -1), /Genlik/);
});

test('yay-kütle: seri başlangıçta x = A, iki periyot sonunda tekrar A', () => {
  const pts = springSeries(1, 4, 0.3, 400);
  assert.equal(pts[0].x, 0.3);
  const last = pts[pts.length - 1];
  assert.ok(Math.abs(last.x - 0.3) < 1e-2, `son nokta ${last.x}`);
  assert.ok(pts.every(p => Math.abs(p.x) <= 0.3 + 1e-9));
});

test('sıralama adımları ortak biçime çevrilir', () => {
  assert.deepEqual(normalizeSortStep({ array: [1], action: 'done' }).done, true);
  assert.equal(normalizeSortStep({ array: [1], action: 'swap' }).swapped, true);
  assert.equal(normalizeSortStep({ array: [1], action: 'compare' }).swapped, false);
  assert.equal(normalizeSortStep({ array: [1], compare: [0, 1], swapped: true }).compare.length, 2);
});
