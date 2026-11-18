import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applicableReactions, elementReactions, elementSymbolOf, ensureElementSubstance } from '../public/chemistry.js';

test('asit + çinko (genel kural) hidrojen tepkimesi verir; bakır (soy metal) vermez', () => {
  ensureElementSubstance('Zn');
  ensureElementSubstance('Cu');
  const zn = applicableReactions({ contents: ['el_Zn', 'asit'], temp: 20, lastAdded: 'asit', reacted: new Set() });
  assert.ok(zn.some(r => r.id === 'asit_Zn'));
  const cu = applicableReactions({ contents: ['el_Cu', 'asit'], temp: 20, lastAdded: 'asit', reacted: new Set() });
  assert.ok(!cu.some(r => r.id.startsWith('asit_Cu')));
});

test('potasyum suda patlar (genel kural), lityum yumuşak tepkime verir', () => {
  ensureElementSubstance('K');
  ensureElementSubstance('Li');
  const k = applicableReactions({ contents: ['el_K', 'su'], temp: 20, lastAdded: 'su', reacted: new Set() }).find(r => r.id === 'su_K');
  assert.ok(k && k.explosion);
  const li = applicableReactions({ contents: ['el_Li', 'su'], temp: 20, lastAdded: 'su', reacted: new Set() }).find(r => r.id === 'su_Li');
  assert.ok(li && !li.explosion);
});

test('sodyum ve magnezyum özel kurallarla çalışır, genel kuralda tekrar edilmez', () => {
  assert.equal(elementSymbolOf('sodyum'), 'Na');
  assert.equal(elementSymbolOf('magnezyum'), 'Mg');
  assert.equal(elementReactions(['sodyum', 'su']).length, 0);
});

test('dört element kuralı: asit ve suyla tepkime yoksa boş döner', () => {
  assert.equal(elementReactions(['el_Au', 'asit', 'su']).length, 0);
});

import { productsFor } from '../public/chemistry.js';

test('ürün bilgisi: asit + baz → tuz ve su', () => {
  const p = productsFor(['asit', 'baz']);
  assert.ok(p.some(x => x.includes('NaCl')));
  assert.ok(p.some(x => x.includes('H₂O')));
});

test('ürün bilgisi: asit + çinko → hidrojen gazı', () => {
  assert.ok(productsFor(['el_Zn', 'asit']).some(x => x.includes('H₂')));
});

test('ürün bilgisi: kireç + asit → CO₂ gazı', () => {
  assert.ok(productsFor(['kalsiyum_karbonat', 'asit']).some(x => x.includes('CO₂')));
});

test('ürün bilgisi: boş ya da etkisiz karışım ürün vermez', () => {
  assert.deepEqual(productsFor(['yag', 'su']).filter(x => x.includes('gaz')), []);
  assert.deepEqual(productsFor([]), []);
});
