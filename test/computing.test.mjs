import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBase, toBase, evalLogic, truthTable, bubbleSortSteps, textToBinary, binaryToText, hexToRgb, rgbToHex, binaryAdd } from '../public/computing.js';

test('sayı sistemleri: onluk, ikili, onaltılık dönüşümleri', () => {
  assert.equal(toBase(255, 2), '11111111');
  assert.equal(toBase(255, 16), 'FF');
  assert.equal(toBase(0, 2), '0');
  assert.equal(parseBase('FF', 16), 255);
  assert.equal(parseBase('1011', 2), 11);
  assert.equal(parseBase(' 777 ', 8), 511);
  assert.throws(() => parseBase('102', 2), /geçerli değil/);
  assert.throws(() => toBase(-1, 2), /pozitif/);
});

test('mantık: temel kapılar ve parantez', () => {
  assert.equal(evalLogic('A AND B', { A: true, B: false }), false);
  assert.equal(evalLogic('A OR B', { A: true, B: false }), true);
  assert.equal(evalLogic('A XOR B', { A: true, B: true }), false);
  assert.equal(evalLogic('NOT A', { A: false }), true);
  assert.equal(evalLogic('A NAND B', { A: true, B: true }), false);
  assert.equal(evalLogic('NOT (A OR B)', { A: false, B: false }), true);
  assert.throws(() => evalLogic('A AND', { A: true }), /Değişken bekleniyordu/);
  assert.throws(() => evalLogic('A AND B', { A: true }), /için değer verilmedi/);
  assert.throws(() => evalLogic('A + B', { A: true, B: true }), /anlaşılamadı/);
});

test('doğruluk tablosu: iki değişkenli AND 4 satır, sonuç yalnızca 1,1 için doğru', () => {
  const { vars, rows } = truthTable('A AND B');
  assert.deepEqual(vars, ['A', 'B']);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.filter(r => r.result).map(r => r.values), [{ A: true, B: true }]);
});

test('kabarcık sıralama: sonuç sıralı, adımlar izlenebilir', () => {
  const steps = bubbleSortSteps([5, 1, 4, 2]);
  assert.deepEqual(steps[steps.length - 1].array, [1, 2, 4, 5]);
  assert.equal(steps[steps.length - 1].done, true);
  assert.ok(steps.some(s => s.swapped), 'en az bir değişim adımı var');
});

test('ASCII: metin ↔ ikili turda aynı metne döner', () => {
  const bin = textToBinary('AB');
  assert.equal(bin, '01000001 01000010');
  assert.equal(binaryToText(bin), 'AB');
  assert.throws(() => binaryToText('0102'), /Geçersiz ikili/);
});

test('renk dönüşümü: HEX ↔ RGB, kısa HEX desteklenir', () => {
  assert.deepEqual(hexToRgb('FF8800'), { r: 255, g: 136, b: 0 });
  assert.deepEqual(hexToRgb('#f00'), { r: 255, g: 0, b: 0 });
  assert.equal(rgbToHex(255, 136, 0), 'FF8800');
  assert.throws(() => rgbToHex(256, 0, 0), /0-255/);
  assert.throws(() => hexToRgb('zz'), /Geçersiz HEX/);
});

test('ikili toplama: eldeli toplam ve sonuç', () => {
  assert.equal(binaryAdd('1011', '1101').result, '11000');
  assert.equal(binaryAdd('1', '1').carryOut, true);
  assert.equal(binaryAdd('10', '01').result, '11');
  assert.throws(() => binaryAdd('102', '11'), /Yalnızca 0 ve 1/);
});
