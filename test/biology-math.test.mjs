import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePolynomial, polynomialRoots } from '../public/math-tools.js';
import { microscopeField, seededRandom } from '../public/biology.js';

test('polinom değeri: x² − 4 at x = 3 → 5', () => {
  assert.equal(evaluatePolynomial([1, 0, -4], 3), 5);
});

test('polinom kökleri: x² − 4 → −2 ve 2', () => {
  assert.deepEqual(polynomialRoots([1, 0, -4], -5, 5), [-2, 2]);
});

test('polinom kökleri: x³ − x → −1, 0, 1', () => {
  const r = polynomialRoots([1, 0, -1, 0], -2, 2);
  assert.deepEqual(r.map(v => Math.round(v * 1000) / 1000), [-1, 0, 1]);
});

test('polinom: gerçek kökü olmayan ifade boş döner', () => {
  assert.deepEqual(polynomialRoots([1, 0, 1], -5, 5), []);
});

test('mikroskop: büyütme objektif × 10 ve tohum tekrar üretilebilir', () => {
  const a = microscopeField({ objective: 40, seed: 3 });
  const b = microscopeField({ objective: 40, seed: 3 });
  assert.equal(a.total, 400);
  assert.deepEqual(a.cells, b.cells);
  assert.ok(microscopeField({ objective: 100 }).fieldUm < microscopeField({ objective: 10 }).fieldUm);
});

test('rastgele üreteç 0 ile 1 arasında değer verir', () => {
  const r = seededRandom(42);
  for (let i = 0; i < 100; i += 1) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
  }
});
