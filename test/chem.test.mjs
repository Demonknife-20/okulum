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

import { ALL_COMPOUNDS } from '../public/chem.js';

test('bileşik tablosu: aynı bileşim iki kez tanımlı değil', () => {
  const keys = ALL_COMPOUNDS.map(c => Object.keys(c.comp).sort().map(k => `${k}${c.comp[k]}`).join(''));
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(ALL_COMPOUNDS.length >= 1000, `en az 1000 bileşik bekleniyordu, bulunan: ${ALL_COMPOUNDS.length}`);
});

test('üretilen bileşikler: yük dengesi doğru formül ve ad verir', () => {
  const find = name => {
    const c = ALL_COMPOUNDS.find(x => x.name.startsWith(name));
    return { formula: prettyFormula(c.formula) };
  };
  assert.equal(find('Demir(III) klorür').formula, 'FeCl₃');
  assert.equal(find('Kalsiyum nitrat').formula, 'Ca(NO₃)₂');
  assert.equal(find('Alüminyum sülfat').formula, 'Al₂(SO₄)₃');
  assert.equal(find('Amonyum sülfat').formula, '(NH₄)₂SO₄');
  assert.equal(find('Sodyum siyanür').formula, 'NaCN');
});

test('element tablosu: 118 element, lantanit ve aktinit satırları ayrı', () => {
  assert.equal(ELEMENTS.length, 118);
  const z = ELEMENTS.map(e => e[2]);
  assert.deepEqual(z, Array.from({ length: 118 }, (_, i) => i + 1));
  const lanthanum = ELEMENTS.find(e => e[0] === 'La');
  assert.deepEqual([lanthanum[3], lanthanum[4]], [3, 8]);
  const uranium = ELEMENTS.find(e => e[0] === 'U');
  assert.deepEqual([uranium[3], uranium[4]], [6, 9]);
});

test('birleşme: kalsiyum + oksijen → sönmemiş kireç; sodyum + oksijen → sodyum oksit', () => {
  assert.equal(findProduct(combineComp(atomComp('Ca'), atomComp('O'))).formula, 'CaO');
  assert.equal(findProduct(combineComp(atomComp('Na'), combineComp(atomComp('Na'), atomComp('O')))).formula, 'Na₂O');
});

import { parseFormulaComp, bestReaction } from '../public/chem.js';

test('formül ayrıştırma: basit, parantezli ve geçersiz formüller', () => {
  assert.deepEqual(parseFormulaComp('H2O'), { H: 2, O: 1 });
  assert.deepEqual(parseFormulaComp('Ca(OH)2'), { Ca: 1, O: 2, H: 2 });
  assert.deepEqual(parseFormulaComp('C6H12O6'), { C: 6, H: 12, O: 6 });
  assert.throws(() => parseFormulaComp('Xx2'), /Bilinmeyen element/);
  assert.throws(() => parseFormulaComp(''), /boş/);
  assert.throws(() => parseFormulaComp('H2O)'), /Parantez|anlaşılamadı/);
});

test('küme birleşmesi: 24 atomdan glikoz, parçalardan sülfürik asit ve su', () => {
  const atoms = (sym, n) => Array.from({ length: n }, () => ({ [sym]: 1 }));
  const glucose = bestReaction([...atoms('C', 6), ...atoms('H', 12), ...atoms('O', 6)]);
  assert.equal(glucose.product.name, 'Glikoz (üzüm şekeri)');
  assert.equal(glucose.indices.length, 24);
  assert.equal(bestReaction([{ H: 2 }, { S: 1 }, { O: 2 }, { O: 2 }]).product.formula, 'H₂SO₄');
  assert.equal(bestReaction([{ H: 1 }, { H: 1 }, { O: 1 }]).product.formula, 'H₂O');
  assert.equal(bestReaction([{ H: 2 }]), null, 'tek parça tepkime vermez');
  assert.equal(bestReaction([{ Na: 1 }, { Au: 1 }]), null, 'eşleşmeyen parçalar birleşmez');
});

import { iconFor } from '../public/chem.js';

test('simgeler: element ve bileşik emojileri; patlayıcı bileşikler listede yok', () => {
  assert.equal(iconFor('Su', { H: 2, O: 1 }), '💧');
  assert.equal(iconFor('Sofra tuzu'), '🧂');
  assert.equal(iconFor('Demir', { Fe: 1 }), '🧲');
  assert.equal(ALL_COMPOUNDS.some(c => c.formula === 'C7H5N3O6'), false, 'patlayıcı bileşik listeye eklenmez');
});

test('arama bütçesi: büyük karışım takılmadan sonuç döner', () => {
  const big = [];
  for (const [sym, n] of [['C', 9], ['H', 20], ['O', 12], ['N', 6], ['S', 4], ['Na', 6], ['Cl', 6], ['Ca', 4], ['Fe', 4], ['P', 4]]) {
    for (let i = 0; i < n; i += 1) big.push({ [sym]: 1 });
  }
  const started = Date.now();
  bestReaction(big);
  assert.ok(Date.now() - started < 3000, 'arama 3 saniyeden kısa sürmeli');
});

import { molarMass, moles, molarity, dilutionVolume, strongAcidPH, strongBasePH, ATOMIC_MASS } from '../public/chem.js';

test('molar kütle: H2O, CO2 ve H2SO4 beklenen değerlerde', () => {
  assert.ok(Math.abs(molarMass('H2O') - 18.015) < 0.01);
  assert.ok(Math.abs(molarMass('CO2') - 44.009) < 0.01);
  assert.ok(Math.abs(molarMass('H2SO4') - 98.079) < 0.01);
  assert.ok(Math.abs(molarMass('Ca(OH)2') - 74.092) < 0.01, 'parantezli formül');
});

test('molar kütle: desteklenmeyen elementte açık hata', () => {
  assert.throws(() => molarMass('UO2'), /atom kütlesi tanımlı değil/);
});

test('mol ve molarite: 18 g su ≈ 1 mol; 0.5 mol / 2 L = 0,25 M', () => {
  assert.ok(Math.abs(moles(18.015, molarMass('H2O')) - 1) < 1e-3);
  assert.equal(molarity(0.5, 2), 0.25);
  assert.throws(() => molarity(1, 0), /sıfırdan büyük/);
});

test('seyreltme: M1·V1 = M2·V2', () => {
  assert.equal(dilutionVolume(1, 100, 0.1), 1000);
  assert.throws(() => dilutionVolume(0.1, 100, 1), /küçük/);
});

test('güçlü asit/baz pH: 0,01 M HCl → pH 2; 0,01 M NaOH → pH 12', () => {
  assert.equal(strongAcidPH(0.01), 2);
  assert.equal(strongBasePH(0.01).pH, 12);
  assert.equal(strongBasePH(0.01).pOH, 2);
  assert.ok(ATOMIC_MASS.C === 12.011);
});
