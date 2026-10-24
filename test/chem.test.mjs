import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENTS, findProduct, combineComp, atomComp, prettyFormula } from '../public/chem.js';

test('element tablosu: 36 ilk element ve grup/periyot konumları doğru', () => {
  const find = s => ELEMENTS.find(e => e[0] === s);
  assert.equal(find('H')[3], 1);
  assert.equal(find('He')[3], 18);
  assert.equal(find('Na')[4], 3);
  assert.equal(find('Fe')[3], 8);
  const symbols = new Set(ELEMENTS.map(e => e[0]));
  assert.equal(symbols.size, ELEMENTS.length, 'sembol tekrarı yok');
});

test('birleşme: H + O → su (H₂O), H + H → hidrojen gazı', () => {
  const water = findProduct(combineComp(combineComp(atomComp('H'), atomComp('H')), atomComp('O')));
  assert.equal(water.formula, 'H₂O');
  assert.equal(water.name, 'Su');
  const h2 = findProduct(combineComp(atomComp('H'), atomComp('H')));
  assert.equal(h2.formula, 'H₂');
  assert.equal(h2.name, 'Hidrojen gazı');
});

test('birleşme: sodyum + klor → sofra tuzu; karbon + oksijen·2 → karbondioksit', () => {
  assert.equal(findProduct(combineComp(atomComp('Na'), atomComp('Cl'))).name, 'Sofra tuzu');
  assert.equal(findProduct(combineComp(atomComp('C'), combineComp(atomComp('O'), atomComp('O')))).formula, 'CO₂');
});

test('birleşme: 2 katı bileşik 2H₂O olarak yazılır; eşleşmeyen bileşim null döner', () => {
  const twoWater = findProduct({ H: 4, O: 2 });
  assert.equal(twoWater.count, 2);
  assert.equal(twoWater.formula, 'H₂O');
  assert.equal(findProduct({ Na: 1, Au: 1 }), null);
});

test('formül: rakamlar alt simgeye çevrilir', () => {
  assert.equal(prettyFormula('H2SO4'), 'H₂SO₄');
  assert.equal(prettyFormula('Al2O3'), 'Al₂O₃');
});
