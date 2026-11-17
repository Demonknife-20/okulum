// Kimya laboratuvarı: maddeler, ısınma fiziği, periyodik tablo (118 element), radyasyon.
// Saf JavaScript (tarayıcı bağımlılığı yok): test edilebilir.

// Maddeler. ml: sıvı hacmi; g: katı kütlesi; cp: özgül ısı (J/g·K); density: g/mL.
export const SUBSTANCES = {
  su: { name: 'Su', formula: 'H₂O', density: 1.0, cp: 4.18, kind: 'liquid', ml: 50, color: 0x4a90e2, fill: 0.5 },
  asit: { name: 'Hidroklorik asit', formula: 'HCl (2 M)', density: 1.08, cp: 3.6, kind: 'liquid', ml: 20, color: 0xe6fff2, fill: 0.4 },
  baz: { name: 'Sodyum hidroksit', formula: 'NaOH (1 M)', density: 1.04, cp: 3.7, kind: 'liquid', ml: 20, color: 0xf4f4ff, fill: 0.4 },
  fenolftalein: { name: 'Fenolftalein (indikatör)', formula: 'C₂₀H₁₄O₄', density: 1.0, cp: 2.0, kind: 'liquid', ml: 2, color: 0xfbf3ff, fill: 0.08 },
  toz: { name: 'Beyaz toz (şeker)', formula: 'C₁₂H₂₂O₁₁', density: 1.59, cp: 1.2, kind: 'solid', g: 10, color: 0xf2f2f2, fill: 0.22 },
  tuz: { name: 'Sofra tuzu', formula: 'NaCl', density: 2.16, cp: 0.86, kind: 'solid', g: 10, color: 0xf5fbff, fill: 0.22 },
  efervesan: { name: 'Efervesan tablet', formula: 'NaHCO₃ + asit', density: 1.5, cp: 1.2, kind: 'solid', g: 4, color: 0xffd966, fill: 0.18 },
  kagit: { name: 'Kağıt', formula: 'C₆H₁₀O₅', density: 0.8, cp: 1.3, kind: 'solid', g: 1, color: 0xfffdf5, fill: 0.16 },
  sodyum: { name: 'Sodyum (metal)', formula: 'Na', density: 0.97, cp: 1.23, kind: 'solid', g: 1, color: 0xdfe3e8, fill: 0.06 },
  magnezyum: { name: 'Magnezyum şerit', formula: 'Mg', density: 1.74, cp: 1.02, kind: 'solid', g: 1, color: 0xc9ccd1, fill: 0.06 },
  etanol: { name: 'Etanol (ispirto)', formula: 'C₂H₅OH', density: 0.79, cp: 2.44, kind: 'liquid', ml: 20, color: 0xf7f9ff, fill: 0.4, flammable: true },
  yag: { name: 'Zeytinyağı', formula: 'Yağ asitleri', density: 0.92, cp: 2.0, kind: 'liquid', ml: 15, color: 0xe6c35c, fill: 0.3 },
  permanganat: { name: 'Potasyum permanganat çözeltisi', formula: 'KMnO₄', density: 1.05, cp: 3.9, kind: 'liquid', ml: 10, color: 0x6a1b9a, fill: 0.2 },
  bakir_sulfat: { name: 'Bakır(II) sülfat çözeltisi', formula: 'CuSO₄', density: 1.1, cp: 3.8, kind: 'liquid', ml: 15, color: 0x3f7fd9, fill: 0.25 },
  cinko_toz: { name: 'Çinko tozu', formula: 'Zn', density: 7.1, cp: 0.39, kind: 'solid', g: 3, color: 0x9aa3ad, fill: 0.08 },
  kalsiyum_karbonat: { name: 'Kalsiyum karbonat (kireç tozu)', formula: 'CaCO₃', density: 2.7, cp: 0.82, kind: 'solid', g: 8, color: 0xf5f1e6, fill: 0.2 },
  kibrit: { name: 'Kibrit', formula: '—', tool: true, color: 0xd32f2f },
  tripod: { name: 'Üç ayaklı + amyant teli', formula: '—', tool: true, color: 0x7a7a7a },
  termometre: { name: 'Lazerli termometre', formula: '—', tool: true, color: 0xe53935 },
  tup: { name: 'Yeni deney tüpü', formula: '—', tool: true, color: 0xdfe9ef },
  cimbiz: { name: 'Cımbız', formula: '—', tool: true, color: 0xb0bec5 },
  radyasyon: { name: 'Radyasyon ölçer', formula: '—', tool: true, color: 0x424242 },
  eldiven: { name: 'Eldiven', formula: '—', tool: true, color: 0x42a5f5, ppe: true },
  gozluk: { name: 'Koruyucu gözlük', formula: '—', tool: true, color: 0x90caf9, ppe: true },
  onluk: { name: 'Laboratuvar önlüğü', formula: '—', tool: true, color: 0xf5f5f5, ppe: true },
};

// 118 elementin sembolleri, atom numarasına göre (Z = dizi indeksi + 1)
export const SYMBOLS = ['H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar','K','Ca','Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr','Rb','Sr','Y','Zr','Nb','Mo','Tc','Ru','Rh','Pd','Ag','Cd','In','Sn','Sb','Te','I','Xe','Cs','Ba','La','Ce','Pr','Nd','Pm','Sm','Eu','Gd','Tb','Dy','Ho','Er','Tm','Yb','Lu','Hf','Ta','W','Re','Os','Ir','Pt','Au','Hg','Tl','Pb','Bi','Po','At','Rn','Fr','Ra','Ac','Th','Pa','U','Np','Pu','Am','Cm','Bk','Cf','Es','Fm','Md','No','Lr','Rf','Db','Sg','Bh','Hs','Mt','Ds','Rg','Cn','Nh','Fl','Mc','Lv','Ts','Og'];

// Türkçe adlar (aynı sırada)
export const NAMES = ['Hidrojen','Helyum','Lityum','Berilyum','Bor','Karbon','Azot','Oksijen','Flor','Neon','Sodyum','Magnezyum','Alüminyum','Silisyum','Fosfor','Kükürt','Klor','Argon','Potasyum','Kalsiyum','Skandiyum','Titan','Vanadyum','Krom','Mangan','Demir','Kobalt','Nikel','Bakır','Çinko','Galyum','Germanyum','Arsenik','Selenyum','Brom','Kripton','Rubidyum','Stronsiyum','İtriyum','Zirkonyum','Niyobyum','Molibden','Teknesyum','Rutenyum','Rodyum','Paladyum','Gümüş','Kadmiyum','İndiyum','Kalay','Antimon','Tellür','İyot','Ksenon','Sezyum','Baryum','Lantan','Seryum','Praseodim','Neodim','Prometyum','Samaryum','Evropiyum','Gadolinyum','Terbiyum','Disprozyum','Holmiyum','Erbiyum','Tulyum','İterbiyum','Lutesyum','Hafniyum','Tantal','Tungsten','Renyum','Osmiyum','İridyum','Platin','Altın','Cıva','Talyum','Kurşun','Bizmut','Polonyum','Astatin','Radon','Fransiyum','Radyum','Aktinyum','Toryum','Protaktinyum','Uranyum','Neptünyum','Plütonyum','Amerikyum','Küriyum','Berkelyum','Kaliforniyum','Einsteinyum','Fermiyum','Mendelevyum','Nobelyum','Lavrensiyum','Rutherfordyum','Dubniyum','Seaborgiyum','Bohriyum','Hassiyum','Meitneriyum','Darmstadtiyum','Röntgenyum','Kopernikyum','Nihonyum','Flerovyum','Moskovyum','Livermoryum','Tennessin','Oganesson'];

// Kütle (g/mol) ve kategori, Z sırasıyla.
// Kategori: a alkali, e toprak alkali, t geçiş, p diğer metal, m yarı metal, n ametal, h halojen, g soygaz, l lantanit, c aktinit.
const MASS = [1.008,4.0026,6.94,9.012,10.81,12.011,14.007,15.999,18.998,20.180,22.990,24.305,26.982,28.085,30.974,32.06,35.45,39.948,39.098,40.078,44.956,47.867,50.942,51.996,54.938,55.845,58.933,58.693,63.546,65.38,69.723,72.630,74.922,78.971,79.904,83.798,85.468,87.62,88.906,91.224,92.906,95.95,98,101.07,102.91,106.42,107.87,112.41,114.82,118.71,121.76,127.60,126.90,131.29,132.91,137.33,138.91,140.12,140.91,144.24,145,150.36,151.96,157.25,158.93,162.50,164.93,167.26,168.93,173.05,174.97,178.49,180.95,183.84,186.21,190.23,192.22,195.08,196.97,200.59,204.38,207.2,208.98,209,210,222,223,226,227,232.04,231.04,238.03,237,244,243,247,247,251,252,257,258,259,266,267,268,269,270,277,278,281,282,285,286,289,290,293,294,294];
const CAT_STR = 'H n He g Li a Be e B m C n N n O n F h Ne g Na a Mg e Al p Si m P n S n Cl h Ar g K a Ca e Sc t Ti t V t Cr t Mn t Fe t Co t Ni t Cu t Zn t Ga p Ge m As m Se n Br h Kr g Rb a Sr e Y t Zr t Nb t Mo t Tc t Ru t Rh t Pd t Ag t Cd t In p Sn p Sb m Te m I h Xe g Cs a Ba e La l Ce l Pr l Nd l Pm l Sm l Eu l Gd l Tb l Dy l Ho l Er l Tm l Yb l Lu l Hf t Ta t W t Re t Os t Ir t Pt t Au t Hg t Tl p Pb p Bi p Po m At h Rn g Fr a Ra e Ac c Th c Pa c U c Np c Pu c Am c Cm c Bk c Cf c Es c Fm c Md c No c Lr t Rf t Db t Sg t Bh t Hs t Mt t Ds t Rg t Cn t Nh p Fl p Mc p Lv p Ts h Og g';
const CAT_BY_SYMBOL = (() => {
  const parts = CAT_STR.split(' ');
  const map = {};
  for (let i = 0; i < parts.length; i += 2) map[parts[i]] = parts[i + 1];
  return map;
})();


// Kategoriye göre tahmini özgül ısı (J/g·K)
const CATEGORY_CP = { a: 0.9, e: 0.7, t: 0.45, p: 0.5, m: 0.7, n: 0.9, h: 0.5, g: 0.52, l: 0.19, c: 0.12 };

export const ELEMENTS = SYMBOLS.map((symbol, i) => {
  const z = i + 1;
  return { symbol, z, name: NAMES[i], mass: MASS[i], cat: CAT_BY_SYMBOL[symbol], radioactive: z >= 84 || z === 43 || z === 61 };
});

// Elementin tablodaki yeri: ana tablo (grup, periyot) veya f-blok satırı (lantanit/aktinit).
export function elementLayout(e) {
  const z = e.z;
  if (z >= 57 && z <= 71) return { row: 'lan', col: z - 57 };
  if (z >= 89 && z <= 102) return { row: 'act', col: z - 89 };
  const period = z <= 2 ? 1 : z <= 10 ? 2 : z <= 18 ? 3 : z <= 36 ? 4 : z <= 54 ? 5 : z <= 86 ? 6 : 7;
  const start = { 1: 1, 2: 3, 3: 11, 4: 19, 5: 37, 6: 55, 7: 87 }[period];
  const idx = z - start;
  let group;
  if (period === 1) group = z === 1 ? 1 : 18;
  else if (period === 2 || period === 3) group = idx < 2 ? idx + 1 : idx + 11;
  else if (period === 4 || period === 5) group = idx + 1;
  else group = idx < 2 ? idx + 1 : idx - 13; // 6. ve 7. periyot: f-blok çıkarılınca
  return { row: 'main', group, period };
}

export function elementBySymbol(symbol) {
  return ELEMENTS.find(e => e.symbol === symbol) ?? null;
}

// Elementin sahnedeki malzeme anahtarı: Na ve Mg için hazır maddeler, diğerleri için el_<sembol>
export function elementItemKey(symbol) {
  if (symbol === 'Na') return 'sodyum';
  if (symbol === 'Mg') return 'magnezyum';
  return `el_${symbol}`;
}

// Radyoaktif olmayan elementler için dinamik madde kaydı (katı, 1 g örnek)
export function ensureElementSubstance(symbol) {
  const key = elementItemKey(symbol);
  if (SUBSTANCES[key]) return SUBSTANCES[key];
  const e = elementBySymbol(symbol);
  if (!e) return null;
  const hue = { a: 0xffb36b, e: 0xffd98a, t: 0xb7c7d9, p: 0xc9d4cf, m: 0xa8b8a6, n: 0xf1f1e8, h: 0xa6e3d4, g: 0xd9c6ff, l: 0xc7e0a7, c: 0xf2b5b5 }[e.cat] ?? 0xcccccc;
  SUBSTANCES[key] = {
    name: `${e.name} (${symbol})`, formula: symbol, density: 7.0, cp: CATEGORY_CP[e.cat] ?? 0.5,
    kind: 'solid', g: 1, color: hue, fill: 0.06, radioactive: e.radioactive, element: symbol,
  };
  return SUBSTANCES[key];
}

// Karışımın hacim, kütle ve yoğunluğu
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
      mass += s.g;
      volume += s.g / s.density;
    }
  }
  const r = (n, d = 1) => Number(n.toFixed(d));
  return { volumeMl: r(volume), massG: r(mass), densityGmL: volume > 0 ? r(mass / volume, 2) : 0 };
}

// Isı kapasitesi (J/K): her maddenin kütlesi × özgül ısısının toplamı
export function heatCapacity(contents) {
  let c = 0;
  for (const key of contents) {
    const s = SUBSTANCES[key];
    if (!s || s.tool) continue;
    const mass = s.kind === 'liquid' ? s.ml * s.density : s.g;
    c += mass * s.cp;
  }
  return c;
}

// Brülörün tüpe aktardığı güç (W) ve ortama ısı kaybı katsayısı (W/K)
export const BURNER_POWER = 180;
export const SURFACE_LOSS = 2.5;
export const AMBIENT = 20;
export const GLASS_HEAT = 15; // J/K: cam tüpün ısı kapasitesi
export const WATER_LATENT = 2260; // J/g buharlaşma ısısı
export const EVAP_SPEEDUP = 8;    // oyun hızlandırması: gerçek süreden 8 kat hızlı buharlaşma

// Bir tüpün sıcaklığını dt saniye ilerletir. Su varsa 100 °C'de kaynama plato yapar.
// Döner: { temp, evaporatedMl } — buharlaşan su miktarı (mL).
export function stepTemperature(temp, contents, dt, heating) {
  const C = heatCapacity(contents) + GLASS_HEAT;
  let t = temp;
  let evaporatedMl = 0;
  const hasWater = contents.includes('su');
  if (heating) {
    const power = BURNER_POWER;
    if (hasWater && t >= 100) {
      // Enerji buharlaşmaya gider; sıcaklık 100 °C'de sabit kalır
      const grams = (power * dt) / WATER_LATENT * EVAP_SPEEDUP;
      evaporatedMl = grams / 1.0;
      t = 100;
    } else {
      t += (power / C) * dt;
      if (hasWater && t > 100) t = 100;
    }
  } else {
    t += (-SURFACE_LOSS * (t - AMBIENT) / C) * dt;
  }
  return { temp: t, evaporatedMl };
}

// Tepkimeler. "needs": tüpte olmalı; "minTemp": en düşük sıcaklık; "after": önce başka tepkime;
// "requiresLast": son eklenen madde; "heat": ısı (°C); "fx": görsel etki; "explosion": patlama/sıçrama.
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
  { id: 'karismaz', needs: ['yag', 'su'], name: 'Karışmadılar', tone: 'info', desc: 'Yağ suyun üstünde ayrı bir tabaka oluşturdu; yağ ve su karışmaz (yağ daha az yoğun).', color: 0xf0e0a0 },
  { id: 'mor', needs: ['permanganat', 'su'], name: 'Mor çözelti', tone: 'info', desc: 'Potasyum permanganat suda mor bir çözelti verdi.', color: 0x9c27b0 },
  { id: 'kireç_asit', needs: ['kalsiyum_karbonat', 'asit'], name: 'Kireç köpürmesi', tone: 'ok', desc: 'Kalsiyum karbonat asitte köpürdü: karbondioksit gazı çıktı.', color: 0xe9efe9, heat: 8, fx: { type: 'bubbles', minTemp: 0 } },
  { id: 'bakir_cokme', needs: ['cinko_toz', 'bakir_sulfat'], name: 'Bakır çöktü', tone: 'ok', desc: 'Çinko, bakır iyonlarının yerini aldı; metalik bakır çöktü ve çözelti renksizleşti.', color: 0xb87333, heat: 5 },
  { id: 'etanol_yanma', needs: ['etanol'], minTemp: 78, name: 'TEHLİKE: etanol tutuştu!', tone: 'warn', desc: 'Etanol buharı kaynama noktasında alev aldı. Alkolü açık alevden uzak tutun.', color: 0x6b5a45, heat: 25, fx: { type: 'smoke', minTemp: 60 } },
  { id: 'kaynama', needs: ['su'], minTemp: 100, name: 'Kaynama', tone: 'ok', desc: 'Su 100 °C\'de kaynayıp buhara dönüştü.', color: 0xbfe3ff, fx: { type: 'steam', minTemp: 95 } },
  { id: 'yanma', needs: ['kagit'], minTemp: 200, name: 'Yanma', tone: 'warn', desc: 'Kağıt yüksek sıcaklıkta yanıp kömürleşti.', color: 0x3e2a1e, fx: { type: 'smoke', minTemp: 150 } },
];

// Tüpün durumuna göre yeni gerçekleşecek tepkimeler (her tepkime bir kez)
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

// Radyasyon dozu (µSv/h): arka plan + her kaynak için güç / (uzaklık² + 0.05)
export const BACKGROUND_DOSE = 0.1;
export const SOURCE_STRENGTH = { Ra: 40, U: 15, Po: 60, Pu: 30, Th: 8, Am: 25, Cm: 25, Np: 12, Pa: 10, Ac: 35, Rn: 20, Fr: 30, At: 45, Pm: 18, Tc: 10 };
export function doseRate(sources) {
  let dose = BACKGROUND_DOSE;
  for (const s of sources) {
    const strength = SOURCE_STRENGTH[s.symbol] ?? 15;
    dose += strength / (s.distance * s.distance + 0.05);
  }
  return Number(dose.toFixed(2));
}

// Güvenlik gereksinimleri: hangi işlem hangi koruyucu gerektirir
export function requiredPpe(action) {
  switch (action) {
    case 'light': return ['gozluk'];
    case 'pour_acid_base': return ['gozluk', 'eldiven', 'onluk'];
    case 'pour': return ['gozluk', 'eldiven'];
    case 'heat': return ['gozluk'];
    case 'radioactive': return ['eldiven', 'onluk'];
    default: return [];
  }
}
export function missingPpe(worn, needed) {
  return needed.filter(k => !worn.includes(k));
}

// Periyodik tablo elementinin tıklanınca verilecek bilgisi
export function elementInfo(symbol) {
  const e = elementBySymbol(symbol);
  if (!e) return null;
  const categoryNames = { a: 'Alkali metal', e: 'Toprak alkali metal', t: 'Geçiş metali', p: 'Diğer metal', m: 'Yarı metal', n: 'Ametal', h: 'Halojen', g: 'Soygaz', l: 'Lantanit', c: 'Aktinit' };
  return { symbol: e.symbol, name: e.name, z: e.z, mass: e.mass, category: categoryNames[e.cat], radioactive: e.radioactive, item: elementItemKey(e.symbol) };
}
