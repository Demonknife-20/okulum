// Biyoloji laboratuvarı: mikroskop görüntüsü için saf üretim (test edilebilir).

// Tohumlu rastgele sayı üreteci: aynı tohum her zaman aynı hücre alanını verir
export function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Mikroskop alanı: büyütmeye göre hücre boyutu ve sayısı değişir.
// Büyütme: objektif × okülerin (10x) çarpımı. Dönüş: alan genişliği (µm) ve hücreler.
export function microscopeField({ objective, seed = 7, eyepiece = 10 }) {
  const total = objective * eyepiece;
  const fieldUm = Math.round(2000 / objective); // düşük büyütmede geniş alan
  const rand = seededRandom(seed);
  const count = Math.max(4, Math.round(60 / (objective / 40)));
  const cells = [];
  for (let i = 0; i < count; i += 1) {
    cells.push({
      x: rand(),
      y: rand(),
      r: 0.04 + rand() * 0.05,
      nucleus: rand() < 0.9,
      tone: rand(),
    });
  }
  return { total, fieldUm, cells };
}
