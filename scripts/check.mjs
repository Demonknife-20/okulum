// Hızlı kalite kontrolü (ağ ve veritabanı gerektirmez):
//  1. Tüm JavaScript dosyalarında sözdizimi kontrolü
//  2. API'de aynı metot ve yolda çift rota tanımı olmaması
//  3. test/ altındaki her test dosyasının package.json test listesinde olması
// Kullanım: npm run check
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const problems = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'uploads', 'tmp', '.git', 'dist'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(m?js|cjs)$/.test(name)) out.push(p);
  }
  return out;
}

// 1. Sözdizimi
for (const file of walk(root)) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    problems.push(`Sözdizimi hatası: ${relative(root, file)}\n${String(error.stderr || error.message).split('\n').slice(0, 3).join('\n')}`);
  }
}

// 2. Çift API rotaları
const api = readFileSync(join(root, 'src/api.js'), 'utf8');
const seen = new Map();
for (const m of api.matchAll(/^on\('(GET|POST|PUT|PATCH|DELETE)', '([^']+)'/gm)) {
  const key = `${m[1]} ${m[2]}`;
  seen.set(key, (seen.get(key) || 0) + 1);
}
for (const [key, count] of seen) if (count > 1) problems.push(`Çift rota tanımı: ${key} (${count} kez)`);

// 3. Test listesi
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const listed = new Set([...pkg.scripts.test.matchAll(/test\/[\w.-]+\.(m?js|cjs)/g)].map(m => m[0]));
for (const name of readdirSync(join(root, 'test'))) {
  if (!/\.(m?js|cjs)$/.test(name) || name.startsWith('.')) continue;
  if (!listed.has(`test/${name}`) && name !== 'e2e') problems.push(`Test listede değil: test/${name}`);
}

if (problems.length) {
  console.error(problems.join('\n\n'));
  console.error(`\n${problems.length} sorun bulundu.`);
  process.exit(1);
}
console.log(`Kontrol tamam: ${walk(root).length} JavaScript dosyası, ${seen.size} API rotası, ${listed.size} test listede.`);
