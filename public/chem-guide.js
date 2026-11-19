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
  titrasyon: {
    title: 'Titrasyon: asit ve bazı dönüm noktasında bulma',
    summary: 'Bir tüpteki asidi büretle damla damla baz ile nötrleştirin; fenolftalein dönüm noktasında pembeleşir.',
    steps: [
      { id: 'ekipman', text: 'Gözlük, eldiven ve önlüğü giyin.', check: s => ['gozluk', 'eldiven', 'onluk'].every(k => hasWorn(s, k)) },
      { id: 'asit', text: 'Bir tüpe 20 mL hidroklorik asit ekleyin.', check: s => anyTube(s, t => t.contents.includes('asit') && (t.amounts?.asit ?? 0) >= 20) },
      { id: 'indikator', text: 'Aynı tüpe fenolftalein damlatın (indikatör).', check: s => anyTube(s, t => t.contents.includes('asit') && t.contents.includes('fenolftalein')) },
      { id: 'buret', text: 'Büreti alıp sodyum hidroksit ile doldurun, sonra tüpe tıklayarak damlatın.', check: s => anyTube(s, t => t.contents.includes('asit') && (t.amounts?.baz ?? 0) > 0) },
      { id: 'donum', text: 'Dönüm noktasına yaklaşın: 20 mL baz eklendiğinde asit nötrleşir.', check: s => anyTube(s, t => (t.amounts?.baz ?? 0) >= 19) },
      { id: 'pembe', text: 'Renk değişimini izleyin: fenolftalein pembeleşti.', check: s => anyTube(s, t => t.contents.includes('baz') && t.contents.includes('fenolftalein') && (t.amounts?.baz ?? 0) > 20) },
    ],
  },
  karbonat: {
    title: 'Kireç taşı ile asit: karbondioksit çıkışı',
    summary: 'Kalsiyum karbonat tozunu asitle karıştırın; köpüren karbondioksit gazını gözleyin.',
    steps: [
      { id: 'gozluk', text: 'Gözlük ve eldiveni giyin.', check: s => hasWorn(s, 'gozluk') && hasWorn(s, 'eldiven') },
      { id: 'asit', text: 'Bir tüpe asit dökün.', check: s => anyTube(s, t => t.contents.includes('asit')) },
      { id: 'tozu', text: 'Aynı tüpe kalsiyum karbonat (kireç tozu) ekleyin.', check: s => anyTube(s, t => t.contents.includes('asit') && t.contents.includes('kalsiyum_karbonat')) },
      { id: 'kopuk', text: 'Köpüren gazı (CO₂) gözleyin.', check: s => anyTube(s, t => t.contents.includes('asit') && t.contents.includes('kalsiyum_karbonat') && t.temp > 20.5) },
    ],
  },
  bakir: {
    title: 'Çinko ile bakır sülfat: bakırın çökmesi',
    summary: 'Bakır(II) sülfat çözeltisine çinko tozu ekleyin; metalik bakır çöker.',
    steps: [
      { id: 'gozluk', text: 'Gözlük ve eldiveni giyin.', check: s => hasWorn(s, 'gozluk') && hasWorn(s, 'eldiven') },
      { id: 'sulfat', text: 'Bir tüpe bakır(II) sülfat çözeltisi koyun.', check: s => anyTube(s, t => t.contents.includes('bakir_sulfat')) },
      { id: 'cinko', text: 'Aynı tüpe çinko tozu ekleyin.', check: s => anyTube(s, t => t.contents.includes('bakir_sulfat') && t.contents.includes('cinko_toz')) },
      { id: 'cokme', text: 'Bakırın çöktüğünü gözleyin.', check: s => anyTube(s, t => t.contents.includes('bakir_sulfat') && t.contents.includes('cinko_toz') && t.temp > 20.5) },
    ],
  },
  magnezyum: {
    title: 'Magnezyumun yanması (ısıtma)',
    summary: 'Magnezyum şeridi üçayak üzerinde ısıtın; parlak beyaz alevle yandığını gözleyin. Gözlük zorunlu.',
    steps: [
      { id: 'gozluk', text: 'Koruyucu gözlüğü giyin (alev parlar).', check: s => hasWorn(s, 'gozluk') },
      { id: 'tripod', text: 'Üç ayaklıyı ocağın üstüne kurun.', check: s => s.tripodOn === true },
      { id: 'yak', text: 'Ocağı kibritle yakın.', check: s => s.lit === true },
      { id: 'mg', text: 'Bir tüpe magnezyum şeridi koyup amyant telinin üstüne yerleştirin.', check: s => anyTube(s, t => t.contents.includes('magnezyum')) },
      { id: 'yanma', text: 'Sıcaklık 470 °C\'yi geçince magnezyumun yanmasını izleyin.', check: s => anyTube(s, t => t.contents.includes('magnezyum') && t.temp >= 470) },
    ],
  },
  yag: {
    title: 'Yağ ve su: karışmama',
    summary: 'Zeytinyağı ile suyu karıştırın; yağın suyun üstünde ayrı bir tabaka oluşturduğunu gözleyin.',
    steps: [
      { id: 'ekipman', text: 'Gözlük ve önlüğü giyin.', check: s => hasWorn(s, 'gozluk') && hasWorn(s, 'onluk') },
      { id: 'su', text: 'Bir tüpe su koyun.', check: s => anyTube(s, t => t.contents.includes('su')) },
      { id: 'yag', text: 'Aynı tüpe zeytinyağı ekleyin.', check: s => anyTube(s, t => t.contents.includes('su') && t.contents.includes('yag')) },
      { id: 'tabaka', text: 'Yağın suyun üstünde tabaka oluşturduğunu gözleyin.', check: s => anyTube(s, t => t.contents.includes('su') && t.contents.includes('yag')) },
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
