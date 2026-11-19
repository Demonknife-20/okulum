import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applicableReactions, elementInfo, ensureElementSubstance, elementReactivity, ACTIVITY_SERIES } from '../public/chemistry.js';

const run = (contents, temp = 20) => applicableReactions({ contents, temp, lastAdded: contents.at(-1), reacted: new Set() }).map(r => r.id);

test('demir bakır sülfatta bakırı yerinden eder', () => { ensureElementSubstance('Fe'); assert.ok(run(['el_Fe', 'bakir_sulfat']).includes('yerinden_Fe')); });
test('bakır (soy metal) bakır sülfatta tepkime vermez', () => { ensureElementSubstance('Cu'); assert.equal(run(['el_Cu', 'bakir_sulfat']).some(x => x.includes('Cu')), false); });
test('alüminyum bazla hidrojen verir', () => { ensureElementSubstance('Al'); assert.ok(run(['el_Al', 'baz']).includes('baz_Al')); });
test('magnezyum 470 °C\'de yanar, oda sıcaklığında yanmaz', () => {
  assert.equal(run(['magnezyum'], 20).includes('yanma_Mg'), false);
  assert.ok(run(['magnezyum'], 480).includes('yanma_Mg'));
});
test('kükürt 232 °C\'de yanar', () => { ensureElementSubstance('S'); assert.ok(run(['el_S'], 240).includes('yanma_S')); assert.equal(run(['el_S'], 100).includes('yanma_S'), false); });
test('demir ve kükürt ısıtılınca demir(II) sülfür', () => { ensureElementSubstance('Fe'); ensureElementSubstance('S'); assert.ok(run(['el_Fe', 'el_S'], 320).includes('fe_s')); });
test('iyot ısıtılınca süblimleşir', () => { ensureElementSubstance('I'); assert.ok(run(['el_I'], 120).includes('subl_I')); });
test('element bilgisi tepkime notu verir', () => {
  assert.match(elementInfo('Fe').reactivity, /tepkime verebilir/);
  assert.match(elementInfo('Au').reactivity, /tepkime vermez/);
});

test('veri tablosu: kurşun asitle tepkime verir, civa ve altın vermez', () => {
  ensureElementSubstance('Pb'); ensureElementSubstance('Hg'); ensureElementSubstance('Au');
  assert.ok(run(['el_Pb', 'asit']).includes('asit_Pb'));
  assert.equal(run(['el_Hg', 'asit']).length, 0);
  assert.equal(run(['el_Au', 'asit']).length, 0);
});
test('veri tablosu: karbon 400 °C\'de, fosfor 30 °C\'de yanar', () => {
  ensureElementSubstance('C'); ensureElementSubstance('P');
  assert.ok(run(['el_C'], 420).includes('yanma_C'));
  assert.equal(run(['el_C'], 300).includes('yanma_C'), false);
  assert.ok(run(['el_P'], 35).includes('yanma_P'));
});
test('veri tablosu: kalsiyum suda tepkime verir', () => {
  ensureElementSubstance('Ca');
  assert.ok(run(['el_Ca', 'su']).includes('su_Ca'));
});
test('veri tablosu: aktivite serisi tutarlı (K en etkin, Au en az)', () => {
  assert.equal(ACTIVITY_SERIES[0], 'K');
  assert.equal(ACTIVITY_SERIES.at(-1), 'Au');
  assert.equal(elementReactivity('Ne'), 'inert');
  assert.equal(elementReactivity('Zn'), 'reactive');
});
