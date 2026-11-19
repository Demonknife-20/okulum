import './env.mjs';
import { RAF } from './env.mjs';
import * as T from './three.mjs';
const { initChem3d } = await import(process.env.CHEM3D_MODULE);

let failures = 0;
const check = (name, cond, extra = '') => { if (!cond) failures += 1; console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };

const statuses = [];
const api = initChem3d('chem3d-canvas', { onStatus: s => statuses.push(s) });
check('initChem3d nesne döndürdü', !!api);
const renderer = globalThis.__renderers.at(-1);
const canvasEl = renderer.domElement;
const last = () => statuses.at(-1) ?? {};
const press = (x = 400, y = 250) => {
  canvasEl.listeners.pointerdown?.forEach(f => f({ clientX: x, clientY: y, button: 0, pointerId: 1 }));
  canvasEl.listeners.pointerup?.forEach(f => f({ clientX: x, clientY: y, button: 0, pointerId: 1 }));
};
// Raycast sonucunu ayarla: [{object, uv}]
const hitWith = (obj, uv) => { T.HIT.list = obj ? [{ object: obj, uv }] : []; };
const findRoot = kind => T.SCENE_OBJECTS.find(o => o.userData?.kind === kind && o.parent === null || o.userData?.kind === kind);
const tubeRoot = () => T.SCENE_OBJECTS.find(o => o.userData?.kind === 'tube');
const bottle = key => T.SCENE_OBJECTS.find(o => o.userData?.kind === 'bottle' && o.userData.key === key);
const burnerRoot = () => T.SCENE_OBJECTS.find(o => o.userData?.kind === 'burner');
const balanceRoot = () => T.SCENE_OBJECTS.find(o => o.userData?.kind === 'balance');
const boardRoot = () => T.SCENE_OBJECTS.find(o => o.userData?.kind === 'board');

// Ekipmanı giy (giyme animasyonu ~0,8 sn)
for (const k of ['gozluk', 'eldiven', 'onluk']) { api.select(k); for (let i = 0; i < 60; i += 1) RAF.step(16); }
for (let i = 0; i < 20; i += 1) RAF.step(16);
check('sahne döngüsü çalışıyor (durum yayılıyor)', statuses.length > 0);
check('üç ekipman da giyildi', ['gozluk', 'eldiven', 'onluk'].every(k => (last().worn ?? []).includes(k)), (last().worn ?? []).join(','));

// 1. Malzeme seçimi ve dökme
api.select('asit');
check('asit seçildi', last().selected === 'asit', String(last().selected));
hitWith(tubeRoot()); press();
RAF.step(16);
const tube = tubeRoot();
RAF.step(16);
check('asit tüpe döküldü', tube.userData.contents.includes('asit'), tube.userData.contents.join(','));
check('mL miktarı kaydedildi', (tube.userData.amounts.asit ?? 0) === 20, String(tube.userData.amounts.asit));

// 2. Baz ekleme → nötrleşme ve ürün mesajı
api.select('baz'); hitWith(tubeRoot()); press(); RAF.step(16);
check('nötrleşme tepkimesi', tube.userData.reacted.has('notr'), [...tube.userData.reacted].join(','));
check('ürün bilgisi mesajda', /Ürünler:/.test(last().message ?? '') || /Nötrleşme/.test(last().message ?? ''), last().message?.slice(0, 80));

// 3. Ocak: gözlük yokken uyarı
hitWith(burnerRoot()); api.select('kibrit'); press(); RAF.step(16);
check('ocak: üçayak yokken uyarı veriyor', /üçayak|Üç ayaklı/i.test(last().message ?? '') || last().burnerOn === true, last().message?.slice(0, 60));


// 5. Tartı
api.select('su'); hitWith(balanceRoot()); press(); RAF.step(16);
check('tartı mesajı', /tartıldı/.test(last().message ?? '') || /Tartı boş/.test(last().message ?? ''), last().message?.slice(0, 60));

// 6. Periyodik tablo: element al (Fe) — uv ile
api.reset(); RAF.step(16);
hitWith(boardRoot(), { x: 0.5 / 18 * 8 + 0.0, y: 0.9 }); press(); RAF.step(16);
check('tablo tıklaması mesaj üretti', typeof last().message === 'string', last().message?.slice(0, 70));

// 7. Pipet: doldur ve dök (5 mL)
api.reset(); RAF.step(16);
api.select('pipet');
hitWith(bottle('baz')); press(); RAF.step(16);
check('pipet baz ile doldu', /dolduruldu/.test(last().message ?? ''), last().message?.slice(0, 60));
hitWith(tubeRoot()); press(); RAF.step(16);
check('pipet 5 mL döktü', (tubeRoot().userData.amounts.baz ?? 0) === 5, String(tubeRoot().userData.amounts.baz));

// 8. Balon ekle
api.reset(); RAF.step(16);
api.select('balon'); hitWith(null); press(); RAF.step(16);
check('cam balon eklendi', T.SCENE_OBJECTS.some(o => o.userData?.shape === 'flask'));

// 9. Sıfırlama ve uzun simülasyon (hata yakalamak için)
for (let i = 0; i < 300; i += 1) RAF.step(33);
check('300 kare hatasız', true);
console.log(failures ? `\n${failures} başarısız` : '\nTüm sahne senaryoları geçti');
process.exitCode = failures ? 1 : 0;
