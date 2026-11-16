// Kimya laboratuvarı: maddeler, yoğunluk, karışım özellikleri ve tepkime kuralları.
// Saf JavaScript (tarayıcı bağımlılığı yok): test edilebilir.

// Sıvılar için ml; katılar için gram (hacim = gram / yoğunluk).
export const SUBSTANCES = {
  su: { name: 'Su', formula: 'H₂O', density: 1.0, kind: 'liquid', ml: 50, color: 0x4a90e2, fill: 0.5 },
  asit: { name: 'Hidroklorik asit', formula: 'HCl (2 M)', density: 1.08, kind: 'liquid', ml: 20, color: 0xe6fff2, fill: 0.4 },
  baz: { name: 'Sodyum hidroksit', formula: 'NaOH (1 M)', density: 1.04, kind: 'liquid', ml: 20, color: 0xf4f4ff, fill: 0.4 },
  fenolftalein: { name: 'Fenolftalein (indikatör)', formula: 'C₂₀H₁₄O₄', density: 1.0, kind: 'liquid', ml: 2, color: 0xfbf3ff, fill: 0.08 },
  toz: { name: 'Beyaz toz (şeker)', formula: 'C₁₂H₂₂O₁₁', density: 1.59, kind: 'solid', g: 10, color: 0xf2f2f2, fill: 0.22 },
  tuz: { name: 'Sofra tuzu', formula: 'NaCl', density: 2.16, kind: 'solid', g: 10, color: 0xf5fbff, fill: 0.22 },
  efervesan: { name: 'Efervesan tablet', formula: 'NaHCO₃ + asit', density: 1.5, kind: 'solid', g: 4, color: 0xffd966, fill: 0.18 },
  kagit: { name: 'Kağıt', formula: 'C₆H₁₀O₅', density: 0.8, kind: 'solid', g: 1, color: 0xfffdf5, fill: 0.16 },
  sodyum: { name: 'Sodyum (metal)', formula: 'Na', density: 0.97, kind: 'solid', g: 1, color: 0xdfe3e8, fill: 0.06 },
  magnezyum: { name: 'Magnezyum şerit', formula: 'Mg', density: 1.74, kind: 'solid', g: 1, color: 0xc9ccd1, fill: 0.06 },
  kibrit: { name: 'Kibrit', formula: '—', tool: true, color: 0xd32f2f },
  tripod: { name: 'Üç ayaklı + amyant teli', formula: '—', tool: true, color: 0x7a7a7a },
  termometre: { name: 'Termometre', formula: '—', tool: true, color: 0xe53935 },
};

// Periyodik tablo (ilk 36 element): sembol, ad, grup, periyot, kütle (g/mol)
export const ELEMENTS = [
  ['H', 'Hidrojen', 1, 1, 1.008], ['He', 'Helyum', 18, 1, 4.003],
  ['Li', 'Lityum', 1, 2, 6.94], ['Be', 'Berilyum', 2, 2, 9.012], ['B', 'Bor', 13, 2, 10.81], ['C', 'Karbon', 14, 2, 12.01], ['N', 'Azot', 15, 2, 14.01], ['O', 'Oksijen', 16, 2, 16.00], ['F', 'Flor', 17, 2, 19.00], ['Ne', 'Neon', 18, 2, 20.18],
  ['Na', 'Sodyum', 1, 3, 22.99], ['Mg', 'Magnezyum', 2, 3, 24.31], ['Al', 'Alüminyum', 13, 3, 26.98], ['Si', 'Silisyum', 14, 3, 28.09], ['P', 'Fosfor', 15, 3, 30.97], ['S', 'Kükürt', 16, 3, 32.07], ['Cl', 'Klor', 17, 3, 35.45], ['Ar', 'Argon', 18, 3, 39.95],
  ['K', 'Potasyum', 1, 4, 39.10], ['Ca', 'Kalsiyum', 2, 4, 40.08], ['Fe', 'Demir', 8, 4, 55.85], ['Cu', 'Bakır', 11, 4, 63.55], ['Zn', 'Çinko', 12, 4, 65.38], ['Br', 'Brom', 17, 4, 79.90], ['Kr', 'Kripton', 18, 4, 83.80],
];

// Elementler arasında laboratuvarda bulunan malzemeler (sahnede alınabilir)
export const ELEMENT_ITEMS = { Na: 'sodyum', Mg: 'magnezyum' };

// Karışımın hacim, kütle ve yoğunluğu (sıvı hacimleri toplanır, katının hacmi = kütle/yoğunluk)
export function mixtureProps(contents) {
  let volume = 0;
  let mass = 0;
  for (const key of contents) {
    const s = SUBSTANCES[key];
    if (!s || s.tool) continue;
    if (s.kind === 'liquid') {
      volume += s.ml;
      mass += s.ml * s.density;
    } else {
      const g = s.g;
      mass += g;
      volume += g / s.density;
    }
  }
  const round = (n, d = 1) => Number(n.toFixed(d));
  return {
    volumeMl: round(volume),
    massG: round(mass),
    densityGmL: volume > 0 ? round(mass / volume, 2) : 0,
  };
}

// Tepkimeler. "needs": tüpte bulunmalı; "minTemp": en düşük sıcaklık;
// "after": önce başka bir tepkime gerçekleşmiş olmalı; "requiresLast": son eklenen madde.
// "heat": karışmaya eklenen ısı (°C); "fx": görsel etki; "explosion": patlama/sıçrama.
export const REACTIONS = [
  { id: 'cozunme', needs: ['toz', 'su'], name: 'Çözünme', tone: 'ok', desc: 'Beyaz toz suda çözündü; şeffaf bir çözelti oluştu.', color: 0x7fb6e6 },
  { id: 'tuzlu', needs: ['tuz', 'su'], name: 'Tuzlu su', tone: 'ok', desc: 'Tuz suda eridi; tuzlu su hazır.', color: 0xc4e2f0 },
  { id: 'kopuk', needs: ['efervesan', 'su'], name: 'Köpürme', tone: 'ok', desc: 'Efervesan tablet karbondioksit çıkararak çözündü.', color: 0xd6f1ff, fx: { type: 'bubbles', minTemp: 0 } },
  { id: 'seyreltme_guvenli', needs: ['asit', 'su'], requiresLast: 'asit', name: 'Güvenli seyreltme', tone: 'ok', desc: 'Suyun içine asit eklediniz; ısı az çıktı. Doğru yöntem bu.', color: 0xe3f5ec, heat: 12 },
  { id: 'seyreltme_tehlikeli', needs: ['asit', 'su'], requiresLast: 'su', name: 'TEHLİKE: sıçrama!', tone: 'warn', desc: 'Asidin üstüne su döktünüz! Şiddetli ısınma ve sıçrama oldu. Asit her zaman suya eklenir.', color: 0xffe0c2, heat: 70, fx: { type: 'bubbles', minTemp: 0 }, explosion: true },
  { id: 'sodyum_su', needs: ['sodyum', 'su'], name: 'TEHLİKE: patlama!', tone: 'warn', desc: 'Sodyum suyla şiddetle tepkimeye girdi; hidrojen gazı çıktı ve patladı.', color: 0xfff0c0, heat: 90, fx: { type: 'bubbles', minTemp: 0 }, explosion: true },
  { id: 'mg_asit', needs: ['magnezyum', 'asit'], name: 'Hidrojen çıkışı', tone: 'ok', desc: 'Magnezyum asitte köpürerek hidrojen gazı çıkardı; ortam ısındı.', color: 0xdbeeea, heat: 15, fx: { type: 'bubbles', minTemp: 0 } },
  { id: 'notr', needs: ['asit', 'baz'], name: 'Nötrleşme', tone: 'ok', desc: 'Asit ve baz birbirini nötrleştirdi; ortam ısındı.', color: 0xdff3ff, heat: 40 },
  { id: 'pembe', needs: ['baz', 'fenolftalein'], name: 'Pembe renk', tone: 'ok', desc: 'Baz ortamında fenolftalein pembeleşti.', color: 0xff4fa3 },
  { id: 'renk_kaybi', needs: ['asit', 'baz', 'fenolftalein'], after: 'notr', name: 'Renk kayboldu', tone: 'ok', desc: 'Ortam nötrleşince pembe renk kayboldu.', color: 0xf3f6ff },
  { id: 'kaynama', needs: ['su'], minTemp: 100, name: 'Kaynama', tone: 'ok', desc: 'Su 100 °C\'de kaynayıp buhara dönüştü.', color: 0xbfe3ff, fx: { type: 'steam', minTemp: 95 }, evaporate: true },
  { id: 'yanma', needs: ['kagit'], minTemp: 200, name: 'Yanma', tone: 'warn', desc: 'Kağıt yüksek sıcaklıkta yanıp kömürleşti.', color: 0x3e2a1e, fx: { type: 'smoke', minTemp: 150 } },
];

// Tüpün durumuna göre uygulanacak yeni tepkimeleri döndürür (her tepkime bir kez gerçekleşir).
export function applicableReactions(state) {
  const { contents, temp, lastAdded, reacted } = state;
  const out = [];
  for (const r of REACTIONS) {
    if (reacted.has(r.id)) continue;
    if (!r.needs.every(k => contents.includes(k))) continue;
    if (r.requiresLast && lastAdded !== r.requiresLast) continue;
    if (r.after && !reacted.has(r.after)) continue;
    if (temp < (r.minTemp ?? 0)) continue;
    out.push(r);
  }
  return out;
}

// Periyodik tablo üzerinde bir element bilgisi
export function elementInfo(symbol) {
  const e = ELEMENTS.find(x => x[0] === symbol);
  if (!e) return null;
  return { symbol: e[0], name: e[1], group: e[2], period: e[3], mass: e[4], item: ELEMENT_ITEMS[e[0]] ?? null };
}
