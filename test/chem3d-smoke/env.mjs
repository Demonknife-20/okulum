// Tarayıcı ortamı taklidi: DOM öğeleri, pencere, rAF ve bağlam (canvas) no-op'ları.
const noopCtx = new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : (k === 'measureText' ? () => ({ width: 0 }) : (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => noopCtx))),
  set: (t, k, v) => { t[k] = v; return true; },
});
export function makeEl(tag = 'div') {
  const listeners = {};
  const el = {
    tag, id: '', isConnected: true, clientWidth: 800, clientHeight: 500, textContent: '', innerHTML: '', hidden: false,
    style: {}, dataset: {}, value: '', children: [], listeners,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener(t, fn) { (listeners[t] ||= []).push(fn); },
    removeEventListener(t, fn) { listeners[t] = (listeners[t] || []).filter(f => f !== fn); },
    appendChild(c) { this.children.push(c); return c; },
    remove() { this.isConnected = false; },
    querySelector() { return makeEl('div'); }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 500 }; },
    setPointerCapture() {}, releasePointerCapture() {},
    getContext() { return noopCtx; },
    focus() {}, before() {}, prepend() {}, closest() { return null; },
  };
  return el;
}
const registry = {};
globalThis.__makeEl = makeEl;
globalThis.document = {
  getElementById: id => (registry[id] ||= Object.assign(makeEl('div'), { id })),
  createElement: tag => makeEl(tag),
  body: makeEl('body'),
  hidden: false, fullscreenEnabled: false, fullscreenElement: null,
  addEventListener() {}, removeEventListener() {},
};
const rafQueue = [];
globalThis.requestAnimationFrame = cb => { rafQueue.push(cb); return rafQueue.length; };
globalThis.cancelAnimationFrame = () => {};
globalThis.performance = { now: () => frameTime };
let frameTime = 0;
export const RAF = {
  pending: () => rafQueue.splice(0),
  step(ms = 16) { frameTime += ms; const cbs = rafQueue.splice(0); cbs.forEach(cb => cb(frameTime)); return cbs.length; },
};
globalThis.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { value: { hardwareConcurrency: 8, deviceMemory: 8 }, configurable: true });
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
export { registry };
