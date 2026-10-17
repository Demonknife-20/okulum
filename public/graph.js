// Kendi grafik aracımız (GeoGebra benzeri): fonksiyon ve nokta çizimi. Harici betik kullanmaz, eval kullanmaz.

const COLORS = ['#1b6b50', '#e5484d', '#3e7cf0', '#f5b93a', '#8b5cf6', '#e8590c'];
const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp, floor: Math.floor, ceil: Math.ceil,
};
const CONSTANTS = { pi: Math.PI, e: Math.E };

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

// Özyinelemeli iniş ayrıştırıcı: + - * / ^, parantez, örtük çarpma (2x, 3(x+1)), fonksiyonlar.
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

// Üst düzeyde virgül konumu (nokta değişmezi için)
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

// Bir satırı ayrıştırır: "f(x)=x^2", "y=2x+1", "A=(1,2)", "(3,4)", "sin(x)"
export function parseLine(line, fallbackName = 'f') {
  const text = String(line).trim();
  if (!text) return null;
  let name = null;
  let rhs = text;
  const eq = text.indexOf('=');
  if (eq > 0) {
    const lhs = text.slice(0, eq).trim();
    rhs = text.slice(eq + 1).trim();
    if (/^[A-Z]\w*$/.test(lhs)) name = lhs;
    else if (/^[a-z]\w*$/.test(lhs)) name = lhs;
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

// Ekran ölçeğinde okunaklı ızgara adımı (1, 2, 5 × 10^k)
export function niceStep(unit) {
  const base = 10 ** Math.floor(Math.log10(unit));
  for (const multiple of [1, 2, 5, 10]) {
    if (multiple * base >= unit) return multiple * base;
  }
  return 10 * base;
}

export function mountGraph(root, initial = { lines: [] }, options = {}) {
  root.innerHTML = `<div class="gx">
    <div class="gx-side">
      <div class="gx-head"><strong>Cebir</strong><button type="button" class="btn ghost sm" data-gx="add">+ Satır</button></div>
      <div class="gx-rows" data-gx="rows"></div>
      <p class="gx-help">Örnekler: <code>x^2-4</code>, <code>f(x)=sin(x)</code>, <code>A=(1,2)</code>, <code>2x+1</code>.</p>
    </div>
    <div class="gx-main">
      <div class="gx-tools">
        <button type="button" class="btn ghost sm" data-gx="zoomin" aria-label="Yakınlaştır">+</button>
        <button type="button" class="btn ghost sm" data-gx="zoomout" aria-label="Uzaklaştır">−</button>
        <button type="button" class="btn ghost sm" data-gx="reset">Görünümü sıfırla</button>
        <span class="gx-hint">Sürükleyerek kaydırın, tekerlekle yakınlaştırın</span>
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
  let parsed = [];
  let drawQueued = false;

  const emit = () => { if (options.onChange) options.onChange(lines.slice()); };

  function reparse() {
    let fnCount = 0;
    parsed = lines.map((line, index) => {
      try {
        const result = parseLine(line, `f${fnCount + 1}`);
        if (result && result.type === 'fn') fnCount += 1;
        return { line, result, error: null, index };
      } catch (error) {
        return { line, result: null, error: error.message, index };
      }
    });
  }

  function renderRows() {
    rowsEl.innerHTML = parsed.map((entry, index) => `<div class="gx-row" data-index="${index}">
        <span class="gx-dot" style="background:${COLORS[index % COLORS.length]}"></span>
        <input class="gx-input" value="${escapeAttr(entry.line)}" ${readOnly ? 'readonly' : ''} aria-label="Satır ${index + 1}">
        ${readOnly ? '' : '<button type="button" class="gx-del" data-gx="del" aria-label="Satırı sil">×</button>'}
        ${entry.error ? `<small class="gx-error">${escapeHtml(entry.error)}</small>` : ''}
      </div>`).join('') || '<p class="gx-empty">Bir ifade ya da nokta yazın.</p>';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(value) { return escapeHtml(value); }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(200, Math.floor(rect.width * dpr));
    canvas.height = Math.max(200, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    scheduleDraw();
  }

  function toScreen(x, y, w, h) {
    return [w / 2 + (x - view.cx) * view.scale, h / 2 - (y - view.cy) * view.scale];
  }

  function draw() {
    drawQueued = false;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    const left = view.cx - w / 2 / view.scale;
    const right = view.cx + w / 2 / view.scale;
    const bottom = view.cy - h / 2 / view.scale;
    const top = view.cy + h / 2 / view.scale;
    const step = niceStep(80 / view.scale);
    ctx.font = '12px system-ui, sans-serif';
    ctx.lineWidth = 1;
    for (let gx = Math.ceil(left / step) * step; gx <= right; gx += step) {
      const [sx] = toScreen(gx, 0, w, h);
      ctx.strokeStyle = Math.abs(gx) < step / 2 ? '#7c8f86' : '#e4ece8';
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();
      if (Math.abs(gx) > step / 2) {
        const [, sy] = toScreen(0, 0, w, h);
        ctx.fillStyle = '#6b7f76';
        ctx.fillText(formatTick(gx), sx + 4, Math.min(Math.max(sy + 14, 12), h - 4));
      }
    }
    for (let gy = Math.ceil(bottom / step) * step; gy <= top; gy += step) {
      const [, sy] = toScreen(0, gy, w, h);
      ctx.strokeStyle = Math.abs(gy) < step / 2 ? '#7c8f86' : '#e4ece8';
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke();
      if (Math.abs(gy) > step / 2) {
        const [sx] = toScreen(0, 0, w, h);
        ctx.fillStyle = '#6b7f76';
        ctx.fillText(formatTick(gy), Math.min(Math.max(sx + 4, 4), w - 40), sy - 4);
      }
    }
    parsed.forEach((entry, index) => {
      if (!entry.result) return;
      const color = COLORS[index % COLORS.length];
      if (entry.result.type === 'fn') drawFunction(entry.result.fn, color, w, h);
      else drawPoint(entry.result, color, w, h);
    });
  }

  function drawFunction(fn, color, w, h) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    let started = false;
    let previous = null;
    for (let px = 0; px <= w; px += 1) {
      const x = view.cx + (px - w / 2) / view.scale;
      let y;
      try { y = fn(x); } catch { y = NaN; }
      if (!Number.isFinite(y)) { started = false; previous = null; continue; }
      const [sx, sy] = toScreen(x, y, w, h);
      if (previous !== null && Math.abs(sy - previous) > h) { started = false; }
      if (!started) { ctx.moveTo(sx, sy); started = true; } else { ctx.lineTo(sx, sy); }
      previous = sy;
    }
    ctx.stroke();
  }

  function drawPoint(point, color, w, h) {
    const [sx, sy] = toScreen(point.x, point.y, w, h);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#11231d';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(`${point.name}(${formatTick(point.x)}, ${formatTick(point.y)})`, sx + 8, sy - 8);
  }

  function formatTick(value) {
    const rounded = Math.abs(value) < 1e-9 ? 0 : Number(value.toPrecision(6));
    return String(rounded);
  }

  function scheduleDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(draw);
  }

  // Yazarken satırları yeniden oluşturmadan yalnızca hata metinlerini günceller (imleç kaybolmaz)
  function updateErrors() {
    rowsEl.querySelectorAll('.gx-row').forEach((row, index) => {
      const entry = parsed[index];
      row.querySelector('.gx-error')?.remove();
      if (entry && entry.error) {
        const note = document.createElement('small');
        note.className = 'gx-error';
        note.textContent = entry.error;
        row.appendChild(note);
      }
    });
  }

  function refresh(fromInput = false) {
    reparse();
    if (fromInput) updateErrors();
    else renderRows();
    scheduleDraw();
  }

  rowsEl.addEventListener('input', event => {
    const input = event.target.closest('.gx-input');
    if (!input) return;
    const index = Number(input.closest('.gx-row').dataset.index);
    lines[index] = input.value;
    refresh(true);
    emit();
  });
  rowsEl.addEventListener('click', event => {
    const del = event.target.closest('[data-gx="del"]');
    if (!del) return;
    const index = Number(del.closest('.gx-row').dataset.index);
    lines.splice(index, 1);
    refresh();
    emit();
  });
  root.querySelector('[data-gx="add"]').addEventListener('click', () => {
    if (readOnly) return;
    lines.push('');
    refresh();
    const inputs = rowsEl.querySelectorAll('.gx-input');
    inputs[inputs.length - 1]?.focus();
    emit();
  });

  const zoomAt = (factor, px, py) => {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const wx = view.cx + (px - w / 2) / view.scale;
    const wy = view.cy - (py - h / 2) / view.scale;
    view.scale = Math.min(2000, Math.max(4, view.scale * factor));
    view.cx = wx - (px - w / 2) / view.scale;
    view.cy = wy + (py - h / 2) / view.scale;
    scheduleDraw();
  };
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

  let drag = null;
  canvas.addEventListener('pointerdown', event => {
    drag = { x: event.clientX, y: event.clientY, cx: view.cx, cy: view.cy };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag) return;
    view.cx = drag.cx - (event.clientX - drag.x) / view.scale;
    view.cy = drag.cy + (event.clientY - drag.y) / view.scale;
    scheduleDraw();
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(canvas.parentElement);
  else window.addEventListener('resize', resize);

  reparse();
  renderRows();
  resize();

  return {
    getLines: () => lines.slice(),
    setLines: next => {
      lines = (next || []).map(line => String(line));
      refresh();
      emit();
    },
  };
}
