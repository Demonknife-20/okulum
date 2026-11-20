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

## Kimya 3D: rehberli deney kılavuzu
- Durum sekmesinde bir deney seçilir (nötrleşme, suyun kaynaması, metal ile asit). Adımlar sahnenin anlık durumundan otomatik işaretlenir: giyilen ekipman, ocak, üçayak, tüplerdeki maddeler ve sıcaklık.
- Kontrol mantığı public/chem-guide.js içinde, testler test/chem-guide.test.mjs.

## Kimya 3D: pipet, büret, cam balon; titrasyon; fizik sürükle-bırak ağırlıklar
- Pipet (5 mL) ve büret (1 mL damla): önce bir sıvı şişesine tıklayıp doldurulur, sonra tüpe tıklanarak dökülür. Araç elde kalır; her dökülen hacim tüpte mL olarak kaydedilir.
- Titrasyon: büretle asite baz eklenince pH ve dönüm noktası mesajda görünür; dönüm noktasından sonra fenolftalein pembeleşir. Hesap public/titration.js ve labs.js içindeki titrationPH'a dayanır.
- Cam balon: tabloya konur, tüp gibi karıştırılır; daha büyük şekilde görünür.
- Fizik sürtünmeli itme: ağırlık çiplerini (0,5/1/2 kg) tutup bloğun üstüne bırakınca kütle artar; sıfırlama düğmesi var.
- Sınır: tüpler hâlâ yüzde (doluluk) modeliyle çalışır; tüm kaplarda gerçek mL izlemesi yalnızca pipet, büret ve titrasyon için vardır.

## Kimya 3D: tam ekran
- Başlıktaki "⛶ Tam ekran" düğmesi sahneyi tarayıcının tam ekran alanına alır; çıkmak için aynı düğme ya da Esc. Sahne boyutu otomatik uyar.
- Tarayıcı tam ekranı desteklemiyorsa düğme devre dışı kalır (ör. iPhone Safari, sayfa öğelerinde tam ekran desteklemez).

## Genel menü: "Okulunu bul"
- Genel menüye "Okulunu bul" bağlantısı eklendi (#/okullar).
- Okul vitrini sabit örnek okullar yerine gerçek okul listesini (/api/schools) gösterir: ad, şehir ve okulun kendi giriş sayfasına bağlantı. Arama ad ve şehirde çalışır.
- Okul listesi boşsa açıklayıcı bir mesaj gösterilir. Seviye filtresi kaldırıldı (veritabanında düzey bilgisi yok).

## API temizliği: çift rotalar kaldırıldı
- /api/push/key, /api/push/subscribe ve /api/push/unsubscribe rotalarının ikişer tanımı vardı. Yönlendirici ilk eşleşeni kullandığı için ikinci tanımlar hiç çalışmıyordu. Tek tanım kaldı: aboneliğin https olma kontrolü korundu, hazır olmayan bildirim sunucusu için 503 döner, abonelik denetim kaydına yazılır.
- Yönlendirmedeki tüm rotalar tarandı; başka çift tanım yok.

## Kimya 3D arayüzü v10 (görsel cila)
- Başlık ve durum rozetlerinde vurgu rengi ve hafif parlama; ocak göstergesi için yumuşak nabız.
- Malzeme düğmelerinde simge kutuları ve üstüne gelince ışıma; seçili malzeme vurgu renginde.
- Mesaj çubuğu ve kılavuz adımları için renkli kenar ve vurgulanan sıradaki adım.
- Hareket azaltma tercihinde tüm bu animasyonlar kapanır. Sahne ve oynanış değişmedi.

## Site arka planı
- Arka plan birden çok kez tanımlanmış ve çakışıyordu. Dosyanın sonuna tek yetkili tanım eklendi: iki yumuşak ışık lekesi ve ince nokta ızgara.
- Koyu modda aynı yapı koyu zeminle uygulanır. Mobilde arka plan sabitleme kapatılır (kaydırmada daha akıcı).

## Güvenlik sıkılaştırma
- Denetlendi ve sağlam bulundu: oturum çerezleri HttpOnly + SameSite=Lax (üretimde Secure); değiştirici isteklerde Origin denetimi (CSRF); içerik türü kontrolü; 8 MB gövde sınırı; giriş ve parola değişiminde deneme sınırı; genel oran sınırlamaları; sıkı içerik güvenlik politikası (CSP), nosniff, DENY, HSTS (üretim).
- Düzeltildi: PDF önizleme yanıtında tam CSP yerine tek başına basit bir politika kullanılıyordu (object-src ve base-uri korumaları düşüyordu). Artık tam politika korunuyor; yalnızca aynı site çerçevesine izin veriliyor.
- Bilinen sınır: bağımlılık açıkları bu ortamda taranamadı. Deploy öncesi `npm audit` çalıştırılmalı.

## Backend: istek kimliği ve zaman aşımları
- Her isteğe X-Request-Id yanıt başlığı eklenir. Sunucu hatalarında günlük ve 500 yanıtı aynı kimliği içerir; bir kullanıcı hata kimliğini bildirirse günlükte aramak mümkün.
- HTTP zaman aşımları açıkça tanımlandı: başlıklar 30 sn, istek 60 sn, keep-alive 65 sn (yük dengeleyicinin zaman aşımından uzun).
- Gözden geçirmede bulunan hata düzeltildi: istek kimliği için crypto modülü içe aktarılmamıştı (ilk istekte sunucu hatası verecekti).

## Kimya 3D: rapor yönetimi (arka uç ve arayüz)
- Arka uç: GET /api/lab/reports/:id (öğrenci kendininkini, müdür herhangi birini) ve DELETE /api/lab/reports/:id (öğrenci kendininkini siler). Kimlik biçimi ve sahiplik sunucuda denetlenir; yetkisi olmayana rapor "bulunamadı" döner.
- Arayüz: rapor listesindeki başlığa tıklanınca ölçüm satırları açılır; öğrenci raporu silebilir (onay ister).

## Kalite kontrolü: npm run check
- scripts/check.mjs ağ ya da veritabanı gerektirmeden şunları denetler: tüm JavaScript dosyalarının sözdizimi, API'de çift rota tanımı, test/ altındaki her testin package.json test listesinde olması.
- Her değişiklikten sonra çalıştırılmalı: `npm run check`.

## Güvenlik testi (statik analiz + birim testleri)
- Canlı siteye saldırı testi yapılmadı (bu ortamda erişim yok). Yapılan: kaynak kodun tehlikeli kalıplara göre taranması ve güvenlik fonksiyonlarının testi.
- Tarama sonuçları: eval yok; SQL'e giren şema ve tablo adları doğrulanmış ya da sabit listeden geliyor; oturum sırrı üretimde zorunlu; innerHTML'de kullanıcı verisi kaçışlanıyor (graph ve diğer yerler). Yanlış alarm olan eşleşmeler (regex exec) incelendi.
- test/security-hardening.test.mjs: parola doğrulama, rastgele tuz, düz metin içermeme, HttpOnly/SameSite çerez, değiştirilmiş jeton reddi, deneme sınırı.
- Açık kalan: bağımlılık taraması (npm audit) ve dışarıdan yapılan canlı sızma testi.

## Kimya 3D: cihaza göre kalite
- Telefonlarda (dar ekran), 4 veya daha az çekirdekli ya da 2 GB'dan az bellekli cihazlarda piksel oranı 1'e iner ve gölgeler kapanır/küçülür. Masaüstünde tam kalite korunur.

## Kimya 3D: mL/gram miktar modeli ve genişletilmiş tepkimeler
- Tüm kaplar (tüp ve cam balon) artık gerçek miktarlarla çalışır: sıvılar mL, katılar gram. Standart döküm 20 mL (sıvı) ya da 2 g (katı). Doluluk = toplam hacim / kapasite (tüp 50 mL, balon 250 mL). Yüzde modeli kaldırıldı.
- Isınma ve buharlaşma bu miktarlara göre hesaplanır; su mL olarak azalır.
- Tepkime kapsamı genişledi: bakırın yer değiştirmesi (Fe, Mg, Al, Zn, Ni, Co, Cr, Mn, Sn, Pb, Ti), alüminyum ve çinkonun bazla hidrojen vermesi, magnezyum (470 °C) ve kükürt (232 °C) yanması, demir + kükürt → FeS, sıcak suda magnezyum, iyot süblimleşmesi.
- Element bilgisi her elementin tepkime durumunu söyler; tepki vermeyen elementler açıkça belirtilir (çoğu element bu deney koşullarında tepkime vermez).
- Testler: test/chem-volume.test.mjs, test/chem-reactions.test.mjs.

## Kimya: tepkime kuralları veri tablosundan
- Element tepkimeleri artık kimyasal kurallara dayalı bir veri tablosundan üretilir (chemistry.js): aktivite serisi (asitle hidrojen, bakırın yer değiştirmesi), suyla tepkime (alkali ve toprak alkali), bazla tepkime (Al, Zn), ısıtınca yanma sıcaklıkları (Mg, Al, Fe, C, P, S), sıcak suda Mg, iyot süblimleşmesi, demir + kükürt.
- Soy ve kararlı elementler (He, Ne, Ar, Kr, Xe, Rn, Au, Pt, Hg, Ag, Cu) açıkça tepkime vermez olarak işaretlenir. Element bilgisi bunu gösterir.
- Yeni bir kural eklemek için tabloya bir satır eklemek yeterli.
- Kapsam sınırı: halojenler, tuz çözeltileri (başka metal tuzları) ve oksit/asit ürünleri henüz yok; bunlar için aynı tabloya ayrı kurallar gerekir.

## Kimya 3D: tarayıcısız duman testi (npm run test:chem3d)
- Sahne, THREE ve DOM taklit edilerek çalıştırılır (test/chem3d-smoke). Kaynak her seferinde geçici klasöre kopyalanır; proje dosyaları değişmez.
- Kapsam: 300 karelik döngü, malzeme dökme ve mL kaydı, nötrleşme ve ürün mesajı, ocak ve üçayak uyarısı, tartı, periyodik tablo, pipet dolum ve 5 mL dökme, cam balon.
- Sonuç: tanımlı yollarda çalışma zamanı hatası yok.
- Sınır: GPU, gerçek görünüm (renkler, gölgeler, yerleşim) ve dokunmatik davranış bu testte kapsanmaz; bunlar gerçek cihazda denenmelidir.

## Kimya 3D: örnek deneyler (rehberli kılavuz)
- Yeni kılavuzlar: titrasyon (dönüm noktası), kireç taşı ile asit, çinko ile bakır sülfat, magnezyumun yanması, yağ ve su. Önceki üç deneyle birlikte toplam sekiz örnek deney.
- Her deney adımları sahneden otomatik işaretler; sahne anlık durumuna tüp miktarları (mL/g) eklendi.
- Testler: test/chem-guide.test.mjs.

## Ana sayfa bağlantıları düzeltildi (404 hatası)
- Müdür girişi, öğretmen/öğrenci girişi, kurulum ve kılavuz düğmeleri "/okulum//#/..." gibi çift eğik çizgili adres üretiyordu; sunucu bunu tanımadığı için 404 veriyordu. Taban adres artık normalize ediliyor ve bağlantılar "#/..." biçiminde.
- "Gizlilik" bağlantısı göreli "gizlilik" yerine "/gizlilik" oldu.
- Üst menü stilleri tek ve açık bir blokta toplandı: okunabilir renk, hizalı düğmeler, dar ekranda yatay kaydırma.
