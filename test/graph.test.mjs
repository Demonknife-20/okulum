import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileExpression, parseLine, niceStep } from '../public/graph.js';

test('ifade değerlendirme: öncelik, üs, eksi, örtük çarpma, fonksiyonlar', () => {
  assert.equal(compileExpression('2x^2+1')(3), 19);
  assert.equal(compileExpression('3(x+1)')(1), 6);
  assert.equal(compileExpression('-x^2')(2), -4, 'eksi üsten önce gelmez');
  assert.equal(compileExpression('2^3^2')(0), 512, 'üs sağdan birleşir');
  assert.ok(Math.abs(compileExpression('sin(pi/2)')(0) - 1) < 1e-12);
  assert.equal(compileExpression('sqrt(x)')(-1), NaN);
  assert.equal(compileExpression('x**2')(3), 9, '** üs olarak kabul edilir');
});

test('güvenlik: eval yok, bilinmeyen ad ve prototip anahtarları reddedilir', () => {
  assert.throws(() => compileExpression('constructor(x)'), /Bilinmeyen fonksiyon/);
  assert.throws(() => compileExpression('toString'), /Bilinmeyen değişken/);
  assert.throws(() => compileExpression('process.exit(1)'), /Anlaşılmayan|Fazla|Beklenmeyen/);
  assert.throws(() => compileExpression('alert(1)'), /Bilinmeyen fonksiyon/);
  assert.throws(() => compileExpression(''), /boş/);
  assert.throws(() => compileExpression('2 +'), /eksik/);
  assert.throws(() => compileExpression('(1+2'), /bekleniyordu/);
});

test('satır ayrıştırma: fonksiyon, nokta, adlandırma', () => {
  const f = parseLine('f(x)=x^2');
  assert.equal(f.type, 'fn');
  assert.equal(f.name, 'f');
  assert.equal(f.fn(4), 16);
  const g = parseLine('y = 2x + 1');
  assert.equal(g.type, 'fn');
  assert.equal(g.fn(1), 3);
  const p = parseLine('A=(1, 2)');
  assert.deepEqual([p.type, p.name, p.x, p.y], ['pt', 'A', 1, 2]);
  const q = parseLine('(3, 4+1)');
  assert.deepEqual([q.type, q.name, q.x, q.y], ['pt', 'P', 3, 5]);
  assert.equal(parseLine('   '), null);
});

test('satır ayrıştırma: hatalı girdi açıklayıcı hata verir', () => {
  assert.equal(parseLine('(1)').type, 'fn', 'tek parantezli ifade sayıdır');
  assert.throws(() => parseLine('(1,2,3)'), /Fazla/);
  assert.throws(() => parseLine('B=(x, 2)'), /x kullanılamaz/);
  assert.throws(() => parseLine('2 +'), /eksik/);
  assert.throws(() => parseLine('1+2=3'), /Sol taraf geçersiz/);
});

test('ızgara adımı okunaklı değerler üretir', () => {
  assert.equal(niceStep(0.3), 0.5);
  assert.equal(niceStep(7), 10);
  assert.equal(niceStep(1.6), 2);
  assert.equal(niceStep(40), 50);
});
