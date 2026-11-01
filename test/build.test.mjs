// Alt kaynak bütünlüğü (SRI) ve harici betik denetimi: kaynak HTML + dist derlemesi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

// src/href taşıyan her betik ve bağlantı etiketi
const tagSources = html => [...html.matchAll(/<(?:script|link)\b[^>]*>/gi)]
  .map(match => {
    const attr = /(?:src|href)="([^"]*)"/i.exec(match[0]);
    return { tag: match[0], url: attr ? attr[1] : '' };
  })
  .filter(({ url }) => url);

test('kaynak: ana sayfada harici betik yok, tek üçüncü taraf yazı tipi', () => {
  for (const page of ['public/index.html', 'public/platform.html']) {
    const html = read(...page.split('/'));
    for (const { url } of tagSources(html)) {
      if (/^https:\/\//.test(url)) {
        assert.match(url, /^https:\/\/fonts\.(googleapis|gstatic)\.com(\/|$)/,
          `${page}: harici alt kaynak yalnızca Google Yazı Tipi olabilir: ${url}`);
        continue;
      }
      assert.ok(url.startsWith('/'), `${page}: bağıl olmayan adres: ${url}`);
    }
    // CSP script-src 'self' olduğu için harici reklam betiği hiç yüklenmiyordu; kalıntısı da kalmamalı.
    assert.doesNotMatch(html, /adsbygoogle|googlesyndication|google-adsense/i, `${page}: reklam betiği kalıntısı`);
  }
});

test('derleme: dist sayfalarındaki her betik ve stil SRI taşır, özet dosyayla eşleşir', t => {
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    return t.skip('dist/ derlenmedi; önce npm run build çalıştırılmalı');
  }
  for (const page of ['index.html', 'platform.html']) {
    const html = fs.readFileSync(path.join(dist, page), 'utf8');
    const assets = tagSources(html).filter(({ url }) => /\.(js|css)$/.test(url));
    assert.ok(assets.length >= 2, `${page}: betik ve stil etiketi bulunamadı`);
    for (const { tag, url } of assets) {
      const integrity = (tag.match(/\bintegrity="([^"]*)"/) || [])[1];
      assert.ok(integrity, `${page}: ${url} SRI özeti olmadan yükleniyor`);
      assert.match(integrity, /^sha384-[A-Za-z0-9+/]{64}$/, `${page}: ${url} özeti sha384 değil`);
      assert.match(tag, /\bcrossorigin="anonymous"/, `${page}: ${url} crossorigin olmadan SRI kullanamaz`);
      const digest = createHash('sha384').update(fs.readFileSync(path.join(dist, url.slice(1)))).digest('base64');
      assert.equal(integrity, `sha384-${digest}`, `${page}: ${url} özeti dosya içeriğiyle eşleşmiyor`);
    }
    assert.doesNotMatch(html, /^<(script|link)[^>]*src="https?:/m, `${page}: derlenmiş sayfada harici betik var`);
  }
});
