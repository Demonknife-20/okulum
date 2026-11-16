// Matematik laboratuvarı: saf hesaplama fonksiyonları (tarayıcı bağımlılığı yok, test edilebilir).

const finite = (v, name) => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} sayı olmalı.`);
  return n;
};
const round = (n, digits = 4) => Number(Number(n).toFixed(digits));

// İkinci derece denklem: ax² + bx + c = 0
export function quadraticRoots(a0, b0, c0) {
  const a = finite(a0, 'a'), b = finite(b0, 'b'), c = finite(c0, 'c');
  if (a === 0) throw new Error('a sıfır olamaz; denklem ikinci dereceden değil.');
  const d = b * b - 4 * a * c;
  if (d > 0) {
    const s = Math.sqrt(d);
    return { type: 'iki gerçek kök', discriminant: round(d), x1: round((-b + s) / (2 * a)), x2: round((-b - s) / (2 * a)) };
  }
  if (d === 0) {
    return { type: 'çakışık (tek) kök', discriminant: 0, x1: round(-b / (2 * a)), x2: round(-b / (2 * a)) };
  }
  return {
    type: 'karmaşık kökler',
    discriminant: round(d),
    realPart: round(-b / (2 * a)),
    imagPart: round(Math.sqrt(-d) / (2 * Math.abs(a))),
  };
}

// İki bilinmeyenli doğrusal sistem (Cramer kuralı): a1x + b1y = c1, a2x + b2y = c2
export function solveLinearSystem(a1, b1, c1, a2, b2, c2) {
  const [A1, B1, C1, A2, B2, C2] = [a1, b1, c1, a2, b2, c2].map((v, i) => finite(v, ['a1', 'b1', 'c1', 'a2', 'b2', 'c2'][i]));
  const det = A1 * B2 - A2 * B1;
  if (Math.abs(det) < 1e-12) throw new Error('Determinant sıfır: sistemin tek bir çözümü yok (paralel ya da aynı doğrular).');
  return { x: round((C1 * B2 - C2 * B1) / det), y: round((A1 * C2 - A2 * C1) / det), determinant: round(det) };
}

// Üçgen: üç kenardan alan, çevre ve açılar (Heron ve kosinüs teoremi)
export function triangleFromSides(a0, b0, c0) {
  const a = finite(a0, 'a'), b = finite(b0, 'b'), c = finite(c0, 'c');
  if (a <= 0 || b <= 0 || c <= 0) throw new Error('Kenarlar sıfırdan büyük olmalı.');
  if (a + b <= c || a + c <= b || b + c <= a) throw new Error('Bu kenarlarla üçgen çizilemez (en uzun kenar, diğer ikisinin toplamından küçük olmalı).');
  const s = (a + b + c) / 2;
  const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
  const angle = (x, y, z) => (Math.acos(Math.min(1, Math.max(-1, (y * y + z * z - x * x) / (2 * y * z)))) * 180) / Math.PI;
  const angles = [angle(a, b, c), angle(b, a, c), angle(c, a, b)];
  const largest = Math.max(...angles);
  const type = Math.abs(largest - 90) < 1e-9 ? 'dik üçgen' : largest > 90 ? 'geniş açılı üçgen' : 'dar açılı üçgen';
  return { perimeter: round(a + b + c), area: round(area), angles: angles.map(v => round(v, 2)), type };
}

// Sayı listesinin betimleyici istatistikleri (örneklem standart sapması)
export function describeNumbers(values) {
  const nums = (Array.isArray(values) ? values : []).map(v => Number(v)).filter(Number.isFinite);
  if (!nums.length) throw new Error('En az bir sayı girin.');
  const sorted = [...nums].sort((x, y) => x - y);
  const n = nums.length;
  const mean = nums.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const variance = n > 1 ? nums.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  return {
    count: n,
    mean: round(mean),
    median: round(median),
    min: sorted[0],
    max: sorted[n - 1],
    range: round(sorted[n - 1] - sorted[0]),
    stdDev: round(Math.sqrt(variance)),
  };
}

// Yüzde değişim: (yeni - eski) / |eski| · 100
export function percentChange(from0, to0) {
  const from = finite(from0, 'Eski değer'), to = finite(to0, 'Yeni değer');
  if (from === 0) throw new Error('Eski değer sıfır olamaz; yüzde değişim tanımsız.');
  return round(((to - from) / Math.abs(from)) * 100, 2);
}

// Bileşik faiz: A = P·(1 + r)^n, r yüzde olarak verilir
export function compoundGrowth(principal0, ratePercent0, years0) {
  const p = finite(principal0, 'Anapara'), r = finite(ratePercent0, 'Oran'), n = finite(years0, 'Süre');
  if (p < 0) throw new Error('Anapara negatif olamaz.');
  if (n < 0 || !Number.isInteger(n)) throw new Error('Süre sıfır veya pozitif tam sayı olmalı.');
  const amount = p * (1 + r / 100) ** n;
  return { amount: round(amount, 2), interest: round(amount - p, 2) };
}

// Asal çarpanlarına ayırma (pozitif tam sayı)
export function primeFactors(n0) {
  const n = finite(n0, 'Sayı');
  if (!Number.isInteger(n) || n < 2) throw new Error('2 veya daha büyük bir tam sayı girin.');
  const factors = [];
  let m = n;
  for (let p = 2; p * p <= m; p += 1) {
    while (m % p === 0) { factors.push(p); m /= p; }
  }
  if (m > 1) factors.push(m);
  return factors;
}

// En büyük ortak bölen ve en küçük ortak kat (pozitif tam sayılar)
export function gcdLcm(a0, b0) {
  const a = finite(a0, 'a'), b = finite(b0, 'b');
  if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0) throw new Error('Pozitif tam sayılar girin.');
  const gcd = (x, y) => (y ? gcd(y, x % y) : x);
  const g = gcd(a, b);
  return { gcd: g, lcm: (a / g) * b };
}

// Kombinasyon ve permütasyon: nCr, nPr (0 ≤ r ≤ n, tam sayılar)
export function combinatorics(n0, r0) {
  const n = finite(n0, 'n'), r = finite(r0, 'r');
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0) throw new Error('n ve r sıfır ya da pozitif tam sayı olmalı.');
  if (r > n) throw new Error('r, n\'den büyük olamaz.');
  if (n > 170) throw new Error('n en fazla 170 olabilir.');
  let perm = 1;
  for (let i = 0; i < r; i += 1) perm *= n - i;
  let fact = 1;
  for (let i = 2; i <= r; i += 1) fact *= i;
  return { permutations: round(perm, 0), combinations: round(perm / fact, 0) };
}
