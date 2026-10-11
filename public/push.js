// Bildirim izni ve Web Push aboneliği (tarayıcı tarafı).
import { api, toast, icon } from './core.js';

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const DISMISS_KEY = 'okulum-notify-dismissed';

function base64ToBytes(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function swRegistration() {
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg;
}

// Kullanıcı bir düğmeye bastığında çağrılmalı (tarayıcılar izni yalnızca etkileşimde ister).
export async function enablePush() {
  if (!supported()) throw new Error('Bu tarayıcı bildirimleri desteklemiyor.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Bildirim izni verilmedi. Tarayıcı ayarlarından izin verebilirsiniz.');
  const { publicKey } = await api('/push/key');
  if (!publicKey) throw new Error('Bildirim sunucusu henüz hazır değil.');
  const reg = await swRegistration();
  const sub = (await reg.pushManager.getSubscription())
    || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey) }));
  await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
  localStorage.removeItem(DISMISS_KEY);
  return true;
}

export async function disablePush() {
  if (!supported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}

export async function isSubscribed() {
  if (!supported() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  return Boolean(await reg?.pushManager.getSubscription());
}

// Açılışta: izin zaten verilmişse aboneliği yenile; verilmemişse nazikçe izin iste (banner).
export async function initNotifications() {
  if (!supported()) return;
  if (Notification.permission === 'granted') {
    swRegistration().then(async reg => {
      const sub = await reg.pushManager.getSubscription();
      if (sub) await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } }).catch(() => {});
    }).catch(() => {});
    return;
  }
  if (Notification.permission !== 'default' || localStorage.getItem(DISMISS_KEY) || document.querySelector('#notifyBanner')) return;
  const banner = document.createElement('aside');
  banner.id = 'notifyBanner';
  banner.className = 'notify-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Bildirim izni');
  banner.innerHTML = `<span class="nb-icon">${icon('bell')}</span>
    <div class="nb-copy"><strong>Bildirimleri açın</strong><small>Canlı yarışma başladığında, yeni sınav yayınlandığında ve puanınız verildiğinde haberdar olun.</small></div>
    <div class="nb-actions"><button class="btn ghost sm" type="button" data-nb="later">Şimdi değil</button><button class="btn primary sm" type="button" data-nb="allow">İzin ver</button></div>`;
  document.body.appendChild(banner);
  banner.addEventListener('click', async event => {
    const action = event.target.closest('[data-nb]')?.dataset.nb;
    if (!action) return;
    if (action === 'later') {
      localStorage.setItem(DISMISS_KEY, '1');
      banner.remove();
      return;
    }
    try {
      await enablePush();
      toast('Bildirimler açıldı');
    } catch (error) {
      toast(error.message, 'error');
    }
    banner.remove();
  });
}
