import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mixtureProps, applicableReactions, elementInfo, SUBSTANCES } from '../public/chemistry.js';

test('karışım özellikleri: su + toz', () => {
  const p = mixtureProps(['su', 'toz']);
  assert.equal(p.volumeMl, 50 + 10 / 1.59 ? Number((50 + 10 / 1.59).toFixed(1)) : 0);
  assert.ok(p.densityGmL > 1 && p.densityGmL < 1.5);
});

test('boş tüp yoğunluk 0 ve hacim 0', () => {
  assert.deepEqual(mixtureProps([]), { volumeMl: 0, massG: 0, densityGmL: 0 });
});

test('su asidin üstüne dökülünce tehlike, asit suya eklenince güvenli', () => {
  const tehlike = applicableReactions({ contents: ['asit', 'su'], temp: 20, lastAdded: 'su', reacted: new Set() });
  assert.ok(tehlike.some(r => r.id === 'seyreltme_tehlikeli' && r.explosion));
  assert.ok(!tehlike.some(r => r.id === 'seyreltme_guvenli'));
  const guvenli = applicableReactions({ contents: ['asit', 'su'], temp: 20, lastAdded: 'asit', reacted: new Set() });
  assert.ok(guvenli.some(r => r.id === 'seyreltme_guvenli'));
  assert.ok(!guvenli.some(r => r.id === 'seyreltme_tehlikeli'));
});

test('sodyum suyla patlar; magnezyum asitte hidrojen çıkarır', () => {
  assert.ok(applicableReactions({ contents: ['sodyum', 'su'], temp: 20, lastAdded: 'sodyum', reacted: new Set() }).some(r => r.explosion));
  assert.ok(applicableReactions({ contents: ['magnezyum', 'asit'], temp: 20, lastAdded: 'asit', reacted: new Set() }).some(r => r.id === 'mg_asit'));
});

test('kaynama sıcaklık eşiğinde gerçekleşir', () => {
  assert.equal(applicableReactions({ contents: ['su'], temp: 90, lastAdded: 'su', reacted: new Set() }).some(r => r.id === 'kaynama'), false);
  assert.equal(applicableReactions({ contents: ['su'], temp: 101, lastAdded: 'su', reacted: new Set() }).some(r => r.id === 'kaynama'), true);
});

test('periyodik tablo: element bilgisi ve alınabilir malzemeler', () => {
  assert.equal(elementInfo('Na').item, 'sodyum');
  assert.equal(elementInfo('Cu').item, 'el_Cu');
  assert.equal(elementInfo('Xx'), null);
  assert.ok(SUBSTANCES.termometre.tool);
});
