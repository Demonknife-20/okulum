// Fizik ve kimya deneyleri: saf hesaplama fonksiyonları (tarayıcı bağımlılığı yok, test edilebilir).

// Eğik atış: başlangıç hızı v (m/s), açı θ (derece), yerçekimi ivmesi g (m/s²)
export function projectile(v, thetaDeg, g) {
  const theta = (thetaDeg * Math.PI) / 180;
  const vx = v * Math.cos(theta);
  const vy = v * Math.sin(theta);
  const time = (2 * vy) / g;
  return {
    range: (v * v * Math.sin(2 * theta)) / g,
    height: (vy * vy) / (2 * g),
    time,
    vx,
    vy,
  };
}

// Yörünge noktaları: n adım, t ∈ [0, uçuş süresi]
export function trajectory(v, thetaDeg, g, steps = 80) {
  const { time, vx, vy } = projectile(v, thetaDeg, g);
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (time * i) / steps;
    points.push({ t, x: vx * t, y: Math.max(0, vy * t - 0.5 * g * t * t) });
  }
  return points;
}

// Asit-baz titrasyonu (güçlü asit + güçlü baz, 25 °C):
// Ca: asit derişimi (mol/L), Va: asit hacmi (mL), Cb: baz derişimi (mol/L), Vb: eklenen baz hacmi (mL)
export function titrationPH(Ca, Va, Cb, Vb) {
  const nAcid = (Ca * Va) / 1000 * 1000;  // mmol (mol/L * mL = mmol)
  const nBase = (Cb * Vb);                 // mmol
  const totalV = (Va + Vb) / 1000;         // L
  const diff = nAcid - nBase;              // mmol H+ fazlası (+) ya da OH- fazlası (-)
  if (Math.abs(diff) < 1e-9) return 7;
  if (diff > 0) return -Math.log10((diff / 1000) / totalV);
  return 14 + Math.log10((-diff / 1000) / totalV);
}

// Eşdeğerlik hacmi (mL): asit ve baz mol sayıları eşit olduğunda
export function equivalenceVolume(Ca, Va, Cb) {
  return (Ca * Va) / Cb;
}

// pH eğrisi: 0'dan maxV'ye step aralıklarla
export function titrationSeries(Ca, Va, Cb, maxV, step = 0.5) {
  const points = [];
  for (let v = 0; v <= maxV + 1e-9; v += step) {
    points.push({ v: Number(v.toFixed(2)), pH: titrationPH(Ca, Va, Cb, v) });
  }
  return points;
}

// ---------- Fizik: Ohm, direnç, sarkaç, mercek, kinematik, enerji, dalga ----------

// Ohm kanunu: verilen ikisini bilip üçüncüsünü hesaplar (V = I · R).
// Bir parametre null bırakılır; örn. ohm({ voltage: 12, current: null, resistance: 4 }) → akım.
export function ohm({ voltage = null, current = null, resistance = null } = {}) {
  const positive = v => {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return null;
    return Number(v);
  };
  const V = positive(voltage);
  const I = positive(current);
  const R = positive(resistance);
  if (V === null && I !== null && R !== null) return { voltage: I * R, current: I, resistance: R };
  if (I === null && V !== null && R !== null) {
    if (R === 0) throw new Error('Direnç sıfır olamaz (kısa devre).');
    return { voltage: V, current: V / R, resistance: R };
  }
  if (R === null && V !== null && I !== null) {
    if (I === 0) throw new Error('Akım sıfırken direnç hesaplanamaz.');
    return { voltage: V, current: I, resistance: V / I };
  }
  throw new Error('Tam olarak bir değeri boş bırakın.');
}

// Eşdeğer direnç: seri (toplam) ya da paralel (1/Rtoplam = Σ1/Ri).
export function equivalentResistance(values, mode = 'series') {
  const list = (Array.isArray(values) ? values : [values]).map(Number);
  if (!list.length || list.some(n => !Number.isFinite(n) || n < 0)) throw new Error('Geçersiz direnç listesi.');
  if (mode === 'series') return Number(list.reduce((a, b) => a + b, 0).toFixed(6));
  if (mode === 'parallel') {
    if (list.some(n => n === 0)) return 0;
    return Number((1 / list.reduce((a, b) => a + 1 / b, 0)).toFixed(6));
  }
  throw new Error('mode "series" ya da "parallel" olmalı.');
}

// Basit sarkaç periyodu: T = 2π · √(L/g).
export function pendulum(length, g = 9.81) {
  if (!(length > 0) || !(g > 0)) throw new Error('Uzunluk ve yerçekimi sıfırdan büyük olmalı.');
  return Number((2 * Math.PI * Math.sqrt(length / g)).toFixed(4));
}

// İnce kenarlı mercek: 1/f = 1/do + 1/di → görüntü uzaklığı ve büyütme.
export function thinLens(focal, objectDist) {
  if (!(focal > 0)) throw new Error('Odak uzaklığı sıfırdan büyük olmalı.');
  if (!(objectDist > 0)) throw new Error('Nesne uzaklığı sıfırdan büyük olmalı.');
  const denom = 1 / focal - 1 / objectDist;
  const imageDist = denom === 0 ? Infinity : 1 / denom;
  const magnification = objectDist === 0 ? Infinity : -imageDist / objectDist;
  return {
    imageDist: Number.isFinite(imageDist) ? Number(imageDist.toFixed(4)) : Infinity,
    magnification: Number.isFinite(magnification) ? Number(magnification.toFixed(4)) : Infinity,
    real: Number.isFinite(imageDist) && imageDist > 0,
  };
}

// Düzgün ivmeli hareket: v = v0 + a·t, y = v0·t + ½·a·t².
export function uniformlyAccelerated({ v0 = 0, a, t }) {
  if (!Number.isFinite(a) || !Number.isFinite(t) || t < 0) throw new Error('İvme ve süre gerekli.');
  return { velocity: Number((v0 + a * t).toFixed(4)), distance: Number((v0 * t + 0.5 * a * t * t).toFixed(4)) };
}

// Kinetik enerji: E = ½·m·v².
export function kineticEnergy(mass, velocity) {
  if (!(mass >= 0) || !Number.isFinite(velocity)) throw new Error('Geçersiz kütle ya da hız.');
  return Number((0.5 * mass * velocity * velocity).toFixed(4));
}

// Potansiyel enerji: E = m·g·h.
export function potentialEnergy(mass, height, g = 9.81) {
  if (!(mass >= 0) || !(height >= 0)) throw new Error('Kütle ve yükseklik sıfır ya da pozitif olmalı.');
  return Number((mass * g * height).toFixed(4));
}

// Dalga hızı: v = f · λ.
export function waveSpeed(frequency, wavelength) {
  if (!(frequency >= 0) || !(wavelength >= 0)) throw new Error('Frekans ve dalga boyu sıfır ya da pozitif olmalı.');
  return Number((frequency * wavelength).toFixed(4));
}
