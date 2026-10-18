// GeoGebra benzeri grafik aracı: nokta, doğru, ışın, parça, fonksiyon. Harici betik ve eval kullanmaz.

const COLORS = ['#1b6b50', '#e5484d', '#3e7cf0', '#f5b93a', '#8b5cf6', '#e8590c', '#0d9488', '#be185d'];
const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp, floor: Math.floor, ceil: Math.ceil,
};
const CONSTANTS = { pi: Math.PI, e: Math.E };
const COMMANDS = {
  'doğru': 'line', dogru: 'line', line: 'line',
  'ışın': 'ray', 'işin': 'ray', isin: 'ray', ray: 'ray',
  'parça': 'segment', parca: 'segment', segment: 'segment',
  'çember': 'circle', cember: 'circle', circle: 'circle',
  'açı': 'angle', aci: 'angle', angle: 'angle',
  'orta': 'midpoint', midpoint: 'midpoint',
  'kesişim': 'intersect', kesisim: 'intersect', intersect: 'intersect',
  dik: 'perp', perp: 'perp',
  paralel: 'parallel', parallel: 'parallel',
  'uzaklık': 'distance', uzaklik: 'distance', distance: 'distance',
};
const LINE_KINDS = ['line', 'ray', 'segment'];

// ---------- İfade ayrıştırıcı (eval yok) ----------
function tokenize(source) {
  const text = String(source);
  const pattern = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_]\w*)|(\*\*|[-+*/^(),]))/y;
  const tokens = [];
  let pos = 0;
  while (pos < text.length) {
    if (text.slice(pos).trim() === '') break;
    pattern.lastIndex = pos;
    const match = pattern.exec(text);
    if (!match) throw new Error(`Anlaşılmayan karakter: "${text.slice(pos).trim()[0]}"`);
    pos = pattern.lastIndex;
    if (match[1] !== undefined) tokens.push({ t: 'num', v: Number(match[1]) });
    else if (match[2] !== undefined) tokens.push({ t: 'id', v: match[2] });
    else tokens.push({ t: 'op', v: match[3] === '**' ? '^' : match[3] });
  }
  return tokens;
}

function parseExpression(source) {
  const tokens = tokenize(source);
  let i = 0;
  const isOp = v => tokens[i] && tokens[i].t === 'op' && tokens[i].v === v;
  const expect = v => {
    if (!isOp(v)) throw new Error(`"${v}" bekleniyordu`);
    i += 1;
  };
  const implicitStart = () => tokens[i] && (tokens[i].t === 'num' || tokens[i].t === 'id' || isOp('('));

  function primary() {
    const tok = tokens[i];
    if (!tok) throw new Error('İfade eksik');
    if (tok.t === 'num') { i += 1; return { num: tok.v }; }
    if (isOp('(')) {
      i += 1;
      const node = expr();
      expect(')');
      return node;
    }
    if (tok.t === 'id') {
      i += 1;
      if (isOp('(')) {
        i += 1;
        const arg = expr();
        expect(')');
        if (!Object.hasOwn(FUNCS, tok.v)) throw new Error(`Bilinmeyen fonksiyon: ${tok.v}`);
        return { fn: tok.v, a: arg };
      }
      if (tok.v === 'x') return { x: true };
      if (Object.hasOwn(CONSTANTS, tok.v)) return { num: CONSTANTS[tok.v] };
      if (Object.hasOwn(FUNCS, tok.v)) return { fn: tok.v, a: unary() };
      throw new Error(`Bilinmeyen değişken: ${tok.v}`);
    }
    throw new Error(`Beklenmeyen: "${tok.v}"`);
  }
  function power() {
    const base = primary();
    if (isOp('^')) {
      i += 1;
      return { op: '^', a: base, b: unary() };
    }
    return base;
  }
  function unary() {
    if (isOp('-')) { i += 1; return { neg: unary() }; }
    if (isOp('+')) { i += 1; return unary(); }
    return power();
  }
  function term() {
    let node = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = tokens[i].v;
        i += 1;
        node = { op, a: node, b: unary() };
      } else if (implicitStart()) {
        node = { op: '*', a: node, b: unary() };
      } else {
        return node;
      }
    }
  }
  function expr() {
    let node = term();
    while (isOp('+') || isOp('-')) {
      const op = tokens[i].v;
      i += 1;
      node = { op, a: node, b: term() };
    }
    return node;
  }

  if (tokens.length === 0) throw new Error('İfade boş');
  const root = expr();
  if (i < tokens.length) throw new Error(`Fazla ifade: "${tokens[i].v}"`);
  return root;
}

export function compileExpression(source) {
  const root = parseExpression(source);
  const evaluate = (node, x) => {
    if (node.num !== undefined) return node.num;
    if (node.x) return x;
    if (node.neg !== undefined) return -evaluate(node.neg, x);
    if (node.fn) return FUNCS[node.fn](evaluate(node.a, x));
    const a = evaluate(node.a, x);
    const b = evaluate(node.b, x);
    switch (node.op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return a / b;
      case '^': return a ** b;
      default: throw new Error('Bilinmeyen işlem');
    }
  };
  return x => evaluate(root, x);
}

function topLevelComma(text) {
  let depth = 0;
  for (let k = 0; k < text.length; k += 1) {
    if (text[k] === '(') depth += 1;
    else if (text[k] === ')') depth -= 1;
    else if (text[k] === ',' && depth === 1) return k;
  }
  return -1;
}

function parsePointLiteral(rhs) {
  const inner = rhs.slice(1, -1);
  const comma = topLevelComma(`(${inner})`);
  if (comma < 0) throw new Error('Nokta için (x, y) biçiminde yazın');
  const left = inner.slice(0, comma - 1);
  const right = inner.slice(comma);
  const parts = [left, right].map(part => {
    if (/\bx\b/.test(part)) throw new Error('Nokta koordinatında x kullanılamaz');
    return compileExpression(part)(0);
  });
  if (!parts.every(Number.isFinite)) throw new Error('Nokta koordinatı geçersiz');
  return parts;
}

// Komut satırı: "Doğru(A,B)", "l=Işın(A,B)", "s=Parça(A,B)"
export function parseCommand(line) {
  const match = /^\s*(?:([A-Za-z]\w*)\s*=\s*)?([A-Za-zÇĞİÖŞÜçğıöşü]+)\s*\(\s*([A-Za-z]\w*)\s*,\s*([A-Za-z]\w*)\s*(?:,\s*([A-Za-z]\w*)\s*)?\)\s*$/.exec(String(line));
  if (!match) return null;
  const kind = COMMANDS[match[2].toLocaleLowerCase('tr-TR')];
  if (!kind) throw new Error(`Bilinmeyen komut: ${match[2]}`);
  const hasThird = match[5] !== undefined;
  if (kind === 'angle' && !hasThird) throw new Error('Açı için üç nokta gerekir: Açı(kenar, köşe, kenar)');
  if (kind !== 'angle' && hasThird) throw new Error(`${match[2]} en fazla iki nokta alır`);
  return { kind, name: match[1] || null, a: match[3], b: match[4], c: match[5] || null };
}

// Bir satırı ayrıştırır: nokta "A=(1,2)", fonksiyon "f(x)=x^2", komut "l=Doğru(A,B)"
export function parseLine(line, fallbackName = 'f') {
  const text = String(line).trim();
  if (!text) return null;
  const command = parseCommand(text);
  if (command) return { type: 'cmd', ...command, text };
  let name = null;
  let rhs = text;
  const eq = text.indexOf('=');
  if (eq > 0) {
    const lhs = text.slice(0, eq).trim();
    rhs = text.slice(eq + 1).trim();
    if (/^[A-Za-z]\w*$/.test(lhs)) name = lhs;
    else if (/^[a-z]\w*\(x\)$/.test(lhs)) name = lhs.replace(/\(x\)$/, '');
    else if (lhs === 'y') name = fallbackName;
    else throw new Error('Sol taraf geçersiz');
  }
  if (rhs.startsWith('(') && rhs.endsWith(')') && topLevelComma(rhs) > 0) {
    const [px, py] = parsePointLiteral(rhs);
    return { type: 'pt', name: name || 'P', x: px, y: py, text };
  }
  const fn = compileExpression(rhs);
  return { type: 'fn', name: name || fallbackName, expr: rhs, fn, text };
}

// İki nokta arasındaki uzaklık (ölçüm etiketi için)
export function distanceBetween(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// Doğru nesnelerinin iki noktası: doğru/ışın/parça için iki nokta; dik ve paralel doğrular için nokta + yön
export function lineGeometry(object, points, objects) {
  if (object.kind === 'perp' || object.kind === 'parallel') {
    const p = points.get(object.a);
    const reference = objects.find(o => o.name === object.b && LINE_KINDS.includes(o.kind));
    if (!p || !reference) return null;
    const r1 = points.get(reference.a);
    const r2 = points.get(reference.b);
    if (!r1 || !r2) return null;
    let dx = r2.x - r1.x;
    let dy = r2.y - r1.y;
    if (Math.hypot(dx, dy) < 1e-12) return null;
    if (object.kind === 'perp') [dx, dy] = [-dy, dx];
    return [[p.x, p.y], [p.x + dx, p.y + dy]];
  }
  const a = points.get(object.a);
  const b = points.get(object.b);
  if (!a || !b) return null;
  return [[a.x, a.y], [b.x, b.y]];
}

// Türetilmiş noktanın koordinatı: Orta(A,B) ya da Kesişim(a,b)
export function derivedPoint(command, points, objects) {
  if (command.kind === 'midpoint') {
    const a = points.get(command.a);
    const b = points.get(command.b);
    if (!a || !b) throw new Error(`Nokta tanımlı değil: ${!a ? command.a : command.b}`);
    return [(a.x + b.x) / 2, (a.y + b.y) / 2];
  }
  const first = objects.find(o => o.name === command.a && LINE_KINDS.includes(o.kind));
  const second = objects.find(o => o.name === command.b && LINE_KINDS.includes(o.kind));
  if (!first || !second) throw new Error('Kesişim için iki doğru, ışın ya da parça seçin');
  const p1 = points.get(first.a);
  const p2 = points.get(first.b);
  const p3 = points.get(second.a);
  const p4 = points.get(second.b);
  if (!p1 || !p2 || !p3 || !p4) throw new Error('Doğruların nokta tanımları eksik');
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) throw new Error('Paralel doğrular kesişmez');
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  return [p1.x + t * d1x, p1.y + t * d1y];
}

// Satır listesinden nesne modeli: noktalar, doğrular, ışınlar, parçalar, fonksiyonlar
export function buildModel(lines) {
  const points = new Map();
  const objects = [];
  const errors = [];
  let fnCount = 0;
  lines.forEach((line, row) => {
    try {
      const result = parseLine(line, ['f', 'g', 'h', 'k'][fnCount % 4]);
      if (!result) return;
      if (result.type === 'pt') {
        points.set(result.name, { kind: 'point', name: result.name, x: result.x, y: result.y, row });
      } else if (result.type === 'cmd' && result.kind === 'distance') {
        objects.push({ kind: 'distance', name: result.name || `#${row}`, a: result.a, b: result.b, row });
      } else if (result.type === 'cmd' && (result.kind === 'perp' || result.kind === 'parallel')) {
        const object = { kind: result.kind, name: result.name || `#${row}`, a: result.a, b: result.b, row };
        objects.push(object);
        if (!lineGeometry(object, points, objects)) {
          objects.pop();
          throw new Error(`${result.kind === 'perp' ? 'Dik' : 'Paralel'} için önce bir nokta ve bir doğru seçin`);
        }
      } else if (result.type === 'cmd' && (result.kind === 'midpoint' || result.kind === 'intersect')) {
        if (!result.name) throw new Error(`${result.kind === 'midpoint' ? 'Orta' : 'Kesişim'} için bir ad verin (ör. M=...)`);
        const [dx, dy] = derivedPoint(result, points, objects);
        points.set(result.name, { kind: 'point', name: result.name, x: dx, y: dy, row, derived: true });
      } else if (result.type === 'cmd') {
        objects.push({ kind: result.kind, name: result.name || `#${row}`, a: result.a, b: result.b, c: result.c, row });
      } else {
        fnCount += 1;
        objects.push({ kind: 'fn', name: result.name, expr: result.expr, fn: result.fn, row });
      }
    } catch (error) {
      errors[row] = error.message;
    }
  });
  for (const object of objects) {
    if (object.kind === 'fn' || object.kind === 'perp' || object.kind === 'parallel') continue;
    for (const key of ['a', 'b', 'c']) {
      if (object[key] === null || object[key] === undefined) continue;
      if (!points.has(object[key])) errors[object.row] = `Nokta tanımlı değil: ${object[key]}`;
    }
  }
  return { points, objects, errors };
}

function formatCoord(value) {
  const rounded = Math.abs(value) < 1e-9 ? 0 : Number(value.toFixed(2));
  return String(rounded);
}

// Doğrunun denklemi: "y = 2x + 1" ya da dikey doğru için "x = 3"
export function lineEquation(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (Math.abs(dx) < 1e-9) return `x = ${formatCoord(a[0])}`;
  const m = dy / dx;
  const c = a[1] - m * a[0];
  if (Math.abs(m) < 1e-9) return `y = ${formatCoord(c)}`;
  const slope = m === 1 ? 'x' : m === -1 ? '-x' : `${formatCoord(m)}x`;
  const intercept = Math.abs(c) < 1e-9 ? '' : c > 0 ? ` + ${formatCoord(c)}` : ` - ${formatCoord(-c)}`;
  return `y = ${slope}${intercept}`;
}

// B köşesindeki açı (derece)
export function angleDegrees(a, b, c) {
  const ux = a[0] - b[0];
  const uy = a[1] - b[1];
  const vx = c[0] - b[0];
  const vy = c[1] - b[1];
  const nu = Math.hypot(ux, uy);
  const nv = Math.hypot(vx, vy);
  if (nu < 1e-12 || nv < 1e-12) return NaN;
  const cos = Math.min(1, Math.max(-1, (ux * vx + uy * vy) / (nu * nv)));
  return Math.acos(cos) * 180 / Math.PI;
}

export function niceStep(unit) {
  const base = 10 ** Math.floor(Math.log10(unit));
  for (const multiple of [1, 2, 5, 10]) {
    if (multiple * base >= unit) return multiple * base;
  }
  return 10 * base;
}

// Ad üretimi: noktalar A..Z, doğrular a..z (kullanılmayanın ilki)
function freeName(used, letters) {
  for (const letter of letters) {
    if (!used.has(letter)) return letter;
  }
  for (let n = 1; n < 1000; n += 1) {
    for (const letter of letters) {
      if (!used.has(`${letter}${n}`)) return `${letter}${n}`;
    }
  }
  throw new Error('Ad kalmadı');
}

const POINT_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LINE_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

export function mountGraph(root, initial = { lines: [] }, options = {}) {
  root.innerHTML = `<div class="gx">
    <div class="gx-side">
      <div class="gx-head"><strong>Cebir</strong><button type="button" class="btn ghost sm" data-gx="add">+ Satır</button></div>
      <div class="gx-rows" data-gx="rows"></div>
      <p class="gx-help">Örnekler: <code>A=(1,2)</code>, <code>B=(3,1)</code>, <code>d=Doğru(A,B)</code>, <code>s=Parça(A,B)</code>, <code>f(x)=x^2-4</code>.</p>
    </div>
    <div class="gx-main">
      <div class="gx-tools" role="toolbar" aria-label="Çizim araçları">
        <button type="button" class="gx-tool on" data-tool="move" title="Taşı ve kaydır">Taşı</button>
        <button type="button" class="gx-tool" data-tool="point" title="Nokta">Nokta</button>
        <button type="button" class="gx-tool" data-tool="line" title="Doğru (iki nokta)">Doğru</button>
        <button type="button" class="gx-tool" data-tool="ray" title="Işın (iki nokta)">Işın</button>
        <button type="button" class="gx-tool" data-tool="segment" title="Parça (iki nokta)">Parça</button>
        <button type="button" class="gx-tool" data-tool="circle" title="Çember (merkez, çevre noktası)">Çember</button>
        <button type="button" class="gx-tool" data-tool="angle" title="Açı (kenar, köşe, kenar)">Açı</button>
        <button type="button" class="gx-tool" data-tool="midpoint" title="Orta nokta (iki nokta)">Orta</button>
        <button type="button" class="gx-tool" data-tool="perp" title="Dik doğru: önce doğruyu, sonra noktayı seçin">Dik</button>
        <button type="button" class="gx-tool" data-tool="parallel" title="Paralel doğru: önce doğruyu, sonra noktayı seçin">Paralel</button>
        <button type="button" class="gx-tool" data-tool="delete" title="Nesneyi sil">Sil</button>
        <button type="button" class="gx-tool" data-tool="distance" title="Uzaklık: iki nokta seçin, ölçüm yazılır">Uzaklık</button>
        <span class="gx-sep"></span>
        <button type="button" class="gx-tool on" data-gx="axes" aria-pressed="true">Eksenler</button>
        <button type="button" class="gx-tool" data-gx="png">PNG indir</button>
        <span class="gx-sep"></span>
        <button type="button" class="gx-tool" data-gx="zoomin" aria-label="Yakınlaştır">+</button>
        <button type="button" class="gx-tool" data-gx="zoomout" aria-label="Uzaklaştır">−</button>
        <button type="button" class="gx-tool" data-gx="reset">Sıfırla</button>
        <span class="gx-hint" data-gx="hint">Taşı: noktayı sürükleyin, boş alanı sürükleyerek kaydırın</span>
      </div>
      <div class="gx-canvas-wrap"><canvas data-gx="canvas" aria-label="Grafik alanı"></canvas></div>
    </div>
  </div>`;
  const readOnly = Boolean(options.readOnly);
  let lines = (initial.lines || []).map(line => String(line));
  if (!lines.length) lines = [''];
  const view = { cx: 0, cy: 0, scale: 50 };
  const canvas = root.querySelector('[data-gx="canvas"]');
  const ctx = canvas.getContext('2d');
  const rowsEl = root.querySelector('[data-gx="rows"]');
  const hintEl = root.querySelector('[data-gx="hint"]');
  let model = buildModel(lines);
  let tool = 'move';
  let pending = [];     // çok noktalı araçlarda seçilen nokta adları
  let cursor = null;    // dünya koordinatında imleç (önizleme için)
  let drag = null;
  let drawQueued = false;
  let showAxes = true;
  const colorOf = index => COLORS[index % COLORS.length];
  const hints = {
    move: 'Taşı: noktayı sürükleyin, boş alanı sürükleyerek kaydırın',
    point: 'Nokta: istediğiniz yere tıklayın',
    line: 'Doğru: iki nokta seçin (boş yere tıklarsanız yeni nokta oluşur)',
    ray: 'Işın: başlangıç ve yön noktasını seçin',
    segment: 'Parça: iki uç noktasını seçin',
    circle: 'Çember: merkezi, sonra çevredeki bir noktayı seçin',
    angle: 'Açı: bir kenar, köşe, diğer kenar noktasını sırayla seçin',
    midpoint: 'Orta nokta: iki nokta seçin, ortalarına yeni nokta oluşur',
    distance: 'Uzaklık: iki nokta seçin, aralarındaki uzaklık yazılır',
    perp: 'Dik doğru: önce bir doğru seçin, sonra noktayı seçin',
    parallel: 'Paralel doğru: önce bir doğru seçin, sonra noktayı seçin',
    delete: 'Sil: silmek istediğiniz nesneye tıklayın',
  };

  const emit = () => { if (options.onChange) options.onChange(lines.slice()); };
  const scheduleDraw = () => {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(draw);
  };
  const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function rebuild(fromInput) {
    model = buildModel(lines);
    if (fromInput) updateErrors(); else renderRows();
    scheduleDraw();
  }

  function renderRows() {
    rowsEl.innerHTML = lines.map((line, index) => `<div class="gx-row" data-index="${index}">
        <span class="gx-dot" style="background:${colorOf(index)}"></span>
        <input class="gx-input" value="${escapeHtml(line)}" ${readOnly ? 'readonly' : ''} aria-label="Satır ${index + 1}">
        ${readOnly ? '' : '<button type="button" class="gx-del" data-gx="del" aria-label="Satırı sil">×</button>'}
        ${model.errors[index] ? `<small class="gx-error">${escapeHtml(model.errors[index])}</small>` : ''}
      </div>`).join('') || '<p class="gx-empty">Bir ifade ya da nokta yazın.</p>';
  }

  function updateErrors() {
    rowsEl.querySelectorAll('.gx-row').forEach((row, index) => {
      row.querySelector('.gx-error')?.remove();
      if (model.errors[index]) {
        const note = document.createElement('small');
        note.className = 'gx-error';
        note.textContent = model.errors[index];
        row.appendChild(note);
      }
    });
  }

  // Dünya ↔ ekran dönüşümleri
  const size = () => {
    const dpr = window.devicePixelRatio || 1;
    return { dpr, w: canvas.width / dpr, h: canvas.height / dpr };
  };
  const toScreen = (x, y, w, h) => [w / 2 + (x - view.cx) * view.scale, h / 2 - (y - view.cy) * view.scale];
  const toWorld = (px, py, w, h) => [view.cx + (px - w / 2) / view.scale, view.cy - (py - h / 2) / view.scale];

  function resolvePoint(name) {
    const point = model.points.get(name);
    return point ? [point.x, point.y] : null;
  }

  // Ekrandaki noktalara tıklama toleransı: 10 piksel
  function hitPoint(px, py) {
    const { w, h } = size();
    let best = null;
    let bestDistance = 10;
    for (const point of model.points.values()) {
      const [sx, sy] = toScreen(point.x, point.y, w, h);
      const distance = Math.hypot(sx - px, sy - py);
      if (distance <= bestDistance) { best = point; bestDistance = distance; }
    }
    return best;
  }

  function hitObject(px, py) {
    const { w, h } = size();
    const point = hitPoint(px, py);
    if (point) return { kind: 'point', name: point.name, row: point.row };
    let best = null;
    let bestDistance = 8;
    for (const object of model.objects) {
      if (object.kind === 'fn') {
        const wx = toWorld(px, py, w, h)[0];
        try {
          const y = object.fn(wx);
          if (!Number.isFinite(y)) continue;
          const [, sy] = toScreen(wx, y, w, h);
          const distance = Math.abs(sy - py);
          if (distance < bestDistance) { best = object; bestDistance = distance; }
        } catch { /* yok say */ }
        continue;
      }
      if (object.kind === 'circle') {
        const center = resolvePoint(object.a);
        const through = resolvePoint(object.b);
        if (!center || !through) continue;
        const [ccx, ccy] = toScreen(center[0], center[1], w, h);
        const [ctx2, cty] = toScreen(through[0], through[1], w, h);
        const radius = Math.hypot(ctx2 - ccx, cty - ccy);
        const distance = Math.abs(Math.hypot(px - ccx, py - ccy) - radius);
        if (distance < bestDistance) { best = object; bestDistance = distance; }
        continue;
      }
      if (object.kind === 'angle') continue;
      const geometry = lineGeometry(object, model.points, model.objects);
      if (!geometry) continue;
      const [a, b] = geometry;
      const [ax, ay] = toScreen(a[0], a[1], w, h);
      const [bx, by] = toScreen(b[0], b[1], w, h);
      const distance = distanceToSegmentOrLine(px, py, ax, ay, bx, by, object.kind);
      if (distance < bestDistance) { best = object; bestDistance = distance; }
    }
    return best;
  }

  function distanceToSegmentOrLine(px, py, ax, ay, bx, by, kind) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    if (kind === 'segment') t = Math.min(1, Math.max(0, t));
    else if (kind === 'ray') t = Math.max(0, t);
    return Math.hypot(ax + t * dx - px, ay + t * dy - py);
  }

  // Sonsuz doğru/ışın uçlarını görünür alanın dışına taşır
  function lineEndpoints(kind, a, b, w, h) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (length < 1e-12) return null;
    const ux = dx / length;
    const uy = dy / length;
    const reach = (Math.hypot(w, h) / view.scale) * 2 + Math.hypot(a[0] - view.cx, a[1] - view.cy) + 1;
    if (kind === 'segment') return [a, b];
    if (kind === 'ray') return [a, [a[0] + ux * reach, a[1] + uy * reach]];
    return [[a[0] - ux * reach, a[1] - uy * reach], [a[0] + ux * reach, a[1] + uy * reach]];
  }

  function draw() {
    drawQueued = false;
    const { dpr, w, h } = size();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    drawGrid(w, h);
    model.objects.forEach((object, index) => {
      const color = colorOf(object.row ?? index);
      if (object.kind === 'fn') drawFunction(object, color, w, h);
      else if (object.kind === 'circle') drawCircle(object, color, w, h);
      else if (object.kind === 'angle') drawAngle(object, color, w, h);
      else if (object.kind === 'distance') drawDistance(object, color, w, h);
      else drawLine(object, color, w, h);
    });
    if (pending.length && cursor && tool !== 'move' && tool !== 'delete' && tool !== 'point') {
      const from = resolvePoint(pending[pending.length - 1]);
      if (from) {
        const [ax, ay] = toScreen(from[0], from[1], w, h);
        const [cx, cy] = toScreen(cursor[0], cursor[1], w, h);
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = '#6b7f76';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(cx, cy); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    for (const point of model.points.values()) drawPoint(point, w, h);
  }

  function drawGrid(w, h) {
    const left = view.cx - w / 2 / view.scale;
    const right = view.cx + w / 2 / view.scale;
    const bottom = view.cy - h / 2 / view.scale;
    const top = view.cy + h / 2 / view.scale;
    const step = niceStep(80 / view.scale);
    ctx.font = '12px system-ui, sans-serif';
    ctx.lineWidth = 1;
    for (let gx = Math.ceil(left / step) * step; gx <= right; gx += step) {
      const [sx] = toScreen(gx, 0, w, h);
      ctx.strokeStyle = showAxes && Math.abs(gx) < step / 2 ? '#7c8f86' : '#e4ece8';
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();
      if (Math.abs(gx) > step / 2) {
        const [, sy] = toScreen(0, 0, w, h);
        ctx.fillStyle = '#6b7f76';
        ctx.fillText(formatCoord(gx), sx + 4, Math.min(Math.max(sy + 14, 12), h - 4));
      }
    }
    for (let gy = Math.ceil(bottom / step) * step; gy <= top; gy += step) {
      const [, sy] = toScreen(0, gy, w, h);
      ctx.strokeStyle = showAxes && Math.abs(gy) < step / 2 ? '#7c8f86' : '#e4ece8';
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke();
      if (Math.abs(gy) > step / 2) {
        const [sx] = toScreen(0, 0, w, h);
        ctx.fillStyle = '#6b7f76';
        ctx.fillText(formatCoord(gy), Math.min(Math.max(sx + 4, 4), w - 40), sy - 4);
      }
    }
  }

  function drawFunction(object, color, w, h) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    let started = false;
    let previous = null;
    for (let px = 0; px <= w; px += 1) {
      const x = view.cx + (px - w / 2) / view.scale;
      let y;
      try { y = object.fn(x); } catch { y = NaN; }
      if (!Number.isFinite(y)) { started = false; previous = null; continue; }
      const [sx, sy] = toScreen(x, y, w, h);
      if (previous !== null && Math.abs(sy - previous) > h) started = false;
      if (!started) { ctx.moveTo(sx, sy); started = true; } else { ctx.lineTo(sx, sy); }
      previous = sy;
    }
    ctx.stroke();
    // Ad etiketi: eğri üzerinde ekranın dörtte üçünde
    const labelX = view.cx + (w * 0.25 - w / 2) / view.scale;
    const labelY = object.fn(labelX);
    if (Number.isFinite(labelY)) {
      const [lx, ly] = toScreen(labelX, labelY, w, h);
      if (ly > 14 && ly < h - 4) labelAt(`${object.name}(x)=${object.expr}`, lx + 8, ly - 8, color);
    }
  }

  function drawLine(object, color, w, h) {
    const geometry = lineGeometry(object, model.points, model.objects);
    if (!geometry) return;
    const [a, b] = geometry;
    const ends = lineEndpoints(object.kind, a, b, w, h);
    if (!ends) return;
    const [sa, sb] = ends.map(([x, y]) => toScreen(x, y, w, h));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(sa[0], sa[1]); ctx.lineTo(sb[0], sb[1]); ctx.stroke();
    // Ad: görünür kısmın orta noktasına yakın, doğru/ışın üzerinde
    const labelPoint = object.kind === 'segment'
      ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      : nearestOnLine(object.kind, a, b, [view.cx, view.cy]);
    const [lx, ly] = toScreen(labelPoint[0], labelPoint[1], w, h);
    if (lx > 0 && lx < w && ly > 0 && ly < h) labelAt(`${object.name}: ${lineEquation(a, b)}`, lx + 8, ly - 8, color);
  }

  function drawCircle(object, color, w, h) {
    const center = resolvePoint(object.a);
    const through = resolvePoint(object.b);
    if (!center || !through) return;
    const [cx, cy] = toScreen(center[0], center[1], w, h);
    const [tx, ty] = toScreen(through[0], through[1], w, h);
    const radius = Math.hypot(tx - cx, ty - cy);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    const worldRadius = Math.hypot(through[0] - center[0], through[1] - center[1]);
    const angle = -Math.PI / 4;
    labelAt(`${object.name}: r = ${formatCoord(worldRadius)}`, cx + Math.cos(angle) * radius + 6, cy + Math.sin(angle) * radius - 6, color);
  }

  function drawDistance(object, color, w, h) {
    const a = resolvePoint(object.a);
    const b = resolvePoint(object.b);
    if (!a || !b) return;
    const [ax, ay] = toScreen(a[0], a[1], w, h);
    const [bx, by] = toScreen(b[0], b[1], w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.setLineDash([]);
    const length = distanceBetween({ x: a[0], y: a[1] }, { x: b[0], y: b[1] });
    labelAt(`${object.name} = ${formatCoord(length)}`, (ax + bx) / 2 + 8, (ay + by) / 2 - 8, color);
  }

  function drawAngle(object, color, w, h) {
    const a = resolvePoint(object.a);
    const b = resolvePoint(object.b);
    const c = resolvePoint(object.c);
    if (!a || !b || !c) return;
    const [ax, ay] = toScreen(a[0], a[1], w, h);
    const [bx, by] = toScreen(b[0], b[1], w, h);
    const [cx, cy] = toScreen(c[0], c[1], w, h);
    const start = Math.atan2(ay - by, ax - bx);
    const end = Math.atan2(cy - by, cx - bx);
    let diff = end - start;
    while (diff <= -Math.PI) diff += 2 * Math.PI;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    const radius = 34;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bx, by, radius, start, start + diff, diff < 0); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ax, ay); ctx.moveTo(bx, by); ctx.lineTo(cx, cy); ctx.stroke();
    ctx.setLineDash([]);
    const degrees = angleDegrees(a, b, c);
    const mid = start + diff / 2;
    labelAt(`${object.name}: ${formatCoord(degrees)}°`, bx + Math.cos(mid) * (radius + 20), by + Math.sin(mid) * (radius + 20), color);
  }

  function nearestOnLine(kind, a, b, target) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1;
    let t = ((target[0] - a[0]) * dx + (target[1] - a[1]) * dy) / len2;
    if (kind === 'ray') t = Math.max(0, t);
    return [a[0] + t * dx, a[1] + t * dy];
  }

  function drawPoint(point, w, h) {
    const index = point.row ?? 0;
    const [sx, sy] = toScreen(point.x, point.y, w, h);
    ctx.fillStyle = colorOf(index);
    ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    labelAt(point.name, sx + 8, sy - 8, '#11231d');
  }

  function labelAt(text, x, y, color) {
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const width = ctx.measureText(text).width;
    ctx.fillRect(x - 3, y - 13, width + 6, 17);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function setTool(next) {
    tool = next;
    pending = [];
    cursor = null;
    root.querySelectorAll('[data-tool]').forEach(button => button.classList.toggle('on', button.dataset.tool === next));
    hintEl.textContent = hints[next] || '';
    scheduleDraw();
  }

  function nextPointName() {
    return freeName(new Set(model.points.keys()), POINT_LETTERS);
  }

  function nextLineName() {
    const used = new Set(model.objects.map(o => o.name));
    return freeName(used, LINE_LETTERS);
  }

  // Yeni nokta satırı ekler (fare ile tıklanan yere)
  function addPointAt(wx, wy) {
    const name = nextPointName();
    lines.push(`${name}=(${formatCoord(wx)},${formatCoord(wy)})`);
    rebuild(false);
    emit();
    return name;
  }

  // Tıklanan yerde nokta varsa onu, yoksa yeni noktayı döndürür
  function pointUnder(px, py) {
    const point = hitPoint(px, py);
    if (point) return point.name;
    const { w, h } = size();
    const [wx, wy] = toWorld(px, py, w, h);
    return addPointAt(wx, wy);
  }

  function addObject(kind, names) {
    const name = nextLineName();
    const keyword = { line: 'Doğru', ray: 'Işın', segment: 'Parça', circle: 'Çember', angle: 'Açı', midpoint: 'Orta', perp: 'Dik', parallel: 'Paralel', distance: 'Uzaklık' }[kind];
    const label = kind === 'midpoint' ? nextPointName() : name;
    lines.push(`${label}=${keyword}(${names.join(',')})`);
    rebuild(false);
    emit();
  }

  function deleteRow(row) {
    if (row === undefined || readOnly) return;
    lines.splice(row, 1);
    if (!lines.length) lines = [''];
    rebuild(false);
    emit();
  }

  // Serbest noktanın satırını yeni koordinatlarla günceller (cebir paneli de güncellenir)
  function moveFreePoint(name, wx, wy) {
    const point = model.points.get(name);
    if (!point) return;
    lines[point.row] = `${name}=(${formatCoord(wx)},${formatCoord(wy)})`;
    model = buildModel(lines);
    const input = rowsEl.querySelector(`.gx-row[data-index="${point.row}"] .gx-input`);
    if (input) input.value = lines[point.row];
    scheduleDraw();
  }

  rowsEl.addEventListener('input', event => {
    const input = event.target.closest('.gx-input');
    if (!input) return;
    const index = Number(input.closest('.gx-row').dataset.index);
    lines[index] = input.value;
    rebuild(true);
    emit();
  });
  rowsEl.addEventListener('click', event => {
    const del = event.target.closest('[data-gx="del"]');
    if (!del) return;
    deleteRow(Number(del.closest('.gx-row').dataset.index));
  });
  root.querySelector('[data-gx="add"]').addEventListener('click', () => {
    if (readOnly) return;
    lines.push('');
    rebuild(false);
    const inputs = rowsEl.querySelectorAll('.gx-input');
    inputs[inputs.length - 1]?.focus();
    emit();
  });

  root.querySelectorAll('[data-tool]').forEach(button => {
    button.addEventListener('click', () => setTool(button.dataset.tool));
  });

  const zoomAt = (factor, px, py) => {
    const { w, h } = size();
    const [wx, wy] = toWorld(px, py, w, h);
    view.scale = Math.min(2000, Math.max(4, view.scale * factor));
    view.cx = wx - (px - w / 2) / view.scale;
    view.cy = wy + (py - h / 2) / view.scale;
    scheduleDraw();
  };
  root.querySelector('[data-gx="axes"]').addEventListener('click', event => {
    showAxes = !showAxes;
    event.currentTarget.classList.toggle('on', showAxes);
    event.currentTarget.setAttribute('aria-pressed', String(showAxes));
    scheduleDraw();
  });
  root.querySelector('[data-gx="png"]').addEventListener('click', () => {
    canvas.toBlob(blob => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'matematik-laboratuvari.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, 'image/png');
  });
  root.querySelector('[data-gx="zoomin"]').addEventListener('click', () => zoomAt(1.25, canvas.clientWidth / 2, canvas.clientHeight / 2));
  root.querySelector('[data-gx="zoomout"]').addEventListener('click', () => zoomAt(0.8, canvas.clientWidth / 2, canvas.clientHeight / 2));
  root.querySelector('[data-gx="reset"]').addEventListener('click', () => {
    view.cx = 0; view.cy = 0; view.scale = 50;
    scheduleDraw();
  });
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    zoomAt(event.deltaY < 0 ? 1.1 : 0.9, event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });

  const localPoint = event => {
    const rect = canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };

  canvas.addEventListener('pointerdown', event => {
    const [px, py] = localPoint(event);
    canvas.setPointerCapture(event.pointerId);
    const { w, h } = size();
    const [wx, wy] = toWorld(px, py, w, h);
    if (tool === 'move') {
      const point = hitPoint(px, py);
      if (point && !readOnly && isFreePoint(point)) {
        drag = { kind: 'point', name: point.name, moved: false };
      } else {
        drag = { kind: 'pan', x: px, y: py, cx: view.cx, cy: view.cy, moved: false };
      }
      return;
    }
    if (readOnly) { drag = { kind: 'pan', x: px, y: py, cx: view.cx, cy: view.cy, moved: false }; return; }
    if (tool === 'delete') {
      const target = hitObject(px, py);
      if (target) deleteRow(target.row);
      return;
    }
    if (tool === 'point') {
      addPointAt(wx, wy);
      return;
    }
    if (tool === 'perp' || tool === 'parallel') {
      if (!pending.length) {
        const hit = hitObject(px, py);
        const isLine = hit && (LINE_KINDS.includes(hit.kind) || hit.kind === 'perp' || hit.kind === 'parallel');
        if (!isLine) {
          hintEl.textContent = 'Önce bir doğru seçin';
          return;
        }
        pending = [hit.name];
        hintEl.textContent = `${hit.name} seçildi: şimdi noktayı seçin`;
      } else {
        const point = pointUnder(px, py);
        addObject(tool, [point, pending[0]]);
        pending = [];
        hintEl.textContent = hints[tool];
      }
      scheduleDraw();
      return;
    }
    // Doğru, ışın, parça, çember, açı: gerekli sayıda nokta
    const name = pointUnder(px, py);
    const need = tool === 'angle' ? 3 : 2;
    if (pending.length && pending[pending.length - 1] === name) return;
    pending = [...pending, name];
    cursor = [wx, wy];
    if (pending.length === need) {
      addObject(tool, pending);
      pending = [];
      hintEl.textContent = hints[tool];
    } else {
      hintEl.textContent = `${pending.join(', ')} seçildi: ${need - pending.length} nokta daha seçin`;
    }
    scheduleDraw();
  });

  canvas.addEventListener('pointermove', event => {
    const [px, py] = localPoint(event);
    const { w, h } = size();
    if (pending.length) {
      cursor = toWorld(px, py, w, h);
      scheduleDraw();
    }
    if (!drag) return;
    drag.moved = true;
    if (drag.kind === 'pan') {
      view.cx = drag.cx - (px - drag.x) / view.scale;
      view.cy = drag.cy + (py - drag.y) / view.scale;
      scheduleDraw();
    } else if (drag.kind === 'point') {
      const [wx, wy] = toWorld(px, py, w, h);
      moveFreePoint(drag.name, wx, wy);
    }
  });

  const endDrag = () => {
    if (drag && drag.kind === 'point' && drag.moved) emit();
    drag = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  function isFreePoint(point) {
    const text = lines[point.row] || '';
    return /^\s*[A-Za-z]\w*\s*=\s*\(/.test(text);
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => resize()).observe(canvas.parentElement);
  } else {
    window.addEventListener('resize', resize);
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(200, Math.floor(rect.width));
    const height = Math.max(200, Math.floor(rect.height));
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    scheduleDraw();
  }

  renderRows();
  resize();
  setTool('move');

  return {
    getLines: () => lines.slice(),
    setLines: next => {
      lines = (next && next.length ? next : ['']).map(line => String(line));
      rebuild(false);
      emit();
    },
  };
}
