import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectile, trajectory, titrationPH, equivalenceVolume, titrationSeries, ohm, equivalentResistance, pendulum, thinLens, uniformlyAccelerated, kineticEnergy, potentialEnergy, waveSpeed } from '../public/labs.js';

test('eğik atış: menzil, yükseklik ve süre bilinen değerlerle uyuşur', () => {
  // 45°, 10 m/s, Dünya: menzil v²/g ≈ 10.19 m, en yüksek nokta ≈ 2.55 m
  const p = projectile(10, 45, 9.81);
  assert.ok(Math.abs(p.range - (100 / 9.81)) < 1e-9);
  assert.ok(Math.abs(p.height - (100 / (4 * 9.81))) < 1e-9);
  assert.ok(Math.abs(p.time - (2 * 10 * Math.sin(Math.PI / 4)) / 9.81) < 1e-9);
});

test('eğik atış: Ay yerçekimi aynı atışta daha uzun menzil verir; yörünge yere değer', () => {
  const earth = projectile(10, 45, 9.81).range;
  const moon = projectile(10, 45, 1.62).range;
  assert.ok(moon > earth * 5, 'Ay\'da menzil çok daha büyük');
  const path = trajectory(10, 45, 9.81, 40);
  assert.equal(path[0].y, 0);
  assert.ok(Math.abs(path[path.length - 1].y) < 1e-6, 'uçuş sonunda yerdedir');
});

test('titrasyon: başlangıç, eşdeğerlik ve fazla baz pH değerleri', () => {
  // 0.1 M HCl, 25 mL; 0.1 M NaOH
  assert.ok(Math.abs(titrationPH(0.1, 25, 0.1, 0) - 1) < 1e-9, 'başlangıç pH = -log(0.1)');
  assert.equal(titrationPH(0.1, 25, 0.1, 25), 7, 'eşdeğerlik noktasında pH 7');
  assert.ok(Math.abs(titrationPH(0.1, 25, 0.1, 50) - (14 + Math.log10(0.1 * 25 / 75))) < 1e-9, 'fazla bazda pH > 7');
});

test('titrasyon: eşdeğerlik hacmi ve eğri', () => {
  assert.equal(equivalenceVolume(0.1, 25, 0.1), 25);
  assert.equal(equivalenceVolume(0.2, 20, 0.1), 40);
  const series = titrationSeries(0.1, 25, 0.1, 30, 5);
  assert.equal(series.length, 7);
  assert.ok(series[0].pH < series[series.length - 1].pH, 'pH artan yönde ilerler');
});

test('ohm kanunu: V, I ve R birbirinden hesaplanır', () => {
  assert.equal(ohm({ voltage: 12, resistance: 4 }).current, 3);
  assert.equal(ohm({ current: 3, resistance: 4 }).voltage, 12);
  assert.equal(ohm({ voltage: 12, current: 3 }).resistance, 4);
  assert.throws(() => ohm({ voltage: 12, resistance: 0 }), /sıfır olamaz/);
  assert.throws(() => ohm({ voltage: 12 }), /Tam olarak bir değeri/);
});

test('eşdeğer direnç: seri toplam, paralel çarpan/toplam', () => {
  assert.equal(equivalentResistance([2, 3, 5], 'series'), 10);
  assert.equal(equivalentResistance([6, 3], 'parallel'), 2);
  assert.throws(() => equivalentResistance([1, 2], 'karışık'), /series|parallel/);
});

test('sarkaç: uzunluk arttıkça periyot artar (T = 2π√(L/g))', () => {
  const short = pendulum(1);
  const long = pendulum(4);
  assert.ok(Math.abs(short - 2 * Math.PI * Math.sqrt(1 / 9.81)) < 1e-3);
  assert.ok(Math.abs(long - 2 * short) < 1e-2, '4 kat uzunluk ≈ 2 kat periyot');
  assert.throws(() => pendulum(0), /sıfırdan büyük/);
});

test('mercek: 2f nesne → görüntü 2f, büyütme -1 (gerçek, ters)', () => {
  const r = thinLens(10, 20);
  assert.equal(r.imageDist, 20);
  assert.equal(r.magnification, -1);
  assert.equal(r.real, true);
  const virtual = thinLens(10, 5);
  assert.equal(virtual.real, false, 'odak içinde sanal görüntü');
});

test('düzgün ivmeli hareket ve enerji', () => {
  assert.deepEqual(uniformlyAccelerated({ v0: 0, a: 2, t: 3 }), { velocity: 6, distance: 9 });
  assert.equal(kineticEnergy(2, 3), 9);
  assert.ok(Math.abs(potentialEnergy(2, 5, 10) - 100) < 1e-9);
});

test('dalga hızı: v = f · λ', () => {
  assert.equal(waveSpeed(50, 2), 100);
  assert.throws(() => waveSpeed(-1, 2), /pozitif/);
});
