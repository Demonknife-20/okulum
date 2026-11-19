// Titrasyon takibi: büret ve pipetle tüpe eklenen mL miktarlarına göre pH ve dönüm noktası.
// labs.js içindeki titrationPH'ı kullanır (saf fonksiyonlar).
import { titrationPH, equivalenceVolume } from './labs.js';

// acid: { ml, molarity } (asit), base: { ml, molarity } (eklenen baz)
export function titrationState({ acidMl, acidM, baseMl, baseM }) {
  if (!(acidMl > 0)) throw new Error('Asit hacmi sıfırdan büyük olmalı.');
  if (!(acidM > 0) || !(baseM > 0)) throw new Error('Derişimler sıfırdan büyük olmalı.');
  if (!(baseMl >= 0)) throw new Error('Eklenen baz hacmi negatif olamaz.');
  const eqMl = equivalenceVolume(acidM, acidMl, baseM);
  const pH = titrationPH(acidM, acidMl, baseM, baseMl);
  const reached = baseMl >= eqMl - 1e-9;
  return {
    pH: Math.round(pH * 100) / 100,
    equivalenceMl: Math.round(eqMl * 100) / 100,
    endpointReached: reached,
    // Dönüm noktasından sonra fenolftaleinin pembeleşmesi beklenir
    phenolphthaleinPink: baseMl > eqMl + 1e-9,
    note: reached ? 'Dönüm noktası: asit tamamen nötrleşti.' : `Dönüm noktasına ${Math.round((eqMl - baseMl) * 100) / 100} mL kaldı.`,
  };
}
