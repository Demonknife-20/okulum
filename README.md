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
