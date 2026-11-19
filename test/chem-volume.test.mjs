import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountsMixture, fillFraction, normalizeAmounts, stepTemperature, CAPACITY_ML } from '../public/chemistry.js';

test('mL modeli: sıvı hacmi toplanır, katı hacmi kütle/yoğunluk', () => {
  const m = amountsMixture({ su: 20, toz: 10 });
  assert.equal(m.volumeMl, Number((20 + 10 / 1.59).toFixed(1)));
});

test('doluluk: 25 mL su, 50 mL tüpte %50', () => {
  assert.equal(fillFraction({ su: 25 }, CAPACITY_ML.tube), 0.5);
  assert.equal(fillFraction({ su: 25 }, CAPACITY_ML.flask), 0.1);
  assert.equal(fillFraction({ su: 80 }, CAPACITY_ML.tube), 1);
});

test('eski dizi biçimi hâlâ çalışır', () => {
  assert.deepEqual(normalizeAmounts(['su']), { su: 50 });
  assert.equal(typeof stepTemperature(20, ['su'], 1, true).temp, 'number');
});

test('buharlaşma mL cinsinden hesaplanır (su ile miktar tutarlı)', () => {
  let t = 100; let evap = 0;
  for (let i = 0; i < 100; i += 1) { const r = stepTemperature(t, { su: 50 }, 0.1, true); t = r.temp; evap += r.evaporatedMl; }
  assert.equal(t, 100);
  assert.ok(evap > 0 && evap < 50);
});
