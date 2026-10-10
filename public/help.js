// Kullanım kılavuzu metni. Hem giriş yapmamış ziyaretçiler hem de uygulama içi kullanıcılar okur.

const SECTIONS = [
  {
    title: 'Başlarken',
    intro: 'Okulum üç rolle çalışır: müdür, öğretmen ve öğrenci. Her rol yalnızca kendi işini ve kendi verisini görür.',
    items: [
      ['Giriş yapma', 'Müdürseniz ana sayfadaki "Müdür girişi"ni, öğretmen ya da öğrenciyseniz "Öğretmen / Öğrenci girişi"ni kullanın. Yanlış sayfadan girerseniz sistem doğru sayfayı size söyler.'],
      ['Kullanıcı adı', 'Kullanıcı adınız 3–32 karakter olmalı: küçük harf, rakam, nokta, tire veya alt çizgi (örnek: murat.aydin). Boşluk ve Türkçe karakter kullanılamaz. Ad soyadı ise ayrı alana, Türkçe karakterlerle yazabilirsiniz.'],
      ['Oturum', 'Oturum 12 saat açık kalır. Parolanızı değiştirirseniz diğer tüm oturumlarınız kapanır.'],
      ['Bildirimler', 'Menüdeki rozetler yeni mesaj, yeni not, yeni ödev ya da yeni teslimi gösterir. İlgili sayfaya girince rozet sıfırlanır.'],
    ],
  },
  {
    title: 'Müdür',
    intro: 'Okulun kurulması, sınıf ve ders tanımı, hesaplar ve denetim sizin sorumluluğunuzda.',
    items: [
      ['Okulu kurma', 'İlk kez açtığınızda ana sayfadan "Okulu kur"a girin, okul adı, şehir, eğitim yılı ve kendi müdür hesabınızı oluşturun. Bu işlem yalnızca bir kez yapılır.'],
      ['Sınıf ve ders', 'Okul sayfasında sınıfları (örnek: 6/A) ve dersleri (örnek: Matematik) ekleyin. Sınıf veya ders silinirse ona bağlı ödev ve yoklama kayıtları da silinir.'],
      ['Hesap açma', 'Kişiler → "Yeni hesap". Rol seçin: öğretmen, öğrenci ya da müdür. Öğrenciye okul numarası ve sınıf verin. Öğretmene, verdiği sınıf-ders kutularını işaretleyerek atama yapın.'],
      ['Birden fazla müdür', 'Yeni hesap formunda rol olarak "Müdür" seçerek başka bir müdür ekleyebilirsiniz. Müdürler birbirinin hesabını silebilir ya da şifresini sıfırlayabilir, kendi hesabını kendisi silemez.'],
      ['Şifre ve silme', 'Bir kişinin şifresini "Şifre" düğmesiyle sıfırlayın. Hesabı silmek geri alınamaz; onay penceresi çıkar. Kendi şifrenizi sol alttaki "Şifre" düğmesinden değiştirin.'],
      ['Arama', 'Kişiler sayfasında isim ya da okul numarasıyla arama yapın, rol filtresiyle öğretmen, öğrenci veya müdürleri ayırın.'],
      ['Uyarılar ve denetim', 'Genel bakıştaki uyarı panelinde üst üste devamsızlık yapan öğrenciler görünür. Denetim sayfasında hesap, not, yoklama ve başarısız giriş gibi tüm önemli işlemler kayıt altındadır.'],
    ],
  },
  {
    title: 'Öğretmen',
    intro: 'Yalnızca size atanmış sınıf ve derslerde ödev, yoklama ve not işlemleri yapabilirsiniz.',
    items: [
      ['Sınıflarım', 'Size atanan sınıfları ve öğrencilerin devam oranlarını görün. "Yoklama al" ile doğrudan yoklamaya geçin.'],
      ['Ödev oluşturma', 'Ödevler → "Ödev oluştur". Sınıf ve ders seçin, başlık ve yönerge yazın, son teslim tarihi koyun. İsterseniz PDF, Word ya da görsel dosya ekleyin (en fazla 5 MB). "Online teslim" öğrencinin dosya yüklemesini sağlar, "Kağıt" ise sınıf içi ödevler içindir.'],
      ['Teslimleri notlandırma', 'Ödevin "Teslimler" düğmesine basın. Her öğrencinin dosyasını indirebilir, notunu ve geri bildirimini girebilirsiniz. Değiştirdiğiniz satırlar "Tüm notları kaydet" ile tek seferde kaydedilir.'],
      ['Ödevi düzenleme', 'Ödev satırındaki kalem simgesiyle başlık, yönerge ve son teslimi değiştirebilirsiniz. Dosyayı değiştirmek için ödevi silip yeniden oluşturun.'],
      ['Yoklama', 'Yoklama sayfasında sınıf, ders ve tarih seçin. Her öğrenci için "Geldi" ya da "Gelmedi" işaretleyin, sonra "Yoklamayı kaydet"e basın. "Hepsi geldi" tüm listeyi işaretler. Gelecek tarihe yoklama girilemez.'],
      ['Uyarılar', 'Genel bakıştaki uyarı panelinde üst üste 3 ders devamsız kalan ya da en az 5 derste %80\'in altında devamı olan öğrenciler listelenir.'],
      ['Mesajlar', 'Öğrencilerinize, diğer öğretmenlere ve müdüre yazabilirsiniz. Sınıf grubu sohbeti, o sınıfın tüm öğrencilerine ve öğretmenlerine açıktır.'],
    ],
  },
  {
    title: 'Öğrenci',
    intro: 'Ödevlerinizi buradan teslim eder, notlarınızı ve devamınızı izlersiniz.',
    items: [
      ['Ödevlerim', 'Size verilen ödevleri, son teslim tarihlerini ve durumlarını görürsünüz. "Teslim et" ile dosyanızı yükleyin (PDF, Word, JPG ya da PNG; en fazla 5 MB).'],
      ['Yeniden gönderme', 'Son teslim tarihine kadar dosyanızı yeniden gönderebilirsiniz. Yeni dosya gönderince önceki not sıfırlanır, öğretmeniniz yeniden değerlendirir.'],
      ['Notlar', 'Öğretmeninizin notu ve geri bildirimi, ödevinizin kartında ve genel bakışta görünür.'],
      ['Devamım', 'Derslerinize göre devam oranınızı ve son yoklama kayıtlarınızı görürsünüz.'],
      ['Mesajlar', 'Öğretmenlerinize ve müdüre yazabilirsiniz. Sınıf grubu sohbetine de katılabilirsiniz. Öğrenciler birbirine özel mesaj gönderemez.'],
    ],
  },
  {
    title: 'Panolar',
    intro: 'Panolar, Padlet benzeri notlar tahtalarıdır. Sınıf panosu bir sınıfa, okul panosu ise tüm okula aittir.',
    items: [
      ['Sınıf panosu', 'Öğretmen, verdiği sınıf için pano açar. O sınıfın öğrencileri ve öğretmenleri panoyu görür ve not ekler. Panoyu düzenleme ve silme yetkisi öğretmendedir.'],
      ['Okul panosu', 'Yalnızca müdür açar ve yazar. Okul panosundaki notlar ana sayfada "Okuldan duyurular" olarak yayınlanır. Herkes okuyabilir, öğretmen ve öğrenciler yazamaz.'],
      ['Not ekleme', 'Pano sayfasında "Not ekle" ile başlık, metin, bağlantı, renk ve isteğe bağlı dosya (PDF, Word, JPG, PNG; 5 MB) ekleyebilirsiniz. Bağlantılar http veya https ile başlamalı.'],
      ['Not silme', 'Kendi notunuzu her zaman silebilirsiniz. Başkasının notunu yalnızca panoyu yöneten öğretmen veya müdür silebilir.'],
    ],
  },
  {
    title: 'Sık sorulanlar',
    intro: '',
    items: [
      ['Hesabımı unuttum', 'Okul müdürünüzden şifrenizi sıfırlamasını isteyin. Müdür sizin için yeni bir şifre belirleyecektir.'],
      ['Yanlış şifre girdim', 'Kısa süre içinde çok fazla yanlış deneme yaparsanız 15 dakika beklemeniz gerekir. Bu, hesabınızı korumak içindir.'],
      ['Dosyam yüklenmiyor', 'Dosya PDF, Word (.doc/.docx), JPG veya PNG olmalı ve 5 MB\'ı geçmemeli. Dosyanın uzantısı ile içeriği uyuşmalıdır.'],
      ['Yanlış sayfaya girdim', 'Müdür olmadığınız halde "Müdür girişi"nden girdiyseniz ya da tersi olduysa, ekrandaki açıklamayı okuyup doğru giriş sayfasını kullanın.'],
    ],
  },
];

const section = (s, index) => `
  <details class="help-section" ${index === 0 ? 'open' : ''}>
    <summary><h2>${s.title}</h2></summary>
    ${s.intro ? `<p class="help-intro">${s.intro}</p>` : ''}
    <dl class="help-list">
      ${s.items.map(([term, text]) => `<div class="help-item"><dt>${term}</dt><dd>${text}</dd></div>`).join('')}
    </dl>
  </details>`;

// Metin sabit içerik olduğu için HTML olarak basılır; dinamik veri içermez.
export function helpHtml() {
  return `<section class="help">
    <header class="help-head">
      <p class="eyebrow">Kullanım kılavuzu</p>
      <h1>Okulum nasıl kullanılır?</h1>
      <p class="subtitle">Rolünüze uygun bölümü açıp adım adım izleyin.</p>
    </header>
    ${SECTIONS.map(section).join('')}
  </section>`;
}
