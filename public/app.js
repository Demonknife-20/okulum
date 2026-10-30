import { fxEnabled } from './fx.js';
import { enterView } from './motion.js';
import { $, $$, esc, state, api, apiUrl, icon, ROLE, initials, tone, parseHash, toast, closeModal, setBusy, paintWidths, refreshBadges, markSeen, notFoundHtml } from './core.js';
import { ACTIONS, FORMS, CHANGES, INPUTS, renderView, stopTimers } from './views.js';
import { renderPublic } from './public.js';
import { initNotifications } from './push.js';
import { ensureKvkk } from './views.js';
import { setupInstall } from './install.js';
// Kurulum isteğini herkese açık sayfada da yakalamak için modül yüklenirken başlatılır.
setupInstall();

const NAV = {
  principal: [['overview', 'Genel bakış', 'home'], ['analiz', 'Analiz', 'chart'], ['people', 'Kişiler', 'users'], ['school', 'Okul', 'school'], ['panolar', 'Panolar', 'board'], ['asistan', 'Asistan', 'spark'], ['messages', 'Mesajlar', 'chat'], ['audit', 'Denetim', 'file'], ['program', 'Ders programı', 'clock'], ['takvim', 'Takvim', 'calendar'], ['geogebra', 'Matematik Laboratuvarı', 'chart'], ['fizik', 'Fizik Laboratuvarı', 'chart'], ['kimya', 'Kimya Laboratuvarı', 'chart'], ['bilgisayar', 'Bilgisayar Laboratuvarı', 'chart'], ['izin', 'İzin defteri', 'calendar'], ['yardim', 'Kullanım', 'help']],
  teacher: [['overview', 'Genel bakış', 'home'], ['classes', 'Sınıflarım', 'grid'], ['assignments', 'Ödevler', 'file'], ['sinavlar', 'Sınavlar', 'quiz'], ['canli', 'Canlı yarışma', 'bolt'], ['attendance', 'Yoklama', 'check'], ['notlar', 'Notlar', 'chart'], ['davranis', 'Davranış', 'star'], ['panolar', 'Panolar', 'board'], ['asistan', 'Asistan', 'spark'], ['messages', 'Mesajlar', 'chat'], ['people', 'Kişiler', 'users'], ['program', 'Ders programı', 'clock'], ['takvim', 'Takvim', 'calendar'], ['geogebra', 'Matematik Laboratuvarı', 'chart'], ['fizik', 'Fizik Laboratuvarı', 'chart'], ['kimya', 'Kimya Laboratuvarı', 'chart'], ['bilgisayar', 'Bilgisayar Laboratuvarı', 'chart'], ['izin', 'İzin defteri', 'calendar'], ['yardim', 'Kullanım', 'help']],
  parent: [['overview', 'Genel bakış', 'home'], ['cocuklar', 'Çocuklarım', 'user'], ['messages', 'Mesajlar', 'chat'], ['asistan', 'Asistan', 'spark'], ['program', 'Ders programı', 'clock'], ['takvim', 'Takvim', 'calendar'], ['geogebra', 'Matematik Laboratuvarı', 'chart'], ['fizik', 'Fizik Laboratuvarı', 'chart'], ['kimya', 'Kimya Laboratuvarı', 'chart'], ['bilgisayar', 'Bilgisayar Laboratuvarı', 'chart'], ['izin', 'İzin defteri', 'calendar'], ['yardim', 'Kullanım', 'help']],
  student: [['overview', 'Genel bakış', 'home'], ['assignments', 'Ödevlerim', 'file'], ['sinavlar', 'Sınavlarım', 'quiz'], ['canli', 'Canlı yarışma', 'bolt'], ['notlar', 'Notlarım', 'chart'], ['puanlarim', 'Puanlarım', 'star'], ['attendance', 'Devamım', 'check'], ['panolar', 'Panolar', 'board'], ['asistan', 'Asistan', 'spark'], ['messages', 'Mesajlar', 'chat'], ['program', 'Ders programı', 'clock'], ['takvim', 'Takvim', 'calendar'], ['geogebra', 'Matematik Laboratuvarı', 'chart'], ['fizik', 'Fizik Laboratuvarı', 'chart'], ['kimya', 'Kimya Laboratuvarı', 'chart'], ['bilgisayar', 'Bilgisayar Laboratuvarı', 'chart'], ['izin', 'İzin defteri', 'calendar'], ['yardim', 'Kullanım', 'help']],
};
const BADGES = ['messages', 'assignments'];
// Yükleme sırasında gösterilen iskelet ekran (metin yerine).
const skeleton = () => `<div class="skeleton-page" aria-busy="true" aria-label="Yükleniyor">
  <div class="sk sk-eyebrow"></div><div class="sk sk-title"></div><div class="sk sk-line"></div>
  <div class="sk-grid"><div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div></div>
  <div class="sk sk-panel"></div></div>`;

// ---------- Tema ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name=theme-color]').content = theme === 'dark' ? '#0f1714' : '#f3f5f1';
  $('#themeBtn').innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
}
ACTIONS.theme = el => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  const change = () => {
    applyTheme(next);
    try { localStorage.setItem('okulum-theme', next); } catch { /* depolama kapalı olabilir */ }
  };
  if (!document.startViewTransition || !fxEnabled()) { change(); return; }
  // Geçiş, tıklanan düğmeden yayılır (CSSOM ile; satır içi stil yok)
  const rect = (el || document.getElementById('themeBtn')).getBoundingClientRect();
  document.documentElement.style.setProperty('--vt-x', `${rect.left + rect.width / 2}px`);
  document.documentElement.style.setProperty('--vt-y', `${rect.top + rect.height / 2}px`);
  document.documentElement.classList.add('vt-theme');
  const transition = document.startViewTransition(change);
  transition.finished.finally(() => document.documentElement.classList.remove('vt-theme'));
};

// ---------- Mobil menü ----------
const openMenu = () => { $('#sidebar').classList.add('open'); $('#scrim').classList.add('show'); };
const closeMenu = () => { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); };
ACTIONS['open-menu'] = openMenu;
ACTIONS['close-menu'] = closeMenu;
ACTIONS['close-modal'] = () => closeModal();

// ---------- Kabuk: giriş yapmamış ve giriş yapmış görünümler ----------
function showPublic() {
  $('#app').hidden = true;
  $('#public').hidden = false;
}
function showApp() {
  $('#public').hidden = true;
  $('#app').hidden = false;
}

function renderChrome() {
  const me = state.me;
  $('#schoolChip').innerHTML = `<span class="school-mark">${esc(initials(state.school?.name || 'Okul'))}</span>
    <div><strong>${esc(state.school?.name || 'Okul')}</strong><small>${esc([state.school?.city, state.school?.year].filter(Boolean).join(' · '))}</small></div>`;
  $('#meAvatar').textContent = initials(me.name);
  $('#meAvatar').className = `avatar ${tone(me.role)}`;
  $('#meName').textContent = me.name;
  $('#meRole').textContent = me.className ? `${ROLE[me.role]} · ${me.className}` : ROLE[me.role];
  $('#nav').innerHTML = NAV[me.role].map(([page, label, ic]) =>
    `<a class="nav-item" href="#/${page}" data-page="${page}">${icon(ic)}<span>${esc(label)}</span>${
      BADGES.includes(page) ? `<span class="nav-badge" data-badge="${page}" hidden></span>` : ''}</a>`).join('');
  renderTabbar(me);
}

function highlight(page) {
  $$('.nav-item').forEach(link => {
    const active = link.dataset.page === page;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  $$('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === page));
}

// Telefonda alt gezinme çubuğu: rolün ilk dört sayfası ve menü düğmesi
function renderTabbar(me) {
  const tabs = NAV[me.role].slice(0, 4).map(([page, label, ic]) =>
    `<a class="tab" href="#/${page}" data-tab="${page}">${icon(ic)}<span>${esc(label)}</span></a>`).join('');
  $('#tabbar').innerHTML = `${tabs}<button class="tab" type="button" data-action="open-menu" aria-label="Tüm menü">${icon('menu')}<span>Menü</span></button>`;
}

// Geniş tabloları telefonda kart olarak göstermek için her hücreye sütun adını ekler
function labelTables(root) {
  root.querySelectorAll('table').forEach(table => {
    const labels = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(tr => {
      [...tr.children].forEach((cell, index) => {
        if (cell.tagName === 'TD' && !cell.hasAttribute('colspan') && labels[index]) cell.setAttribute('data-label', labels[index]);
      });
    });
  });
}

// Ana sayfa, giriş, kurulum ve kılavuz (giriş yapmamışken)
function currentPublicPage() {
  return location.hash.replace(/^#\/?/, '').split('?')[0] || 'ana';
}
let publicSeq = 0;
// Sayfa geçiş göstergesi (üstte ince ilerleme çubuğu)
const setRouteProgress = on => document.querySelector('#routeProgress')?.classList.toggle('on', on);

async function routePublic() {
  stopTimers();
  showPublic();
  const seq = ++publicSeq; // hızlı geçişlerde eski yanıt yenisinin üzerine yazmasın
  const page = currentPublicPage();
  const view = $('#publicView');
  setRouteProgress(true);
  const outgoing = view.children.length && fxEnabled()
    ? view.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 130, fill: 'forwards' })
    : null;
  if (outgoing) await outgoing.finished.catch(() => {});
  if (seq !== publicSeq) return;
  view.innerHTML = skeleton();
  if (outgoing) outgoing.cancel();
  try {
    const { html } = await renderPublic(page === 'ana' ? '' : page);
    if (seq !== publicSeq) return;
    view.innerHTML = html;
    if (fxEnabled()) view.animate([{ opacity: 0, transform: 'translateY(12px) scale(.99)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2,.7,.2,1)' });
    document.querySelectorAll('[data-public]').forEach(a => a.classList.toggle('current', a.dataset.public === page));
    paintWidths(view);
    window.scrollTo({ top: 0 });
  } catch (error) {
    if (seq !== publicSeq) return;
    view.innerHTML = `<div class="empty"><h3>Sayfa yüklenemedi</h3><p>${esc(error.message)}</p></div>`;
  } finally {
    if (seq === publicSeq) setRouteProgress(false);
  }
}

// ---------- Uygulama yönlendirmesi (giriş yapmış) ----------
let routeSeq = 0;
async function routeApp() {
  const { page, params } = parseHash();
  const entry = NAV[state.me.role].find(([key]) => key === page) || (page === 'pano' ? ['pano', 'Pano'] : page === 'sinav' ? ['sinavlar', 'Sınav'] : page === 'karne' ? ['karne', 'Karne'] : null);
  const view = $('#view');
  if (!entry) {
    showApp();
    highlight('');
    $('#crumb').textContent = `${state.school?.name || 'Okulum'} / Sayfa bulunamadı`;
    view.innerHTML = notFoundHtml(true);
    setRouteProgress(false);
    return;
  }

  const seq = ++routeSeq;
  stopTimers();
  showApp();
  highlight(page === 'pano' ? 'panolar' : page === 'sinav' ? 'sinavlar' : page);
  $('#crumb').textContent = `${state.school?.name || 'Okulum'} / ${entry[1]}`;
  setRouteProgress(true);
  const outgoing = view.children.length && fxEnabled()
    ? view.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' })
    : null;
  if (outgoing) await outgoing.finished.catch(() => {});
  view.innerHTML = skeleton();
  if (outgoing) outgoing.cancel();
  try {
    const { html, after } = await renderView(page, params);
    if (seq !== routeSeq) return;
    view.innerHTML = html;
    after?.();
    enterView(view);
    if (fxEnabled()) view.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
    paintWidths(view);
    labelTables(view);
    if (page === 'assignments') markSeen(state.me.role === 'student' ? ['assignments', 'grades'] : ['submissions']);
    else refreshBadges();
  } catch (error) {
    if (seq !== routeSeq) return;
    view.innerHTML = `<div class="empty"><h3>Sayfa yüklenemedi</h3><p>${esc(error.message)}</p></div>`;
  } finally {
    if (seq === routeSeq) setRouteProgress(false);
  }
  closeMenu();
  window.scrollTo({ top: 0 });
}

function route() {
  if (state.me) routeApp();
  else routePublic();
}

// ---------- Oturum ----------
async function enterApp() {
  const data = await api('/me');
  Object.assign(state, { me: data.user, school: data.school, teaching: data.teaching, classes: data.classes, subjects: data.subjects });
  renderChrome();
  const app = $('#app');
  if (fxEnabled()) {
    app.classList.remove('login-arrival');
    void app.offsetWidth;
    app.classList.add('login-arrival');
    window.setTimeout(() => app.classList.remove('login-arrival'), 850);
  }
  if (!location.hash.startsWith('#/') || location.hash === '#/' || ['#/mudur-girisi', '#/giris', '#/kurulum'].includes(location.hash)) {
    history.replaceState(null, '', '#/overview');
  }
  await routeApp();
  refreshBadges();
  initNotifications();
  ensureKvkk().catch(error => toast(`Aydınlatma metni yüklenemedi: ${error.message}`));
}

async function logout() {
  await fetch(apiUrl('/logout'), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  closeModal();
  state.me = null;
  history.replaceState(null, '', '#/');
  routePublic();
}
ACTIONS.logout = () => logout();

window.addEventListener('okulum:login', async () => {
  try {
    await enterApp();
    toast(`Hoş geldiniz, ${state.me.name}`);
  } catch (error) {
    toast(error.message, 'error');
  }
});
window.addEventListener('okulum:logged-out', () => {
  toast('Oturumun sona erdi. Tekrar giriş yap.', 'error');
  state.me = null;
  history.replaceState(null, '', '#/');
  routePublic();
});
window.addEventListener('okulum:refresh', () => { if (state.me) { renderChrome(); route(); } });

// ---------- Genel olay yönlendirmesi ----------
document.addEventListener('click', event => {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const handler = ACTIONS[el.dataset.action];
  if (!handler) return;
  event.preventDefault();
  Promise.resolve().then(() => handler(el, event)).catch(error => toast(error.message, 'error'));
});

document.addEventListener('submit', event => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const handler = FORMS[form.dataset.form];
  if (!handler) return;
  const submit = form.querySelector('button[type=submit]');
  const errorBox = form.querySelector('[data-error]');
  if (errorBox) errorBox.textContent = '';
  setBusy(submit, true);
  Promise.resolve()
    .then(() => handler(form))
    .catch(error => {
      if (errorBox) errorBox.textContent = error.message;
      else toast(error.message, 'error');
    })
    .finally(() => setBusy(submit, false));
});

document.addEventListener('change', event => {
  const handler = CHANGES[event.target.dataset.change];
  if (handler) Promise.resolve().then(() => handler(event.target)).catch(error => toast(error.message, 'error'));
});

document.addEventListener('input', event => {
  const handler = INPUTS[event.target.dataset.input];
  if (handler) handler(event.target);
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (!$('#modal').hidden) closeModal();
  closeMenu();
});

$('#modal').addEventListener('click', event => { if (event.target.id === 'modal') closeModal(); });
window.addEventListener('hashchange', route);
setInterval(() => { if (state.me) refreshBadges(); }, 20000);

// ---------- Başlatma ----------
const saved = (() => { try { return localStorage.getItem('okulum-theme'); } catch { return null; } })();
applyTheme(saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

(async function boot() {
  try {
    await enterApp();
  } catch {
    state.me = null;
    if (!location.hash || location.hash === '#/overview') history.replaceState(null, '', '#/');
    routePublic();
  } finally {
    // Açılış ekranı yumuşakça kapanır
    const splash = $('#boot');
    splash.classList.add('done');
    setTimeout(() => { splash.hidden = true; }, 700);
  }
})();
