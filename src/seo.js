// Google için statik sayfalar, site haritası ve robots.txt.
const { buildKvkkNotice } = require('./kvkk');

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const jsonForScript = value => JSON.stringify(value).replace(/</g, '\\u003c');

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
<script type="application/ld+json">${jsonForScript({ '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url: base + path, isPartOf: { '@type': 'WebSite', name: 'Okulum', url: base + '/' } })}</script>
</head>
<body class="seo-page">
<header class="public-top"><a class="brand" href="/"><span class="brand-mark"><img src="/brand-mark.png" alt="" width="40" height="40"></span><span class="brand-name">okulum</span></a>
<nav class="public-nav"><a href="/kullanim">Kullanım</a><a href="/hakkinda">Hakkında</a><a href="${esc(path.endsWith('/gizlilik') ? path : '/gizlilik')}">Gizlilik</a><a class="btn primary sm" href="/#/mudur-girisi">Giriş yap</a></nav></header>
<main class="public-view seo-main">${body}</main>
<footer class="public-foot">Okulum · Okul yönetim sistemi · <a href="/kullanim">Kullanım kılavuzu</a> · <a href="/hakkinda">Hakkında</a> · <a href="${esc(path.endsWith('/gizlilik') ? path : '/gizlilik')}">Gizlilik</a></footer>
</body>
</html>`;

function privacyPage(base, { school = null, schools = [], path = '/gizlilik' } = {}) {
  const notice = school ? buildKvkkNotice(school) : null;
  const providers = ['Render (uygulama barındırma)', 'Supabase (veritabanı ve dosya depolama)'];
  if (process.env.GEMINI_API_KEY) providers.push('Varsayılan Google Gemini API’si veya GEMINI_BASE_URL ile yapılandırılan uyumlu yapay zekâ uç noktası');
  if (process.env.RESEND_API_KEY && process.env.SMTP_FROM) providers.push('Resend (e-posta gönderimi)');
  else if (process.env.SMTP_HOST && process.env.SMTP_FROM) providers.push('SMTP_HOST ile yapılandırılan e-posta sağlayıcısı');
  const body = school
    ? `<article class="seo-article">
        <p class="legal-draft"><strong>Yayın öncesi:</strong> Bu uygulama metni bilgilendirme taslağıdır. Okul, veri işleme faaliyetlerini ve hukuki sebepleri doğrulamalı; sağlayıcı/ülke bilgilerini ve gerekiyorsa aktarım mekanizmasını teyit edip hukuk danışmanına onaylatmalıdır.</p>
        <h1>${esc(school.name)} · gizlilik ve kişisel verilerin korunması</h1>
        <p>${esc(notice.intro)}</p>
        ${notice.sections.map(section => `<section class="seo-section"><h2>${esc(section.title)}</h2><p>${esc(section.text)}</p></section>`).join('')}
        <section class="seo-section"><h2>Yapılandırılmış hizmet sağlayıcıları</h2><p>${providers.map(esc).join('; ')}. Bu liste altyapı yapılandırmasına dayanır; okul, sözleşme ve veri konumlarını ayrıca doğrulamalıdır.</p></section>
        <p><a class="btn primary" href="/${encodeURIComponent(school.slug)}/#/giris">Okul giriş sayfası</a></p>
      </article>`
    : `<article class="seo-article">
        <p class="legal-draft"><strong>Platform kapsamı:</strong> Bu sayfa genel platform bilgisi verir. Okul hesapları ayrı tutulur; her okul kendi okul kayıtları için aydınlatma ve iletişim bilgilerini belirlemelidir. Hizmeti işleten kuruluşun kendi platform yönetimi kayıtlarına ilişkin unvan ve iletişim bilgileri de yayından önce eklenmelidir.</p>
        <h1>Okulum · gizlilik ve kişisel verilerin korunması</h1>
        <p>Okulum, okulların eğitim ve yönetim süreçleri için kullandığı çok-okullu bir yazılımdır. Bir okulun kullanıcı hesabı, ödev, not, yoklama, iletişim ve dosyaları için o okulun adresindeki okul-özel aydınlatma metnini inceleyin.</p>
        <h2>Okul-özel aydınlatma metinleri</h2>
        <ul>${schools.map(item => `<li><a href="/${encodeURIComponent(item.slug)}/gizlilik">${esc(item.name)} · ${esc(item.city)} gizlilik metni</a></li>`).join('') || '<li>Henüz kayıtlı okul bulunmuyor.</li>'}</ul>
        <h2>Hizmet altyapısı</h2><p>${providers.map(esc).join('; ')}. Kullanılan sağlayıcı, veri konumu ve hukuki aktarım koşulları dağıtım ayarlarına göre değişir.</p>
        <h2>Platform yöneticisi hesabı</h2><p>Platform yönetimi için kullanıcı adı, parola doğrulama özeti ve güvenlik/erişim kayıtları işlenir. Bu işlemin veri sorumlusu, iletişim kanalı ve saklama süresi işletmeci tarafından belirlenip bu metne eklenmelidir.</p>
      </article>`;
  return SHELL(base, {
    title: `${school ? `${school.name} · ` : ''}Gizlilik ve kişisel verilerin korunması · Okulum`,
    description: 'Okulum okul yönetim sisteminde işlenen kişisel veriler, amaçlar, saklama, aktarım ve başvuru yolları hakkında bilgilendirme.',
    path,
    body,
  });
}

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

function sitemap(base, schools = []) {
  const urls = ['/', '/kullanim', '/hakkinda', ...schools.flatMap(school => [
    `/${encodeURIComponent(school.slug)}/`,
    `/${encodeURIComponent(school.slug)}/gizlilik`,
  ])];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(path => `  <url><loc>${esc(base + path)}</loc><changefreq>weekly</changefreq><priority>${path === '/' ? '1.0' : '0.7'}</priority></url>`).join('\n')}
</urlset>
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

module.exports = { usagePage, aboutPage, privacyPage, notFoundPage, sitemap };
