// Ortak içerik: uygulamadaki kılavuz ile Google için yayınlanan sayfalar bunu kullanır (ES modülü).
const HELP_SECTIONS = [
  { title: 'Başlarken', intro: 'Okulum üç rolle çalışır: müdür, öğretmen ve öğrenci. Veliler de çocuklarını izleyebilir. Her rol yalnızca kendi işini ve kendi verisini görür.', items: [
    ['Giriş yapma', 'Müdürseniz ana sayfadaki "Müdür girişi"ni, öğretmen, öğrenci ya da veliyseniz "Öğretmen / Öğrenci girişi"ni kullanın. Yanlış sayfadan girerseniz sistem doğru sayfayı size söyler.'],
    ['Kullanıcı adı', 'Kullanıcı adınız 3–32 karakter olmalı: küçük harf, rakam, nokta, tire veya alt çizgi. Boşluk ve Türkçe karakter kullanılamaz.'],
    ['Oturum', 'Oturum 12 saat açık kalır. Parolanızı değiştirirseniz diğer oturumlarınız kapanır. "Hesabım" bölümünden tüm cihazlardan çıkış yapabilirsiniz.'],
    ['Bildirimler', 'Menüdeki rozetler yeni mesaj, not, ödev ya da teslimi gösterir. İlgili sayfaya girince rozet sıfırlanır.'],
  ] },
  { title: 'Müdür', intro: 'Okulun kurulması, sınıf ve ders tanımı, hesaplar, veli bağlantıları ve denetim sizin sorumluluğunuzda.', items: [
    ['Okulu kurma', 'İlk kez açtığınızda "Okulu kur" ile okul bilgisi ve kendi müdür hesabınızı oluşturun. Bu işlem yalnızca bir kez yapılır.'],
    ['Sınıf ve ders', 'Okul sayfasında sınıfları (örnek: 6/A) ve dersleri (örnek: Matematik) ekleyin.'],
    ['Hesap açma', 'Kişiler → "Yeni hesap". Öğretmene sınıf ve ders, öğrenciye okul no ve sınıf, veliye çocuğunu verin. Toplu ekleme için "CSV ile ekle" kullanılır.'],
    ['Veli bağlantısı', 'Veli hesabını açarken çocuklarını seçin. Veli yalnızca bağlı olduğu çocukların bilgilerini görür.'],
    ['Denetim ve uyarılar', 'Denetim sayfasında önemli işlemler kayıt altındadır. Genel bakıştaki uyarı panelinde üst üste devamsızlık yapan öğrenciler listelenir.'],
  ] },
  { title: 'Öğretmen', intro: 'Yalnızca size atanmış sınıf ve derslerde ödev, yoklama, sınav ve not işlemleri yapabilirsiniz.', items: [
    ['Ödev ve notlar', 'Ödevler sayfasından ödev oluşturun, teslimleri görün ve "Tüm notları kaydet" ile notları tek seferde girin. Not grafiklerini Sınıflarım sayfasında görürsünüz.'],
    ['Sınav ve quiz', 'Sınavlar sayfasından çoktan seçmeli sınav hazırlayın. Süre ve açık-kapanış zamanı belirleyin, yayınlayın. Sonuçlar otomatik hesaplanır ve sınıf dağılımı görünür.'],
    ['Yoklama', 'Sınıf, ders ve tarih seçip her öğrenci için Geldi ya da Gelmedi işaretleyin. "Hepsi geldi" tüm listeyi işaretler.'],
    ['Pano ve asistan', 'Sınıf panosu açıp öğrencilere not, resim ve bağlantı paylaştırabilirsiniz. Asistan ders planı ve soru örnekleri hazırlar.'],
  ] },
  { title: 'Öğrenci', intro: 'Ödevlerinizi buradan teslim eder, sınavlarınızı çözer, notlarınızı ve devamınızı izlersiniz.', items: [
    ['Ödevlerim', 'Size verilen ödevleri, son teslim tarihlerini ve durumlarını görürsünüz. "Teslim et" ile dosyanızı yükleyin (PDF, Word, JPG ya da PNG; en fazla 5 MB).'],
    ['Sınavlarım', 'Açık sınavlar listelenir. Sınava başladığınızda süre sayacı çalışır. Süre dolunca cevaplarınız otomatik gönderilir.'],
    ['Notlarım', 'Ortalamanızı derslere göre ve not grafiğinizi görürsünüz.'],
    ['Asistan ve mesajlar', 'Asistan site kullanımı ve konu soruları için yardımcıdır, ödevin cevabını vermez. Öğretmenlerinize ve müdüre mesaj gönderebilirsiniz.'],
  ] },
  { title: 'Veli', intro: 'Veli hesabıyla çocuğunuzun okul hayatını izlersiniz. Yalnızca görüntüleme yapabilirsiniz.', items: [
    ['Çocuklarım', 'Bağlı çocuklarınızın sınıfını, ödevlerini ve teslim durumlarını görürsünüz.'],
    ['Devam ve notlar', 'Çocuğunuzun derslere göre devam oranını ve not ortalamasını grafikte izlersiniz.'],
    ['Öğretmenle iletişim', 'Çocuğunuzun öğretmenlerine ve müdüre mesaj gönderebilirsiniz.'],
  ] },
  { title: 'Sık sorulanlar', intro: '', items: [
    ['Hesabımı unuttum', 'Okul müdürünüzden şifrenizi sıfırlamasını isteyin.'],
    ['Yanlış şifre girdim', 'Kısa sürede çok fazla yanlış deneme yaparsanız 15 dakika beklemeniz gerekir.'],
    ['Dosyam yüklenmiyor', 'Dosya PDF, Word, JPG veya PNG olmalı ve 5 MB\'ı geçmemeli.'],
    ['Sınavın süresi doldu', 'Süre dolduğunda o ana kadar işaretlediğiniz cevaplar otomatik olarak gönderilir.'],
  ] },
];

const ABOUT = {
  title: 'Okulum hakkında',
  intro: 'Okulum, okulların ödev, yoklama, sınav, not, pano ve veli iletişimini tek bir yerde yönetmesini sağlayan bir okul yönetim sistemidir.',
  points: [
    'Müdür okulu, sınıfları ve hesapları yönetir; denetim kaydını izler.',
    'Öğretmen ödev, yoklama, sınav ve notlarla dersini takip eder.',
    'Öğrenci ödevini teslim eder, sınavını çözer, notlarını ve devamını izler.',
    'Veli çocuğunun ödev, not ve devam durumunu salt okunur görür.',
    'Asistan, site kullanımı ve ders konularında yardımcı olur.',
  ],
};

export { HELP_SECTIONS, ABOUT };
