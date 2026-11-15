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

// Düzgün ivmemi hareket: v = v0 + a·t, y = v0·t + ½·a·t².
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

// ---------- Fizik: yoğunluk, basınç, itkinin Kuvveti, iş, güç, momentum, yay, kondansator, RC devresi ----------

// Yoğunluk: ρ = m / V (kg/m³)
export function density(mass, volume) {
  if (mass <= 0) throw new Error('Kütle sıfırdan büyük olmalı.');
  if (volume <= 0) throw new Error('Hacim sıfırdan büyük olmalı.');
  return Number((mass / volume).toFixed(4));
}

// Basınç: P = F / A (Pa)
export function pressure(force, area) {
  if (!(area > 0)) throw new Error('Alan sıfırdan büyük olmalı.');
  return Number((force / area).toFixed(4));
}

// Itkinin Kuvveti: Fb = ρ · V · g (N)
export function buoyancy(fluidDensity, volume, g = 9.81) {
  if (!(fluidDensity > 0)) throw new Error('Sıvı yoğunluğu pozitif olmalı.');
  if (!(volume > 0)) throw new Error('Hacim pozitif olmalı.');
  if (!(g > 0)) throw new Error('Yerçekimi ivmesi pozitif olmalı.');
  return Number((fluidDensity * volume * g).toFixed(4));
}

// İş: W = F · d · cos(θ) (J)
export function work(force, distance, angleDeg) {
  if (!(distance >= 0)) throw new Error('Mesafe negatif olamaz.');
  const theta = (angleDeg * Math.PI) / 180;
  return Number((force * distance * Math.cos(theta)).toFixed(4));
}

// Güç: P = W / t (W)
export function power(work, time) {
  if (!(time > 0)) throw new Error('Süre sıfırdan büyük olmalı.');
  return Number((work / time).toFixed(4));
}

// Momentum: p = m · v (kg·m/s)
export function momentum(mass, velocity) {
  if (!(mass >= 0)) throw new Error('Kütle negatif olamaz.');
  return Number((mass * velocity).toFixed(4));
}

// Yay Kuvveti (Hooke): F = k · x, mutlak değer (N)
export function springForce(k, x) {
  if (!(k > 0)) throw new Error('Yay sabiti pozitif olmalı.');
  if (x === 0) throw new Error('Deformasyon pozitif ya da negatif olmalı, sıfır olamaz.');
  return Number(Math.abs(k * x).toFixed(4));
}

// Kondansator Şarjı: Q = C · V (C)
export function capacitorCharge(c, v) {
  if (!(c > 0)) throw new Error('Kapasitans pozitif olmalı.');
  if (!(v > 0)) throw new Error('Gerilim pozitif olmalı.');
  return Number((c * v).toFixed(4));
}

// RC Devresi Kondansator Gerilimi: Vc = V · (1 - e^(-t/RC)), V = 1 varsayılır
export function rcCircuit(r, c, t, v = 1) {
  if (!(r > 0)) throw new Error('Direnç pozitif olmalı.');
  if (!(c > 0)) throw new Error('Kapasitans pozitif olmalı.');
  if (!(t > 0)) throw new Error('Zaman pozitif olmalı.');
  if (!(v > 0)) throw new Error('Voltaj pozitif olmalı.');
  const val = v * (1 - Math.exp(-t / (r * c)));
  return Number(val.toFixed(6));
}

// Fotosentez oranı: ışık, CO2 ve sıcaklık etkisi (basitleştirilmiş model, 0-100 arası)
// Işık ve CO2 saturasyon eğrisi, sıcaklık için optimal 25°C civarı Gauss
export function photosynthesis(light, co2, temp) {
  if (light < 0) throw new Error('Işık yoğunluğu negatif olamaz.');
  if (co2 <= 0) throw new Error('CO2 konsantrasyonu pozitif olmalı.');
  if (!(temp >= -10 && temp <= 50)) throw new Error('Sıcaklık -10 ile 50 °C arasında olmalı.');
  const lightFactor = light / (light + 200); // saturasyon
  const co2Factor = co2 / (co2 + 400); // saturasyon
  const tempFactor = Math.exp(-((temp - 25) ** 2) / 200); // optimal 25°C
  return Number((100 * lightFactor * co2Factor * tempFactor).toFixed(2));
}

// Hücre döngüsü: verilen aşamada süre oranı (dakika)
// Aşamalar: G1, S, G2, M (mitoz)
export function cellCycle(phase, duration) {
  if (!(duration > 0)) throw new Error('Toplam süre sıfırdan büyük olmalı.');
  const phases = { G1: 0.45, S: 0.35, G2: 0.10, M: 0.10 };
  const p = String(phase).toUpperCase().replace('MITOZ', 'M');
  if (!(p in phases)) throw new Error('Aşama boş olamaz: G1, S, G2 veya M olmalı.');
  const stageNames = { G1: 'G1 (hücre büyümesi)', S: 'S (DNA sentezi)', G2: 'G2 (hazırlık)', M: 'M (mitoz)' };
  return {
    phase: String(phase).toLowerCase(),
    duration: duration,
    stages: Object.entries(phases).map(([name, ratio]) => ({
      name: stageNames[name],
      minutes: Number((duration * ratio).toFixed(2)),
      percent: Number((ratio * 100).toFixed(1)),
    })),
  };
}

// Punnett kartosu: iki ebeveyn genotipti (örn. Aa x Aa) → genotip oranları
// Basit tek-lokuslu, tam egemen model
export function punnettSquare(parent1, parent2) {
  const parse = gt => {
    const m = String(gt).trim().match(/^([A-Za-z])([A-Za-z])$/);
    if (!m) throw new Error('genotip iki harfli olmalı (örn. Aa, aa, AA).');
    return [m[1], m[2]];
  };
  const g1 = parse(parent1);
  const g2 = parse(parent2);
  const gametes1 = g1[0] === g1[1] ? [g1[0]] : g1;
  const gametes2 = g2[0] === g2[1] ? [g2[0]] : g2;
  const grid = [];
  for (const a of gametes1) {
    const row = [];
    for (const b of gametes2) {
      row.push([a, b].sort().join(''));
    }
    grid.push(row);
  }
  const counts = {};
  for (const row of grid) for (const o of row) counts[o] = (counts[o] || 0) + 1;
  const total = grid.flat().length;
  const genotypeRatios = {};
  for (const [genotype, count] of Object.entries(counts)) {
    genotypeRatios[genotype] = Number(((count / total) * 100).toFixed(2)) / 100;
  }
  return { grid, genotypeRatios };
}

// Hedef kalp atış hızı: yaş ve dinamik hıza göre (Karvonen formülü)
// rest: dinlenme kalp atışı (dk⁻¹), age: yaş
export function heartRate(age, rest) {
  if (!(age > 0 && age <= 120)) throw new Error('yaş sıfırdan büyük olmalı.');
  if (!(rest > 0 && rest <= 220)) throw new Error('Dinlenme hızı sıfırdan büyük olmalı.');
  const max = 220 - age;
  const reserve = max - rest;
  if (reserve <= 0) throw new Error('Dinlenme hızı maksimum hızdan büyük olamaz.');
  return {
    min: Number((rest + 0.5 * reserve).toFixed(0)),
    max: Number((rest + 0.85 * reserve).toFixed(0)),
    targetMin: Number((rest + 0.5 * reserve).toFixed(0)),
    targetMax: Number((rest + 0.85 * reserve).toFixed(0)),
    maxHeartRate: max,
  };
}

// Enzim aktivitesi: sıcaklık ve pH etkisi (basitleştirilmiş, 0-1 arası)
// Optimal sıcaklık 37°C, optimal pH 7.4; her iki eksen de Gauss daraltma
export function enzymeActivity(temp, ph) {
  if (!(temp > 0 && temp <= 100)) throw new Error('sıcaklık sıfırdan büyük ve 100\'den küçük olmalı.');
  if (!(ph > 0 && ph <= 14)) throw new Error('pH sıfırdan büyük ve 14\'ten küçük olmalı.');
  const t = Number(temp);
  const p = Number(ph);
  const tScore = Math.exp(-((t - 37) ** 2) / 200);
  const pScore = Math.exp(-((p - 7.4) ** 2) / 8);
  const activity = Number((tScore * pScore).toFixed(4));
  const result = { activity };
  Object.defineProperty(result, 'valueOf', {
    value: () => activity,
    writable: false,
    configurable: true,
  });
  return result;
}

// Elektrik devresi simülasyonu (Ohm kanunu)
// Seri direnç: R_eq = R1 + R2 + ... + Rn
export function seriesResistance(values) {
  if (!Array.isArray(values) || values.length === 0) throw new Error('Direnç değerleri boş olamaz.');
  return values.reduce((sum, r) => sum + r, 0);
}

// Paralel direnç: 1/R_eq = 1/R1 + 1/R2 + ... + 1/Rn
export function parallelResistance(values) {
  if (!Array.isArray(values) || values.length === 0) throw new Error('Direnç değerleri boş olamaz.');
  const sum = values.reduce((acc, r) => acc + 1 / r, 0);
  return 1 / sum;
}

// Ohm kanunu hesaplama: V = I * R, I = V / R, R = V / I
export function ohmLaw({ voltage, current, resistance }) {
  const known = [voltage, current, resistance].filter(v => v !== undefined && v !== null).length;
  if (known !== 2) throw new Error('Ohm kanunu için tam olarak iki değer girilmeli.');
  if (voltage !== undefined && current !== undefined) {
    return { voltage, current, resistance: voltage / current };
  }
  if (voltage !== undefined && resistance !== undefined) {
    return { voltage, current: voltage / resistance, resistance };
  }
  if (current !== undefined && resistance !== undefined) {
    return { voltage: current * resistance, current, resistance };
  }
  throw new Error('Geçersiz kombinasyon.');
}

// Basit DC devre analizi: voltage source + resistors (series/parallel)
export function analyzeCircuit(voltage, resistors, mode = 'series') {
  const eqResistance = mode === 'series' ? seriesResistance(resistors) : parallelResistance(resistors);
  const totalCurrent = voltage / eqResistance;
  const power = voltage * totalCurrent;
  return {
    equivalentResistance: eqResistance,
    totalCurrent,
    voltage,
    power,
    mode,
  };
}

// DNA replikasyonu görselleştirme helper
export function dnaReplication(template) {
  const complement = { A: 'T', T: 'A', G: 'C', C: 'G' };
  const templateUpper = template.toUpperCase();
  if (!/^[ATGC]+$/.test(templateUpper)) throw new Error('Geçersiz DNA dizisi. Sadece A, T, G, C kullanılabilir.');
  const newStrand = templateUpper.split('').map(base => complement[base]).join('');
  return {
    original: templateUpper,
    complement: newStrand,
    length: templateUpper.length,
    gcContent: ((templateUpper.match(/[GC]/g) || []).length / templateUpper.length * 100).toFixed(2),
  };
}

// DNA base pairing visualizer
export function visualizeBasePairs(sequence1, sequence2) {
  const pairs = { 'A-T': true, 'T-A': true, 'G-C': true, 'C-G': true };
  const s1 = sequence1.toUpperCase();
  const s2 = sequence2.toUpperCase();
  if (s1.length !== s2.length) throw new Error('Diziler eşit uzunlukta olmalı.');
  const results = [];
  for (let i = 0; i < s1.length; i++) {
    const pair = `${s1[i]}-${s2[i]}`;
    results.push({
      position: i + 1,
      base1: s1[i],
      base2: s2[i],
      valid: pairs[pair] || false,
      pair,
    });
  }
  return {
    sequence1: s1,
    sequence2: s2,
    length: s1.length,
    pairs: results,
    validPairs: results.filter(r => r.valid).length,
    invalidPairs: results.filter(r => !r.valid).length,
  };
}

// Enzyme activity with temperature and pH optimization
export function enzymeKinetics(temp, ph, substrateConcentration, vmax = 100, km = 5) {
  const tempFactor = Math.exp(-Math.pow((temp - 37) / 10, 2));
  const phFactor = Math.exp(-Math.pow((ph - 7.4) / 1.5, 2));
  const michaelisMenten = (vmax * substrateConcentration) / (km + substrateConcentration);
  const activity = michaelisMenten * tempFactor * phFactor;
  return {
    activity: Number(activity.toFixed(4)),
    tempFactor: Number(tempFactor.toFixed(4)),
    phFactor: Number(phFactor.toFixed(4)),
    michaelisMenten: Number(michaelisMenten.toFixed(4)),
    optimalTemp: 37,
    optimalPh: 7.4,
  };
}