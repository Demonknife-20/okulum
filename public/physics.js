// Fizik deneyleri: eğik düzlem, serbest düşme, bir boyutlu çarpışma.
// Saf JavaScript (tarayıcı bağımlılığı yok): test edilebilir.

export const G = 9.81;
const r = (n, d = 3) => Number(n.toFixed(d));

// Eğik düzlemde sürtünmeli kayma. Kütleden bağımsızdır: a = g(sinθ − μcosθ)
export function inclinedPlane({ angleDeg, mu, length, g = G }) {
  const th = (angleDeg * Math.PI) / 180;
  if (!(angleDeg > 0 && angleDeg < 90)) throw new Error('Açı 0 ile 90 derece arasında olmalı.');
  if (!(mu >= 0)) throw new Error('Sürtünme katsayısı negatif olamaz.');
  if (!(length > 0)) throw new Error('Uzunluk sıfırdan büyük olmalı.');
  const a = g * (Math.sin(th) - mu * Math.cos(th));
  const slides = a > 1e-9;
  const time = slides ? Math.sqrt((2 * length) / a) : null;
  return {
    slides,
    acceleration: r(Math.max(a, 0)),
    time: time === null ? null : r(time),
    finalSpeed: slides ? r(a * time) : 0,
    frictionAccel: r(mu * g * Math.cos(th)),
    staticNote: slides ? 'Blok kayıyor.' : 'Sürtünme kaymayı engelliyor: blok yerinde kalır.',
  };
}

// Eğik düzlemde zamana bağlı konum (0'dan length'e) ve hız
export function inclinedSeries({ angleDeg, mu, length, steps = 120 }) {
  const info = inclinedPlane({ angleDeg, mu, length });
  if (!info.slides) return { points: [{ t: 0, s: 0, v: 0 }], info };
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (info.time * i) / steps;
    const s = 0.5 * info.acceleration * t * t;
    points.push({ t: r(t, 4), s: r(Math.min(s, length), 4), v: r(info.acceleration * t, 4) });
  }
  return { points, info };
}

// Serbest düşme (hava direnci ihmal): t = √(2h/g), v = g·t
export function freeFall({ height, g = G }) {
  if (!(height > 0)) throw new Error('Yükseklik sıfırdan büyük olmalı.');
  const time = Math.sqrt((2 * height) / g);
  return { time: r(time), finalSpeed: r(g * time), kineticAtGround: r(g * height), potentialAtTop: r(g * height) };
}

export function freeFallSeries({ height, g = G, steps = 120 }) {
  if (!(height > 0)) throw new Error('Yükseklik sıfırdan büyük olmalı.');
  const time = Math.sqrt((2 * height) / g); // yuvarlatılmamış süre: son nokta tam yere denk gelir
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (time * i) / steps;
    points.push({ t: r(t, 4), y: r(Math.max(height - 0.5 * g * t * t, 0), 4), v: r(g * t, 4) });
  }
  return points;
}

// Bir boyutta çarpışma. e = 1: esnek, e = 0: tamamen esnek olmayan (birlikte hareket)
export function collision1D({ m1, v1, m2, v2, e }) {
  if (!(m1 > 0) || !(m2 > 0)) throw new Error('Kütleler sıfırdan büyük olmalı.');
  if (!(e >= 0 && e <= 1)) throw new Error('Geri esneklik katsayısı 0 ile 1 arasında olmalı.');
  const M = m1 + m2;
  const u1 = ((m1 - e * m2) * v1 + (1 + e) * m2 * v2) / M;
  const u2 = ((m2 - e * m1) * v2 + (1 + e) * m1 * v1) / M;
  const pBefore = m1 * v1 + m2 * v2;
  const pAfter = m1 * u1 + m2 * u2;
  const keBefore = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
  const keAfter = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2;
  return {
    v1After: r(u1), v2After: r(u2),
    momentumBefore: r(pBefore), momentumAfter: r(pAfter),
    keBefore: r(keBefore), keAfter: r(keAfter),
    keLost: r(keBefore - keAfter),
    type: e === 1 ? 'esnek' : e === 0 ? 'tamamen esnek olmayan' : 'kısmen esnek',
  };
}

// ---- Basit sarkaç: küçük açı yaklaşımı T = 2π√(L/g); büyük açıda düzeltme (1 + θ²/16) ----
export function pendulum({ length, angleDeg = 5, g = G }) {
  if (!(length > 0)) throw new Error('İp uzunluğu sıfırdan büyük olmalı.');
  if (!(angleDeg > 0 && angleDeg < 90)) throw new Error('Başlangıç açısı 0 ile 90 derece arasında olmalı.');
  const th0 = (angleDeg * Math.PI) / 180;
  const T0 = 2 * Math.PI * Math.sqrt(length / g);
  const period = T0 * (1 + (th0 * th0) / 16);
  return { period: r(period), frequency: r(1 / period), smallAnglePeriod: r(T0), maxSpeed: r(Math.sqrt(2 * g * length * (1 - Math.cos(th0)))) };
}

// Sarkaç açısının zamana göre değişimi (küçük açı): θ(t) = θ₀·cos(ωt)
export function pendulumSeries({ length, angleDeg = 5, steps = 160, g = G }) {
  const th0 = (angleDeg * Math.PI) / 180;
  const omega = Math.sqrt(g / length);
  const period = 2 * Math.PI / omega;
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (2 * period * i) / steps;
    points.push({ t: r(t, 4), angleDeg: r((th0 * Math.cos(omega * t) * 180) / Math.PI, 3) });
  }
  return points;
}

// ---- Sürtünmeli yatay hareket: sürtünme yüzeyi ve kütle seçilir, itme kuvveti uygulanır ----
export const SURFACES = {
  buz: { label: 'Buz', mu: 0.03 },
  tahta: { label: 'Tahta', mu: 0.25 },
  hali: { label: 'Halı', mu: 0.5 },
  kaucuk: { label: 'Kauçuk', mu: 0.8 },
};

// İtilen blok: F > μmg ise hareket eder. a = (F − μmg)/m. Kütle, sürtünmeli yatay düzlemde ivmeyi değiştirir.
export function pushedBlock({ mass, force, surface, distance, g = G }) {
  if (!(mass > 0)) throw new Error('Kütle sıfırdan büyük olmalı.');
  if (!(force >= 0)) throw new Error('İtme kuvveti negatif olamaz.');
  if (!(distance > 0)) throw new Error('Mesafe sıfırdan büyük olmalı.');
  const mu = SURFACES[surface]?.mu;
  if (mu === undefined) throw new Error('Bilinmeyen yüzey.');
  const friction = mu * mass * g;
  const net = force - friction;
  if (net <= 1e-9) {
    return { moves: false, friction: r(friction), acceleration: 0, time: null, finalSpeed: 0, note: 'İtme sürtünmeden küçük: blok kıpırdamaz.' };
  }
  const a = net / mass;
  const time = Math.sqrt((2 * distance) / a);
  return { moves: true, friction: r(friction), acceleration: r(a), time: r(time), finalSpeed: r(a * time), note: 'Blok hızlanarak hareket eder.' };
}

export function pushedBlockSeries({ mass, force, surface, distance, steps = 120 }) {
  const info = pushedBlock({ mass, force, surface, distance });
  if (!info.moves) return { points: [{ t: 0, x: 0 }], info };
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (info.time * i) / steps;
    points.push({ t: r(t, 4), x: r(0.5 * info.acceleration * t * t, 4) });
  }
  return { points, info };
}
