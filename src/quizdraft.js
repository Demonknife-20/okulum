// Yapay zekâdan gelen sınav taslağının doğrulanması ve SVG temizliği. Veritabanı bağımlılığı yok.

class DraftError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DraftError';
    this.status = 502;
  }
}

// Görsel: yalnızca izin verilen etiketler ve özellikler. Her etiket ve özellik tek tek ayrıştırılır;
// tanınmayan her şey reddedilir (düzenli ifade ile "içermiyor" kontrolü yapılmaz).
const ALLOWED_SVG_TAGS = new Set(['svg', 'g', 'line', 'circle', 'ellipse', 'rect', 'path', 'polygon', 'polyline', 'text', 'tspan']);
const ALLOWED_SVG_ATTRS = new Set([
  'viewbox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points',
  'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'font-size', 'font-family', 'font-weight',
  'text-anchor', 'dominant-baseline', 'transform', 'fill-opacity', 'stroke-opacity',
]);
const SAFE_ATTR_VALUE = /^[^<>"'`\\]{0,200}$/;
const UNSAFE_VALUE = /javascript:|data:|url\s*\(|expression\s*\(|&|\\/i;
const TAG_TOKEN = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z_:][-a-zA-Z0-9_:.]*(?:\s*=\s*(?:"[^"<>]*"|'[^'<>]*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
const ATTR_TOKEN = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)'|([^\s"'=<>`]+)))?/g;

function sanitizeSvg(raw) {
  if (typeof raw !== 'string') return null;
  const svg = raw.trim();
  if (!svg || svg.length > 12000) return null;
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>$/i.test(svg)) return null;
  let tagCount = 0;
  let openCount = 0;
  let valid = true;
  const stack = [];
  // Metinde kalan her '<' bir etiket olmalı; etiket dışı '<' ya da '&' kabul edilmez
  const stripped = svg.replace(TAG_TOKEN, (match, closing, name, attrs, selfClosing) => {
    tagCount += 1;
    const tag = name.toLowerCase();
    if (!ALLOWED_SVG_TAGS.has(tag)) { valid = false; return ''; }
    if (closing) {
      if (stack.pop() !== tag) valid = false;
      return '';
    }
    if (!selfClosing) stack.push(tag);
    if (tag === 'svg') openCount += 1;
    let attrMatch;
    ATTR_TOKEN.lastIndex = 0;
    while ((attrMatch = ATTR_TOKEN.exec(attrs)) !== null) {
      const attr = attrMatch[1].toLowerCase();
      const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
      if (!ALLOWED_SVG_ATTRS.has(attr)) { valid = false; break; }
      if (!SAFE_ATTR_VALUE.test(value) || UNSAFE_VALUE.test(value)) { valid = false; break; }
    }
    return '';
  });
  if (!valid || stack.length || openCount !== 1 || tagCount === 0) return null;
  if (/[<>&]/.test(stripped)) return null;
  return svg;
}

function validateQuestion(q, index) {
  const label = `${index + 1}. soru`;
  const text = typeof q?.text === 'string' ? q.text.trim() : '';
  if (text.length < 3 || text.length > 500) throw new DraftError(`${label} metni geçersiz.`);
  if (!Array.isArray(q.options) || q.options.length !== 4) throw new DraftError(`${label} tam olarak 4 seçenek içermeli.`);
  const options = q.options.map(o => (typeof o === 'string' ? o.trim() : ''));
  if (options.some(o => o.length < 1 || o.length > 300)) throw new DraftError(`${label} seçeneklerinden biri boş ya da çok uzun.`);
  if (new Set(options.map(o => o.toLowerCase())).size !== 4) throw new DraftError(`${label} seçenekleri birbirinin aynı olamaz.`);
  if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) throw new DraftError(`${label} doğru cevabı geçersiz.`);
  const explanation = typeof q.explanation === 'string' ? q.explanation.trim().slice(0, 300) : '';
  return { text, options, correctIndex: q.correctIndex, explanation, svg: sanitizeSvg(q.svg) };
}

// Model yanıtını ayrıştırır: kod bloğu işaretleri temizlenir, sorular tek tek doğrulanır
function parseQuizDraft(raw) {
  const cleaned = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let data;
  try {
    data = JSON.parse(cleaned);
  } catch {
    throw new DraftError('Yapay zekâ geçerli bir taslak üretemedi. Konuyu daha açık yazıp tekrar deneyin.');
  }
  if (!data || !Array.isArray(data.questions) || data.questions.length < 1 || data.questions.length > 10) {
    throw new DraftError('Taslakta 1 ile 10 arasında soru olmalı.');
  }
  return data.questions.map((q, index) => validateQuestion(q, index));
}

// Model için talimat. Konu ve örnek soru kullanıcıdan geldiği için tırnak içinde verilir.
function buildQuizPrompt({ topic, example, count, withImages }) {
  const imageRule = withImages
    ? 'Sorunun anlaşılması için bir şekil gerekiyorsa "svg" alanına tek bir <svg> öğesi yaz (viewBox="0 0 400 300"). Yalnızca svg, g, line, circle, ellipse, rect, path, polygon, polyline, text, tspan, defs ve marker öğelerini kullan; betik, bağlantı, stil ya da dış kaynak kullanma. Gerekmiyorsa "svg" alanını boş bırak.'
    : '"svg" alanını boş bırak.';
  const example_ = example ? `Örnek soru (yalnızca tarz için, aynısını kopyalama): """${example}"""` : '';
  return [
    'Sen Türkçe bir öğretmen yardımcısısın. Aşağıdaki konuda çoktan seçmeli sorular hazırla.',
    `Tam olarak ${count} soru üret. Her soruda 4 seçenek olsun, yalnızca bir seçenek doğru olsun. Seçenekler birbirinden farklı olsun.`,
    'Yanıtı YALNIZCA geçerli JSON olarak ver. Başka metin, açıklama veya markdown kullanma.',
    'Biçim: {"questions":[{"text":"soru","options":["A","B","C","D"],"correctIndex":0,"explanation":"kısa açıklama","svg":""}]}',
    'correctIndex doğru seçeneğin sıfırdan başlayan sırasıdır.',
    imageRule,
    `Konu: """${topic}"""`,
    example_,
  ].filter(Boolean).join('\n');
}

module.exports = { DraftError, sanitizeSvg, validateQuestion, parseQuizDraft, buildQuizPrompt };
