// Web Push anahtarlarını üretir. Çıktıdaki değerleri Render'da ortam değişkeni olarak tanımlayın:
// VAPID_PUBLIC_KEY ve VAPID_PRIVATE_KEY. Sonra veritabanındaki app_settings satırlarını silebilirsiniz.
import webpush from 'web-push';
const keys = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
