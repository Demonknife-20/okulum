# Yapılan düzeltmeler

1. **Açılış ekranında takılma (asıl hata):** `three` kütüphanesi unpkg'den yükleniyordu, CSP (`script-src 'self'`) bunu engelliyordu ve tüm uygulama başlamıyordu. `three@0.160.0` artık paket olarak eklendi ve derlemeye dahil edildi (`scripts/build.mjs` içindeki `external` kaldırıldı).
2. `public/app.js`: sondaki tanımsız `boot();` çağrısı silindi.
3. `src/db.js`: `hasDatabase` dışa aktarımı eklendi (DATABASE_URL tanımlı olsa da "veritabanı yok" moduna düşme hatası), `pool` bildirimi eklendi.
4. `src/platform.js`: `platform.schools.status` sütununu oluşturan göç hiç çağrılmıyordu; artık `bootstrapPlatformAdmin` başında çalışıyor.
5. `public/fx.js`: eksik `applyFxClass` eklendi (animasyon ayarı hata veriyordu), açılışta uygulanıyor.
6. `public/chem3d.js`: eksik `updateMaterialButtons` eklendi.
7. `public/platform.js`: eksik `icon` eklendi (okul silme düğmesi).
8. `test/api.test.js`: eksik `PDF` sabiti eklendi. `src/api.js`: kullanılmayan parametre temizlendi.

Sonuç: eslint 0 hata, testler 117 geçti / 0 başarısız.
Render'da gerekli ortam değişkenleri: DATABASE_URL (ayarlı). Üretimde SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY, giriş için PLATFORM_ADMIN_USERNAME / PLATFORM_ADMIN_PASSWORD (16+ karakter).

## Laboratuvarlar: tek sayfa ve 3D kimya düzeltmesi
- Sol menüdeki beş laboratuvar girişi (Matematik, Fizik, Kimya, Kimya 3D, Bilgisayar) tek "Laboratuvarlar" sayfasında sekmelere toplandı. Eski bağlantılar (#/kimya, #/kimya3d, #/fizik, #/geogebra, #/bilgisayar) otomatik yönlenir.
- Kimya sekmesinde Düzlem (2D) ve 3D laboratuvar arasında geçiş var.
- 3D kimya: `onMount` hiç çağrılmıyordu ve `window.THREE` kontrolü sahneyi her zaman "yüklenemedi" olarak gösteriyordu. Sahne artık doğru yaşam döngüsüyle başlıyor; malzeme seçimi, tüpe tıklayarak dökme, tüp/brülör sürükleme, ısıtma ve tepkimeler (çözünme, tuzlu su, köpürme, kaynama, yanma) çalışıyor.

## Açılışta takılma (Okulunuz hazırlanıyor… ekranı)
- Sunucu artık veritabanına bağlanmadan önce dinlemeye başlıyor. Veritabanı geç kalırsa API 503 döner, sayfa açılır.
- Veritabanı havuzuna bağlantı ve sorgu zaman aşımı (10 sn / 15 sn) eklendi.
- İstemci API çağrılarına 20 sn zaman aşımı koyuldu; açılış ekranı en fazla 25 sn sonra kapanıp uyarı gösterir.
- Build güvenlik kontrolü: uygulama paketi 50 KB'tan küçükse build durur (boş paket yayınlanmaz).

## Laboratuvarlar v2: sol menü klasörü, Kimya ve Kimya 3D ayrı, Biyoloji
- Sol menüde "Laboratuvarlar" açılır klasör oldu (tıklayınca altındaki laboratuvarlar açılır). Alt menüde ve telefonda da çalışır.
- Kimya Laboratuvarı (2D) ve Kimya 3D ayrı sayfalar. 3D sahne sayfa açılınca doğru başlatılır; tüp/brülör sürükleme, malzeme dökme ve tepkimeler çalışır.
- Yeni Biyoloji Laboratuvarı: hücre yapıları, genetik çaprazlama (Punnett), DNA replikasyonu, enzim aktivitesi, fotosentez hızı, hücre döngüsü, kalp atış hızı.
- Fizik: "Hareketi göster" düğmesiyle eğik atış animasyonu.

## Laboratuvarlar v3
- Fizik: "Yay–kütle sistemi" paneli eklendi (periyot, frekans, en yüksek hız, toplam enerji; konum-zaman grafiği ve animasyon).
- Bilgisayar: sıralama bölümünde Kabarcık, Birleştirme ve Hızlı sıralama seçilebilir; her algoritmanın karmaşıklığı gösterilir.
- Yeni testler: test/lab-extra.test.mjs (yay-kütle ve sıralama adımı normalizasyonu).

## Matematik hesap panosu ve birinci şahıs Kimya 3D
- Matematik sayfasına "Hesap panosu" eklendi: ikinci derece denklem (karmaşık kökler dahil), iki bilinmeyenli denklem sistemi, üçgen (alan, çevre, açılar, tür), istatistik, yüzde değişim, bileşik faiz, asal çarpan/EBOB/EKOK, permütasyon ve kombinasyon. Hesaplar public/math-tools.js içinde, testleri test/math-tools.test.mjs'de.
- Kimya 3D artık birinci şahıs: oda, raflarda malzemeler (su, asit, baz, fenolftalein, toz, tuz, efervesan, kağıt, kibrit), ispirto ocağı. Kibritle ocağı yakıp tüpü ocağın yanına koyarak ısıtın. Asit-baz nötrleşmesi, fenolftalein renk değişimi ve diğer tepkimeler.

## Laboratuvarlar klasörü: tıklama ve animasyon
- Klasör tıklaması #nav kapsayıcısına bağlandı (menü yeniden çizilse de çalışır).
- Açılış/kapanış animasyonlu (yükseklik ve saydamlık geçişi).

## Kimya 3D: üçayak, amyant teli, bırakma; grafik görünümü
- Raftan "Üç ayaklı + amyant teli" alınıp ocağın üstüne kurulur. Tüpler amyant telinin üstünde ısıtılır; üçayak yoksa ocak ısıtmaz.
- Elde tutulan tüp artık takılı kalmaz: her tıklama bırakır, Q tuşu her şeyi bırakır.
- Grafikler ızgara, eksen etiketleri ve gradyan dolgu ile yeniden çizildi (fizik, yay-kütle, titrasyon).

## Kimya laboratuvarı v4: genişletilmiş oda, periyodik tablo, termometre, tüp bilgisi
- Oda büyüdü; sol duvarda periyodik tablo var. Tıklayarak element alınır (Na, Mg); diğer elementler bilgi verir.
- Termometre: elinize alıp tüpe tıklayın; sıcaklığı ölçer. Tüp bilgisi (sıcaklık, hacim, kütle, yoğunluk, içerik) bakarken görünür.
- Tepkimeler public/chemistry.js içinde: asit üstüne su dökmek (sıçrama ve ani ısınma, kamera sarsıntısı), suya asit eklemek (güvenli), sodyum+su (patlama), magnezyum+asit (hidrojen).
- Kurallar ve maddelerin yoğunlukları test/chemistry.test.mjs ile doğrulanır.

## Kimya 3D görsel yenileme
- Cam tüpler ve şişeler dönel (yuvarlatılmış) profillerden; ahşap masa, karo zemin ve sıva duvar dokuları eklendi.
- Ortam yansımaları (RoomEnvironment) ve ACES ton eşleme ile daha gerçekçi ışık.
- Arayüz: cam efektli kutular, yumuşak gölgeler, malzeme düğmelerinde etkileşim, düzenli durum kartları.

## Kimya 3D: lazerli termometre, yeni tüp, buharlaşma
- Lazerli termometre elinizde görünür (ekran ve kırmızı lazer ışını). Ekrandaki LCD, baktığınız tüpün sıcaklığını ve içeriğini anlık gösterir. Tıklayınca ölçüm mesajı çıkar, termometre elinizde kalır.
- Raftan "Yeni deney tüpü" alıp masanın boş bir yerine tıklayarak tüp eklenir (en fazla 5). Sıfırlayınca ekstra tüpler kaldırılır.
- Su kaynayınca hacmi azalır, buhar yükselerek dağılır; su tamamen bitince tüpten çıkar ve bilgi mesajı verilir.

## Kimya 3D v6: gerçekçi ısınma, 118 element, koruyucu ekipman, radyoaktif kutu
- Isınma fiziksel: sıcaklık artışı = güç ÷ (kütle × özgül ısı + cam). Metal hızlı, su yavaş ısınır. Su 100 °C'de kaynama plato yapar, enerji buharlaşmaya gider; buharlaşan su tamamen bitince tüpten çıkar.
- Periyodik tablo: 118 element, ana tablo + lantanit/aktinit satırları. Radyoaktif olmayan her element alınabilir; radyoaktifler yalnızca kutudan cımbızla alınır.
- Koruyucu ekipman: eldiven, gözlük, önlük raftan değil sağ duvardaki askıdan alınır; giyme animasyonu ve kolların kalkması vardır. Ocak yakma ve dökme ekipman gerektirir.
- Radyoaktif kutu: aç/kapat, cımbızla örnek al ve geri koy. Radyasyon ölçer doz (µSv/h) gösterir; uzaklık arttıkça düşer.
- Testler: test/chem-physics.test.mjs (ısınma, element verisi, doz, ekipman kuralları).

## Kimya 3D: ölçek çizgileri, ocak sesi, deney günlüğü
- Cam tüplerde ölçek çizgileri.
- Ocak yanarken hafif çıtırtı sesi (WebAudio; ilk etkileşimden sonra çalışır, ocak söndürülünce durur).
- Sidebar'da son 12 olayın deney günlüğü (uyarılar turuncu, başarılar yeşil).

## Kimya: daha çok malzeme (20 raf öğesi)
- Yeni maddeler: etanol (ispirto, 78 °C'de tutuşur), zeytinyağı, potasyum permanganat, bakır(II) sülfat, çinko tozu, kalsiyum karbonat.
- Yeni tepkimeler: yağ-su ayrışması, mor çözelti, kireç-asit köpürmesi, çinkoyla bakır çökmesi, etanol tutuşması.
- Raf 4. sıra eklendi.

## Kimya 3D arayüzü v7
- Kısayol çipleri sahnenin üstünde (W A S D, sürükle, tıkla, Q).
- İki sütunlu düzen: sol panel yapışkan, sahne büyük. Mobilde tek sütun.
- Malzeme düğmeleri 4 sütun, daha kompakt; panel kartları gölgeli ve sistem renkleriyle uyumlu.

## Site geneli arayüz iyileştirmeleri
- Klavye odağı: tüm bağlantı, düğme, giriş ve sekmelerde görünür odak halkası.
- Mobilde dokunma hedefleri en az 44 px.
- Yeni laboratuvar animasyonları, azaltılmış hareket tercihinde kapanır.

## Kimya 3D: kontrol ve görünüm düzeltmeleri
- Önlük artık görüşü kapatmaz; sadece kol kenarlarında ince parçalar görünür.
- Sağ tık tarayıcı menüsünü açmaz. Sağ tuşla sürükleyerek bakılır; sağ tık etkileşim yapmaz.
- Raflar alçaltıldı ve bakış açısı ayarlandı; yukarı bakmak gerekmez.
- Tuşlar pencere odağı kaybolunca ya da sekme gizlenince temizlenir (takılı kalma sorunu).
- Ekranın sol altında ▲ ◀ ▼ ▶ yön düğmeleri var (dokunmatik ve fare için).

## Kimya 3D: tam el modu, elde görünen eşyalar, tartı, buharlaşma
- Tam el modu: iki el (parmaklı), tıklayınca el uzanır, yürürken hafif sallanır. Eldiven giyince eller mavi olur.
- Elde tutulan madde, alet ya da tüp artık elde görünür. Tüp de elde taşınır.
- Raftaki aletler (üçayak, cımbız, termometre, kibrit vb.) gerçek şekilleriyle görünür.
- Dijital tartı masada: elinizdeki maddeye tıklayın ya da tartıya bakın; kütle ekranda görünür.
- Buharlaşma hızlandırıldı: su yaklaşık yarım dakikada buharlaşır; su bitince tüp 100 °C'nin üstüne çıkar.

## Laboratuvar arayüzü v8
- Sonuç listeleri ve hata mesajları daha okunur; sayılar tabular rakamlarla hizalı.
- Kaydırıcılar ana renkle uyumlu; biyoloji yapı düğmeleri hap şeklinde.
- Azaltılmış hareket tercihinde yeni geçişler kapanır.

## Kimya 3D arayüzü v9
- Üst başlık: ortam sıcaklığı, elindeki eşya ve ocak durumu rozetleri; Ocağı aç/Sıfırla/Yardım düğmeleri.
- Mesaj çubuğu her zaman görünür (uyarı ve başarılar).
- Kenar çubuğu üç sekme: Raf (arama kutulu), Ekipman, Durum (tüp bilgisi ve günlük). Sekmeler ok tuşlarıyla da gezilir.
- Yardım paneli: gezinme, etkileşim, güvenlik ve ısınma notları.
- Arama kutusuna yazarken WASD karakteri yürütmez.

## Veli hesapları (otomatik) ve deney günlüğü dışa aktarma
- Yeni öğrenci hesabı oluşturulunca, aynı parolayla "veli_<öğrenci kullanıcı adı>" adlı bir veli hesabı da oluşur ve öğrenciye bağlanır. Örnek: öğrenci "ali" → veli "veli_ali". Veli hesabına aynı şifreyle girilir ve Ali'nin bilgilerini görür.
- Öğrenci parolasını değiştirince ya da müdür sıfırlayınca veli parolası da aynı olur. Öğrenci silinince, başka çocuğu kalmamış velisi de silinir.
- Öğrenci kullanıcı adı en fazla 27 karakter olabilir (veli_ öneki için). Veli adı zaten varsa 409 hatası verilir.
- Mevcut öğrenciler için otomatik veli oluşturulmaz (parolaları bilinmediği için). Müdür, veli hesabını "Kullanıcılar" bölümünden oluşturup parolasını ayarlayabilir.
- Kimya 3D: deney günlüğü .txt olarak indirilebilir.
- Yeni testler: test/guardian.test.mjs.

## Site geneli arayüz v10
- Yükleniyor durumunda düğmede dönen gösterge (aria-busy); metin gizlenir, tıklama engellenir.
- Uyarı bildirimi için sarı-turuncu ton.
- Fare ile tıklayınca odak halkası çıkmaz; klavyede görünmeye devam eder.

## Veli ilk girişinde şifre belirleme; bildirim teşhisi
- Otomatik oluşturulan veli hesapları (must_change_password = true) ilk girişte yeni şifre belirlemek zorundadır. Giriş formunda iki yeni şifre alanı açılır; şifre belirlenmeden oturum açılmaz (migrasyon 0019).
- Öğrenci şifresi değişince veli şifresi de değişir, ancak yalnızca veli henüz kendi şifresini belirlemediyse.
- Bildirimler: sunucu logunda bildirim gönderme hatası görünmüyor. Olası nedenler: kullanıcının bildirimleri açmamış olması (Ayarlar), tarayıcı izninin verilmemesi, iOS'ta uygulamanın ana ekrana eklenmemiş olması. Ayarlardaki "Bildirim testi" düğmesi aboneliği doğrular.
- Bilinen teknik borç: src/api.js içinde /api/push/key ve /api/push/subscribe rotaları iki kez tanımlı. Biri kaldırılmalı (işlevsel fark küçük).

## Büyük güncelleme: fizik, kimya 3D, biyoloji, matematik
- Fizik: serbest düşme, eğik düzlemde sürtünmeli kayma (blok animasyonu), bir boyutta çarpışma (momentum ve enerji kaybı). Hesaplar public/physics.js, testler test/physics.test.mjs.
- Kimya 3D: ekipman çıkarma (sekmedeki giyili düğmeye tekrar tıkla); radyoaktif örnek cımbızla masaya bırakılır ve geri alınır; klavye ile bakış (I/J/K/L) ve Enter ile etkileşim.
- Kimya genel kuralları: asitle hidrojen veren metaller (Zn, Fe, Al, Mg, Ca...) ve suyla tepkime veren alkali/toprak alkali metaller (K, Rb, Cs patlar). Soy metaller (Cu, Au, Ag, Pt) tepkime vermez. Kurallar public/chemistry.js, testler test/chem-elements.test.mjs.
- Biyoloji: etkileşimli mikroskop (4×, 10×, 40×, 100×), hücre ve çekirdek görüntüsü, görüş alanı. Üretim public/biology.js.
- Matematik: polinom çizici (üçüncü derece), gerçek kökler grafikte işaretlenir. Kökler public/math-tools.js içinde.
- Kod yapısı: ilk adım olarak saf mantık modülleri ayrıldı (chemistry, physics, math-tools, biology, guardian). chem3d.js ve views.js henüz bölünmedi.

## Yeni özellikler (ikinci tur)
- Fizik: basit sarkaç (periyot, frekans, hız ve açının zamana göre grafiği); etkileşimli sürtünmeli itme (blok kütlesi, itme kuvveti, sürtünme yüzeyi seçimi; kayıp kaymadığı gösterilir). Hesaplar public/physics.js.
- Matematik: ikinci derece denklemin adım adım çözümü (Türkçe açıklamalı). Sayfada "Adım adım çözüm" paneli.
- Kimya: tepkime ürünleri (tuz ve su, hidrojen ve metal klorür, karbondioksit, hidroksit, şeker çözeltisi). 3D sahnede tepkime mesajına eklenir.
- Biyoloji: enzim etkinliğinin sıcaklıkla ve fotosentez hızının ışıkla değişimi grafikleri.

## Öğrenci deney raporu ve ilerleme (veritabanı + sunucu)
- Yeni tablolar (migrasyon 0020): lab_reports (öğrenci raporları) ve lab_progress (deney bazında tamamlama sayısı). Migrasyon tüm okul şemalarına otomatik uygulanır.
- API: POST /api/lab/reports (öğrenci kaydeder), GET /api/lab/reports (öğrenci kendi son 20; müdür son 100), GET /api/lab/progress (öğrenci).
- Doğrulama src/labreport.js içinde (deney kodu, başlık, en fazla 200 satır, satır başına 300 karakter). Testler test/labreport.test.mjs.
- İstemci: Fizik ve Kimya 3D sayfalarında "Deney raporu" kartı; ölçüm satırlarını kaydeder, son raporları ve toplam tamamlanmayı gösterir.
- Henüz yok: öğretmenin sınıf raporlarını görmesi.
