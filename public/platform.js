import { playUnlockTransition } from './interactions.js';

const $ = selector => document.querySelector(selector);
const ICONS = { trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>' };
const icon = name => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api/platform${path}`, {
    method,
    credentials: 'same-origin',
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'İşlem tamamlanamadı.');
  return data;
}

function confirmDelete(schoolName) {
  return new Promise(resolve => {
    if (window.confirm(`${schoolName} okulunu kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
}

function statusBadge(status) {
  const label = status === 'active' ? 'Aktif' : 'Kapalı';
  const cls = status === 'active' ? 'status-active' : 'status-closed';
  return `<span class="status-badge ${cls}">${label}</span>`;
}

function showAdmin() {
  $('#loginPanel').hidden = true;
  $('#adminPanel').hidden = false;
  $('#adminPanel').classList.remove('is-arriving');
  void $('#adminPanel').offsetWidth;
  $('#adminPanel').classList.add('is-arriving');
  window.setTimeout(() => $('#adminPanel').classList.remove('is-arriving'), 750);
  $('#configNotice').hidden = true;
}

function showLogin() {
  $('#loginPanel').hidden = false;
  $('#adminPanel').hidden = true;
}

async function loadSchools() {
  const { schools } = await request('/schools');
  $('#schoolRows').innerHTML = schools.length
    ? schools.map(school => `
      <tr>
        <td>${esc(school.name)}</td>
        <td>${esc(school.city)}</td>
        <td>${esc(school.year)}</td>
        <td>${statusBadge(school.status)}</td>
        <td><a href="${esc(school.url || `/${encodeURIComponent(school.slug)}/`)}" target="_blank" rel="noopener" class="btn sm">${esc(location.host + (school.url || `/${encodeURIComponent(school.slug)}/`))}</a></td>
        <td>
          <button class="icon-btn sm danger" type="button" data-action="delete-school" data-slug="${esc(school.slug)}" data-name="${esc(school.name)}" aria-label="${esc(school.name)} okulunu sil">${icon('trash')}</button>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="6">Henüz okul yok.</td></tr>';
}

$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type=submit]');
  $('#loginError').textContent = '';
  submit.disabled = true;
  try {
    await request('/login', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
    await playUnlockTransition();
    form.reset();
    showAdmin();
    await loadSchools();
  } catch (error) {
    $('#loginError').textContent = error.message;
    if (error.message.includes('ayarlanmamış')) $('#configNotice').hidden = false;
  } finally {
    submit.disabled = false;
  }
});

$('#schoolForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type=submit]');
  $('#schoolError').textContent = '';
  submit.disabled = true;
  try {
    const body = Object.fromEntries(new FormData(form));
    body.controllerName = String(body.controllerName || '').trim();
    body.controllerAddress = String(body.controllerAddress || '').trim();
    body.controllerEmail = String(body.controllerEmail || '').trim().toLowerCase();
    body.controllerPhone = String(body.controllerPhone || '').trim();
    body.principalName = String(body.principalName || '').trim();
    body.username = String(body.username || '').trim().toLowerCase();
    const { school } = await request('/schools', { method: 'POST', body });
    form.reset();
    window.alert(`Okul oluşturuldu: ${location.origin}${school.url}`);
    await loadSchools();
  } catch (error) {
    $('#schoolError').textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

document.addEventListener('click', async event => {
  const btn = event.target.closest('[data-action="delete-school"]');
  if (!btn) return;
  const slug = btn.dataset.slug;
  const name = btn.dataset.name;
  if (!(await confirmDelete(name))) return;
  try {
    await request(`/schools/${slug}`, { method: 'DELETE' });
    await loadSchools();
  } catch (error) {
    window.alert(error.message);
  }
});

$('#logoutButton').addEventListener('click', async () => {
  try {
    await request('/logout', { method: 'POST' });
    showLogin();
  } catch (error) {
    window.alert(error.message);
  }
});

let slugEdited = false;
$('#schoolForm [name=slug]').addEventListener('input', () => { slugEdited = true; });
$('#schoolForm [name=schoolName]').addEventListener('input', event => {
  if (slugEdited) return;
  const slug = event.target.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[ıİ]/g, 'i')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
  $('#schoolForm [name=slug]').value = slug;
});

request('/session').then(async () => {
  showAdmin();
  await loadSchools();
}).catch(error => {
  showLogin();
  if (error.message.includes('ayarlanmamış')) $('#configNotice').hidden = false;
});
