import { renderMarkdown } from './markdown.js';
import { enablePush, disablePush, isSubscribed } from './push.js';
import { mountGraph } from './graph.js';
import { projectile, trajectory, titrationPH, equivalenceVolume, titrationSeries } from './labs.js';
import { ELEMENTS, bestReaction, parseFormulaComp, atomComp, iconFor } from './chem.js';
import { parseBase, toBase, truthTable, bubbleSortSteps } from './computing.js';
import { runPython, highlightPython, pyHint } from './pyterm.js';
import { fxEnabled, setFx } from './fx.js';
import { helpHtml } from './help.js';
import { state, api, $, $$, esc, ROLE, icon, fmtDate, todayIso, pct, initials, tone, readFile, toast, openModal, closeModal, confirmDialog, refreshMe, refresh, val, setBusy, setQuery, parseHash, paintWidths, refreshBadges } from './core.js';

export const ACTIONS = {}, FORMS = {}, CHANGES = {}, INPUTS = {};

let timers = [];
export function stopTimers() { timers.forEach(clearInterval); timers = []; clearQuizTimer(); }
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
const empty = (title, text, action = '') => `<div class="empty"><p class="empty-title">${esc(title)}</p><p>${esc(text)}</p>${action}</div>`;
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
  return `<nav class="pager" aria-label="Sayfa gezinmesi">
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
        <thead><tr><th>Ödev</th><th>Sınıf · Ders</th><th>Son teslim</th><th>Tür</th><th>Teslim</th><th><span class="sr-only">İşlemler</span></th></tr></thead>
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
      ? (v === 'present' ? badge('Geldi', 'ok') : v === 'absent' ? badge('Gelmedi', 'danger') : v === 'excused' ? badge('Mazeretli') : badge('Kaydedilmedi'))
      : `<div class="seg" role="group" aria-label="${esc(s.name)} yoklaması">
          <button type="button" class="seg-btn ${v === 'present' ? 'on' : ''}" data-action="att-set" data-id="${esc(s.id)}" data-value="present" aria-pressed="${v === 'present'}">Geldi</button>
          <button type="button" class="seg-btn absent ${v === 'absent' ? 'on' : ''}" data-action="att-set" data-id="${esc(s.id)}" data-value="absent" aria-pressed="${v === 'absent'}">Gelmedi</button>
          <button type="button" class="seg-btn excused ${v === 'excused' ? 'on' : ''}" data-action="att-set" data-id="${esc(s.id)}" data-value="excused" aria-pressed="${v === 'excused'}">Mazeretli</button>
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

const checkedChildren = form => [...form.querySelectorAll('input[name=child]:checked')].map(input => input.value);

const checkedPairs = form => [...form.querySelectorAll('input[name=pair]:checked')].map(input => {
  const [classId, subjectId] = input.value.split('|');
  return { classId, subjectId };
});

function userForm(user = null, students = []) {
  const editing = Boolean(user);
  const role = user?.role || 'teacher';
  const classOptions = state.classes.map(c => `<option value="${esc(c.id)}" ${user?.classId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  return `<form class="stack" data-form="${editing ? 'edit-user' : 'new-user'}" ${editing ? `data-id="${esc(user.id)}" data-role="${esc(role)}"` : ''}>
    <div class="grid-2">
      ${editing
        ? `<label class="field"><span>Rol</span><input value="${esc(ROLE[role])}" disabled></label>`
        : `<label class="field"><span>Rol</span><select name="role" data-change="roleToggle"><option value="teacher">Öğretmen</option><option value="student">Öğrenci</option><option value="parent">Veli</option><option value="principal">Müdür (ek yönetici)</option></select></label>`}
      <label class="field"><span>Ad soyad</span><input name="name" required maxlength="80" value="${esc(user?.name || '')}"></label>
    </div>
    <label class="field"><span>E-posta (şifre sıfırlama için)</span><input name="email" type="email" maxlength="120" autocomplete="off" value="${esc(user?.email || '')}"></label>
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
    <div data-for="parent" ${role === 'parent' ? '' : 'hidden'}>
      <span class="field-label">Bağlı çocuklar</span>
      <div class="member-list">${students.length
        ? students.map(st => `<label class="member-row"><input type="checkbox" name="child" value="${esc(st.id)}" ${(user?.childIds || []).includes(st.id) ? 'checked' : ''}>
            <span><strong>${esc(st.name)}</strong><small class="muted">${esc(st.className || 'Sınıfsız')} · ${esc(st.studentNo || '')}</small></span></label>`).join('')
        : '<p class="muted small">Önce öğrenci hesabı açın.</p>'}</div>
    </div>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button>
      <button class="btn primary" type="submit">${editing ? 'Kaydet' : 'Hesabı oluştur'}</button></div>
  </form>`;
}

ACTIONS['new-user'] = async () => {
  const { users } = await api('/users?role=student&size=100');
  openModal('Yeni hesap', userForm(null, users));
};
ACTIONS['edit-user'] = async el => {
  const user = peopleCache.find(u => u.id === el.dataset.id);
  if (!user) return;
  const { users } = await api('/users?role=student&size=100');
  openModal('Hesabı düzenle', userForm(user, users));
};
CHANGES.roleToggle = el => $$('[data-for]').forEach(node => { node.hidden = node.dataset.for !== el.value; });

FORMS['new-user'] = async form => {
  const role = val(form, 'role');
  const body = { role, name: val(form, 'name'), username: val(form, 'username'), password: val(form, 'password'), email: val(form, 'email').trim() };
  if (role === 'student') {
    body.studentNo = val(form, 'studentNo');
    body.classId = val(form, 'classId') || null;
  } else if (role === 'parent') {
    body.childIds = checkedChildren(form);
  } else {
    body.teaching = checkedPairs(form);
  }
  await api('/users', { method: 'POST', body });
  closeModal();
  toast('Hesap oluşturuldu');
  refresh();
};

FORMS['edit-user'] = async form => {
  const body = { name: val(form, 'name'), email: val(form, 'email').trim() };
  if (form.dataset.role === 'student') {
    body.studentNo = val(form, 'studentNo');
    body.classId = val(form, 'classId');
  } else if (form.dataset.role === 'parent') {
    body.childIds = checkedChildren(form);
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
  if (u.role === 'parent') return `${(u.childIds || []).length} çocuk bağlı`;
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
    <td><div class="person"><span class="avatar sm ${tone(u.role)}">${esc(initials(u.name))}</span><div><strong>${esc(u.name)}</strong>${principal ? (u.email ? `<small class="person-mail">${esc(u.email)}</small>` : '<small class="person-mail none">E-posta yok</small>') : ''}${principal && u.username ? `<small class="cell-note">@${esc(u.username)}</small>` : ''}</div></div></td>
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
  const mailStatus = principal ? await api('/mail/status').catch(() => null) : null;
  const mailBanner = mailStatus && !mailStatus.configured
    ? '<div class="mail-warn"><strong>E-posta gönderimi kapalı.</strong> Şifre sıfırlama kodları gönderilemiyor. Render ortam değişkenlerinde SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS ve SMTP_FROM tanımlanmalı.</div>'
    : '';
  const actions = principal ? `<button class="btn ghost" type="button" data-action="mail-test">Test e-postası</button>
    <button class="btn ghost" type="button" data-action="deletion-open">Silme talepleri</button>
    <button class="btn ghost" type="button" data-action="import-open">${icon('plus')}<span>CSV ile ekle</span></button><a class="btn ghost" href="/api/export/users" download>${icon('download')}<span>CSV indir</span></a><button class="btn primary" type="button" data-action="new-user">${icon('plus')}<span>Yeni hesap</span></button>` : '';
  const option = (value, label) => `<option value="${value}" ${people.role === value ? 'selected' : ''}>${label}</option>`;
  return {
    html: `${head('Kişiler', principal ? 'Okul hesaplarını yönet: ekle, düzenle, şifre sıfırla.' : 'Sınıfınla ilgili kişiler ve iletişim.', actions)}${mailBanner}
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
          <thead><tr><th>Ad soyad</th><th>Rol</th><th>Sınıf / ders</th><th>Okul no</th><th><span class="sr-only">İşlemler</span></th></tr></thead>
          <tbody id="peopleBody"></tbody>
        </table></div>
        <div id="peoplePager"></div>
      </section>`,
    after: () => loadPeople().catch(e => toast(e.message, 'error')),
  };
}

// ---------- Toplu hesap ekleme (CSV) ----------
const IMPORT_TEMPLATE = [
  'ad_soyad;rol;kullanici_adi;parola;okul_no;sinif;ders_atamalari',
  'Örnek Öğrenci;öğrenci;ornek.ogrenci;;1001;6/A;',
  'Örnek Öğretmen;öğretmen;ornek.ogretmen;;;;6/A:Matematik|7/B:Türkçe',
].join('\n');

function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

let importCredentials = [];

ACTIONS['import-open'] = () => openModal('CSV ile toplu hesap ekleme', `
  <div class="stack">
    <p class="muted small">Dosyayı Excel'de hazırlayıp CSV olarak kaydedin. Sütunlar: ad_soyad, rol, kullanici_adi, parola, okul_no, sinif, ders_atamalari. Parolayı boş bırakırsanız güvenli bir parola üretilir ve size bir kez gösterilir. Önce önizleme yapılır; hatalı satır varsa hiçbir hesap eklenmez.</p>
    <div class="grid-2">
      <button class="btn ghost" type="button" data-action="import-template">${icon('download')}<span>Şablonu indir</span></button>
      <label class="btn ghost file-pick">${icon('plus')}<span>CSV dosyası seç</span><input type="file" accept=".csv,text/csv" data-change="importFile" hidden></label>
    </div>
    <label class="field"><span>CSV içeriği</span><textarea id="importText" rows="7" placeholder="ad_soyad;rol;kullanici_adi;parola;okul_no;sinif;ders_atamalari"></textarea></label>
    <div id="importPreview"></div>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions">
      <button class="btn ghost" type="button" data-action="import-preview">Önizle</button>
      <button class="btn primary" type="button" id="importCommit" data-action="import-commit" disabled>Hesapları ekle</button>
    </div>
  </div>`, { wide: true });

CHANGES.importFile = el => {
  const file = el.files[0];
  if (!file) return;
  if (file.size > 300 * 1024) { toast('Dosya 300 KB sınırını aşıyor.', 'error'); return; }
  file.text().then(text => { const box = document.querySelector('#importText'); if (box) box.value = text; });
};

ACTIONS['import-template'] = () => downloadText('okulum-hesap-sablonu.csv', IMPORT_TEMPLATE);

ACTIONS['import-preview'] = async () => {
  const csv = document.querySelector('#importText')?.value || '';
  if (!csv.trim()) throw new Error('Önce bir CSV dosyası seçin ya da içeriği yapıştırın.');
  const result = await api('/import/users', { method: 'POST', body: { csv, dryRun: true } });
  const rows = result.rows.map(row => `
    <tr class="${row.status === 'hata' ? 'row-error' : ''}">
      <td>${row.line}</td><td><strong>${esc(row.name)}</strong></td><td>${esc(row.username)}</td>
      <td>${badge(ROLE[row.role] || row.role, row.role === 'teacher' ? 'ok' : 'neutral')}</td>
      <td>${row.status === 'ok' ? badge('Uygun', 'ok') : badge('Hata', 'danger')}${row.generated ? ' <span class="small muted">parola üretilecek</span>' : ''}</td>
      <td><small>${esc(row.message)}</small></td>
    </tr>`).join('');
  document.querySelector('#importPreview').innerHTML = `
    <p class="import-summary"><strong>${result.okCount}</strong> uygun, <strong>${result.errorCount}</strong> hatalı satır.</p>
    <div class="table-wrap import-table"><table class="table"><thead><tr><th>Satır</th><th>Ad soyad</th><th>Kullanıcı adı</th><th>Rol</th><th>Durum</th><th>Mesaj</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const commit = document.querySelector('#importCommit');
  if (commit) commit.disabled = result.errorCount > 0 || result.okCount === 0;
};

ACTIONS['import-commit'] = async () => {
  const csv = document.querySelector('#importText')?.value || '';
  const result = await api('/import/users', { method: 'POST', body: { csv, dryRun: false } });
  const generated = result.credentials || [];
  const list = generated.length
    ? `<h3 class="sub-title">Üretilen parolalar (bir kez gösterilir)</h3>
       <div class="table-wrap"><table class="table"><thead><tr><th>Ad soyad</th><th>Kullanıcı adı</th><th>Parola</th></tr></thead>
       <tbody>${generated.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.username)}</td><td><code>${esc(c.password)}</code></td></tr>`).join('')}</tbody></table></div>
       <div class="form-actions"><button class="btn ghost" type="button" data-action="import-credentials">${icon('download')}<span>Parolaları CSV indir</span></button></div>`
    : '<p class="muted">Tüm parolalar dosyada belirtildi, üretilen parola yok.</p>';
  openModal('Hesaplar eklendi', `<div class="stack">
    <p class="import-summary"><strong>${result.created}</strong> hesap eklendi.</p>${list}
    <div class="form-actions"><button class="btn primary" type="button" data-action="import-done">Tamam</button></div>
  </div>`, { wide: true });
  importCredentials = generated;
};

ACTIONS['import-credentials'] = () => {
  const rows = importCredentials.map(c => [c.name, c.username, c.password].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
  downloadText('okulum-uretilen-parolalar.csv', ['ad_soyad;kullanici_adi;parola', ...rows].join('\r\n'));
};

ACTIONS['import-done'] = () => { closeModal(); refresh(); };

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
    <button class="btn ghost sm" type="button" data-action="email-open">E-posta adresi</button>
    ${state.me.role === 'principal' ? '<button class="btn ghost sm" type="button" data-action="mfa-open">İki adımlı doğrulama</button>' : ''}
    <button class="btn ghost sm" type="button" data-action="calendar-link">Takvim bağlantısı</button>
    <a class="btn ghost sm" href="/api/me/export" download>Verilerimi indir</a>
    ${state.me.role === 'principal' ? '' : '<button class="btn ghost sm" type="button" data-action="delete-request">Hesap silme talebi</button>'}
    <button class="btn ghost sm" type="button" data-action="notify-settings">Bildirim ayarları</button>
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
        ${b.assignedOnly ? badge('Atamalı', 'warn') : ''}${b.moderated ? badge('Onaylı', 'brand') : ''}
        ${b.className ? `<span class="muted small">${esc(b.className)}</span>` : ''}
      </div>
      <p class="pin-title">${esc(b.title)}</p>
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

const BOARD_LAYOUTS = [['grid', 'Izgara'], ['wall', 'Duvar (kartları sürükleyin)'], ['stream', 'Akış (tek sütun)']];
const BOARD_BACKGROUNDS = [['paper', 'Kağıt'], ['mint', 'Nane'], ['sky', 'Gök'], ['lilac', 'Leylak'], ['sun', 'Sarı'], ['dark', 'Koyu']];

function boardForm(board = null) {
  const role = state.me.role;
  const editing = Boolean(board);
  const classes = role === 'principal' ? state.classes : uniqueBy(state.teaching.map(t => ({ id: t.classId, name: t.className })), 'id');
  return `<form class="stack" data-form="${editing ? 'board-edit' : 'board-create'}" ${editing ? `data-id="${esc(board.id)}"` : ''}>
    <label class="field"><span>Pano adı</span><input name="title" required minlength="2" maxlength="120" value="${esc(board?.title || '')}"></label>
    <label class="field"><span>Açıklama</span><textarea name="description" rows="2" maxlength="500">${esc(board?.description || '')}</textarea></label>
    ${editing && board.scope !== 'class' ? '' : `
      <div class="toggle-stack" ${editing ? '' : 'data-for-scope="class"'}>
        <label class="switch"><input type="checkbox" name="assignedOnly" ${board?.assignedOnly ? 'checked' : ''}><span class="switch-ui" aria-hidden="true"></span>
          <span><strong>Yalnızca atanan öğrenciler not eklesin</strong><small>Öğrencileri pano ayarlarından siz seçersiniz. Öğretmen ve müdür her zaman ekleyebilir.</small></span></label>
        <label class="switch"><input type="checkbox" name="moderated" ${board?.moderated ? 'checked' : ''}><span class="switch-ui" aria-hidden="true"></span>
          <span><strong>Öğrenci notları onaylansın</strong><small>Öğrenci notu siz onaylayana kadar yalnızca yazarın ekranında görünür.</small></span></label>
      </div>`}
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
    <div class="grid-2">
      <label class="field"><span>Düzen</span>
        <select name="layout">${BOARD_LAYOUTS.map(([value, label]) => `<option value="${value}" ${(board?.layout || 'grid') === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label class="field"><span>Arka plan</span>
        <select name="background">${BOARD_BACKGROUNDS.map(([value, label]) => `<option value="${value}" ${(board?.background || 'paper') === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    </div>
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

// Öğrenci atama: sınıftaki öğrenciler listelenir, işaretlenenler panoya not ekleyebilir.
ACTIONS['board-members-open'] = async () => {
  if (!currentBoard) return;
  const { students } = await api(`/boards/${currentBoard.id}/members`);
  const list = students.length
    ? students.map(st => `<label class="member-row">
        <input type="checkbox" name="student" value="${esc(st.id)}" ${st.assigned ? 'checked' : ''}>
        <span class="avatar sm blue">${esc(initials(st.name))}</span>
        <span><strong>${esc(st.name)}</strong><small class="muted">${esc(st.studentNo || '')}</small></span>
      </label>`).join('')
    : empty('Öğrenci yok', 'Bu sınıfa henüz öğrenci eklenmemiş.');
  openModal('Öğrencileri ata', `<form class="stack" data-form="board-members" data-id="${esc(currentBoard.id)}">
    <p class="muted small">${currentBoard.assignedOnly
      ? 'İşaretli öğrenciler bu panoya not ekleyebilir.'
      : 'Bu pano atamalı değil: "Yalnızca atanan öğrenciler not eklesin" açılırsa yalnızca işaretliler ekleyebilir.'}</p>
    <div class="member-list">${list}</div>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button>
      <button class="btn primary" type="submit">Atamaları kaydet</button></div>
  </form>`);
};

FORMS['board-members'] = async form => {
  const studentIds = [...form.querySelectorAll('input[name=student]:checked')].map(input => input.value);
  await api(`/boards/${form.dataset.id}/members`, { method: 'PUT', body: { studentIds } });
  closeModal();
  toast(`${studentIds.length} öğrenci atandı`);
  refresh();
};

ACTIONS['note-approve'] = async el => {
  await api(`/board-notes/${el.dataset.id}`, { method: 'PATCH', body: { approved: true } });
  toast('Not onaylandı');
  refresh();
};
ACTIONS['board-edit-open'] = () => currentBoard && openModal('Panoyu düzenle', boardForm(currentBoard));

FORMS['board-create'] = async form => {
  const scope = val(form, 'scope');
  const body = { title: val(form, 'title').trim(), description: val(form, 'description').trim(), scope, layout: val(form, 'layout'), background: val(form, 'background') };
  if (scope === 'class') {
    body.classId = val(form, 'classId');
    body.assignedOnly = form.querySelector('[name=assignedOnly]')?.checked === true;
    body.moderated = form.querySelector('[name=moderated]')?.checked === true;
  }
  const { id } = await api('/boards', { method: 'POST', body });
  closeModal();
  toast('Pano açıldı');
  setQuery('pano', { id });
};

FORMS['board-edit'] = async form => {
  const body = { title: val(form, 'title').trim(), description: val(form, 'description').trim(), layout: val(form, 'layout'), background: val(form, 'background') };
  if (form.querySelector('[name=assignedOnly]')) {
    body.assignedOnly = form.querySelector('[name=assignedOnly]').checked;
    body.moderated = form.querySelector('[name=moderated]').checked;
  }
  await api(`/boards/${form.dataset.id}`, { method: 'PATCH', body });
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

let currentNotes = [];
let currentOpenNote = null;

async function pageBoard(params) {
  if (!params.id) return { html: `${head('Pano')}${panel('Pano', '', empty('Pano seçilmedi', 'Panolar sayfasından bir pano seçin.'))}` };
  const { board, notes } = await api(`/boards/${encodeURIComponent(params.id)}/notes`);
  currentBoard = board;
  currentNotes = notes;
  const rights = board.rights;
  const actions = [
    rights.post ? `<button class="btn primary" type="button" data-action="note-new" data-id="${esc(board.id)}">${icon('plus')}<span>Not ekle</span></button>` : '',
    rights.moderate && board.scope === 'class' ? `<button class="btn ghost" type="button" data-action="board-members-open">Öğrencileri ata</button>` : '',
    rights.moderate ? `<button class="btn ghost" type="button" data-action="board-edit-open">Düzenle</button>
      <button class="btn ghost" type="button" data-action="board-delete" data-id="${esc(board.id)}">${icon('trash')}<span>Panoyu sil</span></button>` : '',
    '<a class="btn ghost" href="#/panolar">← Panolar</a>',
  ].join('');
  const isImage = n => ['image/png', 'image/jpeg'].includes(n.fileMime);
  const layout = board.layout || 'grid';
  const background = `bg-${board.background || 'paper'}`;
  const autoX = index => 20 + (index % 4) * 250;
  const autoY = index => 20 + Math.floor(index / 4) * 200;
  const cardPos = (n, index) => (layout === 'wall'
    ? ` data-x="${n.posX ?? autoX(index)}" data-y="${n.posY ?? autoY(index)}"`
    : '');
  const cards = notes.map((n, index) => `
    <article class="pin pin-${esc(n.color)}${n.approved === false ? ' pin-pending' : ''}${layout === 'wall' && n.canMove ? ' pin-movable' : ''}" data-note="${esc(n.id)}"${cardPos(n, index)}${rights.moderate && layout !== 'wall' ? ' draggable="true"' : ''}>
      ${n.hasFile && isImage(n) ? `<img class="pin-img" src="/api/files/board-note/${esc(n.id)}?inline=1" alt="${esc(n.fileName || 'Pano resmi')}" loading="lazy" decoding="async">` : ''}
      ${n.pinned ? '<span class="badge pin-badge">Sabit</span>' : ''}
      ${n.title ? `<p class="pin-title">${esc(n.title)}</p>` : ''}
      ${n.body ? `<div class="md">${renderMarkdown(n.body)}</div>` : ''}
      ${n.link ? `<span class="badge media-badge">${esc(platformOf(n.link))}</span>` : ''}
      ${n.link ? `<a class="note-link" href="${esc(n.link)}" target="_blank" rel="noopener noreferrer">${icon('send')}<span>${esc(n.link.replace(/^https?:\/\//, '').slice(0, 60))}</span></a>` : ''}
      ${n.hasFile && n.fileMime === 'application/pdf' ? `<iframe class="pin-pdf" src="/api/files/board-note/${esc(n.id)}?inline=1" title="${esc(n.fileName || 'PDF')}" loading="lazy"></iframe>` : ''}
      ${n.hasFile ? `<a class="note-link" href="/api/files/board-note/${esc(n.id)}" download>${icon('download')}<span>${esc(n.fileName)}</span></a>` : ''}
      ${n.approved === false ? '<span class="badge warn">Onay bekliyor</span>' : ''}
      <footer class="note-foot">
        <span>${esc(n.authorName || 'Silinmiş kullanıcı')} · ${esc(ROLE[n.authorRole] || '')} · ${esc(fmtDate(n.createdAt))}</span>
        <span class="note-actions">
          ${rights.moderate && layout !== 'wall' ? `<span class="order-btns"><button class="icon-btn sm" type="button" data-action="note-up" data-id="${esc(n.id)}" aria-label="Notu yukarı taşı">▲</button><button class="icon-btn sm" type="button" data-action="note-down" data-id="${esc(n.id)}" aria-label="Notu aşağı taşı">▼</button></span>` : ''}
          ${n.canPin ? `<button class="btn ghost sm" type="button" data-action="note-pin" data-id="${esc(n.id)}" data-pinned="${n.pinned ? '1' : '0'}">${n.pinned ? 'Sabiti kaldır' : 'Sabitle'}</button>` : ''}
          <button class="btn ghost sm" type="button" data-action="note-expand" data-id="${esc(n.id)}">Büyüt</button>
          <button class="pin-like${n.likedByMe ? ' on' : ''}" type="button" data-action="note-like" data-id="${esc(n.id)}" aria-pressed="${n.likedByMe ? 'true' : 'false'}" aria-label="Beğen">♥ <b>${n.likeCount}</b></button>
          <button class="pin-comments" type="button" data-action="pin-comments-open" data-id="${esc(n.id)}">Yorum <b>${n.commentCount}</b></button>
          ${n.canApprove ? `<button class="btn ghost sm" type="button" data-action="note-approve" data-id="${esc(n.id)}">Onayla</button>` : ''}
          ${n.canDelete ? `<button class="icon-btn sm" type="button" data-action="note-delete" data-id="${esc(n.id)}" aria-label="Notu sil">${icon('trash')}</button>` : ''}
        </span>
      </footer>
    </article>`).join('');
  const wallHeight = layout === 'wall'
    ? Math.max(520, ...notes.map((n, index) => (n.posY ?? autoY(index)) + 230)) + 40
    : 0;
  const surface = layout === 'wall'
    ? `<div class="pad-wall ${background}" data-wall data-height="${wallHeight}">${cards}</div>`
    : layout === 'stream'
      ? `<div class="pad-stream ${background}">${cards}</div>`
      : `<div class="pin-grid pad-surface ${background}">${cards}</div>`;
  const pending = rights.pendingCount
    ? `<div class="pending-banner" role="status">${rights.pendingCount} öğrenci notu onayınızı bekliyor.</div>` : '';
  const assignNotice = board.assignedOnly && !rights.post
    ? '<p class="notice">Bu panoya yalnızca öğretmeninin atadığı öğrenciler not ekleyebilir.</p>' : '';
  return {
    html: `
    ${head(board.title, `${scopeLabel(board.scope)}${board.className ? ` · ${board.className}` : ''}${board.description ? ` — ${board.description}` : ''}`, actions)}
    ${assignNotice}${pending}
    ${notes.length
      ? surface
      : empty('Henüz not yok', rights.post ? 'İlk notu ekleyerek panoyu başlatın.' : 'Bu pano için henüz not eklenmedi.')}`,
    after: () => { setupWall(); setupReorder(); },
  };
}

// Akış ve ızgarada kartı sürükleyip başka kartın üzerine bırakarak sıralama (yalnızca yönetici)
function setupReorder() {
  const container = document.querySelector('.pad-stream, .pad-surface');
  if (!container || container.dataset.reorder) return;
  container.dataset.reorder = '1';
  let dragging = null;
  container.addEventListener('dragstart', event => {
    const card = event.target.closest('.pin[draggable=true]');
    if (!card) return;
    dragging = card.dataset.note;
    card.classList.add('pin-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', dragging);
  });
  container.addEventListener('dragover', event => {
    if (!dragging) return;
    const card = event.target.closest('.pin');
    if (!card) return;
    event.preventDefault();
    container.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    card.classList.add('drop-target');
  });
  container.addEventListener('dragend', () => {
    dragging = null;
    container.querySelectorAll('.pin-dragging, .drop-target').forEach(el => el.classList.remove('pin-dragging', 'drop-target'));
  });
  container.addEventListener('drop', async event => {
    if (!dragging) return;
    const target = event.target.closest('.pin');
    event.preventDefault();
    if (!target || target.dataset.note === dragging) return;
    const ids = currentNotes.map(n => n.id);
    const from = ids.indexOf(dragging);
    ids.splice(from, 1);
    ids.splice(ids.indexOf(target.dataset.note), 0, dragging);
    dragging = null;
    await saveNoteOrder(ids);
  });
}

// Duvar düzeninde kartları sürükleyerek yerleştirme; yeni konum sunucuya kaydedilir
function setupWall() {
  const wall = document.querySelector('[data-wall]');
  if (!wall || wall.dataset.ready) return;
  wall.dataset.ready = '1';
  // Konumları ve yüksekliği CSP uyumlu şekilde, sayfa yüklendikten sonra uygula
  wall.style.height = `min(78vh, ${wall.dataset.height}px)`;
  wall.querySelectorAll('.pin').forEach(card => {
    card.style.left = `${card.dataset.x}px`;
    card.style.top = `${card.dataset.y}px`;
  });
  let drag = null;
  wall.addEventListener('pointerdown', event => {
    const card = event.target.closest('.pin-movable');
    if (!card || event.target.closest('button, a, input, textarea, select')) return;
    const rect = card.getBoundingClientRect();
    drag = { card, id: card.dataset.note, dx: event.clientX - rect.left, dy: event.clientY - rect.top, startX: event.clientX, startY: event.clientY, moved: false };
    card.setPointerCapture(event.pointerId);
  });
  wall.addEventListener('pointermove', event => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
    if (!drag.moved) drag.card.classList.add('pin-dragging');
    drag.moved = true;
    const wallRect = wall.getBoundingClientRect();
    drag.x = Math.max(0, Math.round(event.clientX - wallRect.left - drag.dx + wall.scrollLeft));
    drag.y = Math.max(0, Math.round(event.clientY - wallRect.top - drag.dy + wall.scrollTop));
    drag.card.style.left = `${drag.x}px`;
    drag.card.style.top = `${drag.y}px`;
  });
  const finish = async () => {
    if (!drag) return;
    const current = drag;
    drag = null;
    current.card.classList.remove('pin-dragging');
    if (!current.moved) return;
    try {
      await api(`/board-notes/${current.id}/position`, { method: 'PATCH', body: { x: current.x, y: current.y } });
      const note = currentNotes.find(n => n.id === current.id);
      if (note) { note.posX = current.x; note.posY = current.y; }
    } catch (error) {
      toast(error.message, 'error');
      refresh();
    }
  };
  wall.addEventListener('pointerup', finish);
  wall.addEventListener('pointercancel', finish);
}

// Bağlantının türü: video ve paylaşım platformları için okunur bir etiket (dış içerik yüklenmez)
function platformOf(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com')) return 'YouTube videosu';
    if (host === 'vimeo.com' || host.endsWith('.vimeo.com')) return 'Vimeo videosu';
    if (host === 'drive.google.com') return 'Google Drive';
    if (host === 'docs.google.com') return 'Google Dokümanlar';
    return host;
  } catch {
    return 'Bağlantı';
  }
}

// Sıralama: komşu notla yer değiştirir ve tüm pano sırası kaydedilir
async function saveNoteOrder(ids) {
  await api(`/boards/${currentBoard.id}/order`, { method: 'PATCH', body: { ids } });
  refresh();
}

function moveNote(noteId, step) {
  const ids = currentNotes.map(n => n.id);
  const index = ids.indexOf(noteId);
  const target = index + step;
  if (index < 0 || target < 0 || target >= ids.length) return null;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  return ids;
}

ACTIONS['note-up'] = async el => {
  const ids = moveNote(el.dataset.id, -1);
  if (ids) await saveNoteOrder(ids);
};

ACTIONS['note-down'] = async el => {
  const ids = moveNote(el.dataset.id, 1);
  if (ids) await saveNoteOrder(ids);
};

ACTIONS['note-pin'] = async el => {
  const pinned = el.dataset.pinned !== '1';
  await api(`/board-notes/${el.dataset.id}/pin`, { method: 'PATCH', body: { pinned } });
  toast(pinned ? 'Not sabitlendi' : 'Sabit kaldırıldı');
  refresh();
};

ACTIONS['note-expand'] = el => {
  const note = currentNotes.find(n => n.id === el.dataset.id);
  if (!note) return;
  const media = [
    note.hasFile && ['image/png', 'image/jpeg'].includes(note.fileMime)
      ? `<img class="expand-img" src="/api/files/board-note/${esc(note.id)}?inline=1" alt="${esc(note.fileName || 'Pano resmi')}">` : '',
    note.hasFile && note.fileMime === 'application/pdf'
      ? `<iframe class="expand-pdf" src="/api/files/board-note/${esc(note.id)}?inline=1" title="${esc(note.fileName || 'PDF')}"></iframe>` : '',
  ].join('');
  openModal(note.title || 'Not', `<div class="stack expand">
    ${media}
    ${note.body ? `<div class="note-preview md">${renderMarkdown(note.body)}</div>` : ''}
    ${note.link ? `<a class="btn ghost" href="${esc(note.link)}" target="_blank" rel="noopener noreferrer">${esc(platformOf(note.link))} · Aç</a>` : ''}
    ${note.hasFile ? `<a class="btn ghost" href="/api/files/board-note/${esc(note.id)}" download>Dosyayı indir</a>` : ''}
  </div>`);
};

ACTIONS['note-like'] = async el => {
  const data = await api(`/board-notes/${el.dataset.id}/like`, { method: 'POST' });
  el.classList.toggle('on', data.liked);
  el.setAttribute('aria-pressed', String(data.liked));
  el.querySelector('b').textContent = data.likeCount;
};

async function openNote(id) {
  currentOpenNote = id;
  const { comments } = await api(`/board-notes/${id}/comments`);
  const note = currentNotes.find(n => n.id === id);
  const items = comments.map(c => `<li class="list-row${c.approved ? '' : ' comment-pending'}"><div class="list-main"><strong>${esc(c.authorName || 'Silinmiş kullanıcı')}</strong>
      ${c.approved ? '' : '<span class="badge warn">Onay bekliyor</span>'}
      <small class="muted">${esc(fmtDate(c.createdAt))}</small><p>${esc(c.body)}</p></div>
      <span class="note-actions">
        ${c.canApprove ? `<button class="btn ghost sm" type="button" data-action="comment-approve" data-id="${esc(c.id)}">Onayla</button>` : ''}
        ${c.canDelete ? `<button class="icon-btn sm" type="button" data-action="comment-delete" data-id="${esc(c.id)}" aria-label="Yorumu sil">${icon('trash')}</button>` : ''}
      </span></li>`).join('');
  openModal(note?.title || 'Not', `<div class="stack">
    ${note?.body ? `<p class="note-preview">${esc(note.body)}</p>` : ''}
    <ul class="list comment-list">${items || '<li class="muted">Henüz yorum yok.</li>'}</ul>
    <form class="stack" data-form="note-comment" data-id="${esc(id)}">
      <label class="field"><span>Yorum yaz</span><textarea name="body" rows="2" maxlength="500" required></textarea></label>
      <p class="form-error" data-error role="alert"></p>
      <div class="form-actions"><button class="btn primary" type="submit">Yorum yap</button></div>
    </form></div>`);
}

ACTIONS['pin-comments-open'] = el => openNote(el.dataset.id);

FORMS['note-comment'] = async form => {
  const result = await api(`/board-notes/${form.dataset.id}/comments`, { method: 'POST', body: { body: val(form, 'body').trim() } });
  toast(result.approved === false ? 'Yorumunuz öğretmen onayından sonra görünecek' : 'Yorum eklendi');
  await openNote(form.dataset.id);
  refresh();
};

ACTIONS['comment-approve'] = async el => {
  await api(`/board-note-comments/${el.dataset.id}`, { method: 'PATCH', body: { approved: true } });
  toast('Yorum onaylandı');
  await openNote(currentOpenNote);
  refresh();
};

ACTIONS['comment-delete'] = async el => {
  await api(`/board-note-comments/${el.dataset.id}`, { method: 'DELETE' });
  toast('Yorum silindi');
  await openNote(currentOpenNote);
  refresh();
};

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
      <input name="file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"><small>Resim (JPG, PNG) notta önizleme olarak görünür. PDF ve Word de eklenebilir · en fazla 5 MB</small></label>
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
  board_created: 'Pano açıldı', board_deleted: 'Pano silindi', board_note_deleted: 'Pano notu silindi', ai_logs_viewed: 'Asistan kaydı görüntülendi', users_imported: 'Toplu hesap eklendi', quiz_created: 'Sınav oluşturuldu', quiz_deleted: 'Sınav silindi',
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

// ---------- Okulum Asistanı ----------
const AI_SUGGESTIONS = {
  student: ['Bu siteyi nasıl kullanırım?', 'Bir konuyu anlamakta zorlanıyorum, yol gösterir misin?', 'Ödevimi nasıl planlayabilirim?'],
  teacher: ['5. sınıf kesirler konusu için 5 çoktan seçmeli soru hazırla', 'Ödev yönergesi için kısa bir taslak yaz', 'Veli toplantısı için bilgilendirme mesajı taslağı yaz'],
  principal: ['Okul panosu için kayıt dönemi duyurusu yaz', 'Yeni öğretmenler için site kullanım adımlarını özetle', 'Devamsızlık uyarılarında hangi adımları izlemeliyim?'],
};
const AI_INTRO = {
  student: 'Merhaba! Ben Okulum Asistanı. Siteyi nasıl kullanacağını anlatabilir, konuları adım adım açıklayabilirim. Ödevlerin cevabını vermem; seni düşünmeye yönlendiririm.',
  teacher: 'Merhaba! Ben Okulum Asistanı. Ders planı, soru örnekleri, ödev yönergesi ve veli mesajı taslakları hazırlamanıza yardımcı olabilirim. Öğrencilerin kişisel bilgilerini yazmayın.',
  principal: 'Merhaba! Ben Okulum Asistanı. Duyuru ve okul panosu metinleri, site kullanımı ve yönetim süreçleri için yardımcı olabilirim. Kişisel bilgi yazmayın.',
};

const aiBubble = (role, text, time) => role === 'user'
  ? `<div class="bubble mine"><p>${esc(text)}</p>${time ? `<time>${esc(fmtDate(time))}</time>` : ''}</div>`
  : `<div class="bubble ai"><span class="who">Okulum Asistanı</span><div class="md">${renderMarkdown(text)}</div>${time ? `<time>${esc(fmtDate(time))}</time>` : ''}</div>`;

const aiConsentView = notice => `
  <section class="panel ai-gate">
    <div class="pad">
      <p class="kicker">Kullanım bildirimi</p>
      <h2 class="ai-gate-title">${esc(notice.title)}</h2>
      <p class="muted">${esc(notice.intro)}</p>
      <div class="ai-sections">${notice.sections.map(section => `
        <article class="ai-section"><h3>${esc(section.title)}</h3><p>${esc(section.text)}</p></article>`).join('')}</div>
      <form class="stack mt" data-form="ai-consent" data-version="${esc(notice.version)}">
        <label class="switch">
          <input type="checkbox" name="accept">
          <span class="switch-ui" aria-hidden="true"></span>
          <span><strong>Bildirimi okudum ve kabul ediyorum.</strong>
            <small>Onay vermeden asistanı kullanamam. Rızamı istediğim zaman okul müdürüme başvurarak geri çekebilirim.</small></span>
        </label>
        <p class="form-error" data-error role="alert"></p>
        <div class="form-actions"><button class="btn primary lg" type="submit">Kabul ediyorum, asistana geç</button></div>
      </form>
    </div>
  </section>`;

FORMS['ai-consent'] = async form => {
  if (!form.querySelector('[name=accept]').checked) throw new Error('Devam etmek için bildirimi kabul kutusunu işaretleyin.');
  await api('/ai/consent', { method: 'POST', body: { version: form.dataset.version } });
  toast('Teşekkürler. Asistanı kullanabilirsiniz.');
  refresh();
};

ACTIONS['ai-notice'] = async () => {
  const status = await api('/ai/status');
  openModal(status.notice.title, `<div class="ai-sections">${status.notice.sections.map(section => `
    <article class="ai-section"><h3>${esc(section.title)}</h3><p>${esc(section.text)}</p></article>`).join('')}</div>`, { wide: true });
};

ACTIONS['ai-suggest'] = el => {
  const input = document.querySelector('form[data-form=ai-chat] [name=message]');
  if (!input) return;
  input.value = el.dataset.text;
  input.focus();
};

ACTIONS['ai-new'] = () => setQuery('asistan', {});
ACTIONS['page-ai-logs'] = el => setQuery('asistan', { ...parseHash().params, page: el.dataset.page });

// Mesajı akış (SSE) ile gönderir: yanıt parça parça gelir ve balonda Markdown olarak biçimlenir.
FORMS['ai-chat'] = async form => {
  const input = form.querySelector('[name=message]');
  const message = input.value.trim();
  const conversationId = val(form, 'conversationId') || null;
  if (!message) return;
  input.value = '';
  const box = document.querySelector('#aiMsgs');
  let userBubble = null;
  let pending = null;
  if (box) {
    box.querySelector('.ai-intro')?.remove();
    box.insertAdjacentHTML('beforeend', aiBubble('user', message));
    userBubble = box.lastElementChild;
    box.insertAdjacentHTML('beforeend', '<div class="bubble ai is-typing"><span class="who">Okulum Asistanı</span><div class="md"><span class="typing" aria-label="Yazıyor"><i></i><i></i><i></i></span></div></div>');
    pending = box.lastElementChild;
    box.scrollTop = box.scrollHeight;
  }
  let reply = '';
  let done = null;
  try {
    const res = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, conversationId }),
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Asistan şu an yanıt veremiyor.');
    }
    const md = pending?.querySelector('.md');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      buffer += decoder.decode(value, { stream: true });
      let cut = buffer.indexOf('\n\n');
      while (cut >= 0) {
        const block = buffer.slice(0, cut);
        buffer = buffer.slice(cut + 2);
        cut = buffer.indexOf('\n\n');
        const event = (block.match(/^event: (.+)$/m) || [])[1];
        const dataLine = block.match(/^data: (.+)$/m);
        const data = dataLine ? JSON.parse(dataLine[1]) : {};
        if (event === 'delta') {
          reply += data.text;
          if (md) { md.innerHTML = renderMarkdown(reply); box.scrollTop = box.scrollHeight; }
        } else if (event === 'error') {
          throw new Error(data.message);
        } else if (event === 'done') {
          done = data;
        }
      }
    }
    if (!done) throw new Error('Yanıt tamamlanamadı. Lütfen tekrar deneyin.');
  } catch (error) {
    pending?.remove();
    userBubble?.remove();
    input.value = message;
    throw error;
  }
  if (!conversationId) { setQuery('asistan', { c: done.conversationId }); return; }
  pending?.classList.remove('is-typing');
  const status = await api('/ai/status');
  const remain = document.querySelector('#aiRemain');
  if (remain) remain.textContent = `Bugün kalan soru: ${status.remaining} / ${status.limit}`;
};

async function pageAsistan(params) {
  const status = await api('/ai/status');
  const principal = state.me.role === 'principal';
  const logsView = principal && params.view === 'logs';
  const actions = principal
    ? `<a class="btn ghost" href="#/asistan${logsView ? '' : '?view=logs'}">${logsView ? '← Sohbetlerim' : 'Sohbet kayıtları'}</a>`
    : '';
  const header = head('Okulum Asistanı', 'Site kullanımı, ders konuları ve öğretim fikirleri için yardımcı. Ödevlerin cevabını vermez, yönlendirir.', actions);

  if (logsView) return aiLogsView(header, params);
  if (!status.enabled) {
    return { html: `${header}${panel('Asistan', '', empty('Asistan henüz etkin değil', 'Okul yöneticisi asistanı etkinleştirmek için yapay zekâ anahtarını tanımlamalı.'))}` };
  }
  if (!status.accepted) return { html: `${header}${aiConsentView(status.notice)}` };

  const { conversations } = await api('/ai/conversations');
  const activeId = params.c && conversations.some(c => c.id === params.c) ? params.c : null;
  const detail = activeId ? await api(`/ai/conversations/${activeId}/messages`) : null;
  const suggestions = AI_SUGGESTIONS[state.me.role] || AI_SUGGESTIONS.student;
  const intro = `<div class="bubble ai ai-intro"><span class="who">Okulum Asistanı</span><p>${esc(AI_INTRO[state.me.role] || AI_INTRO.student)}</p></div>`;
  const messages = detail ? detail.messages.map(m => aiBubble(m.role, m.content, m.createdAt)).join('') : intro;

  return { html: `
    ${header}
    <div class="ai-banner" role="note">
      <span>${icon('check')}<span>Bu sohbet kaydedilir ve 180 gün sonra silinir. Kişisel bilgi yazmayın.</span></span>
      <button class="link" type="button" data-action="ai-notice">Bildirimi oku</button>
    </div>
    <section class="chat">
      <div>
        <div class="room-head"><div><strong>Sohbetlerim</strong><small class="muted">${conversations.length} sohbet</small></div>
          <button class="btn ghost sm" type="button" data-action="ai-new">${icon('plus')}<span>Yeni</span></button></div>
        <ul class="conv-list">${conversations.map(c => `
          <li><a class="conv ${c.id === activeId ? 'active' : ''}" href="#/asistan?c=${esc(c.id)}">
            <span class="avatar sm">AI</span>
            <span class="conv-copy"><strong>${esc(c.title)}</strong><small>${c.messageCount} mesaj · ${esc(fmtDate(c.updatedAt))}</small></span>
          </a></li>`).join('') || `<li class="empty-inline">Henüz sohbet yok</li>`}</ul>
      </div>
      <div class="room">
        <div class="room-head">
          <span class="avatar sm">AI</span>
          <div><strong>Okulum Asistanı</strong><small class="muted" id="aiRemain">Bugün kalan soru: ${status.remaining} / ${status.limit}</small></div>
        </div>
        <div class="room-body" id="aiMsgs">${messages}</div>
        ${activeId ? '' : `<div class="ai-chips">${suggestions.map(text => `<button class="ai-chip" type="button" data-action="ai-suggest" data-text="${esc(text)}">${esc(text)}</button>`).join('')}</div>`}
        <form class="composer" data-form="ai-chat">
          <input type="hidden" name="conversationId" value="${esc(activeId || '')}">
          <input name="message" maxlength="2000" placeholder="Sorunuzu yazın…" autocomplete="off" required aria-label="Asistana soru">
          <button class="btn primary" type="submit">${icon('send')}<span>Gönder</span></button>
        </form>
        <p class="ai-foot muted small">Asistan hata yapabilir. Önemli konularda öğretmeninize danışın.</p>
      </div>
    </section>` };
}

async function aiLogsView(header, params) {
  const page = Math.max(1, Number(params.page) || 1);
  const { conversations, total, size } = await api(`/ai/logs?page=${page}&size=25`);
  const activeId = params.c && conversations.some(c => c.id === params.c) ? params.c : null;
  const detail = activeId ? await api(`/ai/conversations/${activeId}/messages`) : null;
  return { html: `
    ${header}
    <div class="ai-banner" role="note"><span>${icon('check')}<span>Sohbetler salt okunur gösterilir. Her görüntüleme denetim kaydına yazılır.</span></span></div>
    <section class="chat">
      <div>
        <ul class="conv-list">${conversations.map(c => `
          <li><a class="conv ${c.id === activeId ? 'active' : ''}" href="#/asistan?view=logs&c=${esc(c.id)}">
            <span class="avatar sm ${tone(c.userRole)}">${esc(initials(c.userName))}</span>
            <span class="conv-copy"><strong>${esc(c.userName)} · ${esc(ROLE[c.userRole] || '')}</strong>
              <small>${esc(c.title)} · ${c.messageCount} mesaj</small></span>
          </a></li>`).join('') || `<li class="empty-inline">Kayıt yok</li>`}</ul>
        ${pager(total, page, size, 'page-ai-logs')}
      </div>
      <div class="room">
        ${detail
          ? `<div class="room-head"><div><strong>${esc(detail.conversation.title)}</strong><small class="muted">${esc(detail.conversation.userName)} · salt okunur</small></div></div>
             <div class="room-body">${detail.messages.map(m => aiBubble(m.role, m.content, m.createdAt)).join('')}</div>`
          : empty('Bir sohbet seçin', 'Soldaki listeden bir sohbet seçerek içeriğini görebilirsiniz.')}
      </div>
    </section>` };
}

// ---------- Grafikler (CSS çubukları) ----------
const barRows = (items, { suffix = '%', emptyText = 'Veri yok' } = {}) => items.length
  ? `<div class="bar-rows">${items.map(item => `
      <div class="bar-row">
        <span class="bar-label" title="${esc(item.label)}">${esc(item.label)}</span>
        <div class="bar-track" role="img" aria-label="${esc(item.label)}: ${esc(item.value ?? 0)}${suffix}"><i data-w="${Math.max(0, Math.min(100, Number(item.value) || 0))}"></i></div>
        <b class="bar-value">${item.value === null || item.value === undefined ? '—' : `${esc(item.value)}${suffix}`}</b>
      </div>`).join('')}</div>`
  : `<p class="muted small">${esc(emptyText)}</p>`;

const distributionRows = bins => {
  const max = Math.max(1, ...bins.map(b => b.count));
  return `<div class="dist">${bins.map(b => `
    <div class="dist-col"><div class="dist-bar"><i data-h="${Math.round((b.count / max) * 100)}"></i></div>
      <b>${b.count}</b><span>${esc(b.label)}</span></div>`).join('')}</div>`;
};

// ---------- Veli ----------
async function pageParentOverview() {
  const { children } = await api('/parent/children');
  const cards = children.map(c => {
    const rate = pct(c.present, c.total);
    return `<a class="child-card" href="#/cocuklar?id=${esc(c.id)}">
      <span class="avatar green">${esc(initials(c.name))}</span>
      <div><strong>${esc(c.name)}</strong><small class="muted">${esc(c.className || 'Sınıfsız')} · ${esc(c.studentNo || '')}</small></div>
      <span class="child-rate">${rate === null ? 'Devam yok' : `%${rate} devam`}</span>
    </a>`;
  }).join('');
  return { html: `
    ${head(`Merhaba, ${firstName(state.me.name)}`, 'Çocuklarınızın ödev, not ve devam durumunu buradan izleyin.')}
    ${children.length ? `<div class="child-grid">${cards}</div>`
      : panel('Çocuklarım', '', empty('Bağlı öğrenci yok', 'Okul müdürünüz hesabınıza çocuğunuzu bağladığında burada görünür.'))}
    ${panel('Hızlı erişim', '', quick([['#/cocuklar', 'Çocuklarım', 'user'], ['#/messages', 'Mesajlar', 'chat'], ['#/asistan', 'Asistan', 'spark']]))}` };
}

async function pageCocuklar(params) {
  const { children } = await api('/parent/children');
  if (!children.length) return { html: `${head('Çocuklarım')}${panel('Çocuklarım', '', empty('Bağlı öğrenci yok', 'Okul müdürünüz çocuğunuzu hesabınıza bağladığında burada görünür.'))}` };
  const childId = children.some(c => c.id === params.id) ? params.id : children[0].id;
  const data = await api(`/parent/children/${childId}`);
  const behavior = await api(`/behavior/student/${childId}`);
  const sharedNotes = (await api(`/student-notes?studentId=${childId}`)).notes;
  const switcher = children.length > 1
    ? `<select data-change="childSwitch" aria-label="Çocuk seç">${children.map(c => `<option value="${esc(c.id)}" ${c.id === childId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : '';
  const grades = data.grades.subjects.map(sub => ({ label: sub.subjectName, value: sub.average }));
  const attendance = data.attendance.subjects.map(sub => ({ label: sub.subjectName, value: pct(sub.present, sub.total) }));
  const assignmentRows = data.assignments.map(a => `<tr>
    <td><strong>${esc(a.title)}</strong><small class="cell-note">${esc(a.subjectName)}</small></td>
    <td>${esc(fmtDate(a.dueAt))}</td>
    <td>${a.grade ? badge(`Not: ${a.grade}`, 'ok') : a.submittedAt ? badge('Teslim edildi') : isPast(a.dueAt) ? badge('Teslim yok', 'danger') : badge('Bekliyor', 'warn')}</td>
    <td><small>${esc(a.feedback || '')}</small></td></tr>`).join('');
  const quizRows = data.quizzes.map(z => `<tr>
    <td><strong>${esc(z.title)}</strong><small class="cell-note">${esc(z.subjectName)}</small></td>
    <td>${z.submittedAt ? `${z.score} / ${z.maxScore}` : '—'}</td>
    <td>${z.submittedAt ? badge('Tamamlandı', 'ok') : isPast(z.closesAt) ? badge('Girilmedi', 'danger') : badge('Açık', 'warn')}</td></tr>`).join('');
  return { html: `
    ${head(data.child.name, `${data.child.className || 'Sınıfsız'} · ${data.child.studentNo || ''}`,
      `${switcher}<a class="btn ghost" href="#/messages">${icon('chat')}<span>Öğretmene yaz</span></a><a class="btn ghost" href="#/karne?id=${esc(childId)}">Karne</a>`)}
    <div class="stats">
      ${stat('Devam · 30 gün', data.attendance.recent.length ? `%${pct(data.attendance.subjects.reduce((x, y) => x + y.present, 0), data.attendance.subjects.reduce((x, y) => x + y.total, 0)) ?? 0}` : '—', 'Tüm derslerde', 'check')}
      ${stat('Genel ortalama', data.grades.subjects.length ? `${Math.round(data.grades.subjects.reduce((x, y) => x + y.average, 0) / data.grades.subjects.length)}` : '—', 'Notlardan hesaplanır', 'chart')}
      ${stat('Teslim', data.assignments.filter(a => a.submittedAt).length, `${data.assignments.length} ödevden`, 'file')}
    </div>
    <div class="two-col">
      ${panel('Derslere göre not', '', `<div class="pad">${barRows(grades, { emptyText: 'Henüz not yok' })}</div>`)}
      ${panel('Derslere göre devam', '', `<div class="pad">${barRows(attendance, { emptyText: 'Henüz yoklama yok' })}</div>`)}
    </div>
    ${panel('Davranış ve gözlemler', `${behavior.total > 0 ? '+' : ''}${behavior.total} puan`, `<div class="pad stack">
      <div class="badge-row">${behavior.badges.map(b => `<span class="badge-pill">${esc(b)}</span>`).join('') || '<span class="muted small">Henüz rozet yok</span>'}</div>
      ${sharedNotes.length ? `<ul class="report-notes">${sharedNotes.map(n => `<li><small class="muted">${esc(fmtDate(n.createdAt))} · ${esc(n.teacherName || '')}</small><p>${esc(n.body)}</p></li>`).join('')}</ul>` : '<p class="muted small">Veliyle paylaşılan gözlem notu yok.</p>'}
    </div>`)}
    ${panel('Ödevler', `${data.assignments.length} ödev`, data.assignments.length
      ? `<div class="table-wrap"><table class="table"><thead><tr><th>Ödev</th><th>Son teslim</th><th>Durum</th><th>Öğretmen notu</th></tr></thead><tbody>${assignmentRows}</tbody></table></div>`
      : empty('Ödev yok', 'Çocuğunuzun sınıfına ödev verildiğinde burada görünür.'))}
    ${panel('Sınavlar', `${data.quizzes.length} sınav`, data.quizzes.length
      ? `<div class="table-wrap"><table class="table"><thead><tr><th>Sınav</th><th>Puan</th><th>Durum</th></tr></thead><tbody>${quizRows}</tbody></table></div>`
      : empty('Sınav yok', 'Yayınlanan sınavlar burada görünür.'))}` };
}
CHANGES.childSwitch = el => setQuery('cocuklar', { id: el.value });

// ---------- Sınavlar (öğretmen) ve Sınavlarım (öğrenci) ----------
const QUIZ_STATE = { 'yakında': 'Yakında', 'açık': 'Açık', 'kapandı': 'Kapandı' };
async function pageSinavlar() {
  const { quizzes } = await api('/quizzes');
  const role = state.me.role;
  if (role === 'student') {
    const cards = quizzes.map(z => {
      const done = z.mine?.submittedAt;
      return `<article class="card-item">
        <header class="card-head"><div><h3>${esc(z.title)}</h3><small class="muted">${esc(z.subjectName)} · ${z.timeLimitMinutes} dakika</small></div>
          ${badge(QUIZ_STATE[z.state] || z.state, z.state === 'açık' ? 'ok' : z.state === 'kapandı' ? 'neutral' : 'warn')}</header>
        <p class="small muted">Kapanış: ${esc(fmtDate(z.closesAt))}</p>
        ${done ? `<p class="feedback"><strong>Puanınız:</strong> ${z.mine.score} / ${z.mine.maxScore}</p>` : ''}
        <footer class="card-actions"><a class="btn ${z.state === 'açık' && !done ? 'primary' : 'ghost'} sm" href="#/sinav?id=${esc(z.id)}">${done ? 'Sonucu gör' : z.state === 'açık' ? 'Sınava gir' : 'Ayrıntı'}</a></footer>
      </article>`;
    }).join('');
    return { html: `${head('Sınavlarım', 'Açık sınavlara girin. Süre dolunca cevaplarınız otomatik gönderilir.')}
      ${quizzes.length ? `<div class="cards">${cards}</div>` : empty('Sınav yok', 'Öğretmeniniz sınav yayınladığında burada görünür.')}` };
  }
  const canCreate = role === 'teacher' && state.teaching.length > 0;
  const rows = quizzes.map(z => `<tr>
    <td><strong>${esc(z.title)}</strong><small class="cell-note">${z.questionCount} soru · ${z.timeLimitMinutes} dk</small></td>
    <td>${esc(z.className)}<small class="cell-note">${esc(z.subjectName)}</small></td>
    <td>${esc(fmtDate(z.opensAt))}<small class="cell-note">kapanış ${esc(fmtDate(z.closesAt))}</small></td>
    <td>${z.published ? badge(QUIZ_STATE[z.state] || z.state, z.state === 'açık' ? 'ok' : 'warn') : badge('Taslak')}</td>
    <td>${z.submittedCount}</td>
    <td class="row-actions">
      <a class="btn ghost sm" href="#/sinav?id=${esc(z.id)}">Sonuçlar</a>${canCreate && z.published ? `<button class="btn ghost sm" type="button" data-action="live-create" data-id="${esc(z.id)}">Canlı başlat</button>` : ''}
      ${canCreate ? `<button class="btn ghost sm" type="button" data-action="quiz-toggle" data-id="${esc(z.id)}" data-published="${z.published}">${z.published ? 'Gizle' : 'Yayınla'}</button>
        <button class="icon-btn sm" type="button" data-action="quiz-delete" data-id="${esc(z.id)}" aria-label="Sınavı sil">${icon('trash')}</button>` : ''}
    </td></tr>`).join('');
  return { html: `${head('Sınavlar', 'Çoktan seçmeli sınavlar hazırlayın, süre ve zaman aralığı belirleyin. Sonuçlar otomatik hesaplanır.',
      canCreate ? `<button class="btn primary" type="button" data-action="quiz-new">${icon('plus')}<span>Yeni sınav</span></button>` : '')}
    <section class="panel">${quizzes.length
      ? `<div class="table-wrap"><table class="table"><thead><tr><th>Sınav</th><th>Sınıf · Ders</th><th>Zaman aralığı</th><th>Durum</th><th>Teslim</th><th><span class="sr-only">İşlemler</span></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : empty('Henüz sınav yok', canCreate ? 'İlk sınavınızı oluşturarak başlayın.' : 'Sınıfınız için sınav hazırlandığında burada görünür.')}</section>` };
}

function quizQuestionBlock() {
  const uid = Math.random().toString(36).slice(2, 8);
  return `<div class="quiz-q" data-kind="choice">
    <div class="quiz-q-head"><strong class="qno">Soru</strong>
      <button class="icon-btn sm" type="button" data-action="quiz-remove-q" aria-label="Soruyu kaldır">${icon('close')}</button></div>
    <label class="field"><span>Soru türü</span><select name="kind" data-change="quizKind">
      <option value="choice">Çoktan seçmeli</option><option value="text">Açık uçlu (elle puanlanır)</option></select></label>
    <label class="field"><span>Soru metni</span><textarea name="qtext" rows="2" maxlength="1000" required></textarea></label>
    <label class="field"><span>Görsel (isteğe bağlı)</span><input name="qimage" type="file" accept="image/png,image/jpeg">
      <small>JPG veya PNG, en fazla 5 MB. Canlı yarışmada görsel öğretmen ekranında gösterilir.</small></label>
    <div class="quiz-opts">${[0, 1, 2, 3].map(i => `<label class="quiz-opt">
      <input type="radio" name="correct-${uid}" value="${i}" ${i === 0 ? 'checked' : ''} aria-label="Doğru cevap ${i + 1}">
      <input name="opt" maxlength="300" placeholder="${i < 2 ? 'Seçenek' : 'İsteğe bağlı seçenek'} ${i + 1}">
    </label>`).join('')}</div>
    <div class="grid-2">
      <label class="field"><span>Puan</span><select name="points">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => `<option value="${v}">${v}</option>`).join('')}</select></label>
      <label class="field"><span>Süre (canlı yarışma)</span><select name="time">${[5, 10, 15, 20, 30, 45, 60, 90, 120].map(v => `<option value="${v}" ${v === 20 ? 'selected' : ''}>${v} sn</option>`).join('')}</select></label>
    </div>
  </div>`;
}

function renumberQuestions() {
  document.querySelectorAll('#quizQuestions .quiz-q').forEach((block, i) => { block.querySelector('.qno').textContent = `Soru ${i + 1}`; });
}

function quizForm() {
  const pairs = state.teaching.map(t => ({ value: `${t.classId}|${t.subjectId}`, label: `${t.className} · ${t.subjectName}` }));
  const now = new Date();
  const open = new Date(now.getTime() - 60000), close = new Date(now.getTime() + 7 * 86400000);
  return `<form class="stack" data-form="quiz-create">
    <div class="grid-2">
      <label class="field"><span>Sınav adı</span><input name="title" required minlength="2" maxlength="160" placeholder="Örn. Kesirler kısa sınavı"></label>
      <label class="field"><span>Sınıf ve ders</span><select name="pair" required>${pairs.map(p => `<option value="${esc(p.value)}">${esc(p.label)}</option>`).join('')}</select></label>
    </div>
    <div class="grid-2">
      <label class="field"><span>Açılış</span><input name="opensAt" type="datetime-local" required value="${esc(toLocalInput(open.toISOString()))}"></label>
      <label class="field"><span>Kapanış</span><input name="closesAt" type="datetime-local" required value="${esc(toLocalInput(close.toISOString()))}"></label>
    </div>
    <div class="grid-2">
      <label class="field"><span>Süre (dakika)</span><input name="timeLimitMinutes" type="number" min="1" max="240" value="20" required></label>
      <label class="switch switch-line"><input type="checkbox" name="published"><span class="switch-ui" aria-hidden="true"></span><span><strong>Hemen yayınla</strong><small>Kapalıysa taslak olarak kaydedilir.</small></span></label>
    </div>
    <h3 class="sub-title">Sorular</h3>
    <details class="ai-box">
      <summary><span>Yapay zekâ ile soru taslağı</span><small>Konuyu yazın, sorular taslak olarak eklensin. Kaydetmeden önce kontrol edin.</small></summary>
      <div class="ai-box-body">
        <label class="field"><span>Konu</span><input name="aiTopic" maxlength="200" placeholder="Örn. Kesirlerde toplama ve çıkarma"></label>
        <label class="field"><span>Örnek soru (isteğe bağlı)</span><textarea name="aiExample" rows="2" maxlength="800" placeholder="Tarzı göstermek için bir soru yazabilirsiniz"></textarea></label>
        <div class="grid-2">
          <label class="field"><span>Soru sayısı</span><select name="aiCount">${[3, 5, 8, 10].map(n => `<option value="${n}" ${n === 5 ? 'selected' : ''}>${n} soru</option>`).join('')}</select></label>
          <label class="switch switch-line"><input type="checkbox" name="aiImages"><span class="switch-ui" aria-hidden="true"></span><span><strong>Gerekirse şekil ekle</strong><small>Geometri ve fen soruları için basit bir şekil üretilir.</small></span></label>
        </div>
        <button class="btn ghost" type="button" data-action="quiz-ai-run">${icon('spark')}<span>Taslağı oluştur</span></button>
      </div>
    </details>
    <div id="quizQuestions">${quizQuestionBlock()}</div>
    <button class="btn ghost" type="button" data-action="quiz-add-q">${icon('plus')}<span>Soru ekle</span></button>
    <label class="switch switch-line"><input type="checkbox" name="shuffleOptions"><span class="switch-ui" aria-hidden="true"></span><span><strong>Seçenekleri karıştır</strong><small>Her öğrenciye şıklar farklı sırada gösterilir. Puanlama değişmez.</small></span></label>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Sınavı kaydet</button></div>
  </form>`;
}

ACTIONS['quiz-new'] = () => { openModal('Yeni sınav', quizForm(), { wide: true }); renumberQuestions(); };
ACTIONS['quiz-add-q'] = () => {
  const box = document.querySelector('#quizQuestions');
  if (box.querySelectorAll('.quiz-q').length >= 50) throw new Error('Bir sınavda en fazla 50 soru olabilir.');
  box.insertAdjacentHTML('beforeend', quizQuestionBlock());
  renumberQuestions();
  box.lastElementChild.querySelector('textarea')?.focus();
};
ACTIONS['quiz-remove-q'] = el => {
  const blocks = document.querySelectorAll('#quizQuestions .quiz-q');
  if (blocks.length <= 1) throw new Error('Sınavda en az bir soru olmalı.');
  el.closest('.quiz-q').remove();
  renumberQuestions();
};

// Yapay zekâ taslağını form alanlarına yerleştirir; görseller PNG olarak eklenir
async function fillQuizDrafts(questions) {
  const box = document.querySelector('#quizQuestions');
  box.innerHTML = '';
  for (const draft of questions) {
    box.insertAdjacentHTML('beforeend', quizQuestionBlock());
    const block = box.lastElementChild;
    block.querySelector('[name=qtext]').value = draft.text;
    const rows = [...block.querySelectorAll('.quiz-opt')];
    rows.forEach((row, index) => {
      row.querySelector('input[name=opt]').value = draft.options[index] ?? '';
    });
    const radio = rows[draft.correctIndex]?.querySelector('input[type=radio]');
    if (radio) radio.checked = true;
    if (draft.svg) {
      const file = await svgToPngFile(draft.svg);
      if (file) {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        block.querySelector('[name=qimage]').files = transfer.files;
      }
    }
  }
  renumberQuestions();
}

// SVG'yi sınav görseli için PNG'ye çevirir (veri adresi üzerinden; dış kaynak yüklenmez)
function svgToPngFile(svg) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 800, 600);
      ctx.drawImage(img, 0, 0, 800, 600);
      canvas.toBlob(blob => resolve(blob ? new File([blob], 'soru-sekli.png', { type: 'image/png' }) : null), 'image/png');
    };
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

ACTIONS['quiz-ai-run'] = async el => {
  const box = el.closest('.ai-box');
  const topic = box.querySelector('[name=aiTopic]').value.trim();
  const example = box.querySelector('[name=aiExample]').value.trim();
  const count = Number(box.querySelector('[name=aiCount]').value);
  const withImages = box.querySelector('[name=aiImages]').checked;
  if (topic.length < 3) {
    toast('Önce bir konu yazın (en az 3 karakter)', 'error');
    return;
  }
  el.disabled = true;
  try {
    const { questions } = await api('/ai/quiz-draft', { method: 'POST', body: { topic, example, count, withImages } });
    await fillQuizDrafts(questions);
    toast(`${questions.length} soru taslağı eklendi. Kontrol edip kaydedin.`);
  } finally {
    el.disabled = false;
  }
};

FORMS['quiz-create'] = async form => {
  const [classId, subjectId] = val(form, 'pair').split('|');
  const questions = await Promise.all([...form.querySelectorAll('.quiz-q')].map(async (block, index) => {
    const text = block.querySelector('[name=qtext]').value.trim();
    const kind = block.querySelector('[name=kind]').value === 'text' ? 'text' : 'choice';
    if (!text) throw new Error(`${index + 1}. sorunun metni boş.`);
    const file = block.querySelector('[name=qimage]').files[0];
    if (file && file.size > 5 * 1024 * 1024) throw new Error(`${index + 1}. sorunun görseli 5 MB sınırını aşıyor.`);
    const base = {
      kind,
      text,
      points: Number(block.querySelector('[name=points]').value) || 1,
      timeLimit: Number(block.querySelector('[name=time]').value) || 20,
      image: file ? await readFile(file) : null,
    };
    if (kind === 'text') return base;
    const rows = [...block.querySelectorAll('.quiz-opt')];
    const checked = rows.findIndex(row => row.querySelector('input[type=radio]').checked);
    const options = rows.map(row => row.querySelector('input[name=opt]').value.trim());
    if (!options[checked]) throw new Error(`${index + 1}. sorunun doğru cevabı boş bırakılmış. Doğru seçeneği işaretleyin.`);
    const filtered = options.filter(Boolean);
    if (filtered.length < 2) throw new Error(`${index + 1}. soruda en az iki seçenek yazın.`);
    return { ...base, options: filtered, correctIndex: filtered.indexOf(options[checked]) };
  }));
  const published = form.querySelector('[name=published]').checked;
  await api('/quizzes', { method: 'POST', body: {
    title: val(form, 'title').trim(), classId, subjectId, questions, published, shuffleOptions: form.querySelector('[name=shuffleOptions]').checked,
    opensAt: new Date(val(form, 'opensAt')).toISOString(), closesAt: new Date(val(form, 'closesAt')).toISOString(),
    timeLimitMinutes: Number(val(form, 'timeLimitMinutes')),
  } });
  closeModal();
  toast(published ? 'Sınav yayınlandı' : 'Sınav taslak olarak kaydedildi');
  refresh();
};

ACTIONS['quiz-toggle'] = async el => {
  await api(`/quizzes/${el.dataset.id}`, { method: 'PATCH', body: { published: el.dataset.published !== 'true' } });
  toast('Sınav durumu güncellendi');
  refresh();
};
ACTIONS['quiz-delete'] = async el => {
  const yes = await confirmDialog('Sınavı sil', 'Sınav, sorular ve tüm öğrenci cevapları silinecek. Bu işlem geri alınamaz.');
  if (!yes) return;
  await api(`/quizzes/${el.dataset.id}`, { method: 'DELETE' });
  toast('Sınav silindi');
  refresh();
};

// Sınav detayı: öğretmen sonuçları, öğrenci çözme ve sonuç ekranı
let quizTimer = null;
function clearQuizTimer() { if (quizTimer) { clearInterval(quizTimer); quizTimer = null; } }

async function pageSinav(params) {
  if (!params.id) return { html: `${head('Sınav')}${panel('Sınav', '', empty('Sınav seçilmedi', 'Sınavlar sayfasından bir sınav seçin.'))}` };
  if (state.me.role === 'student') return pageSinavOgrenci(params.id);
  const data = await api(`/quizzes/${params.id}/results`);
  const rows = data.attempts.map(a => `<tr>
    <td><strong>${esc(a.studentName)}</strong><small class="cell-note">${esc(a.studentNo || '')}</small></td>
    <td>${a.submittedAt ? `${a.score} / ${a.maxScore}` : '—'}</td>
    <td>${a.percent === null ? badge('Teslim yok') : meterInline(a.percent)}</td>
    <td>${a.submittedAt ? esc(fmtDate(a.submittedAt)) : badge('Devam ediyor', 'warn')}</td></tr>`).join('');
  return { html: `${head(data.quiz.title, 'Sınav sonuçları ve sınıf dağılımı', '<a class="btn ghost" href="#/sinavlar">← Sınavlar</a><button class="btn primary" type="button" data-action="grade-open" data-id="${esc(params.id)}">Açık uçlu soruları puanla</button>')}
    <div class="stats">
      ${stat('Teslim', `${data.stats.submitted} / ${data.stats.classSize}`, 'Sınıftan teslim eden', 'check')}
      ${stat('Ortalama', data.stats.average === null ? '—' : `%${data.stats.average}`, 'Teslim edenlerin ortalaması', 'chart')}
    </div>
    <div class="two-col">
      ${panel('Puan dağılımı', '', `<div class="pad">${distributionRows(data.stats.distribution)}</div>`)}
      ${panel('Öğrenciler', `${data.attempts.length} deneme`, data.attempts.length
        ? `<div class="table-wrap"><table class="table"><thead><tr><th>Öğrenci</th><th>Puan</th><th>Yüzde</th><th>Teslim</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : empty('Henüz deneme yok', 'Öğrenciler sınava girdiğinde sonuçlar burada görünür.'))}
    </div>` };
}

function meterInline(percent) {
  return `<span class="meter"><span class="bar"><i data-w="${percent}"></i></span><b>%${percent}</b></span>`;
}

async function pageSinavOgrenci(id) {
  const data = await api(`/quizzes/${id}`);
  const quiz = data.quiz;
  const attempt = data.attempt;
  const finished = Boolean(attempt?.submittedAt);
  const now = Date.now();
  const opensAt = new Date(quiz.opensAt).getTime(), closesAt = new Date(quiz.closesAt).getTime();
  const header = head(quiz.title, `${quiz.timeLimitMinutes} dakika · kapanış ${fmtDate(quiz.closesAt)}`, '<a class="btn ghost" href="#/sinavlar">← Sınavlarım</a>');
  if (finished) {
    const items = data.questions.map(qq => {
      if (qq.kind === 'text') {
        const pending = qq.awarded === null || qq.awarded === undefined;
        const mark = attempt.graded && !pending ? `${qq.awarded} / ${qq.points} puan` : 'Öğretmeniniz puanladığında görünür';
        return `<li class="result-q ${attempt.graded ? 'ok' : ''}"><strong>${esc(qq.text)}</strong>
          <small>Sizin cevabınız: ${qq.textAnswer ? esc(qq.textAnswer) : 'boş'}</small>
          <small>${esc(mark)}</small></li>`;
      }
      const ok = qq.selected === qq.correctIndex;
      return `<li class="result-q ${ok ? 'ok' : 'bad'}"><strong>${esc(qq.text)}</strong>
        <small>Sizin cevabınız: ${qq.selected === null || qq.selected === undefined ? 'boş' : esc(qq.options[qq.selected])}</small>
        ${ok ? '' : `<small>Doğru cevap: ${esc(qq.options[qq.correctIndex])}</small>`}</li>`;
    }).join('');
    const scoreBlock = attempt.graded
      ? `<div class="result-score">${attempt.score}<span> / ${attempt.maxScore}</span></div>`
      : '<div class="result-score pending">Değerlendiriliyor</div>';
    return { html: `${header}
      <section class="panel result-hero"><div class="pad"><p class="kicker">Sonucunuz</p>
        ${scoreBlock}
        <p class="muted">Teslim: ${esc(fmtDate(attempt.submittedAt))}</p></div></section>
      ${panel('Cevaplarınız', '', `<ul class="result-list">${items}</ul>`)}` };
  }
  if (!attempt && now < opensAt) return { html: `${header}${panel('Sınav', '', empty('Sınav henüz açılmadı', `Açılış: ${fmtDate(quiz.opensAt)}`))}` };
  if (!attempt && now > closesAt) return { html: `${header}${panel('Sınav', '', empty('Sınav kapandı', 'Bu sınava artık giremezsiniz.'))}` };
  if (!attempt) {
    return { html: `${header}<section class="panel"><div class="pad stack">
      <p>Bu sınav <strong>${data.questions.length} soru</strong> içerir ve <strong>${quiz.timeLimitMinutes} dakika</strong> sürer. Süre başladıktan sonra durdurulamaz; süre dolunca cevaplarınız otomatik gönderilir.</p>
      <div class="form-actions"><button class="btn primary lg" type="button" data-action="quiz-start" data-id="${esc(id)}">Sınavı başlat</button></div>
    </div></section>` };
  }
  return { html: `${header}${takeHtml(data, attempt)}`, after: () => startTimer(attempt.deadline) };
}

function takeHtml(data, attempt) {
  const questions = data.questions.map((qq, i) => {
    const legend = `<legend><span class="qnum">${i + 1}</span> ${esc(qq.text)} <small class="muted">(${qq.points} puan)</small></legend>`;
    const image = qq.hasImage ? `<img class="quiz-image" src="/api/files/quiz-question/${esc(qq.id)}" alt="">` : '';
    if (qq.kind === 'text') {
      return `<fieldset class="quiz-question">${legend}${image}
        <textarea class="quiz-text" data-text-question="${esc(qq.id)}" rows="4" maxlength="2000" placeholder="Cevabınızı yazın">${esc(qq.textAnswer || '')}</textarea>
      </fieldset>`;
    }
    const selected = qq.selected;
    return `<fieldset class="quiz-question">${legend}${image}
      <div class="quiz-options">${qq.options.map((option, j) => `<label class="quiz-option ${selected === j ? 'on' : ''}">
        <input type="radio" name="q-${esc(qq.id)}" value="${j}" data-question="${esc(qq.id)}" ${selected === j ? 'checked' : ''}>
        <span>${esc(option)}</span></label>`).join('')}</div>
    </fieldset>`;
  }).join('');
  return `<div class="quiz-bar" role="timer" aria-live="off"><span>Kalan süre</span><strong id="quizTimer">--:--</strong><span class="muted small" id="quizSaved">Cevaplar kaydedildi</span></div>
    <form class="quiz-form" id="quizForm" data-form="quiz-submit" data-id="${esc(attempt.id)}">
      ${questions}
      <p class="form-error" data-error role="alert"></p>
      <div class="form-actions"><button class="btn primary lg" type="submit">Sınavı bitir ve gönder</button></div>
    </form>`;
}

let saveTimer = null;
function collectAnswers() {
  const answers = [];
  document.querySelectorAll('#quizForm input[type=radio]:checked').forEach(input => {
    answers.push({ questionId: input.dataset.question, selected: Number(input.value) });
  });
  document.querySelectorAll('#quizForm textarea[data-text-question]').forEach(area => {
    const text = area.value.trim();
    if (text) answers.push({ questionId: area.dataset.textQuestion, text });
  });
  return answers;
}

function startTimer(deadline) {
  clearQuizTimer();
  const end = new Date(deadline).getTime();
  const attemptId = document.querySelector('#quizForm')?.dataset.id;
  const tick = async () => {
    const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
    const el = document.querySelector('#quizTimer');
    if (!el) { clearQuizTimer(); return; }
    el.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
    el.classList.toggle('late', left < 60);
    if (left <= 0) {
      clearQuizTimer();
      toast('Süre doldu, cevaplarınız gönderiliyor.');
      await api(`/quiz-attempts/${attemptId}/submit`, { method: 'POST', body: {} }).catch(() => {});
      refresh();
    }
  };
  tick();
  quizTimer = setInterval(tick, 1000);
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const saved = document.querySelector('#quizSaved');
      try {
        await api(`/quiz-attempts/${attemptId}/answers`, { method: 'PUT', body: { answers: collectAnswers() } });
        if (saved) saved.textContent = 'Cevaplar kaydedildi';
      } catch (error) {
        if (saved) saved.textContent = error.message;
      }
    }, 600);
  };
  document.querySelectorAll('#quizForm input[type=radio]').forEach(input => {
    input.addEventListener('change', () => {
      input.closest('.quiz-options')?.querySelectorAll('.quiz-option').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
      scheduleSave();
    });
  });
  document.querySelectorAll('#quizForm textarea[data-text-question]').forEach(area => {
    area.addEventListener('input', scheduleSave);
  });
}

ACTIONS['quiz-start'] = async el => {
  await api(`/quizzes/${el.dataset.id}/attempts`, { method: 'POST', body: {} });
  refresh();
};

FORMS['quiz-submit'] = async form => {
  clearQuizTimer();
  clearTimeout(saveTimer);
  await api(`/quiz-attempts/${form.dataset.id}/answers`, { method: 'PUT', body: { answers: collectAnswers() } }).catch(() => {});
  const result = await api(`/quiz-attempts/${form.dataset.id}/submit`, { method: 'POST', body: {} });
  toast(result.graded
    ? `Sınavınız gönderildi: ${result.score} / ${result.maxScore}`
    : 'Sınavınız gönderildi. Açık uçlu sorular öğretmeniniz puanlayınca sonucunuz görünür.');
  refresh();
};

// ---------- Notlar (öğrenci: kendi; öğretmen/müdür: sınıf) ----------
async function pageNotlar(params) {
  if (state.me.role === 'student') {
    const data = await api('/grades/me');
    const subjectBars = barRows(data.subjects.map(sub => ({ label: `${sub.subjectName} (${sub.count} not)`, value: sub.average })), { emptyText: 'Henüz not yok' });
    const assignmentRows = data.assignments.map(a => `<tr><td><strong>${esc(a.title)}</strong></td><td>${esc(a.subjectName)}</td><td>${badge(a.grade, 'ok')}</td><td><small>${esc(a.feedback || '')}</small></td></tr>`).join('');
    const quizRows = data.quizzes.map(z => `<tr><td><strong>${esc(z.title)}</strong></td><td>${esc(z.subjectName)}</td><td>${z.score} / ${z.maxScore}</td><td>${meterInline(z.percent)}</td></tr>`).join('');
    return { html: `${head('Notlarım', 'Derslere göre ortalamanız, ödev notlarınız ve sınav sonuçlarınız.')}
      ${panel('Derslere göre ortalama', '', `<div class="pad">${subjectBars}</div>`)}
      ${panel('Ödev notları', '', data.assignments.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Ödev</th><th>Ders</th><th>Not</th><th>Geri bildirim</th></tr></thead><tbody>${assignmentRows}</tbody></table></div>` : empty('Henüz not yok', 'Öğretmeniniz notlandırdığında burada görünür.'))}
      ${panel('Sınav sonuçları', '', data.quizzes.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Sınav</th><th>Ders</th><th>Puan</th><th>Yüzde</th></tr></thead><tbody>${quizRows}</tbody></table></div>` : empty('Sınav sonucu yok', 'Tamamladığınız sınavların sonuçları burada görünür.'))}` };
  }
  const classes = state.me.role === 'teacher'
    ? uniqueBy(state.teaching.map(t => ({ id: t.classId, name: t.className })), 'id')
    : state.classes;
  if (!classes.length) return { html: `${head('Notlar')}${panel('Notlar', '', empty('Sınıf yok', 'Sınıf atandığında not grafikleri burada görünür.'))}` };
  const classId = classes.some(c => c.id === params.classId) ? params.classId : classes[0].id;
  const data = await api(`/grades/class?classId=${classId}`);
  const select = `<select data-change="gradeClass" aria-label="Sınıf seç">${classes.map(c => `<option value="${esc(c.id)}" ${c.id === classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;
  return { html: `${head('Notlar', 'Sınıf bazında ödev ve sınav ortalamaları ile not dağılımı.', select)}
    <div class="two-col">
      ${panel('Ödev ortalamaları', '', `<div class="pad">${barRows(data.assignments.map(a => ({ label: `${a.title} · ${a.subjectName}`, value: a.average })), { emptyText: 'Notlandırılmış ödev yok' })}</div>`)}
      ${panel('Sınav ortalamaları', '', `<div class="pad">${barRows(data.quizzes.map(z => ({ label: `${z.title} · ${z.subjectName}`, value: z.average })), { emptyText: 'Teslim edilmiş sınav yok' })}</div>`)}
    </div>
    ${panel('Not dağılımı', 'ödev notları', `<div class="pad">${distributionRows(data.distribution)}</div>`)}` };
}
CHANGES.gradeClass = el => setQuery('notlar', { classId: el.value });

// ---------- Davranış, Puanlarım, Ders programı, Takvim, Karne (v16) ----------
const POSITIVE_REASONS = ['Derse katılım', 'Yardımseverlik', 'Üstün çaba', 'Ödev hazırlığı', 'Takım çalışması'];
const NEGATIVE_REASONS = ['Dikkat dağınıklığı', 'Ödev eksik', 'Derse geç kalma', 'Kurallara uymama'];
const KIND_LABEL = { sinav: 'Sınav', tatil: 'Tatil', etkinlik: 'Etkinlik', toplanti: 'Toplantı', odev: 'Ödev' };
const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
const isoDay = d => d.toISOString().slice(0, 10);
function calendarCells(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(Date.UTC(year, month, 1 - offset + i)));
}
const teacherClasses = () => uniqueBy(state.teaching.map(t => ({ id: t.classId, name: t.className })), 'id');

CHANGES.classPick = el => setQuery(el.dataset.page, { classId: el.value });

async function pageDavranis(params) {
  const classes = state.me.role === 'teacher' ? teacherClasses() : state.classes;
  if (!classes.length) return { html: `${head('Davranış', 'Öğrencilere puan verin ve gözlem notu ekleyin.')}${panel('Davranış', '', empty('Sınıf yok', 'Sınıf atandığında burada görünür.'))}` };
  const classId = classes.some(c => c.id === params.classId) ? params.classId : classes[0].id;
  const { students, recent } = await api(`/behavior/class?classId=${classId}`);
  const select = `<select data-change="classPick" data-page="davranis" aria-label="Sınıf seç">${classes.map(c => `<option value="${esc(c.id)}" ${c.id === classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;
  const cards = students.map(st => `
    <article class="behave-card">
      <div class="behave-top">
        <span class="avatar sm ${tone('student')}">${esc(initials(st.name))}</span>
        <div class="behave-name"><strong>${esc(st.name)}</strong><small class="muted">${esc(st.studentNo || '')}</small></div>
        <span class="behave-total ${st.total < 0 ? 'neg' : ''}">${st.total > 0 ? '+' : ''}${st.total}</span>
      </div>
      <div class="badge-row">${st.badges.map(b => `<span class="badge-pill">${esc(b)}</span>`).join('') || '<span class="muted small">Henüz rozet yok</span>'}</div>
      <div class="behave-actions">
        <button class="btn ghost sm" type="button" data-action="behavior-open" data-student="${esc(st.id)}" data-name="${esc(st.name)}" data-class="${esc(classId)}" data-sign="1">+ Puan</button>
        <button class="btn ghost sm" type="button" data-action="behavior-open" data-student="${esc(st.id)}" data-name="${esc(st.name)}" data-class="${esc(classId)}" data-sign="-1">− Puan</button>
        <button class="btn ghost sm" type="button" data-action="note-open" data-student="${esc(st.id)}" data-name="${esc(st.name)}">Gözlem</button>
        <a class="btn ghost sm" href="#/karne?id=${esc(st.id)}">Karne</a>
      </div>
    </article>`).join('');
  const feed = recent.map(r => `<li class="feed-row">
      <span class="feed-points ${r.points < 0 ? 'neg' : ''}">${r.points > 0 ? '+' : ''}${r.points}</span>
      <div><strong>${esc(r.studentName)}</strong><small class="muted">${esc(r.reason || 'Gerekçe yok')} · ${esc(r.teacherName || '')} · ${esc(fmtDate(r.createdAt))}</small></div>
      ${r.canDelete ? `<button class="icon-btn sm" type="button" data-action="behavior-del" data-id="${esc(r.id)}" aria-label="Kaydı sil">${icon('trash')}</button>` : ''}
    </li>`).join('');
  return { html: `${head('Davranış', 'Puan verin, rozetleri takip edin, gözlem notlarını gerekirse veliyle paylaşın.', select)}
    <div class="behave-grid">${cards || empty('Öğrenci yok', 'Bu sınıfa öğrenci atandığında burada görünür.')}</div>
    ${panel('Son hareketler', `${recent.length} kayıt`, recent.length ? `<ul class="feed-list">${feed}</ul>` : empty('Henüz kayıt yok', 'Puan verdiğinizde burada görünür.'))}` };
}

ACTIONS['behavior-open'] = el => {
  const sign = Number(el.dataset.sign);
  const reasons = sign > 0 ? POSITIVE_REASONS : NEGATIVE_REASONS;
  openModal(`${el.dataset.name} · ${sign > 0 ? 'Puan ver' : 'Puan düş'}`, `<form class="stack" data-form="behavior-give" data-student="${esc(el.dataset.student)}" data-class="${esc(el.dataset.class)}">
    <label class="field"><span>Puan</span><select name="points">${[1, 2, 3, 4, 5].map(v => `<option value="${sign * v}">${sign > 0 ? '+' : ''}${sign * v}</option>`).join('')}</select></label>
    <div class="reason-chips">${reasons.map(r => `<button type="button" class="ai-chip" data-action="reason-pick" data-text="${esc(r)}">${esc(r)}</button>`).join('')}</div>
    <label class="field"><span>Gerekçe</span><input name="reason" maxlength="120" placeholder="Örn. Derse aktif katılım"></label>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Kaydet</button></div>
  </form>`);
};
ACTIONS['reason-pick'] = el => { const input = document.querySelector('form[data-form=behavior-give] [name=reason]'); if (input) input.value = el.dataset.text; };
FORMS['behavior-give'] = async form => {
  await api('/behavior', { method: 'POST', body: { studentId: form.dataset.student, classId: form.dataset.class, points: Number(val(form, 'points')), reason: val(form, 'reason').trim() } });
  closeModal();
  toast('Puan kaydedildi');
  refresh();
};
ACTIONS['behavior-del'] = async el => {
  const yes = await confirmDialog('Puan kaydını sil', 'Bu puan kaydı silinecek ve öğrencinin toplamı yeniden hesaplanacak.');
  if (!yes) return;
  await api(`/behavior/${el.dataset.id}`, { method: 'DELETE' });
  toast('Kayıt silindi');
  refresh();
};

ACTIONS['note-open'] = el => openModal(`${el.dataset.name} · Gözlem notu`, `<form class="stack" data-form="student-note" data-student="${esc(el.dataset.student)}">
    <label class="field"><span>Not</span><textarea name="body" rows="4" maxlength="1000" required placeholder="Gözleminizi kısa ve nesnel yazın."></textarea></label>
    <label class="switch switch-line"><input type="checkbox" name="shared"><span class="switch-ui" aria-hidden="true"></span>
      <span><strong>Veliyle paylaş</strong><small>İşaretlerseniz çocuğun velisi bu notu görür.</small></span></label>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Notu kaydet</button></div>
  </form>`);
FORMS['student-note'] = async form => {
  await api('/student-notes', { method: 'POST', body: { studentId: form.dataset.student, body: val(form, 'body').trim(), sharedWithParent: form.querySelector('[name=shared]').checked } });
  closeModal();
  toast('Gözlem notu kaydedildi');
  refresh();
};

async function pagePuanlarim() {
  const data = await api(`/behavior/student/${state.me.id}`);
  const events = data.events.map(e => `<li class="feed-row">
      <span class="feed-points ${e.points < 0 ? 'neg' : ''}">${e.points > 0 ? '+' : ''}${e.points}</span>
      <div><strong>${esc(e.reason || 'Gerekçe yok')}</strong><small class="muted">${esc(e.className)} · ${esc(e.teacherName || '')} · ${esc(fmtDate(e.createdAt))}</small></div>
    </li>`).join('');
  return { html: `${head('Puanlarım', 'Davranış puanlarınız ve kazandığınız rozetler.', `<a class="btn ghost" href="#/karne?id=${esc(state.me.id)}">Karnemi görüntüle</a>`)}
    <div class="stats">
      ${stat('Toplam puan', `${data.total > 0 ? '+' : ''}${data.total}`, 'Tüm derslerde', 'star')}
      ${stat('Olumlu', data.positive, 'Aldığınız artı puan sayısı', 'check')}
      ${stat('Rozet', data.badges.length, 'Kazandığınız rozet', 'spark')}
    </div>
    ${panel('Rozetlerim', '', `<div class="pad badge-row">${data.badges.map(b => `<span class="badge-pill big">${esc(b)}</span>`).join('') || '<span class="muted">Henüz rozet yok. Derste aktif olarak ilk rozetini kazan!</span>'}</div>`)}
    ${panel('Son puanlar', `${data.events.length} kayıt`, data.events.length ? `<ul class="feed-list">${events}</ul>` : empty('Henüz puan yok', 'Öğretmeniniz puan verdiğinde burada görünür.'))}` };
}

async function pageProgram(params) {
  const role = state.me.role;
  const classes = role === 'teacher' ? teacherClasses() : role === 'principal' ? state.classes : [];
  const classId = params.classId || '';
  const { slots } = await api(`/timetable${classId ? `?classId=${encodeURIComponent(classId)}` : ''}`);
  const columns = DAY_NAMES.map((day, i) => {
    const list = slots.filter(s => s.weekday === i + 1);
    return `<section class="day-col"><p class="day-title">${day}</p>${list.length ? list.map(s => `
      <article class="slot-card">
        <header><span class="slot-time">${esc(s.startsAt)} – ${esc(s.endsAt)}</span>
          ${s.canDelete ? `<button class="icon-btn sm" type="button" data-action="slot-del" data-id="${esc(s.id)}" aria-label="Dersi sil">${icon('trash')}</button>` : ''}</header>
        <strong>${esc(s.subjectName)}</strong>
        <small class="muted">${esc(s.className)}${s.room ? ` · ${esc(s.room)}` : ''}</small>
        <small class="muted">${esc(s.teacherName)}</small>
      </article>`).join('') : '<p class="muted small day-empty">Ders yok</p>'}</section>`;
  }).join('');
  const select = classes.length
    ? `<select data-change="classPick" data-page="program" aria-label="Sınıf seç"><option value="">Tümü</option>${classes.map(c => `<option value="${esc(c.id)}" ${c.id === classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : '';
  const addButton = role === 'teacher' || role === 'principal'
    ? `<button class="btn primary" type="button" data-action="slot-new">${icon('plus')}<span>Ders ekle</span></button>` : '';
  return { html: `${head('Ders programı', 'Haftalık program. Öğretmen ve sınıf çakışmaları otomatik engellenir.', addButton + select)}
    <div class="week-grid">${columns}</div>` };
}

ACTIONS['slot-new'] = () => {
  const teacher = state.me.role === 'teacher';
  openModal('Ders ekle', `<form class="stack" data-form="slot-create">
    ${teacher
      ? `<label class="field"><span>Sınıf ve ders</span><select name="pair">${state.teaching.map(t => `<option value="${esc(t.classId)}|${esc(t.subjectId)}">${esc(t.className)} · ${esc(t.subjectName)}</option>`).join('')}</select></label>`
      : `<div class="grid-2"><label class="field"><span>Sınıf</span><select name="classId">${state.classes.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
         <label class="field"><span>Ders</span><select name="subjectId">${state.subjects.map(sj => `<option value="${esc(sj.id)}">${esc(sj.name)}</option>`).join('')}</select></label></div>`}
    <div class="grid-2">
      <label class="field"><span>Gün</span><select name="weekday">${DAY_NAMES.map((d, i) => `<option value="${i + 1}">${d}</option>`).join('')}</select></label>
      <label class="field"><span>Derslik</span><input name="room" maxlength="40" placeholder="Örn. Lab 2"></label>
    </div>
    <div class="grid-2">
      <label class="field"><span>Başlangıç</span><input name="startsAt" type="time" required value="08:30"></label>
      <label class="field"><span>Bitiş</span><input name="endsAt" type="time" required value="09:10"></label>
    </div>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Dersi ekle</button></div>
  </form>`);
};
FORMS['slot-create'] = async form => {
  const body = { weekday: Number(val(form, 'weekday')), room: val(form, 'room').trim(), startsAt: val(form, 'startsAt'), endsAt: val(form, 'endsAt') };
  if (form.querySelector('[name=pair]')) {
    const [classId, subjectId] = val(form, 'pair').split('|');
    body.classId = classId;
    body.subjectId = subjectId;
  } else {
    body.classId = val(form, 'classId');
    body.subjectId = val(form, 'subjectId');
  }
  await api('/timetable', { method: 'POST', body });
  closeModal();
  toast('Ders programa eklendi');
  refresh();
};
ACTIONS['slot-del'] = async el => {
  const yes = await confirmDialog('Dersi sil', 'Bu ders programdan kaldırılacak.');
  if (!yes) return;
  await api(`/timetable/${el.dataset.id}`, { method: 'DELETE' });
  toast('Ders silindi');
  refresh();
};

async function pageTakvim(params) {
  const now = new Date();
  const year = Number(params.y) || now.getUTCFullYear();
  const month = (Number(params.m) || now.getUTCMonth() + 1) - 1;
  const cells = calendarCells(year, month);
  const { items } = await api(`/calendar?from=${isoDay(cells[0])}&to=${isoDay(cells[41])}`);
  const byDate = {};
  items.forEach(item => { (byDate[item.date] = byDate[item.date] || []).push(item); });
  const selected = params.d || isoDay(now);
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const prev = month === 0 ? [year - 1, 12] : [year, month];
  const next = month === 11 ? [year + 1, 1] : [year, month + 2];
  const grid = cells.map(d => {
    const key = isoDay(d);
    const list = byDate[key] || [];
    return `<button class="cal-cell ${d.getUTCMonth() === month ? '' : 'out'} ${key === isoDay(now) ? 'today' : ''} ${key === selected ? 'sel' : ''}" type="button" data-action="cal-day" data-day="${key}" data-y="${year}" data-m="${month + 1}">
      <span class="cal-num">${d.getUTCDate()}</span>
      <span class="cal-dots">${list.slice(0, 3).map(i => `<i class="dot k-${esc(i.kind)}"></i>`).join('')}${list.length > 3 ? `<small>+${list.length - 3}</small>` : ''}</span>
    </button>`;
  }).join('');
  const dayItems = byDate[selected] || [];
  const agenda = dayItems.map(i => `<li class="cal-item k-${esc(i.kind)}">
      <span class="cal-kind">${esc(KIND_LABEL[i.kind] || i.kind)}</span>
      <div><strong>${esc(i.title)}</strong><small class="muted">${esc(i.className || 'Okul geneli')}${i.description ? ` · ${esc(i.description)}` : ''}</small></div>
      ${i.origin === 'etkinlik' && i.canDelete ? `<button class="icon-btn sm" type="button" data-action="event-del" data-id="${esc(i.id)}" aria-label="Etkinliği sil">${icon('trash')}</button>` : ''}
    </li>`).join('');
  const canAdd = state.me.role === 'teacher' || state.me.role === 'principal';
  const dayTitle = new Date(`${selected}T00:00:00Z`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' });
  return { html: `${head('Takvim', 'Sınavlar, tatiller, toplantılar, etkinlikler ve ödev teslimleri tek takvimde.',
      canAdd ? `<button class="btn primary" type="button" data-action="event-new" data-day="${esc(selected)}">${icon('plus')}<span>Etkinlik ekle</span></button>` : '')}
    <div class="cal-layout">
      <section class="panel">
        <div class="cal-head">
          <button class="icon-btn" type="button" data-action="cal-nav" data-y="${prev[0]}" data-m="${prev[1]}" aria-label="Önceki ay">‹</button>
          <strong class="cal-title">${esc(monthLabel)}</strong>
          <button class="icon-btn" type="button" data-action="cal-nav" data-y="${next[0]}" data-m="${next[1]}" aria-label="Sonraki ay">›</button>
        </div>
        <div class="cal-weekdays">${['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cts', 'Paz'].map(d => `<span>${d}</span>`).join('')}</div>
        <div class="cal-grid">${grid}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h2>${esc(dayTitle)}</h2><small class="muted">${dayItems.length} kayıt</small></div></div>
        ${dayItems.length ? `<ul class="cal-list">${agenda}</ul>` : empty('Bu gün boş', 'Bu güne etkinlik eklemek için "Etkinlik ekle" düğmesini kullanın.')}
      </section>
    </div>` };
}

ACTIONS['cal-nav'] = el => setQuery('takvim', { y: el.dataset.y, m: el.dataset.m });
ACTIONS['cal-day'] = el => setQuery('takvim', { y: el.dataset.y, m: el.dataset.m, d: el.dataset.day });
ACTIONS['event-new'] = el => {
  const day = el.dataset.day || isoDay(new Date());
  const classes = state.me.role === 'teacher' ? teacherClasses() : state.classes;
  openModal('Etkinlik ekle', `<form class="stack" data-form="event-create">
    <label class="field"><span>Başlık</span><input name="title" required minlength="2" maxlength="140" placeholder="Örn. 6/A kısa sınav"></label>
    <div class="grid-2">
      <label class="field"><span>Tür</span><select name="kind">${Object.entries(KIND_LABEL).filter(([k]) => k !== 'odev').map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      <label class="field"><span>Tarih</span><input name="date" type="date" required value="${esc(day)}"></label>
    </div>
    <label class="field"><span>Sınıf</span><select name="classId">${state.me.role === 'principal' ? '<option value="">Okul geneli</option>' : ''}${classes.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Açıklama</span><input name="description" maxlength="500" placeholder="İsteğe bağlı"></label>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Kaydet</button></div>
  </form>`);
};
FORMS['event-create'] = async form => {
  const classId = val(form, 'classId');
  await api('/calendar', { method: 'POST', body: { title: val(form, 'title').trim(), kind: val(form, 'kind'), date: val(form, 'date'), classId: classId || null, description: val(form, 'description').trim() } });
  closeModal();
  toast('Etkinlik eklendi');
  refresh();
};
ACTIONS['event-del'] = async el => {
  const yes = await confirmDialog('Etkinliği sil', 'Bu etkinlik takvimden kaldırılacak.');
  if (!yes) return;
  await api(`/calendar/${el.dataset.id}`, { method: 'DELETE' });
  toast('Etkinlik silindi');
  refresh();
};

async function pageKarne(params) {
  const id = params.id || state.me.id;
  const data = await api(`/reports/student/${encodeURIComponent(id)}`);
  const grades = data.grades.subjects.map(s => `<tr><td>${esc(s.subjectName)}</td><td>${s.count}</td><td><strong>${s.average}</strong></td></tr>`).join('');
  const attendance = data.attendance.subjects.map(s => `<tr><td>${esc(s.subjectName)}</td><td>${s.total}</td><td>${s.present}</td><td>${pct(s.present, s.total) === null ? '—' : `%${pct(s.present, s.total)}`}</td></tr>`).join('');
  const notes = data.notes.map(n => `<li><small class="muted">${esc(fmtDate(n.createdAt))} · ${esc(n.teacherName || '')}</small><p>${esc(n.body)}</p></li>`).join('');
  return { html: `<div class="no-print print-bar"><a class="btn ghost" href="javascript:history.back()">← Geri</a><a class="btn ghost" href="/api/reports/student/${esc(data.student.id)}/pdf" download>PDF indir</a><button class="btn primary" type="button" data-action="print">${icon('file')}<span>Yazdır / PDF olarak kaydet</span></button></div>
    <article class="report-sheet">
      <header class="report-head">
        <div><p class="eyebrow">Öğrenci karnesi</p><h1>${esc(data.student.name)}</h1><p class="muted">${esc(data.student.className || 'Sınıfsız')} · Okul no: ${esc(data.student.studentNo || '—')}</p></div>
        <div class="report-date">Oluşturulma: ${esc(fmtDate(data.generatedAt))}</div>
      </header>
      <section><h2>Derslere göre başarı</h2>${grades ? `<table class="table report-table"><thead><tr><th>Ders</th><th>Not sayısı</th><th>Ortalama</th></tr></thead><tbody>${grades}</tbody></table>` : '<p class="muted">Henüz not yok.</p>'}</section>
      <section><h2>Devam</h2>${attendance ? `<table class="table report-table"><thead><tr><th>Ders</th><th>Toplam ders</th><th>Geldi</th><th>Devam</th></tr></thead><tbody>${attendance}</tbody></table>` : '<p class="muted">Henüz yoklama yok.</p>'}</section>
      <section><h2>Davranış</h2><p>Toplam puan: <strong>${data.behavior.total}</strong> · Olumlu: ${data.behavior.positive} · Olumsuz: ${data.behavior.negative}</p>
        <p>Rozetler: ${data.behavior.badges.length ? data.behavior.badges.map(b => esc(b)).join(', ') : 'Henüz rozet yok'}</p></section>
      <section><h2>Öğretmen notları</h2>${notes ? `<ul class="report-notes">${notes}</ul>` : '<p class="muted">Veliyle paylaşılmış not yok.</p>'}</section>
    </article>` };
}
ACTIONS['print'] = () => window.print();

// ---------- Canlı yarışma (Kahoot tarzı) (v17) ----------
const LIVE_SHAPES = [['▲', 'live-red'], ['◆', 'live-blue'], ['●', 'live-yellow'], ['■', 'live-green']];
let liveCtx = null;
let liveOffset = 0; // sunucu saati - istemci saati (sayaçların doğru akması için)

function tickLiveTimers() {
  document.querySelectorAll('[data-ends]').forEach(el => {
    const left = Math.max(0, Math.ceil((new Date(el.dataset.ends).getTime() - (Date.now() + liveOffset)) / 1000));
    const label = el.querySelector('span');
    if (label) label.textContent = String(left);
    el.classList.toggle('late', left <= 5);
  });
}

// Durumu düzenli çeker; yalnızca değişince yeniden çizer (telefonda titremeyi önler).
function startLive(id, render) {
  const ctx = { id, render, last: null, tick: null };
  liveCtx = ctx;
  ctx.tick = async () => {
    try {
      const s = await api(`/live/${id}/state`);
      if (liveCtx !== ctx) return;
      liveOffset = new Date(s.serverNow).getTime() - Date.now();
      const key = JSON.stringify(s);
      if (key !== ctx.last) {
        ctx.last = key;
        const root = document.querySelector('#liveRoot');
        if (root) root.innerHTML = render(s);
      }
      tickLiveTimers();
    } catch (error) {
      if (liveCtx !== ctx) return;
      const root = document.querySelector('#liveRoot');
      if (root) root.innerHTML = `<div class="empty"><h3>Yarışmaya bağlanılamadı</h3><p>${esc(error.message)}</p></div>`;
    }
  };
  ctx.tick();
  every(ctx.tick, 2000);
  every(tickLiveTimers, 250);
}

async function pageCanli(params) {
  if (state.me.role === 'student') return params.id ? livePlayerPage(params.id) : liveJoinPage();
  if (!params.id) {
    return { html: `${head('Canlı yarışma', 'Bir sınavın yanında "Canlı başlat" düğmesine basarak yarışmayı açın.', '<a class="btn ghost" href="#/sinavlar">Sınavlara git</a>')}${panel('Canlı yarışma', '', empty('Yarışma seçilmedi', 'Yarışmayı sınavlar sayfasından başlatabilirsiniz.'))}` };
  }
  return {
    html: `${head('Canlı yarışma', 'Bu ekranı projeksiyonda gösterin. Öğrenciler telefonlarından şıklara dokunur.', '<a class="btn ghost" href="#/sinavlar">← Sınavlar</a>')}<div id="liveRoot" class="live-root"><div class="loading">Yükleniyor…</div></div>`,
    after: () => startLive(params.id, hostHtml),
  };
}

function hostHtml(s) {
  const boardPanel = `<aside class="live-board"><h3>Liderlik</h3>${s.leaderboard.length
    ? `<ol>${s.leaderboard.map((p, i) => `<li><span class="lb-rank">${i + 1}</span><strong>${esc(p.name)}</strong><span>${p.score}</span></li>`).join('')}</ol>`
    : '<p class="muted small">Henüz puan yok</p>'}</aside>`;
  if (s.status === 'lobby') {
    return `<section class="live-stage">
      <p class="eyebrow">${esc(s.className)} · ${esc(s.subjectName)}</p>
      <h2 class="live-title">${esc(s.quizTitle)}</h2>
      <div class="live-pin"><span>YARIŞMA PIN</span><strong>${esc(s.pin)}</strong></div>
      <p class="muted">Öğrenciler telefonlarından <b>Canlı yarışma</b> sayfasına gidip bu PIN'i girer.</p>
      <div class="live-players">${(s.players || []).map(p => `<span class="live-chip">${esc(p.name)}</span>`).join('') || '<span class="muted">Henüz kimse katılmadı</span>'}</div>
      <div class="live-foot">
        <button class="btn primary lg" type="button" data-action="live-start" data-id="${esc(s.id)}">Yarışmayı başlat (${s.playersCount} katılımcı)</button>
        <button class="btn ghost" type="button" data-action="live-end" data-id="${esc(s.id)}">İptal et</button>
      </div>
    </section>`;
  }
  if (s.status === 'finished') {
    return `<section class="live-stage">
      <p class="eyebrow">Yarışma bitti</p>
      <h2 class="live-title">${esc(s.quizTitle)}</h2>
      <div class="podium">${s.leaderboard.slice(0, 3).map((p, i) => `<div class="podium-step p${i + 1}"><b>${i + 1}</b><strong>${esc(p.name)}</strong><span>${p.score} puan</span></div>`).join('')}</div>
      <p class="muted">Katılımcıların doğru cevap puanları sınav sonucu olarak kaydedildi.</p>
      <div class="live-foot"><a class="btn primary" href="#/sinavlar">Sınavlara dön</a></div>
    </section>${boardPanel}`;
  }
  const question = s.question;
  const reveal = s.status === 'reveal';
  const options = question.options.map((text, i) => {
    const [shape, cls] = LIVE_SHAPES[i];
    const correct = reveal && question.correctIndex === i;
    return `<div class="live-option ${cls} ${correct ? 'correct' : ''} ${reveal && !correct ? 'dim' : ''}">
      <span class="live-shape">${shape}</span><span class="live-text">${esc(text)}</span>${reveal ? `<b class="live-count">${s.breakdown[i]}</b>` : ''}</div>`;
  }).join('');
  const timer = s.status === 'question'
    ? `<div class="live-timer" data-ends="${esc(s.endsAt)}"><span>--</span></div>`
    : '<div class="live-timer"><span>✓</span></div>';
  const action = reveal
    ? `<button class="btn primary lg" type="button" data-action="live-next" data-id="${esc(s.id)}">${s.index + 1 < s.total ? 'Sonraki soru' : 'Yarışmayı bitir'}</button>`
    : `<button class="btn primary lg" type="button" data-action="live-reveal" data-id="${esc(s.id)}">Cevabı göster</button>`;
  return `<section class="live-stage">
      <header class="live-head"><span class="live-counter">Soru ${s.index + 1} / ${s.total} · ${question.points} puan</span>${timer}<span class="live-answers">${s.answered} / ${s.playersCount} yanıt</span></header>
      <h2 class="live-question">${esc(question.text)}</h2>
      ${question.imageUrl ? `<img class="live-image" src="${esc(question.imageUrl)}" alt="Soru görseli">` : ''}
      <div class="live-options">${options}</div>
      <footer class="live-foot">${action}<button class="btn ghost" type="button" data-action="live-end" data-id="${esc(s.id)}">Yarışmayı sonlandır</button></footer>
    </section>${boardPanel}`;
}

function liveJoinPage() {
  return { html: `${head('Canlı yarışma', 'Öğretmeninizin ekranındaki 6 haneli PIN kodunu girin.')}
    <section class="panel join-panel"><div class="pad join-box">
      <span class="kicker">PIN ile katıl</span>
      <form class="join-form" data-form="live-join">
        <input name="pin" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="000000" required autocomplete="off" aria-label="Yarışma PIN kodu">
        <button class="btn primary lg" type="submit">Katıl</button>
      </form>
      <p class="form-error" data-error role="alert"></p>
    </div></section>` };
}

function livePlayerPage(id) {
  return { html: '<div id="liveRoot" class="live-root play-root"><div class="loading">Bağlanılıyor…</div></div>', after: () => startLive(id, playerHtml) };
}

// Telefon ekranı: yalnızca şıklar. Soru metni ve görsel öğretmenin ekranındadır.
function playerHtml(s) {
  if (s.status === 'lobby') {
    return `<section class="play-screen"><p class="play-hi">Merhaba ${esc(firstName(state.me.name))}!</p>
      <h2>Öğretmen yarışmayı başlatınca soru gelecek</h2><div class="play-wait"><i></i><i></i><i></i></div>
      <p class="muted">${esc(s.quizTitle)}</p></section>`;
  }
  if (s.status === 'question') {
    if (s.answered) return '<section class="play-screen"><div class="play-check">✓</div><h2>Cevabın gönderildi</h2><p class="muted">Sonucu öğretmen gösterdiğinde öğreneceksin.</p></section>';
    return `<section class="play-screen play-options">
      <div class="play-timer" data-ends="${esc(s.endsAt)}"><span>--</span></div>
      <div class="play-grid">${s.options.map((text, i) => {
        const [shape, cls] = LIVE_SHAPES[i];
        return `<button class="play-tile ${cls}" type="button" data-action="live-answer" data-id="${esc(s.id)}" data-index="${i}"><span class="live-shape">${shape}</span><span>${esc(text)}</span></button>`;
      }).join('')}</div></section>`;
  }
  if (s.status === 'reveal') {
    const headline = !s.answered ? 'Süre doldu' : s.myCorrect ? 'Doğru!' : 'Yanlış';
    const mark = !s.answered ? '–' : s.myCorrect ? '✓' : '✕';
    return `<section class="play-screen"><div class="play-result ${s.myCorrect ? 'ok' : 'bad'}">${mark}</div><h2>${headline}</h2>
      ${s.myCorrect ? `<p class="play-points">+${s.myPoints} puan</p>` : ''}
      <p class="muted">Doğru cevap: <b>${esc(s.options[s.correctIndex])}</b></p>
      <p>Toplam <b>${s.score}</b> puan · ${s.rank}. sırada</p></section>`;
  }
  return `<section class="play-screen"><p class="play-hi">Yarışma bitti!</p><h2>${s.rank}. oldun</h2><p>Toplam <b>${s.score}</b> puan</p></section>`;
}

const liveAct = name => async el => {
  await api(`/live/${el.dataset.id}/${name}`, { method: 'POST', body: {} });
  if (liveCtx) liveCtx.last = null;
  await liveCtx?.tick();
};
ACTIONS['live-create'] = async el => {
  const { id, pin } = await api('/live', { method: 'POST', body: { quizId: el.dataset.id } });
  toast(`Yarışma açıldı · PIN ${pin}`);
  setQuery('canli', { id });
};
ACTIONS['live-start'] = liveAct('start');
ACTIONS['live-reveal'] = liveAct('reveal');
ACTIONS['live-next'] = liveAct('next');
ACTIONS['live-end'] = async el => {
  const yes = await confirmDialog('Yarışmayı sonlandır', 'Yarışma şimdi bitirilecek ve katılımcıların sonuçları sınav notlarına yazılacak.');
  if (yes) await liveAct('end')(el);
};
ACTIONS['live-answer'] = async el => {
  el.disabled = true;
  await api(`/live/${el.dataset.id}/answer`, { method: 'POST', body: { selected: Number(el.dataset.index) } });
  if (liveCtx) liveCtx.last = null;
  await liveCtx?.tick();
};
FORMS['live-join'] = async form => {
  const { id } = await api('/live/join', { method: 'POST', body: { pin: val(form, 'pin').trim() } });
  toast('Yarışmaya katıldın');
  setQuery('canli', { id });
};

// ---------- Bildirim ayarları (v17) ----------
ACTIONS['notify-settings'] = async () => {
  const subscribed = await isSubscribed();
  const permission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  const label = { granted: 'verildi', denied: 'engellendi', default: 'henüz sorulmadı', unsupported: 'desteklenmiyor' }[permission];
  openModal('Bildirim ayarları', `<div class="stack">
    <p class="muted small">Tarayıcı izni: <strong>${esc(label)}</strong></p>
    <label class="switch switch-line"><input type="checkbox" data-change="notifyToggle" ${subscribed ? 'checked' : ''}><span class="switch-ui" aria-hidden="true"></span>
      <span><strong>Bildirimleri aç</strong><small>Canlı yarışma, yeni sınav ve puan bildirimleri.</small></span></label>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="notify-test">Test bildirimi gönder</button><button class="btn primary" type="button" data-action="close-modal">Tamam</button></div>
  </div>`);
};
CHANGES.notifyToggle = async el => {
  try {
    if (el.checked) await enablePush();
    else await disablePush();
    toast(el.checked ? 'Bildirimler açıldı' : 'Bildirimler kapatıldı');
  } catch (error) {
    el.checked = !el.checked;
    toast(error.message, 'error');
  }
};
ACTIONS['notify-test'] = async () => {
  await api('/push/test', { method: 'POST', body: {} });
  toast('Test bildirimi gönderildi');
};

// ---------- Güvenlik ve veri hakları (v20) ----------
ACTIONS['forgot-open'] = () => openModal('Şifremi unuttum', `<form class="stack" data-form="forgot">
    <p class="muted small">Hesabınıza kayıtlı e-posta adresini girin. Size 6 haneli bir sıfırlama kodu göndereceğiz.</p>
    <label class="field"><span>E-posta</span><input name="email" type="email" required maxlength="120" autocomplete="email"></label>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Kod gönder</button></div>
  </form>`);

FORMS.forgot = async form => {
  const email = val(form, 'email').trim();
  await api('/password/forgot', { method: 'POST', body: { email } });
  closeModal();
  openResetModal(email);
  toast('Kayıtlıysa e-postanıza kod gönderildi');
};

function openResetModal(email) {
  openModal('Yeni şifre belirle', `<form class="stack" data-form="reset">
    <label class="field"><span>E-posta</span><input name="email" type="email" required maxlength="120" value="${esc(email)}"></label>
    <label class="field"><span>Doğrulama kodu</span><input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="one-time-code"></label>
    <label class="field"><span>Yeni şifre</span><input name="password" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></label>
    <p class="muted small">En az 8 karakter, harf ve rakam içermeli.</p>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Şifreyi değiştir</button></div>
  </form>`);
}

FORMS.reset = async form => {
  await api('/password/reset', { method: 'POST', body: { email: val(form, 'email').trim(), code: val(form, 'code').trim(), password: val(form, 'password') } });
  closeModal();
  toast('Şifreniz değiştirildi. Yeni şifrenizle giriş yapabilirsiniz.');
};

ACTIONS['email-open'] = () => openModal('E-posta adresi', `<form class="stack" data-form="email-save">
    <p class="muted small">Şifre sıfırlama kodu bu adrese gönderilir. Boş bırakırsanız adres silinir.</p>
    <label class="field"><span>E-posta</span><input name="email" type="email" maxlength="120" autocomplete="email"></label>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Kaydet</button></div>
  </form>`);

FORMS['email-save'] = async form => {
  await api('/me/email', { method: 'POST', body: { email: val(form, 'email').trim() } });
  closeModal();
  toast('E-posta adresi kaydedildi');
};

ACTIONS['mfa-open'] = async () => {
  if (!state.me.totpEnabled) {
    try {
      const { secret, uri } = await api('/me/2fa/setup', { method: 'POST', body: {} });
      openModal('İki adımlı doğrulamayı aç', `<form class="stack" data-form="mfa-enable">
        <p class="muted small">Google Authenticator, Microsoft Authenticator veya benzeri bir uygulamaya bu anahtarı ekleyin:</p>
        <p><code>${esc(secret)}</code></p>
        <p class="muted small">Uygulama kurulumunda adres olarak şunu da kullanabilirsiniz: <code>${esc(uri)}</code></p>
        <label class="field"><span>Uygulamadaki 6 haneli kod</span><input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="one-time-code"></label>
        <p class="form-error" data-error role="alert"></p>
        <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Etkinleştir</button></div>
      </form>`);
    } catch (error) {
      toast(error.message, 'error');
    }
    return;
  }
  openModal('İki adımlı doğrulamayı kapat', `<form class="stack" data-form="mfa-disable">
    <label class="field"><span>Şifreniz</span><input name="password" type="password" required autocomplete="current-password"></label>
    <label class="field"><span>Uygulamadaki 6 haneli kod</span><input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="one-time-code"></label>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Kapat</button></div>
  </form>`);
};

FORMS['mfa-enable'] = async form => {
  await api('/me/2fa/enable', { method: 'POST', body: { code: val(form, 'code').trim() } });
  closeModal();
  toast('İki adımlı doğrulama açıldı');
};

FORMS['mfa-disable'] = async form => {
  await api('/me/2fa/disable', { method: 'POST', body: { password: val(form, 'password'), code: val(form, 'code').trim() } });
  closeModal();
  toast('İki adımlı doğrulama kapatıldı');
};

ACTIONS['calendar-link'] = async () => {
  const { url } = await api('/me/calendar-link', { method: 'POST', body: {} });
  openModal('Takvim bağlantısı', `<div class="stack">
    <p class="muted small">Bu adresi Google Takvim, Apple Takvim veya Outlook'ta "URL ile takvim ekle" ya da "internetten takvim" seçeneğine yapıştırın. Bağlantıyı kimseyle paylaşmayın.</p>
    <p><code>${esc(url)}</code></p>
    <div class="form-actions"><button class="btn primary" type="button" data-action="close-modal">Tamam</button></div>
  </div>`);
};

ACTIONS['delete-request'] = async () => {
  const yes = await confirmDialog('Hesap silme talebi', 'Talebiniz okul müdürü tarafından onaylanınca hesabınız ve kişisel verileriniz kalıcı olarak anonimleştirilir. Bu işlem geri alınamaz.');
  if (!yes) return;
  await api('/me/delete-request', { method: 'POST', body: {} });
  toast('Talebiniz müdüre iletildi');
};

ACTIONS['deletion-open'] = async () => {
  const { requests } = await api('/deletion-requests');
  openModal('Silme talepleri', `<div class="stack">${requests.length ? requests.map(r => `<div class="list-row">
      <div class="list-main"><strong>${esc(r.userName)}</strong><small class="muted">${esc(fmtDate(r.createdAt))} · ${esc(r.status)}</small></div>
      ${r.status === 'bekliyor' ? `<div class="row-actions">
        <button class="btn ghost sm" type="button" data-action="deletion-decide" data-id="${esc(r.id)}" data-approve="0">Reddet</button>
        <button class="btn primary sm" type="button" data-action="deletion-decide" data-id="${esc(r.id)}" data-approve="1">Onayla ve anonimleştir</button>
      </div>` : ''}
    </div>`).join('') : '<p class="muted">Bekleyen talep yok.</p>'}</div>`);
};

ACTIONS['deletion-decide'] = async el => {
  const approve = el.dataset.approve === '1';
  const yes = await confirmDialog(approve ? 'Hesabı anonimleştir' : 'Talebi reddet', approve
    ? 'Hesap kalıcı olarak anonimleştirilecek: ad, kullanıcı adı ve e-posta silinecek, giriş yapılamayacak.'
    : 'Talep reddedilecek ve hesap olduğu gibi kalacak.');
  if (!yes) return;
  await api(`/deletion-requests/${el.dataset.id}/decide`, { method: 'POST', body: { approve } });
  toast('Karar kaydedildi');
  ACTIONS['deletion-open']();
};

// KVKK: giriş sonrası aydınlatma metni onayı. Onaylanmadan veriler kullanılmaya devam etmez (istemci tarafı kapı).
export async function ensureKvkk() {
  const { notice, accepted } = await api('/kvkk');
  if (accepted) return;
  openModal(notice.title, `<form class="stack" data-form="kvkk" data-version="${esc(notice.version)}">
    <p class="muted small">${esc(notice.intro)}</p>
    <div class="kvkk-text">${notice.sections.map(s => `<h4>${esc(s.title)}</h4><p>${esc(s.text)}</p>`).join('')}</div>
    <label class="switch switch-line"><input type="checkbox" name="accept"><span class="switch-ui" aria-hidden="true"></span>
      <span><strong>Okudum, anladım.</strong><small>Kişisel verilerimin bu metne göre işlenmesini kabul ediyorum.</small></span></label>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn primary" type="submit">Devam et</button></div>
  </form>`);
}

FORMS.kvkk = async form => {
  if (!form.querySelector('[name=accept]').checked) throw new Error('Devam etmek için metni okuduğunuzu onaylayın.');
  await api('/kvkk/accept', { method: 'POST', body: { version: form.dataset.version } });
  closeModal();
  toast('Teşekkürler. Verileriniz aydınlatma metnine göre işlenir.');
};


// ---------- Müdür analizi (v21) ----------
async function pageAnaliz() {
  const data = await api('/analytics/school');
  const attendanceRows = data.classes.map(c => ({ label: c.name, value: c.attendanceRate ?? 0 }));
  const quizRows = data.classes.filter(c => c.quizAverage != null).map(c => ({ label: c.name, value: c.quizAverage }));
  const absentRows = data.topAbsent.map(a => `<li class="list-row">
      <div class="list-main"><strong>${esc(a.studentName)}</strong><small class="muted">${esc(a.className)} · son 30 gün</small></div>
      ${badge(`${a.absences} / ${a.total} ders`, 'danger')}
    </li>`).join('');
  return { html: `${head('Okul analizi', 'Son 30 günün devam ve sınav özeti. Tüm sınıflar.')}
    <div class="stats">
      ${stat('Okul devamı', data.schoolAttendanceRate == null ? '—' : `%${data.schoolAttendanceRate}`, 'Son 30 gün', 'check')}
      ${stat('Sınıf', data.classes.length, 'Kayıtlı sınıf', 'school')}
      ${stat('Öğrenci', data.classes.reduce((n, c) => n + c.students, 0), 'Tüm sınıflarda', 'users')}
      ${stat('Devamsız öğrenci', data.topAbsent.length, 'En çok devamsızlık (ilk 10)', 'chart')}
    </div>
    <div class="two-col">
      ${panel('Sınıflara göre devam', '%', `<div class="pad">${barRows(attendanceRows, { emptyText: 'Henüz yoklama yok' })}</div>`)}
      ${panel('Sınıflara göre sınav ortalaması', '%', `<div class="pad">${barRows(quizRows, { emptyText: 'Henüz sınav sonucu yok' })}</div>`)}
    </div>
    ${panel('En çok devamsızlığı olan öğrenciler', '', absentRows ? `<ul class="list">${absentRows}</ul>` : empty('Devamsızlık yok', 'Son 30 günde kayıtlı devamsızlık bulunmuyor.'))}` };
}

ACTIONS['mail-test'] = async () => {
  try {
    const result = await api('/mail/test', { method: 'POST', body: {} });
    toast(`Test e-postası gönderildi: ${result.to}`);
  } catch (error) {
    toast(error.message, 'error');
  }
};

// ---------- Pansiyon: evci ve çarşı izni defteri (v25) ----------
const LEAVE_KINDS = { evci: 'Evci izni', carsi: 'Çarşı izni' };
const LEAVE_STATUS = { bekliyor: 'Bekliyor', onaylandi: 'Onaylı', reddedildi: 'Reddedildi', iptal: 'İptal', disarida: 'Dışarıda', tamamlandi: 'Döndü' };
const LEAVE_TONE = { onaylandi: 'ok', reddedildi: 'danger', disarida: 'warn', tamamlandi: 'ok' };
const SIGNER_LABEL = { ogrenci: 'Öğrenci', veli: 'Veli', diger: 'Diğer' };
const localInput = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

// E-imza alanı: dokunmatik ve fare ile çizim (pointer olayları)
function initSignature() {
  const canvas = document.querySelector('canvas[data-signature]');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#11231d';
  let drawing = false;
  let last = null;
  const point = event => {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };
  canvas.addEventListener('pointerdown', event => {
    drawing = true;
    last = point(event);
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!drawing) return;
    const next = point(event);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    last = next;
    canvas.dataset.dirty = '1';
  });
  const stop = () => { drawing = false; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
}

async function pageIzin() {
  const { enabled } = await api('/boarding');
  const role = state.me.role;
  const staff = role === 'principal' || role === 'teacher';
  const admin = role === 'principal';
  const canRequest = (role === 'student' || role === 'parent') && enabled;
  const actions = [
    canRequest ? `<button class="btn primary" type="button" data-action="leave-new">${icon('plus')}<span>Yeni izin talebi</span></button>` : '',
    staff && enabled ? '<button class="btn ghost" type="button" data-action="gece-open">Gece yoklaması</button>' : '',
    staff && enabled ? '<a class="btn ghost" href="/api/leaves/export" download>CSV indir</a>' : '',
    admin ? `<button class="btn ghost" type="button" data-action="boarding-toggle" data-on="${enabled ? '0' : '1'}">${enabled ? 'Pansiyon modunu kapat' : 'Pansiyon modunu aç'}</button>` : '',
  ].join('');
  const header = head('İzin defteri', enabled ? 'Evci ve çarşı izinleri: talep, onay, çıkış ve dönüş e-imzası.' : 'Bu özellik pansiyonlu okullar içindir.', actions);
  if (!enabled) {
    return { html: `${header}${panel('Pansiyon modu kapalı', '', empty('Pansiyon modu kapalı', admin ? 'Okulunuz pansiyonluysa yukarıdaki düğmeyle açın.' : 'Okul yönetimi pansiyon modunu açtığında izin talepleri burada görünür.'))}` };
  }
  const { leaves } = await api('/leaves');
  const groups = staff ? [
    ['Onay bekleyen talepler', leaves.filter(l => l.canDecide)],
    ['Çıkış imzası bekleyen (onaylı)', leaves.filter(l => l.canExit)],
    ['Dışarıdaki öğrenciler (dönüş imzası bekliyor)', leaves.filter(l => l.canReturn)],
  ] : [];
  const sections = groups.filter(([, items]) => items.length)
    .map(([title, items]) => panel(title, `${items.length} kayıt`, `<ul class="list">${items.map(leaveRowHtml).join('')}</ul>`)).join('');
  const all = panel('Tüm kayıtlar', `${leaves.length} kayıt`, leaves.length
    ? `<ul class="list">${leaves.map(leaveRowHtml).join('')}</ul>`
    : empty('Kayıt yok', 'Talep oluşturulduğunda burada görünür.'));
  return { html: `${header}${sections}${all}` };
}

function leaveRowHtml(l) {
  const span = `${fmtDate(l.startsAt)} → ${fmtDate(l.endsAt)}`;
  const signed = [
    l.exitAt ? `Çıkış: ${fmtDate(l.exitAt)} · ${esc(l.exitName || '')} ${esc(l.exitSurname || '')} (${esc(SIGNER_LABEL[l.exitSigner] || '')})` : '',
    l.returnAt ? `Dönüş: ${fmtDate(l.returnAt)} · ${esc(l.returnName || '')} ${esc(l.returnSurname || '')}` : '',
  ].filter(Boolean).join(' · ');
  const staffView = state.me.role === 'principal' || state.me.role === 'teacher';
  const actions = [
    l.canDecide ? `<button class="btn ghost sm" type="button" data-action="leave-decide" data-id="${esc(l.id)}" data-approve="0">Reddet</button><button class="btn primary sm" type="button" data-action="leave-decide" data-id="${esc(l.id)}" data-approve="1">Onayla</button>` : '',
    l.canExit ? `<button class="btn primary sm" type="button" data-action="leave-sign" data-mode="exit" data-id="${esc(l.id)}">Çıkış imzası</button>` : '',
    l.canReturn ? `<button class="btn primary sm" type="button" data-action="leave-sign" data-mode="return" data-id="${esc(l.id)}">Dönüş imzası</button>` : '',
    l.canCancel ? `<button class="btn ghost sm" type="button" data-action="leave-cancel" data-id="${esc(l.id)}">İptal et</button>` : '',
    staffView && (l.exitAt || l.returnAt) ? `<button class="btn ghost sm" type="button" data-action="leave-signatures" data-id="${esc(l.id)}">İmzalar</button>` : '',
  ].join('');
  return `<li class="list-row">
    <div class="list-main"><strong>${esc(l.studentName)}${l.className ? ` · ${esc(l.className)}` : ''}</strong>
      <small class="muted">${esc(LEAVE_KINDS[l.kind] || l.kind)} · ${esc(span)}${l.reason ? ` · ${esc(l.reason)}` : ''}</small>
      ${signed ? `<small class="muted">${signed}</small>` : ''}</div>
    <div class="row-actions">${badge(LEAVE_STATUS[l.status] || l.status, LEAVE_TONE[l.status] || '')}${actions}</div>
  </li>`;
}

ACTIONS['boarding-toggle'] = async el => {
  await api('/boarding', { method: 'PUT', body: { enabled: el.dataset.on === '1' } });
  toast(el.dataset.on === '1' ? 'Pansiyon modu açıldı' : 'Pansiyon modu kapatıldı');
  refresh();
};

ACTIONS['leave-decide'] = async el => {
  await api(`/leaves/${el.dataset.id}/decide`, { method: 'POST', body: { approve: el.dataset.approve === '1' } });
  toast('Karar kaydedildi');
  refresh();
};

ACTIONS['leave-cancel'] = async el => {
  const yes = await confirmDialog('İzin talebini iptal et', 'Talep iptal edilecek.');
  if (!yes) return;
  await api(`/leaves/${el.dataset.id}/cancel`, { method: 'POST', body: {} });
  toast('Talep iptal edildi');
  refresh();
};

ACTIONS['leave-new'] = async () => {
  let students = '';
  if (state.me.role === 'parent') {
    const data = await api('/parent/children');
    const children = Array.isArray(data) ? data : (data.children || []);
    students = `<label class="field"><span>Öğrenci</span><select name="studentId">${children.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>`;
  }
  const now = new Date();
  openModal('Yeni izin talebi', `<form class="stack" data-form="leave-new">
    ${students}
    <label class="field"><span>İzin türü</span><select name="kind"><option value="evci">Evci izni</option><option value="carsi">Çarşı izni</option></select></label>
    <div class="grid-2">
      <label class="field"><span>Çıkış</span><input name="startsAt" type="datetime-local" required value="${localInput(new Date(now.getTime() + 3600e3))}"></label>
      <label class="field"><span>Dönüş</span><input name="endsAt" type="datetime-local" required value="${localInput(new Date(now.getTime() + 2 * 864e5))}"></label>
    </div>
    <label class="field"><span>Açıklama (isteğe bağlı)</span><input name="reason" maxlength="300"></label>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Talep gönder</button></div>
  </form>`);
};

FORMS['leave-new'] = async form => {
  const body = {
    kind: val(form, 'kind'),
    startsAt: new Date(val(form, 'startsAt')).toISOString(),
    endsAt: new Date(val(form, 'endsAt')).toISOString(),
    reason: val(form, 'reason').trim(),
  };
  if (form.querySelector('[name=studentId]')) body.studentId = val(form, 'studentId');
  await api('/leaves', { method: 'POST', body });
  closeModal();
  toast('İzin talebi gönderildi');
  refresh();
};

ACTIONS['leave-sign'] = el => {
  const mode = el.dataset.mode;
  openModal(mode === 'exit' ? 'Çıkış imzası' : 'Dönüş imzası', `<form class="stack" data-form="leave-sign" data-id="${esc(el.dataset.id)}" data-mode="${mode}">
    <p class="muted small">Çıkacak veya dönecek kişi bilgilerini yazıp ekrandaki alana imzasını atar.</p>
    <label class="field"><span>İmzalayan</span><select name="signerRole"><option value="ogrenci">Öğrenci</option><option value="veli">Veli</option><option value="diger">Diğer</option></select></label>
    <div class="grid-2">
      <label class="field"><span>Ad</span><input name="name" required maxlength="60" autocomplete="off"></label>
      <label class="field"><span>Soyad</span><input name="surname" required maxlength="60" autocomplete="off"></label>
    </div>
    <label class="field"><span>Öğrenci numarası (öğrenci imzalıyorsa zorunlu)</span><input name="studentNo" maxlength="20" autocomplete="off"></label>
    <div class="sig-wrap">
      <canvas class="sig-pad" data-signature width="640" height="220" aria-label="E-imza alanı"></canvas>
      <button class="btn ghost sm" type="button" data-action="sig-clear">Temizle</button>
    </div>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Kaydet ve imzala</button></div>
  </form>`);
  initSignature();
};

ACTIONS['sig-clear'] = () => {
  const canvas = document.querySelector('canvas[data-signature]');
  if (!canvas) return;
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  delete canvas.dataset.dirty;
};

FORMS['leave-sign'] = async form => {
  const canvas = form.querySelector('canvas[data-signature]');
  if (!canvas.dataset.dirty) throw new Error('Lütfen ekrana imzanızı atın.');
  const mode = form.dataset.mode;
  await api(`/leaves/${form.dataset.id}/${mode}`, { method: 'POST', body: {
    signerRole: val(form, 'signerRole'),
    name: val(form, 'name').trim(),
    surname: val(form, 'surname').trim(),
    studentNo: val(form, 'studentNo').trim(),
    signature: canvas.toDataURL('image/png'),
  } });
  closeModal();
  toast(mode === 'exit' ? 'Çıkış kaydedildi' : 'Dönüş kaydedildi');
  refresh();
};

ACTIONS['leave-signatures'] = async el => {
  const s = await api(`/leaves/${el.dataset.id}/signatures`);
  const block = (label, signer, name, surname, no, at, img) => img
    ? `<div class="stack"><strong>${esc(label)}</strong><small class="muted">${esc(fmtDate(at))} · ${esc(name || '')} ${esc(surname || '')} · ${esc(SIGNER_LABEL[signer] || '')}${no ? ` · No: ${esc(no)}` : ''}</small><img class="sig-img" alt="E-imza" src="${esc(img)}"></div>`
    : '';
  openModal('E-imzalar', `<div class="stack">${block('Çıkış', s.exitSigner, s.exitName, s.exitSurname, s.exitStudentNo, s.exitAt, s.exitSignature)}${block('Dönüş', s.returnSigner, s.returnName, s.returnSurname, s.returnStudentNo, s.returnAt, s.returnSignature)}</div>`);
};

// ---------- Pansiyon: gece yoklaması (v26) ----------
const NIGHT_LABEL = { var: 'Yatıyor', yok: 'Yok', izinli: 'İzinli' };
const istanbulToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());

async function pageGece(params) {
  const staffClasses = state.me.role === 'teacher' ? teacherClasses() : state.classes;
  if (!staffClasses.length) return { html: `${head('Gece yoklaması', 'Sınıf atandığında burada görünür.')}${panel('Sınıf yok', '', empty('Sınıf yok', 'Gece yoklaması için bir sınıfa atanmanız gerekir.'))}` };
  const classId = staffClasses.some(c => c.id === params.classId) ? params.classId : staffClasses[0].id;
  const date = params.date || istanbulToday();
  const { students, date: shownDate } = await api(`/night-roll?classId=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`);
  const select = `<select data-change="classPick" data-page="gece" aria-label="Sınıf seç">${staffClasses.map(c => `<option value="${esc(c.id)}" ${c.id === classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;
  const dateInput = `<input type="date" value="${esc(shownDate)}" data-change="geceDate" aria-label="Gece tarihi">`;
  const actions = `${dateInput}${select}<button class="btn primary" type="button" data-action="gece-save" data-class="${esc(classId)}" data-date="${esc(shownDate)}">Kaydet</button>`;
  const rows = students.map(s => `<li class="list-row" data-student="${esc(s.id)}" data-status="${esc(s.status || '')}">
      <div class="list-main"><strong>${esc(s.name)}</strong><small class="muted">${esc(s.studentNo || '')}${s.suggested ? ' · onaylı izin: izinli önerildi' : ''}</small></div>
      <div class="row-actions">${Object.entries(NIGHT_LABEL).map(([value, label]) => `<button type="button" class="seg-btn ${value} ${s.status === value ? 'on' : ''}" data-action="gece-set" data-value="${value}" aria-pressed="${s.status === value}">${label}</button>`).join('')}</div>
    </li>`).join('');
  return { html: `${head('Gece yoklaması', 'Yatılı öğrencileri gece yoklayın. "Yok" işaretlenenlerin velisine bildirim gider.', actions)}
    ${panel('Öğrenciler', `${students.length} öğrenci`, students.length ? `<ul class="list">${rows}</ul>` : empty('Öğrenci yok', 'Bu sınıfta kayıtlı öğrenci bulunmuyor.'))}` };
}

CHANGES.geceDate = el => setQuery('gece', { classId: document.querySelector('select[data-page=gece]')?.value || '', date: el.value });

ACTIONS['gece-set'] = el => {
  const row = el.closest('[data-student]');
  row.dataset.status = el.dataset.value;
  row.querySelectorAll('.seg-btn').forEach(button => {
    const on = button === el;
    button.classList.toggle('on', on);
    button.setAttribute('aria-pressed', String(on));
  });
};

ACTIONS['gece-save'] = async el => {
  const records = {};
  document.querySelectorAll('[data-student]').forEach(row => {
    if (row.dataset.status) records[row.dataset.student] = row.dataset.status;
  });
  await api('/night-roll', { method: 'PUT', body: { classId: el.dataset.class, date: el.dataset.date, records } });
  toast('Gece yoklaması kaydedildi');
  refresh();
};

ACTIONS['gece-open'] = () => setQuery('gece', {});

// ---------- Açık uçlu sorular: öğretmen puanlaması (v27) ----------
CHANGES.quizKind = el => { el.closest('.quiz-q').dataset.kind = el.value; };

ACTIONS['grade-open'] = async el => {
  const data = await api(`/quizzes/${el.dataset.id}/grading`);
  if (!data.questions.length) {
    toast('Bu sınavda açık uçlu soru yok');
    return;
  }
  const students = data.attempts.map(at => `<div class="grade-student">
      <strong>${esc(at.studentName)}</strong><small class="muted">Teslim: ${esc(fmtDate(at.submittedAt))}</small>
      ${data.questions.map(qq => {
        const answer = at.answers.find(x => x.questionId === qq.id);
        return `<div class="grade-answer">
          <small class="muted">${esc(qq.text)} · en çok ${qq.points} puan</small>
          <p class="grade-text">${answer?.textAnswer ? esc(answer.textAnswer) : '<span class="muted">Cevap yok</span>'}</p>
          <label class="field grade-input"><span>Puan</span>
            <input type="number" min="0" max="${qq.points}" step="1" data-attempt="${esc(at.attemptId)}" data-question="${esc(qq.id)}" value="${answer?.awarded ?? ''}"></label>
        </div>`;
      }).join('')}
    </div>`).join('');
  openModal('Açık uçlu soruların puanlanması', `<form class="stack" data-form="grade-save" data-id="${esc(el.dataset.id)}">
    ${students || '<p class="muted">Teslim edilmiş deneme yok.</p>'}
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Puanları kaydet</button></div>
  </form>`);
};

FORMS['grade-save'] = async form => {
  const grades = [];
  form.querySelectorAll('input[data-attempt]').forEach(input => {
    if (input.value === '') return;
    grades.push({ attemptId: input.dataset.attempt, questionId: input.dataset.question, points: Number(input.value) });
  });
  if (!grades.length) throw new Error('Kaydedilecek puan yok.');
  await api(`/quizzes/${form.dataset.id}/grade`, { method: 'POST', body: { grades } });
  closeModal();
  toast('Puanlar kaydedildi');
  refresh();
};

<<<<<<< Updated upstream
// ---------- Deneyler (v50): fizik ve kimya ----------
const LAB_CONCENTRATIONS = [0.05, 0.1, 0.2];

function labPhysicsHtml() {
  return `<div class="lab-grid">
    <div class="lab-controls" data-lab="fizik">
      <label class="field"><span>Başlangıç hızı: <b data-out="v">20</b> m/s</span><input type="range" min="1" max="100" value="20" data-in="v"></label>
      <label class="field"><span>Atış açısı: <b data-out="theta">45</b>°</span><input type="range" min="1" max="89" value="45" data-in="theta"></label>
      <label class="field"><span>Ortam</span><select data-in="g">
        <option value="9.81">Dünya (9,81 m/s²)</option><option value="1.62">Ay (1,62 m/s²)</option><option value="3.71">Mars (3,71 m/s²)</option>
      </select></label>
      <ul class="lab-results">
        <li>Menzil: <b data-res="range">–</b> m</li>
        <li>En yüksek nokta: <b data-res="height">–</b> m</li>
        <li>Uçuş süresi: <b data-res="time">–</b> s</li>
      </ul>
    </div>
    <canvas class="lab-canvas" data-canvas="fizik" aria-label="Eğik atış yörüngesi"></canvas>
  </div>`;
}

function labChemHtml() {
  const options = LAB_CONCENTRATIONS.map(c => `<option value="${c}" ${c === 0.1 ? 'selected' : ''}>${String(c).replace('.', ',')} mol/L</option>`).join('');
  return `<div class="lab-grid">
    <div class="lab-controls" data-lab="kimya">
      <label class="field"><span>Asit (HCl) derişimi</span><select data-in="ca">${options}</select></label>
      <label class="field"><span>Asit hacmi: <b data-out="va">25</b> mL</span><input type="range" min="5" max="50" step="1" value="25" data-in="va"></label>
      <label class="field"><span>Baz (NaOH) derişimi</span><select data-in="cb">${options}</select></label>
      <label class="field"><span>Eklenen baz: <b data-out="vb">0</b> mL</span><input type="range" min="0" max="60" step="0.5" value="0" data-in="vb"></label>
      <ul class="lab-results">
        <li>pH: <b data-res="ph">–</b></li>
        <li>Eşdeğerlik hacmi: <b data-res="veq">–</b> mL</li>
        <li>Durum: <b data-res="state">–</b></li>
      </ul>
    </div>
    <canvas class="lab-canvas" data-canvas="kimya" aria-label="Titrasyon pH eğrisi"></canvas>
  </div>`;
}

async function pageFizik() {
  return {
    html: `${head('Fizik laboratuvarı', 'Başlangıç hızı, açı ve ortama göre eğik atışın menzilini, yüksekliğini ve süresini hesaplayın.', '')}
      ${panel('Eğik atış', 'Değerleri değiştirin; yörünge grafiği anında güncellenir.', labPhysicsHtml())}`,
    after: setupLabs,
  };
}

async function pageKimya() {
  return {
    html: `${head('Kimya laboratuvarı', 'Periyodik tablodan elementleri çalışma alanına alın, birleştirin ve oluşan bileşiği görün.', '')}
      ${panel('Periyodik tablo ve birleşme', 'Bir elemente tıklayın ya da sürükleyin. İki parçayı birbirine yaklaştırıp bırakın.', chemGameHtml())}
      ${panel('Asit-baz titrasyonu', 'Güçlü asit (HCl) çözeltisine güçlü baz (NaOH) eklerken pH değişimini izleyin.', labChemHtml())}`,
    after: () => {
      setupLabs();
      setupChemGame();
    },
  };
}

// ---------- Bilgisayar laboratuvarı: sayı sistemleri, mantık kapıları, sıralama ----------
async function pageBilgisayar() {
  return {
    html: `${head('Bilgisayar laboratuvarı', 'Sayı sistemlerini, mantık kapılarını ve sıralama algoritmasını adım adım inceleyin.', '')}
      ${panel('Sayı sistemleri', 'Bir sayıyı seçtiğiniz tabandan yazın; diğer tabanlardaki karşılığı anında görünür.', `<div class="pad lab-computing" data-comp="sayi">
        <div class="grid-2">
          <label class="field"><span>Sayı</span><input data-in="sayi" value="255" autocomplete="off"></label>
          <label class="field"><span>Taban</span><select data-in="taban">
            <option value="10" selected>Onluk (10)</option><option value="2">İkili (2)</option><option value="8">Sekizli (8)</option><option value="16">Onaltılı (16)</option>
          </select></label>
        </div>
        <ul class="lab-results"><li>İkili: <b data-res="ikili">–</b></li><li>Sekizli: <b data-res="sekizli">–</b></li><li>Onluk: <b data-res="onlu">–</b></li><li>Onaltılı: <b data-res="onaltili">–</b></li></ul>
        <p class="lab-error" data-res="hata" role="alert"></p>
      </div>`)}
      ${panel('Mantık kapıları', 'Değişkenleri A, B, C… olarak yazın. Kullanılabilir: AND, OR, XOR, NOT, NAND, NOR, parantez.', `<div class="pad lab-computing" data-comp="mantik">
        <label class="field"><span>İfade</span><input data-in="ifade" value="(A AND B) OR NOT C" autocomplete="off"></label>
        <p class="lab-error" data-res="hata" role="alert"></p>
        <div class="table-scroll"><table class="truth-table"><thead data-res="baslik"></thead><tbody data-res="satirlar"></tbody></table></div>
      </div>`)}
      ${panel('Python terminali', 'Python yazın ve Çalıştır deyin. Desteklenenler: değişkenler, print, if, for, while, def, liste ve metin.', `<div class="pad lab-computing" data-comp="python">
        <div class="py-toolbar"><label class="field"><span>Hazır örnek</span><select data-py="ornek">
          <option value="">Seçin</option>
          <option value="merhaba">Merhaba dünya</option>
          <option value="fizzbuzz">FizzBuzz</option>
          <option value="fonksiyon">Fonksiyon</option>
          <option value="liste">Liste ve döngü</option>
          <option value="asal">Asal sayılar</option>
        </select></label></div>
        <div class="py-snippets" role="toolbar" aria-label="Hazır kod parçaları">
          <button class="btn ghost sm" type="button" data-action="py-snippet" data-snip="print">print</button>
          <button class="btn ghost sm" type="button" data-action="py-snippet" data-snip="if">if</button>
          <button class="btn ghost sm" type="button" data-action="py-snippet" data-snip="for">for</button>
          <button class="btn ghost sm" type="button" data-action="py-snippet" data-snip="while">while</button>
          <button class="btn ghost sm" type="button" data-action="py-snippet" data-snip="def">def</button>
          <button class="btn ghost sm" type="button" data-action="py-snippet" data-snip="liste">liste</button>
        </div>
        <div class="py-editor">
          <pre class="py-hl" aria-hidden="true" data-py="hl"></pre>
          <textarea class="py-code" data-py="kod" rows="8" spellcheck="false" aria-label="Python kodu">print("Merhaba dünya")</textarea>
        </div>
        <p class="py-hint" data-py="ipucu" role="note"></p>
        <div class="py-actions"><button class="btn primary sm" type="button" data-action="py-run">Çalıştır</button><button class="btn ghost sm" type="button" data-action="py-clear-code">Kodu temizle</button><button class="btn ghost sm" type="button" data-action="py-clear">Çıktıyı temizle</button></div>
        <pre class="py-output" data-py="cikti" role="log" aria-live="polite"></pre>
      </div>`)}
      ${panel('Kabarcık sıralama', 'Sayıları virgülle yazın ve adımları izleyin.', `<div class="pad lab-computing" data-comp="siralama">
        <label class="field"><span>Sayılar</span><input data-in="liste" value="5,1,4,2,8" autocomplete="off"></label>
        <div class="sort-bars" data-res="cubuklar"></div>
        <div class="sort-controls"><button class="btn ghost sm" type="button" data-action="sort-prev">Geri</button><span data-res="adim">Adım 0</span><button class="btn ghost sm" type="button" data-action="sort-next">İleri</button></div>
        <p class="lab-error" data-res="hata" role="alert"></p>
      </div>`)}`,
    after: setupComputing,
  };
}

const SORT_STATE = { steps: [], index: 0 };

// Adım çubuklarını çizer; yükseklikler CSSOM ile atanır (satır içi stil yok)
function renderSortBars() {
  const root = document.querySelector('[data-comp=siralama]');
  if (!root) return;
  const bars = root.querySelector('[data-res=cubuklar]');
  const adim = root.querySelector('[data-res=adim]');
  const step = SORT_STATE.steps[SORT_STATE.index];
  if (!step) return;
  const max = Math.max(1, ...step.array.map(Math.abs));
  bars.innerHTML = step.array.map((_v, i) => {
    const active = step.compare && step.compare.includes(i);
    const cls = active ? (step.swapped ? 'bar swap' : 'bar compare') : 'bar';
    return `<div class="${cls}"><span></span><small></small></div>`;
  }).join('');
  bars.querySelectorAll('.bar').forEach((el, i) => {
    el.querySelector('span').style.height = `${Math.max(6, (Math.abs(step.array[i]) / max) * 100)}%`;
    el.querySelector('small').textContent = step.array[i];
  });
  adim.textContent = step.done ? 'Sıralama tamam' : `Adım ${SORT_STATE.index} / ${SORT_STATE.steps.length - 1}`;
}

function setupComputing() {
  const sayi = document.querySelector('[data-comp=sayi]');
  const mantik = document.querySelector('[data-comp=mantik]');
  const siralama = document.querySelector('[data-comp=siralama]');

  const updateNumber = () => {
    const value = sayi.querySelector('[data-in=sayi]').value;
    const base = Number(sayi.querySelector('[data-in=taban]').value);
    const errorEl = sayi.querySelector('[data-res=hata]');
    try {
      const n = parseBase(value, base);
      sayi.querySelector('[data-res=ikili]').textContent = toBase(n, 2);
      sayi.querySelector('[data-res=sekizli]').textContent = toBase(n, 8);
      sayi.querySelector('[data-res=onlu]').textContent = toBase(n, 10);
      sayi.querySelector('[data-res=onaltili]').textContent = toBase(n, 16);
      errorEl.textContent = '';
    } catch (error) {
      errorEl.textContent = error.message;
    }
  };

  const updateLogic = () => {
    const expression = mantik.querySelector('[data-in=ifade]').value;
    const errorEl = mantik.querySelector('[data-res=hata]');
    const head = mantik.querySelector('[data-res=baslik]');
    const body = mantik.querySelector('[data-res=satirlar]');
    try {
      const { vars, rows } = truthTable(expression);
      if (!vars.length) throw new Error('En az bir değişken yazın (A, B, C…)');
      head.innerHTML = `<tr>${vars.map(() => `<th></th>`).join('')}<th>Sonuç</th></tr>`;
      head.querySelectorAll('th').forEach((th, i) => { th.textContent = i < vars.length ? vars[i] : 'Sonuç'; });
      body.innerHTML = rows.map(r => `<tr>${vars.map(() => `<td></td>`).join('')}<td class="${r.result ? 'is-true' : 'is-false'}"></td></tr>`).join('');
      body.querySelectorAll('tr').forEach((tr, ri) => {
        const cells = tr.querySelectorAll('td');
        vars.forEach((v, ci) => { cells[ci].textContent = rows[ri].values[v] ? '1' : '0'; });
        cells[vars.length].textContent = rows[ri].result ? '1' : '0';
      });
      errorEl.textContent = '';
    } catch (error) {
      head.innerHTML = '';
      body.innerHTML = '';
      errorEl.textContent = error.message;
    }
  };

  const renderSort = renderSortBars;

  const resetSort = () => {
    const errorEl = siralama.querySelector('[data-res=hata]');
    const raw = siralama.querySelector('[data-in=liste]').value;
    const numbers = raw.split(',').map(x => x.trim()).filter(Boolean).map(Number);
    if (!numbers.length || numbers.some(n => !Number.isFinite(n)) || numbers.length > 20) {
      errorEl.textContent = 'En fazla 20 sayı, virgülle ayırarak yazın';
      SORT_STATE.steps = [];
      return;
    }
    errorEl.textContent = '';
    SORT_STATE.steps = bubbleSortSteps(numbers);
    SORT_STATE.index = 0;
    renderSort();
  };

  const ornekler = {
    merhaba: 'print("Merhaba dünya")\nad = "Öğrenci"\nprint("Selam", ad)',
    fizzbuzz: 'for i in range(1, 16):\n    if i % 15 == 0:\n        print("FizzBuzz")\n    elif i % 3 == 0:\n        print("Fizz")\n    elif i % 5 == 0:\n        print("Buzz")\n    else:\n        print(i)',
    fonksiyon: 'def alan(r):\n    return 3 * r * r\n\nfor r in [1, 2, 3]:\n    print("yarıçap", r, "alan", alan(r))',
    liste: 'notlar = [70, 85, 92, 60]\ntoplam = 0\nfor n in notlar:\n    toplam = toplam + n\nprint("ortalama", toplam / len(notlar))',
    asal: 'for n in range(2, 30):\n    asal = True\n    for d in range(2, n):\n        if n % d == 0:\n            asal = False\n            break\n    if asal:\n        print(n)',
  };
  const pySelect = document.querySelector('[data-py=ornek]');
  if (pySelect) {
    pySelect.addEventListener('change', () => {
      if (ornekler[pySelect.value]) document.querySelector('[data-py=kod]').value = ornekler[pySelect.value];
      pySelect.value = '';
    });
  }
  const code = document.querySelector('[data-py=kod]');
  const hl = document.querySelector('[data-py=hl]');
  if (code && hl) {
    const paint = () => {
      hl.innerHTML = highlightPython(code.value);
      hl.scrollTop = code.scrollTop;
      hl.scrollLeft = code.scrollLeft;
    };
    const insertAtCursor = text => {
      code.setRangeText(text, code.selectionStart, code.selectionEnd, 'end');
      code.dispatchEvent(new Event('input'));
    };
    code.addEventListener('input', paint);
    code.addEventListener('scroll', paint);
    code.addEventListener('keydown', event => {
      if (event.key === 'Tab') {
        event.preventDefault();
        insertAtCursor('    ');
      } else if (event.key === 'Enter' && !event.shiftKey) {
        // Yeni satır: önceki satırın girintisini korur; ":" ile biten satırdan sonra bir blok daha içeri girer
        event.preventDefault();
        const before = code.value.slice(0, code.selectionStart);
        const line = before.slice(before.lastIndexOf('\n') + 1);
        const indent = /^\s*/.exec(line)[0];
        const extra = /:\s*(#.*)?$/.test(line.trim()) ? '    ' : '';
        insertAtCursor(`\n${indent}${extra}`);
      }
    });
    paint();
    ACTIONS['py-snippet'] = el => {
      const snippets = {
        print: 'print()',
        if: 'if koşul:\n    ',
        for: 'for i in range(5):\n    ',
        while: 'while koşul:\n    ',
        def: 'def fonksiyon(x):\n    return x',
        liste: 'liste = [1, 2, 3]',
      };
      code.focus();
      insertAtCursor(snippets[el.dataset.snip] ?? '');
    };
  }
  sayi.addEventListener('input', updateNumber);
  sayi.addEventListener('change', updateNumber);
  mantik.addEventListener('input', updateLogic);
  siralama.addEventListener('input', resetSort);
  updateNumber();
  updateLogic();
  resetSort();
}

ACTIONS['py-run'] = () => {
  const code = document.querySelector('[data-py=kod]').value;
  const out = document.querySelector('[data-py=cikti]');
  const result = runPython(code);
  const lines = result.output.map(line => `${line}`);
  if (!result.ok) lines.push(result.error);
  document.querySelector('[data-py=ipucu]').textContent = result.ok ? '' : pyHint(result.error);
  out.classList.toggle('py-error', !result.ok);
  // Önceki yazım sürüyorsa durdur
  if (out.dataset.typing) { clearInterval(Number(out.dataset.typing)); out.dataset.typing = ''; }
  if (!lines.length) { out.textContent = '(çıktı yok)'; return; }
  if (!fxEnabled()) { out.textContent = lines.join('\n'); return; }
  // Terminal gibi: satır satır yazılır
  out.textContent = '';
  let index = 0;
  const timer = setInterval(() => {
    out.textContent += (index > 0 ? '\n' : '') + lines[index];
    index += 1;
    if (index >= lines.length) {
      clearInterval(timer);
      out.dataset.typing = '';
    }
  }, 110);
  out.dataset.typing = String(timer);
};

ACTIONS['py-clear-code'] = () => {
  const code = document.querySelector('[data-py=kod]');
  code.value = '';
  code.dispatchEvent(new Event('input'));
  code.focus();
};

ACTIONS['py-clear'] = () => {
  const out = document.querySelector('[data-py=cikti]');
  out.textContent = '';
  out.classList.remove('py-error');
};

ACTIONS['sort-next'] = () => {
  if (SORT_STATE.index < SORT_STATE.steps.length - 1) SORT_STATE.index += 1;
  renderSortBars();
};

ACTIONS['sort-prev'] = () => {
  if (SORT_STATE.index > 0) SORT_STATE.index -= 1;
  renderSortBars();
};

// ---------- Kimya oyunu: periyodik tablo ve birleşme ----------
function chemGameHtml() {
  const cells = ELEMENTS.map(([symbol, name, number, group, period]) => (
    `<button type="button" class="el-cell" data-el="${symbol}" data-group="${group}" data-period="${period}" ><b>${symbol}</b><small>${number}</small><span class="sr-only"> ${esc(name)}</span></button>`
  )).join('');
  return `<div class="chem-game">
    <div class="chem-table-wrap"><div class="chem-table" data-table>${cells}</div></div>
    <div class="chem-main">
      <div class="chem-stage" data-stage>
        <p class="chem-empty" data-empty>Tablodan bir element seçin.</p>
        <div class="chem-trash" data-trash>Silmek için buraya bırakın</div>
      </div>
      <form class="chem-add" data-chem-add>
        <input name="formula" maxlength="60" placeholder="Formül yazın: H2O, C6H12O6, H2SO4" aria-label="Formül">
        <button class="btn ghost sm" type="submit">Atomları ekle</button>
      </form>
      <div class="chem-bar">
        <span class="chem-hint" data-chem-hint>Parçaları birbirine yaklaştırıp bırakın. Uygun olanlar birleşir.</span>
        <div class="chem-actions">
          <button class="btn ghost sm" type="button" data-action="fx-toggle" aria-pressed="false">Efektler</button>
          <button class="btn primary sm" type="button" data-chem-all>Hepsini birleştir</button>
          <button class="btn ghost sm" type="button" data-chem-clear>Alanı temizle</button>
        </div>
      </div>
      <div class="chem-known"><strong>Keşfedilenler</strong><ul data-known><li class="muted">Henüz bir bileşik oluşmadı.</li></ul></div>
    </div>
  </div>`;
}

function hintEl(on) {
  return on ? 'Efektler açık.' : 'Efektler kapalı.';
}

function setupChemGame() {
  const table = document.querySelector('[data-table]');
  const stage = document.querySelector('[data-stage]');
  if (!table || !stage) return;
  // Tablo yerleşimi: grup ve periyot CSS ızgarasına CSSOM ile uygulanır
  table.querySelectorAll('.el-cell').forEach(cell => {
    cell.style.gridColumn = cell.dataset.group;
    cell.style.gridRow = cell.dataset.period;
  });
  const hint = document.querySelector('[data-chem-hint]');
  const known = document.querySelector('[data-known]');
  const trash = stage.querySelector('[data-trash]');
  const empty = stage.querySelector('[data-empty]');
  const items = new Map();
  const found = new Map();
  let nextId = 1;
  let drag = null;

  const setHint = text => { hint.textContent = text; };
  const refreshEmpty = () => { empty.hidden = items.size > 0; };

  const place = item => {
    const el = item.el;
    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;
  };

  const addItem = (comp, label, sub, kind, x, y) => {
    const id = nextId;
    nextId += 1;
    const el = document.createElement('div');
    el.className = `chem-item ${kind}`;
    el.dataset.id = String(id);
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${label}, ${sub}. Taşımak için ok tuşları, silmek için Delete, birleştirmek için Enter.`);
    el.innerHTML = `<span class="chem-ico" aria-hidden="true"></span><strong></strong><small></small>`;
    el.querySelector('.chem-ico').textContent = iconFor(sub, comp);
    el.querySelector('strong').textContent = label;
    el.querySelector('small').textContent = sub;
    stage.appendChild(el);
    const item = { id, el, comp, label, sub, kind, x, y };
    items.set(id, item);
    place(item);
    refreshEmpty();
    return item;
  };


  const motionOK = () => fxEnabled();
  const effect = (cls, x, y, size) => {
    const node = document.createElement('div');
    node.className = cls;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    if (size) { node.style.width = `${size}px`; node.style.height = `${size}px`; }
    stage.appendChild(node);
    return node;
  };

  // Silinen ya da birleşen parça: hedefe (kara delik ya da birleşme noktası) çekilip küçülür
  const ensureVisible = () => {
    const r = stage.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) stage.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const vanish = (item, target) => {
    items.delete(item.id);
    refreshEmpty();
    if (!motionOK()) { item.el.remove(); return; }
    ensureVisible();
    const hole = target ? null : { x: trash.offsetLeft + trash.offsetWidth / 2, y: trash.offsetTop + trash.offsetHeight / 2 };
    const to = target ?? hole;
    const dx = to.x - (item.x + item.el.offsetWidth / 2);
    const dy = to.y - (item.y + item.el.offsetHeight / 2);
    if (hole) {
      const node = effect('chem-hole', to.x, to.y);
      node.animate([
        { transform: 'translate(-50%,-50%) scale(0)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.35 },
        { transform: 'translate(-50%,-50%) scale(1.2) rotate(200deg)', opacity: 0 },
      ], { duration: 1600, easing: 'ease-in-out', fill: 'forwards' }).finished.then(() => node.remove());
    }
    item.el.animate([
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) scale(0.15) rotate(540deg)`, opacity: 0 },
    ], { duration: 1200, easing: 'cubic-bezier(0.5,0,0.9,0.4)', fill: 'forwards' }).finished.then(() => item.el.remove());
  };

  // Birleşme: patlama kıvılcımları, buhar bulutu, ardından ürün belirir
  const burst = (x, y) => {
    ensureVisible();
    const ring = effect('chem-ring', x, y);
    ring.animate([
      { transform: 'translate(-50%,-50%) scale(0.2)', opacity: 0.9 },
      { transform: 'translate(-50%,-50%) scale(3)', opacity: 0 },
    ], { duration: 900, easing: 'ease-out', fill: 'forwards' }).finished.then(() => ring.remove());
    for (let i = 0; i < 16; i += 1) {
      const spark = effect('chem-spark', x, y);
      const angle = (i / 16) * Math.PI * 2;
      const dist = 90 + Math.random() * 60;
      spark.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${Math.cos(angle) * dist}px,${Math.sin(angle) * dist}px) scale(0.2)`, opacity: 0 },
      ], { duration: 1100, easing: 'ease-out', fill: 'forwards' }).finished.then(() => spark.remove());
    }
    const steam = effect('chem-steam', x, y);
    steam.animate([
      { transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0.8 },
      { transform: 'translate(-50%,-90%) scale(1.8)', opacity: 0.5, offset: 0.5 },
      { transform: 'translate(-50%,-150%) scale(2.6)', opacity: 0 },
    ], { duration: 1800, easing: 'ease-out', fill: 'forwards' }).finished.then(() => steam.remove());
  };

  const renderKnown = () => {
    if (!found.size) return;
    known.innerHTML = [...found.values()].map(_p => `<li><i class="chem-ico" aria-hidden="true"></i><b></b><span></span></li>`).join('');
    [...found.values()].forEach((p, i) => {
      const li = known.children[i];
      li.querySelector('i').textContent = iconFor(p.name, null);
      li.querySelector('b').textContent = p.formula;
      li.querySelector('span').textContent = p.name;
    });
  };

  // Klavye: tablodaki bir elemente Enter/Boşluk ile (fare olayı olmadan) çalışma alanına eklenir
  table.addEventListener('click', event => {
    if (event.detail !== 0) return;
    const cell = event.target.closest('.el-cell');
    if (!cell) return;
    const rect = stage.getBoundingClientRect();
    const symbol = cell.dataset.el;
    const name = ELEMENTS.find(e => e[0] === symbol)[1];
    addItem(atomComp(symbol), symbol, name, 'atom', rect.width / 2 - 40, rect.height / 2 - 30);
    setHint(`${name} eklendi. Parçayı seçip ok tuşlarıyla taşıyın, Enter ile birleştirin.`);
  });

  // Klavye: seçili parça ok tuşlarıyla taşınır, Delete ile silinir, Enter ile birleşme denenir
  stage.addEventListener('keydown', event => {
    const el = event.target.closest('.chem-item');
    if (!el) return;
    const item = items.get(Number(el.dataset.id));
    if (!item) return;
    const step = event.shiftKey ? 30 : 10;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) {
      event.preventDefault();
      item.x = Math.max(0, item.x + moves[event.key][0]);
      item.y = Math.max(0, item.y + moves[event.key][1]);
      place(item);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      setHint(`${item.label} alandan kaldırıldı.`);
      vanish(item);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      reactAround(item);
    }
  });

  // Element seçimi: çalışma alanının ortasına ya da sürüklenerek bırakılan yere eklenir
  table.addEventListener('pointerdown', event => {
    const cell = event.target.closest('.el-cell');
    if (!cell) return;
    event.preventDefault();
    const rect = stage.getBoundingClientRect();
    const x = Math.max(8, Math.min(rect.width - 90, rect.width / 2 - 40 + (Math.random() * 60 - 30)));
    const y = Math.max(8, Math.min(rect.height - 90, rect.height / 2 - 30 + (Math.random() * 60 - 30)));
    const symbol = cell.dataset.el;
    const name = ELEMENTS.find(e => e[0] === symbol)[1];
    const item = addItem(atomComp(symbol), symbol, name, 'atom', x, y);
    setHint(`${name} eklendi. Başka bir parçayla birleştirmeyi deneyin.`);
    startDrag(item, event);
  });

  const startDrag = (item, event) => {
    const rect = stage.getBoundingClientRect();
    drag = { item, dx: event.clientX - rect.left - item.x, dy: event.clientY - rect.top - item.y, moved: false };
    item.el.setPointerCapture(event.pointerId);
    item.el.classList.add('dragging');
  };

  stage.addEventListener('pointerdown', event => {
    const el = event.target.closest('.chem-item');
    if (!el) return;
    const item = items.get(Number(el.dataset.id));
    if (item) startDrag(item, event);
  });

  stage.addEventListener('pointermove', event => {
    if (!drag) return;
    const rect = stage.getBoundingClientRect();
    drag.item.x = Math.max(0, Math.min(rect.width - 80, event.clientX - rect.left - drag.dx));
    drag.item.y = Math.max(0, Math.min(rect.height - 60, event.clientY - rect.top - drag.dy));
    drag.moved = true;
    place(drag.item);
  });

  const finishDrag = event => {
    if (!drag) return;
    const current = drag;
    drag = null;
    current.item.el.classList.remove('dragging');
    if (!current.moved) return;
    const tr = trash.getBoundingClientRect();
    if (event.clientX >= tr.left && event.clientX <= tr.right && event.clientY >= tr.top && event.clientY <= tr.bottom) {
      setHint(`${current.item.label} alandan kaldırıldı.`);
      vanish(current.item);
      return;
    }
    reactAround(current.item);
  };
  stage.addEventListener('pointerup', finishDrag);
  stage.addEventListener('pointercancel', () => { drag = null; });

  const NEAR = 90;

  // Anchor'a yakın parçaların kümesi (dolaylı komşular dahil)
  const clusterOf = anchor => {
    const all = [...items.values()];
    const cluster = [anchor];
    const seen = new Set([anchor.id]);
    for (let i = 0; i < cluster.length; i += 1) {
      for (const other of all) {
        if (!seen.has(other.id) && Math.hypot(other.x - cluster[i].x, other.y - cluster[i].y) < NEAR) {
          seen.add(other.id);
          cluster.push(other);
        }
      }
    }
    return cluster;
  };

  // Tepkimeyi uygular: kullanılan parçalar silinir, ürün ortalarına yerleşir
  // Parça koreografisi: birbirinden uzaklaşır, hızla çarpışır ve merkezde yok olur
  const choreograph = (part, cx, cy) => {
    const px = part.x + part.el.offsetWidth / 2;
    const py = part.y + part.el.offsetHeight / 2;
    const dx = px - cx;
    const dy = py - cy;
    const len = Math.hypot(dx, dy) || 1;
    const apartX = (dx / len) * 80;
    const apartY = (dy / len) * 80;
    const toX = cx - px;
    const toY = cy - py;
    part.el.animate([
      { transform: 'translate(0px,0px) scale(1)', opacity: 1, easing: 'ease-out' },
      { transform: `translate(${apartX}px,${apartY}px) scale(1.06)`, opacity: 1, offset: 0.45, easing: 'ease-in' },
      { transform: `translate(${toX}px,${toY}px) scale(0.55)`, opacity: 1, offset: 0.85, easing: 'ease-in' },
      { transform: `translate(${toX}px,${toY}px) scale(0.1)`, opacity: 0 },
    ], { duration: 1100, fill: 'forwards' }).finished.then(() => part.el.remove());
  };

  // Çarpışma anındaki parlak flaş
  const flash = (x, y) => {
    const node = effect('chem-flash', x, y);
    node.animate([
      { transform: 'scale(0.1)', opacity: 1 },
      { transform: 'scale(2.6)', opacity: 0 },
    ], { duration: 500, easing: 'ease-out', fill: 'forwards' }).finished.then(() => node.remove());
  };

  // Gri duman bulutları: yükselir, genişler ve dağılır
  const smoke = (x, y) => {
    for (let i = 0; i < 8; i += 1) {
      const size = 80 + Math.random() * 70;
      const puff = effect('chem-smoke', x + (Math.random() * 60 - 30), y + (Math.random() * 30 - 15), size);
      const rise = 90 + Math.random() * 80;
      const delay = Math.random() * 300;
      puff.animate([
        { transform: `translate(${-size / 2}px,${-size / 2}px) scale(0.2)`, opacity: 0 },
        { transform: `translate(${-size / 2}px,${-size / 2}px) scale(1)`, opacity: 0.95, offset: 0.3 },
        { transform: `translate(${-size / 2}px,${-size / 2 - rise}px) scale(2.2)`, opacity: 0 },
      ], { duration: 2600, delay, easing: 'ease-out', fill: 'both' }).finished.then(() => puff.remove());
    }
  };

  // Birleşme: parçalar koreografiyle çarpışır, ardından patlama, duman ve yeni madde
  const applyReaction = (parts, result) => {
    const centers = parts.map(p => ({ x: p.x + p.el.offsetWidth / 2, y: p.y + p.el.offsetHeight / 2 }));
    const cx = centers.reduce((sum, c) => sum + c.x, 0) / centers.length;
    const cy = centers.reduce((sum, c) => sum + c.y, 0) / centers.length;
    const fx = motionOK();
    parts.forEach(part => items.delete(part.id));
    refreshEmpty();
    if (fx) {
      ensureVisible();
      parts.forEach(part => choreograph(part, cx, cy));
      setTimeout(() => { flash(cx, cy); burst(cx, cy); smoke(cx, cy); }, 1100);
    } else {
      parts.forEach(part => part.el.remove());
    }
    const product = addItem(result.comp, result.product.formula, result.product.name, 'molecule', cx - 30, cy - 15);
    if (fx) {
      product.el.animate([
        { transform: 'scale(0.4)', opacity: 0, filter: 'blur(10px)' },
        { transform: 'scale(1.08)', opacity: 1, filter: 'blur(0px)', offset: 0.7 },
        { transform: 'scale(1)', opacity: 1, filter: 'blur(0px)' },
      ], { duration: 900, delay: 1900, easing: 'ease-out', fill: 'backwards' });
    }
    if (!found.has(result.product.formula)) found.set(result.product.formula, result.product);
    renderKnown();
    const prefix = result.product.count > 1 ? result.product.count : '';
    setHint(`Tepkime: ${prefix}${result.product.formula} · ${result.product.name}`);
  };

  const reactAround = anchor => {
    const cluster = clusterOf(anchor);
    if (cluster.length < 2) return;
    const result = bestReaction(cluster.map(p => p.comp));
    if (!result) {
      setHint('Bu parçalar birleşmedi. Başka bir kombinasyon deneyin.');
      return;
    }
    applyReaction(result.indices.map(i => cluster[i]), result);
  };

  const reactAll = () => {
    let reactions = 0;
    for (let round = 0; round < 80; round += 1) {
      const all = [...items.values()];
      const result = bestReaction(all.map(p => p.comp));
      if (!result) break;
      applyReaction(result.indices.map(i => all[i]), result);
      reactions += 1;
    }
    if (!reactions) setHint('Alanda birleşebilecek bir kombinasyon bulunamadı.');
    else setHint(`${reactions} tepkime tamamlandı.`);
  };

  // Formülden atomları çalışma alanına yerleştirir (ızgara biçiminde)
  const addFormula = text => {
    const comp = parseFormulaComp(text);
    const rect = stage.getBoundingClientRect();
    const cols = Math.max(4, Math.floor((rect.width - 20) / 72));
    let index = 0;
    for (const [symbol, count] of Object.entries(comp)) {
      const name = ELEMENTS.find(e => e[0] === symbol)[1];
      for (let i = 0; i < count; i += 1) {
        const x = 10 + (index % cols) * 72;
        const y = 10 + Math.floor(index / cols) * 60;
        addItem(atomComp(symbol), symbol, name, 'atom', x, y);
        index += 1;
      }
    }
    setHint(`${text} için ${index} atom eklendi. "Hepsini birleştir" ile tepkimeyi deneyin.`);
  };

  document.querySelector('[data-chem-clear]').addEventListener('click', () => {
    [...items.values()].forEach(item => vanish(item));
    setHint('Alan temizlendi.');
  });
  document.querySelector('[data-chem-all]').addEventListener('click', reactAll);
  const fxButton = document.querySelector('[data-action=fx-toggle]');
  const osReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const paintFx = () => {
    fxButton.textContent = fxEnabled() ? 'Efektler: açık' : 'Efektler: kapalı';
    fxButton.setAttribute('aria-pressed', String(fxEnabled()));
    fxButton.title = osReduce
      ? 'Bilgisayarınızda "hareketi azalt" açık. Bu düğme uygulama efektlerini ayrıca açıp kapatır.'
      : 'Uygulama efektleri: kara delik, patlama, tema geçişi ve sayfa animasyonları';
    setHint(osReduce && !localStorage.getItem('okulum-fx')
      ? 'Bilgisayarınızda hareket azaltma açık; efektler bu yüzden kapalı başladı. Açmak için Efektler düğmesine basın.'
      : hintEl(fxEnabled()));
  };
  paintFx();
  ACTIONS['fx-toggle'] = () => { setFx(!fxEnabled()); paintFx(); };
  document.querySelector('[data-chem-add]').addEventListener('submit', event => {
    event.preventDefault();
    const input = event.currentTarget.querySelector('[name=formula]');
    try {
      addFormula(input.value.trim());
      input.value = '';
    } catch (error) {
      setHint(error.message);
    }
  });
  refreshEmpty();
}

function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(200, rect.width);
  const h = Math.max(160, rect.height);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function drawPhysics(canvas, path, result) {
  const { ctx, w, h } = fitCanvas(canvas);
  const pad = 36;
  const maxX = Math.max(result.range, 1) * 1.1;
  const maxY = Math.max(result.height, 1) * 1.3;
  const sx = (w - pad * 2) / maxX;
  const sy = (h - pad * 2) / maxY;
  ctx.strokeStyle = '#cfd9d3';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, h - pad); ctx.lineTo(w - pad / 2, h - pad); ctx.moveTo(pad, h - pad); ctx.lineTo(pad, pad / 2); ctx.stroke();
  ctx.fillStyle = '#6b7f76';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('x (m)', w - 46, h - pad + 16);
  ctx.fillText('y (m)', 4, pad / 2 + 4);
  ctx.strokeStyle = '#1b6b50';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  path.forEach((p, i) => {
    const px = pad + p.x * sx;
    const py = h - pad - p.y * sy;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.stroke();
}

function drawTitration(canvas, series, veq, current) {
  const { ctx, w, h } = fitCanvas(canvas);
  const pad = 36;
  const maxV = Math.max(10, Math.ceil(Math.max(veq * 2, 10)));
  const X = v => pad + (v / maxV) * (w - pad * 1.5);
  const Y = pH => h - pad - (pH / 14) * (h - pad * 1.5);
  ctx.strokeStyle = '#cfd9d3';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, h - pad); ctx.lineTo(w - pad / 2, h - pad); ctx.moveTo(pad, h - pad); ctx.lineTo(pad, pad / 2); ctx.stroke();
  ctx.fillStyle = '#6b7f76';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('Eklenen baz (mL)', w - 130, h - pad + 16);
  ctx.fillText('pH', 6, pad / 2 + 4);
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = '#e8590c';
  ctx.beginPath(); ctx.moveTo(X(veq), h - pad); ctx.lineTo(X(veq), pad / 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#1b6b50';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  series.forEach((p, i) => { if (i === 0) ctx.moveTo(X(p.v), Y(p.pH)); else ctx.lineTo(X(p.v), Y(p.pH)); });
  ctx.stroke();
  const marker = { v: current.v, pH: current.pH };
  ctx.fillStyle = '#e5484d';
  ctx.beginPath(); ctx.arc(X(marker.v), Y(marker.pH), 5, 0, Math.PI * 2); ctx.fill();
}

function setupLabs() {
  const fizikBox = document.querySelector('[data-lab=fizik]');
  const kimyaBox = document.querySelector('[data-lab=kimya]');

  const updatePhysics = () => {
    const v = Number(fizikBox.querySelector('[data-in=v]').value);
    const theta = Number(fizikBox.querySelector('[data-in=theta]').value);
    const g = Number(fizikBox.querySelector('[data-in=g]').value);
    fizikBox.querySelector('[data-out=v]').textContent = v;
    fizikBox.querySelector('[data-out=theta]').textContent = theta;
    const result = projectile(v, theta, g);
    fizikBox.querySelector('[data-res=range]').textContent = result.range.toFixed(2);
    fizikBox.querySelector('[data-res=height]').textContent = result.height.toFixed(2);
    fizikBox.querySelector('[data-res=time]').textContent = result.time.toFixed(2);
    drawPhysics(document.querySelector('[data-canvas=fizik]'), trajectory(v, theta, g, 120), result);
  };

  const updateChem = () => {
    const ca = Number(kimyaBox.querySelector('[data-in=ca]').value);
    const va = Number(kimyaBox.querySelector('[data-in=va]').value);
    const cb = Number(kimyaBox.querySelector('[data-in=cb]').value);
    const vb = Number(kimyaBox.querySelector('[data-in=vb]').value);
    kimyaBox.querySelector('[data-out=va]').textContent = va;
    kimyaBox.querySelector('[data-out=vb]').textContent = vb;
    const veq = equivalenceVolume(ca, va, cb);
    const pH = titrationPH(ca, va, cb, vb);
    const acidMoles = ca * va;
    const baseMoles = cb * vb;
    const state = Math.abs(acidMoles - baseMoles) < 1e-9 ? 'Eşdeğerlik noktası'
      : acidMoles > baseMoles ? 'Asit fazlası' : 'Baz fazlası';
    kimyaBox.querySelector('[data-res=ph]').textContent = pH.toFixed(2);
    kimyaBox.querySelector('[data-res=veq]').textContent = veq.toFixed(1);
    kimyaBox.querySelector('[data-res=state]').textContent = state;
    const maxV = Math.max(10, veq * 2);
    drawTitration(document.querySelector('[data-canvas=kimya]'), titrationSeries(ca, va, cb, maxV, 0.5), veq, { v: vb, pH });
  };

  if (fizikBox) {
    fizikBox.addEventListener('input', updatePhysics);
    fizikBox.addEventListener('change', updatePhysics);
    updatePhysics();
  }
  if (kimyaBox) {
    kimyaBox.addEventListener('input', updateChem);
    kimyaBox.addEventListener('change', updateChem);
    updateChem();
  }
  window.addEventListener('resize', () => {
    if (fizikBox) updatePhysics();
    if (kimyaBox) updateChem();
  });
}

// ---------- GeoGebra (v32): kendi grafik aracımız, sınıf çalışmaları ----------
let ggbCurrent = null;

async function pageGeogebra() {
  const { materials } = await api('/geogebra/materials');
  const staff = state.me.role === 'teacher' || state.me.role === 'principal';
  const saveButton = staff ? `<button class="btn primary" type="button" data-action="ggb-save">${icon('plus')}<span>Sınıfa kaydet</span></button>` : '';
  const del = m => (m.canDelete ? `<button class="icon-btn sm" type="button" data-action="ggb-del" data-id="${esc(m.id)}" aria-label="Materyali sil">${icon('trash')}</button>` : '');
  const list = materials.map(m => (m.kind === 'worksheet'
    ? `<li class="list-row"><div class="list-main"><strong>${esc(m.title)}</strong><small class="muted">${esc(m.className)} · çalışma · ${(m.content?.lines || []).length} satır</small></div>
        <div class="row-actions"><button class="btn ghost sm" type="button" data-action="ggb-load" data-content="${esc(JSON.stringify(m.content || { lines: [] }))}">Çalışmayı aç</button>${del(m)}</div></li>`
    : `<li class="list-row"><div class="list-main"><strong>${esc(m.title)}</strong><small class="muted">${esc(m.className)} · bağlantı</small></div>
        <div class="row-actions"><a class="btn ghost sm" href="${esc(m.url)}" target="_blank" rel="noopener">Materyali aç</a>${del(m)}</div></li>`)).join('');
  return {
    html: `${head('Matematik Laboratuvarı', 'Fonksiyon, nokta, doğru ve çember çizin; sınıf çalışmalarını kaydedin. Öğrenciler çalışmayı açıp kendi denemelerini yapabilir.', saveButton)}
      ${panel('Grafik', '', '<div class="pad"><div id="graphHost" class="gx-host"></div></div>')}
      ${panel('Sınıf çalışmaları', `${materials.length} kayıt`, materials.length
        ? `<ul class="list">${list}</ul>`
        : empty('Çalışma yok', 'Öğretmeniniz çalışma kaydettiğinde burada görünür.'))}`,
    after: () => {
      const host = document.querySelector('#graphHost');
      if (host) ggbCurrent = mountGraph(host, { lines: [] }, {});
    },
  };
}

ACTIONS['ggb-load'] = el => {
  if (!ggbCurrent) return;
  const content = JSON.parse(el.dataset.content || '{"lines":[]}');
  ggbCurrent.setLines(content.lines || []);
  toast('Çalışma yüklendi');
  document.querySelector('#graphHost')?.scrollIntoView({ behavior: 'smooth' });
};

ACTIONS['ggb-save'] = () => {
  const lines = ggbCurrent ? ggbCurrent.getLines().filter(Boolean) : [];
  if (!lines.length) {
    toast('Kaydetmek için en az bir satır yazın', 'error');
    return;
  }
  const classes = state.me.role === 'teacher' ? teacherClasses() : state.classes;
  openModal('Çalışmayı sınıfa kaydet', `<form class="stack" data-form="ggb-save">
    <label class="field"><span>Sınıf</span><select name="classId">${classes.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Çalışma adı</span><input name="title" required minlength="2" maxlength="120" placeholder="Örn. Parabol ve kökler"></label>
    <p class="muted small">${lines.length} satır kaydedilecek. Öğrenciler çalışmayı açıp kendi denemelerini yapabilir.</p>
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Kaydet</button></div>
  </form>`);
};

FORMS['ggb-save'] = async form => {
  const lines = ggbCurrent ? ggbCurrent.getLines().filter(Boolean) : [];
  await api('/geogebra/worksheets', { method: 'POST', body: { classId: val(form, 'classId'), title: val(form, 'title').trim(), lines } });
  closeModal();
  toast('Çalışma sınıfa kaydedildi');
  refresh();
=======
// ---------- GeoGebra paneli (v29) ----------
const GGB_APPS = [['graphing', 'Grafik'], ['calculator', 'Hesap makinesi'], ['geometry', 'Geometri'], ['3d', '3B'], ['classic', 'Klasik'], ['cas', 'CAS']];
const ggbUrl = key => `https://www.geogebra.org/${key}`;

async function pageGeogebra(params) {
  const app = GGB_APPS.some(([key]) => key === params.app) ? params.app : 'graphing';
  const { materials } = await api('/geogebra/materials');
  const canAdd = state.me.role === 'teacher' || state.me.role === 'principal';
  const tabs = GGB_APPS.map(([key, label]) => `<button type="button" class="seg-btn ${key === app ? 'on' : ''}" data-action="ggb-app" data-url="${esc(ggbUrl(key))}" aria-pressed="${key === app}">${esc(label)}</button>`).join('');
  const list = materials.map(m => `<li class="list-row">
      <div class="list-main"><strong>${esc(m.title)}</strong><small class="muted">${esc(m.className)}</small></div>
      <div class="row-actions">
        <button class="btn ghost sm" type="button" data-action="ggb-open" data-url="${esc(m.url)}">Aç</button>
        <a class="btn ghost sm" href="${esc(m.url)}" target="_blank" rel="noopener">Yeni sekmede</a>
        ${m.canDelete ? `<button class="icon-btn sm" type="button" data-action="ggb-del" data-id="${esc(m.id)}" aria-label="Materyali sil">${icon('trash')}</button>` : ''}
      </div>
    </li>`).join('');
  const addButton = canAdd ? `<button class="btn primary" type="button" data-action="ggb-add">${icon('plus')}<span>Materyal ekle</span></button>` : '';
  return { html: `${head('GeoGebra', 'Grafik, geometri ve hesap uygulamaları. Öğretmenler sınıfa materyal ekleyebilir.', addButton)}
    ${panel('Uygulama', '', `<div class="pad stack">
      <div class="row-actions ggb-tabs">${tabs}</div>
      <iframe id="ggbFrame" class="ggb-frame" src="${esc(ggbUrl(app))}" title="GeoGebra uygulaması" allow="fullscreen; clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"></iframe>
      <p class="muted small">Uygulama geogebra.org üzerinden açılır. Görüntülenmezse "Yeni sekmede" bağlantısını kullanın.</p>
    </div>`)}
    ${panel('Sınıf materyalleri', `${materials.length} materyal`, materials.length
      ? `<ul class="list">${list}</ul>`
      : empty('Materyal yok', 'Öğretmeniniz sınıfa GeoGebra materyali eklediğinde burada görünür.'))}` };
}

ACTIONS['ggb-app'] = el => {
  document.querySelectorAll('.ggb-tabs .seg-btn').forEach(button => {
    const on = button === el;
    button.classList.toggle('on', on);
    button.setAttribute('aria-pressed', String(on));
  });
  document.querySelector('#ggbFrame').src = el.dataset.url;
};

ACTIONS['ggb-open'] = el => {
  document.querySelector('#ggbFrame').src = el.dataset.url;
  window.scrollTo({ top: 0, behavior: 'smooth' });
>>>>>>> Stashed changes
};

ACTIONS['ggb-add'] = () => {
  const classes = state.me.role === 'teacher' ? teacherClasses() : state.classes;
<<<<<<< Updated upstream
  openModal('Harici materyal ekle', `<form class="stack" data-form="ggb-add">
    <label class="field"><span>Sınıf</span><select name="classId">${classes.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Başlık</span><input name="title" required minlength="2" maxlength="120" placeholder="Örn. Üçgenin alanı"></label>
    <label class="field"><span>Materyal bağlantısı</span><input name="url" type="url" required maxlength="500" placeholder="https://www.geogebra.org/m/..."></label>
    <p class="muted small">Yalnızca izinli etkileşimli materyal bağlantıları kabul edilir. Materyali oluşturup paylaşım bağlantısını buraya yapıştırın.</p>
=======
  openModal('GeoGebra materyali ekle', `<form class="stack" data-form="ggb-add">
    <label class="field"><span>Sınıf</span><select name="classId">${classes.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Başlık</span><input name="title" required minlength="2" maxlength="120" placeholder="Örn. Üçgenin alanı"></label>
    <label class="field"><span>GeoGebra bağlantısı</span><input name="url" type="url" required maxlength="500" placeholder="https://www.geogebra.org/m/..."></label>
    <p class="muted small">Yalnızca geogebra.org bağlantıları kabul edilir. Materyali GeoGebra'da oluşturup paylaşım bağlantısını buraya yapıştırın.</p>
>>>>>>> Stashed changes
    <p class="form-error" data-error role="alert"></p>
    <div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">Vazgeç</button><button class="btn primary" type="submit">Ekle</button></div>
  </form>`);
};

FORMS['ggb-add'] = async form => {
  await api('/geogebra/materials', { method: 'POST', body: { classId: val(form, 'classId'), title: val(form, 'title').trim(), url: val(form, 'url').trim() } });
  closeModal();
  toast('Materyal eklendi');
  refresh();
};

ACTIONS['ggb-del'] = async el => {
  const yes = await confirmDialog('Materyali sil', 'Bu materyal sınıftan kaldırılacak.');
  if (!yes) return;
  await api(`/geogebra/materials/${el.dataset.id}`, { method: 'DELETE' });
  toast('Materyal silindi');
  refresh();
};

// ---------- Yönlendirme tablosu ----------
const PAGES = {
  overview: pageOverview, classes: pageClasses, assignments: pageAssignments, attendance: pageAttendance,
  messages: pageMessages, people: pagePeople, school: pageSchool, audit: pageAudit,
  yardim: async () => ({ html: helpHtml() }),
  panolar: pagePanolar, pano: pageBoard, asistan: pageAsistan,
  cocuklar: pageCocuklar, sinavlar: pageSinavlar, sinav: pageSinav, notlar: pageNotlar,
<<<<<<< Updated upstream
  davranis: pageDavranis, puanlarim: pagePuanlarim, program: pageProgram, takvim: pageTakvim, karne: pageKarne, canli: pageCanli, analiz: pageAnaliz, izin: pageIzin, gece: pageGece, geogebra: pageGeogebra, deneyler: pageFizik, fizik: pageFizik, kimya: pageKimya, bilgisayar: pageBilgisayar,
=======
  davranis: pageDavranis, puanlarim: pagePuanlarim, program: pageProgram, takvim: pageTakvim, karne: pageKarne, canli: pageCanli, analiz: pageAnaliz, izin: pageIzin, gece: pageGece, geogebra: pageGeogebra,
>>>>>>> Stashed changes
};
export function renderView(page, params) {
  if (page === 'overview' && state.me.role === 'parent') return pageParentOverview();
  return PAGES[page](params);
}
