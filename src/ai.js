// Okulum Asistanı: Google Gemini ile konuşma, kullanım bildirimi ve saklama kuralları.
const { q } = require('./db');
const { forEachTenant } = require('./tenancy');

const NOTICE_VERSION = '2026-10-v2';
const NOTICE = {
  version: NOTICE_VERSION,
  title: 'Okulum Asistanı: isteğe bağlı özellik bildirimi',
  intro: 'Asistan isteğe bağlıdır. Kullanmak için ayrı tercihinizi vermeniz gerekir; reddetmeniz okulun diğer özelliklerini etkilemez.',
  sections: [
    { title: 'Hangi veri nereye gider?', text: 'Gönderdiğiniz mesaj ve sohbet bağlamındaki son mesajlar, yanıt üretmek için varsayılan Google Gemini API\'sine (veya işletmecinin yapılandırdığı uyumlu uç noktaya) gönderilir. Bilinen bazı kişisel veri biçimleri maskelenmeye çalışılır; maskeleme eksiksiz değildir ve anonimleştirme garantisi vermez. Sağlayıcının veri kullanımı, saklama süresi ve konumu kullanılan hesap, plan ve ayarlara bağlıdır; okul yöneticisi bunları kullanımdan önce doğrulamalıdır.' },
    { title: 'Saklama ve görüntüleme', text: 'Maskelenmiş kullanıcı mesajları ve yanıtlar okul veritabanında saklanır; varsayılan olarak 180 gün sonra silinir. Okul müdürü sohbetleri güvenlik ve okul yönetimi kapsamında görüntüleyebilir; bu erişim denetim kaydına yazılır. 30 günden eski kullanım sayaçları temizlenir. Yedeklerdeki kopyalar ayrı saklama süresi boyunca kalabilir.' },
    { title: 'Kullanım ve çocuklar', text: 'Özellik site kullanımı, ders konularını anlama ve öğretmen materyali taslağı içindir; yanıtlar hatalı olabilir. Ad, okul numarası, iletişim bilgisi, sağlık bilgisi, özel nitelikli veri veya başka bir kişinin tanımlanabileceği bilgileri yazmayın. Öğrencinin kendi seçimi veli/yasal temsilci izni sayılmaz. Okul, reşit olmayanların bu özelliği kullanabilmesi için gerekli bilgilendirme ve yetkilendirmeyi ayrıca sağlamalıdır.' },
    { title: 'Tercih ve geri çekme', text: 'Tercihiniz yalnızca bu isteğe bağlı yapay zekâ özelliği içindir; okulun diğer veri işleme faaliyetleri için genel rıza değildir. Hesap sayfasındaki “Asistan iznini geri çek” düğmesi gelecekteki yapay zekâ isteklerini durdurur. Geri çekme, daha önceki işlemleri geriye dönük olarak geçersiz kılmaz ve sohbetleri otomatik silmez; mevcut sohbetleri ayrıca silebilir veya okul veri sorumlusuna başvurabilirsiniz.' },
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

async function askGemini({ role, history, message, maxTokens = 900 }) {
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt(role) }] },
    contents: [
      ...history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      { role: 'user', parts: [{ text: message }] },
    ],
    generationConfig: { temperature: 0.5, maxOutputTokens: maxTokens },
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

// Eski sohbetleri ve kullanım kayıtlarını siler. Açılışta ve her gün çalışır.
async function purgeExpired() {
  await q('delete from ai_conversations where updated_at < now() - ($1::int * interval \'1 day\')', [RETENTION_DAYS]);
  await q('delete from ai_usage where day < current_date - 30');
}
function startRetention() {
  const safePurge = () => forEachTenant(purgeExpired).catch(error => console.error('Saklama temizliği hatası:', error.message));
  safePurge();
  setInterval(safePurge, 24 * 60 * 60 * 1000).unref();
}

// Sınav taslağı: sorular doğrulanmış biçimde döner (bkz. quizdraft.js)
async function draftQuiz({ topic, example, count, withImages }) {
  const { buildQuizPrompt, parseQuizDraft } = require('./quizdraft');
  const text = await askGemini({ role: 'teacher', history: [], message: buildQuizPrompt({ topic, example, count, withImages }), maxTokens: 3500 });
  return parseQuizDraft(text);
}

module.exports = { draftQuiz, NOTICE, NOTICE_VERSION, DAILY_LIMIT, GLOBAL_DAILY, enabled, askGemini, streamGemini, AiError, systemPrompt, startRetention, isInjection, INJECTION_REPLY };
