// Aydınlatma metni uygulama davranışını açıklar; okulun hukuk danışmanı son hâlini onaylamalıdır.
const crypto = require('node:crypto');
const KVKK_VERSION = '2026-10-v2';

function buildKvkkNotice(school = {}) {
  const controllerName = school.controllerName || school.controller_name || '';
  const controllerAddress = school.controllerAddress || school.controller_address || '';
  const controllerEmail = school.controllerEmail || school.controller_email || '';
  const controllerPhone = school.controllerPhone || school.controller_phone || '';
  const controller = controllerName || school.name || 'Okul yönetimi';
  const version = `${KVKK_VERSION}-${crypto.createHash('sha256')
    .update([controller, controllerAddress, controllerEmail, controllerPhone].join('\0'))
    .digest('hex').slice(0, 10)}`;
  const contactComplete = Boolean(
    controllerName && controllerAddress && controllerEmail,
  );
  return {
    version,
    title: 'Kişisel verilerin işlenmesi hakkında aydınlatma',
    contactComplete,
    intro: 'Bu metin, kişisel verilerinizin nasıl işlendiği hakkında bilgi verir. Devam kutusu yalnızca metni gördüğünüze ilişkin kayıt oluşturur; tek başına açık rıza veya veri işlemenin hukuki dayanağı değildir.',
    sections: [
      {
        title: 'Veri sorumlusu ve iletişim',
        text: contactComplete
          ? `${controller}; ${controllerAddress}. Başvuru e-postası: ${controllerEmail}${controllerPhone ? `; telefon: ${controllerPhone}` : ''}. Okul kayıtlarına ilişkin amaç ve araçları okul belirler.`
          : 'Okul yönetimi bu sistemdeki okul kayıtları için veri sorumlusu konumundadır. Bu okul henüz veri sorumlusu unvanı, adresi ve başvuru e-postasını tanımlamamıştır. Okul müdürü bu bilgileri Okul ayarlarından tamamlamalıdır; bu bilgiler olmadan metin yayına hazır sayılmaz.',
      },
      {
        title: 'İşlenen veri kategorileri',
        text: 'Hesap ve kimlik bilgileri (ad, kullanıcı adı, okul numarası ve isteğe bağlı e-posta; parolalar açık metin değil, doğrulama özeti olarak); eğitim ve faaliyet kayıtları (sınıf, ders, ödev, teslim, sınav yanıtı ve sonucu, not, yoklama, davranış puanı ve gözlem notu); iletişim ve içerikler (mesajlar, pano notları ve yüklenen dosyalar); işlem ve güvenlik kayıtları (IP adresi ve giriş zamanı, denetim kayıtları, parola sıfırlama, iki adımlı doğrulama ve başvuru/talep kayıtları); açıkça kullanıldığında takvim belirteci, bildirim aboneliği, yapay zekâ sohbeti ve yapay zekâ tercihinin metin sürümüyle birlikte verildiği/geri çekildiği zaman bilgileri. Serbest metin alanlarına sağlık veya diğer özel nitelikli kişisel verileri yazmayın.',
      },
      {
        title: 'Amaçlar ve hukuki sebepler',
        text: 'Okul kayıtları; eğitim ve okul yönetimini yürütmek, hesapları ve yetkileri yönetmek, kullanıcılarla iletişim kurmak, güvenliği sağlamak, talepleri yanıtlamak ve hukuki yükümlülükleri yerine getirmek amaçlarıyla işlenebilir. Okul, her işlem için uygulanabilir KVKK m. 5 ve gerekiyorsa m. 6 hukuki sebebini kendi faaliyet ve mevzuatına göre belirlemeli ve belgelemelidir. Bu ekrandaki okundu kaydı, bu hukuki sebeplerin yerine geçmez. Gerektiğinde açık rıza gerektiren isteğe bağlı özellikler ayrıca ve özgürce seçilebilir.',
      },
      {
        title: 'Alıcılar ve yurt dışına aktarım',
        text: 'Veriler, hizmetin çalışması için okulun seçtiği barındırma, veritabanı, dosya depolama, e-posta ve bildirim sağlayıcılarıyla; talep edilirse yapay zekâ sağlayıcısıyla paylaşılabilir. Okulum yazılımının işletmecisi, okulun talimatlarıyla veri işleyen veya kendi güvenlik/hizmet kayıtları için ayrı veri sorumlusu olabilir; gerçek roller sözleşmelerle belirlenmelidir. Sağlayıcı, ülke, alt işleyen ve aktarım dayanağı kullanılan hesap ve bölge ayarlarına göre değişir. Okul, sağlayıcı sözleşmelerini, veri konumlarını ve yurt dışına aktarım için KVKK m. 9 kapsamındaki mekanizmayı yayına almadan önce doğrulamalıdır.',
      },
      {
        title: 'İsteğe bağlı yapay zekâ ve bildirimler',
        text: 'Yapay zekâ özelliği etkinleştirilmişse gönderdiğiniz mesaj ve sohbet bağlamındaki son mesajlar yanıt üretmek üzere varsayılan Google Gemini API’sine veya işletmecinin yapılandırdığı uyumlu yapay zekâ uç noktasına iletilir. Bazı yaygın bilgi biçimleri gönderim öncesinde maskelenmeye çalışılır; bu işlem kesin anonimleştirme değildir. Sağlayıcının veri kullanımı ve saklama koşulları kullanılan hizmet, hesap/plan ve ayarlara bağlıdır. Öğrenci, kendisinin veya başkasının tanımlayıcı ya da hassas bilgilerini bu özelliğe yazmamalıdır. Yapay zekâ kullanımı ayrı bir isteğe bağlı tercihtir; tercihin verildiği ve geri çekildiği zamanlar ilgili bildirim sürümüyle kaydedilir. Geri çekmek gelecekteki kullanımı durdurur, daha önce oluşmuş kayıtları kendiliğinden silmez. Tarayıcı bildirimi açılırsa abonelik uç noktası ve teknik anahtarları bildirim göndermek için saklanır.',
      },
      {
        title: 'Çerezler ve cihaz depolaması',
        text: 'Giriş ve platform yönetimi için gerekli oturum çerezleri kullanılır; bunlar reklam takibi için değildir. Tarayıcıda tema, animasyon tercihi ve uygulama kurulumu/bildirim isteminin kapatılması gibi ayarlar yerel depolamada tutulabilir. Çevrimdışı kabuk için uygulama dosyaları servis çalışanı önbelleğinde saklanabilir; API yanıtları önbelleğe alınmaz. Bildirim aboneliği yalnızca kullanıcı tarayıcı izni verirse oluşturulur.',
      },
      {
        title: 'Saklama ve silme',
        text: 'Sohbet kayıtları, ayar değiştirilmediyse 180 gün sonra otomatik silinir; yapay zekâ kullanım sayaçları 30 günden eski olunca temizlenir. Veritabanı yedekleri son 30 yedekle sınırlandırılır; bu sayı sabit bir gün garantisi değildir ve yedekler geri yükleme amacıyla silinmiş kayıtları geçici olarak içerebilir. Okulun diğer eğitim, denetim ve güvenlik kayıtları için bu uygulamada genel bir otomatik saklama süresi tanımlı değildir; okul geçerli mevzuata göre saklama-imha takvimi belirlemelidir. Hesap silme talebi onaylandığında profil tanımlayıcıları kaldırılır ve hesap kapatılır; akademik kayıtlar, denetim izleri ve yedeklerdeki kopyalar okulun hukuki saklama yükümlülükleri ve imha takvimi doğrultusunda kalabilir. Bu işlem tüm verinin anında ve geri döndürülemez biçimde silindiği anlamına gelmez.',
      },
      {
        title: 'Çocuklar ve veli/yasal temsilci',
        text: 'Öğrencinin kutuyu işaretlemesi veli veya yasal temsilci adına verilmiş rıza olarak kabul edilmez. Okul, öğrencinin yaşını, yetkili temsilciyi ve her işlem için gerekli bilgilendirme/izin sürecini kendisi belirlemeli; gerekiyorsa veli/yasal temsilciyi ayrıca bilgilendirmelidir. Bu uygulamadaki onay kaydı tek başına temsil yetkisini doğrulamaz.',
      },
      {
        title: 'Haklar ve başvuru',
        text: 'KVKK m. 11 ve ilgili mevzuattaki koşullarla; verinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi isteme, işleme amacını ve amaca uygun kullanımı öğrenme, yurt içi/yurt dışı aktarılan üçüncü kişileri bilme, eksik/yanlış veriyi düzelttirme ve şartları oluştuğunda silme/yok etme isteme, düzeltme/silme işlemlerinin alıcılara bildirilmesini isteme, yalnızca otomatik analizle aleyhinize sonuç çıkmasına itiraz etme ve hukuka aykırı işlem nedeniyle zarar doğarsa giderim isteme haklarınız olabilir. Başvurunuzu veri sorumlusuna kimliğinizi doğrulamaya elverişli ve mevzuata uygun bir yöntemle iletin; okul mevzuattaki süre ve usulle yanıtlar. Hesabımdaki veri indirme özelliği yardımcı bir dökümdür ve tüm kayıtları kapsamayabilir. Başvurunuz reddedilir, yanıt yetersiz bulunur veya süresinde yanıt verilmezse Kanun ve ilgili mevzuattaki usulle Kişisel Verileri Koruma Kuruluna şikâyet hakkınız saklıdır.',
      },
    ],
  };
}

module.exports = { KVKK_VERSION, buildKvkkNotice };
