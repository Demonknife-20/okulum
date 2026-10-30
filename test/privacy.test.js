const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildKvkkNotice } = require('../src/kvkk');
const { privacyPage, schoolAppPage } = require('../src/seo');

test('school notice renders configured controller details and distinguishes acknowledgment from consent', () => {
  const school = {
    name: 'Yıldız Akademi',
    controllerName: 'Yıldız Akademi Okul Müdürlüğü',
    controllerAddress: 'İstanbul, Türkiye',
    controllerEmail: 'kvkk@yildiz.example',
  };
  const notice = buildKvkkNotice(school);
  assert.equal(notice.contactComplete, true);
  assert.match(notice.sections[0].text, /kvkk@yildiz\.example/);
  assert.match(notice.intro, /açık rıza veya veri işlemenin hukuki dayanağı değildir/);
  assert.match(notice.sections.find(section => section.title === 'Çocuklar ve veli/yasal temsilci').text, /veli veya yasal temsilci adına/);
  assert.match(notice.sections.find(section => section.title === 'Saklama ve silme').text, /tüm verinin anında ve geri döndürülemez biçimde silindiği anlamına gelmez/);
  assert.notEqual(notice.version, buildKvkkNotice({ ...school, controllerEmail: 'info@yildiz.example' }).version);
});

test('school privacy page shows school contact information and the draft review warning', () => {
  const html = privacyPage('https://okulum.example', {
    school: {
      slug: 'yildiz-okulu',
      name: 'Yıldız Okulu',
      controllerName: 'Yıldız Okulu Müdürlüğü',
      controllerAddress: 'Ankara, Türkiye',
      controllerEmail: 'kvkk@yildiz.example',
    },
    path: '/yildiz-okulu/gizlilik',
  });
  assert.match(html, /Yıldız Okulu Müdürlüğü/);
  assert.match(html, /kvkk@yildiz\.example/);
  assert.match(html, /hukuk danışmanı/);
  assert.match(html, /\/yildiz-okulu\/gizlilik/);
});

test('school-controlled names are escaped inside structured SEO data', () => {
  const html = privacyPage('https://okulum.example', {
    school: {
      slug: 'yildiz-okulu',
      name: '</script><script>alert(1)</script>',
    },
    path: '/yildiz-okulu/gizlilik',
  });
  assert.doesNotMatch(html, /<\/script><script>alert\(1\)<\/script>/);
  assert.match(html, /\\u003c\/script>/);
});

test('school app landing metadata uses the school path and safely escapes school-controlled values', () => {
  const html = schoolAppPage(
    '<title>Okulum</title><meta name="description" content="Default"><link rel="canonical" href="/"><meta property="og:title" content="Okulum"><meta property="og:description" content="Default"><meta property="og:url" content="/">',
    'https://okulum.example',
    { slug: 'yildiz-okulu', name: '<Yıldız Okulu>', city: 'Ankara' },
  );
  assert.match(html, /<title>&lt;Yıldız Okulu&gt; · Okulum<\/title>/);
  assert.match(html, /https:\/\/okulum\.example\/yildiz-okulu\//);
  assert.doesNotMatch(html, /<Yıldız Okulu>/);
});

test('platform privacy page links to each registered school notice', () => {
  const html = privacyPage('https://okulum.example', {
    schools: [{ slug: 'yildiz-okulu', name: 'Yıldız Okulu', city: 'Ankara' }],
  });
  assert.match(html, /\/yildiz-okulu\/gizlilik/);
  assert.match(html, /Hizmeti işleten kuruluşun kendi platform yönetimi kayıtlarına/);
});
