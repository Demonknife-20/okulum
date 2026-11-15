// 6 haneli doğrulama kodu bileşeni (Gmail tarzı) — şifre sıfırlama akışının
// "kod gir" adımını modal içinde kullanır. Backend: /api/password/forgot + /api/password/reset.
import { $, api, icon, esc } from './core.js';

// Modal gövdesine yerleştirilecek kutucukların HTML'i.
export function otpFieldsHtml() {
  return `
    <div class="otp-inputs" data-otp role="group" aria-label="6 haneli doğrulama kodu">
      ${[0, 1, 2, 3, 4, 5].map(i => `<input type="text" inputmode="numeric" maxlength="1" autocomplete="off" aria-label="${i + 1}. hane">`).join('')}
    </div>`;
}

// Kutucukları canlı hale getirir; tümü dolduğunda onReady() çağrılır.
export function initOtp(root, { onReady } = {}) {
  const inputs = [...root.querySelectorAll('[data-otp] input')];
  if (!inputs.length) return { code: () => '', clear: () => {} };

  const code = () => inputs.map(i => i.value).join('');
  const refresh = () => onReady?.(code().length === 6);

  inputs.forEach((input, idx) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '').slice(-1);
      if (input.value && idx < inputs.length - 1) inputs[idx + 1].focus();
      refresh();
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !input.value && idx > 0) inputs[idx - 1].focus();
    });
    input.addEventListener('paste', e => {
      e.preventDefault();
      const digits = (e.clipboardData?.getData('text') || '').replace(/[^0-9]/g, '');
      inputs.forEach((box, i) => { box.value = digits[i] || ''; });
      inputs[Math.min(digits.length, inputs.length - 1)].focus();
      refresh();
    });
    input.addEventListener('focus', () => input.select());
  });

  return {
    code,
    clear: () => { inputs.forEach(i => { i.value = ''; }); inputs[0].focus(); refresh(); },
    focus: () => inputs[0].focus(),
  };
}

// Sıfırlama modalının kod adımını döndürür: kutucuklar + yeniden gönder + yeni şifre alanı.
export function resetStepHtml(email) {
  return `
    <p class="muted small">Kodu <strong>${esc(email)}</strong> adresine gönderdik. Kutulara girin:</p>
    ${otpFieldsHtml()}
    <label class="field"><span>Yeni şifre</span><input name="password" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></label>
    <p class="muted small">En az 8 karakter; harf ve rakam içermeli.</p>
    <div class="otp-actions">
      <button class="btn ghost sm" type="button" data-otp-resend disabled>Yeniden gönder (<span data-otp-timer>60</span>s)</button>
    </div>`;
}

// Yeniden gönderme sayacını başlatır; 60 saniye sonra butonu açar.
export function startResendTimer(root, { onResend } = {}) {
  const btn = root.querySelector('[data-otp-resend]');
  const timer = root.querySelector('[data-otp-timer]');
  if (!btn || !timer) return { stop() {} };
  let left = 60;
  btn.disabled = true;
  let interval = null;
  const tick = () => {
    timer.textContent = String(left);
    if (left <= 0) {
      clearInterval(interval);
      btn.disabled = false;
    }
  };
  interval = setInterval(() => { left -= 1; tick(); }, 1000);
  tick();
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await api('/password/forgot', { method: 'POST', body: { email: root.dataset.email || '' } });
      left = 60;
      tick();
      onResend?.();
    } catch (error) {
      btn.disabled = false;
      throw error;
    }
  });
  return { stop: () => clearInterval(interval) };
}
