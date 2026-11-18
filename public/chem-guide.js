// Kimya rehberli deneyler: adımlar sahnenin anlık durumundan (snapshot) otomatik işaretlenir.
// snapshot = { worn: ['gozluk', ...], lit: bool, tripodOn: bool, tubes: [{ contents: [...], temp: number }] }
// Saf fonksiyonlar: tarayıcı bağımlılığı yok, test edilebilir.

const anyTube = (snap, pred) => (snap.tubes || []).some(pred);
const hasWorn = (snap, key) => (snap.worn || []).includes(key);

export const GUIDES = {
  notr: {
    title: 'Asit–baz nötrleşmesi',
    summary: 'Hidroklorik asit ile sodyum hidroksidi karıştırıp ısı açığa çıktığını gözleyin.',
    steps: [
      { id: 'gozluk', text: 'Koruyucu gözlüğü giyin (Ekipman sekmesi).', check: s => hasWorn(s, 'gozluk') },
      { id: 'eldiven', text: 'Eldiveni giyin.', check: s => hasWorn(s, 'eldiven') },
      { id: 'onluk', text: 'Önlüğü giyin.', check: s => hasWorn(s, 'onluk') },
      { id: 'asit', text: 'Bir tüpe hidroklorik asit dökün.', check: s => anyTube(s, t => t.contents.includes('asit')) },
      { id: 'baz', text: 'Aynı tüpe sodyum hidroksit ekleyin (asit tüpte, baz ekleyin).', check: s => anyTube(s, t => t.contents.includes('asit') && t.contents.includes('baz')) },
      { id: 'isi', text: 'Sıcaklığın yükseldiğini lazerli termometreyle gözleyin.', check: s => anyTube(s, t => t.contents.includes('asit') && t.contents.includes('baz') && t.temp > 25) },
    ],
  },
  kaynama: {
    title: 'Suyun kaynaması ve buharlaşması',
    summary: 'Üçayak ve amyant telini kurup suyu 100 °C\'ye ısıtın; su nasıl buharlaşıyor izleyin.',
    steps: [
      { id: 'gozluk', text: 'Koruyucu gözlüğü giyin.', check: s => hasWorn(s, 'gozluk') },
      { id: 'tripod', text: 'Üç ayaklıyı ocağın üstüne kurun.', check: s => s.tripodOn === true },
      { id: 'yak', text: 'Ocağı kibritle yakın.', check: s => s.lit === true },
      { id: 'su', text: 'Bir tüpe su koyun ve tüpü amyant telinin üstüne yerleştirin.', check: s => anyTube(s, t => t.contents.includes('su')) },
      { id: 'kaynama', text: 'Suyun 100 °C\'ye ulaşıp kaynamasını bekleyin.', check: s => anyTube(s, t => t.contents.includes('su') && t.temp >= 99.5) },
      { id: 'buharlasma', text: 'Suyun tamamen buharlaşmasını gözleyin.', check: s => !anyTube(s, t => t.contents.includes('su')) && s.evaporated === true },
    ],
  },
  metal: {
    title: 'Metal ile asit: hidrojen çıkışı',
    summary: 'Magnezyum şeridi asitle karıştırıp köpüren hidrojen gazını gözleyin.',
    steps: [
      { id: 'gozluk', text: 'Koruyucu gözlüğü giyin.', check: s => hasWorn(s, 'gozluk') },
      { id: 'eldiven', text: 'Eldiveni giyin.', check: s => hasWorn(s, 'eldiven') },
      { id: 'asit', text: 'Bir tüpe hidroklorik asit dökün.', check: s => anyTube(s, t => t.contents.includes('asit')) },
      { id: 'metal', text: 'Aynı tüpe magnezyum şeridi (ya da çinko tozu) ekleyin.', check: s => anyTube(s, t => t.contents.includes('asit') && (t.contents.includes('magnezyum') || t.contents.includes('cinko_toz') || t.contents.includes('el_Zn'))) },
      { id: 'gaz', text: 'Köpüren gazı (hidrojen) gözleyin.', check: s => anyTube(s, t => t.contents.includes('asit') && (t.contents.includes('magnezyum') || t.contents.includes('cinko_toz') || t.contents.includes('el_Zn')) && t.temp > 20.5) },
    ],
  },
};

// Verilen deneyde ilk tamamlanmamış adımı ve tamamlanan adım sayısını döndürür
export function guideProgress(snapshot, key) {
  const guide = GUIDES[key];
  if (!guide) throw new Error('Bilinmeyen deney kılavuzu.');
  const steps = guide.steps.map(step => ({ id: step.id, text: step.text, done: Boolean(step.check(snapshot)) }));
  const done = steps.filter(s => s.done).length;
  const next = steps.find(s => !s.done) ?? null;
  return { title: guide.title, steps, done, total: steps.length, complete: done === steps.length, next: next ? next.id : null };
}
