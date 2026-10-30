const eyeMarkup = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path class="eye-outline" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/>
  <circle class="eye-pupil" cx="12" cy="12" r="3"/>
  <path class="eye-slash" d="m3 3 18 18"/>
</svg>`;

function decoratePassword(input) {
  if (input.dataset.passwordToggle || !input.parentNode) return;
  input.dataset.passwordToggle = 'true';
  const label = input.closest('label');
  const labelText = label?.querySelector(':scope > span')?.textContent?.trim();
  if (labelText && !input.hasAttribute('aria-label')) input.setAttribute('aria-label', labelText);
  const wrapper = document.createElement('span');
  wrapper.className = 'password-wrap';
  input.parentNode.insertBefore(wrapper, input);
  wrapper.append(input);

  const button = document.createElement('button');
  button.className = 'password-eye';
  button.type = 'button';
  button.setAttribute('aria-label', 'Şifreyi göster');
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = eyeMarkup;
  button.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.classList.toggle('is-visible', show);
    button.setAttribute('aria-pressed', String(show));
    button.setAttribute('aria-label', show ? 'Şifreyi gizle' : 'Şifreyi göster');
    input.focus({ preventScroll: true });
    const end = input.value.length;
    input.setSelectionRange(end, end);
  });
  wrapper.append(button);
}

function trackPupils(event) {
  if (event.pointerType === 'touch') return;
  document.querySelectorAll('.password-eye.is-visible').forEach(button => {
    const pupil = button.querySelector('.eye-pupil');
    const rect = button.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)));
    const y = Math.max(-1, Math.min(1, (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)));
    pupil.style.setProperty('--look-x', `${x * 2.4}px`);
    pupil.style.setProperty('--look-y', `${y * 2.4}px`);
  });
}

function resetPupils() {
  document.querySelectorAll('.eye-pupil').forEach(pupil => {
    pupil.style.setProperty('--look-x', '0px');
    pupil.style.setProperty('--look-y', '0px');
  });
}

export function setupPasswordToggles(root = document) {
  root.querySelectorAll('input[type="password"]').forEach(decoratePassword);
}

const observer = new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.matches('input[type="password"]')) decoratePassword(node);
      setupPasswordToggles(node);
    }
  }
});

setupPasswordToggles();
observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('pointermove', trackPupils, { passive: true });
document.addEventListener('pointerleave', resetPupils);

function animationsAllowed() {
  try {
    if (localStorage.getItem('okulum-fx') === 'off') return false;
  } catch {
    // Motion follows the system preference when local storage is unavailable.
  }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function playUnlockTransition() {
  const layer = document.createElement('div');
  layer.className = 'unlock-curtain';
  layer.setAttribute('role', 'status');
  layer.setAttribute('aria-live', 'assertive');
  layer.innerHTML = `<div class="unlock-scene">
    <span class="unlock-orbit unlock-orbit-one"></span>
    <span class="unlock-orbit unlock-orbit-two"></span>
    <span class="unlock-lock">
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <path class="unlock-shackle" d="M20 28v-8a12 12 0 0 1 24 0v9"/>
        <rect class="unlock-body" x="14" y="27" width="36" height="29" rx="8"/>
        <circle class="unlock-keyhole" cx="32" cy="39" r="3"/>
        <path class="unlock-keyhole" d="M32 42v5"/>
        <path class="unlock-spark" d="m52 13 2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z"/>
      </svg>
    </span>
    <strong>Giriş başarılı</strong>
    <span class="unlock-caption">Okulun hazır, hoş geldin.</span>
  </div>`;
  document.body.append(layer);
  if (animationsAllowed()) requestAnimationFrame(() => layer.classList.add('is-playing'));
  else layer.classList.add('is-playing', 'motionless');
  return new Promise(resolve => {
    window.setTimeout(() => {
      layer.remove();
      resolve();
    }, animationsAllowed() ? 980 : 350);
  });
}
