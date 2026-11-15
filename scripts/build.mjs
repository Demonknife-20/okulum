// Üretim derlemesi: JS ve CSS'i küçültür, içerik özetiyle adlandırır, index.html'i buna göre günceller.
// Çıktı dist/ klasörüne yazılır; sunucu dist varsa onu kullanır.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
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
  external: ['three', 'three/addons/controls/OrbitControls.js'],
});
const css = await build({
  entryPoints: [path.join(src, 'styles.css')],
  bundle: true, minify: true, legalComments: 'none',
  outdir: out, entryNames: 'styles.[hash]', metafile: true, write: true,
});

const jsFile = path.basename(Object.keys(js.metafile.outputs).find(file => file.endsWith('.js')));
const cssFile = path.basename(Object.keys(css.metafile.outputs).find(file => file.endsWith('.css')));

// Alt kaynak bütünlüğü (SRI): tarayıcı, indirilen betiğin ya da stilin özeti buradakiyle
// eşleşmezse onu çalıştırmaz/uygulamaz. Sunucu veya aradaki bir katman manipüle edilse
// bile bozuk dosya uygulamaya giremez. Yalnızca kendi ürettiğimiz dosyalara konur;
// üçüncü taraf (yazı tipi) dosyalar sürekli değiştiği için sabit özet kabul etmez.
const sri = file => `sha384-${createHash('sha384').update(fs.readFileSync(path.join(out, file))).digest('base64')}`;
const sriTag = digest => `integrity="${digest}" crossorigin="anonymous"`;
const jsSri = sri(jsFile);
const cssSri = sri(cssFile);

let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const replaceOnce = (text, from, to, file = 'index.html') => {
  if (text.split(from).length !== 2) throw new Error(`${file} içinde beklenen metin bulunamadı: ${from}`);
  return text.replace(from, to);
};
html = replaceOnce(html, 'src="/app.js"', `src="/${jsFile}" ${sriTag(jsSri)}`);
html = replaceOnce(html, 'href="/styles.css"', `href="/${cssFile}" ${sriTag(cssSri)}`);
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.copyFileSync(path.join(src, 'platform.js'), path.join(out, 'platform.js'));
const platformHtml = replaceOnce(
  fs.readFileSync(path.join(src, 'platform.html'), 'utf8'),
  'href="/styles.css"',
  `href="/${cssFile}" ${sriTag(cssSri)}`,
  'platform.html'
).replace('src="/platform.js"', `src="/platform.js" ${sriTag(sri('platform.js'))}`);
fs.writeFileSync(path.join(out, 'platform.html'), platformHtml);
fs.copyFileSync(path.join(src, 'interactions.js'), path.join(out, 'interactions.js'));
fs.copyFileSync(path.join(src, 'icon.svg'), path.join(out, 'icon.svg'));
fs.copyFileSync(path.join(src, 'styles.css'), path.join(out, 'styles.css'));
fs.copyFileSync(path.join(src, 'manifest.webmanifest'), path.join(out, 'manifest.webmanifest'));
fs.copyFileSync(path.join(src, 'sw.js'), path.join(out, 'sw.js'));
fs.copyFileSync(path.join(src, 'google7d574616643a9434.html'), path.join(out, 'google7d574616643a9434.html'));
for (const asset of ['icon-192.png', 'icon-512.png', 'brand-mark.png', 'logo.png']) {
  fs.copyFileSync(path.join(src, asset), path.join(out, asset));
}

const kb = file => (fs.statSync(path.join(out, file)).size / 1024).toFixed(1);
console.log(`dist hazır: ${jsFile} (${kb(jsFile)} KB), ${cssFile} (${kb(cssFile)} KB)`);
