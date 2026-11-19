// Tarayıcısız Kimya 3D duman testi: kaynak dosyaları geçici bir klasöre kopyalar, THREE'yi taklit eder,
// sahne senaryolarını çalıştırır. Gerçek GPU/tarayıcı davranışını kapsamaz; çalışma zamanı hatalarını yakalar.
import { cpSync, copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, '..', '..', 'public');
const dir = mkdtempSync(join(tmpdir(), 'chem3d-'));
for (const f of ['three.mjs', 'addons-rounded.mjs', 'addons-env.mjs', 'env.mjs', 'scenarios.mjs']) copyFileSync(join(here, f), join(dir, f));
for (const f of ['chemistry.js', 'titration.js', 'labs.js']) copyFileSync(join(pub, f), join(dir, f));
let src = readFileSync(join(pub, 'chem3d.js'), 'utf8')
  .replace("from 'three';", "from './three.mjs';")
  .replace("from 'three/addons/geometries/RoundedBoxGeometry.js';", "from './addons-rounded.mjs';")
  .replace("from 'three/addons/environments/RoomEnvironment.js';", "from './addons-env.mjs';");
writeFileSync(join(dir, 'chem3d.mjs'), src);
const result = spawnSync(process.execPath, [join(dir, 'scenarios.mjs')], {
  stdio: 'inherit', env: { ...process.env, CHEM3D_MODULE: join(dir, 'chem3d.mjs') },
});
process.exit(result.status ?? 1);
