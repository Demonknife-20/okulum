import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDES, guideProgress } from '../public/chem-guide.js';

const empty = { worn: [], lit: false, tripodOn: false, tubes: [] };

test('kılavuz: boş sahnede ilk adım gözlük, hiçbir adım tamamlanmamış', () => {
  const p = guideProgress(empty, 'notr');
  assert.equal(p.done, 0);
  assert.equal(p.next, 'gozluk');
  assert.equal(p.complete, false);
});

test('kılavuz: ekipman ve asit eklenince ilerler', () => {
  const s = { ...empty, worn: ['gozluk', 'eldiven', 'onluk'], tubes: [{ contents: ['asit'], temp: 20 }] };
  const p = guideProgress(s, 'notr');
  assert.equal(p.next, 'baz');
  assert.ok(p.steps.find(x => x.id === 'asit').done);
});

test('kılavuz: nötrleşmede sıcaklık artışı son adımı tamamlar', () => {
  const s = { ...empty, worn: ['gozluk', 'eldiven', 'onluk'], tubes: [{ contents: ['asit', 'baz'], temp: 32 }] };
  const p = guideProgress(s, 'notr');
  assert.equal(p.complete, true);
  assert.equal(p.next, null);
});

test('kılavuz: kaynama için üçayak, ocak ve su gerekir', () => {
  const s = { ...empty, worn: ['gozluk'], tripodOn: true, lit: true, tubes: [{ contents: ['su'], temp: 100 }] };
  const p = guideProgress(s, 'kaynama');
  assert.ok(p.steps.find(x => x.id === 'tripod').done);
  assert.ok(p.steps.find(x => x.id === 'kaynama').done);
  assert.equal(p.next, 'buharlasma');
});

test('kılavuz: metal-asit adımı magnezyum ya da çinko ister', () => {
  const s = { ...empty, worn: ['gozluk', 'eldiven'], tubes: [{ contents: ['asit', 'magnezyum'], temp: 21 }] };
  const p = guideProgress(s, 'metal');
  assert.ok(p.steps.find(x => x.id === 'metal').done);
  assert.ok(p.steps.find(x => x.id === 'gaz').done);
});

test('kılavuz: bilinmeyen deney hata verir; tüm kılavuzların adım kimlikleri benzersiz', () => {
  assert.throws(() => guideProgress(empty, 'yok'), /Bilinmeyen/);
  for (const key of Object.keys(GUIDES)) {
    const ids = GUIDES[key].steps.map(s => s.id);
    assert.equal(new Set(ids).size, ids.length, key);
  }
});

test('örnek deney titrasyon: 20 mL baz ve fenolftalein ile pembe adımı tamamlanır', () => {
  const full = { ...empty, worn: ['gozluk', 'eldiven', 'onluk'], tubes: [{ contents: ['asit', 'baz', 'fenolftalein'], amounts: { asit: 20, baz: 21, fenolftalein: 2 }, temp: 25 }] };
  const p = guideProgress(full, 'titrasyon');
  assert.equal(p.complete, true);
  const partial = { ...empty, worn: ['gozluk', 'eldiven', 'onluk'], tubes: [{ contents: ['asit'], amounts: { asit: 20 }, temp: 20 }] };
  assert.equal(guideProgress(partial, 'titrasyon').next, 'indikator');
});

test('örnek deney karbonat: kireç ve asit köpürmesi', () => {
  const s = { ...empty, worn: ['gozluk', 'eldiven'], tubes: [{ contents: ['asit', 'kalsiyum_karbonat'], amounts: {}, temp: 22 }] };
  assert.equal(guideProgress(s, 'karbonat').complete, true);
});

test('örnek deney magnezyum: 470 °C\'ye kadar tamamlanmaz', () => {
  const base = { ...empty, worn: ['gozluk'], tripodOn: true, lit: true, tubes: [{ contents: ['magnezyum'], amounts: {}, temp: 300 }] };
  assert.equal(guideProgress(base, 'magnezyum').complete, false);
  assert.equal(guideProgress({ ...base, tubes: [{ contents: ['magnezyum'], amounts: {}, temp: 480 }] }, 'magnezyum').complete, true);
});

test('örnek deney yağ-su ve bakır: ilgili maddeler gerekir', () => {
  const yag = { ...empty, worn: ['gozluk', 'onluk'], tubes: [{ contents: ['su', 'yag'], amounts: {}, temp: 20 }] };
  assert.equal(guideProgress(yag, 'yag').complete, true);
  const bakir = { ...empty, worn: ['gozluk', 'eldiven'], tubes: [{ contents: ['bakir_sulfat', 'cinko_toz'], amounts: {}, temp: 21 }] };
  assert.equal(guideProgress(bakir, 'bakir').complete, true);
});
