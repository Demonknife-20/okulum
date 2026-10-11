// Kullanım kılavuzu metni. Hem giriş yapmamış ziyaretçiler hem de uygulama içi kullanıcılar okur.

import { HELP_SECTIONS as SECTIONS } from './content.mjs';

const section = (s, index) => `
  <details class="help-section" ${index === 0 ? 'open' : ''}>
    <summary><h2>${s.title}</h2></summary>
    ${s.intro ? `<p class="help-intro">${s.intro}</p>` : ''}
    <dl class="help-list">
      ${s.items.map(([term, text]) => `<div class="help-item"><dt>${term}</dt><dd>${text}</dd></div>`).join('')}
    </dl>
  </details>`;

// Metin sabit içerik olduğu için HTML olarak basılır; dinamik veri içermez.
export function helpHtml() {
  return `<section class="help">
    <header class="help-head">
      <p class="eyebrow">Kullanım kılavuzu</p>
      <h1>Okulum nasıl kullanılır?</h1>
      <p class="subtitle">Rolünüze uygun bölümü açıp adım adım izleyin.</p>
    </header>
    ${SECTIONS.map(section).join('')}
  </section>`;
}
