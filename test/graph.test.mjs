import { parseCommand } from '../public/graph.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileExpression, parseLine, niceStep, buildModel } from '../public/graph.js';

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


test('komutlar: doğru, ışın, parça; Türkçe ve İngilizce adlar, isteğe bağlı ad', () => {
  assert.deepEqual(parseCommand('d=Doğru(A,B)'), { kind: 'line', name: 'd', a: 'A', b: 'B', c: null });
  assert.deepEqual(parseCommand('Işın(A,B)'), { kind: 'ray', name: null, a: 'A', b: 'B', c: null });
  assert.deepEqual(parseCommand('s=Parça(P,Q)'), { kind: 'segment', name: 's', a: 'P', b: 'Q', c: null });
  assert.deepEqual(parseCommand('l=line(A,B)'), { kind: 'line', name: 'l', a: 'A', b: 'B', c: null });
  assert.equal(parseCommand('A=(1,2)'), null, 'nokta komut değildir');
  assert.throws(() => parseCommand('Elips(A,B)'), /Bilinmeyen komut/);
});

test('nesne modeli: noktalar, doğrular, tanımsız nokta hatası, fonksiyonlar', () => {
  const model = buildModel(['A=(0,0)', 'B=(2,1)', 'd=Doğru(A,B)', 's=Parça(A,Z)', 'f(x)=x^2', '']);
  assert.deepEqual([...model.points.keys()], ['A', 'B']);
  assert.deepEqual(model.objects.map(o => `${o.kind}:${o.name}`), ['line:d', 'segment:s', 'fn:f']);
  assert.equal(model.errors[3], 'Nokta tanımlı değil: Z');
  assert.equal(model.objects[0].row, 2);
});

test('nesne modeli: noktayı taşımak doğru satırı günceller (bağımlı nesneler sonra yeniden hesaplanır)', () => {
  const lines = ['A=(0,0)', 'B=(2,1)', 'd=Doğru(A,B)'];
  const moved = lines.map((line, i) => (i === 1 ? 'B=(3,4)' : line));
  const model = buildModel(moved);
  assert.deepEqual([model.points.get('B').x, model.points.get('B').y], [3, 4]);
  assert.equal(model.objects[0].b, 'B', 'doğru hâlâ B noktasına bağlı');
});

import { lineEquation, angleDegrees } from '../public/graph.js';

test('denklem etiketi: eğik, yatay, dikey ve eksenden geçen doğrular', () => {
  assert.equal(lineEquation([0, 1], [1, 3]), 'y = 2x + 1');
  assert.equal(lineEquation([0, 2], [1, 2]), 'y = 2');
  assert.equal(lineEquation([3, 0], [3, 5]), 'x = 3');
  assert.equal(lineEquation([0, 0], [1, -1]), 'y = -x');
  assert.equal(lineEquation([0, 0], [2, -3]), 'y = -1.5x');
});

test('açı: dik, düz ve sıfır açı', () => {
  assert.ok(Math.abs(angleDegrees([1, 0], [0, 0], [0, 1]) - 90) < 1e-9);
  assert.ok(Math.abs(angleDegrees([1, 0], [0, 0], [-1, 0]) - 180) < 1e-9);
  assert.ok(Math.abs(angleDegrees([2, 0], [0, 0], [5, 0])) < 1e-9);
  assert.ok(Number.isNaN(angleDegrees([0, 0], [0, 0], [1, 1])));
});

test('çember ve açı komutları: doğru argüman sayısı', () => {
  assert.deepEqual(parseCommand('c=Çember(A,B)'), { kind: 'circle', name: 'c', a: 'A', b: 'B', c: null });
  assert.deepEqual(parseCommand('Açı(A,B,C)'), { kind: 'angle', name: null, a: 'A', b: 'B', c: 'C' });
  assert.throws(() => parseCommand('Açı(A,B)'), /üç nokta/);
  assert.throws(() => parseCommand('Doğru(A,B,C)'), /en fazla iki/);
});

test('orta nokta: iki noktanın ortası türetilmiş nokta olarak hesaplanır', () => {
  const model = buildModel(['A=(0,0)', 'B=(4,2)', 'M=Orta(A,B)']);
  assert.deepEqual([model.points.get('M').x, model.points.get('M').y], [2, 1]);
  assert.equal(model.points.get('M').derived, true);
  assert.equal(model.errors.length, 0);
  // Türetilmiş nokta serbest değildir: satırı sürüklenemez
  assert.equal(model.points.get('M').row, 2);
});

test('kesişim: iki doğrunun kesişim noktası (sonsuz doğrular)', () => {
  const model = buildModel(['A=(0,0)', 'B=(2,2)', 'C=(0,2)', 'D=(2,0)', 'a=Doğru(A,B)', 'b=Doğru(C,D)', 'K=Kesişim(a,b)']);
  assert.ok(Math.abs(model.points.get('K').x - 1) < 1e-9 && Math.abs(model.points.get('K').y - 1) < 1e-9);
  assert.equal(model.errors.length, 0);
});

test('kesişim: paralel doğrular ve eksik adlar açıklayıcı hata verir', () => {
  const parallel = buildModel(['A=(0,0)', 'B=(1,0)', 'C=(0,1)', 'D=(1,1)', 'a=Doğru(A,B)', 'b=Doğru(C,D)', 'K=Kesişim(a,b)']);
  assert.match(parallel.errors[6], /Paralel/);
  assert.equal(parallel.points.has('K'), false);
  const unnamed = buildModel(['A=(0,0)', 'B=(1,1)', 'Orta(A,B)']);
  assert.match(unnamed.errors[2], /bir ad verin/);
  const missing = buildModel(['A=(0,0)', 'M=Orta(A,Z)']);
  assert.equal(missing.errors[1], 'Nokta tanımlı değil: Z');
});

test('kesişim: sayı olmayan nesne (fonksiyon) doğru yerine geçmez', () => {
  const model = buildModel(['A=(0,0)', 'B=(1,1)', 'f(x)=x', 'K=Kesişim(f,f)']);
  assert.match(model.errors[3], /iki doğru/);
});
