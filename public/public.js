// Giriş yapmamış ziyaretçinin gördüğü sayfalar: ana sayfa, iki ayrı giriş, kurulum ve kılavuz.
import { api, val, esc, fmtDate, notFoundHtml, toast } from './core.js';
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

const homeView = (announcements = [], schools = []) => {
  const firstSchool = schools[0];
  const schoolPath = firstSchool?.url || '/okulum/';
  const schoolDirectory = schools.length > 1 ? `
    <section class="school-directory" id="school-directory">
      <div class="announce-head"><h2>Okulunuzu seçin</h2><p class="muted">Devam etmek için okulunuza ait giriş sayfasını açın.</p></div>
      <label class="field school-search"><span>Okul ara</span><input type="search" data-school-search autocomplete="off" placeholder="Okul adı veya şehir yazın" aria-label="Okul adı veya şehre göre okul ara"></label>
      <div class="announce-grid" data-school-list>${schools.map(school => `
        <a class="role-card school-link" data-school-entry data-search="${esc(`${school.name} ${school.city}`.toLocaleLowerCase('tr-TR'))}" href="${esc(school.url || `/${encodeURIComponent(school.slug)}/`)}">
          <span class="role-tag green">${esc(school.city || 'Okulum')}</span>
          <h3>${esc(school.name)}</h3>
          <p>Okul giriş sayfasına git <span aria-hidden="true">→</span></p>
          <code>${esc(school.url || `/${encodeURIComponent(school.slug)}/`)}</code>
        </a>`).join('')}</div>
      <p class="muted school-search-empty" data-school-empty hidden>Aramanızla eşleşen okul bulunamadı.</p>
    </section>` : '';
  return { html: `
  <section class="hero">
    <div class="hero-copy">
      <p class="kicker">Okul yönetim sistemi</p>
      <h1>Dersler, ödevler, yoklama ve mesajlar tek yerde.</h1>
      <p class="lead">Müdür okulu ve sınıfları yönetir. Öğretmenler ödev, yoklama ve notlarla ilgilenir. Öğrenciler ödevlerini teslim eder, notlarını ve devamlarını görür.</p>
      <div class="hero-actions">
        ${schools.length > 1
          ? '<button class="btn primary lg" type="button" data-action="school-directory">Okulunu seç</button>'
          : `<a class="btn primary lg" href="${schoolPath}/#/mudur-girisi">Müdür girişi</a><a class="btn ghost lg" href="${schoolPath}/#/giris">Öğretmen / Öğrenci girişi</a>`}
      </div>
      <p class="muted small">${schools.length > 1 ? 'Giriş yapmak için aşağıdan okulunuzu seçin.' : schools.length ? 'Okul hesabınızla giriş yapın.' : `Okul henüz kurulmadıysa <a href="${schoolPath}/#/kurulum">kurulum sayfasını açın</a>.`} ${schools.length > 1 ? '' : `Nasıl kullanılacağını <a href="${schoolPath}/#/yardim">kullanım kılavuzunda</a> bulabilirsiniz.`}</p>
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
  </section>${schoolDirectory}${announcementsSection(announcements)}` };
};

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
        <p class="login-links"><button class="btn ghost sm" type="button" data-action="forgot-open">Şifremi unuttum</button></p>
        <p class="small muted switch-line">${principal
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
          <h2>Veri sorumlusu iletişim bilgileri</h2>
          <p class="muted small">Gizlilik ve KVKK başvurularında kullanılacak gerçek okul unvanını ve iletişim bilgilerini girin.</p>
          <label class="field"><span>Veri sorumlusu unvanı</span><input name="controllerName" required maxlength="120" autocomplete="organization"></label>
          <label class="field"><span>Tebligat / başvuru adresi</span><textarea name="controllerAddress" required maxlength="300" rows="2"></textarea></label>
          <div class="grid-2">
            <label class="field"><span>Başvuru e-postası</span><input name="controllerEmail" type="email" required maxlength="120" autocomplete="email"></label>
            <label class="field"><span>Telefon (isteğe bağlı)</span><input name="controllerPhone" type="tel" maxlength="40" autocomplete="tel"></label>
          </div>
          <p class="small muted">Bu bilgiler okulun veri sorumlusu tarafından doğrulanmalı; hukuki metin yayın öncesinde hukuk danışmanına inceletilmelidir.</p>
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

const KNOWN_PUBLIC = new Set(['', 'mudur-girisi', 'giris', 'kurulum', 'yardim']);
export async function renderPublic(page) {
  if (!KNOWN_PUBLIC.has(page)) return { html: notFoundHtml(false) };
  if (page === 'mudur-girisi') return loginView('principal');
  if (page === 'giris') return loginView('member');
  if (page === 'kurulum') return setupView();
  if (page === 'yardim') return { html: helpHtml() };
  if (location.pathname === '/') {
    const { schools } = await api('/schools').catch(() => ({ schools: [] }));
    if (schools.length > 1) return homeView([], schools);
    const { announcements } = await api('/public/announcements').catch(() => ({ announcements: [] }));
    return homeView(announcements, schools);
  }
  const { announcements } = await api('/public/announcements').catch(() => ({ announcements: [] }));
  return homeView(announcements);
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action="school-directory"]');
  if (!button) return;
  document.querySelector('#school-directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.addEventListener('input', event => {
  if (!event.target.matches('[data-school-search]')) return;
  const query = event.target.value.trim().toLocaleLowerCase('tr-TR');
  const entries = [...document.querySelectorAll('[data-school-entry]')];
  let visible = 0;
  for (const entry of entries) {
    const matches = entry.dataset.search.includes(query);
    entry.hidden = !matches;
    if (matches) visible += 1;
  }
  const empty = document.querySelector('[data-school-empty]');
  if (empty) empty.hidden = visible > 0;
});

// Giriş ve kurulum formları. Başarılıysa uygulama kabuğuna geçilmesi için olay yayınlanır.
FORMS.login = async form => {
  const totpField = form.querySelector('[name=totp]');
  const res = await api('/login', { method: 'POST', body: {
    username: val(form, 'username'), password: val(form, 'password'), portal: form.dataset.portal,
    totp: totpField ? val(form, 'totp').trim() : undefined,
  } });
  if (res.mfaRequired) {
    if (!totpField) {
      const field = document.createElement('label');
      field.className = 'field';
      field.innerHTML = '<span>Doğrulama kodu (kimlik uygulamanızdan)</span><input name="totp" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required>';
      form.querySelector('[data-error]').before(field);
    }
    form.querySelector('[name=totp]').focus();
    toast('Doğrulama kodunu girip tekrar giriş yapın');
    return;
  }
  window.dispatchEvent(new Event('okulum:login'));
};

FORMS.setup = async form => {
  await api('/setup', { method: 'POST', body: {
    schoolName: val(form, 'schoolName'), schoolCity: val(form, 'schoolCity'), schoolYear: val(form, 'schoolYear'),
    controllerName: val(form, 'controllerName'), controllerAddress: val(form, 'controllerAddress'),
    controllerEmail: val(form, 'controllerEmail'), controllerPhone: val(form, 'controllerPhone'),
    name: val(form, 'name'), username: val(form, 'username'), password: val(form, 'password'),
  } });
  window.dispatchEvent(new Event('okulum:login'));
};
