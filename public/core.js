// Ortak yardımcılar, durum ve API istemcisi. Hiçbir sayfa mantığı içermez.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const state = { me: null, school: null, teaching: [], classes: [], subjects: [], notifications: null };
export const ROLE = { principal: 'Müdür', teacher: 'Öğretmen', student: 'Öğrenci' };

const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
  chat: '<path d="M21 11.5a8.5 8.5 0 0 1-12.2 7.6L3 21l1.9-5.4A8.5 8.5 0 1 1 21 11.5z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20.5a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.2a6.5 6.5 0 0 1 3 6.3"/>',
  school: '<path d="M3 10 12 4l9 6v10H3z"/><path d="M9 20v-6h6v6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  send: '<path d="M4 12 20 4l-4 16-4-6z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  board: '<rect x="3" y="4" width="8" height="10" rx="2"/><rect x="13" y="4" width="8" height="6" rx="2"/><rect x="13" y="12" width="8" height="8" rx="2"/><rect x="3" y="16" width="8" height="4" rx="2"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
};
export const icon = name => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

export const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
export function fmtDate(value, { time = true } = {}) {
  if (!value) return '—';
  const options = time
    ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return date.toLocaleString('tr-TR', options);
}
export const pct = (present, total) => (total ? Math.round((present / total) * 100) : null);
export const initials = name => String(name || '').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toLocaleUpperCase('tr-TR') || '?';
export const tone = role => (role === 'teacher' ? 'green' : role === 'principal' ? 'coral' : 'blue');
export const val = (form, name) => form.querySelector(`[name="${name}"]`)?.value ?? '';
export const setBusy = (el, busy) => { if (el) { el.disabled = busy; el.setAttribute('aria-busy', String(busy)); } };
export const paintWidths = root => root.querySelectorAll('[data-w]').forEach(el => { el.style.width = `${el.dataset.w}%`; });

// ---- Adres çubuğu (#/sayfa?anahtar=değer) ----
export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [page, query = ''] = raw.split('?');
  return { page: page || 'overview', params: Object.fromEntries(new URLSearchParams(query)) };
}
export function setQuery(page, params) {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  location.hash = `#/${page}${query ? `?${query}` : ''}`;
}

// ---- API ----
export async function api(path, { method = 'GET', body } = {}) {
  const init = { method, credentials: 'same-origin', headers: {} };
  if (method !== 'GET') {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body ?? {});
  }
  let res;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new Error('Sunucuya ulaşılamadı. Bağlantını kontrol et.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && state.me) {
    state.me = null;
    window.dispatchEvent(new Event('okulum:logged-out'));
    throw new Error('Oturumun sona erdi. Tekrar giriş yap.');
  }
  if (!res.ok) throw new Error(data.error || 'İşlem tamamlanamadı.');
  return data;
}

export async function refreshMe() {
  const data = await api('/me');
  Object.assign(state, { me: data.user, school: data.school, teaching: data.teaching, classes: data.classes, subjects: data.subjects });
  refresh();
}
export const refresh = () => window.dispatchEvent(new Event('okulum:refresh'));

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, mime: file.type, data: String(reader.result).split(',')[1] });
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsDataURL(file);
  });
}

// ---- Bildirim ----
let toastTimer;
export function toast(message, tone = 'ok') {
  const el = $('#toast');
  el.textContent = message;
  el.dataset.tone = tone;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ---- Modal ----
let onClose = null;
export function openModal(title, html, { wide = false } = {}) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  $('#modalBox').classList.toggle('wide', wide);
  $('#modal').hidden = false;
  requestAnimationFrame(() => $('#modalBody input:not([type=checkbox]):not([type=file]), #modalBody select, #modalBody textarea')?.focus());
}
export function closeModal() {
  $('#modal').hidden = true;
  $('#modalBody').innerHTML = '';
  const callback = onClose;
  onClose = null;
  callback?.();
}
export function confirmDialog(title, message, label = 'Evet, sil') {
  return new Promise(resolve => {
    openModal(title, `<p class="muted">${esc(message)}</p>
      <div class="form-actions mt"><button class="btn ghost" type="button" data-cancel>Vazgeç</button><button class="btn danger" type="button" data-ok>${esc(label)}</button></div>`);
    onClose = () => resolve(false);
    $('#modalBody [data-cancel]').onclick = () => closeModal();
    $('#modalBody [data-ok]').onclick = () => { onClose = null; closeModal(); resolve(true); };
  });
}

// ---- Bildirim rozetleri (menüde ve sekme başlığında) ----
export async function refreshBadges() {
  if (!state.me) return null;
  try {
    const n = await api('/notifications');
    state.notifications = n;
    const counts = { messages: n.messages, assignments: state.me.role === 'student' ? n.assignments + n.grades : n.submissions };
    document.querySelectorAll('[data-badge]').forEach(el => {
      const value = counts[el.dataset.badge] || 0;
      el.textContent = value > 99 ? '99+' : String(value);
      el.hidden = value === 0;
    });
    const total = (counts.messages || 0) + (counts.assignments || 0);
    document.title = total ? `(${total}) Okulum` : 'Okulum';
    return n;
  } catch {
    return null;
  }
}

// Sayfa görüldüğünde ilgili bildirim türleri sıfırlanır.
export async function markSeen(scopes) {
  for (const scope of scopes) await api('/notifications/seen', { method: 'POST', body: { scope } }).catch(() => {});
  await refreshBadges();
}
