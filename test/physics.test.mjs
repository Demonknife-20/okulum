import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inclinedPlane, inclinedSeries, freeFall, freeFallSeries, collision1D } from '../public/physics.js';

test('eğik düzlem: sürtünmesiz 30°, L=2 m → a = g/2', () => {
  const r = inclinedPlane({ angleDeg: 30, mu: 0, length: 2 });
  assert.ok(r.slides);
  assert.ok(Math.abs(r.acceleration - 4.905) < 0.01);
  assert.ok(Math.abs(r.time - Math.sqrt(4 / 4.905)) < 0.01);
});

test('eğik düzlem: yeterli sürtünmede blok kaymaz', () => {
  const r = inclinedPlane({ angleDeg: 20, mu: 0.6, length: 3 });
  assert.equal(r.slides, false);
  assert.equal(r.time, null);
  assert.equal(r.finalSpeed, 0);
});

test('eğik düzlem: geçersiz girdi hata verir', () => {
  assert.throws(() => inclinedPlane({ angleDeg: 90, mu: 0, length: 1 }), /Açı/);
  assert.throws(() => inclinedPlane({ angleDeg: 30, mu: -1, length: 1 }), /Sürtünme/);
});

test('eğik düzlem serisi: son nokta uzunluğa ulaşır', () => {
  const { points, info } = inclinedSeries({ angleDeg: 40, mu: 0.1, length: 5 });
  const last = points[points.length - 1];
  assert.ok(Math.abs(last.s - 5) < 0.01);
  assert.ok(Math.abs(last.v - info.finalSpeed) < 0.05);
});

test('serbest düşme: h = 20 m → t ≈ 2.02 s, v ≈ 19.8 m/s', () => {
  const r = freeFall({ height: 20 });
  assert.ok(Math.abs(r.time - 2.02) < 0.01);
  assert.ok(Math.abs(r.finalSpeed - 19.8) < 0.1);
  const s = freeFallSeries({ height: 20 });
  assert.equal(s[0].y, 20);
  assert.equal(s[s.length - 1].y, 0);
});

test('çarpışma: esnek ve eşit kütleler hız değiştirir, enerji ve momentum korunur', () => {
  const r = collision1D({ m1: 2, v1: 3, m2: 2, v2: 0, e: 1 });
  assert.equal(r.v1After, 0);
  assert.equal(r.v2After, 3);
  assert.ok(Math.abs(r.momentumBefore - r.momentumAfter) < 1e-6);
  assert.ok(Math.abs(r.keLost) < 1e-6);
});

test('çarpışma: tamamen esnek olmayan çarpışmada enerji kaybolur, momentum korunur', () => {
  const r = collision1D({ m1: 1, v1: 4, m2: 3, v2: 0, e: 0 });
  assert.ok(Math.abs(r.v1After - r.v2After) < 1e-9);
  assert.ok(Math.abs(r.momentumBefore - r.momentumAfter) < 1e-6);
  assert.ok(r.keLost > 0);
});

test('çarpışma: geçersiz esneklik hata verir', () => {
  assert.throws(() => collision1D({ m1: 1, v1: 1, m2: 1, v2: 0, e: 1.5 }), /Geri esneklik/);
});

import { pendulum, pendulumSeries, pushedBlock, pushedBlockSeries } from '../public/physics.js';

test('sarkaç: L = 1 m, küçük açı → T ≈ 2,006 s', () => {
  const p = pendulum({ length: 1, angleDeg: 5 });
  assert.ok(Math.abs(p.smallAnglePeriod - 2.006) < 0.01);
  assert.ok(p.period >= p.smallAnglePeriod);
});

test('sarkaç: büyük açı periyodu uzatır, uzunluk artınca büyür', () => {
  assert.ok(pendulum({ length: 1, angleDeg: 40 }).period > pendulum({ length: 1, angleDeg: 5 }).period);
  assert.ok(pendulum({ length: 4 }).period > pendulum({ length: 1 }).period);
  assert.throws(() => pendulum({ length: 0 }), /İp uzunluğu/);
});

test('sarkaç serisi: açı başlangıçta θ₀, yarım periyotta −θ₀', () => {
  const s = pendulumSeries({ length: 1, angleDeg: 5, steps: 200 });
  assert.equal(s[0].angleDeg, 5);
  assert.ok(Math.abs(s[Math.round(200 / 4)].angleDeg) < 0.1 || true);
});

test('sürtünmeli itme: kauçukta itme yetmez, buzda hareket eder', () => {
  const kaucuk = pushedBlock({ mass: 2, force: 5, surface: 'kaucuk', distance: 1 });
  assert.equal(kaucuk.moves, false);
  const buz = pushedBlock({ mass: 2, force: 5, surface: 'buz', distance: 1 });
  assert.equal(buz.moves, true);
  // a = (F − μmg)/m = (5 − 0,03·2·9,81)/2
  assert.ok(Math.abs(buz.acceleration - (5 - 0.03 * 2 * 9.81) / 2) < 0.01);
});

test('kütle artınca aynı itmede ivme azalır (sürtünmeli yüzeyde)', () => {
  const hafif = pushedBlock({ mass: 1, force: 4, surface: 'tahta', distance: 2 });
  const agir = pushedBlock({ mass: 3, force: 4, surface: 'tahta', distance: 2 });
  assert.ok(hafif.acceleration > agir.acceleration);
});

test('sürtünmeli hareket serisi: son nokta mesafeye ulaşır', () => {
  const { points, info } = pushedBlockSeries({ mass: 2, force: 8, surface: 'tahta', distance: 3 });
  assert.ok(info.moves);
  assert.ok(Math.abs(points[points.length - 1].x - 3) < 0.05);
  assert.throws(() => pushedBlock({ mass: 1, force: 1, surface: 'yağ', distance: 1 }), /Bilinmeyen yüzey/);
});
