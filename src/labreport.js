// Deney raporu doğrulama ve ilerleme özeti. Saf fonksiyonlar (veritabanı yok): test edilebilir.

const EXPERIMENT = /^[a-z0-9_-]{2,40}$/;
const MAX_LINES = 200;
const MAX_LINE = 300;
const MAX_SUMMARY_KEYS = 20;

function validateReport(body) {
  const experiment = typeof body?.experiment === 'string' ? body.experiment.trim() : '';
  if (!EXPERIMENT.test(experiment)) throw new Error('Deney kodu geçersiz (küçük harf, rakam, tire ya da alt çizgi; 2–40 karakter).');
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (title.length < 1 || title.length > 120) throw new Error('Rapor başlığı 1–120 karakter olmalı.');
  const rawLines = Array.isArray(body?.lines) ? body.lines : [];
  if (rawLines.length > MAX_LINES) throw new Error(`En fazla ${MAX_LINES} satır kaydedilebilir.`);
  const lines = rawLines
    .filter(l => typeof l === 'string')
    .map(l => l.replace(/\s+/g, ' ').trim().slice(0, MAX_LINE))
    .filter(Boolean);
  const rawSummary = body?.summary && typeof body.summary === 'object' && !Array.isArray(body.summary) ? body.summary : {};
  const summary = {};
  for (const [k, v] of Object.entries(rawSummary).slice(0, MAX_SUMMARY_KEYS)) {
    if (!/^[A-Za-z0-9_]{1,40}$/.test(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) summary[k] = v;
    else if (typeof v === 'string') summary[k] = v.slice(0, 200);
    else if (typeof v === 'boolean') summary[k] = v;
  }
  return { experiment, title, lines, summary };
}

// Öğrencinin deney bazında tamamlama sayıları ve toplam
function summarizeProgress(rows) {
  const byExperiment = {};
  let total = 0;
  for (const r of rows) {
    const n = Number(r.completed_count) || 0;
    byExperiment[r.experiment] = n;
    total += n;
  }
  return { total, experiments: Object.keys(byExperiment).length, byExperiment };
}

module.exports = { validateReport, summarizeProgress, MAX_LINES };
