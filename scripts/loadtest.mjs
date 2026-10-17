// Basit yük testi: eşzamanlı istemciler belirli bir süre boyunca bir uç noktayı sorgular.
// Örnek: BASE_URL=http://127.0.0.1:3000 USER=murat PASS=... CONCURRENCY=50 SECONDS=15 node scripts/loadtest.mjs
const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const concurrency = Number(process.env.CONCURRENCY || 50);
const seconds = Number(process.env.SECONDS || 15);
const target = process.env.TARGET_PATH || '/api/me';

const login = await fetch(`${base}/api/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: base },
  body: JSON.stringify({ username: process.env.USER, password: process.env.PASS, portal: process.env.PORTAL || 'member' }),
});
const cookie = login.headers.get('set-cookie')?.split(';')[0];
if (!cookie) throw new Error(`Giriş yapılamadı (HTTP ${login.status}).`);

const latencies = [];
let errors = 0;
const end = Date.now() + seconds * 1000;
async function worker() {
  while (Date.now() < end) {
    const started = performance.now();
    try {
      const res = await fetch(base + target, { headers: { Cookie: cookie } });
      await res.arrayBuffer();
      if (!res.ok) errors += 1;
    } catch {
      errors += 1;
    }
    latencies.push(performance.now() - started);
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
latencies.sort((a, b) => a - b);
const at = p => Math.round(latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] || 0);
console.log(JSON.stringify({ target, concurrency, seconds, requests: latencies.length, requestsPerSecond: Math.round(latencies.length / seconds), p50ms: at(0.5), p95ms: at(0.95), p99ms: at(0.99), errors }, null, 2));
