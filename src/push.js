// Web Push bildirimleri: VAPID anahtarları, abonelik gönderimi ve geçersiz abonelik temizliği.
// Anahtarlar VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY ortam değişkenlerinden okunur; yoksa bir kez üretilip
// veritabanındaki app_settings tablosunda saklanır, böylece ek ayar gerekmez.
const webpush = require('web-push');
const { q } = require('./db');

let publicKeyValue = null;

async function init() {
  let publicKey = process.env.VAPID_PUBLIC_KEY;
  let privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    const { rows } = await q("select key, value from app_settings where key in ('vapid_public', 'vapid_private')");
    const saved = Object.fromEntries(rows.map(r => [r.key, r.value]));
    if (saved.vapid_public && saved.vapid_private) {
      publicKey = saved.vapid_public;
      privateKey = saved.vapid_private;
    } else {
      const keys = webpush.generateVAPIDKeys();
      publicKey = keys.publicKey;
      privateKey = keys.privateKey;
      await q(`insert into app_settings (key, value) values ('vapid_public', $1), ('vapid_private', $2)
        on conflict (key) do update set value = excluded.value`, [publicKey, privateKey]);
    }
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:destek@okulum.local', publicKey, privateKey);
  publicKeyValue = publicKey;
  return publicKey;
}

const publicKey = () => publicKeyValue;

// Verilen kullanıcıların tüm cihazlarına bildirim gönderir. Hata olursa uygulama etkilenmez.
async function notify(userIds, payload) {
  if (!publicKeyValue || !userIds || !userIds.length) return;
  const { rows } = await q('select id, endpoint, p256dh, auth from push_subscriptions where user_id = any($1::uuid[])', [userIds]);
  await Promise.all(rows.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 3600 },
      );
    } catch (error) {
      // 404/410: tarayıcı aboneliği iptal etmiş; kaydı temizle
      if (error.statusCode === 404 || error.statusCode === 410) {
        await q('delete from push_subscriptions where id = $1', [sub.id]);
      } else {
        console.error('Bildirim gönderilemedi:', error.statusCode || error.code || error.name);
      }
    }
  }));
}

module.exports = { init, publicKey, notify };
