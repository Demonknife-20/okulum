import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENTS, elementBySymbol, elementLayout, elementItemKey, ensureElementSubstance, stepTemperature, doseRate, requiredPpe, missingPpe, applicableReactions, mixtureProps, SUBSTANCES } from '../public/chemistry.js';

test('periyodik tablo: 118 element, 37 radyoaktif, ana tabloda çakışma yok', () => {
  assert.equal(ELEMENTS.length, 118);
  assert.equal(ELEMENTS.filter(e => e.radioactive).length, 37);
  const seen = new Set();
  for (const e of ELEMENTS) {
    const l = elementLayout(e);
    if (l.row !== 'main') continue;
    const k = `${l.period},${l.group}`;
    assert.ok(!seen.has(k), `çakışma ${k}`);
    seen.add(k);
  }
  assert.equal(seen.size, 89);
});

test('element kategorileri ve konumlar doğru', () => {
  assert.equal(elementBySymbol('Og').cat, 'g');
  assert.deepEqual(elementLayout(elementBySymbol('H')), { row: 'main', group: 1, period: 1 });
  assert.deepEqual(elementLayout(elementBySymbol('Ce')), { row: 'lan', col: 1 });
  assert.equal(elementLayout(elementBySymbol('U')).row, 'act');
});

test('element maddesi oluşturulur ve Na/Mg mevcut maddelere bağlanır', () => {
  assert.equal(elementItemKey('Na'), 'sodyum');
  const fe = ensureElementSubstance('Fe');
  assert.equal(fe.element, 'Fe');
  assert.equal(SUBSTANCES[elementItemKey('Fe')], fe);
});

test('metal suya göre çok daha hızlı ısınır (aynı ısı, daha az kapasite)', () => {
  const metal = stepTemperature(20, ['magnezyum'], 1, true).temp - 20;
  const su = stepTemperature(20, ['su'], 1, true).temp - 20;
  assert.ok(metal > su * 5, `metal ${metal} su ${su}`);
});

test('su 100 °C\'de kaynama plato yapar ve buharlaşır', () => {
  let t = 99.5; let evap = 0;
  for (let i = 0; i < 400; i += 1) {
    const r = stepTemperature(t, ['su'], 0.1, true);
    t = r.temp; evap += r.evaporatedMl;
  }
  assert.equal(t, 100);
  assert.ok(evap > 0);
});

test('ısıtma kapalıyken tüp oda sıcaklığına soğur', () => {
  let t = 90;
  for (let i = 0; i < 600; i += 1) t = stepTemperature(t, ['su'], 0.5, false).temp;
  assert.ok(t < 60 && t > 19);
});

test('radyasyon dozu mesafe arttıkça düşer', () => {
  const yakin = doseRate([{ symbol: 'Ra', distance: 0.5 }]);
  const uzak = doseRate([{ symbol: 'Ra', distance: 3 }]);
  assert.ok(yakin > uzak);
  assert.ok(doseRate([]) > 0);
});

test('koruyucu ekipman gereksinimleri', () => {
  assert.deepEqual(requiredPpe('pour_acid_base').sort(), ['eldiven', 'gozluk', 'onluk']);
  assert.deepEqual(missingPpe(['gozluk'], ['gozluk', 'eldiven']), ['eldiven']);
  assert.deepEqual(missingPpe(['gozluk', 'eldiven'], ['gozluk']), []);
});

test('mevcut tepkimeler hâlâ çalışır', () => {
  assert.ok(applicableReactions({ contents: ['sodyum', 'su'], temp: 20, lastAdded: 'sodyum', reacted: new Set() }).some(r => r.explosion));
});

test('yeni maddeler: yağ-su ayrışması, permanganat, kireç köpürmesi, bakır çökmesi, etanol', () => {
  const ids = st => applicableReactions({ contents: st.c, temp: st.t ?? 20, lastAdded: st.l ?? st.c.at(-1), reacted: new Set() }).map(r => r.id);
  assert.ok(ids({ c: ['yag', 'su'] }).includes('karismaz'));
  assert.ok(ids({ c: ['permanganat', 'su'] }).includes('mor'));
  assert.ok(ids({ c: ['kalsiyum_karbonat', 'asit'] }).includes('kireç_asit'));
  assert.ok(ids({ c: ['cinko_toz', 'bakir_sulfat'] }).includes('bakir_cokme'));
  assert.ok(!ids({ c: ['etanol'], t: 40 }).includes('etanol_yanma'));
  assert.ok(ids({ c: ['etanol'], t: 80 }).includes('etanol_yanma'));
  const p = mixtureProps(['etanol', 'su']);
  assert.ok(p.densityGmL < 1.0 + 0.2);
});
