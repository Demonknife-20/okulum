import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectile, trajectory, titrationPH, equivalenceVolume, titrationSeries, ohm, equivalentResistance, pendulum, thinLens, uniformlyAccelerated, kineticEnergy, potentialEnergy, waveSpeed, density, pressure, buoyancy, work, power, momentum, springForce, capacitorCharge, rcCircuit } from '../public/labs.js';

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

test('yoğunluk: ρ = m/V, sıfır kütle veya pozitif olmayan hacim hata verir', () => {
  assert.equal(density(10, 2), 5);
  assert.ok(Math.abs(density(1, 0.25) - 4) < 1e-9);
  assert.throws(() => density(0, 5), /sıfır/);
  assert.throws(() => density(10, 0), /sıfır/);
  assert.throws(() => density(10, -2), /sıfır/);
});

test('basınç: P = F/A, sıfır veya negatif alan hata verir', () => {
  assert.equal(pressure(100, 5), 20);
  assert.ok(Math.abs(pressure(50, 2.5) - 20) < 1e-9);
  assert.throws(() => pressure(100, 0), /sıfır/);
  assert.throws(() => pressure(100, -3), /sıfır/);
});

test('münaşaburet: Fb = ρ·V·g, tüm değerler pozitif olmalı', () => {
  assert.ok(Math.abs(buoyancy(1000, 0.5, 9.81) - 4905) < 1e-6);
  assert.ok(Math.abs(buoyancy(1000, 1, 9.81) - 9810) < 1e-6);
  assert.throws(() => buoyancy(0, 1, 9.81), /pozitif/);
  assert.throws(() => buoyancy(1000, -1, 9.81), /pozitif/);
  assert.throws(() => buoyancy(1000, 1, 0), /pozitif/);
});

test('iş: W = F·d·cos(θ), mesafe negatif olamaz', () => {
  assert.equal(work(10, 5, 0), 50);
  assert.ok(Math.abs(work(10, 5, 60) - 25) < 1e-9, 'cos(60°) = 0.5');
  assert.ok(Math.abs(work(10, 5, 90)) < 1e-9, 'cos(90°) = 0');
  assert.throws(() => work(10, -1, 0), /negatif/);
  assert.throws(() => work(10, -5, 45), /negatif/);
});

test('güç: P = W/t, sıfır veya negatif süre hata verir', () => {
  assert.equal(power(100, 5), 20);
  assert.ok(Math.abs(power(90, 3) - 30) < 1e-9);
  assert.throws(() => power(100, 0), /sıfır/);
  assert.throws(() => power(100, -2), /sıfır/);
});

test('momentum: p = m·v, negatif kütle olamaz', () => {
  assert.equal(momentum(5, 3), 15);
  assert.equal(momentum(2, -4), -8);
  assert.throws(() => momentum(-1, 5), /negatif/);
  assert.throws(() => momentum(-3, 10), /negatif/);
});

test('yay kuvveti: F = k·x, k ve x pozitif olmalı, mutlak değer döner', () => {
  assert.equal(springForce(100, 0.1), 10);
  assert.equal(springForce(50, -0.2), 10, 'x negatifse mutlak değer');
  assert.throws(() => springForce(0, 0.1), /pozitif/);
  assert.throws(() => springForce(100, 0), /pozitif/);
  assert.throws(() => springForce(-50, 0.2), /pozitif/);
});

test('kondansatör şarjı: Q = C·V, c ve v pozitif olmalı', () => {
  assert.equal(capacitorCharge(0.001, 5), 0.005);
  assert.ok(Math.abs(capacitorCharge(0.1, 12) - 1.2) < 1e-9);
  assert.throws(() => capacitorCharge(0, 5), /pozitif/);
  assert.throws(() => capacitorCharge(0.001, 0), /pozitif/);
  assert.throws(() => capacitorCharge(-0.1, 12), /pozitif/);
});

test('RC devresi: Vc = V·(1-e^(-t/RC)), r, c, t pozitif olmalı', () => {
  const rc = 1000 * 0.001; // τ = 1 saniye
  assert.ok(Math.abs(rcCircuit(1000, 0.001, rc, 5) - 5 * (1 - Math.exp(-1))) < 1e-6);
  assert.ok(Math.abs(rcCircuit(1000, 0.001, 2 * rc, 5) - 5 * (1 - Math.exp(-2))) < 1e-6);
  assert.throws(() => rcCircuit(0, 0.001, 1, 5), /pozitif/);
  assert.throws(() => rcCircuit(1000, 0, 1, 5), /pozitif/);
  assert.throws(() => rcCircuit(1000, 0.001, -1, 5), /pozitif/);
});
