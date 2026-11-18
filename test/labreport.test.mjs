import { test } from 'node:test';
import assert from 'node:assert/strict';
import lr from '../src/labreport.js';

test('rapor doğrulama: geçerli kayıt temizlenir', () => {
  const r = lr.validateReport({ experiment: 'kimya3d', title: '  Asit-baz  ', lines: ['  pH  7 ', '', 42], summary: { temp: 21.5, ok: true, bad: { x: 1 } } });
  assert.equal(r.experiment, 'kimya3d');
  assert.equal(r.title, 'Asit-baz');
  assert.deepEqual(r.lines, ['pH 7']);
  assert.deepEqual(r.summary, { temp: 21.5, ok: true });
});

test('rapor doğrulama: geçersiz deney kodu ve başlık reddedilir', () => {
  assert.throws(() => lr.validateReport({ experiment: 'Kimya 3D', title: 'x' }), /Deney kodu/);
  assert.throws(() => lr.validateReport({ experiment: 'fizik', title: '' }), /başlığ/);
  assert.throws(() => lr.validateReport({ experiment: 'fizik', title: 'x'.repeat(121) }), /başlığ/);
});

test('rapor doğrulama: çok fazla satır reddedilir, uzun satır kırpılır', () => {
  assert.throws(() => lr.validateReport({ experiment: 'fizik', title: 'a', lines: new Array(lr.MAX_LINES + 1).fill('x') }), /En fazla/);
  const r = lr.validateReport({ experiment: 'fizik', title: 'a', lines: ['y'.repeat(1000)] });
  assert.equal(r.lines[0].length, 300);
});

test('ilerleme özeti: toplam ve deney sayısı', () => {
  const s = lr.summarizeProgress([{ experiment: 'fizik', completed_count: 3 }, { experiment: 'kimya3d', completed_count: 2 }]);
  assert.equal(s.total, 5);
  assert.equal(s.experiments, 2);
  assert.equal(s.byExperiment.fizik, 3);
});
