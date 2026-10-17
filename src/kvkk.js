// KVKK aydınlatma metni. TASLAKTIR: yayına almadan önce okulun hukuk danışmanı tarafından onaylanmalıdır.
const KVKK_VERSION = '2026-10-v1';
const KVKK_NOTICE = {
  version: KVKK_VERSION,
  title: 'Kişisel verilerin işlenmesi hakkında aydınlatma',
  intro: 'Bu metin bir taslaktır ve okulun hukuk danışmanı tarafından onaylanmalıdır. Devam etmeden önce okumanız gerekir.',
  sections: [
    { title: 'Veri sorumlusu', text: 'Kişisel verileriniz, bu sistemi kuran okul yönetimi tarafından işlenir. İletişim için okul müdürlüğüne başvurabilirsiniz.' },
    { title: 'İşlenen veriler', text: 'Ad soyad, kullanıcı adı, okul numarası, sınıf ve ders bilgileri; ödev, sınav ve not kayıtları; devam durumu; davranış puanları ve gözlem notları; mesajlar; asistan kullanıldıysa sohbet kayıtları.' },
    { title: 'İşleme amaçları', text: 'Eğitim ve öğretim faaliyetlerinin yürütülmesi, öğrencinin ve velinin bilgilendirilmesi, okul güvenliği ve sistemin işleyişi.' },
    { title: 'Hukuki sebepler', text: 'Eğitim-öğretim faaliyetleri için mevzuattan kaynaklanan yükümlülükler. Asistan, bildirim ve veliyle paylaşım gibi isteğe bağlı özellikler için açık rıza.' },
    { title: 'Aktarım', text: 'Veriler altyapı sağlayıcılarında (veritabanı ve dosya depolama) tutulur. Asistan kullanıldığında sorular Google Gemini hizmetine iletilir. Bildirimler tarayıcınızın bildirim servisi üzerinden gider.' },
    { title: '18 yaş altı öğrenciler', text: 'Öğrenci hesabının kullanımına ilişkin bu onay, öğrencinin velisi adına da verilmiş sayılır. Velisi olan öğrenciler için veli hesabı da bu metni onaylamalıdır.' },
    { title: 'Haklarınız', text: 'Verilerinize erişme, düzeltilmesini isteme, silinmesini veya işlenmesinin durdurulmasını isteme ve itiraz etme haklarınız vardır. Verilerinizin bir kopyasını Hesabım sayfasından indirebilir, silme talebinde bulunabilirsiniz.' },
  ],
};

module.exports = { KVKK_VERSION, KVKK_NOTICE };
