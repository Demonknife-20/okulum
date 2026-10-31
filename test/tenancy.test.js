const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL ||= 'postgresql://localhost/okulum_tenancy_unit_test';
const { schemaForSlug, slugify, validSlug, schoolUrl } = require('../src/tenancy');
const { sitemap } = require('../src/seo');

test('school slugs normalize Turkish names and reject reserved routes', () => {
  assert.equal(slugify('İstanbul Şehitler İlkokulu'), 'istanbul-sehitler-ilkokulu');
  assert.equal(slugify('API'), 'okulum');
  assert.equal(validSlug('yildiz-okulu'), true);
  assert.equal(validSlug('ab'), false);
  assert.equal(validSlug('platform'), false);
  assert.equal(schoolUrl('yildiz-okulu'), '/yildiz-okulu/');
  assert.throws(() => schoolUrl('platform'), /geçersiz/i);
});

test('school schemas are deterministic and distinct per slug', () => {
  assert.match(schemaForSlug('yildiz-okulu'), /^tenant_[a-f0-9]{20}$/);
  assert.notEqual(schemaForSlug('yildiz-okulu'), schemaForSlug('cumhuriyet-okulu'));
  assert.throws(() => schemaForSlug('platform'), /geçersiz/i);
});

test('sitemap includes tenant landing pages', () => {
  const xml = sitemap('https://okulum.example', [{ slug: 'yildiz-okulu' }]);
  assert.match(xml, /https:\/\/okulum\.example\/yildiz-okulu\//);
});

// Regresyon: server.js'teki okul-yolu regex'i, `/slug/`'yi `/slug`'dan ayırt edebilmeli.
// Eskiden suffix = slice(...+1) yüzünden `/slug/` de `''` üretiyor, sonsuz 308 döngüsü oluşuyordu.
test('school route regex separates slug-only from slug-slash', () => {
  const re = /^\/([a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9]))(\/.*)?$/;
  const parse = path => {
    const m = path.match(re);
    if (!m) return null;
    return { slug: m[1], suffix: m[2] == null ? '' : m[2] };
  };
  assert.deepEqual(parse('/soke-fen-lisesi'), { slug: 'soke-fen-lisesi', suffix: '' });
  assert.deepEqual(parse('/soke-fen-lisesi/'), { slug: 'soke-fen-lisesi', suffix: '/' });
  assert.deepEqual(parse('/soke-fen-lisesi/gizlilik'), { slug: 'soke-fen-lisesi', suffix: '/gizlilik' });
  // `/api`, `/platform` regex'e girer; sunucu `findSchoolBySlug` null dönünce 404'e çevirir.
  // Bu yüzden burada önemli olan suffix ayrımı, eşleştirme değil.
  assert.equal(parse('/yildiz-okulu').suffix, '');
  assert.equal(parse('/yildiz-okulu/').suffix, '/');
  // Eski bug: iki durum da `''` üretiyordu. Ayrılmazlarsa sonsuz 308 döngüsü oluşur.
  assert.notEqual(parse('/soke-fen-lisesi').suffix, parse('/soke-fen-lisesi/').suffix);
});
