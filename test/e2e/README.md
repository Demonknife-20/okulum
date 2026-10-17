# Tarayıcı (uçtan uca) testleri

Bu betikler gerçek bir Chromium açıp Okulum'u çalıştırır. `npm test` içinde **değildir**; CI'da otomatik çalışmazlar.

Gereksinimler:
- Python 3 ve `playwright` (`pip install playwright`), Chromium yolu betiklerde `executable_path` ile verilir (kendi makinenize göre düzenleyin).
- Yerel PostgreSQL ve bir test veritabanı (`DATABASE_URL` betiklerin başındaki `env` sözlüğünde).
- Betikler açılışta bir sunucu başlatır (`node server.js`) ve sonunda kapatır.

Önemli: Betikler bir müdür hesabı (`murat`) ve kurulmuş bir okul bekler. Bu hesap yoksa önce uygulamanın kurulum ekranından oluşturun.

Çalıştırma: `python3 test/e2e/grafik_dokunmatik.py`

| Betik | Ne kontrol eder |
|---|---|
| analiz_yoklama.py | Müdür analiz sayfası, mazeretli yoklama düğmesi, yük testi |
| izin_defteri.py | Pansiyon izin defteri ve e-imza akışı |
| grafik_kaydet.py | Grafik aracı: çizim, hata uyarısı, çalışmayı kaydet ve yeniden yükle |
| grafik_fare.py | Fare ile nokta, doğru, ışın ve sürükleme |
| grafik_dokunmatik.py | Dokunmatik ekran: nokta, doğru, çember ve parmakla sürükleme |

Not: Bu betiklerin bazıları geçici yollar (`/tmp/...`) ve yerel Chromium yolu kullanır. Başka bir makinede çalıştırmadan önce bu yolları düzenleyin.
