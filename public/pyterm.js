// Öğrenciler için Python alt kümesi yorumlayıcı. eval yok; sonsuz döngüye karşı adım sınırı var.
// Desteklenenler: print, değişkenler, + - * / // % **, karşılaştırmalar, and/or/not, metin, liste,
// if/elif/else, while, for…in, break, continue, def/return, len, range, int, float, str, abs, min, max.

const MAX_STEPS = 200000;

// Python'da "/" her zaman ondalık (float) sonuç verir: 4/2 → 2.0. Ondalıklar bu sarmalayıcıyla taşınır.
class PyFloat {
  constructor(value) { this.value = value; }
}
const num = v => (v instanceof PyFloat ? v.value : v);
const wrapNum = (v, isFloat) => (isFloat ? new PyFloat(v) : v);
const isNumber = v => typeof v === 'number' || v instanceof PyFloat;
const MAX_OUTPUT_LINES = 500;

class PyError extends Error {
  constructor(kind, message, line) {
    super(message);
    this.kind = kind;
    this.line = line;
  }
}

// ---------- Sözcükleme ----------
function tokenize(source) {
  const lines = [];
  source.replace(/\r/g, '').split('\n').forEach((raw, idx) => {
    const lineNo = idx + 1;
    const indentMatch = /^[ \t]*/.exec(raw);
    const indent = indentMatch[0].replace(/\t/g, '    ').length;
    let text = raw.slice(indentMatch[0].length);
    // Yorum: tırnak dışındaki #
    let inStr = null;
    let cut = text.length;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (inStr) { if (ch === inStr) inStr = null; continue; }
      if (ch === '"' || ch === "'") inStr = ch;
      else if (ch === '#') { cut = i; break; }
    }
    text = text.slice(0, cut).trimEnd();
    if (!text) return;
    const tokens = [];
    const re = /\s*(?:(\d+\.\d+|\d+)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|([A-Za-z_]\w*)|(\*\*|\/\/|==|!=|<=|>=|[-+*/%<>=()[\],:]))/y;
    let pos = 0;
    while (pos < text.length) {
      re.lastIndex = pos;
      const m = re.exec(text);
      if (!m) throw new PyError('SyntaxError', `Anlaşılmayan karakter: "${text.slice(pos).trim()[0]}"`, lineNo);
      pos = re.lastIndex;
      if (m[1] !== undefined) tokens.push({ t: 'num', v: m[1].includes('.') ? parseFloat(m[1]) : parseInt(m[1], 10), f: m[1].includes('.') });
      else if (m[2] !== undefined) tokens.push({ t: 'str', v: m[2].slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\(.)/g, '$1') });
      else if (m[3] !== undefined) tokens.push({ t: 'name', v: m[3] });
      else tokens.push({ t: 'op', v: m[4] });
    }
    lines.push({ indent, tokens, lineNo });
  });
  return lines;
}

// ---------- Ayrıştırma (satır tabanlı, girinti bloklu) ----------
function parse(lines) {
  let i = 0;
  const parseBlock = indent => {
    const body = [];
    while (i < lines.length && lines[i].indent >= indent) {
      if (lines[i].indent > indent) throw new PyError('IndentationError', 'Beklenmeyen girinti', lines[i].lineNo);
      body.push(parseStatement(indent));
    }
    return body;
  };
  const parseStatement = indent => {
    const line = lines[i];
    const toks = line.tokens;
    const kw = toks[0].t === 'name' ? toks[0].v : null;
    const colonAt = toks.findIndex(t => t.t === 'op' && t.v === ':' );
    const header = (start, end) => ({ tokens: toks.slice(start, end), lineNo: line.lineNo });
    if (kw === 'if' || kw === 'elif' || kw === 'while') {
      if (colonAt < 0 || colonAt !== toks.length - 1) throw new PyError('SyntaxError', `"${kw}" satırı ":" ile bitmeli`, line.lineNo);
      const cond = exprFrom(header(1, colonAt));
      i += 1;
      const body = parseNestedBlock(indent, line.lineNo);
      if (kw === 'while') return { type: 'while', cond, body, line: line.lineNo };
      const branches = [{ cond, body }];
      let elseBody = null;
      while (i < lines.length && lines[i].indent === indent && lines[i].tokens[0].t === 'name' && (lines[i].tokens[0].v === 'elif' || lines[i].tokens[0].v === 'else')) {
        const t = lines[i];
        if (t.tokens[0].v === 'elif') {
          const c = t.tokens.findIndex(x => x.t === 'op' && x.v === ':');
          const econd = exprFrom({ tokens: t.tokens.slice(1, c), lineNo: t.lineNo });
          i += 1;
          branches.push({ cond: econd, body: parseNestedBlock(indent, t.lineNo) });
        } else {
          i += 1;
          elseBody = parseNestedBlock(indent, t.lineNo);
          break;
        }
      }
      return { type: 'if', branches, elseBody, line: line.lineNo };
    }
    if (kw === 'else') throw new PyError('SyntaxError', '"else" bir "if" ile eşleşmiyor', line.lineNo);
    if (kw === 'for') {
      if (toks[2]?.t !== 'name' || toks[2].v !== 'in' || colonAt < 0) throw new PyError('SyntaxError', 'for döngüsü: for ad in liste:', line.lineNo);
      const varName = toks[1].v;
      const iter = exprFrom(header(3, colonAt));
      i += 1;
      return { type: 'for', varName, iter, body: parseNestedBlock(indent, line.lineNo), line: line.lineNo };
    }
    if (kw === 'def') {
      const nameTok = toks[1];
      if (!nameTok || nameTok.t !== 'name' || toks[2]?.v !== '(') throw new PyError('SyntaxError', 'def adı(parametreler):', line.lineNo);
      const params = [];
      let k = 3;
      while (k < toks.length && !(toks[k].t === 'op' && toks[k].v === ')')) {
        if (toks[k].t === 'name') params.push(toks[k].v);
        k += 1;
      }
      i += 1;
      return { type: 'def', name: nameTok.v, params, body: parseNestedBlock(indent, line.lineNo), line: line.lineNo };
    }
    if (kw === 'return') {
      i += 1;
      return { type: 'return', value: toks.length > 1 ? exprFrom(header(1, toks.length)) : null, line: line.lineNo };
    }
    if (kw === 'pass') {
      i += 1;
      return { type: 'pass', line: line.lineNo };
    }
    if (kw === 'break' || kw === 'continue') {
      i += 1;
      return { type: kw, line: line.lineNo };
    }
    const eq = toks.findIndex(t => t.t === 'op' && t.v === '=');
    i += 1;
    if (eq > 0 && toks[0].t === 'name' && eq === 1) {
      return { type: 'assign', name: toks[0].v, value: exprFrom(header(eq + 1, toks.length)), line: line.lineNo };
    }
    return { type: 'expr', expr: exprFrom(header(0, toks.length)), line: line.lineNo };
  };
  const parseNestedBlock = (indent, lineNo) => {
    if (i >= lines.length || lines[i].indent <= indent) throw new PyError('IndentationError', 'Blok girintili olmalı', lineNo);
    return parseBlock(lines[i].indent);
  };
  const program = parseBlock(0);
  if (i < lines.length) throw new PyError('SyntaxError', 'Beklenmeyen satır', lines[i].lineNo);
  return program;
}

// ---------- İfade ayrıştırıcı ----------
function exprFrom({ tokens, lineNo }) {
  let p = 0;
  const peek = () => tokens[p];
  const isOp = v => peek() && peek().t === 'op' && peek().v === v;
  const isKw = v => peek() && peek().t === 'name' && peek().v === v;
  const need = v => { if (!isOp(v)) throw new PyError('SyntaxError', `"${v}" bekleniyordu`, lineNo); p += 1; };
  const orExpr = () => {
    let left = andExpr();
    while (isKw('or')) { p += 1; left = { op: 'or', a: left, b: andExpr() }; }
    return left;
  };
  const andExpr = () => {
    let left = notExpr();
    while (isKw('and')) { p += 1; left = { op: 'and', a: left, b: notExpr() }; }
    return left;
  };
  const notExpr = () => {
    if (isKw('not')) { p += 1; return { op: 'not', a: notExpr() }; }
    return cmpExpr();
  };
  const cmpExpr = () => {
    let left = addExpr();
    while (peek() && peek().t === 'op' && ['==', '!=', '<', '>', '<=', '>='].includes(peek().v)) {
      const op = tokens[p++].v;
      left = { op: 'cmp', cmp: op, a: left, b: addExpr() };
    }
    return left;
  };
  const addExpr = () => {
    let left = mulExpr();
    while (isOp('+') || isOp('-')) { const op = tokens[p++].v; left = { op: 'bin', bin: op, a: left, b: mulExpr() }; }
    return left;
  };
  const mulExpr = () => {
    let left = unaryExpr();
    while (isOp('*') || isOp('/') || isOp('//') || isOp('%')) { const op = tokens[p++].v; left = { op: 'bin', bin: op, a: left, b: unaryExpr() }; }
    return left;
  };
  const unaryExpr = () => {
    if (isOp('-')) { p += 1; return { op: 'neg', a: unaryExpr() }; }
    return powExpr();
  };
  const powExpr = () => {
    const base = postfix();
    if (isOp('**')) { p += 1; return { op: 'bin', bin: '**', a: base, b: unaryExpr() }; }
    return base;
  };
  const postfix = () => {
    let node = atom();
    for (;;) {
      if (isOp('(')) {
        p += 1;
        const args = [];
        while (!isOp(')')) {
          args.push(orExpr());
          if (isOp(',')) p += 1;
          else if (!isOp(')')) throw new PyError('SyntaxError', '")" bekleniyordu', lineNo);
        }
        p += 1;
        node = { op: 'call', fn: node, args };
      } else if (isOp('[')) {
        p += 1;
        const index = orExpr();
        need(']');
        node = { op: 'index', a: node, index };
      } else break;
    }
    return node;
  };
  const atom = () => {
    const t = peek();
    if (!t) throw new PyError('SyntaxError', 'İfade eksik', lineNo);
    if (t.t === 'num') { p += 1; return { op: 'lit', value: t.v, float: t.f }; }
    if (t.t === 'str') { p += 1; return { op: 'lit', value: t.v }; }
    if (t.t === 'name') {
      p += 1;
      if (t.v === 'True') return { op: 'lit', value: true };
      if (t.v === 'False') return { op: 'lit', value: false };
      if (t.v === 'None') return { op: 'lit', value: null };
      return { op: 'name', name: t.v };
    }
    if (isOp('(')) { p += 1; const inner = orExpr(); need(')'); return inner; }
    if (isOp('[')) {
      p += 1;
      const items = [];
      while (!isOp(']')) { items.push(orExpr()); if (isOp(',')) p += 1; else if (!isOp(']')) throw new PyError('SyntaxError', '"]" bekleniyordu', lineNo); }
      p += 1;
      return { op: 'list', items };
    }
    throw new PyError('SyntaxError', `Beklenmeyen: "${t.v}"`, lineNo);
  };
  const expr = orExpr();
  if (p < tokens.length) throw new PyError('SyntaxError', `Fazla ifade: "${tokens[p].v}"`, lineNo);
  return expr;
}

// ---------- Değerlendirme ----------
const BREAK = { signal: 'break' };
const CONTINUE = { signal: 'continue' };
class Return { constructor(value) { this.value = value; } }

function repr(v) {
  if (v instanceof PyFloat) return Number.isInteger(v.value) ? `${v.value}.0` : String(v.value);
  if (v === null || v === undefined) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'string') return `'${v.replace(/'/g, "\\'")}'`;
  if (Array.isArray(v)) return `[${v.map(repr).join(', ')}]`;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === 'function') return '<fonksiyon>';
  return String(v);
}
function display(v) { return typeof v === 'string' ? v : repr(v); }

function truthy(v) {
  if (v instanceof PyFloat) return v.value !== 0;
  if (Array.isArray(v) || typeof v === 'string') return v.length > 0;
  return Boolean(v);
}

export function runPython(source) {
  const out = [];
  let steps = 0;
  const tick = line => {
    steps += 1;
    if (steps > MAX_STEPS) throw new PyError('RuntimeError', 'Program çok uzun sürdü (sonsuz döngü olabilir)', line);
  };
  const print = text => {
    if (out.length < MAX_OUTPUT_LINES) out.push(text);
    else if (out.length === MAX_OUTPUT_LINES) out.push('… (çıktı kısaltıldı)');
  };
  const builtins = {
    print: (...args) => { print(args.map(display).join(' ')); return null; },
    len: x => {
      if (typeof x === 'string' || Array.isArray(x)) return x.length;
      throw new PyError('TypeError', 'len() yalnızca metin ya da liste alır', currentLine);
    },
    range: (...args) => {
      const [start, stop, step] = (args.length === 1 ? [0, args[0], 1] : [args[0], args[1], args[2] ?? 1]).map(num);
      if (step === 0) throw new PyError('ValueError', 'range() adımı sıfır olamaz', currentLine);
      const list = [];
      for (let v = start; step > 0 ? v < stop : v > stop; v += step) {
        list.push(v);
        if (list.length > 10000) throw new PyError('RuntimeError', 'range() çok büyük', currentLine);
      }
      return list;
    },
    int: x => Math.trunc(Number(num(x))),
    float: x => new PyFloat(Number(num(x))),
    str: x => display(x),
    abs: x => Math.abs(num(x)),
    min: (...xs) => Math.min(...(xs.length === 1 && Array.isArray(xs[0]) ? xs[0] : xs).map(num)),
    max: (...xs) => Math.max(...(xs.length === 1 && Array.isArray(xs[0]) ? xs[0] : xs).map(num)),
  };
  let currentLine = 0;

  const lookup = (env, name, line) => {
    let scope = env;
    while (scope) {
      if (Object.prototype.hasOwnProperty.call(scope.vars, name)) return scope.vars[name];
      scope = scope.parent;
    }
    if (Object.prototype.hasOwnProperty.call(builtins, name)) return builtins[name];
    throw new PyError('NameError', `'${name}' tanımlı değil`, line);
  };

  const evalExpr = (node, env) => {
    currentLine = node.line ?? currentLine;
    switch (node.op) {
      case 'lit': return node.float ? new PyFloat(node.value) : node.value;
      case 'name': return lookup(env, node.name, currentLine);
      case 'list': return node.items.map(x => evalExpr(x, env));
      case 'neg': { const v = evalExpr(node.a, env); return v instanceof PyFloat ? new PyFloat(-v.value) : -v; }
      case 'not': return !truthy(evalExpr(node.a, env));
      case 'and': { const a = evalExpr(node.a, env); return truthy(a) ? evalExpr(node.b, env) : a; }
      case 'or': { const a = evalExpr(node.a, env); return truthy(a) ? a : evalExpr(node.b, env); }
      case 'cmp': {
        const a = num(evalExpr(node.a, env));
        const b = num(evalExpr(node.b, env));
        switch (node.cmp) {
          case '==': return a === b || (Array.isArray(a) && JSON.stringify(a) === JSON.stringify(b));
          case '!=': return !(a === b || (Array.isArray(a) && JSON.stringify(a) === JSON.stringify(b)));
          case '<': return a < b;
          case '>': return a > b;
          case '<=': return a <= b;
          case '>=': return a >= b;
          default: throw new PyError('SyntaxError', 'Bilinmeyen karşılaştırma', currentLine);
        }
      }
      case 'bin': {
        const a = evalExpr(node.a, env);
        const b = evalExpr(node.b, env);
        if (node.bin === '+' && (typeof a === 'string' || typeof b === 'string')) {
          if (typeof a !== 'string' || typeof b !== 'string') throw new PyError('TypeError', 'Metin ile sayı toplanamaz (str() kullanın)', currentLine);
          return a + b;
        }
        if (node.bin === '+' && Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
        if (node.bin === '*' && typeof a === 'string' && typeof b === 'number') return a.repeat(Math.max(0, b));
        if (!isNumber(a) || !isNumber(b)) throw new PyError('TypeError', `"${node.bin}" yalnızca sayılarla kullanılır`, currentLine);
        const x = num(a);
        const y = num(b);
        const isFloatResult = a instanceof PyFloat || b instanceof PyFloat;
        switch (node.bin) {
          case '+': return isFloatResult ? new PyFloat(x + y) : x + y;
          case '-': return isFloatResult ? new PyFloat(x - y) : x - y;
          case '*': return isFloatResult ? new PyFloat(x * y) : x * y;
          case '/': if (y === 0) throw new PyError('ZeroDivisionError', 'Sıfıra bölme', currentLine); return new PyFloat(x / y);
          case '//': if (y === 0) throw new PyError('ZeroDivisionError', 'Sıfıra bölme', currentLine); return wrapNum(Math.floor(x / y), isFloatResult);
          case '%': if (y === 0) throw new PyError('ZeroDivisionError', 'Sıfıra bölme', currentLine); return wrapNum(((x % y) + y) % y, isFloatResult);
          case '**': return wrapNum(x ** y, isFloatResult);
          default: throw new PyError('SyntaxError', 'Bilinmeyen işlem', currentLine);
        }
      }
      case 'index': {
        const target = evalExpr(node.a, env);
        const idx = evalExpr(node.index, env);
        const index = num(idx);
        if (!Number.isInteger(index)) throw new PyError('TypeError', 'Dizin tam sayı olmalı', currentLine);
        const real = index < 0 ? target.length + index : index;
        if (real < 0 || real >= target.length) throw new PyError('IndexError', 'Dizin aralık dışında', currentLine);
        return target[real];
      }
      case 'call': {
        const fn = evalExpr(node.fn, env);
        const args = node.args.map(x => evalExpr(x, env));
        if (typeof fn === 'function') return fn(...args);
        if (fn && fn.isUserFunction) return callUser(fn, args);
        throw new PyError('TypeError', 'Bu bir fonksiyon değil', currentLine);
      }
      default: throw new PyError('SyntaxError', 'Bilinmeyen ifade', currentLine);
    }
  };

  const callUser = (fn, args) => {
    if (args.length !== fn.params.length) throw new PyError('TypeError', `${fn.name}() ${fn.params.length} argüman bekliyor`, currentLine);
    const vars = {};
    fn.params.forEach((p, i) => { vars[p] = args[i]; });
    const scope = { vars, parent: fn.closure };
    try {
      execBlock(fn.body, scope);
    } catch (e) {
      if (e instanceof Return) return e.value;
      throw e;
    }
    return null;
  };

  const execBlock = (body, env) => {
    for (const stmt of body) execStmt(stmt, env);
  };

  const execStmt = (stmt, env) => {
    currentLine = stmt.line;
    tick(stmt.line);
    switch (stmt.type) {
      case 'expr': evalExpr(stmt.expr, env); return;
      case 'assign': env.vars[stmt.name] = evalExpr(stmt.value, env); return;
      case 'if': {
        for (const br of stmt.branches) {
          if (truthy(evalExpr(br.cond, env))) { execBlock(br.body, env); return; }
        }
        if (stmt.elseBody) execBlock(stmt.elseBody, env);
        return;
      }
      case 'while': {
        while (truthy(evalExpr(stmt.cond, env))) {
          tick(stmt.line);
          try { execBlock(stmt.body, env); } catch (sig) {
            if (sig === BREAK) break;
            if (sig === CONTINUE) continue;
            throw sig;
          }
        }
        return;
      }
      case 'for': {
        const items = evalExpr(stmt.iter, env);
        if (!Array.isArray(items) && typeof items !== 'string') throw new PyError('TypeError', 'for yalnızca liste ya da metin üzerinde çalışır', stmt.line);
        for (const item of [...items]) {
          tick(stmt.line);
          env.vars[stmt.varName] = item;
          try { execBlock(stmt.body, env); } catch (sig) {
            if (sig === BREAK) break;
            if (sig === CONTINUE) continue;
            throw sig;
          }
        }
        return;
      }
      case 'def': {
        env.vars[stmt.name] = { isUserFunction: true, name: stmt.name, params: stmt.params, body: stmt.body, closure: env };
        return;
      }
      case 'return': throw new Return(stmt.value ? evalExpr(stmt.value, env) : null);
      case 'pass': return;
      case 'break': throw BREAK;
      case 'continue': throw CONTINUE;
      default: throw new PyError('SyntaxError', 'Bilinmeyen deyim', stmt.line);
    }
  };

  try {
    const program = parse(tokenize(source));
    execBlock(program, { vars: {}, parent: null });
    return { ok: true, output: out };
  } catch (error) {
    if (error instanceof PyError) {
      return { ok: false, output: out, error: `Satır ${error.line}: ${error.kind}: ${error.message}` };
    }
    if (error instanceof Return) return { ok: false, output: out, error: 'return yalnızca fonksiyon içinde kullanılabilir' };
    if (error === BREAK || error === CONTINUE) return { ok: false, output: out, error: 'break/continue yalnızca döngü içinde kullanılabilir' };
    return { ok: false, output: out, error: `İç hata: ${error.message}` };
  }
}
