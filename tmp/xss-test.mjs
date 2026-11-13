import assert from 'node:assert/strict';

const esc = (text) => String(text ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const inline = text => esc(text)
  .replace(/`([^`\n]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>')
  .replace(/\[([^\]]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) =>
    '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + '</a>');

function renderMarkdown(source) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = null;
  let code = null;
  const flush = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
  const closeList = () => { if (list) { out.push('</' + list + '>'); list = null; } };
  for (const line of lines) {
    if (code) {
      if (/^```/.test(line)) { out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>'); code = null; }
      else { code.push(line); }
      continue;
    }
    if (/^```/.test(line)) { flush(); closeList(); code = []; continue; }
    if (!line.trim()) { flush(); closeList(); continue; }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flush(); closeList();
      const tag = 'h' + (heading[1].length + 2);
      out.push('<' + tag + '>' + inline(heading[2]) + '</' + tag + '>');
      continue;
    }
    const item = line.match(/^\s*([-*•]|\d+[.)])\s+(.*)$/);
    if (item) {
      flush();
      const type = /\d/.test(item[1]) ? 'ol' : 'ul';
      if (list !== type) { closeList(); out.push('<' + type + '>'); list = type; }
      out.push('<li>' + inline(item[2]) + '</li>');
      continue;
    }
    closeList();
    para.push(line);
  }
  if (code) out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>');
  flush();
  closeList();
  return out.join('');
}

// XSS injection testleri - HTML tag'leri metne dönüştürülmeli, çalışmamalı
const xssPayloads = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '<iframe src=javascript:alert(1)>',
  '<body onload=alert(1)>',
  '<a href=javascript:alert(1)>click</a>',
  '<div onclick=alert(1)>x</div>',
  '<details open ontoggle=alert(1)>x</details>',
];

for (const payload of xssPayloads) {
  const result = renderMarkdown(payload);
  // HTML tag'leri metne dönüştürülmeli (&lt; ve &gt; ile)
  assert.ok(result.includes('&lt;'), 'HTML tag kaçışlı olmalı: ' + payload);
  assert.ok(result.includes('&gt;'), 'HTML tag kaçışlı olmalı: ' + payload);
  // Ham <script> veya  tag'i olmamalı
  assert.ok(!result.match(/<script[^>]*>/), 'script tag çalışmamalı: ' + payload);
  assert.ok(!result.match(/<img[^>]*>/), 'img tag çalışmamalı: ' + payload);
  assert.ok(!result.match(/<iframe[^>]*>/), 'iframe çalışmamalı: ' + payload);
  assert.ok(!result.match(/<svg[^>]*>/), 'svg çalışmamalı: ' + payload);
  assert.ok(!result.match(/<body[^>]*>/), 'body çalışmamalı: ' + payload);
  assert.ok(!result.match(/<details[^>]*>/), 'details çalışmamalı: ' + payload);
  console.log('✓ XSS payload engellendi:', payload.substring(0, 30));
}

// esc() testi
assert.equal(esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
assert.equal(esc('" onmouseover="alert(1)'), '&quot; onmouseover=&quot;alert(1)');
console.log('✓ esc() HTML escape OK');

// Normal markdown çalışıyor mu?
const normal = renderMarkdown('# Merhaba\n\nBu **kalın** ve *italik* metin.\n\n[Google](https://google.com)');
assert.ok(normal.includes('<h3>'), 'heading oluşturmalı');
assert.ok(normal.includes('<strong>'), 'strong oluşturmalı');
assert.ok(normal.includes('<em>'), 'em oluşturmalı');
assert.ok(normal.includes('<a href='), 'link oluşturmalı');
console.log('✓ Normal markdown çalışıyor');

console.log('\nTüm XSS denetimleri başarılı!');
