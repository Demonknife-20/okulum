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
