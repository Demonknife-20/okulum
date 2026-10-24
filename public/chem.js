// Kimya laboratuvarı: element verisi, bileşik tablosu ve birleşme kuralları (tarayıcı bağımlılığı yok).

// [sembol, Türkçe ad, atom numarası, grup (1-18), periyot (1-6)]
export const ELEMENTS = [
  ['H', 'Hidrojen', 1, 1, 1], ['He', 'Helyum', 2, 18, 1],
  ['Li', 'Lityum', 3, 1, 2], ['Be', 'Berilyum', 4, 2, 2], ['B', 'Bor', 5, 13, 2], ['C', 'Karbon', 6, 14, 2],
  ['N', 'Azot', 7, 15, 2], ['O', 'Oksijen', 8, 16, 2], ['F', 'Flor', 9, 17, 2], ['Ne', 'Neon', 10, 18, 2],
  ['Na', 'Sodyum', 11, 1, 3], ['Mg', 'Magnezyum', 12, 2, 3], ['Al', 'Alüminyum', 13, 13, 3], ['Si', 'Silisyum', 14, 14, 3],
  ['P', 'Fosfor', 15, 15, 3], ['S', 'Kükürt', 16, 16, 3], ['Cl', 'Klor', 17, 17, 3], ['Ar', 'Argon', 18, 18, 3],
  ['K', 'Potasyum', 19, 1, 4], ['Ca', 'Kalsiyum', 20, 2, 4], ['Ti', 'Titanyum', 22, 4, 4], ['Cr', 'Krom', 24, 6, 4],
  ['Mn', 'Mangan', 25, 7, 4], ['Fe', 'Demir', 26, 8, 4], ['Co', 'Kobalt', 27, 9, 4], ['Ni', 'Nikel', 28, 10, 4],
  ['Cu', 'Bakır', 29, 11, 4], ['Zn', 'Çinko', 30, 12, 4], ['Ge', 'Germanyum', 32, 14, 4], ['As', 'Arsenik', 33, 15, 4],
  ['Se', 'Selenyum', 34, 16, 4], ['Br', 'Brom', 35, 17, 4], ['Kr', 'Kripton', 36, 18, 4],
  ['Ag', 'Gümüş', 47, 11, 5], ['Sn', 'Kalay', 50, 14, 5], ['Au', 'Altın', 79, 11, 6], ['Pb', 'Kurşun', 82, 14, 6],
];

// Bileşik tablosu: bileşim (sembol → adet) ve biçim/ad. Eşleşme bileşime göre yapılır.
export const COMPOUNDS = [
  { comp: { H: 2 }, formula: 'H2', name: 'Hidrojen gazı' },
  { comp: { O: 2 }, formula: 'O2', name: 'Oksijen gazı' },
  { comp: { N: 2 }, formula: 'N2', name: 'Azot gazı' },
  { comp: { Cl: 2 }, formula: 'Cl2', name: 'Klor gazı' },
  { comp: { H: 1, Cl: 1 }, formula: 'HCl', name: 'Tuz ruhu (hidroklorik asit)' },
  { comp: { Na: 1, Cl: 1 }, formula: 'NaCl', name: 'Sofra tuzu' },
  { comp: { K: 1, Cl: 1 }, formula: 'KCl', name: 'Potasyum klorür' },
  { comp: { H: 2, O: 1 }, formula: 'H2O', name: 'Su' },
  { comp: { H: 2, O: 2 }, formula: 'H2O2', name: 'Oksijenli su (hidrojen peroksit)' },
  { comp: { C: 1, O: 2 }, formula: 'CO2', name: 'Karbondioksit' },
  { comp: { C: 1, O: 1 }, formula: 'CO', name: 'Karbonmonoksit' },
  { comp: { C: 1, H: 4 }, formula: 'CH4', name: 'Metan (doğalgaz)' },
  { comp: { N: 1, H: 3 }, formula: 'NH3', name: 'Amonyak' },
  { comp: { H: 2, S: 1 }, formula: 'H2S', name: 'Hidrojen sülfür (çürük yumurta kokusu)' },
  { comp: { S: 1, O: 2 }, formula: 'SO2', name: 'Kükürt dioksit' },
  { comp: { Na: 1, O: 1, H: 1 }, formula: 'NaOH', name: 'Sud kostik (sodyum hidroksit)' },
  { comp: { Ca: 1, O: 1 }, formula: 'CaO', name: 'Sönmemiş kireç' },
  { comp: { Mg: 1, O: 1 }, formula: 'MgO', name: 'Magnezyum oksit' },
  { comp: { Cu: 1, O: 1 }, formula: 'CuO', name: 'Bakır(II) oksit' },
  { comp: { Zn: 1, O: 1 }, formula: 'ZnO', name: 'Çinko oksit' },
  { comp: { Si: 1, O: 2 }, formula: 'SiO2', name: 'Silisyum dioksit (kum, kuvars)' },
  { comp: { Al: 2, O: 3 }, formula: 'Al2O3', name: 'Alüminyum oksit (korund)' },
  { comp: { Fe: 2, O: 3 }, formula: 'Fe2O3', name: 'Demir(III) oksit (pas)' },
  { comp: { H: 2, S: 1, O: 4 }, formula: 'H2SO4', name: 'Sülfürik asit (akü asidi)' },
];

const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
// Formülü alt simgelerle yazar: H2O → H₂O
export function prettyFormula(formula) {
  return formula.replace(/\d/g, d => SUB[d]);
}

// İki parçanın toplam bileşimi
export function combineComp(a, b) {
  const out = { ...a };
  for (const [key, n] of Object.entries(b)) out[key] = (out[key] ?? 0) + n;
  return out;
}

const sameComp = (a, b) => {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
};

// Bileşime karşılık gelen ürün. Tam eşleşme ya da 2–3 katı (örn. 2H₂O).
export function findProduct(comp) {
  const exact = COMPOUNDS.find(c => sameComp(c.comp, comp));
  if (exact) return { formula: prettyFormula(exact.formula), name: exact.name, count: 1 };
  for (const k of [2, 3]) {
    const values = Object.values(comp);
    if (values.some(v => v % k !== 0)) continue;
    const divided = Object.fromEntries(Object.entries(comp).map(([key, v]) => [key, v / k]));
    const match = COMPOUNDS.find(c => sameComp(c.comp, divided));
    if (match) return { formula: prettyFormula(match.formula), name: match.name, count: k };
  }
  return null;
}

// Bir öğenin bileşimi: tek atom ya da bileşik
export function atomComp(symbol) {
  return { [symbol]: 1 };
}
