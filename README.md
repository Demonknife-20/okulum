# Okulum

Okul yönetim sistemi: müdür, öğretmen ve öğrenci için sınıf, ders, ödev, teslim, yoklama ve özel mesajlaşma.
Veritabanı **Supabase (PostgreSQL)**, dosyalar **Supabase Storage**, yayın **Render** üzerinde.

## Özellikler

| Rol | Yapabildikleri |
|---|---|
| **Müdür** | Birden fazla müdür ekleyebilir (kendi hesabı hariç her müdür hesabını yönetebilir). Okul bilgisi, sınıf ve ders tanımı, öğretmen/öğrenci hesabı açma, düzenleme, şifre sıfırlama, silme, öğretmenlere sınıf-ders ataması |
| **Öğretmen** | Yalnızca kendi sınıf ve derslerinde ödev oluşturma ve düzenleme (dosyalı), teslimleri görme, **tüm notları tek seferde girme**, yoklama alma, sınıf devamını izleme, devamsızlık uyarılarını görme |
| **Öğrenci** | Ödevlerini görme, dosya teslim etme (yeniden gönderebilme), not ve geri bildirimi görme, kendi devamını izleme |
| **Müdür** (ek) | Denetim kaydı: kim, ne zaman, neyi değiştirdi; başarısız girişler (parolalar kaydedilmez) |
| **Herkes** | Özel mesajlaşma (yetki kurallarına uygun), sınıf grubu sohbeti, okunmamış sayısı ve bildirim rozetleri, parola değiştirme, koyu tema |

### Yetki kuralları (sunucuda zorlanır)
- Öğrenci ↔ öğrenci mesajı **yok**. Öğrenci yalnızca kendi öğretmenleri ve müdürle yazışır.
- Öğretmen yalnızca kendi verdiği sınıf-ders çiftine ödev, yoklama ve not işler.
- Öğrenci yalnızca kendi sınıfının ödevlerini görür ve yalnızca kendi teslimini indirir.
- Müdür her şeyi görür ama not veremez ve yoklama alamaz (salt okunur izleme).
- Parola değişince o hesabın diğer oturumları anında düşer.

## 1) Supabase kurulumu

1. [supabase.com](https://supabase.com) → **New project** oluştur.
2. **Project Settings → Database → Connection string → URI** sekmesinden bağlantı adresini kopyala
   (Session pooler, port 5432). `[YOUR-PASSWORD]` yerine veritabanı şifreni yaz. Bu, `DATABASE_URL` olur.
3. **Project Settings → API** sayfasından **Project URL** (`SUPABASE_URL`) ve **service_role** anahtarını kopyala.
   `service_role` anahtarı tam yetkilidir: yalnızca Render'daki gizli değişkende tut, asla tarayıcıya veya GitHub'a koyma.

Tablolar ve depolama kovası (`okulum-files`, özel) uygulama ilk açıldığında **otomatik** oluşturulur.

## 2) GitHub

Bu klasörü özel (private) bir depoya yükle. `.gitignore` `.env` ve `data/` klasörünü dışarıda tutar.

## 3) Render

1. **New → Blueprint** → depoyu seç. `render.yaml` okunur.
2. İstenen üç değeri gir:
   - `DATABASE_URL`: 1. adımdaki bağlantı adresi
   - `SUPABASE_URL`: proje adresi
   - `SUPABASE_SERVICE_ROLE_KEY`: service_role anahtarı
   (`SESSION_SECRET` otomatik üretilir.)
3. Dağıtım bitince adrese gir. İlk açılışta **"Okulunu oluştur"** ekranı gelir: müdür hesabını orada açarsın.
   Bu ekran yalnızca hiç kullanıcı yokken çalışır; sonra kapanır.

> **Ücretsiz plan notu:** Render 15 dakika kullanılmazsa uyur, ilk istek 30–60 sn sürebilir.
> Okul saatlerinde kesinti istemiyorsan ücretli plana geç.

## Ortam değişkenleri

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `DATABASE_URL` | evet | PostgreSQL bağlantı adresi (Supabase) |
| `SUPABASE_URL` | üretimde evet | Dosyalar için Supabase proje adresi |
| `SUPABASE_SERVICE_ROLE_KEY` | üretimde evet | Storage ve sunucu erişimi (gizli tut) |
| `SESSION_SECRET` | üretimde evet | Oturum imzası, en az 32 karakter. Değişirse herkes yeniden giriş yapar |
| `API_RATE_PER_MIN` | hayır | IP başına dakikada en fazla istek (varsayılan 900) |
| `WRITE_RATE_PER_MIN` | hayır | IP başına dakikada en fazla yazma isteği (varsayılan 240) |
| `NODE_ENV` | önerilir | `production` olduğunda çerez `Secure` olur ve eksik ayarlarda başlamaz |
| `TRUST_PROXY` | Render'da `1` | Giriş hız sınırının gerçek istemci IP'sini kullanması için |
| `SUPABASE_BUCKET` | hayır | Varsayılan `okulum-files` |
| `PORT`, `HOST` | hayır | Varsayılan `3000`, `127.0.0.1` (Render'da `0.0.0.0`) |
| `DATABASE_SSL` | hayır | Yerel test için `false` |

## Yerel geliştirme

```bash
npm install
cp .env.example .env     # değerleri doldur (Supabase'siz de DATABASE_URL yerel PostgreSQL olabilir)
npm run dev              # http://localhost:3000
```

Üretimde Render Build Command olarak `npm install && npm run build` kullanın. Yerelde `npm run build` ile derleme oluşturabilirsiniz; `dist/` varsa sunucu onu kullanır.

Yerelde `SUPABASE_*` boşsa dosyalar `data/uploads/` klasörüne yazılır. Üretimde bu kabul edilmez.

## Testler

```bash
TEST_DATABASE_URL=postgresql://.../okulum_test npm test
```

`TEST_DATABASE_URL` adı `test` içermelidir; testler veritabanını **sıfırlar**. Asla gerçek veritabanıyla çalıştırma.
Testler 30 senaryoyu kapsar: kurulum, yetki kuralları, dosya doğrulama, teslim kuralları, yoklama, mesaj
izolasyonu, parola değişimi, silme, hız sınırı, sayfalama, toplu not, devamsızlık uyarıları, bildirimler ve denetim kaydı.

### Bildirimler
- Menüde **Mesajlar** ve **Ödevler** rozetleri görünür; sekme başlığında toplam sayı yer alır.
- Mesajlar: sohbet bazında okunmamış sayısı; sohbet açılınca okunmuş sayılır.
- Öğrenci: yeni ödev ve yeni not. Ödevler sayfası açılınca sıfırlanır.
- Öğretmen: yeni teslimler. Ödevler sayfası açılınca sıfırlanır.

### Denetim kaydı
Müdür "Denetim" sayfasından okul bilgisi, sınıf/ders, hesap, parola, ödev, not ve yoklama işlemlerini görür.
Her kayıtta kişi, zaman, işlem, hedef ve ayrıntı bulunur. Parolalar hiçbir zaman kaydedilmez.
Kayıtlar silinmez; kullanıcı silinse bile kalır.

## Tema ve telefon düzeni (v18)

- **Koyu tema yumuşatıldı:** Arka plan artık gece siyahı değil, koyu yeşilimsi gri. Kartlar ve yüzeyler birbirinden ayrılıyor, metinler okunaklı kalıyor.
- **Telefon düzeni:** İstatistikler iki sütunlu, sayfa başlığı ve düğmeler tam genişlikte. Pencereler (modal) ekranın altından açılan sayfa olarak görünüyor. Alanlar iOS'ta otomatik yakınlaşmayı önlemek için 16 px yazı boyuyla geliyor. Dokunma alanları en az 46 px.
- **Alt gezinme çubuğu:** Beş sekme (dört sayfa ve Menü), güvenli alan (iPhone çentiği) hesaba katılıyor.
- **Performans:** Telefonda ağır arka plan animasyonları ve bulanıklık efektleri kapatıldı.
- **Tablolar:** Telefonda her satır bir kart olur, alanların etiketleri solda, değerler sağda görünür.

## Canlı yarışma, soru görselleri ve bildirimler (v17)

- **Canlı yarışma (Kahoot tarzı):** Öğretmen yayındaki bir sınav için "Canlı başlat" der ve 6 haneli PIN alır. Öğrenciler telefonlarında Canlı yarışma sayfasından PIN'i girer. Öğretmen başlatınca soru ekranda gösterilir, telefonlarda yalnızca renkli şıklar görünür. Öğretmen "Cevabı göster" ile doğru şıkkı ve kaç kişinin hangi şıkkı seçtiğini gösterir, "Sonraki soru" ile devam eder. Doğru cevap 500-1000 puan kazandırır; hızlı cevap daha çok puan verir. Bitişte katılımcıların doğru cevap puanları sınav sonucu olarak kaydedilir ve notlara yansır.
- **Süre:** Her soru için 5-120 saniye süre seçilir. Süre dolunca cevap kabul edilmez. Cevap ve süre kontrolü sunucuda yapılır.
- **Soru görselleri:** Sınav sorularına JPG veya PNG görseli eklenebilir (en fazla 5 MB). Canlı yarışmada görsel öğretmen ekranında gösterilir. Öğrenciler sınavı kendi başına çözerken görseli görür.
- **Bildirimler:** Giriş yapan kullanıcıya bildirim izni banner'ı gösterilir. "İzin ver" ile tarayıcı izni istenir. Bildirimler şu durumlarda gelir: canlı yarışma açıldığında (sınıf öğrencilerine PIN ile), yeni sınav yayınlandığında, öğrenciye puan verildiğinde. Hesabım → Bildirim ayarları ile açılıp kapatılabilir ve test bildirimi gönderilebilir.
- **Bildirim anahtarları:** Web Push anahtarları ilk açılışta otomatik üretilir ve veritabanındaki `app_settings` tablosunda saklanır. İsterseniz `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` ve `VAPID_SUBJECT` ortam değişkenleriyle kendiniz verebilirsiniz.
- **Hız sınırı:** Okul ağlarında birçok öğrenci aynı IP adresinden bağlanır. Bu yüzden varsayılan API sınırı dakikada 3000, yazma sınırı 600 istektir. Canlı yarışmada telefonlar yaklaşık 1,5 saniyede bir durum sorar.
- **Sınırlar:** Bildirimler tarayıcının kendi bildirim servisi üzerinden gelir. Telefonda kilit ekranında görünmesi tarayıcıya ve işletim sistemine bağlıdır. iPhone'da bildirimler için siteyi önce ana ekrana eklemek gerekir.

## Öğretmen araçları: davranış, program, takvim, karne (v16)

- **Davranış puanları:** Öğretmen (ve müdür) sınıfındaki öğrencilere -10 ile +10 arasında puan verir, gerekçe yazar. Toplamlara göre rozetler kazanılır (İlk adım, Yıldız, Usta, Efsane). Öğrenci "Puanlarım" sayfasında, veli çocuğunun davranış bölümünde görür.
- **Gözlem notları:** Öğretmen bir öğrenci hakkında not yazar. "Veliyle paylaş" işaretlenirse yalnızca o öğrencinin velisi görür. Öğrenci gözlem notlarını göremez.
- **Ders programı:** Haftalık program, öğretmen ve sınıf çakışmaları otomatik engellenir. Öğrenci ve veli kendi sınıfının programını görür.
- **Takvim:** Aylık görünüm. Okul geneli etkinlikleri (yalnızca müdür), sınıf etkinlikleri (öğretmen kendi sınıfı için), ödev teslim tarihleri ve sınav açılış/kapanışları tek takvimde toplanır.
- **Karne:** Öğrencinin notları, devamı, davranış özeti ve paylaşılan gözlem notları tek sayfada. "Yazdır / PDF olarak kaydet" ile PDF alınabilir. Öğretmen, müdür, veli ve öğrenci kendi karnesini görebilir.

## Görünüm, akış ve sayfa durumları (v15)

- **Açılış ekranı:** Uygulama yüklenirken marka animasyonu ve ilerleme çubuğu görünür, hazır olunca yumuşakça kapanır.
- **Sayfa geçişi:** Sayfa değişirken üstte ince bir ilerleme çubuğu gösterilir. Veriler gelene kadar iskelet ekranı görünür.
- **404:** Bilinmeyen adresler için ayrı bir sayfa vardır. Uygulama içinde bilinmeyen bir sayfa da bu ekranı gösterir. Sunucu tarafında bilinmeyen adresler HTTP 404 ve `noindex` ile yanıtlanır.
- **Asistan akışı:** Cevap parça parça gelir (`POST /api/ai/chat/stream`, SSE). Olaylar: `delta` (metin parçası), `done` (kayıt kimliği), `error` (sade hata mesajı). Hata olursa sohbet kaydı oluşmaz. İstemci sayfadan ayrılırsa yukarı akış da kesilir.
- **Markdown:** Asistan cevapları kalın yazı, madde listesi, başlık, satır içi kod ve kod bloğu olarak biçimlenir. Önce HTML kaçışı yapılır, bu yüzden cevaplardan gelen HTML çalışmaz.
- **Sağlık:** `/healthz` sürümü, veritabanı gecikmesini ve çalışma süresini döner.
- **Varsayılan Gemini modeli:** `gemini-3.1-flash-lite`. `GEMINI_MODEL` ortam değişkeni ile değiştirilebilir.

## Veli, sınav, not grafikleri ve mobil (v14)

- **Veli hesabı:** Müdür, Kişiler → "Yeni hesap" → rol "Veli" seçip çocukları işaretler. Veli girişi öğretmen/öğrenci girişinden yapılır. Veli yalnızca bağlı çocuklarının ödev, sınav, not ve devam bilgilerini görür, hiçbir şey değiştiremez. Öğretmenlerle çocuğunun sınıfındaki öğretmen için mesajlaşabilir.
- **Sınav ve quiz:** Öğretmen Sınavlar sayfasından çoktan seçmeli sorular (2-5 şık, doğru cevap, puan) ile sınav hazırlar. Açılış-kapanış zamanı ve süre belirlenir, yayınlanınca öğrenciler görür. Öğrenci sınava başladığında süre sayacı çalışır, cevaplar otomatik kaydedilir. Süre dolunca cevaplar sunucu tarafında otomatik teslim edilir. Sonuçlar öğretmende dağılım grafiğiyle görünür.
- **Not grafikleri:** Öğrenci Notlarım sayfasında derslere göre ortalama ve ödev/sınav sonuçlarını görür. Öğretmen ve müdür Notlar sayfasında sınıf bazında ödev ve sınav ortalamalarını ve not dağılımını görür.
- **Mobil:** Telefonda alt gezinme çubuğu, tablolar kart görünümüne geçer, kurulabilir uygulama (manifest) desteği vardır.
- **Google:** Kullanım kılavuzu (`/kullanim`) ve hakkında (`/hakkinda`) sayfaları gerçek adreslerle yayınlanır. `/sitemap.xml` ve `robots.txt` otomatik üretilir. Ortam değişkeni `PUBLIC_URL` (örn. `https://okulum.onrender.com`) tanımlanırsa site haritasında bu adres kullanılır.

Google'da "okulum" aramasında sonuç çıkması için: Google Search Console'a siteyi ekleyin, `sitemap.xml` adresini gönderin, siteyi okul çevrelerinde paylaşın. İlk indekslemeler birkaç hafta sürebilir.

## Toplu hesap ekleme (v13, CSV)

Müdür, Kişiler sayfasında "CSV ile ekle" ile yüzlerce hesabı tek seferde açabilir.

- Sütunlar: `ad_soyad`, `rol` (öğrenci/öğretmen), `kullanici_adi`, `parola`, `okul_no`, `sinif`, `ders_atamalari`.
- Ayırıcı noktalı virgül veya virgül olabilir. Ders atamaları `6/A:Matematik|7/B:Türkçe` biçimindedir.
- Parola boşsa güvenli bir parola üretilir ve yalnızca bir kez gösterilir ve CSV olarak indirilebilir. Sunucu bu parolaları saklamaz.
- Önce önizleme yapılır. Hatalı satır varsa hiçbir hesap eklenmez, işlem tümüyle geri alınır.
- Bir dosyada en fazla 500 satır olabilir.

## Okulum Asistanı (v12, Google Gemini)

- **Kim kullanır:** Herkes (öğrenci, öğretmen, müdür). Öğrenciler ödev cevabı yerine yönlendirme alır, öğretmenler ders materyali ve soru örnekleri alır, müdür duyuru taslakları alır.
- **Onay:** İlk kullanımda tam bildirim metni gösterilir ve kabul edilmeden sohbet açılmaz. Metin sürüm numaralıdır (`src/ai.js`, `NOTICE_VERSION`). Metin değişince herkes yeniden onaylar.
- **Kayıt ve saklama:** Sohbetler veritabanına kaydedilir ve 180 gün sonra otomatik silinir. Müdür kayıtları salt okunur görür, her görüntüleme denetim kaydına yazılır.
- **Maskeleme:** T.C. kimlik no, e-posta, telefon ve okul no yapay zekâya gitmeden önce maskelenir.
- **Hata ve sınır:** Kullanıcı başına günlük soru sınırı ve toplam günlük sınır vardır. Hata durumunda kullanıcıya sade bir mesaj gösterilir.
- **Kural dışı istemler:** "Sistem talimatlarını göster" gibi yönlendirme denemeleri yapay zekâya gönderilmeden sabit bir yanıtla reddedilir ve günlük hakkı harcamaz.

Yasal not: Bildirim metni bir taslaktır. Yayına almadan önce okulunuzun hukuk danışmanına kontrol ettirin. Google'ın ücretsiz katmanında girdilerin ürün geliştirme için kullanılabileceğini belirtir. Hassas veriler için ücretli plan veya kurumsal bir sözleşme değerlendirin.

Ortam değişkenleri:

| Değişken | Açıklama |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio anahtarı. Yoksa asistan kapalıdır. |
| `GEMINI_MODEL` | Varsayılan `gemini-2.5-flash-lite`. Google model adını değiştirirse buradan güncelleyin. |
| `AI_DAILY_LIMIT` | Kullanıcı başına günlük soru sayısı (varsayılan 30) |
| `AI_GLOBAL_DAILY` | Tüm okul için günlük toplam soru sayısı (varsayılan 400) |
| `AI_RETENTION_DAYS` | Sohbet saklama süresi (varsayılan 180 gün) |

## Tasarım sistemi (v11)

Tüm görünüm tek bir stil dosyasında (`public/styles.css`) tutulur. Üstteki `:root` bölümü renk, boşluk, köşe yuvarlama, gölge, yazı tipi ve hareket değerlerini tanımlar. Koyu tema aynı değerleri `[data-theme=dark]` altında yeniden tanımlar. Yeni renk veya boyut gerektiğinde bu değerleri değiştirmek tüm uygulamayı günceller.

## Giriş ve kullanım

- Ana sayfa (`/`): sistemin tanıtımı, "Müdür girişi" ve "Öğretmen / Öğrenci girişi" düğmeleri.
- `/#/mudur-girisi`: yalnızca müdür hesapları. Öğretmen/öğrenci hesabıyla girilmeye çalışılırsa sistem doğru sayfayı gösterir.
- `/#/giris`: öğretmen ve öğrenci hesapları. Müdür hesabıyla girilmeye çalışılırsa aynı şekilde yönlendirir.
- `/#/kurulum`: okul yalnızca bir kez kurulur. Kurulduktan sonra bu sayfa okulun kurulu olduğunu söyler.
- `/#/yardim`: rol bazlı kullanım kılavuzu. Giriş yapmadan da açılır.

Kullanıcı listelerinde isim ve okul numarasıyla arama, ödev listesinde başlığa göre arama ve yeni sohbet penceresinde kişi arama vardır.

## Dışa aktarma (CSV)

Dosyalar Excel'de Türkçe karakterlerle ve noktalı virgülle açılır. Hücreler, Excel formülü olarak çalışmasın diye korunur.

| Kim | Ne indirebilir |
|---|---|
| Müdür | Kullanıcı listesi (Kişiler), denetim kaydı (Denetim), herhangi bir sınıfın yoklaması, herhangi bir ödevin notları |
| Öğretmen | Kendi verdiği sınıf-ders yoklaması, kendi ödevlerinin notları |
| Öğrenci | Dışa aktarma yok |

Düzenli yedek için bu dosyaları periyodik olarak indirmeniz önerilir (Supabase ücretsiz planında otomatik yedek yoktur).

## Başlangıç listesi ve hesap

- Müdür genel bakışında, okul kurulumunun hangi adımlarının tamamlandığını gösteren bir liste bulunur. Hepsi tamamlanınca gizlenir.
- Herkes sol alttaki **Hesabım** düğmesiyle kendi adını değiştirebilir ve şifresini değiştirebilir. Kullanıcı adı değiştirilemez.

## Pano atamaları, onay ve resimler (v10)

- **Öğrenci atama:** Sınıf panosunda "Yalnızca atanan öğrenciler not eklesin" açılırsa yalnızca öğretmenin seçtiği öğrenciler not (resim dahil) ekleyebilir. Atamalar pano ayarlarından "Öğrencileri ata" ile yapılır.
- **Onay:** "Öğrenci notları onaylansın" açılırsa öğrenci notu öğretmen onaylayana kadar yalnızca yazarda görünür. Bekleyen notlar pano sayfasında sayılır ve "Onayla" ile yayına alınır.
- **Resimler:** JPG ve PNG dosyaları notta önizleme olarak görünür. PDF ve Word yalnızca indirilir.

## Kopyalama koruması (v10)

- Bilinen kopyalama araçlarının kullanıcı ajanları (HTTrack, WebCopier, Teleport, SiteSucker, wget, Scrapy vb.) 403 ile reddedilir.
- Sayfada normal kullanıcıya görünmeyen bir tuzak bağlantı vardır. Kopyalayıcılar bu bağlantıyı izleyince IP adresi 1 saat engellenir. `/.env` ve `/.git` gibi yollar da tuzaktır.
- Statik dosyalar IP başına dakikada 600 istekle sınırlıdır. `robots.txt` API ve tuzağı dışlar. API yanıtları `noindex` başlığı taşır.
- JS ve CSS derlemesi küçültülür ve içerik özetiyle adlandırılır (`npm run build`, çıktı `dist/` klasöründe). Bu dosyalar uzun süre önbelleğe alınır.

Not: Tarayıcının çalıştırmak için indirdiği herkese açık sayfalar (ana sayfa, kılavuz, okul duyuruları) hiçbir yazılım tarafından tam olarak engellenemez. Okul verisi ise yalnızca giriş yapan yetkili kullanıcılara sunulduğu için kopyalayıcılar veriyi alamaz.

## Panolar (Padlet benzeri)

- **Sınıf panosu:** Öğretmen, verdiği sınıf için pano açar. O sınıfın öğrencileri ve öğretmenleri görür ve not ekler. Panoyu düzenleme ve silme yetkisi öğretmendedir.
- **Okul panosu:** Yalnızca müdür açar ve yazar. Okul panosu notları ana sayfada "Okuldan duyurular" olarak herkese açık yayınlanır.
- Notlar başlık, metin, güvenli bağlantı (yalnızca http/https), renk ve dosya (PDF, Word, JPG, PNG; 5 MB) içerebilir.
- Dosyalar yalnızca panoyu görebilen kişilere indirilir.

## Koruma özellikleri

- **Tüm cihazlardan çıkış:** Hesabım → "Tüm cihazlardan çıkış yap". Açık olan bütün oturumlar anında geçersiz olur. Parola değişince de aynısı olur.
- **Son giriş bilgisi:** Hesabım'da son girişin zamanı ve IP adresi görünür. Müdür girişleri denetim kaydına yazılır.
- **Hız sınırı:** Her IP için dakikada belirli sayıda istek. Yazma istekleri ayrıca sınırlıdır. Aşıldığında 429 döner.
- **Parola kuralı:** En az 8 karakter, hem harf hem rakam, çok yaygın parolalar reddedilir.
- **Başlıklar:** Üretimde HSTS, ayrıca COOP ve CORP başlıkları.

## Güvenlik özeti

### Devamsızlık uyarıları
Son 90 günde şu koşullardan biri oluşan öğrenci-ders kaydı uyarı olarak listelenir (değerler `src/api.js` içinde `ALERT` ile ayarlanır):
- **Üst üste 3 ders devamsızlık** (en yüksek öncelik)
- **En az 5 ders kaydı varken devam %80'in altında**

Müdür tüm okulu, öğretmen kendi derslerini, öğrenci yalnızca kendi devamını görür.

### Listeler ve toplu işlemler
- Kişi ve ödev listeleri sayfalıdır (sayfa başına 25 / 20 kayıt). Kişi listesi rol ve isim/okul numarasına göre sunucu tarafında filtrelenir.
- Mesaj geçmişi son 100 mesajla açılır, "Daha eski mesajlar" ile 50'şer ilerlenir.
- Toplu not kaydı tek işlemdir: listede yabancı bir teslim varsa hiçbir not kaydedilmez.

- Parolalar `scrypt` ile özetlenir; kullanıcı yoksa da aynı süre harcanır (zamanlama saldırısına karşı).
- Oturum çerezi HMAC ile imzalanır, `HttpOnly`, `SameSite=Lax`, üretimde `Secure`, 12 saat geçerli.
- Çapraz kaynaklı yazma istekleri (`Origin`) ve JSON dışı gövdeler reddedilir.
- Giriş denemeleri: 15 dakikada 10 başarısız deneme sonrası geçici kilit (IP ve kullanıcı adına göre).
- Yüklenen dosyanın **uzantısı ve içeriği** (dosya imzası) birbirini tutmak zorunda; izin verilen türler: PDF, DOC/DOCX, JPG, PNG; en fazla 5 MB.
- Dosyalar yalnızca yetkili kişiye, her zaman `attachment` olarak sunulur (tarayıcıda çalıştırılmaz).
- Tablolarda RLS açık ve politika yok: anahtar (anon) ile doğrudan veritabanına erişim yoktur.
- Güvenlik başlıkları: CSP (satır içi script/stil yok), `X-Frame-Options: DENY`, `nosniff`.
- Mesajlar yalnızca katılımcılara görünür; sınıf grubu sohbeti yalnızca o sınıfın öğrenci ve öğretmenlerine açıktır.

## Bilinen sınırlar

- Veri kalıcılığı Supabase'dedir; düzenli yedek için Supabase'in yedekleme özelliğini etkinleştir.
- Tek sunucu örneği varsayılır (oturum ve hız sınırı belleğe göre). Birden fazla örnek gerekirse Redis gerekir.
- Sınıf veya ders silinince ilgili ödev dosyaları da silinir; bu geri alınamaz (arayüzde onay istenir).
- Devamsızlık uyarıları veritabanında toplanır ve 60 saniye önbelleğe alınır. Her yazma işlemi önbelleği geçersiz kılar. Önbellek bellekte tutulduğu için tek sunucu örneği varsayılır.
- Bildirimler 20 saniyede bir yenilenir; gerçek zamanlı (push) değildir.

## Kararlılık ve yedekleme (v19)

- **Giriş:** Parola kontrolü artık olay döngüsünü bloke etmeyen asenkron işlemle yapılıyor. Aynı anda çok giriş olsa da diğer istekler bekletilmez.
- **Hız sınırları:** Giriş yapmış kullanıcılar kendi oturumlarıyla sayılır; aynı okul ağındaki öğrenciler birbirini engellemez. IP üst sınırı (`IP_RATE_PER_MIN`) ayrıca korur. Sayfa dosyaları (parmak izli JS/CSS) sınırdan muaftır.
- **Canlı yarışma:** Durum yanıtı 1 saniye önbelleğe alınır, telefon yoklama aralığı 2 saniyedir.
- **Veritabanı havuzu:** `PG_POOL_SIZE` varsayılanı 10.
- **Yedekleme:** Her gün otomatik yedek alınır (son 30 yedek saklanır). Müdür "Yedekler" bölümünden elle yedek alabilir ve indirebilir. `BACKUP_KEY` ortam değişkeni tanımlanırsa yedekler AES-256-GCM ile şifrelenir. **Bu anahtarı kaybederseniz yedekler açılamaz; güvenli bir yerde saklayın.**
- **Hata bildirimi:** `ERROR_WEBHOOK_URL` (https) tanımlanırsa beklenmeyen hatalar webhook'a iletilir.
- **Uyanık tutma:** `.github/workflows/keepalive.yml` her 10 dakikada sağlık ucunu çağırır. Adres için GitHub deposunda `SITE_URL` değişkeni tanımlayabilirsiniz.
- **Testler:** `.github/workflows/ci.yml` her gönderimde testleri PostgreSQL ile çalıştırır.
- **Yük testi:** `scripts/loadtest.mjs` (eşzamanlı istemci ve p95 gecikme ölçümü).

## Güvenlik ve veri hakları (v20)

- **Müdür iki adımlı doğrulama (TOTP):** Müdür hesabı Hesabım → "İki adımlı doğrulama" ile açılır. Gizli anahtar veritabanında şifreli saklanır. Açıkken girişte uygulamadaki 6 haneli kod istenir. Kapatmak için parola ve kod gerekir.
- **Şifremi unuttum:** E-posta adresi kayıtlı hesaplara 15 dakika geçerli 6 haneli kod gönderilir. Kod saklanırken özetlenir, 5 hatalı denemeden sonra geçersiz olur. Başarılı sıfırlamada tüm eski oturumlar düşer. Yanıt, adres kayıtlı olsun ya da olmasın aynıdır (hesap keşfini önler).
- **KVKK aydınlatma metni:** Giriş sonrası metin gösterilir ve onaylanması istenir. **Metin bir taslaktır; yayına almadan önce okulun hukuk danışmanı onaylamalıdır.**
- **Erişim hakkı:** Hesabım → "Verilerimi indir" kişinin verilerini JSON olarak verir.
- **Silme hakkı:** Öğrenci ve öğretmen silme talebi açar. Müdür "Kişiler → Silme talepleri" bölümünde onaylarsa hesap anonimleştirilir (ad, kullanıcı adı, e-posta ve parola silinir, giriş yapılamaz). Akademik kayıtlar kişi tanımlanamaz hâlde kalır. Müdür kendi talebini değerlendiremez.
- **Takvim bağlantısı:** Hesabım → "Takvim bağlantısı" kişiye özel bir ICS adresi verir. Google, Apple ve Outlook takvimine abone olunabilir.
- **Bildirimler:** Yeni ödev, yeni mesaj ve veli için devamsızlık bildirimleri eklendi.
- **Müdür analizi (API):** `GET /api/analytics/school` sınıf bazında devam oranı, sınav ortalaması ve en çok devamsızlığı olan öğrencileri verir. Sayfası henüz yok.

**E-posta için ortam değişkenleri (Render):** `SMTP_HOST`, `SMTP_PORT` (genellikle 587), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Ücretsiz plan sunan bir SMTP sağlayıcısı kullanılabilir. Bu değişkenler tanımlı değilse "Şifremi unuttum" kapalı görünür ve müdüre başvurulması istenir.

**Bağımlılık güvenliği:** `npm audit` 0 açık gösteriyor (esbuild ve nodemailer güncellendi).

**Hâlâ eksik:** Müdür analiz sayfası, sınavda açık uçlu soru ve soru bankası, yoklamada mazeretli kayıt, karne için sunucu tarafı PDF, veli haftalık özeti, ödev dosyaları için sürüm geçmişi ve virüs taraması, şema için düzgün bir migrasyon sistemi, gerçek ortamda yük testi.

## Analiz, mazeretli yoklama, veli haftalık özeti (v21)

- **Müdür analizi:** Menüde "Analiz". Son 30 günün okul geneli devam oranı, sınıflara göre devam ve sınav ortalaması, en çok devamsızlığı olan 10 öğrenci.
- **Mazeretli yoklama:** Yoklama ekranında "Gelmedi" yanında "Mazeretli" seçeneği. Mazeretli ders **devam sayılır** (devam oranını düşürmez) ve devamsızlık listelerinde görünmez. Veli bildirimi gitmez.
- **Veli haftalık özeti:** Her Pazar 17:00'den sonra (İstanbul saatiyle) velilere bir push bildirimi gider: son 7 günün devamı, davranış puanı toplamı ve önümüzdeki 7 gündeki ödevler (teslim edilmemiş olanlar dahil). Müdür `POST /api/digest/run` ile elle de gönderebilir.

## Kullanıcı e-postaları ve SMTP kontrolü (v22)

- **Kullanıcı formunda e-posta:** Müdür yeni hesap oluştururken ya da mevcut bir hesabı düzenlerken e-posta girebilir. Adres küçük harfe çevrilir, biçimi denetlenir ve iki hesapta aynı olamaz. Öğretmen ve diğer kullanıcılar e-postaları göremez.
- **Kişiler sayfası:** Müdür e-posta adresi olmayan kişileri "E-posta yok" etiketiyle görür.
- **E-posta kapalıyken uyarı:** SMTP değişkenleri tanımlı değilse müdürün Kişiler sayfasında "E-posta gönderimi kapalı" uyarısı çıkar.
- **Test e-postası:** Müdür Kişiler sayfasındaki "Test e-postası" düğmesiyle SMTP'yi kendi adresine test gönderimi yapabilir. Önce kendi hesabına bir e-posta adresi eklemesi gerekir.

## Karne PDF ve ödev hatırlatması (v23)

- **Karne PDF:** Karne sayfasındaki "PDF indir" düğmesi ya da `GET /api/reports/student/:id/pdf` ile Türkçe karakterli A4 karne indirilir. İçerik: derslere göre not ortalaması, devam, davranış özeti, veliyle paylaşılan öğretmen notları. Yetki kuralları karne sayfasıyla aynıdır (öğretmen, müdür, bağlı veli, öğrencinin kendisi).
- **Ödev hatırlatması:** Her gün 18:00'den sonra (İstanbul saatiyle) 24 saat içinde son teslimi olan ve henüz teslim etmemiş öğrencilere bildirim gider. Müdür `POST /api/reminders/run` ile elle tetikleyebilir.
- **Yeni bağımlılıklar:** `pdfkit` ve `dejavu-fonts-ttf` (Render'ın `npm install` adımı otomatik kurar).

## Migrasyonlar ve seçenek karıştırma (v24)

- **Sürümlü migrasyonlar:** Şema değişiklikleri artık `src/migrations/NNNN_aciklama.sql` dosyalarıdır. Her dosya yalnızca bir kez, sıra numarasına göre uygulanır ve `schema_migrations` tablosuna kaydedilir. Temel şema (`src/schema.sql`) ilk kez çalışırken `0000_baseline` olarak kaydedilir. Yeni bir değişiklik için bir sonraki numarayla yeni dosya ekleyin, eski dosyaları değiştirmeyin.
- **Seçenek karıştırma:** Sınav oluştururken "Seçenekleri karıştır" açılabilir. Her öğrencinin denemesinde şıklar farklı sırada gösterilir. Cevaplar özgün şık sırasına çevrilerek puanlanır, bu yüzden puanlama değişmez. Teslimden sonra şıklar özgün sırasıyla görünür. Canlı yarışmada şık karıştırma uygulanmaz.

## Pansiyon: evci ve çarşı izni defteri (v25)

- **Pansiyon modu:** Müdür "İzin defteri" sayfasındaki düğmeyle açar/kapatır. Kapalıyken izin özellikleri devre dışıdır.
- **Talep:** Öğrenci kendisi, veli bağlı çocuğu adına evci veya çarşı izni talep eder (çıkış-dönüş, en fazla 14 gün). Talep sahibi bekleyen talebini iptal edebilir.
- **Onay:** Müdür ya da öğrencinin sınıfını okutan öğretmen onaylar veya reddeder. Öğrenci ve veliye bildirim gider.
- **Çıkış ve dönüş e-imzası:** Nöbetçi personel onaylı izni açar. Çıkacak kişi (öğrenci, veli ya da diğer) ad, soyad ve öğrenci numarasını yazar, ekrandaki alana e-imzasını atar. Öğrenci imzalıyorsa öğrenci numarası kayıtla eşleşmek zorundadır. Dönüşte aynı işlem tekrarlanır.
- **Defter:** Kayıtlar durumlarıyla listelenir; müdür ve öğretmen e-imzaları görebilir. "CSV indir" düğmesi Excel uyumlu bir döküm verir.
- **Veri gizliliği:** İmzalar ve öğrenci numaraları yalnızca müdür ve ilgili öğretmene açıktır. Pansiyon kayıtları KVKK aydınlatma metninde yer alır, metnin hukuk danışmanınızca onaylanması gerekir.

## Pansiyon gece yoklaması (v26)

- **Kim yapar:** Müdür ve sınıfını okutan öğretmen. İzin defterinin üst kısmındaki "Gece yoklaması" düğmesinden açılır.
- **Ne kaydedilir:** Her öğrenci için gece kaydı: Yatıyor, Yok veya İzinli. Tarih seçilebilir, gelecek bir gün için kayıt alınamaz.
- **Otomatik öneri:** Gece penceresinde (21:00 – ertesi gün 07:00) onaylı ya da dışarıdaki bir izni olan öğrenci "İzinli" olarak önerilir. Öğretmen onaylayıp kaydeder.
- **Bildirim:** "Yok" işaretlenen öğrencinin velisine ve öğrencinin kendisine bildirim gider.
- **Not:** Yatılı öğrenci ayrımı şu an sınıf bazlıdır; sınıftaki herkes gece yoklamasına dahil edilir.

## Açık uçlu sınav soruları (v27)

- **Soru türü:** Sınav formunda her soru için "Çoktan seçmeli" ya da "Açık uçlu (elle puanlanır)" seçilir. Açık uçlu soruda şık yazılmaz.
- **Öğrenci:** Açık uçlu soruya en fazla 2000 karakterlik metin yazar. Cevap sınav süresi boyunca otomatik kaydedilir.
- **Puanlama:** Çoktan seçmeli sorular teslimde hesaplanır. Açık uçlu puanlar öğretmen puanladıkça eklenir. Puan açık uçlu sorular puanlanana kadar sınav "Değerlendiriliyor" durumunda kalır ve öğrenci puanını görmez.
- **Öğretmen:** Sınav sonuçları sayfasındaki "Açık uçlu soruları puanla" düğmesi tüm öğrencilerin cevaplarını tek ekranda gösterir. Her soru için 0 ile soru puanı arasında puan girilir.
- **Kısıtlar:** Açık uçlu soru içeren sınav canlı yarışmada kullanılamaz (canlı yarışma otomatik puanlama ile çalışır). Açık uçlu cevaplarda otomatik yazım denetimi yoktur.

## Telefon menüsü ve alt panel (v28)

- Menü açıkken alt gezinme çubuğu ve bildirim kutusu gizlenir, böylece alt paneldeki "Hesabım" ve "Çıkış" düğmeleri her zaman dokunulabilir.
- Alt panel menünün en altına sabitlenir (yapışkan). Menü uzunsa kendi içinde kaydırılır.
- Düğmeler telefonda en az 50 piksel yüksekliğinde.

## GeoGebra paneli (v29)

- **Menü:** Tüm kullanıcılarda "GeoGebra". Grafik, hesap makinesi, geometri, 3B, klasik ve CAS uygulamaları sekmelerden açılır.
- **Sınıf materyalleri:** Öğretmen (ve müdür) sınıfına GeoGebra bağlantısı ekler; öğrenci ve veli kendi sınıfının materyallerini açar. Materyali GeoGebra'da oluşturup paylaşım bağlantısını yapıştırın.
- **Güvenlik:** Yalnızca `https` ve `geogebra.org` (ve alt alan adları) bağlantıları kabul edilir. Sayfa çerçevesi yalnızca GeoGebra alan adına izin verilir (CSP `frame-src`).
- **Not:** Uygulamaların çerçeve içinde açılması GeoGebra'nın kendi ayarlarına bağlıdır. Açılmazsa "Yeni sekmede" bağlantısı kullanılabilir.

## GeoGebra sayfa içinde (v30)

- GeoGebra uygulaması artık sayfanın içinde açılır (resmi `deployggb.js` betiği ile). Sekmeler: Grafik, Hesap makinesi, Geometri, 3B, Klasik, CAS.
- Uygulamanın üstünde "GeoGebra · <uygulama adı>" etiketi görünür.
- Sınıf materyali "Sayfada aç" ile yüklenir (GeoGebra paylaşım kimliği üzerinden).
- Uygulama yüklenemezse (ağ, reklam engelleyici, GeoGebra'nın erişilemezliği) bir yedek bağlantı gösterilir.
- Gereksinim: `https://www.geogebra.org` erişilebilir olmalı. GeoGebra uygulamaları GeoGebra'nın sunucularından yüklenir; kendi sunucunuza kopyalanamaz.

## Render derleme düzeltmesi (v31)

- `esbuild` derleme aracı üretim bağımlılıklarına taşındı. Render `NODE_ENV=production` ile kurduğunda geliştirme bağımlılıkları atlanır; bu yüzden derleme `esbuild` bulamıyordu.
- Derleme komutu: `npm install && npm run build` (değişmedi).

## Kendi grafik aracımız (v32)

- GeoGebra'nın yerleştirilmiş kopyası yerine sistemin kendi grafik aracı. Harici betik, iframe ya da üçüncü taraf kaynak kullanmaz; CSP yalnızca `'self'`.
- Fonksiyon (`f(x)=x^2-4`, `y=2x+1`, `sin(x)`), nokta (`A=(2, 0)`), örtük çarpma (`2x`, `3(x+1)`), `^` ve `**` üssü, `pi`, `e`, `sqrt`, `abs`, `ln`, `log`, `exp`, `floor`, `ceil`.
- Kaydırma (sürükle), tekerlekle yakınlaştırma, +/− düğmeleri, görünümü sıfırlama, uyarlanabilir ızgara ve eksen etiketleri.
- Hatalı ifadeler satır altında açıklanır; ifade değerlendirmesi `eval` kullanmadan yapılır.
- Öğretmen/müdür çalışmayı "Sınıfa kaydet" ile kaydeder; öğrenci ve veli "Çalışmayı aç" ile satırları yükler. Yalnızca harf, rakam ve matematik işaretleri kabul edilir (en fazla 60 satır).
- Birim testleri: `npm run test:graph`. Tüm testler: `npm test`.

## GeoGebra benzeri çizim (v33)

- Fare araçları: **Taşı** (noktayı sürükle, boş alanı kaydır), **Nokta** (tıkla), **Doğru**, **Işın**, **Parça** (iki nokta seç; boş yere tıklarsan yeni nokta oluşur), **Sil** (nesneye tıkla). Yakınlaştırma: tekerlek ve +/− düğmeleri.
- Her nesne cebir paneline satır olarak yazılır: `A=(1,2)`, `d=Doğru(A,B)`, `s=Parça(A,B)`, `b=Işın(B,C)`, `f(x)=x^2-4`. Bir noktayı sürüklediğinde satırı güncellenir ve ona bağlı doğru/ışın/parça yeniden hesaplanır.
- Nesnelerin üzerinde adları yazılır (noktalar A, B, C…; doğru/ışın/parça a, b, c…; fonksiyon eğrisinde f(x)=…).
- Komutlar Türkçe ve İngilizce: `Doğru` / `line`, `Işın` / `ray`, `Parça` / `segment`.

## Grafik: denklem etiketleri, çember, açı, dokunmatik (v34)

- Doğru, ışın ve parçanın yanında denklem yazılır: `a: y = 2x + 1`, dikey doğru için `x = 3`.
- **Çember** aracı: merkez, sonra çevredeki bir nokta (`b=Çember(C,D)`), etiketi yarıçap.
- **Açı** aracı: kenar, köşe, diğer kenar (`Açı(B,A,D)`), derece cinsinden etiket.
- Dokunmatik ekranda nokta, doğru ve çember koyma ve parmakla nokta taşıma test edildi (telefon boyutu, gerçek dokunuş olayları).
- Açı aracı birim testlerinde doğrulandı; tarayıcıda dokunmatik olarak henüz denenmedi.

## Güvenlik ve test düzeni (v35)

- İki adımlı doğrulamada aynı 30 saniyelik kod iki kez kullanılamaz (`users.totp_last_step`, migrasyon 0007).
- Tarayıcı testleri `test/e2e/` klasöründe; `npm test` yalnızca API ve birim testlerini çalıştırır.

## Padlet benzeri pano (v38)

- **Düzenler:** Izgara, duvar (kartları sürükleyerek yerleştirme, konum kaydedilir) ve akış (tek sütun). Pano formundan seçilir.
- **Arka plan:** Kağıt, nane, gök, leylak, sarı, koyu.
- **Beğeni:** Her kullanıcı bir kez beğenir; tekrar basınca geri alınır.
- **Yorumlar:** Kartın yorum penceresinde yazılır; yorumu yazan kişi ya da pano yöneticisi siler.
- Konumu yalnızca notu yazan kişi ya da pano yöneticisi değiştirebilir.
- Migrasyon: `0008_padlet.sql`. Tarayıcı testi: `test/e2e/pano_duvar.py`.

## Düzeltme ve arayüz (v40)

- **Veli bağlantısı:** Müdür kişiler listesinde velilerin bağlı olduğu öğrenciler artık görünüyor (`childIds` kullanıcı listesinde sunuluyordu). Öğretmenler ve öğrenciler bu bilgiyi görmez. Testi: `test/api.test.js`.
- **Arayüz:** Nokta ızgaralı ve üç ışımalı arka plan (açık ve koyu tema), cam efektli üst çubuk, liste satırı vurgusu, ince kaydırma çubukları, düğme basma geri bildirimi, hareket azaltma desteği.

## GeoGebra: orta nokta ve kesişim (v41)

- `M=Orta(A,B)`: iki noktanın orta noktası; A veya B taşınınca M de güncellenir.
- `K=Kesişim(a,b)`: iki doğrunun (doğru, ışın ya da parça) kesişim noktası. Paralel doğrular için hata verir.
- Araç çubuğunda **Orta** aracı: iki nokta seçince orta nokta oluşur.

## Yorum moderasyonu (v42)

- Moderasyonlu panoda öğrenci yorumları pano yöneticisi onaylayana kadar yalnızca yazara ve yöneticiye görünür.
- Onay bekleyen yorumlar sayaçta sayılmaz.
- Migrasyon: `0009_comment_moderation.sql`.

## Matematik Laboratuvarı ve pano medyası (v43)

- Menüdeki ve sayfa başlığındaki "GeoGebra" adı "Laboratuvar / Matematik Laboratuvarı" olarak değiştirildi.
- Grafik: **Dik** ve **Paralel** araçları (önce doğru, sonra nokta); komutlar `Dik(P,a)` ve `Paralel(P,a)`.
- Pano: PDF dosyaları kartın içinde önizlenir; bağlantılar video/platform rozetiyle gösterilir; **Büyüt** ile kart tam pencerede açılır.
- PDF önizlemesi yalnızca aynı site çerçevesinde açılır (dosya yanıtında X-Frame-Options SAMEORIGIN).

## Grafik: ölçüm, eksenler, PNG (v44)

- `u=Uzaklık(A,B)`: iki nokta arasındaki uzaklık çizgi üzerinde etiketlenir. Araç çubuğunda **Uzaklık** aracı da var.
- **Eksenler** düğmesi sıfır çizgilerini gösterip gizler.
- **PNG indir** düğmesi mevcut grafiği `matematik-laboratuvari.png` olarak indirir.

## Sürüm 47

- **Kurulum kartı:** Yuvarlatılmış, logolu kart; Android'de Yükle, iPhone'da ekleme yönergesi.
- **Pano sabitleme:** Yönetici notu üste sabitleyebilir (`0010_pinned_notes.sql`).
- **Grafik koordinatları:** "Koordinat" düğmesiyle noktaların koordinatları etiketlerde gösterilir.

## Sürüm 48

- **Gizlilik politikası:** `/gizlilik` sayfası eklendi. Hukuki onaydan geçene kadar taslaktır; saklama süreleri ve iletişim bilgileri yer tutucu olarak bırakıldı.
- **Pano kartı metni:** Kalın, italik, madde ve bağlantı biçimleri desteklenir (güvenli Markdown dönüştürücüsü; HTML kabul edilmez).

## Sürüm 49

- **Pano sıralaması:** Yönetici, akış ve ızgara düzenlerinde notları ▲▼ düğmeleriyle sıralayabilir (`0011_note_order.sql`). Sıra tüm panoda kaydedilir.
- Sürükle-bırak henüz yok; dokunmatik ekranlarda ▲▼ düğmeleri kullanılır.

## Sürüm 50: Deney laboratuvarı

- Menüde **Deneyler** sayfası: fizik (eğik atış: hız, açı, Dünya/Ay/Mars) ve kimya (güçlü asit-baz titrasyonu: derişim, hacim, pH eğrisi).
- Hesaplar `public/labs.js` içinde, birim testleri `test/labs.test.mjs`.
- Tarayıcıda bilinen değerlerle doğrulandı (örn. 20 m/s, 45°, Dünya: menzil 40,77 m; 0,1 M HCl + 0,1 M NaOH eşdeğerliğinde pH 7).

## Sürüm 51: Yapay zekâ sınav taslağı ve sade tasarım

- **Sınav formunda "Yapay zekâ ile soru taslağı":** Konu yazılır, isteğe bağlı örnek soru eklenir, soru sayısı (3, 5, 8, 10) seçilir. Sorular taslak olarak eklenir; öğretmen kontrol edip kaydeder.
- **Görselli sorular (isteğe bağlı):** Model basit bir SVG şekil üretebilir. Görsel güvenlik kontrolünden geçer (betik, bağlantı, dış kaynak yok), tarayıcıda PNG'ye çevrilip soruya eklenir.
- **Sınırlar:** Yalnızca öğretmen ve yönetici kullanır; asistan kullanım bildirimi onaylanmış olmalıdır. Günlük soru hakkı ve genel günlük sınır asistanla ortaktır.
- **Tasarım:** Gradyan, cam efekti ve ağır gölgeler kaldırıldı; tek vurgu rengi ve düz yüzeyler.
- Testler: `test/quizdraft.test.mjs` (taslak doğrulama ve SVG temizliği), API testleri (yetki ve kontrollü hatalar).

## Sürüm 52: düz tasarım

- Nokta ızgara arka plan, gradyanlar, cam efekti, parlama ve animasyonlar kaldırıldı.
- Tek renk yüzeyler, 1 piksel kenarlıklar, 8–10 piksel köşeler, sade düğmeler. Koyu tema aynı mantıkla.
- Eski kurallar dosyada duruyor; v52 katmanı en sonda olduğu için onları geçersiz kılıyor.

## Sürüm 53: laboratuvarlar ve kimya oyunu

- Menüde üç ayrı laboratuvar: **Matematik Laboratuvarı**, **Fizik Laboratuvarı**, **Kimya Laboratuvarı**.
- Kimya: periyodik tablodan element seçilir, çalışma alanında sürüklenir; yakın iki parça uygun bileşimdeyse birleşir ve formülü ile adı gösterilir. Keşfedilenler listesi tutulur. Parça çöp alanına bırakılarak silinir.
- Birleşme kuralları `public/chem.js` içinde (36 element, 25 bileşik). Kapsam sınırlıdır; tepkime denkleştirme ve enerji yoktur.
- Padlet kartlarında uzun kelime ve gömülü içerik kartın dışına taşmaz.

## Sürüm 54: kimya — tüm elementler ve daha çok birleşim

- Periyodik tabloda **118 element** (lantanit ve aktinit satırları dahil).
- **90 bileşik** tablosu: gazlar, asitler, oksitler, tuzlar, bazlar, basit organik bileşikler.
- Birleşme tam bileşime göre çalışır; iki ya da üç katı bileşikler de tanınır (örn. 2H₂O).
- Testler: `test/chem.test.mjs` (element sayısı, satır/sütun konumları, tepkimeler, tekrar kontrolü).

## Sürüm 55: kimyada çok parçalı birleşme

- Birbirine yakın birden fazla parça bırakıldığında, aralarından bileşiği oluşturabilen en büyük alt küme birleşir (sülfürik asit, glikoz gibi).
- **Atomları ekle:** Formül yazılır (`C6H12O6`, `Ca(OH)2`), gerekli atomlar çalışma alanına konur.
- **Hepsini birleştir:** Alandaki tüm parçalar için tepkime aranır ve bulunanlar tek tek uygulanır.
- 102 bileşik (glikoz, sakkaroz, asetik asit, sitrik asit, C vitamini, üre, amonyum klorür, gliserin, benzen ve diğerleri eklendi).
- Testler: formül ayrıştırma, 24 atomdan glikoz, sülfürik asit, su.
