// Uygulama kurulumu (PWA): Android/Chrome'da "Uygulamayı yükle" düğmesi, iPhone'da ekleme yönergesi.
const DISMISS_KEY = 'okulum-install-dismissed';
let deferred = null;

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

function showPill(label, onClick) {
  let pill = document.querySelector('.install-pill');
  if (!pill) {
    pill = document.createElement('div');
    pill.className = 'install-pill';
    pill.setAttribute('role', 'region');
    pill.setAttribute('aria-label', 'Uygulamayı yükle');
    document.body.appendChild(pill);
  }
  pill.innerHTML = `<span class="install-text"></span><button type="button" class="btn primary sm install-go"></button><button type="button" class="icon-btn sm install-close" aria-label="Kapat">×</button>`;
  pill.querySelector('.install-text').textContent = label.text;
  const go = pill.querySelector('.install-go');
  go.textContent = label.button;
  go.addEventListener('click', onClick);
  pill.querySelector('.install-close').addEventListener('click', () => {
    localStorage.setItem(DISMISS_KEY, '1');
    pill.remove();
  });
}

export function setupInstall() {
  if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return;

  // Android / masaüstü Chrome: tarayıcı kurulum isteğini yakalar, biz düğmeye bağlarız
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferred = event;
    showPill({ text: 'Okulum uygulamasını telefonunuza ekleyin', button: 'Yükle' }, async () => {
      if (!deferred) return;
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      document.querySelector('.install-pill')?.remove();
    });
  });

  window.addEventListener('appinstalled', () => {
    document.querySelector('.install-pill')?.remove();
  });

  // iPhone: kurulum isteği yoktur; Safari'de Paylaş → Ana Ekrana Ekle yönergesi gösterilir
  if (isIos()) {
    showPill({ text: 'Ana ekrana ekleyin: Paylaş (□↑) → "Ana Ekrana Ekle"', button: 'Tamam' }, () => {
      localStorage.setItem(DISMISS_KEY, '1');
      document.querySelector('.install-pill')?.remove();
    });
  }
}
