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
