// Google için statik sayfalar, site haritası ve robots.txt.

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const SHELL = (base, { title, description, path, body }) => `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(base + path)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Okulum">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(base + path)}">
<meta name="robots" content="index, follow">
<link rel="icon" href="/icon-192.png" type="image/png">
<link rel="stylesheet" href="/styles.css">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url: base + path, isPartOf: { '@type': 'WebSite', name: 'Okulum', url: base + '/' } })}</script>
</head>
<body class="seo-page">
<header class="public-top"><a class="brand" href="/"><span class="brand-mark"><img src="/brand-mark.png" alt="" width="40" height="40"></span><span class="brand-name">okulum</span></a>
<nav class="public-nav"><a href="/kullanim">Kullanım</a><a href="/hakkinda">Hakkında</a><a class="btn primary sm" href="/#/mudur-girisi">Giriş yap</a></nav></header>
<main class="public-view seo-main">${body}</main>
<footer class="public-foot">Okulum · Okul yönetim sistemi · <a href="/kullanim">Kullanım kılavuzu</a> · <a href="/hakkinda">Hakkında</a></footer>
</body>
</html>`;

function usagePage(base, { HELP_SECTIONS }) {
  const body = `<article class="help seo-article">
    <h1>Okulum kullanım kılavuzu</h1>
    <p class="lead">Okulum okul yönetim sistemi için rol bazlı kullanım rehberi: müdür, öğretmen, öğrenci ve veli.</p>
    ${HELP_SECTIONS.map(section => `<section class="seo-section"><h2>${esc(section.title)}</h2>${section.intro ? `<p>${esc(section.intro)}</p>` : ''}
      <dl>${section.items.map(([term, text]) => `<dt>${esc(term)}</dt><dd>${esc(text)}</dd>`).join('')}</dl></section>`).join('')}
    <p><a class="btn primary" href="/#/giris">Öğretmen / Öğrenci girişi</a> <a class="btn ghost" href="/#/mudur-girisi">Müdür girişi</a></p>
  </article>`;
  return SHELL(base, { title: 'Okulum kullanım kılavuzu: müdür, öğretmen, öğrenci ve veli rehberi', description: 'Okulum okul yönetim sistemini nasıl kullanacağınızı öğrenin: ödev, yoklama, sınav, not, pano ve veli takibi.', path: '/kullanim', body });
}

function aboutPage(base, { ABOUT }) {
  const body = `<article class="help seo-article">
    <h1>${esc(ABOUT.title)}</h1>
    <p class="lead">${esc(ABOUT.intro)}</p>
    <ul class="seo-points">${ABOUT.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
    <p><a class="btn primary" href="/#/mudur-girisi">Okulu kurun</a> <a class="btn ghost" href="/kullanim">Kullanım kılavuzu</a></p>
  </article>`;
  return SHELL(base, { title: 'Okulum hakkında: okul yönetim sistemi', description: 'Okulum, okul müdürleri, öğretmenler, öğrenciler ve veliler için ödev, yoklama, sınav ve not yönetim sistemidir.', path: '/hakkinda', body });
}

function sitemap(base) {
  const urls = ['/', '/kullanim', '/hakkinda'];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(path => `  <url><loc>${esc(base + path)}</loc><changefreq>weekly</changefreq><priority>${path === '/' ? '1.0' : '0.7'}</priority></url>`).join('\n')}
</urlset>
`;
}

function robots(base) {
  return `User-agent: *
Allow: /
Allow: /kullanim
Allow: /hakkinda
Disallow: /api/
Disallow: /gizli-dizin/
Crawl-delay: 5

Sitemap: ${base}/sitemap.xml
`;
}

function notFoundPage(base) {
  const body = `<section class="not-found">
    <div class="nf-code" aria-hidden="true">404</div>
    <h1>Sayfa bulunamadı</h1>
    <p>Aradığınız adres taşınmış, silinmiş ya da hiç var olmamış olabilir.</p>
    <div class="nf-actions"><a class="btn primary" href="/">Ana sayfa</a><a class="btn ghost" href="/kullanim">Kullanım kılavuzu</a></div>
  </section>`;
  return SHELL(base, { title: 'Sayfa bulunamadı · Okulum', description: 'Aradığınız sayfa bulunamadı.', path: '/', body })
    .replace('content="index, follow"', 'content="noindex, nofollow"');
}

module.exports = { usagePage, aboutPage, notFoundPage, sitemap, robots };
