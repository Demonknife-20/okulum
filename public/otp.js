// 6 haneli kod doğrulama ekranı (Gmail tarzı)
import { $, $$, api, icon, esc, toast } from './core.js';

export function showOtpScreen(email, onVerified) {
  const container = document.getElementById('otp-screen') || document.createElement('div');
  container.id = 'otp-screen';
  container.hidden = false;
  container.innerHTML = `
    <div class="otp-container">
      <div class="otp-icon">${icon('mail')}</div>
      <h2 class="otp-title">Doğrulama Kodu</h2>
      <p class="otp-desc">Kodu <strong>${esc(email)}</strong> adresine gönderdik. 6 haneli kodu girin:</p>
      <div class="otp-inputs" data-otp-length="6"></div>
      <div class="otp-actions">
        <button class="btn btn-secondary otp-resend" type="button" disabled>Yeniden gönder (<span class="otp-timer">60</span>s)</button>
        <button class="btn btn-primary otp-verify" type="button" disabled>Doğrula</button>
      </div>
      <a href="#/login" class="otp-back">← Geri</a>
    </div>
  `;
  document.body.appendChild(container);

  const inputsDiv = container.querySelector('.otp-inputs');
  const inputs = [];
  for (let i = 0; i < 6; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.maxLength = 1;
    input.pattern = '[0-9]';
    input.setAttribute('aria-label', `${i + 1}. hane`);
    input.dataset.index = i;
    inputsDiv.appendChild(input);
    inputs.push(input);
  }

  const verifyBtn = container.querySelector('.otp-verify');
  const resendBtn = container.querySelector('.otp-resend');
  const timerSpan = container.querySelector('.otp-timer');
  let timer = 60;
  let timerInterval = null;

  // Timer
  const startTimer = () => {
    timer = 60;
    resendBtn.disabled = true;
    timerSpan.textContent = timer;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timer--;
      timerSpan.textContent = timer;
      if (timer <= 0) {
        clearInterval(timerInterval);
        resendBtn.disabled = false;
      }
    }, 1000);
  };
  startTimer();

  // Input events
  inputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      // Only allow digits
      e.target.value = val.replace(/[^0-9]/g, '');
      if (e.target.value && idx < 5) {
        inputs[idx + 1].focus();
      }
      checkComplete();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        inputs[idx - 1].focus();
      }
    });

    // Paste support
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
      for (let i = 0; i < Math.min(paste.length, 6); i++) {
        inputs[i].value = paste[i];
      }
      if (paste.length >= 6) inputs[5].focus();
      checkComplete();
    });

    // Focus first input on select
    input.addEventListener('focus', () => {
      input.select();
    });
  });

  // Check if all inputs are filled
  const checkComplete = () => {
    const code = inputs.map(i => i.value).join('');
    verifyBtn.disabled = code.length !== 6;
  };

  // Verify
  verifyBtn.addEventListener('click', async () => {
    const code = inputs.map(i => i.value).join('');
    if (code.length !== 6) return;
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Doğrulanıyor...';
    try {
      const ok = await api('post', '/api/otp/verify', { email, code });
      if (ok) {
        toast('Kod doğrulandı!');
        container.remove();
        onVerified();
      } else {
        toast('Kod hatalı. Tekrar deneyin.');
        inputs.forEach(i => i.value = '');
        inputs[0].focus();
        verifyBtn.disabled = true;
      }
    } catch {
      toast('Doğrulama başarısız. Tekrar deneyin.');
      verifyBtn.disabled = true;
    }
    verifyBtn.textContent = 'Doğrula';
  });

  // Resend
  resendBtn.addEventListener('click', async () => {
    if (resendBtn.disabled) return;
    try {
      await api('post', '/api/otp/send', { email });
      toast('Kod yeniden gönderildi!');
      inputs.forEach(i => i.value = '');
      inputs[0].focus();
      verifyBtn.disabled = true;
      startTimer();
    } catch {
      toast('Kod gönderilemedi. Tekrar deneyin.');
    }
  });

  // Focus first input
  inputs[0].focus();

  return container;
}
