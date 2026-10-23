// Okulum Asistanı: Google Gemini ile konuşma, kullanım bildirimi ve saklama kuralları.
const { q } = require('./db');

const NOTICE_VERSION = '2026-10-v1';
const NOTICE = {
  version: NOTICE_VERSION,
  title: 'Okulum Asistanı: kullanım ve veri işleme bildirimi',
  intro: 'Asistanı kullanmadan önce bu bildirimi okumanız gerekir. Onay vermeden sohbet başlatılamaz.',
  sections: [
    { title: 'Kim işliyor?', text: 'Asistan, okulunuz tarafından Okulum sisteminde sunulur. Sorularınız ve asistanın yanıtları okul veritabanında saklanır. Okul müdürü bu kayıtları güvenlik, kötüye kullanım incelemesi ve eğitim kalitesi amacıyla görebilir. Görüntülemeler denetim kaydına yazılır.' },
    { title: 'Yanıtı kim üretiyor?', text: 'Yanıtlar Google Gemini yapay zekâ hizmeti ile üretilir ve sorularınız bu hizmete iletilir. Ücretsiz Google katmanında sağlayıcının girdileri ürün geliştirme için kullanabileceğini kabul edersiniz.' },
    { title: 'Ne için kullanılır?', text: 'Okulum\'un nasıl kullanılacağını öğrenmek, ders konularını anlamak ve öğretmenler için ders materyali fikirleri almak için. Asistan ödevlerin cevabını vermez, sizi adım adım yönlendirir. Sınav kopyası için kullanılamaz.' },
    { title: 'Kişisel bilgi', text: 'T.C. kimlik numarası, telefon, e-posta ve okul numarası gibi bilgileri yazmayın. Bu bilgiler yapay zekâya gönderilmeden önce otomatik olarak maskelenir, ama yine de yazmamanızı öneririz.' },
    { title: 'Saklama süresi', text: 'Sohbetler 180 gün sonra otomatik olarak silinir. Dilediğiniz sohbeti kendiniz de silebilirsiniz.' },
    { title: 'Haklarınız (KVKK)', text: 'Kişisel Verilerin Korunması Kanunu kapsamında verilerinize erişme, düzeltme, silme ve işlenmesine itiraz etme haklarına sahipsiniz. Rızanızı okul müdürünüze başvurarak geri çekebilirsiniz. Bu durumda asistanı kullanamazsınız.' },
    { title: 'Doğruluk', text: 'Yapay zekâ hata yapabilir. Önemli konularda öğretmeninize veya kaynak kitabınıza başvurun.' },
  ],
};

const BASE = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 30);
const GLOBAL_DAILY = Number(process.env.AI_GLOBAL_DAILY || 400);
const RETENTION_DAYS = Number(process.env.AI_RETENTION_DAYS || 180);
const enabled = () => Boolean(process.env.GEMINI_API_KEY);

// Kural dışı yönlendirme denemeleri (talimatları öğrenme, değiştirme, yok sayma). Bunlar yapay zekâya gitmez.
const INJECTION = /(sistem\s*talimat|system\s*prompt|talimatlar[ıi]n[ıi]\s*(göster|yaz|söyle|unut|yok)|önceki\s*talimat|kurallar[ıi]n[ıi]\s*(unut|yok|değiştir)|prompt'?\s*unu|ignore\s+(all\s+|the\s+)?(previous\s+|above\s+)?instructions|reveal\s+(your\s+)?(system|instructions))/i;
const isInjection = text => INJECTION.test(text);
const INJECTION_REPLY = 'Bu konuda yardımcı olamam. Ben Okulum Asistanıyım: site kullanımı, ders konuları ve öğretim fikirleri için buradayım. Bir konuyu sormak ister misin?';

class AiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const SITE_GUIDE = `Okulum bir okul yönetim sistemidir. Sayfalar: Genel bakış (özet ve devamsızlık uyarıları), Sınıflarım (öğretmen için sınıflar ve devam oranları), Ödevler (ödev oluşturma, teslim, not), Yoklama, Panolar (sınıf ve okul notları, resimler), Mesajlar (birebir ve sınıf grubu sohbetleri), Kişiler, Okul (müdür: sınıf ve ders tanımı), Denetim (müdür: işlem kayıtları), Kullanım (kılavuz). Sol alttaki Hesabım bölümünde ad değiştirilir, şifre değiştirilir ve tüm cihazlardan çıkış yapılır.`;

function systemPrompt(role) {
  const common = [
    'Adın Okulum Asistanı. Her zaman Türkçe, nazik, kısa ve öğrenci yaşına uygun konuş.',
    'Kişisel bilgi isteme. Kullanıcı kişisel bilgi yazarsa bunları tekrar etme.',
    'Bilmediğin şeyi uydurma. Emin olmadığında öğretmene veya müdüre danışmasını öner.',
    'Şiddet, nefret, cinsel içerik veya zararlı talimatlarla ilgili isteklere yardım etme.',
    SITE_GUIDE,
  ];
  const byRole = {
    student: [
      'Kullanıcı bir öğrenci. Ödev ya da sınav sorusu geldiğinde doğrudan cevabı verme.',
      'Bunun yerine soru sor, ipucu ver, çözüm yolunu adım adım anlat ve benzer bir örnekle göster.',
      'Kopya ya da sınav hilesi için yardım etme. Öğrenciye site kullanımını sayfa adları ve adımlarla anlat.',
    ],
    teacher: [
      'Kullanıcı bir öğretmen. Ders planı, konu anlatımı, çoktan seçmeli ve açık uçlu soru örnekleri, değerlendirme ölçütü ve ödev yönergesi taslakları üretebilirsin.',
      'Veli mesajı taslağı yazabilirsin, ama mesajda hiçbir öğrencinin kişisel bilgisi olmasın.',
    ],
    principal: [
      'Kullanıcı bir okul müdürü. Duyuru ve okul panosu metni taslakları, site kullanımı için açıklamalar ve yönetim süreçleri hakkında yardım edebilirsin.',
      'Öğrencilerin ya da öğretmenlerin kişisel bilgilerini istemeden genel öneriler ver.',
    ],
  };
  return [...common, ...(byRole[role] || byRole.student)].join('\n');
}

async function askGemini({ role, history, message }) {
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt(role) }] },
    contents: [
      ...history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      { role: 'user', parts: [{ text: message }] },
    ],
    generationConfig: { temperature: 0.5, maxOutputTokens: 900 },
  };
  let res;
  try {
    res = await fetch(`${BASE}/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new AiError(502, 'Asistana şu an ulaşılamıyor. Biraz sonra tekrar deneyin.');
  }
  if (res.status === 429) throw new AiError(429, 'Asistan şu an çok yoğun. Lütfen biraz sonra deneyin.');
  if (!res.ok) {
    // Yalnızca durum kodu kaydedilir; kullanıcı içeriği ve anahtar asla günlüğe yazılmaz.
    console.error('Gemini yanıt hatası:', res.status);
    throw new AiError(502, 'Asistan şu an yanıt veremiyor. Lütfen daha sonra tekrar deneyin.');
  }
  const data = await res.json().catch(() => ({}));
  const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
  if (!text) throw new AiError(502, 'Bu soruya yanıt üretilemedi. Sorunuzu farklı bir biçimde yazmayı deneyin.');
  return text;
}

// Yanıtı parça parça alır: her parça geldiğinde onDelta çağrılır, tam metin döner.
async function streamGemini({ role, history, message, onDelta, signal }) {
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt(role) }] },
    contents: [
      ...history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      { role: 'user', parts: [{ text: message }] },
    ],
    generationConfig: { temperature: 0.5, maxOutputTokens: 900 },
  };
  const timeout = AbortSignal.timeout(60000);
  let res;
  try {
    res = await fetch(`${BASE}/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    // Yalnızca hata türü günlüğe yazılır; kullanıcı metni ve anahtar asla yazılmaz.
    console.error('Gemini ağ hatası:', error?.name, error?.cause?.code || '');
    throw new AiError(502, 'Asistana şu an ulaşılamıyor. Biraz sonra tekrar deneyin.');
  }
  if (res.status === 429) throw new AiError(429, 'Asistan şu an çok yoğun. Lütfen biraz sonra deneyin.');
  if (!res.ok || !res.body) {
    console.error('Gemini akış hatası:', res.status);
    throw new AiError(502, 'Asistan şu an yanıt veremiyor. Lütfen daha sonra tekrar deneyin.');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index = buffer.indexOf('\n');
    while (index >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      index = buffer.indexOf('\n');
      if (!line.startsWith('data:')) continue;
      let data;
      try { data = JSON.parse(line.slice(5)); } catch { continue; }
      const piece = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
      if (piece) { full += piece; onDelta(piece); }
    }
  }
  const text = full.trim();
  if (!text) throw new AiError(502, 'Bu soruya yanıt üretilemedi. Sorunuzu farklı bir biçimde yazmayı deneyin.');
  return text;
}


// ---------- Sınav sorusu üretimi (öğretmen) ----------
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const LEVELS = { kolay: 'kolay', orta: 'orta', zor: 'zor' };

function questionPrompt({ topic, subject, grade, level, count, kind, examples, withImages }) {
  const kinds = kind === 'text' ? 'yalnızca açık uçlu' : kind === 'mixed' ? 'çoğu çoktan seçmeli, birkaçı açık uçlu' : 'yalnızca çoktan seçmeli';
  return [
    `Bir Türk okulunda ${subject ? `"${subject}" dersi için ` : ''}${grade ? `${grade} düzeyinde ` : ''}sınav sorusu hazırlıyorsun.`,
    `Konu: ${topic}`,
    `Zorluk: ${LEVELS[level] || 'orta'}. Soru sayısı: ${count}. Tür: ${kinds}.`,
    examples.length ? `Öğretmenin örnek soruları aşağıda. Üslup, uzunluk ve zorluk bakımından bunlara benze ama aynılarını kopyalama:\n${examples.map((e, i) => `${i + 1}) ${e}`).join('\n')}` : '',
    'Kurallar: Türkçe yaz. Çoktan seçmeli sorularda tam 4 şık olsun, yalnızca biri doğru olsun, şıklar birbirine yakın uzunlukta olsun. Şıkların başına A), B) gibi harf koyma. Soru metni en fazla 600 karakter olsun.',
    withImages
      ? 'Bir şekil, grafik, tablo, harita ya da deney düzeneği soruyu gerçekten güçlendiriyorsa o soru için "image" alanına görseli tarif eden kısa bir İngilizce çizim talimatı yaz (yazı içermeyen, sade, beyaz zeminli eğitim çizimi). Gereksizse "image" boş dize olsun. Görselli soruda metin "Şekilde..." gibi görsele atıf yapabilir.'
      : 'Görsel kullanma, "image" alanı her zaman boş dize olsun.',
    'Her soruya kısa bir "explanation" (çözüm açıklaması) ekle.',
  ].filter(Boolean).join('\n\n');
}

const QUESTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          kind: { type: 'STRING', enum: ['choice', 'text'] },
          text: { type: 'STRING' },
          options: { type: 'ARRAY', items: { type: 'STRING' } },
          correctIndex: { type: 'INTEGER' },
          explanation: { type: 'STRING' },
          image: { type: 'STRING' },
        },
        required: ['kind', 'text', 'options', 'correctIndex', 'explanation', 'image'],
      },
    },
  },
  required: ['questions'],
};

async function geminiCall(model, body, timeoutMs) {
  let res;
  try {
    res = await fetch(`${BASE}/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new AiError(502, 'Yapay zekâya şu an ulaşılamıyor. Biraz sonra tekrar deneyin.');
  }
  if (res.status === 429) throw new AiError(429, 'Yapay zekâ şu an çok yoğun. Lütfen biraz sonra deneyin.');
  if (!res.ok) {
    console.error('Gemini yanıt hatası:', model, res.status);
    throw new AiError(502, 'Yapay zekâ şu an yanıt veremiyor. Lütfen daha sonra tekrar deneyin.');
  }
  return res.json().catch(() => ({}));
}

const clip = (v, n) => String(v ?? '').trim().slice(0, n);

async function generateQuestions(input) {
  const data = await geminiCall(MODEL, {
    contents: [{ role: 'user', parts: [{ text: questionPrompt(input) }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 6000, responseMimeType: 'application/json', responseSchema: QUESTION_SCHEMA },
  }, 60000);
  const raw = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  let parsed;
  try { parsed = JSON.parse(raw.replace(/^```(json)?|```$/g, '')); } catch { throw new AiError(502, 'Sorular okunamadı. Lütfen tekrar deneyin.'); }
  const list = Array.isArray(parsed?.questions) ? parsed.questions : [];
  const out = [];
  for (const item of list.slice(0, input.count)) {
    const text = clip(item?.text, 1000);
    if (!text) continue;
    const explanation = clip(item?.explanation, 600);
    const image = input.withImages ? clip(item?.image, 600) : '';
    if (item?.kind === 'text' || input.kind === 'text') { out.push({ kind: 'text', text, explanation, image }); continue; }
    const options = (Array.isArray(item?.options) ? item.options : []).map(o => clip(o, 300).replace(/^[A-Ea-e][).]\s+/, '')).filter(Boolean).slice(0, 5);
    const correctIndex = Number.isInteger(item?.correctIndex) ? item.correctIndex : -1;
    if (options.length < 2 || correctIndex < 0 || correctIndex >= options.length) continue;
    out.push({ kind: 'choice', text, options, correctIndex, explanation, image });
  }
  if (!out.length) throw new AiError(502, 'Uygun soru üretilemedi. Konuyu biraz daha açık yazıp tekrar deneyin.');
  return out;
}

// Soru için sade bir eğitim çizimi üretir. PNG/JPEG tampon döner.
async function generateQuestionImage(description) {
  const prompt = `Clean educational illustration for a school exam question, flat 2D line drawing, white background, black and one accent colour, no text, no letters, no numbers unless essential labels. ${description}`;
  const data = await geminiCall(IMAGE_MODEL, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'] },
  }, 90000);
  const part = (data.candidates?.[0]?.content?.parts || []).find(p => p.inlineData?.data || p.inline_data?.data);
  const inline = part?.inlineData || part?.inline_data;
  if (!inline) throw new AiError(502, 'Görsel üretilemedi. Tekrar deneyin ya da kendi görselinizi yükleyin.');
  const mime = inline.mimeType || inline.mime_type || 'image/png';
  if (!['image/png', 'image/jpeg'].includes(mime)) throw new AiError(502, 'Görsel biçimi desteklenmiyor.');
  return { buffer: Buffer.from(inline.data, 'base64'), mime };
}

// Eski sohbetleri ve kullanım kayıtlarını siler. Açılışta ve her gün çalışır.
async function purgeExpired() {
  await q('delete from ai_conversations where updated_at < now() - ($1::int * interval \'1 day\')', [RETENTION_DAYS]);
  await q('delete from ai_usage where day < current_date - 30');
}
function startRetention() {
  purgeExpired().catch(error => console.error('Saklama temizliği hatası:', error.message));
  setInterval(() => purgeExpired().catch(error => console.error('Saklama temizliği hatası:', error.message)), 24 * 60 * 60 * 1000).unref();
}

module.exports = { NOTICE, NOTICE_VERSION, DAILY_LIMIT, GLOBAL_DAILY, enabled, askGemini, streamGemini, AiError, systemPrompt, startRetention, isInjection, INJECTION_REPLY, generateQuestions, generateQuestionImage };
