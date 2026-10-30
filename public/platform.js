const $ = selector => document.querySelector(selector);
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

function showAdmin() {
  $('#loginPanel').hidden = true;
  $('#adminPanel').hidden = false;
  $('#configNotice').hidden = true;
}

function showLogin() {
  $('#loginPanel').hidden = false;
  $('#adminPanel').hidden = true;
}

async function loadSchools() {
  const { schools } = await request('/schools');
  $('#schoolRows').innerHTML = schools.length
    ? schools.map(school => `<tr><td>${esc(school.name)}</td><td>${esc(school.city)}</td><td><a href="${esc(school.url || `/${encodeURIComponent(school.slug)}/`)}" target="_blank" rel="noopener">${esc(location.host + (school.url || `/${encodeURIComponent(school.slug)}/`))}</a></td></tr>`).join('')
    : '<tr><td colspan="3">Henüz okul yok.</td></tr>';
}

$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type=submit]');
  $('#loginError').textContent = '';
  submit.disabled = true;
  try {
    await request('/login', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
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
