// Üretim derlemesi: JS ve CSS'i küçültür, içerik özetiyle adlandırır, index.html'i buna göre günceller.
// Çıktı dist/ klasörüne yazılır; sunucu dist varsa onu kullanır.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'public');
const out = path.join(root, 'dist');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const js = await build({
  entryPoints: [path.join(src, 'app.js')],
  bundle: true, minify: true, format: 'esm', target: ['es2020'], legalComments: 'none',
  outdir: out, entryNames: 'app.[hash]', metafile: true, write: true,
});
const css = await build({
  entryPoints: [path.join(src, 'styles.css')],
  bundle: true, minify: true, legalComments: 'none',
  outdir: out, entryNames: 'styles.[hash]', metafile: true, write: true,
});

const jsFile = path.basename(Object.keys(js.metafile.outputs).find(file => file.endsWith('.js')));
const cssFile = path.basename(Object.keys(css.metafile.outputs).find(file => file.endsWith('.css')));

let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const replaceOnce = (text, from, to) => {
  if (text.split(from).length !== 2) throw new Error(`index.html içinde beklenen metin bulunamadı: ${from}`);
  return text.replace(from, to);
};
html = replaceOnce(html, 'src="/app.js"', `src="/${jsFile}"`);
html = replaceOnce(html, 'href="/styles.css"', `href="/${cssFile}"`);
fs.writeFileSync(path.join(out, 'index.html'), html);
const platformHtml = fs.readFileSync(path.join(src, 'platform.html'), 'utf8')
  .replace('href="/styles.css"', `href="/${cssFile}"`);
fs.writeFileSync(path.join(out, 'platform.html'), platformHtml);
fs.copyFileSync(path.join(src, 'platform.js'), path.join(out, 'platform.js'));
fs.copyFileSync(path.join(src, 'interactions.js'), path.join(out, 'interactions.js'));
fs.copyFileSync(path.join(src, 'icon.svg'), path.join(out, 'icon.svg'));
fs.copyFileSync(path.join(src, 'styles.css'), path.join(out, 'styles.css'));
fs.copyFileSync(path.join(src, 'manifest.webmanifest'), path.join(out, 'manifest.webmanifest'));
fs.copyFileSync(path.join(src, 'robots.txt'), path.join(out, 'robots.txt'));
fs.copyFileSync(path.join(src, 'sw.js'), path.join(out, 'sw.js'));
for (const asset of ['icon-192.png', 'icon-512.png', 'brand-mark.png', 'logo.png']) {
  fs.copyFileSync(path.join(src, asset), path.join(out, asset));
}

const kb = file => (fs.statSync(path.join(out, file)).size / 1024).toFixed(1);
console.log(`dist hazır: ${jsFile} (${kb(jsFile)} KB), ${cssFile} (${kb(cssFile)} KB)`);
