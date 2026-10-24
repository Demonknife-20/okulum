import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { sanitizeSvg, parseQuizDraft, buildQuizPrompt } = require('../src/quizdraft.js');

const good = { text: '3 + 4 kaça eşittir?', options: ['5', '6', '7', '8'], correctIndex: 2, explanation: 'Toplam 7.', svg: '' };

test('taslak: geçerli sorular kabul edilir ve kod bloğu işaretleri temizlenir', () => {
  const raw = '```json\n' + JSON.stringify({ questions: [good] }) + '\n```';
  const [q] = parseQuizDraft(raw);
  assert.equal(q.text, '3 + 4 kaça eşittir?');
  assert.equal(q.correctIndex, 2);
  assert.equal(q.svg, null);
});

test('taslak: hatalı biçimler açıklayıcı hatayla reddedilir', () => {
  assert.throws(() => parseQuizDraft('bu JSON değil'), /geçerli bir taslak/);
  assert.throws(() => parseQuizDraft(JSON.stringify({ questions: [] })), /1 ile 10/);
  assert.throws(() => parseQuizDraft(JSON.stringify({ questions: [{ ...good, options: ['a', 'b', 'c'] }] })), /tam olarak 4 seçenek/);
  assert.throws(() => parseQuizDraft(JSON.stringify({ questions: [{ ...good, correctIndex: 4 }] })), /doğru cevabı/);
  assert.throws(() => parseQuizDraft(JSON.stringify({ questions: [{ ...good, options: ['5', '5', '7', '8'] }] })), /birbirinin aynı/);
});

test('görsel: güvenli SVG korunur; betik, bağlantı ve dış kaynak içeren SVG temizlenir', () => {
  const safe = '<svg viewBox="0 0 400 300"><line x1="0" y1="0" x2="100" y2="100"/><text x="10" y="20">A</text></svg>';
  assert.equal(sanitizeSvg(safe), safe);
  assert.equal(sanitizeSvg('<svg><script>alert(1)</script></svg>'), null);
  assert.equal(sanitizeSvg('<svg onload="x()"><circle r="5"/></svg>'), null);
  assert.equal(sanitizeSvg('<svg><a href="https://x.com"><circle r="5"/></a></svg>'), null);
  assert.equal(sanitizeSvg('<svg><image href="https://x.com/a.png"/></svg>'), null);
  assert.equal(sanitizeSvg('<svg><foreignObject><div>x</div></foreignObject></svg>'), null);
  assert.equal(sanitizeSvg('<svg><style>@import "x";</style></svg>'), null);
  assert.equal(sanitizeSvg('düz metin'), null);
});

test('taslak: geçersiz görsel soruyu reddetmez, yalnızca görseli atar', () => {
  const [q] = parseQuizDraft(JSON.stringify({ questions: [{ ...good, svg: '<svg><script>x</script></svg>' }] }));
  assert.equal(q.svg, null);
  assert.equal(q.text, good.text);
});

test('istem: konu ve örnek tırnak içinde verilir; görsel kuralı seçime göre değişir', () => {
  const withImg = buildQuizPrompt({ topic: 'Üçgenler', example: 'Örnek soru', count: 3, withImages: true });
  assert.match(withImg, /Tam olarak 3 soru/);
  assert.match(withImg, /Konu: """Üçgenler"""/);
  assert.match(withImg, /Örnek soru.*"""Örnek soru"""/s);
  assert.match(withImg, /viewBox="0 0 400 300"/);
  const noImg = buildQuizPrompt({ topic: 'Kesirler', example: '', count: 5, withImages: false });
  assert.match(noImg, /svg" alanını boş bırak/);
  assert.doesNotMatch(noImg, /Örnek soru/);
});

test('svg izin listesi: meşru şekiller geçer, kaçınmaya çalışan yapılar reddedilir', () => {
  const ok = '<svg viewBox="0 0 400 300"><g fill="none" stroke="#000"><circle cx="10" cy="10" r="5"/><text x="5" y="20" font-size="14">A</text></g></svg>';
  assert.equal(sanitizeSvg(ok), ok);
  const bad = [
    '<svg onload="alert(1)"><circle r="5"/></svg>',
    '<svg ONLOAD="x()"><circle r="5"/></svg>',
    '<svg><circle r="5" href="javascript:alert(1)"/></svg>',
    '<svg><circle r="5" fill="url(#x)"/></svg>',
    '<svg><circle r="5" fill="javascript:x"/></svg>',
    '<svg><circle r="5" fill="&#106;avascript:x"/></svg>',
    '<svg><script>alert(1)</script></svg>',
    '<svg><a href="https://x.com"><circle r="5"/></a></svg>',
    '<svg><circle r="5"></svg>',
    '<svg><circle r="5"/></g></svg>',
    '<svg><circle r="5"/><!-- x --></svg>',
    '<svg><circle r="5"/>düz < metin</svg>',
    '<svg><style>@import "x";</style></svg>',
    '<svg><foreignObject><div>x</div></foreignObject></svg>',
    '<svg><circle r="5"/></svg><svg><rect/></svg>',
    '<svg><circle r="5" data-x="1"/></svg>',
  ];
  for (const svg of bad) assert.equal(sanitizeSvg(svg), null, `reddedilmeliydi: ${svg}`);
});
