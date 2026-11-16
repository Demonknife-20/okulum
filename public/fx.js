// Animasyon (efekt) tercihi: uygulamanın kendi ayarı, yoksa işletim sistemi "hareket azalt" tercihine uyar.
const KEY = 'okulum-fx';
const FONT_KEY = 'okulum-fontsize';
const THEME_KEY = 'okulum-theme';

export function fxEnabled() {
  let stored = null;
  try { stored = localStorage.getItem(KEY); } catch { /* depolama kapalı */ }
  if (stored === 'on') return true;
  if (stored === 'off') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function applyFxClass() {
  document.documentElement.classList.toggle('fx-off', !fxEnabled());
}

export function setFx(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* depolama kapalı */ }
  applyFxClass();
}

export function setFontSize(size) {
  const validSizes = ['sm', 'md', 'lg', 'xl'];
  if (!validSizes.includes(size)) return;
  try { localStorage.setItem(FONT_KEY, size); } catch { /* depolama kapalı */ }
  applyFontSize(size);
}

export function getFontSize() {
  try { return localStorage.getItem(FONT_KEY); } catch { return 'md'; }
}

export function applyFontSize(size) {
  document.documentElement.style.fontSize = size === 'sm' ? '13px' : size === 'md' ? '14px' : size === 'lg' ? '15px' : '16px';
}

// Tema tercihi
const THEME_PREFERRED = 'okulum-theme-pref';
const THEME_AUTO = 'auto';

export function setThemePref(pref) {
  try { localStorage.setItem(THEME_PREFERRED, pref); } catch { /* depolama kapalı */ }
  applyThemePref();
}

export function getThemePref() {
  try { return localStorage.getItem(THEME_PREFERRED); } catch { return 'light'; }
}

export function applyThemePref() {
  const pref = getThemePref();
  if (pref === 'auto') {
    document.documentElement.dataset.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else {
    document.documentElement.dataset.theme = pref;
  }
}

// Başlangıçta uygula
applyFontSize(getFontSize());
applyThemePref();
applyFxClass();
