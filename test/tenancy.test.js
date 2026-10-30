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
