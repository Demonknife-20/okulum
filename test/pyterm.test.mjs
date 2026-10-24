import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPython } from '../public/pyterm.js';

const run = src => runPython(src);

test('temel: print, değişkenler, aritmetik, metin birleştirme', () => {
  assert.deepEqual(run('print(2 + 3 * 4)').output, ['14']);
  assert.deepEqual(run('x = 7\ny = x // 2\nprint(x, y, x % 3)').output, ['7 3 1']);
  assert.deepEqual(run('print("Merhaba " + "dünya")').output, ['Merhaba dünya']);
  assert.deepEqual(run("print('a' * 3)").output, ['aaa']);
  assert.deepEqual(run('print(2 ** 10)').output, ['1024']);
});

test('koşul: if/elif/else ve karşılaştırmalar', () => {
  const src = 'n = 15\nif n % 15 == 0:\n    print("FizzBuzz")\nelif n % 3 == 0:\n    print("Fizz")\nelse:\n    print(n)';
  assert.deepEqual(run(src).output, ['FizzBuzz']);
  assert.deepEqual(run('x = 5\nif x > 10 and x < 20:\n    print("aralıkta")\nelse:\n    print("dışarıda")').output, ['dışarıda']);
});

test('döngüler: for/range, while, break, continue', () => {
  assert.deepEqual(run('toplam = 0\nfor i in range(1, 6):\n    toplam = toplam + i\nprint(toplam)').output, ['15']);
  assert.deepEqual(run('i = 0\nwhile i < 3:\n    print(i)\n    i = i + 1').output, ['0', '1', '2']);
  assert.deepEqual(run('for i in range(10):\n    if i == 2:\n        continue\n    if i == 4:\n        break\n    print(i)').output, ['0', '1', '3']);
});

test('listeler ve fonksiyonlar', () => {
  assert.deepEqual(run('a = [3, 1, 2]\nprint(len(a), a[0], a[-1])').output, ['3 3 2']);
  assert.deepEqual(run('print([1, "x", True])').output, ["[1, 'x', True]"]);
  assert.deepEqual(run('def kare(x):\n    return x * x\nprint(kare(7))').output, ['49']);
  assert.deepEqual(run('def selam(ad):\n    print("Selam", ad)\nselam("Ayşe")').output, ['Selam Ayşe']);
});

test('hatalar satır numarasıyla bildirilir', () => {
  const r = run('x = 1\nprint(y)');
  assert.equal(r.ok, false);
  assert.match(r.error, /Satır 2: NameError: 'y' tanımlı değil/);
  assert.match(run('print(1 / 0)').error, /ZeroDivisionError/);
  assert.match(run('if x\n    print(1)').error, /SyntaxError/);
});

test('güvenlik: sonsuz döngü adım sınırıyla durur; import ve eval yoktur', () => {
  const loop = run('while True:\n    pass');
  assert.equal(loop.ok, false);
  assert.match(loop.error, /çok uzun sürdü/);
  assert.match(run('import os').error, /tanımlı değil|SyntaxError/);
  assert.match(run('eval("1")').error, /tanımlı değil/);
});

test('bölme: "/" her zaman ondalık gösterilir; tam sayıya çevirme ve ondalık aritmetik', () => {
  assert.deepEqual(run('print(4 / 2)').output, ['2.0']);
  assert.deepEqual(run('print(7 / 2)').output, ['3.5']);
  assert.deepEqual(run('print(int(7 / 2))').output, ['3']);
  assert.deepEqual(run('print(7 // 2, 7 % 2)').output, ['3 1']);
  assert.deepEqual(run('print(2.5 * 2)').output, ['5.0']);
  assert.deepEqual(run('a = [10, 20, 30]\nprint(a[1 + 0], len(a) / 3)').output, ['20 1.0']);
  assert.deepEqual(run('print(max(1 / 2, 0.25))').output, ['0.5']);
});
