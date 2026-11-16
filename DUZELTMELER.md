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
