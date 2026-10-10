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
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
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

// Eski sohbetleri ve kullanım kayıtlarını siler. Açılışta ve her gün çalışır.
async function purgeExpired() {
  await q('delete from ai_conversations where updated_at < now() - ($1::int * interval \'1 day\')', [RETENTION_DAYS]);
  await q('delete from ai_usage where day < current_date - 30');
}
function startRetention() {
  purgeExpired().catch(error => console.error('Saklama temizliği hatası:', error.message));
  setInterval(() => purgeExpired().catch(error => console.error('Saklama temizliği hatası:', error.message)), 24 * 60 * 60 * 1000).unref();
}

module.exports = { NOTICE, NOTICE_VERSION, DAILY_LIMIT, GLOBAL_DAILY, enabled, askGemini, AiError, systemPrompt, startRetention, isInjection, INJECTION_REPLY };
