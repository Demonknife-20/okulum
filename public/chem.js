// Kimya laboratuvarı: 118 element, bileşik tablosu ve birleşme kuralları (tarayıcı bağımlılığı yok).

// [sembol, Türkçe ad, atom numarası, grup (1-18), satır]
const MAIN = [
  ['H', 'Hidrojen', 1, 1, 1], ['He', 'Helyum', 2, 18, 1],
  ['Li', 'Lityum', 3, 1, 2], ['Be', 'Berilyum', 4, 2, 2], ['B', 'Bor', 5, 13, 2], ['C', 'Karbon', 6, 14, 2],
  ['N', 'Azot', 7, 15, 2], ['O', 'Oksijen', 8, 16, 2], ['F', 'Flor', 9, 17, 2], ['Ne', 'Neon', 10, 18, 2],
  ['Na', 'Sodyum', 11, 1, 3], ['Mg', 'Magnezyum', 12, 2, 3], ['Al', 'Alüminyum', 13, 13, 3], ['Si', 'Silisyum', 14, 14, 3],
  ['P', 'Fosfor', 15, 15, 3], ['S', 'Kükürt', 16, 16, 3], ['Cl', 'Klor', 17, 17, 3], ['Ar', 'Argon', 18, 18, 3],
  ['K', 'Potasyum', 19, 1, 4], ['Ca', 'Kalsiyum', 20, 2, 4], ['Sc', 'Skandiyum', 21, 3, 4], ['Ti', 'Titanyum', 22, 4, 4],
  ['V', 'Vanadyum', 23, 5, 4], ['Cr', 'Krom', 24, 6, 4], ['Mn', 'Mangan', 25, 7, 4], ['Fe', 'Demir', 26, 8, 4],
  ['Co', 'Kobalt', 27, 9, 4], ['Ni', 'Nikel', 28, 10, 4], ['Cu', 'Bakır', 29, 11, 4], ['Zn', 'Çinko', 30, 12, 4],
  ['Ga', 'Galyum', 31, 13, 4], ['Ge', 'Germanyum', 32, 14, 4], ['As', 'Arsenik', 33, 15, 4], ['Se', 'Selenyum', 34, 16, 4],
  ['Br', 'Brom', 35, 17, 4], ['Kr', 'Kripton', 36, 18, 4],
  ['Rb', 'Rubidyum', 37, 1, 5], ['Sr', 'Stronsiyum', 38, 2, 5], ['Y', 'İtriyum', 39, 3, 5], ['Zr', 'Zirkonyum', 40, 4, 5],
  ['Nb', 'Niyobyum', 41, 5, 5], ['Mo', 'Molibden', 42, 6, 5], ['Tc', 'Teknesyum', 43, 7, 5], ['Ru', 'Rutenyum', 44, 8, 5],
  ['Rh', 'Rodyum', 45, 9, 5], ['Pd', 'Paladyum', 46, 10, 5], ['Ag', 'Gümüş', 47, 11, 5], ['Cd', 'Kadmiyum', 48, 12, 5],
  ['In', 'İndiyum', 49, 13, 5], ['Sn', 'Kalay', 50, 14, 5], ['Sb', 'Antimon', 51, 15, 5], ['Te', 'Tellür', 52, 16, 5],
  ['I', 'İyot', 53, 17, 5], ['Xe', 'Ksenon', 54, 18, 5],
  ['Cs', 'Sezyum', 55, 1, 6], ['Ba', 'Baryum', 56, 2, 6],
  ['Hf', 'Hafniyum', 72, 4, 6], ['Ta', 'Tantal', 73, 5, 6], ['W', 'Tungsten', 74, 6, 6], ['Re', 'Renyum', 75, 7, 6],
  ['Os', 'Osmiyum', 76, 8, 6], ['Ir', 'İridyum', 77, 9, 6], ['Pt', 'Platin', 78, 10, 6], ['Au', 'Altın', 79, 11, 6],
  ['Hg', 'Cıva', 80, 12, 6], ['Tl', 'Talyum', 81, 13, 6], ['Pb', 'Kurşun', 82, 14, 6], ['Bi', 'Bizmut', 83, 15, 6],
  ['Po', 'Polonyum', 84, 16, 6], ['At', 'Astatin', 85, 17, 6], ['Rn', 'Radon', 86, 18, 6],
  ['Fr', 'Fransiyum', 87, 1, 7], ['Ra', 'Radyum', 88, 2, 7],
  ['Rf', 'Rutherfordiyum', 104, 4, 7], ['Db', 'Dubniyum', 105, 5, 7], ['Sg', 'Seaborgiyum', 106, 6, 7], ['Bh', 'Bohriyum', 107, 7, 7],
  ['Hs', 'Hassiyum', 108, 8, 7], ['Mt', 'Meitneriyum', 109, 9, 7], ['Ds', 'Darmstadtiyum', 110, 10, 7], ['Rg', 'Röntgenyum', 111, 11, 7],
  ['Cn', 'Kopernisyum', 112, 12, 7], ['Nh', 'Nihonyum', 113, 13, 7], ['Fl', 'Flerovyum', 114, 14, 7], ['Mc', 'Moskovyum', 115, 15, 7],
  ['Lv', 'Livermoryum', 116, 16, 7], ['Ts', 'Tenesin', 117, 17, 7], ['Og', 'Oganesson', 118, 18, 7],
];
const LANTHANIDES = [
  ['La', 'Lantan'], ['Ce', 'Seryum'], ['Pr', 'Praseodimyum'], ['Nd', 'Neodimyum'], ['Pm', 'Prometyum'], ['Sm', 'Samaryum'],
  ['Eu', 'Evropiyum'], ['Gd', 'Gadolinyum'], ['Tb', 'Terbiyum'], ['Dy', 'Disprosiyum'], ['Ho', 'Holmiyum'], ['Er', 'Erbiyum'],
  ['Tm', 'Tulyum'], ['Yb', 'İterbiyum'], ['Lu', 'Lutesyum'],
];
const ACTINIDES = [
  ['Ac', 'Aktinyum'], ['Th', 'Toryum'], ['Pa', 'Protaktinyum'], ['U', 'Uranyum'], ['Np', 'Neptünyum'], ['Pu', 'Plütonyum'],
  ['Am', 'Amerikyum'], ['Cm', 'Küriyum'], ['Bk', 'Berkelyum'], ['Cf', 'Kaliforniyum'], ['Es', 'Einsteinyum'], ['Fm', 'Fermiyum'],
  ['Md', 'Mendelevyum'], ['No', 'Nobelyum'], ['Lr', 'Lavrensiyum'],
];

// 1-118 atom numarasına göre sıralı tam liste. Lantanitler 8. satırda, aktinitler 9. satırda, 3-17. sütunlarda.
export const ELEMENTS = [
  ...MAIN,
  ...LANTHANIDES.map(([s, n], i) => [s, n, 57 + i, 3 + i, 8]),
  ...ACTINIDES.map(([s, n], i) => [s, n, 89 + i, 3 + i, 9]),
].sort((a, b) => a[2] - b[2]);

// Bileşik tablosu: bileşim (sembol → adet). Eşleşme bileşime göre yapılır; iki/üç katı da tanınır.
export const COMPOUNDS = [
  { comp: { H: 2 }, formula: 'H2', name: 'Hidrojen gazı' },
  { comp: { O: 2 }, formula: 'O2', name: 'Oksijen gazı' },
  { comp: { O: 3 }, formula: 'O3', name: 'Ozon' },
  { comp: { N: 2 }, formula: 'N2', name: 'Azot gazı' },
  { comp: { Cl: 2 }, formula: 'Cl2', name: 'Klor gazı' },
  { comp: { F: 2 }, formula: 'F2', name: 'Flor gazı' },
  { comp: { Br: 2 }, formula: 'Br2', name: 'Brom (sıvı)' },
  { comp: { I: 2 }, formula: 'I2', name: 'İyot (katı)' },
  { comp: { H: 1, Cl: 1 }, formula: 'HCl', name: 'Tuz ruhu (hidroklorik asit)' },
  { comp: { H: 1, F: 1 }, formula: 'HF', name: 'Hidroflorik asit' },
  { comp: { H: 1, Br: 1 }, formula: 'HBr', name: 'Hidrobromik asit' },
  { comp: { H: 1, I: 1 }, formula: 'HI', name: 'Hidroiyodik asit' },
  { comp: { H: 2, S: 1 }, formula: 'H2S', name: 'Hidrojen sülfür (çürük yumurta kokusu)' },
  { comp: { H: 2, S: 1, O: 4 }, formula: 'H2SO4', name: 'Sülfürik asit (akü asidi)' },
  { comp: { H: 1, N: 1, O: 3 }, formula: 'HNO3', name: 'Nitrik asit (kezzap)' },
  { comp: { H: 3, P: 1, O: 4 }, formula: 'H3PO4', name: 'Fosforik asit (kola asidi)' },
  { comp: { H: 2, C: 1, O: 3 }, formula: 'H2CO3', name: 'Karbonik asit (soda suyu)' },
  { comp: { N: 1, H: 3 }, formula: 'NH3', name: 'Amonyak' },
  { comp: { P: 1, H: 3 }, formula: 'PH3', name: 'Fosfin' },
  { comp: { C: 1, H: 4 }, formula: 'CH4', name: 'Metan (doğalgaz)' },
  { comp: { C: 2, H: 6 }, formula: 'C2H6', name: 'Etan' },
  { comp: { C: 2, H: 4 }, formula: 'C2H4', name: 'Etilen' },
  { comp: { C: 2, H: 2 }, formula: 'C2H2', name: 'Asetilen (kaynak gazı)' },
  { comp: { C: 3, H: 8 }, formula: 'C3H8', name: 'Propan (tüp gazı)' },
  { comp: { C: 1, H: 4, O: 1 }, formula: 'CH4O', name: 'Metanol (odun alkolü)' },
  { comp: { C: 2, H: 6, O: 1 }, formula: 'C2H6O', name: 'Etanol (alkol)' },
  { comp: { C: 1, H: 2, O: 1 }, formula: 'CH2O', name: 'Formaldehit' },
  { comp: { H: 2, O: 1 }, formula: 'H2O', name: 'Su' },
  { comp: { H: 2, O: 2 }, formula: 'H2O2', name: 'Oksijenli su (hidrojen peroksit)' },
  { comp: { C: 1, O: 2 }, formula: 'CO2', name: 'Karbondioksit' },
  { comp: { C: 1, O: 1 }, formula: 'CO', name: 'Karbonmonoksit' },
  { comp: { S: 1, O: 2 }, formula: 'SO2', name: 'Kükürt dioksit' },
  { comp: { S: 1, O: 3 }, formula: 'SO3', name: 'Kükürt trioksit' },
  { comp: { N: 1, O: 1 }, formula: 'NO', name: 'Azot monoksit' },
  { comp: { N: 1, O: 2 }, formula: 'NO2', name: 'Azot dioksit' },
  { comp: { N: 2, O: 1 }, formula: 'N2O', name: 'Gülücü gaz' },
  { comp: { P: 2, O: 5 }, formula: 'P2O5', name: 'Fosfor pentoksit' },
  { comp: { Si: 1, O: 2 }, formula: 'SiO2', name: 'Kum (silisyum dioksit, kuvars)' },
  { comp: { B: 2, O: 3 }, formula: 'B2O3', name: 'Bor oksit' },
  { comp: { Al: 2, O: 3 }, formula: 'Al2O3', name: 'Alüminyum oksit (korund)' },
  { comp: { Fe: 2, O: 3 }, formula: 'Fe2O3', name: 'Pas (demir(III) oksit)' },
  { comp: { Fe: 3, O: 4 }, formula: 'Fe3O4', name: 'Manyetit (demir(II,III) oksit)' },
  { comp: { Cr: 2, O: 3 }, formula: 'Cr2O3', name: 'Krom(III) oksit' },
  { comp: { Mn: 1, O: 2 }, formula: 'MnO2', name: 'Mangan(IV) oksit (pil tozu)' },
  { comp: { Ti: 1, O: 2 }, formula: 'TiO2', name: 'Titanyum dioksit (beyaz boya)' },
  { comp: { Sn: 1, O: 2 }, formula: 'SnO2', name: 'Kalay dioksit' },
  { comp: { Pb: 1, O: 1 }, formula: 'PbO', name: 'Kurşun(II) oksit' },
  { comp: { Cu: 1, O: 1 }, formula: 'CuO', name: 'Bakır(II) oksit' },
  { comp: { Zn: 1, O: 1 }, formula: 'ZnO', name: 'Çinko oksit' },
  { comp: { Hg: 1, O: 1 }, formula: 'HgO', name: 'Cıva(II) oksit' },
  { comp: { Ag: 2, O: 1 }, formula: 'Ag2O', name: 'Gümüş oksit' },
  { comp: { Na: 2, O: 1 }, formula: 'Na2O', name: 'Sodyum oksit' },
  { comp: { K: 2, O: 1 }, formula: 'K2O', name: 'Potasyum oksit' },
  { comp: { Li: 2, O: 1 }, formula: 'Li2O', name: 'Lityum oksit' },
  { comp: { Ca: 1, O: 1 }, formula: 'CaO', name: 'Sönmemiş kireç' },
  { comp: { Mg: 1, O: 1 }, formula: 'MgO', name: 'Magnezyum oksit' },
  { comp: { Ba: 1, O: 1 }, formula: 'BaO', name: 'Baryum oksit' },
  { comp: { Na: 1, Cl: 1 }, formula: 'NaCl', name: 'Sofra tuzu' },
  { comp: { K: 1, Cl: 1 }, formula: 'KCl', name: 'Potasyum klorür' },
  { comp: { Ca: 1, Cl: 2 }, formula: 'CaCl2', name: 'Kalsiyum klorür' },
  { comp: { Mg: 1, Cl: 2 }, formula: 'MgCl2', name: 'Magnezyum klorür (acı tuz)' },
  { comp: { Al: 1, Cl: 3 }, formula: 'AlCl3', name: 'Alüminyum klorür' },
  { comp: { Fe: 1, Cl: 3 }, formula: 'FeCl3', name: 'Demir(III) klorür' },
  { comp: { Cu: 1, Cl: 2 }, formula: 'CuCl2', name: 'Bakır(II) klorür' },
  { comp: { Ag: 1, Cl: 1 }, formula: 'AgCl', name: 'Gümüş klorür' },
  { comp: { Na: 1, F: 1 }, formula: 'NaF', name: 'Sodyum florür (diş macunu)' },
  { comp: { Ca: 1, F: 2 }, formula: 'CaF2', name: 'Florit (kalsiyum florür)' },
  { comp: { Na: 1, Br: 1 }, formula: 'NaBr', name: 'Sodyum bromür' },
  { comp: { K: 1, I: 1 }, formula: 'KI', name: 'Potasyum iyodür' },
  { comp: { Ag: 2, S: 1 }, formula: 'Ag2S', name: 'Gümüş sülfür (gümüş kararması)' },
  { comp: { Fe: 1, S: 1 }, formula: 'FeS', name: 'Demir(II) sülfür' },
  { comp: { Cu: 1, S: 1 }, formula: 'CuS', name: 'Bakır(II) sülfür' },
  { comp: { Zn: 1, S: 1 }, formula: 'ZnS', name: 'Çinko sülfür' },
  { comp: { Na: 2, S: 1, O: 4 }, formula: 'Na2SO4', name: 'Sodyum sülfat' },
  { comp: { Ca: 1, S: 1, O: 4 }, formula: 'CaSO4', name: 'Alçıtaşı (kalsiyum sülfat)' },
  { comp: { Mg: 1, S: 1, O: 4 }, formula: 'MgSO4', name: 'Epsom tuzu (magnezyum sülfat)' },
  { comp: { Na: 1, N: 1, O: 3 }, formula: 'NaNO3', name: 'Güherçile (sodyum nitrat)' },
  { comp: { K: 1, N: 1, O: 3 }, formula: 'KNO3', name: 'Potasyum nitrat (barut bileşeni)' },
  { comp: { Na: 2, C: 1, O: 3 }, formula: 'Na2CO3', name: 'Çamaşır sodası (sodyum karbonat)' },
  { comp: { Na: 1, H: 1, C: 1, O: 3 }, formula: 'NaHCO3', name: 'Kabartma tozu (sodyum bikarbonat)' },
  { comp: { Ca: 1, C: 1, O: 3 }, formula: 'CaCO3', name: 'Kireçtaşı, tebeşir (kalsiyum karbonat)' },
  { comp: { K: 1, Mn: 1, O: 4 }, formula: 'KMnO4', name: 'Potasyum permanganat (dezenfektan)' },
  { comp: { Si: 1, C: 1 }, formula: 'SiC', name: 'Silisyum karbür (zımpara)' },
  { comp: { Ca: 1, C: 2 }, formula: 'CaC2', name: 'Kalsiyum karbür' },
  { comp: { B: 1, N: 1 }, formula: 'BN', name: 'Bor nitrür' },
  { comp: { Na: 1, O: 1, H: 1 }, formula: 'NaOH', name: 'Sud kostik (sodyum hidroksit)' },
  { comp: { K: 1, O: 1, H: 1 }, formula: 'KOH', name: 'Potas (potasyum hidroksit)' },
  { comp: { Ca: 1, O: 2, H: 2 }, formula: 'Ca(OH)2', name: 'Söndürülmüş kireç (kalsiyum hidroksit)' },
  { comp: { Mg: 1, O: 2, H: 2 }, formula: 'Mg(OH)2', name: 'Magnezya sütü (magnezyum hidroksit)' },
  { comp: { Al: 1, O: 3, H: 3 }, formula: 'Al(OH)3', name: 'Alüminyum hidroksit' },
  { comp: { C: 6, H: 12, O: 6 }, formula: 'C6H12O6', name: 'Glikoz (üzüm şekeri)' },
  { comp: { C: 12, H: 22, O: 11 }, formula: 'C12H22O11', name: 'Sofra şekeri (sakkaroz)' },
  { comp: { C: 2, H: 4, O: 2 }, formula: 'C2H4O2', name: 'Asetik asit (sirke)' },
  { comp: { C: 6, H: 8, O: 7 }, formula: 'C6H8O7', name: 'Sitrik asit (limon asidi)' },
  { comp: { C: 6, H: 8, O: 6 }, formula: 'C6H8O6', name: 'C vitamini (askorbik asit)' },
  { comp: { C: 3, H: 8, O: 3 }, formula: 'C3H8O3', name: 'Gliserin' },
  { comp: { C: 6, H: 6 }, formula: 'C6H6', name: 'Benzen' },
  { comp: { C: 1, H: 4, N: 2, O: 1 }, formula: 'CH4N2O', name: 'Üre (idrar bileşeni, gübre)' },
  { comp: { N: 1, H: 4, Cl: 1 }, formula: 'NH4Cl', name: 'Amonyum klorür (salmiak)' },
  { comp: { N: 2, H: 4, O: 3 }, formula: 'NH4NO3', name: 'Amonyum nitrat (gübre)' },
  { comp: { H: 3, B: 1, O: 3 }, formula: 'H3BO3', name: 'Borik asit' },
  { comp: { H: 1, Cl: 1, O: 4 }, formula: 'HClO4', name: 'Perklorik asit' },
  { comp: { C: 2, H: 4, O: 1 }, formula: 'C2H4O', name: 'Asetaldehit' },
  { comp: { C: 3, H: 6, O: 1 }, formula: 'C3H6O', name: 'Aseton (oje sökücü)' },
  { comp: { C: 4, H: 8, O: 1 }, formula: 'C4H8O', name: 'Bütanon (metil etil keton)' },
  { comp: { C: 4, H: 8, O: 2 }, formula: 'C4H8O2', name: 'Etil asetat (oje ve yapıştırıcı çözücüsü)' },
  { comp: { C: 6, H: 6, O: 1 }, formula: 'C6H6O', name: 'Fenol (karbolik asit)' },
  { comp: { C: 7, H: 8 }, formula: 'C7H8', name: 'Toluen' },
  { comp: { C: 8, H: 18 }, formula: 'C8H18', name: 'İzooktan (benzin bileşeni)' },
  { comp: { C: 6, H: 14 }, formula: 'C6H14', name: 'Hekzan' },
  { comp: { N: 2, H: 4 }, formula: 'N2H4', name: 'Hidrazin' },
  { comp: { N: 1, H: 2, O: 1 }, formula: 'NH2OH', name: 'Hidroksilamin' },
  { comp: { C: 3, H: 9, N: 1 }, formula: 'C3H9N', name: 'Trimetilamin' },
  { comp: { S: 2, Cl: 2 }, formula: 'S2Cl2', name: 'Kükürt diklorür' },
  { comp: { S: 8 }, formula: 'S8', name: 'Kükürt (kristal, halkalı)' },
  { comp: { P: 4 }, formula: 'P4', name: 'Beyaz fosfor' },
  { comp: { C: 1, S: 2 }, formula: 'CS2', name: 'Karbon disülfür' },
  { comp: { C: 1, Cl: 4 }, formula: 'CCl4', name: 'Karbon tetraklorür' },
  { comp: { C: 2, Cl: 4 }, formula: 'C2Cl4', name: 'Perkloroetilen (kuru temizleme çözücüsü)' },
];

// ---- Kurallardan üretilen bileşikler: tuzlar (yük dengesi), organik seriler, ek asitler ----
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
// Katyonlar: bileşim, sembol, ad, olası yükler
const CATIONS = [
  { comp: { Li: 1 }, symbol: 'Li', name: 'Lityum', charges: [1] },
  { comp: { Na: 1 }, symbol: 'Na', name: 'Sodyum', charges: [1] },
  { comp: { K: 1 }, symbol: 'K', name: 'Potasyum', charges: [1] },
  { comp: { Rb: 1 }, symbol: 'Rb', name: 'Rubidyum', charges: [1] },
  { comp: { Cs: 1 }, symbol: 'Cs', name: 'Sezyum', charges: [1] },
  { comp: { Ag: 1 }, symbol: 'Ag', name: 'Gümüş', charges: [1], noHydride: true },
  { comp: { N: 1, H: 4 }, symbol: 'NH4', name: 'Amonyum', charges: [1], noHydride: true },
  { comp: { Be: 1 }, symbol: 'Be', name: 'Berilyum', charges: [2] },
  { comp: { Mg: 1 }, symbol: 'Mg', name: 'Magnezyum', charges: [2] },
  { comp: { Ca: 1 }, symbol: 'Ca', name: 'Kalsiyum', charges: [2] },
  { comp: { Sr: 1 }, symbol: 'Sr', name: 'Stronsiyum', charges: [2] },
  { comp: { Ba: 1 }, symbol: 'Ba', name: 'Baryum', charges: [2] },
  { comp: { Zn: 1 }, symbol: 'Zn', name: 'Çinko', charges: [2], noHydride: true },
  { comp: { Cd: 1 }, symbol: 'Cd', name: 'Kadmiyum', charges: [2], noHydride: true },
  { comp: { Al: 1 }, symbol: 'Al', name: 'Alüminyum', charges: [3] },
  { comp: { Ga: 1 }, symbol: 'Ga', name: 'Galyum', charges: [3], noHydride: true },
  { comp: { In: 1 }, symbol: 'In', name: 'İndiyum', charges: [3], noHydride: true },
  { comp: { Sc: 1 }, symbol: 'Sc', name: 'Skandiyum', charges: [3], noHydride: true },
  { comp: { Y: 1 }, symbol: 'Y', name: 'İtriyum', charges: [3], noHydride: true },
  { comp: { La: 1 }, symbol: 'La', name: 'Lantan', charges: [3], noHydride: true },
  { comp: { Fe: 1 }, symbol: 'Fe', name: 'Demir', charges: [2, 3], noHydride: true },
  { comp: { Cu: 1 }, symbol: 'Cu', name: 'Bakır', charges: [1, 2], noHydride: true },
  { comp: { Co: 1 }, symbol: 'Co', name: 'Kobalt', charges: [2, 3], noHydride: true },
  { comp: { Ni: 1 }, symbol: 'Ni', name: 'Nikel', charges: [2], noHydride: true },
  { comp: { Cr: 1 }, symbol: 'Cr', name: 'Krom', charges: [2, 3], noHydride: true },
  { comp: { Mn: 1 }, symbol: 'Mn', name: 'Mangan', charges: [2], noHydride: true },
  { comp: { Sn: 1 }, symbol: 'Sn', name: 'Kalay', charges: [2, 4], noHydride: true },
  { comp: { Pb: 1 }, symbol: 'Pb', name: 'Kurşun', charges: [2, 4], noHydride: true },
  { comp: { Hg: 1 }, symbol: 'Hg', name: 'Cıva', charges: [2], noHydride: true },
  { comp: { Au: 1 }, symbol: 'Au', name: 'Altın', charges: [1, 3], noHydride: true },
  { comp: { Ti: 1 }, symbol: 'Ti', name: 'Titanyum', charges: [2, 3, 4], noHydride: true },
];
// Anyonlar: bileşim, sembol, ad, yük (mutlak değer)
const ANIONS = [
  { comp: { O: 1 }, symbol: 'O', name: 'oksit', charge: 2, mono: true },
  { comp: { S: 1 }, symbol: 'S', name: 'sülfür', charge: 2, mono: true },
  { comp: { F: 1 }, symbol: 'F', name: 'florür', charge: 1, mono: true },
  { comp: { Cl: 1 }, symbol: 'Cl', name: 'klorür', charge: 1, mono: true },
  { comp: { Br: 1 }, symbol: 'Br', name: 'bromür', charge: 1, mono: true },
  { comp: { I: 1 }, symbol: 'I', name: 'iyodür', charge: 1, mono: true },
  { comp: { H: 1 }, symbol: 'H', name: 'hidrür', charge: 1, mono: true, hydride: true },
  { comp: { N: 1, O: 3 }, symbol: 'NO3', name: 'nitrat', charge: 1 },
  { comp: { S: 1, O: 4 }, symbol: 'SO4', name: 'sülfat', charge: 2 },
  { comp: { S: 1, O: 3 }, symbol: 'SO3', name: 'sülfit', charge: 2 },
  { comp: { C: 1, O: 3 }, symbol: 'CO3', name: 'karbonat', charge: 2 },
  { comp: { H: 1, C: 1, O: 3 }, symbol: 'HCO3', name: 'bikarbonat', charge: 1 },
  { comp: { P: 1, O: 4 }, symbol: 'PO4', name: 'fosfat', charge: 3 },
  { comp: { O: 1, H: 1 }, symbol: 'OH', name: 'hidroksit', charge: 1 },
  { comp: { Cl: 1, O: 3 }, symbol: 'ClO3', name: 'klorat', charge: 1 },
  { comp: { Cl: 1, O: 4 }, symbol: 'ClO4', name: 'perklorat', charge: 1 },
  { comp: { Mn: 1, O: 4 }, symbol: 'MnO4', name: 'permanganat', charge: 1 },
  { comp: { C: 2, H: 3, O: 2 }, symbol: 'CH3COO', name: 'asetat', charge: 1 },
  { comp: { C: 1, N: 1 }, symbol: 'CN', name: 'siyanür', charge: 1 },
  { comp: { H: 1, C: 1, O: 2 }, symbol: 'HCOO', name: 'formiat', charge: 1 },
  { comp: { C: 2, O: 4 }, symbol: 'C2O4', name: 'oksalat', charge: 2 },
  { comp: { O: 2 }, symbol: 'O2', name: 'peroksit', charge: 2, mono: true },
  { comp: { Cr: 1, O: 4 }, symbol: 'CrO4', name: 'kromat', charge: 2 },
  { comp: { B: 1, O: 3 }, symbol: 'BO3', name: 'borat', charge: 3 },
  { comp: { C: 2 }, symbol: 'C2', name: 'karbür', charge: 2, mono: true },
  { comp: { I: 1, O: 3 }, symbol: 'IO3', name: 'iyodat', charge: 1 },
  { comp: { Br: 1, O: 3 }, symbol: 'BrO3', name: 'bromat', charge: 1 },
  { comp: { S: 1, C: 1, N: 1 }, symbol: 'SCN', name: 'tiyosiyanat', charge: 1 },
  { comp: { H: 1, S: 1 }, symbol: 'HS', name: 'hidrojen sülfür (hidrosülfür)', charge: 1 },
];

const gcdOf = (a, b) => (b ? gcdOf(b, a % b) : a);
const countAtoms = comp => Object.values(comp).reduce((a, b) => a + b, 0);
const scaleComp = (comp, n) => Object.fromEntries(Object.entries(comp).map(([e, v]) => [e, v * n]));
const mergeComp = (a, b) => combineComp(a, b);

function generatedSalts() {
  const out = [];
  for (const cation of CATIONS) {
    for (const charge of cation.charges) {
      for (const anion of ANIONS) {
        if (anion.hydride && cation.noHydride) continue;
        const g = gcdOf(charge, anion.charge);
        const x = anion.charge / g; // katyon sayısı
        const y = charge / g;       // anyon sayısı
        const comp = mergeComp(scaleComp(cation.comp, x), scaleComp(anion.comp, y));
        const cationPart = (cation.symbol.length > 2 || countAtoms(cation.comp) > 1) && x > 1
          ? `(${cation.symbol})${x}` : `${cation.symbol}${x > 1 ? x : ''}`;
        const anionPart = anion.mono
          ? `${anion.symbol}${y > 1 ? y : ''}`
          : (y > 1 ? `(${anion.symbol})${y}` : anion.symbol);
        const roman = cation.charges.length > 1 ? `(${ROMAN[charge]})` : '';
        out.push({ comp, formula: cationPart + anionPart, name: `${cation.name}${roman} ${anion.name}` });
      }
    }
  }
  return out;
}

function generatedOrganics() {
  const out = [];
  const alkanes = ['Metan', 'Etan', 'Propan', 'Bütan', 'Pentan', 'Hekzan', 'Heptan', 'Oktan', 'Nonan', 'Dekan'];
  alkanes.forEach((name, i) => {
    const n = i + 1;
    out.push({ comp: { C: n, H: 2 * n + 2 }, formula: `C${n}H${2 * n + 2}`, name: `${name} (alkan)` });
  });
  const alkenes = ['Eten (etilen)', 'Propen (propilen)', 'Büten', 'Penten', 'Heksen'];
  alkenes.forEach((name, i) => {
    const n = i + 2;
    out.push({ comp: { C: n, H: 2 * n }, formula: `C${n}H${2 * n}`, name: `${name} (alken)` });
  });
  const alcohols = ['Metanol', 'Etanol', 'Propanol', 'Bütanol', 'Pentanol'];
  alcohols.forEach((name, i) => {
    const n = i + 1;
    out.push({ comp: { C: n, H: 2 * n + 2, O: 1 }, formula: `C${n}H${2 * n + 1}OH`, name: `${name} (alkol)` });
  });
  const acids = ['Formik asit (karınca asidi)', 'Asetik asit (sirke)', 'Propiyonik asit', 'Bütirik asit', 'Valerik asit'];
  acids.forEach((name, i) => {
    const n = i + 1;
    const formula = n === 1 ? 'HCOOH' : `C${n - 1}H${2 * n - 1}COOH`;
    out.push({ comp: { C: n, H: 2 * n, O: 2 }, formula, name: `${name} (karboksilik asit)` });
  });
  out.push({ comp: { H: 1, N: 1, O: 2 }, formula: 'HNO2', name: 'Nitröz asit' });
  out.push({ comp: { H: 2, S: 1, O: 3 }, formula: 'H2SO3', name: 'Sülfüroz asit' });
  out.push({ comp: { H: 1, Cl: 1, O: 1 }, formula: 'HClO', name: 'Hipokloröz asit (çamaşır suyu)' });
  out.push({ comp: { H: 1, Cl: 1, O: 3 }, formula: 'HClO3', name: 'Klorik asit' });
  out.push({ comp: { H: 2, O: 1 }, formula: 'H2O', name: 'Su' });
  return out;
}

// Kopyasız birleşik liste: elle yazılanlar önceliklidir
export const ALL_COMPOUNDS = (() => {
  const seen = new Set();
  const keyOf = comp => Object.keys(comp).sort().map(k => `${k}${comp[k]}`).join('');
  const list = [];
  for (const c of [...COMPOUNDS, ...generatedOrganics(), ...generatedSalts()]) {
    const key = keyOf(c.comp);
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(c);
  }
  return list;
})();

const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
// Formülü alt simgelerle yazar: H2O → H₂O
export function prettyFormula(formula) {
  return formula.replace(/\d/g, d => SUB[d]);
}

// İki parçanın toplam bileşimi
export function combineComp(a, b) {
  const out = { ...a };
  for (const [key, n] of Object.entries(b)) out[key] = (out[key] ?? 0) + n;
  return out;
}

const sameComp = (a, b) => {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
};

// Bileşime karşılık gelen ürün. Tam eşleşme ya da 2–3 katı (örn. 2H₂O).
export function findProduct(comp) {
  const exact = ALL_COMPOUNDS.find(c => sameComp(c.comp, comp));
  if (exact) return { formula: prettyFormula(exact.formula), name: exact.name, count: 1 };
  for (const k of [2, 3]) {
    const values = Object.values(comp);
    if (values.some(v => v % k !== 0)) continue;
    const divided = Object.fromEntries(Object.entries(comp).map(([key, v]) => [key, v / k]));
    const match = ALL_COMPOUNDS.find(c => sameComp(c.comp, divided));
    if (match) return { formula: prettyFormula(match.formula), name: match.name, count: k };
  }
  return null;
}

// Bir öğenin bileşimi: tek atom
export function atomComp(symbol) {
  return { [symbol]: 1 };
}

// Formül metninden bileşim: "C6H12O6", "Ca(OH)2" → { C: 6, H: 12, O: 6 }. Geçersizse hata fırlatır.
export function parseFormulaComp(text) {
  let work = String(text).replace(/\s+/g, '');
  if (!work) throw new Error('Formül boş');
  // Parantezleri aç: (OH)2 → O2H2
  for (let guard = 0; /\([^()]*\)\d*/.test(work) && guard < 10; guard += 1) {
    work = work.replace(/\(([^()]*)\)(\d*)/g, (_, inner, mult) => {
      const factor = mult ? Number(mult) : 1;
      return inner.replace(/([A-Z][a-z]?)(\d*)/g, (m, sym, n) => `${sym}${(n ? Number(n) : 1) * factor}`);
    });
  }
  if (/[()]/.test(work)) throw new Error('Parantez hatalı');
  const comp = {};
  const pattern = /([A-Z][a-z]?)(\d*)/gy;
  let consumed = 0;
  let match;
  while ((match = pattern.exec(work)) !== null) {
    const [whole, symbol, digits] = match;
    if (!ELEMENTS.some(e => e[0] === symbol)) throw new Error(`Bilinmeyen element: ${symbol}`);
    comp[symbol] = (comp[symbol] ?? 0) + (digits ? Number(digits) : 1);
    consumed += whole.length;
  }
  if (consumed !== work.length || !Object.keys(comp).length) throw new Error('Formül anlaşılamadı');
  if (Object.values(comp).reduce((a, b) => a + b, 0) > 40) throw new Error('Bir formülde en fazla 40 atom olabilir');
  return comp;
}

// Parçaların bileşimlerinden hedef bileşimi tam olarak karşılayan alt kümeyi bulur (derinlemesine arama).
function coverTarget(types, target) {
  const keys = Object.keys(target);
  const need = keys.map(k => target[k]);
  const usable = types.filter(t => Object.keys(t.comp).every(k => target[k] !== undefined));
  const failed = new Set();
  const chosen = [];
  const search = (ti, remaining) => {
    if (remaining.every(v => v === 0)) return true;
    if (ti >= usable.length) return false;
    const memoKey = `${ti}:${remaining.join(',')}`;
    if (failed.has(memoKey)) return false;
    const type = usable[ti];
    let maxUse = type.idx.length;
    for (const k of Object.keys(type.comp)) {
      maxUse = Math.min(maxUse, Math.floor(remaining[keys.indexOf(k)] / type.comp[k]));
    }
    for (let m = maxUse; m >= 0; m -= 1) {
      const next = remaining.map((v, j) => v - m * (type.comp[keys[j]] ?? 0));
      if (next.some(v => v < 0)) continue;
      chosen.push({ ti, m });
      if (search(ti + 1, next)) return true;
      chosen.pop();
    }
    failed.add(memoKey);
    return false;
  };
  if (!search(0, need)) return null;
  const indices = [];
  for (const { ti, m } of chosen) indices.push(...usable[ti].idx.slice(0, m));
  return indices;
}

// Parçalar arasında en büyük birleşen alt küme: { indices, comp, product } ya da null
export function bestReaction(comps) {
  if (!comps || comps.length < 2 || comps.length > 40) return null;
  const types = new Map();
  comps.forEach((c, i) => {
    const key = Object.keys(c).sort().map(k => `${k}${c[k]}`).join('');
    if (!types.has(key)) types.set(key, { comp: c, idx: [] });
    types.get(key).idx.push(i);
  });
  const typeList = [...types.values()];
  const available = {};
  for (const c of comps) for (const [e, n] of Object.entries(c)) available[e] = (available[e] ?? 0) + n;
  let best = null;
  for (const compound of ALL_COMPOUNDS) {
    for (const k of [1, 2, 3]) {
      const target = Object.fromEntries(Object.entries(compound.comp).map(([e, n]) => [e, n * k]));
      if (Object.entries(target).some(([e, n]) => (available[e] ?? 0) < n)) continue;
      const atoms = Object.values(target).reduce((a, b) => a + b, 0);
      if (best && atoms <= best.atoms) continue;
      const indices = coverTarget(typeList, target);
      if (indices && indices.length >= 2) {
        best = { indices, comp: target, product: findProduct(target), atoms };
      }
    }
  }
  return best ? { indices: best.indices, comp: best.comp, product: best.product } : null;
}
