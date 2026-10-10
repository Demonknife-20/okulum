// Giriş yapmamış ziyaretçinin gördüğü sayfalar: ana sayfa, iki ayrı giriş, kurulum ve kılavuz.
import { api, val, esc, fmtDate } from './core.js';
import { FORMS } from './views.js';
import { helpHtml } from './help.js';

const setupRequired = async () => (await api('/setup').catch(() => ({ setupRequired: false }))).setupRequired;

const announcementsSection = list => !list.length ? '' : `
  <section class="announce">
    <div class="announce-head"><h2>Okuldan duyurular</h2><p class="muted">Müdürün okul panosunda paylaştığı son notlar</p></div>
    <div class="announce-grid">${list.map(a => `
      <article class="announce-card pin-${esc(a.color)}">
        ${a.title ? `<h3>${esc(a.title)}</h3>` : ''}
        ${a.body ? `<p>${esc(a.body.length > 260 ? `${a.body.slice(0, 260)}…` : a.body)}</p>` : ''}
        ${a.link ? `<a href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">Bağlantıya git →</a>` : ''}
        ${a.hasFile ? '<span class="small muted">Ek dosya içerir (giriş yaparak görebilirsiniz)</span>' : ''}
        <footer class="small">${esc(a.boardTitle)} · ${esc(fmtDate(a.createdAt))}</footer>
      </article>`).join('')}
    </div>
  </section>`;

const homeView = (announcements = []) => ({ html: `
  <section class="hero">
    <div class="hero-copy">
      <p class="kicker">Okul yönetim sistemi</p>
      <h1>Dersler, ödevler, yoklama ve mesajlar tek yerde.</h1>
      <p class="lead">Müdür okulu ve sınıfları yönetir. Öğretmenler ödev, yoklama ve notlarla ilgilenir. Öğrenciler ödevlerini teslim eder, notlarını ve devamlarını görür.</p>
      <div class="hero-actions">
        <a class="btn primary lg" href="#/mudur-girisi">Müdür girişi</a>
        <a class="btn ghost lg" href="#/giris">Öğretmen / Öğrenci girişi</a>
      </div>
      <p class="muted small">Okul henüz kurulmadıysa müdür olarak <a href="#/kurulum">okulu kurun</a>. Nasıl kullanılacağını <a href="#/yardim">kullanım kılavuzunda</a> bulabilirsiniz.</p>
    </div>
    <div class="hero-cards">
      <article class="role-card">
        <span class="role-tag coral">Müdür</span>
        <h3>Okulu yönetin</h3>
        <p>Sınıf ve ders tanımlayın, hesap açın, öğretmen atamalarını yapın, denetim kaydını izleyin.</p>
      </article>
      <article class="role-card">
        <span class="role-tag green">Öğretmen</span>
        <h3>Dersinizi takip edin</h3>
        <p>Ödev verin, teslimleri notlandırın, yoklama alın, devamsızlık uyarılarını görün.</p>
      </article>
      <article class="role-card">
        <span class="role-tag blue">Öğrenci</span>
        <h3>Ödevlerinizi teslim edin</h3>
        <p>Ödevlerinizi yükleyin, notlarınızı ve devamınızı izleyin, öğretmenlerinize yazın.</p>
      </article>
    </div>
  </section>
  <section class="steps">
    <h2>Nasıl başlanır?</h2>
    <ol class="step-list">
      <li><strong>Okulu kurun.</strong> Müdür, okul bilgisi ve kendi hesabıyla başlar.</li>
      <li><strong>Sınıf ve dersleri ekleyin.</strong> Okul sayfasından tanımlanır.</li>
      <li><strong>Hesapları açın.</strong> Öğretmenlere sınıf ve ders, öğrencilere sınıf ve okul numarası verilir.</li>
      <li><strong>Herkes kendi girişinden girer.</strong> Müdürler "Müdür girişi", diğerleri "Öğretmen / Öğrenci girişi" ile girer.</li>
    </ol>
  </section>${announcementsSection(announcements)}` });

const loginView = portal => {
  const principal = portal === 'principal';
  return { html: `
    <section class="auth-page">
      <div class="auth-box">
        <p class="kicker">${principal ? 'Müdür girişi' : 'Öğretmen / Öğrenci girişi'}</p>
        <h1>Giriş yap</h1>
        <p class="muted">${principal
          ? 'Bu sayfa yalnızca müdür hesapları içindir.'
          : 'Öğretmen ve öğrenci hesaplarınızla bu sayfadan girin.'}</p>
        <form class="stack" data-form="login" data-portal="${portal}">
          <label class="field"><span>Kullanıcı adı</span><input name="username" autocomplete="username" required maxlength="40" autofocus></label>
          <label class="field"><span>Şifre</span><input name="password" type="password" autocomplete="current-password" required maxlength="128"></label>
          <p class="form-error" data-error role="alert"></p>
          <button class="btn primary block lg" type="submit">Giriş yap</button>
        </form>
        <p class="small muted switch">${principal
          ? 'Öğretmen veya öğrenciyseniz <a href="#/giris">Öğretmen / Öğrenci girişi</a>ni kullanın.'
          : 'Müdürseniz <a href="#/mudur-girisi">Müdür girişi</a>ni kullanın.'}</p>
        <p class="small muted">Hesabınız yoksa okul müdüründen isteyin. Nasıl kullanılacağını <a href="#/yardim">kılavuzdan</a> öğrenebilirsiniz.</p>
      </div>
      <aside class="auth-aside">
        <h2>${principal ? 'Müdür olarak yapabilecekleriniz' : 'Hesabınızla yapabilecekleriniz'}</h2>
        <ul>
          ${principal
            ? '<li>Sınıf ve ders tanımlama</li><li>Öğretmen, öğrenci ve müdür hesabı açma</li><li>Şifre sıfırlama ve hesap yönetimi</li><li>Denetim kaydını izleme</li>'
            : '<li>Ödev görme, dosya teslim etme</li><li>Not ve geri bildirim görme</li><li>Yoklama ve devam takibi</li><li>Yetkili kişilerle mesajlaşma</li>'}
        </ul>
      </aside>
    </section>` };
};

const setupView = async () => {
  if (!(await setupRequired())) {
    return { html: `<section class="auth-page single"><div class="auth-box">
      <p class="kicker">Okul kurulumu</p><h1>Okul zaten kurulu</h1>
      <p class="muted">Bu sistemde okul daha önce kuruldu. Müdürseniz <a href="#/mudur-girisi">Müdür girişi</a>ni kullanın.</p>
    </div></section>` };
  }
  return { html: `
    <section class="auth-page single">
      <div class="auth-box wide">
        <p class="kicker">Okul kurulumu</p>
        <h1>Okulunuzu oluşturun</h1>
        <p class="muted">Bu işlem yalnızca bir kez yapılır. Oluşturduğunuz müdür hesabıyla okulu yönetirsiniz; diğer müdürleri daha sonra siz eklersiniz.</p>
        <form class="stack" data-form="setup">
          <div class="grid-2">
            <label class="field"><span>Okul adı</span><input name="schoolName" required maxlength="120"></label>
            <label class="field"><span>Şehir</span><input name="schoolCity" required maxlength="80"></label>
          </div>
          <label class="field"><span>Eğitim yılı</span><input name="schoolYear" placeholder="2026–2027" maxlength="20"></label>
          <hr>
          <label class="field"><span>Müdür adı soyadı</span><input name="name" required maxlength="80"></label>
          <div class="grid-2">
            <label class="field"><span>Kullanıcı adı</span><input name="username" required minlength="3" maxlength="32" autocomplete="username" placeholder="ornek: murat.aydin"><small>Küçük harf, rakam, nokta, tire, alt çizgi.</small></label>
            <label class="field"><span>Şifre</span><input name="password" type="password" required minlength="8" maxlength="128" autocomplete="new-password"><small>En az 8 karakter; harf ve rakam.</small></label>
          </div>
          <p class="form-error" data-error role="alert"></p>
          <button class="btn primary block lg" type="submit">Okulu oluştur</button>
        </form>
      </div>
    </section>` };
};

export async function renderPublic(page) {
  if (page === 'mudur-girisi') return loginView('principal');
  if (page === 'giris') return loginView('member');
  if (page === 'kurulum') return setupView();
  if (page === 'yardim') return { html: helpHtml() };
  const { announcements } = await api('/public/announcements').catch(() => ({ announcements: [] }));
  return homeView(announcements);
}

// Giriş ve kurulum formları. Başarılıysa uygulama kabuğuna geçilmesi için olay yayınlanır.
FORMS.login = async form => {
  await api('/login', { method: 'POST', body: { username: val(form, 'username'), password: val(form, 'password'), portal: form.dataset.portal } });
  window.dispatchEvent(new Event('okulum:login'));
};

FORMS.setup = async form => {
  await api('/setup', { method: 'POST', body: {
    schoolName: val(form, 'schoolName'), schoolCity: val(form, 'schoolCity'), schoolYear: val(form, 'schoolYear'),
    name: val(form, 'name'), username: val(form, 'username'), password: val(form, 'password'),
  } });
  window.dispatchEvent(new Event('okulum:login'));
};
