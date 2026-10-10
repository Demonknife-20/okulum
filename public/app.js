import { $, $$, esc, state, api, icon, ROLE, initials, tone, parseHash, toast, closeModal, val, setBusy, paintWidths, refreshBadges, markSeen } from './core.js';
import { ACTIONS, FORMS, CHANGES, INPUTS, renderView, stopTimers } from './views.js';

const NAV = {
  principal: [['overview', 'Genel bakış', 'home'], ['people', 'Kişiler', 'users'], ['school', 'Okul', 'school'], ['messages', 'Mesajlar', 'chat'], ['audit', 'Denetim', 'file']],
  teacher: [['overview', 'Genel bakış', 'home'], ['classes', 'Sınıflarım', 'grid'], ['assignments', 'Ödevler', 'file'], ['attendance', 'Yoklama', 'check'], ['messages', 'Mesajlar', 'chat'], ['people', 'Kişiler', 'users']],
  student: [['overview', 'Genel bakış', 'home'], ['assignments', 'Ödevlerim', 'file'], ['attendance', 'Devamım', 'check'], ['messages', 'Mesajlar', 'chat']],
};

// ---------- Tema ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name=theme-color]').content = theme === 'dark' ? '#0f1714' : '#f3f5f1';
  $('#themeBtn').innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
}
ACTIONS.theme = () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('okulum-theme', next); } catch { /* depolama kapalı olabilir */ }
};

// ---------- Menü (mobil) ----------
const openMenu = () => { $('#sidebar').classList.add('open'); $('#scrim').classList.add('show'); };
const closeMenu = () => { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); };
ACTIONS['open-menu'] = openMenu;
ACTIONS['close-menu'] = closeMenu;

// ---------- Kabuk ----------
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
      ['messages', 'assignments'].includes(page) ? `<span class="nav-badge" data-badge="${page}" hidden></span>` : ''}</a>`).join('');
}

function highlight(page) {
  $$('.nav-item').forEach(link => {
    const active = link.dataset.page === page;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
}

// ---------- Yönlendirme ----------
let routeSeq = 0;
async function route() {
  if (!state.me) return;
  const { page, params } = parseHash();
  const allowed = NAV[state.me.role];
  const entry = allowed.find(([key]) => key === page);
  if (!entry) { history.replaceState(null, '', '#/overview'); return route(); }

  const seq = ++routeSeq;
  stopTimers();
  highlight(page);
  $('#crumb').textContent = `${state.school?.name || 'Okulum'} / ${entry[1]}`;
  const view = $('#view');
  view.innerHTML = '<div class="loading" role="status">Yükleniyor…</div>';
  try {
    const { html, after } = await renderView(page, params);
    if (seq !== routeSeq) return;
    view.innerHTML = html;
    after?.();
    paintWidths(view);
    if (page === 'assignments') markSeen(state.me.role === 'student' ? ['assignments', 'grades'] : ['submissions']);
    else refreshBadges();
  } catch (error) {
    if (seq !== routeSeq) return;
    view.innerHTML = `<div class="empty"><h3>Sayfa yüklenemedi</h3><p>${esc(error.message)}</p></div>`;
  }
  closeMenu();
  window.scrollTo({ top: 0 });
}

// ---------- Oturum ----------
async function showAuthForms() {
  stopTimers();
  state.me = null;
  $('#app').hidden = true;
  $('#auth').hidden = false;
  const { setupRequired } = await api('/setup').catch(() => ({ setupRequired: false }));
  $('#loginForm').hidden = setupRequired;
  $('#setupForm').hidden = !setupRequired;
}

async function enterApp() {
  const data = await api('/me');
  Object.assign(state, { me: data.user, school: data.school, teaching: data.teaching, classes: data.classes, subjects: data.subjects });
  $('#auth').hidden = true;
  $('#app').hidden = false;
  if (!location.hash.startsWith('#/')) history.replaceState(null, '', '#/overview');
  renderChrome();
  await route();
}

// Rozetler sayfa değişmeden de güncel kalsın diye periyodik yenileme.
setInterval(() => { if (state.me) refreshBadges(); }, 20000);

FORMS.login = async form => {
  await api('/login', { method: 'POST', body: { username: val(form, 'username'), password: val(form, 'password') } });
  await enterApp();
};
FORMS.setup = async form => {
  await api('/setup', {
    method: 'POST',
    body: {
      schoolName: val(form, 'schoolName'), schoolCity: val(form, 'schoolCity'), schoolYear: val(form, 'schoolYear'),
      name: val(form, 'name'), username: val(form, 'username'), password: val(form, 'password'),
    },
  });
  await enterApp();
};

ACTIONS.logout = async () => {
  await fetch('/api/logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  closeModal();
  history.replaceState(null, '', location.pathname);
  await showAuthForms();
};

window.addEventListener('okulum:logged-out', () => { toast('Oturumun sona erdi. Tekrar giriş yap.', 'error'); showAuthForms(); });

// ---------- Genel olay yönlendirme (delegation) ----------
document.addEventListener('click', event => {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const handler = ACTIONS[el.dataset.action];
  if (!handler) return;
  event.preventDefault();
  Promise.resolve()
    .then(() => handler(el, event))
    .catch(error => toast(error.message, 'error'));
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
window.addEventListener('okulum:refresh', () => { if (state.me) { renderChrome(); route(); } });

// ---------- Başlatma ----------
const saved = (() => { try { return localStorage.getItem('okulum-theme'); } catch { return null; } })();
applyTheme(saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

(async function boot() {
  try {
    await enterApp();
  } catch {
    await showAuthForms();
  } finally {
    $('#boot').hidden = true;
  }
})();
