import { test } from 'node:test';
import assert from 'node:assert/strict';

// DOM bağımlılıkları için minimal sahte: otp.js yalnızca querySelector, addEventListener ve
// clipboardData kullanır. Bu sahte, bileşenin kutucuk davranışını Node'da doğrulamaya yeter.
// Stubb'lar dinamik import'tan ÖNCE tanımlanmalı (core.js modül seviyesinde document'e dokunur).
class FakeInput {
  constructor(index) {
    this.value = '';
    this.maxLength = 1;
    this._listeners = {};
    this._index = index;
  }
  addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); }
  select() {}
  focus() {}
  fire(type, event = {}) {
    (this._listeners[type] || []).forEach(fn => fn({ target: this, preventDefault() {}, ...event }));
  }
}

class FakeGroup {
  constructor() { this.children = []; }
  appendChild(child) { this.children.push(child); }
}

function makeRoot() {
  const inputs = [0, 1, 2, 3, 4, 5].map(i => new FakeInput(i));
  const group = new FakeGroup();
  inputs.forEach(i => group.appendChild(i));
  const root = {
    dataset: { email: 'ogrenci@okul.com' },
    _inputs: inputs,
    _resend: null,
    _timer: null,
    querySelector(sel) {
      if (sel === '[data-otp]') return group;
      if (sel === '[data-otp-resend]') return this._resend;
      if (sel === '[data-otp-timer]') return this._timer;
      return null;
    },
    querySelectorAll(sel) { return sel === '[data-otp] input' ? inputs : []; },
  };
  return root;
}

// core.js import edilirken document'e dokunmasın diye en azından boş bir referans veriyoruz.
globalThis.document = globalThis.document || {
  documentElement: { classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {} },
  body: {},
  head: {},
  createElement: () => new FakeInput(0),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  getElementById: () => null,
};
globalThis.window = globalThis.window || globalThis;
globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));

const { otpFieldsHtml, initOtp, resetStepHtml, startResendTimer } = await import('../public/otp.js');

test('otpFieldsHtml: 6 kutucuk üretir', () => {
  const html = otpFieldsHtml();
  assert.match(html, /data-otp/);
  assert.equal((html.match(/<input/g) || []).length, 6);
});

test('initOtp: rakam dışı karakter atılır, dolu kutudan ilerler', () => {
  const root = makeRoot();
  let ready = null;
  const otp = initOtp(root, { onReady: v => { ready = v; } });
  const [first, second] = root._inputs;
  // Tarayıcıda input olayı, kutucuk değeri güncellendikten sonra tetiklenir.
  first.value = 'a';
  first.fire('input');
  assert.equal(first.value, '');
  first.value = '7';
  first.fire('input');
  assert.equal(first.value, '7');
  assert.equal(ready, false);
  second.value = '3';
  second.fire('input');
  assert.equal(otp.code(), '73');
});

test('initOtp: 6 hane dolunca onReady(true) tetiklenir, paste 6 hane doldurur', () => {
  const root = makeRoot();
  let ready = null;
  const otp = initOtp(root, { onReady: v => { ready = v; } });
  root._inputs.forEach((input, i) => { input.value = String(i + 1); input.fire('input'); });
  assert.equal(otp.code(), '123456');
  assert.equal(ready, true);
  const fresh = makeRoot();
  const otp2 = initOtp(fresh);
  fresh._inputs[0].fire('paste', { clipboardData: { getData: () => '987654' } });
  assert.equal(otp2.code(), '987654');
});

test('initOtp: clear kutucukları boşaltır', () => {
  const root = makeRoot();
  const otp = initOtp(root);
  root._inputs[0].value = '5';
  root._inputs[0].fire('input');
  otp.clear();
  assert.equal(otp.code(), '');
});

test('resetStepHtml: e-posta, kutucuklar, yeni şifre ve yeniden gönder butonu içerir', () => {
  const html = resetStepHtml('ogrenci@okul.com');
  assert.match(html, /ogrenci@okul\.com/);
  assert.match(html, /data-otp/);
  assert.match(html, /name="password"/);
  assert.match(html, /data-otp-resend/);
  assert.match(html, /data-otp-timer/);
});

test('startResendTimer: geri sayım başlar ve buton başta kapalıdır', () => {
  const root = makeRoot();
  root._resend = { disabled: false, addEventListener() {} };
  root._timer = { textContent: '' };
  let resent = 0;
  const handle = startResendTimer(root, { onResend: () => { resent += 1; } });
  assert.equal(root._timer.textContent, '60');
  assert.equal(root._resend.disabled, true);
  assert.equal(resent, 0);
  handle.stop();
});
