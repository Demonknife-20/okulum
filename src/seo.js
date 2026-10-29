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

function privacyPage(base) {
  const body = `
<article class="seo-article">
<p class="legal-draft"><strong>Taslak:</strong> Bu metin hukuki onaydan geçene kadar taslaktır. Köşeli parantez içindeki alanlar okul tarafından doldurulmalıdır.</p>
<h1>Gizlilik politikası</h1>
<p>Okulum, okul, öğretmen, öğrenci ve veliler arasında ödev, yoklama, not, duyuru ve iletişim süreçlerini yürüten bir okul yönetim sistemidir. Bu sayfa hangi kişisel verilerin işlendiğini, neden işlendiğini ve kullanıcı haklarını açıklar.</p>
<h2>Hangi veriler işlenir</h2>
<ul>
<li>Kimlik ve iletişim: ad, soyad, kullanıcı adı, okul numarası, e-posta adresi.</li>
<li>Eğitim kayıtları: ödevler ve teslimler, yoklama, notlar, sınav sonuçları, davranış puanları ve gözlem notları.</li>
<li>İletişim içerikleri: mesajlar, pano notları, yorumlar ve yüklenen dosyalar.</li>
<li>Güvenlik kayıtları: giriş denemeleri, iki adımlı doğrulama bilgisi (şifreli olarak) ve cihaz bildirim aboneliği.</li>
</ul>
<h2>Verilerin işlenme amacı</h2>
<p>Veriler yalnızca okulun eğitim ve yönetim süreçlerini yürütmek, güvenliği sağlamak ve kullanıcının talep ettiği işlemleri (örneğin şifre sıfırlama) gerçekleştirmek için kullanılır.</p>
<h2>Verilerin paylaşımı</h2>
<p>Veriler, hizmeti sağlamak için kullanılan altyapı sağlayıcılarında tutulur: uygulama barındırma (Render), veritabanı ve dosya depolama (Supabase) ve e-posta gönderimi ([e-posta sağlayıcısı]). Veriler bunların dışında üçüncü kişilerle paylaşılmaz.</p>
<h2>Saklama süresi</h2>
<p>[Verilerin ne kadar süre saklandığı burada belirtilecek. Örneğin: öğrenci kayıtları okul yılı sonrasında ... süreyle saklanır.]</p>
<h2>Kullanıcı hakları</h2>
<p>Kişisel verilerinizle ilgili olarak bilgi edinme, düzeltme, silme ve dışa aktarma haklarına sahipsiniz. Uygulama içinde verilerinizi dışa aktarabilir ve hesap silme talebi oluşturabilirsiniz. Diğer talepler için aşağıdaki iletişim adresini kullanın.</p>
<h2>Açık rıza ve aydınlatma</h2>
<p>Uygulamayı ilk kullanımınızda kişisel verilerinizin işlenmesine ilişkin aydınlatma metnini onaylamanız istenir.</p>
<h2>İletişim</h2>
<p>[Veri sorumlusu okul adı], [adres], [e-posta adresi].</p>
</article>`;
  return SHELL(base, {
    title: 'Gizlilik politikası · Okulum',
    description: 'Okulum uygulamasında hangi kişisel verilerin işlendiği, neden işlendiği ve kullanıcı haklarının açıklaması.',
    path: '/gizlilik',
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

module.exports = { usagePage, aboutPage, privacyPage, notFoundPage, sitemap, robots };
