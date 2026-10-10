import { helpHtml } from './help.js';
import { state, api, $, $$, esc, ROLE, icon, fmtDate, todayIso, pct, initials, tone, readFile, toast, openModal, closeModal, confirmDialog, refreshMe, refresh, val, setBusy, setQuery, parseHash, paintWidths, refreshBadges } from './core.js';

export const ACTIONS = {}, FORMS = {}, CHANGES = {}, INPUTS = {};

let timers = [];
export function stopTimers() { timers.forEach(clearInterval); timers = []; }
const every = (fn, ms) => { const id = setInterval(fn, ms); timers.push(id); return id; };

// ---------- Ortak parçalar ----------
const head = (title, subtitle = '', actions = '') => `
  <header class="page-head">
    <div>
      <p class="eyebrow">${esc(ROLE[state.me.role])} alanı</p>
      <h1>${esc(title)}</h1>
      ${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ''}
    </div>
    ${actions ? `<div class="head-actions">${actions}</div>` : ''}
  </header>`;
const stat = (label, value, note, ic, kind = '') => `
  <article class="stat ${kind}">
    <div class="stat-top"><span>${esc(label)}</span><span class="stat-icon">${icon(ic)}</span></div>
    <strong class="stat-value">${esc(value)}</strong>
    <small>${esc(note)}</small>
  </article>`;
const panel = (title, meta, body) => `
  <section class="panel">
    <header class="panel-head"><h2>${esc(title)}</h2>${meta ? `<span class="muted">${esc(meta)}</span>` : ''}</header>
    ${body}
  </section>`;
const empty = (title, text, action = '') => `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
const badge = (text, kind = 'neutral') => `<span class="badge ${kind}">${esc(text)}</span>`;
const meter = (present, total) => {
  const v = pct(present, total);
  if (v === null) return '<span class="muted">Kayıt yok</span>';
  return `<span class="meter"><span class="bar"><i data-w="${v}"></i></span><b>%${v}</b></span>`;
};
const quick = items => `<div class="quick">${items.map(([href, label, ic]) => `<a class="quick-link" href="${href}">${icon(ic)}<span>${esc(label)}</span></a>`).join('')}</div>`;
const firstName = name => String(name || '').split(' ')[0];
const isPast = iso => Boolean(iso) && new Date(iso) < new Date();
const uniqueBy = (list, key) => [...new Map(list.map(item => [item[key], item])).values()];
const pager = (total, page, size, action) => {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return '';
  return `<nav class="pager" aria-label="Sayfalar">
    <button class="btn ghost sm" type="button" data-action="${action}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← Önceki</button>
    <span class="muted">Sayfa ${page} / ${pages} · ${total} kayıt</span>
    <button class="btn ghost sm" type="button" data-action="${action}" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Sonraki →</button>
  </nav>`;
};
const alertList = (alerts, role) => {
  if (!alerts.length) return empty('Uyarı yok', role === 'student' ? 'Devamın eşiklerin üzerinde görünüyor.' : 'Eşiklerin altında devam kaydı yok.');
  return `<ul class="list">${alerts.slice(0, 8).map(a => `
    <li class="list-row">
      <div class="list-main"><strong>${esc(a.studentName)}</strong><small>${esc(a.className)} · ${esc(a.subjectName)}${role !== 'student' && a.studentNo ? ` · ${esc(a.studentNo)}` : ''}</small></div>
      ${a.reason === 'streak' ? badge(`${a.streak} ders üst üste yok`, 'danger') : badge(`%${a.rate} devam (${a.total} ders)`, 'warn')}
    </li>`).join('')}</ul>${alerts.length > 8 ? `<p class="muted small pad">+${alerts.length - 8} uyarı daha</p>` : ''}`;
};
const kindLabel = kind => (kind === 'paper' ? 'Kağıt' : 'Online');

function assignmentStatus(a) {
  if (a.kind === 'paper') return badge('Kağıt ödev');
  if (a.mySubmission) return a.mySubmission.grade ? badge(`Not: ${a.mySubmission.grade}`, 'ok') : badge('Teslim edildi', 'ok');
  if (isPast(a.dueAt)) return badge('Süresi geçti', 'danger');
  return badge('Bekliyor', 'warn');
}

function assignmentList(items, mode) {
  if (!items.length) {
    return empty('Henüz ödev yok', mode === 'student' ? 'Öğretmenin ödev verdiğinde burada görünecek.' : 'Ödev oluşturduğunda burada listelenir.');
  }
  return `<ul class="list">${items.map(a => `
    <li class="list-row">
      <div class="list-main">
        <strong>${esc(a.title)}</strong>
        <small>${esc(a.className)} · ${esc(a.subjectName)}${a.dueAt ? ` · Son teslim ${esc(fmtDate(a.dueAt))}` : ''}</small>
      </div>
      ${mode === 'student' ? assignmentStatus(a) : badge(`${a.submissionCount}/${a.studentCount} teslim`)}
    </li>`).join('')}</ul>`;
}

function gradeList(items) {
  if (!items.length) return empty('Henüz not yok', 'Öğretmenin ödevini değerlendirdiğinde notun burada görünür.');
  return `<ul class="list">${items.map(g => `
    <li class="list-row">
      <div class="list-main"><strong>${esc(g.title)}</strong><small>${esc(g.subjectName)}${g.feedback ? ` · ${esc(g.feedback)}` : ''}</small></div>
      ${badge(g.grade, 'ok')}
    </li>`).join('')}</ul>`;
}

// ---------- Genel bakış ----------
// Müdür için başlangıç listesi: hepsi tamamlanınca gizlenir.
function setupChecklist(s) {
  const steps = [
    ['Sınıf tanımlandı', s.classes > 0, 'school'],
    ['Ders tanımlandı', s.subjects > 0, 'school'],
    ['Öğretmen hesabı açıldı', s.teachers > 0, 'people'],
    ['Öğrenci hesabı açıldı', s.students > 0, 'people'],
    ['İlk ödev veya yoklama girildi', s.assignments > 0 || s.attTotal > 0, 'people'],
  ];
  if (steps.every(([, done]) => done)) return '';
  const doneCount = steps.filter(([, done]) => done).length;
  return panel('Başlangıç listesi', `${doneCount} / ${steps.length} tamamlandı`, `<ul class="checklist">${steps.map(([label, done, page]) => `
      <li class="${done ? 'done' : ''}">
        <span class="check-mark" aria-hidden="true">${done ? '✓' : ''}</span>
        <a href="#/${page}">${esc(label)}</a>
      </li>`).join('')}</ul>`);
}

async function pageOverview() {
  const [data, alertData] = await Promise.all([api('/overview'), api('/alerts')]);
  const me = state.me;
  const subtitle = state.school ? `${state.school.name} · ${state.school.year}` : '';
  const alertsPanel = panel('Devamsızlık uyarıları', `${alertData.alerts.length} uyarı · son 90 gün`, alertList(alertData.alerts, data.role));

  if (data.role === 'principal') {
    const s = data.stats, rate = pct(s.attPresent, s.attTotal);
    return { html: `
      ${head(`Merhaba, ${firstName(me.name)}`, subtitle, `<button class="btn primary" type="button" data-action="new-user">${icon('plus')}<span>Yeni hesap</span></button>`)}
      <div class="stats">
        ${stat('Öğretmen', s.teachers, 'Kadrodaki öğretmen', 'users')}
        ${stat('Öğrenci', s.students, 'Kayıtlı öğrenci', 'users')}
        ${stat('Sınıf', s.classes, `${s.subjects} ders tanımlı`, 'grid')}
        ${stat('Notlanacak', s.ungraded, 'Değerlendirme bekleyen teslim', 'file', s.ungraded ? 'attention' : '')}
        ${stat('Devam · 30 gün', rate === null ? '—' : `%${rate}`, rate === null ? 'Henüz yoklama yok' : `${s.attPresent} / ${s.attTotal} kayıt`, 'check')}
      </div>
      ${setupChecklist(s)}
      <div class="two-col">
        ${panel('Son ödevler', `${data.recent.length} kayıt`, assignmentList(data.recent, 'staff'))}
        ${alertsPanel}
      </div>
      ${panel('Hızlı erişim', '', quick([['#/people', 'Kişiler', 'users'], ['#/school', 'Okul ve sınıflar', 'school'], ['#/messages', 'Mesajlar', 'chat']]))}` };
  }

  if (data.role === 'teacher') {
    const s = data.stats, rate = pct(s.attPresent, s.attTotal);
    const classes = data.classes.length
      ? `<ul class="list">${data.classes.map(c => `
          <li class="list-row">
            <div class="list-main"><strong>${esc(c.name)}</strong><small>${esc(c.subjects.join(' · '))}</small></div>
            <a class="btn ghost sm" href="#/attendance?classId=${esc(c.id)}">Yoklama</a>
          </li>`).join('')}</ul>`
      : empty('Sınıf ataman yok', 'Müdür sana sınıf ve ders atadığında burada görünecek.');
    return { html: `
      ${head(`Merhaba, ${firstName(me.name)}`, subtitle, `
        <a class="btn ghost" href="#/attendance">${icon('check')}<span>Yoklama al</span></a>
        <button class="btn primary" type="button" data-action="new-assignment" ${state.teaching.length ? '' : 'disabled'}>${icon('plus')}<span>Ödev oluştur</span></button>`)}
      <div class="stats">
        ${stat('Sınıf', s.classes, 'Verdiğin dersler', 'grid')}
        ${stat('Ödev', s.assignments, 'Sana ait ödevler', 'file')}
        ${stat('Notlanacak', s.ungraded, 'Teslim bekleyen', 'file', s.ungraded ? 'attention' : '')}
        ${stat('Devam · 30 gün', rate === null ? '—' : `%${rate}`, rate === null ? 'Henüz yoklama yok' : `${s.attPresent} / ${s.attTotal} kayıt`, 'check')}
      </div>
      <div class="two-col">
        ${panel('Yaklaşan teslimler', '', assignmentList(data.upcoming, 'staff'))}
        ${panel('Sınıflarım', '', classes)}
      </div>
      ${alertsPanel}` };
  }

  const s = data.stats, rate = pct(s.attPresent, s.attTotal);
  return { html: `
    ${head(`Merhaba, ${firstName(me.name)}`, data.className ? `${data.className} sınıfı` : 'Henüz bir sınıfa atanmadın')}
    <div class="stats">
      ${stat('Sınıf', data.className || '—', 'Kayıtlı sınıfın', 'grid')}
      ${stat('Bekleyen ödev', s.pending, 'Teslim etmen gereken', 'file', s.pending ? 'attention' : '')}
      ${stat('Devam · 30 gün', rate === null ? '—' : `%${rate}`, rate === null ? 'Henüz yoklama yok' : `${s.attPresent} / ${s.attTotal} ders`, 'check')}
    </div>
    <div class="two-col">
      ${panel('Yaklaşan ödevler', '', assignmentList(data.upcoming, 'student'))}
      ${panel('Son notlar', '', gradeList(data.grades))}
    </div>
    ${alertsPanel}` };
}

// ---------- Sınıflarım (öğretmen) ----------
async function pageClasses() {
  const ids = [...new Set(state.teaching.map(t => t.classId))];
  if (!ids.length) {
    return { html: `${head('Sınıflarım', 'Sana atanmış sınıflar ve dersler.')}${panel('Sınıflar', '', empty('Sınıf ataman yok', 'Müdür sana sınıf ve ders atadığında burada görünecek.'))}` };
  }
  const rosters = await Promise.all(ids.map(id => api(`/classes/${id}/students`).then(r => [id, r.students])));
  const cards = ids.map(id => {
    const rows = state.teaching.filter(t => t.classId === id);
    const students = rosters.find(([key]) => key === id)[1];
    const subjects = [...new Set(rows.map(r => r.subjectName))].join(' · ');
    return `
      <section class="panel">
        <header class="panel-head">
          <div><h2>${esc(rows[0].className)}</h2><small class="muted">${esc(subjects)} · ${students.length} öğrenci</small></div>
          <a class="btn ghost sm" href="#/attendance?classId=${esc(id)}">Yoklama al</a>
        </header>
        ${students.length ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Okul no</th><th>Ad soyad</th><th>Devam</th></tr></thead>
            <tbody>${students.map(s => `<tr><td>${esc(s.studentNo)}</td><td><strong>${esc(s.name)}</strong></td><td>${meter(s.present, s.total)}</td></tr>`).join('')}</tbody>
          </table></div>` : empty('Öğrenci yok', 'Müdür bu sınıfa öğrenci eklediğinde burada görünür.')}
      </section>`;
  }).join('');
  return { html: `${head('Sınıflarım', 'Sınıflarındaki öğrencilerin devam durumu.')}<div class="class-grid">${cards}</div>` };
}

// ---------- Ödevler ----------
function assignmentCards(items) {
  if (!items.length) return empty('Henüz ödev yok', 'Öğretmenin ödev verdiğinde burada görünecek.');
  return `<div class="cards">${items.map(a => {
    const sub = a.mySubmission;
    const open = !isPast(a.dueAt);
    return `
      <article class="card-item">
        <header class="card-head">
          <div><h3>${esc(a.title)}</h3><small class="muted">${esc(a.subjectName)} · ${a.dueAt ? `Son teslim ${esc(fmtDate(a.dueAt))}` : 'Son teslim tarihi yok'}</small></div>
          ${assignmentStatus(a)}
        </header>
        ${a.instructions ? `<p class="instructions">${esc(a.instructions)}</p>` : ''}
        ${sub?.feedback ? `<p class="feedback"><strong>Öğretmen notu:</strong> ${esc(sub.feedback)}</p>` : ''}
        <footer class="card-actions">
          ${a.hasFile ? `<a class="btn ghost sm" href="/api/files/assignment/${esc(a.id)}">${icon('download')}<span>Ödev dosyası</span></a>` : ''}
          ${sub ? `<a class="btn ghost sm" href="/api/files/submission/${esc(sub.id)}">${icon('download')}<span>Teslimim</span></a>` : ''}
          ${a.kind === 'online' && open ? `<button class="btn primary sm" type="button" data-action="submit" data-id="${esc(a.id)}">${sub ? 'Yeniden gönder' : 'Teslim et'}</button>` : ''}
        </footer>
      </article>`;
  }).join('')}</div>`;
}

let assignmentIndex = new Map();

async function pageAssignments(params) {
  const role = state.me.role;
  const page = Math.max(1, Number(params.page) || 1);
  const classId = params.classId || '';
  const search = params.q || '';
  const query = new URLSearchParams({ page, size: 20, ...(classId ? { classId } : {}), ...(search ? { q: search } : {}) });
  const { assignments, total, size } = await api(`/assignments?${query}`);
  assignmentIndex = new Map(assignments.map(a => [a.id, a]));
  if (role === 'student') {
    return { html: `${head('Ödevlerim', 'Derslerin için verilen ödevler ve teslimlerin.')}${assignmentCards(assignments)}${pager(total, page, size, 'page-assign')}` };
  }
  const canCreate = role === 'teacher' && state.teaching.length > 0;
  const classOptions = role === 'teacher'
    ? uniqueBy(state.teaching.map(t => ({ id: t.classId, name: t.className })), 'id')
    : state.classes;
  const rows = assignments.map(a => `
    <tr>
      <td><strong>${esc(a.title)}</strong>${a.instructions ? `<small class="cell-note">${esc(a.instructions.slice(0, 100))}</small>` : ''}</td>
      <td>${esc(a.className)}<small class="cell-note">${esc(a.subjectName)}</small></td>
      <td>${esc(fmtDate(a.dueAt))}</td>
      <td>${badge(kindLabel(a.kind), a.kind === 'online' ? 'ok' : 'neutral')}</td>
      <td>${a.kind === 'online'
        ? `${a.submissionCount} / ${a.studentCount}${a.ungradedCount ? ` ${badge(`${a.ungradedCount} notsuz`, 'warn')}` : ''}`
        : '<span class="muted">—</span>'}</td>
      <td class="row-actions">
        ${a.kind === 'online' ? `<button class="btn ghost sm" type="button" data-action="open-submissions" data-id="${esc(a.id)}">Teslimler</button>` : ''}
        ${a.hasFile ? `<a class="btn ghost sm" href="/api/files/assignment/${esc(a.id)}">${icon('download')}<span>Dosya</span></a>` : ''}
        ${canCreate ? `<button class="icon-btn sm" type="button" data-action="edit-assignment" data-id="${esc(a.id)}" aria-label="Ödevi düzenle">✎</button>
          <button class="icon-btn sm" type="button" data-action="delete-assignment" data-id="${esc(a.id)}" aria-label="Ödevi sil">${icon('trash')}</button>` : ''}
      </td>
    </tr>`).join('');
  const table = assignments.length
    ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Ödev</th><th>Sınıf · Ders</th><th>Son teslim</th><th>Tür</th><th>Teslim</th><th></th></tr></thead>
        <tbody id="assignRows">${rows}</tbody></table></div>${pager(total, page, size, 'page-assign')}`
    : empty('Bu filtrede ödev yok', canCreate ? 'Yeni bir ödev oluşturarak başla.' : 'Öğretmenler ödev oluşturduğunda burada listelenir.');
  return { html: `
    ${head('Ödevler', role === 'principal' ? 'Okuldaki tüm ödevler (salt okunur).' : 'Oluşturduğun ödevleri ve teslimleri takip et.',
      canCreate ? `<button class="btn primary" type="button" data-action="new-assignment">${icon('plus')}<span>Ödev oluştur</span></button>` : '')}
    <section class="panel">
      <div class="toolbar">
        <label class="inline-field"><span>Sınıf</span>
          <select data-change="filterAssignments"><option value="all">Tüm sınıflar</option>${classOptions.map(c => `<option value="${esc(c.id)}" ${c.id === classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        </label>
        <form class="search-form" data-form="assign-search" role="search">
          <input type="search" name="q" value="${esc(search)}" placeholder="Ödev başlığında ara…" maxlength="80" aria-label="Ödev ara">
          <button class="btn ghost sm" type="submit">Ara</button>
        </form>
        <span class="muted">${total} ödev</span>
      </div>
      ${table}
    </section>` };
}

FORMS['assign-search'] = async form => setQuery('assignments', { ...parseHash().params, q: val(form, 'q').trim(), page: 1 });

CHANGES.filterAssignments = el => setQuery('assignments', { classId: el.value === 'all' ? '' : el.value, page: 1 });
ACTIONS['page-assign'] = el => setQuery('assignments', { ...parseHash().params, page: el.dataset.page });

const toLocalInput = iso => {
  if (!iso) return '';
  const d = new Date(iso), pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

ACTIONS['edit-assignment'] = el => {
  const a = assignmentIndex.get(el.dataset.id);
  if (!a) return;
  openModal('Ödevi düzenle', `<form class="stack" data-form="edit-assignment" data-id="${esc(a.id)}">
    <label class="field"><span>Ödev başlığı</span><input name="title" required maxlength="160" value="${esc(a.title)}"></label>
    <label class="field"><span>Son teslim</span><input name="dueAt" type="datetime-local" value="${esc(toLocalInput(a.dueAt))}"></label>
    <label class="field"><span>Yönerge</span><textarea name="instructions" rows="3" maxlength="2000">${esc(a.instructions)}</textarea></label>
    <p class="muted small">Dosyayı değiştirmek için ödevi silip yeniden oluşturman gerekir.</p>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Kaydet</button></div>
  </form>`);
};

FORMS['edit-assignment'] = async form => {
  const due = val(form, 'dueAt');
  await api(`/assignments/${form.dataset.id}`, { method: 'PATCH', body: {
    title: val(form, 'title'), instructions: val(form, 'instructions'), dueAt: due ? new Date(due).toISOString() : null,
  } });
  closeModal();
  toast('Ödev güncellendi');
  refresh();
};

function assignmentForm() {
  return `<form class="stack" data-form="assignment">
    <label class="field"><span>Ödev başlığı</span><input name="title" required maxlength="160" placeholder="Örn. Kesirler çalışma kâğıdı"></label>
    <label class="field"><span>Sınıf ve ders</span>
      <select name="pair" required>${state.teaching.map(t => `<option value="${esc(t.classId)}|${esc(t.subjectId)}">${esc(t.className)} · ${esc(t.subjectName)}</option>`).join('')}</select>
    </label>
    <div class="grid-2">
      <label class="field"><span>Tür</span>
        <select name="kind"><option value="online">Online teslim (öğrenci dosya yükler)</option><option value="paper">Kağıt / sınıf içi</option></select>
      </label>
      <label class="field"><span>Son teslim</span><input name="dueAt" type="datetime-local"></label>
    </div>
    <label class="field"><span>Yönerge</span><textarea name="instructions" rows="3" maxlength="2000" placeholder="Örn. Ders kitabı sayfa 42, 1–10 arası sorular"></textarea></label>
    <label class="field"><span>Ödev dosyası (isteğe bağlı)</span>
      <input name="file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"><small>PDF, Word veya görsel · en fazla 5 MB</small>
    </label>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Ödevi yayınla</button></div>
  </form>`;
}

ACTIONS['new-assignment'] = () => openModal('Yeni ödev', assignmentForm());

FORMS.assignment = async form => {
  const [classId, subjectId] = val(form, 'pair').split('|');
  const due = val(form, 'dueAt');
  const file = form.querySelector('[name=file]').files[0];
  const body = {
    title: val(form, 'title'), classId, subjectId, kind: val(form, 'kind'),
    instructions: val(form, 'instructions'), dueAt: due ? new Date(due).toISOString() : null,
  };
  if (file) body.file = await readFile(file);
  await api('/assignments', { method: 'POST', body });
  closeModal();
  toast('Ödev yayınlandı');
  refresh();
};

ACTIONS.submit = el => openModal('Ödevi teslim et', `
  <form class="stack" data-form="submission" data-id="${esc(el.dataset.id)}">
    <label class="field"><span>Ödev dosyan</span>
      <input name="file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" required><small>PDF, Word veya görsel · en fazla 5 MB</small>
    </label>
    <label class="field"><span>Öğretmenine not (isteğe bağlı)</span><textarea name="note" rows="3" maxlength="500"></textarea></label>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Dosyayı gönder</button></div>
  </form>`);

FORMS.submission = async form => {
  const file = form.querySelector('[name=file]').files[0];
  if (!file) throw new Error('Bir dosya seç.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Dosya 5 MB sınırını aşıyor.');
  const payload = await readFile(file);
  await api(`/assignments/${form.dataset.id}/submission`, { method: 'POST', body: { file: payload, note: val(form, 'note') } });
  closeModal();
  toast('Ödev öğretmenine gönderildi');
  refresh();
};

ACTIONS['open-submissions'] = async el => {
  const { assignment, submitted, missing } = await api(`/assignments/${el.dataset.id}/submissions`);
  const editable = state.me.role === 'teacher' && assignment.kind === 'online';
  const head = s => `<div class="grade-head">
      <div><strong>${esc(s.studentName)}</strong><small class="muted">${esc(s.studentNo || '')} · ${esc(fmtDate(s.submittedAt))}</small></div>
      <a class="link" href="/api/files/submission/${esc(s.id)}">${icon('download')}<span>${esc(s.fileName)}</span></a>
    </div>${s.note ? `<p class="note">“${esc(s.note)}”</p>` : ''}`;
  const rows = submitted.map(s => editable
    ? `<div class="grade-row" data-sub="${esc(s.id)}">${head(s)}
        <div class="grade-fields">
          <label class="field narrow"><span>Not</span><input name="grade-${esc(s.id)}" data-field="grade" data-orig="${esc(s.grade ?? '')}" maxlength="10" value="${esc(s.grade ?? '')}" placeholder="Örn. 90"></label>
          <label class="field"><span>Geri bildirim</span><input name="feedback-${esc(s.id)}" data-field="feedback" data-orig="${esc(s.feedback ?? '')}" maxlength="1000" value="${esc(s.feedback ?? '')}" placeholder="İsteğe bağlı"></label>
        </div></div>`
    : `<div class="grade-row">${head(s)}<p class="muted small">Not: ${esc(s.grade || 'Verilmedi')}${s.feedback ? ` · ${esc(s.feedback)}` : ''}</p></div>`).join('');
  const table = !submitted.length
    ? empty('Henüz teslim yok', 'Öğrenciler dosyalarını yüklediğinde burada görünür.')
    : editable
      ? `<form class="stack" data-form="bulk-grade" data-id="${esc(assignment.id)}">${rows}
          <div class="form-actions mt"><span class="muted small">Yalnızca değiştirdiğin satırlar kaydedilir.</span>
          <button class="btn primary" type="submit">Tüm notları kaydet</button></div>
          <p class="form-error" data-error role="alert"></p></form>`
      : rows;
  const missingList = missing.length
    ? `<h3 class="sub-title">Teslim etmeyenler (${missing.length})</h3><ul class="chips">${missing.map(m => `<li class="chip warn">${esc(m.studentName)}${m.studentNo ? ` · ${esc(m.studentNo)}` : ''}</li>`).join('')}</ul>`
    : '';
  const info = assignment.kind === 'paper' ? '<p class="notice">Bu ödev kağıt üzerinde; dosya teslimi yoktur.</p>' : '';
  openModal(assignment.title, `
    <p class="muted mb">${esc(kindLabel(assignment.kind))} ödev${assignment.dueAt ? ` · Son teslim ${esc(fmtDate(assignment.dueAt))}` : ''}</p>
    <p class="mb"><a class="btn ghost sm" href="/api/export/grades?assignmentId=${esc(assignment.id)}" download>${icon('download')}<span>Notları CSV olarak indir</span></a></p>
    ${info}${table}${missingList}`, { wide: true });
};

FORMS['bulk-grade'] = async form => {
  const changes = [];
  form.querySelectorAll('[data-sub]').forEach(row => {
    const grade = row.querySelector('[data-field=grade]'), feedback = row.querySelector('[data-field=feedback]');
    const g = grade.value.trim(), f = feedback.value.trim();
    if (g !== grade.dataset.orig.trim() || f !== feedback.dataset.orig.trim()) changes.push({ id: row.dataset.sub, grade: g, feedback: f });
  });
  if (!changes.length) throw new Error('Değiştirilmiş not yok.');
  await api(`/assignments/${form.dataset.id}/grades`, { method: 'PUT', body: { grades: changes } });
  closeModal();
  toast(`${changes.length} not kaydedildi`);
  refresh();
};

ACTIONS['delete-assignment'] = async el => {
  const yes = await confirmDialog('Ödevi sil', 'Ödev, yüklenen dosyalar ve tüm teslimler silinecek. Bu işlem geri alınamaz.');
  if (!yes) return;
  await api(`/assignments/${el.dataset.id}`, { method: 'DELETE' });
  toast('Ödev silindi');
  refresh();
};


// ---------- Yoklama ----------
let att = null;

function attRows() {
  return att.students.map(s => {
    const v = att.values[s.id];
    const control = att.readonly
      ? (v === 'present' ? badge('Geldi', 'ok') : v === 'absent' ? badge('Gelmedi', 'danger') : badge('Kaydedilmedi'))
      : `<div class="seg" role="group" aria-label="${esc(s.name)} yoklaması">
          <button type="button" class="seg-btn ${v === 'present' ? 'on' : ''}" data-action="att-set" data-id="${esc(s.id)}" data-value="present" aria-pressed="${v === 'present'}">Geldi</button>
          <button type="button" class="seg-btn absent ${v === 'absent' ? 'on' : ''}" data-action="att-set" data-id="${esc(s.id)}" data-value="absent" aria-pressed="${v === 'absent'}">Gelmedi</button>
        </div>`;
    return `<tr><td>${esc(s.studentNo)}</td><td><strong>${esc(s.name)}</strong></td><td>${control}</td><td>${meter(s.present, s.total)}</td></tr>`;
  }).join('') || `<tr><td colspan="4">${empty('Öğrenci yok', 'Müdür bu sınıfa öğrenci eklediğinde yoklama burada görünür.')}</td></tr>`;
}

function paintAttendance() {
  const body = $('#attBody');
  if (!body || !att) return;
  body.innerHTML = attRows();
  const values = Object.values(att.values);
  const present = values.filter(v => v === 'present').length;
  const marked = values.filter(Boolean).length;
  $('#attSummary').innerHTML = `<span><strong>${present}</strong> / ${att.students.length} öğrenci geldi</span>
    <span class="muted">${marked ? `${marked} öğrenci işaretlendi` : 'Henüz işaretleme yapılmadı'}</span>`;
  paintWidths(document);
}

async function pageAttendance(params) {
  if (state.me.role === 'student') return pageMyAttendance();
  const role = state.me.role;
  const classes = role === 'teacher' ? uniqueBy(state.teaching.map(t => ({ id: t.classId, name: t.className })), 'id') : state.classes;
  if (!classes.length) {
    return { html: `${head('Yoklama', 'Sınıf ve derslerine göre yoklama al.')}${panel('Yoklama', '', empty('Sınıf ataman yok', 'Müdür sana sınıf ve ders atadığında yoklama burada açılır.'))}` };
  }
  const classId = classes.some(c => c.id === params.classId) ? params.classId : classes[0].id;
  const subjects = role === 'teacher'
    ? uniqueBy(state.teaching.filter(t => t.classId === classId).map(t => ({ id: t.subjectId, name: t.subjectName })), 'id')
    : state.subjects;
  if (!subjects.length) {
    return { html: `${head('Yoklama')}${panel('Yoklama', '', empty('Ders bulunamadı', 'Bu sınıfta henüz ders tanımlı değil.'))}` };
  }
  const subjectId = subjects.some(s => s.id === params.subjectId) ? params.subjectId : subjects[0].id;
  const date = params.date || todayIso();
  const roster = await api(`/attendance/roster?classId=${classId}&subjectId=${subjectId}&date=${date}`);
  const readonly = role === 'principal';
  att = {
    classId, subjectId, date, readonly, students: roster.students,
    values: Object.fromEntries(roster.students.map(s => [s.id, s.status])),
  };
  return {
    html: `
      ${head('Yoklama', readonly ? 'Sınıf ve ders bazında devam kayıtları (salt okunur).' : 'Dersine girdiğin sınıfın yoklamasını al.',
        readonly ? '' : `<button class="btn primary" type="button" data-action="att-save">${icon('check')}<span>Yoklamayı kaydet</span></button>`)}
      <section class="panel">
        <div class="toolbar">
          <div class="toolbar-group">
            <label class="inline-field"><span>Sınıf</span>
              <select data-change="attClass">${classes.map(c => `<option value="${esc(c.id)}" ${c.id === classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
            <label class="inline-field"><span>Ders</span>
              <select data-change="attSubject">${subjects.map(s => `<option value="${esc(s.id)}" ${s.id === subjectId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
            <label class="inline-field"><span>Tarih</span>
              <input type="date" value="${esc(date)}" max="${esc(todayIso())}" data-change="attDate"></label>
          </div>
          <div class="head-actions">
            ${readonly ? '' : '<button class="btn ghost sm" type="button" data-action="att-all">Hepsi geldi</button>'}
            <a class="btn ghost sm" href="/api/export/attendance?classId=${esc(classId)}&subjectId=${esc(subjectId)}" download>${icon('download')}<span>CSV indir</span></a>
          </div>
        </div>
        <div class="att-summary" id="attSummary"></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Okul no</th><th>Ad soyad</th><th>Yoklama</th><th>Devam (dönem)</th></tr></thead>
          <tbody id="attBody"></tbody>
        </table></div>
      </section>`,
    after: paintAttendance,
  };
}

CHANGES.attClass = el => setQuery('attendance', { classId: el.value });
CHANGES.attSubject = el => setQuery('attendance', { classId: att.classId, subjectId: el.value, date: att.date });
CHANGES.attDate = el => setQuery('attendance', { classId: att.classId, subjectId: att.subjectId, date: el.value || todayIso() });

ACTIONS['att-set'] = el => {
  const { id, value } = el.dataset;
  att.values[id] = att.values[id] === value ? null : value;
  paintAttendance();
};
ACTIONS['att-all'] = () => {
  for (const id of Object.keys(att.values)) att.values[id] = 'present';
  paintAttendance();
};
ACTIONS['att-save'] = async el => {
  setBusy(el, true);
  try {
    await api('/attendance', { method: 'PUT', body: { classId: att.classId, subjectId: att.subjectId, date: att.date, records: att.values } });
    toast('Yoklama kaydedildi');
    refresh();
  } finally {
    setBusy(el, false);
  }
};

async function pageMyAttendance() {
  const { subjects, recent } = await api('/attendance/me');
  const subjectList = subjects.length
    ? `<ul class="list">${subjects.map(s => `
        <li class="list-row"><div class="list-main"><strong>${esc(s.subjectName)}</strong><small>${s.present} / ${s.total} ders</small></div>${meter(s.present, s.total)}</li>`).join('')}</ul>`
    : empty('Henüz yoklama yok', 'Öğretmenin yoklama aldığında devamın burada görünür.');
  const recentList = recent.length
    ? `<ul class="list">${recent.map(r => `
        <li class="list-row"><div class="list-main"><strong>${esc(r.subjectName)}</strong><small>${esc(fmtDate(r.date, { time: false }))}</small></div>${r.present ? badge('Geldi', 'ok') : badge('Gelmedi', 'danger')}</li>`).join('')}</ul>`
    : empty('Kayıt yok', 'Yoklama kayıtların burada tarih sırasıyla listelenecek.');
  return { html: `${head('Devamım', 'Derslerine göre devam durumun ve son yoklama kayıtların.')}
    <div class="two-col">${panel('Derslerine göre', '', subjectList)}${panel('Son kayıtlar', '', recentList)}</div>`, after: () => paintWidths(document) };
}

// ---------- Mesajlar ----------
let conv = { id: null, lastId: null, timer: null };

function bubble(m) {
  const mine = m.senderId === state.me.id;
  return `<div class="bubble ${mine ? 'mine' : ''}">
    ${mine ? '' : `<span class="who">${esc(m.senderName || 'Silinmiş kullanıcı')}</span>`}
    <p>${esc(m.body)}</p>
    <time>${esc(fmtDate(m.createdAt))}</time>
  </div>`;
}

const markRead = id => api(`/conversations/${id}/read`, { method: 'POST', body: {} })
  .then(() => refreshBadges()).catch(() => {});

const olderButton = '<div class="older"><button class="btn ghost sm" type="button" data-action="older">Daha eski mesajlar</button></div>';

function drawMessages(list, replace) {
  const box = $('#msgList');
  if (!box) return;
  const near = box.scrollHeight - box.scrollTop - box.clientHeight < 140;
  if (replace) {
    // Geçmişi baştan çizer; son ve ilk kimlikleri de buna göre sıfırlar ki sonraki çekmeler eksik kalmasın.
    conv.lastId = list.length ? String(list.at(-1).id) : null;
    conv.firstId = list.length ? String(list[0].id) : null;
    box.innerHTML = (conv.more ? olderButton : '')
      + (list.length ? list.map(bubble).join('') : '<p class="muted center">Henüz mesaj yok. İlk mesajı sen yaz.</p>');
  } else {
    const fresh = list.filter(m => conv.lastId === null || BigInt(m.id) > BigInt(conv.lastId));
    if (fresh.length) {
      box.querySelector('.center')?.remove();
      box.insertAdjacentHTML('beforeend', fresh.map(bubble).join(''));
      conv.lastId = String(fresh.at(-1).id);
    }
  }
  if (replace || near) box.scrollTop = box.scrollHeight;
}

ACTIONS.older = async el => {
  const id = conv.id, box = $('#msgList');
  if (!conv.firstId || !box) return;
  el.disabled = true;
  try {
    const data = await api(`/conversations/${id}/messages?before=${conv.firstId}`);
    if (conv.id !== id) return;
    if (!data.messages.length) { conv.more = false; box.querySelector('.older')?.remove(); return toast('Daha eski mesaj yok'); }
    const previousHeight = box.scrollHeight;
    conv.firstId = String(data.messages[0].id);
    conv.more = data.more;
    box.querySelector('.older')?.remove();
    box.insertAdjacentHTML('afterbegin', (conv.more ? olderButton : '') + data.messages.map(bubble).join(''));
    box.scrollTop = box.scrollHeight - previousHeight;
  } finally {
    el.disabled = false;
  }
};

async function fetchNewMessages(id) {
  const next = await api(`/conversations/${id}/messages?after=${conv.lastId ?? 0}`);
  if (conv.id === id && next.messages.length) { drawMessages(next.messages, false); markRead(id); }
}

async function openRoom(id) {
  clearInterval(conv.timer);
  conv = { id, lastId: null, timer: null };
  const data = await api(`/conversations/${id}/messages`);
  if (conv.id !== id || !$('#msgList')) return;
  conv.more = data.more;
  $('#roomHead').innerHTML = `<span class="avatar sm">${esc(initials(data.conversation.title))}</span>
    <div><strong>${esc(data.conversation.title)}</strong><small class="muted">${data.conversation.kind === 'class' ? 'Sınıf grubu' : 'Birebir sohbet'}</small></div>`;
  drawMessages(data.messages, true);
  markRead(id);
  // İlk yükleme sürerken gönderilen mesajlar geçmişin dışında kalmasın diye hemen bir kez daha çek.
  await fetchNewMessages(id).catch(() => {});
  conv.timer = every(() => fetchNewMessages(id).catch(() => {}), 4000);
}

async function pageMessages(params) {
  const [{ conversations }, notes] = await Promise.all([api('/conversations'), api('/notifications')]);
  const selectedId = conversations.some(c => c.id === params.c) ? params.c : conversations[0]?.id;
  const list = conversations.length
    ? `<ul class="conv-list">${conversations.map(c => `
        <li><a class="conv ${c.id === selectedId ? 'active' : ''}" href="#/messages?c=${esc(c.id)}">
          <span class="avatar sm">${esc(initials(c.title))}</span>
          <span class="conv-copy"><strong>${esc(c.title)}</strong><small>${esc(c.lastBody || 'Henüz mesaj yok')}</small></span>
          ${notes.byConversation[c.id] && c.id !== selectedId ? `<span class="conv-unread">${notes.byConversation[c.id]}</span>` : ''}
        </a></li>`).join('')}</ul>`
    : empty('Sohbet yok', 'Bir kişi seçip ilk sohbeti başlat.');
  const room = selectedId
    ? `<div class="room-head" id="roomHead"></div>
       <div class="room-body" id="msgList" aria-live="polite"></div>
       <form class="composer" data-form="message" data-conv="${esc(selectedId)}">
         <input name="body" maxlength="2000" placeholder="Mesaj yaz…" autocomplete="off" required aria-label="Mesaj">
         <button class="btn primary" type="submit">${icon('send')}<span>Gönder</span></button>
       </form>`
    : empty('Sohbet seç', 'Soldaki listeden bir sohbet seç ya da yeni bir sohbet başlat.');
  return {
    html: `${head('Mesajlar', 'Yalnızca yetkili olduğun kişi ve sınıf gruplarıyla yazışırsın.',
      `<button class="btn primary" type="button" data-action="new-chat">${icon('plus')}<span>Yeni sohbet</span></button>`)}
      <section class="chat"><div>${list}</div><div class="room">${room}</div></section>`,
    after: () => { if (selectedId) openRoom(selectedId); else conv = { id: null, lastId: null, timer: null }; },
  };
}

FORMS.message = async form => {
  // Mesaj, formun ait olduğu sohbete gider; ekran başka bir sohbete geçtiyse yanlış odaya düşmez.
  const id = form.dataset.conv;
  const input = form.querySelector('[name=body]');
  const text = input.value.trim();
  if (!text || !id) return;
  const { message } = await api(`/conversations/${id}/messages`, { method: 'POST', body: { body: text } });
  input.value = '';
  if (conv.id === id) drawMessages([message], false);
};

ACTIONS['new-chat'] = async () => {
  const { users } = await api('/users');
  const options = users.filter(u => u.id !== state.me.id)
    .map(u => `<option value="${esc(u.id)}">${esc(u.name)} — ${esc(ROLE[u.role])}${u.className ? ` (${esc(u.className)})` : ''}</option>`).join('');
  if (!options) return toast('Mesaj gönderebileceğin kimse yok.', 'error');
  openModal('Yeni sohbet', `<form class="stack" data-form="new-chat">
    <label class="field"><span>Kişi ara</span><input type="search" data-input="chatFilter" placeholder="İsim yazın…" aria-label="Kişi ara"></label>
    <label class="field"><span>Kime yazmak istersin?</span><select name="userId" id="chatSelect" required size="6">${options}</select></label>
    <p class="muted small">Yalnızca yetkili olduğun kişilerle sohbet açabilirsin.</p>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Sohbeti aç</button></div>
  </form>`);
};

INPUTS.chatFilter = el => {
  const term = el.value.trim().toLocaleLowerCase('tr-TR');
  document.querySelectorAll('#chatSelect option').forEach(option => {
    option.hidden = Boolean(term) && !option.textContent.toLocaleLowerCase('tr-TR').includes(term);
  });
};

FORMS['new-chat'] = async form => {
  const { id } = await api('/conversations', { method: 'POST', body: { userId: val(form, 'userId') } });
  closeModal();
  setQuery('messages', { c: id });
};

ACTIONS['chat-with'] = async el => {
  const { id } = await api('/conversations', { method: 'POST', body: { userId: el.dataset.id } });
  setQuery('messages', { c: id });
};

// ---------- Kişiler ----------
let peopleCache = [];

function teachingMatrix(selected = []) {
  if (!state.classes.length || !state.subjects.length) {
    return '<p class="muted small">Önce “Okul” sayfasında sınıf ve ders ekle.</p>';
  }
  const keys = new Set(selected.map(p => `${p.classId}|${p.subjectId}`));
  return `<div class="matrix-wrap"><table class="matrix">
    <thead><tr><th>Sınıf</th>${state.subjects.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr></thead>
    <tbody>${state.classes.map(c => `<tr><th scope="row">${esc(c.name)}</th>${state.subjects.map(s => `
      <td><input type="checkbox" name="pair" value="${esc(c.id)}|${esc(s.id)}" ${keys.has(`${c.id}|${s.id}`) ? 'checked' : ''} aria-label="${esc(c.name)} ${esc(s.name)}"></td>`).join('')}</tr>`).join('')}
    </tbody></table></div>`;
}

const checkedPairs = form => [...form.querySelectorAll('input[name=pair]:checked')].map(input => {
  const [classId, subjectId] = input.value.split('|');
  return { classId, subjectId };
});

function userForm(user = null) {
  const editing = Boolean(user);
  const role = user?.role || 'teacher';
  const classOptions = state.classes.map(c => `<option value="${esc(c.id)}" ${user?.classId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  return `<form class="stack" data-form="${editing ? 'edit-user' : 'new-user'}" ${editing ? `data-id="${esc(user.id)}" data-role="${esc(role)}"` : ''}>
    <div class="grid-2">
      ${editing
        ? `<label class="field"><span>Rol</span><input value="${esc(ROLE[role])}" disabled></label>`
        : `<label class="field"><span>Rol</span><select name="role" data-change="roleToggle"><option value="teacher">Öğretmen</option><option value="student">Öğrenci</option><option value="principal">Müdür (ek yönetici)</option></select></label>`}
      <label class="field"><span>Ad soyad</span><input name="name" required maxlength="80" value="${esc(user?.name || '')}"></label>
    </div>
    ${editing ? '' : `<div class="grid-2">
      <label class="field"><span>Kullanıcı adı</span><input name="username" required minlength="3" maxlength="32" autocomplete="off"></label>
      <label class="field"><span>İlk şifre</span><input name="password" type="password" required minlength="8" maxlength="128" autocomplete="new-password"><small>En az 8 karakter; harf ve rakam.</small></label>
    </div>`}
    <div class="grid-2" data-for="student" ${role === 'student' ? '' : 'hidden'}>
      <label class="field"><span>Okul numarası</span><input name="studentNo" maxlength="20" value="${esc(user?.studentNo || '')}"></label>
      <label class="field"><span>Sınıf</span><select name="classId"><option value="">Seçilmedi</option>${classOptions}</select></label>
    </div>
    <div data-for="teacher" ${role === 'teacher' ? '' : 'hidden'}>
      <span class="field-label">Verdiği sınıf ve dersler</span>
      ${teachingMatrix(user?.teaching || [])}
    </div>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button>
      <button class="btn primary" type="submit">${editing ? 'Kaydet' : 'Hesabı oluştur'}</button></div>
  </form>`;
}

ACTIONS['new-user'] = () => openModal('Yeni hesap', userForm());
ACTIONS['edit-user'] = el => {
  const user = peopleCache.find(u => u.id === el.dataset.id);
  if (user) openModal('Hesabı düzenle', userForm(user));
};
CHANGES.roleToggle = el => $$('[data-for]').forEach(node => { node.hidden = node.dataset.for !== el.value; });

FORMS['new-user'] = async form => {
  const role = val(form, 'role');
  const body = { role, name: val(form, 'name'), username: val(form, 'username'), password: val(form, 'password') };
  if (role === 'student') {
    body.studentNo = val(form, 'studentNo');
    body.classId = val(form, 'classId') || null;
  } else {
    body.teaching = checkedPairs(form);
  }
  await api('/users', { method: 'POST', body });
  closeModal();
  toast('Hesap oluşturuldu');
  refresh();
};

FORMS['edit-user'] = async form => {
  const body = { name: val(form, 'name') };
  if (form.dataset.role === 'student') {
    body.studentNo = val(form, 'studentNo');
    body.classId = val(form, 'classId');
  } else {
    body.teaching = checkedPairs(form);
  }
  await api(`/users/${form.dataset.id}`, { method: 'PATCH', body });
  closeModal();
  toast('Hesap güncellendi');
  refresh();
};

ACTIONS['reset-password'] = el => openModal('Şifre sıfırla', `
  <form class="stack" data-form="reset-password" data-id="${esc(el.dataset.id)}">
    <p class="muted">Yeni şifreyi belirle. Bu kişinin açık oturumları kapanır.</p>
    <label class="field"><span>Yeni şifre (en az 8)</span><input name="password" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></label>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Şifreyi değiştir</button></div>
  </form>`);

FORMS['reset-password'] = async form => {
  await api(`/users/${form.dataset.id}/password`, { method: 'PUT', body: { password: val(form, 'password') } });
  closeModal();
  toast('Şifre güncellendi');
};

ACTIONS['delete-user'] = async el => {
  const yes = await confirmDialog('Hesabı sil', 'Hesap, kişi kaydı ve bu kişinin ödev teslimleri kalıcı olarak silinir. Bu işlem geri alınamaz.');
  if (!yes) return;
  await api(`/users/${el.dataset.id}`, { method: 'DELETE' });
  toast('Hesap silindi');
  refresh();
};

const classInfo = u => {
  if (u.role === 'student') return u.className || 'Sınıfsız';
  if (u.role === 'principal') return 'Okul müdürü';
  if (u.teaching) return u.teaching.map(t => `${t.className} · ${t.subjectName}`).join(', ') || 'Ders ataması yok';
  return 'Öğretmen';
};

function personRow(u, principal) {
  const isSelf = u.id === state.me.id;
  const actions = [];
  if (!isSelf) actions.push(`<button class="btn ghost sm" type="button" data-action="chat-with" data-id="${esc(u.id)}">Mesaj</button>`);
  if (principal && !isSelf) {
    actions.push(`<button class="icon-btn sm" type="button" data-action="edit-user" data-id="${esc(u.id)}" aria-label="${esc(u.name)} düzenle">✎</button>`);
    actions.push(`<button class="btn ghost sm" type="button" data-action="reset-password" data-id="${esc(u.id)}">Şifre</button>`);
    actions.push(`<button class="icon-btn sm" type="button" data-action="delete-user" data-id="${esc(u.id)}" aria-label="${esc(u.name)} hesabını sil">${icon('trash')}</button>`);
  }
  const roleKind = u.role === 'teacher' ? 'ok' : u.role === 'principal' ? 'brand' : 'neutral';
  return `<tr>
    <td><div class="person"><span class="avatar sm ${tone(u.role)}">${esc(initials(u.name))}</span><div><strong>${esc(u.name)}</strong>${principal && u.username ? `<small class="cell-note">@${esc(u.username)}</small>` : ''}</div></div></td>
    <td>${badge(ROLE[u.role], roleKind)}</td>
    <td>${esc(classInfo(u))}</td>
    <td>${esc(u.studentNo || '—')}</td>
    <td class="row-actions">${actions.join('')}</td>
  </tr>`;
}

const people = { page: 1, size: 25, role: 'all', q: '' };
let searchTimer = null;

async function loadPeople() {
  const principal = state.me.role === 'principal';
  const query = new URLSearchParams({ page: people.page, size: people.size });
  if (people.role !== 'all') query.set('role', people.role);
  if (people.q) query.set('q', people.q);
  const data = await api(`/users?${query}`);
  peopleCache = data.users;
  const body = $('#peopleBody');
  if (!body) return;
  body.innerHTML = data.users.map(u => personRow(u, principal)).join('')
    || `<tr><td colspan="5">${empty('Kişi bulunamadı', 'Filtreyi değiştirmeyi ya da yeni bir hesap eklemeyi dene.')}</td></tr>`;
  $('#peopleCount').textContent = `${data.total} kişi`;
  $('#peoplePager').innerHTML = pager(data.total, data.page, data.size, 'page-people');
}

CHANGES.peopleRole = el => { people.role = el.value; people.page = 1; loadPeople().catch(e => toast(e.message, 'error')); };
INPUTS.peopleSearch = el => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { people.q = el.value.trim(); people.page = 1; loadPeople().catch(e => toast(e.message, 'error')); }, 300);
};
ACTIONS['page-people'] = el => { people.page = Number(el.dataset.page); loadPeople().catch(e => toast(e.message, 'error')); };

async function pagePeople() {
  const principal = state.me.role === 'principal';
  const actions = principal ? `<a class="btn ghost" href="/api/export/users" download>${icon('download')}<span>CSV indir</span></a><button class="btn primary" type="button" data-action="new-user">${icon('plus')}<span>Yeni hesap</span></button>` : '';
  const option = (value, label) => `<option value="${value}" ${people.role === value ? 'selected' : ''}>${label}</option>`;
  return {
    html: `${head('Kişiler', principal ? 'Okul hesaplarını yönet: ekle, düzenle, şifre sıfırla.' : 'Sınıfınla ilgili kişiler ve iletişim.', actions)}
      <section class="panel">
        <div class="toolbar">
          <div class="toolbar-group">
            <select data-change="peopleRole" aria-label="Rol filtresi">
              ${option('all', 'Tüm roller')}${option('teacher', 'Öğretmen')}${option('student', 'Öğrenci')}${principal ? option('principal', 'Müdür') : ''}
            </select>
            <input type="search" data-input="peopleSearch" value="${esc(people.q)}" placeholder="İsim veya okul numarası ara…" aria-label="Kişi ara">
          </div>
          <span class="muted" id="peopleCount"></span>
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Ad soyad</th><th>Rol</th><th>Sınıf / ders</th><th>Okul no</th><th></th></tr></thead>
          <tbody id="peopleBody"></tbody>
        </table></div>
        <div id="peoplePager"></div>
      </section>`,
    after: () => loadPeople().catch(e => toast(e.message, 'error')),
  };
}

// ---------- Okul (müdür) ----------
async function pageSchool() {
  const [{ classes }, { subjects }] = await Promise.all([api('/classes'), api('/subjects')]);
  const school = state.school || {};
  const chips = (items, kind, deleteAction) => items.length
    ? `<ul class="chips">${items.map(i => `<li class="chip">${esc(i.name)}${kind === 'class' ? `<small>${i.studentCount} öğrenci</small>` : ''}
        <button class="chip-x" type="button" data-action="${deleteAction}" data-id="${esc(i.id)}" aria-label="${esc(i.name)} sil">${icon('close')}</button></li>`).join('')}</ul>`
    : '<p class="muted small">Henüz eklenmedi.</p>';
  return {
    html: `${head('Okul', 'Okul bilgileri, sınıflar ve dersler.')}
      <div class="two-col">
        ${panel('Okul bilgileri', '', `<form class="stack pad" data-form="school">
          <label class="field"><span>Okul adı</span><input name="name" required maxlength="120" value="${esc(school.name || '')}"></label>
          <div class="grid-2">
            <label class="field"><span>Şehir</span><input name="city" required maxlength="80" value="${esc(school.city || '')}"></label>
            <label class="field"><span>Eğitim yılı</span><input name="year" required maxlength="20" value="${esc(school.year || '')}"></label>
          </div>
          <p class="form-error" data-error role="alert"></p>
          <div class="form-actions"><button class="btn primary" type="submit">Kaydet</button></div>
        </form>`)}
        ${panel('Sınıflar', `${classes.length} sınıf`, `<div class="pad">
          ${chips(classes, 'class', 'delete-class')}
          <form class="inline-add" data-form="class"><input name="name" required maxlength="20" placeholder="Örn. 6/A" aria-label="Yeni sınıf adı"><button class="btn primary sm" type="submit">Ekle</button></form>
          <p class="form-error" data-error role="alert"></p></div>`)}
      </div>
      ${panel('Dersler', `${subjects.length} ders`, `<div class="pad">
        ${chips(subjects, 'subject', 'delete-subject')}
        <form class="inline-add" data-form="subject"><input name="name" required maxlength="40" placeholder="Örn. Matematik" aria-label="Yeni ders adı"><button class="btn primary sm" type="submit">Ekle</button></form>
        <p class="form-error" data-error role="alert"></p></div>`)}`,
  };
}

FORMS.school = async form => {
  await api('/school', { method: 'PUT', body: { name: val(form, 'name'), city: val(form, 'city'), year: val(form, 'year') } });
  toast('Okul bilgileri kaydedildi');
  await refreshMe();
};
FORMS.class = async form => {
  await api('/classes', { method: 'POST', body: { name: val(form, 'name') } });
  toast('Sınıf eklendi');
  await refreshMe();
};
FORMS.subject = async form => {
  await api('/subjects', { method: 'POST', body: { name: val(form, 'name') } });
  toast('Ders eklendi');
  await refreshMe();
};
ACTIONS['delete-class'] = async el => {
  const yes = await confirmDialog('Sınıfı sil', 'Bu sınıfın ödevleri, yoklama kayıtları ve öğrenci sınıf atamaları silinir. Bu işlem geri alınamaz.');
  if (!yes) return;
  await api(`/classes/${el.dataset.id}`, { method: 'DELETE' });
  toast('Sınıf silindi');
  await refreshMe();
};
ACTIONS['delete-subject'] = async el => {
  const yes = await confirmDialog('Dersi sil', 'Bu dersin ödevleri, yoklama kayıtları ve öğretmen atamaları silinir. Bu işlem geri alınamaz.');
  if (!yes) return;
  await api(`/subjects/${el.dataset.id}`, { method: 'DELETE' });
  toast('Ders silindi');
  await refreshMe();
};

// ---------- Şifre ----------
ACTIONS.account = () => openModal('Hesabım', `<form class="stack" data-form="account">
  <label class="field"><span>Ad soyad</span><input name="name" required minlength="2" maxlength="80" value="${esc(state.me.name)}"></label>
  <p class="muted small">Kullanıcı adınız (${esc(state.me.username || '')}) değiştirilemez.</p>
  <div class="security-box">
    <p><strong>Son giriş:</strong> ${esc(state.me.lastLoginAt ? fmtDate(state.me.lastLoginAt) : 'Bilgi yok')}${state.me.lastLoginIp ? ` · IP ${esc(state.me.lastLoginIp)}` : ''}</p>
    <p class="small muted">Tanımadığınız bir giriş görürseniz hemen şifrenizi değiştirin ve tüm cihazlardan çıkış yapın.</p>
    <button class="btn ghost sm" type="button" data-action="revoke-sessions">Tüm cihazlardan çıkış yap</button>
  </div>
  <p class="form-error" data-error role="alert"></p>
  <div class="form-actions">
    <button class="btn ghost" type="button" data-action="password">Şifreyi değiştir</button>
    <button class="btn primary" type="submit">Kaydet</button>
  </div>
</form>`);

ACTIONS['revoke-sessions'] = async () => {
  const yes = await confirmDialog('Tüm cihazlardan çıkış', 'Bu hesabın açık olduğu tüm cihazlardan çıkış yapılacak. Bu tarayıcıda da yeniden giriş yapmanız gerekecek.', 'Evet, çıkış yap');
  if (!yes) return;
  await api('/me/sessions/revoke', { method: 'POST', body: {} });
  closeModal();
  window.dispatchEvent(new Event('okulum:logged-out'));
};

FORMS.account = async form => {
  await api('/me', { method: 'PATCH', body: { name: val(form, 'name').trim() } });
  closeModal();
  toast('Ad soyad güncellendi');
  await refreshMe();
};

ACTIONS.password = () => openModal('Şifreni değiştir', `<form class="stack" data-form="password">
  <label class="field"><span>Mevcut şifre</span><input name="current" type="password" required autocomplete="current-password"></label>
  <label class="field"><span>Yeni şifre</span><input name="next" type="password" required minlength="8" maxlength="128" autocomplete="new-password"><small>En az 8 karakter; harf ve rakam içermeli. Yaygın şifreler kabul edilmez.</small></label>
  <label class="field"><span>Yeni şifre (tekrar)</span><input name="repeat" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></label>
  <p class="form-error" data-error role="alert"></p>
  <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Şifreyi güncelle</button></div>
</form>`);

FORMS.password = async form => {
  if (val(form, 'next') !== val(form, 'repeat')) throw new Error('Yeni şifreler eşleşmiyor.');
  await api('/me/password', { method: 'PUT', body: { current: val(form, 'current'), next: val(form, 'next') } });
  closeModal();
  toast('Şifren güncellendi. Diğer oturumlar kapatıldı.');
};

ACTIONS['close-modal'] = () => closeModal();

// ---------- Panolar (sınıf ve okul panoları) ----------
const NOTE_COLORS = [['sun', 'Sarı'], ['mint', 'Nane'], ['coral', 'Mercan'], ['sky', 'Gök'], ['lilac', 'Leylak']];
const scopeLabel = scope => (scope === 'school' ? 'Okul panosu' : 'Sınıf panosu');
let currentBoard = null;

async function pagePanolar(params) {
  const scope = params.scope || 'all';
  const search = params.q || '';
  const query = new URLSearchParams({ ...(scope !== 'all' ? { scope } : {}), ...(search ? { q: search } : {}) });
  const { boards } = await api(`/boards?${query}`);
  const role = state.me.role;
  const canCreate = role === 'principal' || (role === 'teacher' && state.teaching.length > 0);
  const cards = boards.map(b => `
    <a class="board-card ${b.scope}" href="#/pano?id=${esc(b.id)}">
      <div class="board-card-top">
        ${badge(scopeLabel(b.scope), b.scope === 'school' ? 'brand' : 'ok')}
        ${b.className ? `<span class="muted small">${esc(b.className)}</span>` : ''}
      </div>
      <h3>${esc(b.title)}</h3>
      <p class="muted small">${esc(b.description || '')}</p>
      <footer class="board-card-foot"><span>${b.noteCount} not</span><span>${esc(b.createdBy || '')}</span></footer>
    </a>`).join('');
  const filter = `<form class="search-form" data-form="board-search" role="search">
      <select name="scope" aria-label="Pano türü">
        ${[['all', 'Tüm panolar'], ['class', 'Sınıf panoları'], ['school', 'Okul panoları']]
          .map(([value, label]) => `<option value="${value}" ${value === scope ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
      <input type="search" name="q" value="${esc(search)}" placeholder="Pano adında ara…" maxlength="80" aria-label="Pano ara">
      <button class="btn ghost sm" type="submit">Ara</button>
    </form>`;
  return { html: `
    ${head('Panolar', 'Sınıf ve okul panoları. Notlar, bağlantılar ve dosyalar ekleyebilirsiniz.',
      canCreate ? `<button class="btn primary" type="button" data-action="board-new">${icon('plus')}<span>Yeni pano</span></button>` : '')}
    <section class="panel">
      <div class="toolbar">${filter}<span class="muted">${boards.length} pano</span></div>
      ${boards.length
        ? `<div class="board-grid">${cards}</div>`
        : empty('Pano yok', canCreate ? 'Sınıfınız için ilk panoyu açarak başlayın.' : 'Öğretmenler sınıf panosu açtığında, müdür okul panosu açtığında burada görünür.')}
    </section>` };
}

FORMS['board-search'] = async form => setQuery('panolar', { scope: val(form, 'scope'), q: val(form, 'q').trim() });

function boardForm(board = null) {
  const role = state.me.role;
  const editing = Boolean(board);
  const classes = role === 'principal' ? state.classes : uniqueBy(state.teaching.map(t => ({ id: t.classId, name: t.className })), 'id');
  return `<form class="stack" data-form="${editing ? 'board-edit' : 'board-create'}" ${editing ? `data-id="${esc(board.id)}"` : ''}>
    <label class="field"><span>Pano adı</span><input name="title" required minlength="2" maxlength="120" value="${esc(board?.title || '')}"></label>
    <label class="field"><span>Açıklama</span><textarea name="description" rows="2" maxlength="500">${esc(board?.description || '')}</textarea></label>
    ${editing ? '' : `
      <div class="grid-2">
        <label class="field"><span>Pano türü</span>
          <select name="scope" data-change="boardScope">
            <option value="class">Sınıf panosu</option>
            ${role === 'principal' ? '<option value="school">Okul panosu</option>' : ''}
          </select></label>
        <label class="field" data-for-scope="class"><span>Sınıf</span>
          <select name="classId">${classes.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
      </div>
      <p class="muted small" data-for-scope="school" hidden>Okul panosunu yalnızca müdür açar. İçine yazdığı notlar ana sayfada okul duyurusu olarak görünür.</p>`}
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button>
      <button class="btn primary" type="submit">${editing ? 'Kaydet' : 'Panoyu aç'}</button></div>
  </form>`;
}

CHANGES.boardScope = el => {
  const isClass = el.value === 'class';
  $$('[data-for-scope=class]').forEach(node => { node.hidden = !isClass; });
  $$('[data-for-scope=school]').forEach(node => { node.hidden = isClass; });
};

ACTIONS['board-new'] = () => openModal('Yeni pano', boardForm());
ACTIONS['board-edit-open'] = () => currentBoard && openModal('Panoyu düzenle', boardForm(currentBoard));

FORMS['board-create'] = async form => {
  const scope = val(form, 'scope');
  const body = { title: val(form, 'title').trim(), description: val(form, 'description').trim(), scope };
  if (scope === 'class') body.classId = val(form, 'classId');
  const { id } = await api('/boards', { method: 'POST', body });
  closeModal();
  toast('Pano açıldı');
  setQuery('pano', { id });
};

FORMS['board-edit'] = async form => {
  await api(`/boards/${form.dataset.id}`, { method: 'PATCH', body: { title: val(form, 'title').trim(), description: val(form, 'description').trim() } });
  closeModal();
  toast('Pano güncellendi');
  refresh();
};

ACTIONS['board-delete'] = async el => {
  const yes = await confirmDialog('Panoyu sil', 'Pano, içindeki tüm notlar ve yüklenen dosyalar silinecek. Bu işlem geri alınamaz.');
  if (!yes) return;
  await api(`/boards/${el.dataset.id}`, { method: 'DELETE' });
  toast('Pano silindi');
  setQuery('panolar', {});
};

async function pageBoard(params) {
  if (!params.id) return { html: `${head('Pano')}${panel('Pano', '', empty('Pano seçilmedi', 'Panolar sayfasından bir pano seçin.'))}` };
  const { board, notes } = await api(`/boards/${encodeURIComponent(params.id)}/notes`);
  currentBoard = board;
  const rights = board.rights;
  const actions = [
    rights.post ? `<button class="btn primary" type="button" data-action="note-new" data-id="${esc(board.id)}">${icon('plus')}<span>Not ekle</span></button>` : '',
    rights.moderate ? `<button class="btn ghost" type="button" data-action="board-edit-open">Düzenle</button>
      <button class="btn ghost" type="button" data-action="board-delete" data-id="${esc(board.id)}">${icon('trash')}<span>Panoyu sil</span></button>` : '',
    '<a class="btn ghost" href="#/panolar">← Panolar</a>',
  ].join('');
  const cards = notes.map(n => `
    <article class="pin pin-${esc(n.color)}">
      ${n.title ? `<h3>${esc(n.title)}</h3>` : ''}
      ${n.body ? `<p>${esc(n.body)}</p>` : ''}
      ${n.link ? `<a class="note-link" href="${esc(n.link)}" target="_blank" rel="noopener noreferrer">${icon('send')}<span>${esc(n.link.replace(/^https?:\/\//, '').slice(0, 60))}</span></a>` : ''}
      ${n.hasFile ? `<a class="note-link" href="/api/files/board-note/${esc(n.id)}" download>${icon('download')}<span>${esc(n.fileName)}</span></a>` : ''}
      <footer class="note-foot">
        <span>${esc(n.authorName || 'Silinmiş kullanıcı')} · ${esc(ROLE[n.authorRole] || '')} · ${esc(fmtDate(n.createdAt))}</span>
        ${n.canDelete ? `<button class="icon-btn sm" type="button" data-action="note-delete" data-id="${esc(n.id)}" aria-label="Notu sil">${icon('trash')}</button>` : ''}
      </footer>
    </article>`).join('');
  return { html: `
    ${head(board.title, `${scopeLabel(board.scope)}${board.className ? ` · ${board.className}` : ''}${board.description ? ` — ${board.description}` : ''}`, actions)}
    ${notes.length
      ? `<div class="pin-grid">${cards}</div>`
      : empty('Henüz not yok', rights.post ? 'İlk notu ekleyerek panoyu başlatın.' : 'Bu pano için henüz not eklenmedi.')}` };
}

function noteForm(boardId) {
  return `<form class="stack" data-form="note-create" data-id="${esc(boardId)}">
    <label class="field"><span>Başlık</span><input name="title" maxlength="120"></label>
    <label class="field"><span>Metin</span><textarea name="body" rows="4" maxlength="2000"></textarea></label>
    <div class="grid-2">
      <label class="field"><span>Bağlantı (isteğe bağlı)</span><input name="link" type="url" placeholder="https://..." maxlength="500"></label>
      <label class="field"><span>Renk</span>
        <select name="color">${NOTE_COLORS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
    </div>
    <label class="field"><span>Dosya (isteğe bağlı)</span>
      <input name="file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"><small>PDF, Word veya görsel · en fazla 5 MB</small></label>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button>
      <button class="btn primary" type="submit">Notu ekle</button></div>
  </form>`;
}

ACTIONS['note-new'] = () => openModal('Not ekle', noteForm(currentBoard?.id));

FORMS['note-create'] = async form => {
  const title = val(form, 'title').trim();
  const body = { title, body: val(form, 'body').trim(), link: val(form, 'link').trim(), color: val(form, 'color') };
  const file = form.querySelector('[name=file]').files[0];
  if (file) {
    if (file.size > 5 * 1024 * 1024) throw new Error('Dosya 5 MB sınırını aşıyor.');
    body.file = await readFile(file);
  }
  await api(`/boards/${form.dataset.id}/notes`, { method: 'POST', body });
  closeModal();
  toast('Not eklendi');
  refresh();
};

ACTIONS['note-delete'] = async el => {
  const yes = await confirmDialog('Notu sil', 'Bu not ve varsa eki kalıcı olarak silinecek.');
  if (!yes) return;
  await api(`/board-notes/${el.dataset.id}`, { method: 'DELETE' });
  toast('Not silindi');
  refresh();
};

// ---------- Denetim kaydı (müdür) ----------
const AUDIT_LABELS = {
  login_failed: 'Başarısız giriş', setup: 'Okul kuruldu', school_updated: 'Okul bilgisi değişti',
  class_created: 'Sınıf eklendi', class_deleted: 'Sınıf silindi', subject_created: 'Ders eklendi', subject_deleted: 'Ders silindi',
  user_created: 'Hesap açıldı', user_updated: 'Hesap düzenlendi', user_deleted: 'Hesap silindi',
  password_reset: 'Şifre sıfırlandı', password_changed: 'Kendi şifresini değiştirdi', profile_updated: 'Ad değiştirildi',
  board_created: 'Pano açıldı', board_deleted: 'Pano silindi', board_note_deleted: 'Pano notu silindi',
  assignment_created: 'Ödev oluşturuldu', assignment_updated: 'Ödev düzenlendi', assignment_deleted: 'Ödev silindi',
  grades_saved: 'Not kaydedildi', attendance_saved: 'Yoklama kaydedildi',
};
const DETAIL_LABELS = {
  role: 'rol', username: 'kullanıcı', className: 'sınıf', teachingPairs: 'ders ataması', classChanged: 'sınıf değişti',
  fields: 'alan', city: 'şehir', year: 'yıl', kind: 'tür', dueAt: 'son teslim', date: 'tarih', count: 'adet', ip: 'IP',
};
const ROLE_NAMES = { teacher: 'öğretmen', student: 'öğrenci', principal: 'müdür' };
const ACTOR_NAMES = { principal: 'Müdür', teacher: 'Öğretmen', student: 'Öğrenci', anonymous: 'Giriş denemesi', sistem: 'Sistem' };

function detailText(details = {}) {
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      let value = v;
      if (k === 'dueAt') value = fmtDate(v);
      else if (k === 'role') value = ROLE_NAMES[v] || v;
      else if (typeof v === 'boolean') value = v ? 'evet' : 'hayır';
      return `${DETAIL_LABELS[k] || k}: ${value}`;
    }).join(' · ');
}

async function pageAudit(params) {
  const page = Math.max(1, Number(params.page) || 1);
  const action = params.action || '';
  const query = new URLSearchParams({ page, size: 30, ...(action ? { action } : {}) });
  const { entries, total, size } = await api(`/audit?${query}`);
  const options = Object.entries(AUDIT_LABELS)
    .map(([value, label]) => `<option value="${value}" ${value === action ? 'selected' : ''}>${esc(label)}</option>`).join('');
  const rows = entries.map(e => `<tr>
      <td>${esc(fmtDate(e.createdAt))}</td>
      <td><strong>${esc(e.actorName)}</strong><small class="cell-note">${esc(ACTOR_NAMES[e.actorRole] || e.actorRole)}</small></td>
      <td>${badge(AUDIT_LABELS[e.action] || e.action, e.action === 'login_failed' ? 'danger' : 'neutral')}</td>
      <td>${esc(e.target)}</td>
      <td><small class="muted">${esc(detailText(e.details))}</small></td>
    </tr>`).join('');
  return { html: `${head('Denetim kaydı', 'Okuldaki önemli işlemler: kim, ne zaman, neyi değiştirdi. Parolalar hiçbir zaman kaydedilmez.', '<a class="btn ghost" href="/api/export/audit" download>' + icon('download') + '<span>CSV indir</span></a>')}
    <section class="panel">
      <div class="toolbar">
        <label class="inline-field"><span>İşlem</span>
          <select data-change="auditAction"><option value="">Tüm işlemler</option>${options}</select></label>
        <span class="muted">${total} kayıt</span>
      </div>
      ${entries.length
        ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Zaman</th><th>Kişi</th><th>İşlem</th><th>Hedef</th><th>Ayrıntı</th></tr></thead>
            <tbody>${rows}</tbody></table></div>${pager(total, page, size, 'page-audit')}`
        : empty('Kayıt yok', 'Yapılan işlemler burada görünecek.')}
    </section>` };
}

CHANGES.auditAction = el => setQuery('audit', { action: el.value, page: 1 });
ACTIONS['page-audit'] = el => setQuery('audit', { ...parseHash().params, page: el.dataset.page });

// ---------- Yönlendirme tablosu ----------
const PAGES = {
  overview: pageOverview, classes: pageClasses, assignments: pageAssignments, attendance: pageAttendance,
  messages: pageMessages, people: pagePeople, school: pageSchool, audit: pageAudit,
  yardim: async () => ({ html: helpHtml() }),
  panolar: pagePanolar, pano: pageBoard,
};
export function renderView(page, params) {
  return PAGES[page](params);
}
