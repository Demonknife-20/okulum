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
