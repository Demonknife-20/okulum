// Ortak hareket sistemi: sayfa girişi, kademeli kart girişi, pencere ve bildirim açılışı.
// Uygulamanın "Efektler" ayarına uyar (fx.js). Ayar kapalıysa hiçbir animasyon çalışmaz.
import { fxEnabled } from './fx.js';

const reduced = () => !fxEnabled();

// Sayfadaki kart, satır ve bölümler kademeli olarak yukarıdan süzülür
export function enterView(root) {
  if (!root || reduced()) return;
  const targets = [...root.querySelectorAll('.panel, .stat, .list-row, .pin, .empty, .lab-grid, .chem-game, .gx, table')].slice(0, 24);
  targets.forEach((el, i) => {
    el.animate([
      { opacity: 0, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 360, delay: Math.min(i * 40, 400), easing: 'cubic-bezier(0.2,0.7,0.2,1)', fill: 'backwards' });
  });
}

// Pencere ve kutular hafifçe büyüyerek açılır
export function popIn(el) {
  if (!el || reduced()) return;
  el.animate([
    { opacity: 0, transform: 'translateY(8px) scale(0.97)' },
    { opacity: 1, transform: 'translateY(0) scale(1)' },
  ], { duration: 240, easing: 'cubic-bezier(0.2,0.7,0.2,1)' });
}

// Bildirim alttan kayarak gelir
export function slideIn(el) {
  if (!el || reduced()) return;
  el.animate([
    { opacity: 0, transform: 'translate(-50%, 14px)' },
    { opacity: 1, transform: 'translate(-50%, 0)' },
  ], { duration: 280, easing: 'cubic-bezier(0.2,0.7,0.2,1)' });
}
