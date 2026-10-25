// Animasyon (efekt) tercihi: uygulamanın kendi ayarı, yoksa işletim sistemi "hareket azalt" tercihine uyar.
const KEY = 'okulum-fx';

export function fxEnabled() {
  let stored = null;
  try { stored = localStorage.getItem(KEY); } catch { /* depolama kapalı */ }
  if (stored === 'on') return true;
  if (stored === 'off') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function setFx(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* depolama kapalı */ }
}
