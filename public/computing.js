// Bilgisayar laboratuvarı: sayı sistemleri, mantık kapıları, sıralama adımları (saf fonksiyonlar).

const DIGITS = '0123456789ABCDEF';

// Tabandan ondalığa: parseBase('FF', 16) → 255
export function parseBase(text, base) {
  const value = String(text).trim().toUpperCase();
  if (!value) throw new Error('Sayı boş');
  let result = 0;
  for (const ch of value) {
    const digit = DIGITS.indexOf(ch);
    if (digit < 0 || digit >= base) throw new Error(`"${ch}" bu tabanda geçerli değil`);
    result = result * base + digit;
  }
  return result;
}

// Ondalıktan istenen tabana: toBase(255, 2) → '11111111'
export function toBase(n, base) {
  if (!Number.isInteger(n) || n < 0) throw new Error('Yalnızca sıfır ya da pozitif tam sayılar');
  if (n === 0) return '0';
  let out = '';
  let value = n;
  while (value > 0) {
    out = DIGITS[value % base] + out;
    value = Math.floor(value / base);
  }
  return out;
}

// Mantık ifadesi: AND, OR, XOR, NOT, NAND, NOR; değişkenler tek harf (A-H), parantez desteklenir.
// Değerlendirme eval kullanmaz: küçük bir ayrıştırıcı ile yapılır.
export function evalLogic(expression, values) {
  const tokens = String(expression).toUpperCase().match(/AND|OR|XOR|NOT|NAND|NOR|[A-H]|\(|\)|\s+/g);
  if (!tokens || tokens.join('').replace(/\s+/g, '') !== String(expression).toUpperCase().replace(/\s+/g, '')) {
    throw new Error('İfade anlaşılamadı. Kullanılabilir: A–H, AND, OR, XOR, NOT, NAND, NOR, parantez');
  }
  const list = tokens.filter(t => !/^\s+$/.test(t));
  let i = 0;
  const peek = () => list[i];
  const take = () => list[i++];
  const parseOr = () => {
    let left = parseAnd();
    while (peek() === 'OR' || peek() === 'XOR' || peek() === 'NOR') {
      const op = take();
      const right = parseAnd();
      left = op === 'OR' ? left || right : op === 'XOR' ? left !== right : !(left || right);
    }
    return left;
  };
  const parseAnd = () => {
    let left = parseUnary();
    while (peek() === 'AND' || peek() === 'NAND') {
      const op = take();
      const right = parseUnary();
      left = op === 'AND' ? left && right : !(left && right);
    }
    return left;
  };
  const parseUnary = () => {
    if (peek() === 'NOT') { take(); return !parseUnary(); }
    if (peek() === '(') {
      take();
      const inner = parseOr();
      if (take() !== ')') throw new Error('Parantez kapanmadı');
      return inner;
    }
    const name = take();
    if (!name || !/^[A-H]$/.test(name)) throw new Error('Değişken bekleniyordu');
    if (!(name in values)) throw new Error(`${name} için değer verilmedi`);
    return Boolean(values[name]);
  };
  const result = parseOr();
  if (i !== list.length) throw new Error('İfadenin sonunda fazla öğe var');
  return result;
}

// Doğruluk tablosu: değişkenlerin tüm kombinasyonları
export function truthTable(expression) {
  // Yalnızca tek başına duran harfler değişkendir (AND içindeki D değil)
  const vars = [...new Set(String(expression).toUpperCase().match(/(?<![A-Z])[A-H](?![A-Z])/g) ?? [])].sort();
  const rows = [];
  const total = 2 ** vars.length;
  for (let mask = 0; mask < total; mask += 1) {
    const values = {};
    vars.forEach((v, idx) => { values[v] = Boolean(mask & (1 << (vars.length - 1 - idx))); });
    rows.push({ values, result: evalLogic(expression, values) });
  }
  return { vars, rows };
}

// Kabarcık sıralama: her adımda karşılaştırılan iki indeks ve dizinin durumu
export function bubbleSortSteps(input) {
  const arr = [...input];
  const steps = [{ array: [...arr], compare: null, swapped: false }];
  for (let pass = 0; pass < arr.length; pass += 1) {
    let swapped = false;
    for (let j = 0; j < arr.length - pass - 1; j += 1) {
      const swap = arr[j] > arr[j + 1];
      steps.push({ array: [...arr], compare: [j, j + 1], swapped: false });
      if (swap) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        swapped = true;
        steps.push({ array: [...arr], compare: [j, j + 1], swapped: true });
      }
    }
    if (!swapped) break;
  }
  steps.push({ array: [...arr], compare: null, swapped: false, done: true });
  return steps;
}

// ---------- Sayı sistemleri II: ASCII, RGB ve ikili toplama ----------

// Metinden ikili: her karakterin Unicode kod noktası 8 bitlik gruplara ayrılır.
export function textToBinary(text, bits = 8) {
  const out = [];
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    out.push(toBase(code, 2).padStart(bits, '0'));
  }
  return out.join(' ');
}

// İkili metne: boşlukla ayrılmış bit gruplarını çözer.
export function binaryToText(bits) {
  const groups = String(bits).trim().split(/\s+/).filter(Boolean);
  let out = '';
  for (const g of groups) {
    if (!/^[01]+$/.test(g)) throw new Error(`Geçersiz ikili grup: ${g}`);
    out += String.fromCodePoint(parseBase(g, 2));
  }
  return out;
}

// Onaltılık rengi RGB'ye: 'FF8800' → { r: 255, g: 136, b: 0 }.
export function hexToRgb(hex) {
  let value = String(hex).trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(value)) value = value.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) throw new Error('Geçersiz HEX (örn. #RRGGBB).');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

// RGB'den onaltılıya: (255, 136, 0) → 'FF8800'.
export function rgbToHex(r, g, b) {
  const channel = v => {
    if (!Number.isInteger(v) || v < 0 || v > 255) throw new Error('Her kanal 0-255 tam sayı olmalı.');
    return toBase(v, 16).padStart(2, '0');
  };
  return `${channel(r)}${channel(g)}${channel(b)}`;
}

// İki ikili sayının toplanması: sonuç ve her sütunun girişi/eldesi adım adım gösterilir.
export function binaryAdd(a, b) {
  const valid = s => /^[01]+$/.test(String(s));
  const x = String(a), y = String(b);
  if (!valid(x) || !valid(y)) throw new Error('Yalnızca 0 ve 1 kullanılabilir.');
  const len = Math.max(x.length, y.length);
  const px = x.padStart(len, '0'), py = y.padStart(len, '0');
  let carry = 0;
  const bits = [];
  const steps = [];
  for (let i = len - 1; i >= 0; i -= 1) {
    const carryIn = carry;
    const total = Number(px[i]) + Number(py[i]) + carryIn;
    const sum = total % 2;
    carry = Math.floor(total / 2);
    bits.unshift(String(sum));
    steps.push({ position: len - i, a: px[i], b: py[i], carryIn, sum, carryOut: carry });
  }
  if (carry) bits.unshift('1');
  return { result: bits.join(''), carryOut: Boolean(carry), steps };
}
