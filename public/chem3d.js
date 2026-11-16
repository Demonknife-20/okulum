// ============================================================================
// OKULUM — 3D KİMYA LABORATUVARI (birinci şahıs)
// Oda içinde gezin (W A S D veya ok tuşları, sürükleyerek bakın).
// Raftan malzeme al, masadaki tüpe tıkla ve dök. Tüpü tutup ispirto ocağının üstüne koy.
// Kibritle ocağı yak. Tepkimeler malzemelere ve sıcaklığa göre gerçekleşir.
// Three.js, esbuild ile paketlenir (npm run build).
// ============================================================================

import * as THREE from 'three';

export const CHEM3D_MATERIALS = [
  { key: 'su', name: 'Su', icon: '💧', color: 0x4a90e2, fill: 0.5 },
  { key: 'asit', name: 'Hidroklorik asit (HCl)', icon: '🧪', color: 0xe6fff2, fill: 0.4 },
  { key: 'baz', name: 'Sodyum hidroksit (NaOH)', icon: '🧫', color: 0xf4f4ff, fill: 0.4 },
  { key: 'fenolftalein', name: 'Fenolftalein (indikatör)', icon: '🩷', color: 0xfbf3ff, fill: 0.08 },
  { key: 'toz', name: 'Beyaz toz', icon: '⚪', color: 0xf2f2f2, fill: 0.22 },
  { key: 'tuz', name: 'Tuz', icon: '🧂', color: 0xf5fbff, fill: 0.22 },
  { key: 'efervesan', name: 'Efervesan tablet', icon: '💊', color: 0xffd966, fill: 0.18 },
  { key: 'kagit', name: 'Kağıt', icon: '📄', color: 0xfffdf5, fill: 0.16 },
  { key: 'kibrit', name: 'Kibrit', icon: '🔥', color: 0xd32f2f, fill: 0, tool: true },
];

// Tepkimeler sırayla denetlenir; son kural önceki kuralların sonucunu değiştirebilir.
const REACTIONS = [
  { id: 'cozunme', needs: ['toz', 'su'], minTemp: 0, color: 0x7fb6e6, name: 'Çözünme', desc: 'Beyaz toz suda çözündü; şeffaf bir çözelti oluştu.' },
  { id: 'tuzlu', needs: ['tuz', 'su'], minTemp: 0, color: 0xc4e2f0, name: 'Tuzlu su', desc: 'Tuz suda eridi; tuzlu su hazır.' },
  { id: 'kopuk', needs: ['efervesan', 'su'], minTemp: 0, color: 0xd6f1ff, name: 'Köpürme', desc: 'Efervesan tablet karbondioksit çıkararak çözündü.', fx: { type: 'bubbles', minTemp: 0 } },
  { id: 'notr', needs: ['asit', 'baz'], minTemp: 0, color: 0xdff3ff, name: 'Nötrleşme', desc: 'Asit ve baz birbirini nötrleştirdi; ortam ısındı.', heat: 40 },
  { id: 'pembe', needs: ['baz', 'fenolftalein'], minTemp: 0, color: 0xff4fa3, name: 'Pembe renk', desc: 'Baz ortamında fenolftalein pembeleşti.' },
  { id: 'renk_kaybi', needs: ['asit', 'baz', 'fenolftalein'], after: 'notr', minTemp: 0, color: 0xf3f6ff, name: 'Renk kayboldu', desc: 'Ortam nötrleşince pembe renk kayboldu.' },
  { id: 'kaynama', needs: ['su'], minTemp: 100, color: 0xbfe3ff, name: 'Kaynama', desc: 'Su 100 °C\'de kaynayıp buhara dönüştü.', fx: { type: 'steam', minTemp: 95 }, evaporate: true },
  { id: 'yanma', needs: ['kagit'], minTemp: 200, color: 0x3e2a1e, name: 'Yanma', desc: 'Kağıt yüksek sıcaklıkta yanıp kömürleşti.', fx: { type: 'smoke', minTemp: 150 } },
];

const FX = {
  steam: { color: 0xffffff, rate: 18, vy: 0.35, spread: 0.05, life: 1.3, y: 0.42 },
  bubbles: { color: 0xcfefff, rate: 24, vy: 0.5, spread: 0.06, life: 0.9, y: 0.05 },
  smoke: { color: 0x666666, rate: 14, vy: 0.25, spread: 0.1, life: 1.6, y: 0.42 },
};

const TOP = 0.9; // masa üstü yüksekliği
const TABLE = { hx: 1.3, hz: 0.6 };
const BURNER_POS = [0, 0.05];
const HEAT_RANGE = 0.3;
const TUBE_START = [[-0.8, -0.1], [0.8, -0.1], [0, -0.35]];
const GLASS_H = 0.4;
const CONTENT_H = 0.36;
const MAX_PARTICLES = 320;
const MAX_CONTENTS = 3;
const SHELF_Y = [1.25, 1.75, 2.25];
const PLAYER_SPEED = 1.8;
const ROOM = { minX: -2.7, maxX: 2.7, minZ: -2.4, maxZ: 2.8 };

export function initChem3d(containerId, { onStatus = () => {} } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  const width = () => Math.max(container.clientWidth, 1);
  const height = () => Math.max(container.clientHeight, 1);

  // ---------- Sahne ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe7ea);

  const camera = new THREE.PerspectiveCamera(68, width() / height(), 0.05, 40);
  camera.rotation.order = 'YXZ';

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width(), height());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.cursor = 'crosshair';
  container.appendChild(renderer.domElement);

  // Üstte imleç ve ipucu (dokunmaz, tıklamayı geçirir)
  const hud = document.createElement('div');
  hud.className = 'chem3d-hud';
  hud.innerHTML = '<div class="chem3d-cross">+</div><div class="chem3d-held" data-held></div><div class="chem3d-msg-hud" data-msg></div><div class="chem3d-hint" data-hint></div>';
  container.appendChild(hud);
  const hintEl = hud.querySelector('[data-hint]');
  const msgEl = hud.querySelector('[data-msg]');
  const heldEl = hud.querySelector('[data-held]');

  // ---------- Işık ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8d7b6a, 0.85));
  const sun = new THREE.DirectionalLight(0xffffff, 0.7);
  sun.position.set(2, 5, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);
  const flameLight = new THREE.PointLight(0xff8a2b, 0, 1.6);
  scene.add(flameLight);

  // ---------- Oda ----------
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  const addBox = (w, h, d, x, y, z, color, parent = scene) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(color));
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const floor = addBox(8, 0.1, 8, 0, -0.05, 0, 0xc9b79c);
  floor.position.y = -0.05;
  addBox(8, 3, 0.1, 0, 1.5, -3.05, 0xe9efe6); // arka duvar
  addBox(0.1, 3, 8, -3.05, 1.5, 0, 0xe9efe6); // sol duvar
  addBox(0.1, 3, 8, 3.05, 1.5, 0, 0xe9efe6); // sağ duvar
  addBox(8, 0.1, 8, 0, 3.0, 0, 0xf5f5f5); // tavan

  // Raflar (arka duvarda)
  SHELF_Y.forEach(y => addBox(5.2, 0.06, 0.5, 0, y, -2.8, 0x8d6e63));

  // Masa
  addBox(TABLE.hx * 2, 0.08, TABLE.hz * 2, 0, TOP - 0.04, 0, 0x8d6e63);
  [[-1.2, -0.5], [1.2, -0.5], [-1.2, 0.5], [1.2, 0.5]].forEach(([x, z]) => addBox(0.08, TOP - 0.08, 0.08, x, (TOP - 0.08) / 2, z, 0x6d4c41));

  // ---------- Raftaki malzemeler (şişeler) ----------
  const bottles = [];
  const shelfItems = CHEM3D_MATERIALS;
  shelfItems.forEach((mat, i) => {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const x = -1.6 + col * 0.8;
    const y = SHELF_Y[row] + (mat.tool ? 0.04 : 0.14);
    const z = -2.8;
    let mesh;
    if (mat.tool) {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.05), std(mat.color));
    } else {
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.26, 18),
        new THREE.MeshStandardMaterial({ color: mat.color, transparent: true, opacity: 0.85, roughness: 0.2 })
      );
    }
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.userData = { kind: 'bottle', key: mat.key };
    scene.add(mesh);
    bottles.push(mesh);
  });

  // ---------- Tüpler (cam beher) ----------
  const createTube = (x, z) => {
    const root = new THREE.Group();
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, GLASS_H, 20),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, roughness: 0.1 })
    );
    glass.castShadow = true;
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 20), std(0xcfd8dc));
    bottom.position.y = -GLASS_H / 2 + 0.01;
    const content = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.115, 1, 20),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 })
    );
    content.visible = false;
    root.add(glass, bottom, content);
    root.position.set(x, TOP + 0.22, z);
    root.userData = {
      kind: 'tube',
      content,
      contents: [],
      reacted: new Set(),
      reactionColor: null,
      target: new THREE.Color(0xffffff),
      fx: [],
      emitAcc: {},
      temp: 20,
      volume: 1,
    };
    scene.add(root);
    return root;
  };
  const tubes = TUBE_START.map(([x, z]) => createTube(x, z));

  // ---------- İspirto ocağı ----------
  const burner = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.2, 0.12, 24),
    new THREE.MeshStandardMaterial({ color: 0x9aa6ad, metalness: 0.6, roughness: 0.35 })
  );
  body.position.y = 0.06;
  body.castShadow = true;
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.03, 20),
    new THREE.MeshStandardMaterial({ color: 0x5f6b72, metalness: 0.5, roughness: 0.4 })
  );
  cap.position.y = 0.135;
  const flame = new THREE.Group();
  const outerFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.26, 14),
    new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5500, emissiveIntensity: 0.9, transparent: true, opacity: 0.9 })
  );
  outerFlame.position.y = 0.16;
  const innerFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffd000, emissiveIntensity: 1 })
  );
  innerFlame.position.y = 0.1;
  flame.add(outerFlame, innerFlame);
  flame.position.y = 0.15;
  flame.visible = false;
  burner.add(body, cap, flame);
  burner.position.set(BURNER_POS[0], TOP, BURNER_POS[1]);
  burner.userData = { kind: 'burner' };
  scene.add(burner);

  // ---------- Parçacıklar (buhar, köpük, duman) ----------
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAX_PARTICLES * 3);
  const pCol = new Float32Array(MAX_PARTICLES * 3);
  const pVel = new Float32Array(MAX_PARTICLES * 3);
  const pLife = new Float32Array(MAX_PARTICLES);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  for (let i = 0; i < MAX_PARTICLES; i++) pPos[i * 3 + 1] = -100;
  const points = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false })
  );
  scene.add(points);
  let cursor = 0;
  const spawn = (x, y, z, color, vy, spread, life) => {
    const i = cursor;
    cursor = (cursor + 1) % MAX_PARTICLES;
    pPos.set([x, y, z], i * 3);
    pVel.set([(Math.random() - 0.5) * spread, vy, (Math.random() - 0.5) * spread], i * 3);
    const c = new THREE.Color(color);
    pCol.set([c.r, c.g, c.b], i * 3);
    pLife[i] = life;
  };

  // ---------- Oyuncu ----------
  const player = { x: 0, z: 2.1, yaw: 0, pitch: -0.2 };
  const keys = new Set();
  const pickables = () => [...bottles, ...tubes, burner];

  // ---------- Durum ----------
  let heldKey = null; // elindeki malzeme (şişeden)
  let carried = null; // elindeki tüp
  let lit = false;
  let disposed = false;
  let time = 0;
  let dragging = false;
  let press = null;

  const materialOf = key => CHEM3D_MATERIALS.find(m => m.key === key);
  const hottest = () => Math.round(Math.max(...tubes.map(t => t.userData.temp)));
  const heldLabel = () => {
    if (carried) return 'Elinizde: tüp (masaya tıklayın)';
    if (heldKey) return `Elinizde: ${materialOf(heldKey).name}`;
    return '';
  };
  const emit = (message, tone) => {
    if (disposed) return;
    heldEl.textContent = heldLabel();
    onStatus({ hottest: hottest(), selected: heldKey, carrying: Boolean(carried), burnerOn: lit, message, tone });
  };
  const say = (message, tone = 'info') => {
    if (disposed) return;
    msgEl.textContent = message;
    msgEl.dataset.tone = tone;
    emit(message, tone);
  };

  // ---------- Tepkime mantığı ----------
  const averageColor = d => {
    const sum = new THREE.Color(0, 0, 0);
    d.contents.forEach(k => sum.add(new THREE.Color(materialOf(k).color)));
    return d.contents.length ? sum.multiplyScalar(1 / d.contents.length) : new THREE.Color(0xffffff);
  };

  const checkReactions = (tube, dt) => {
    const d = tube.userData;
    for (const r of REACTIONS) {
      if (d.reacted.has(r.id)) continue;
      if (!r.needs.every(k => d.contents.includes(k))) continue;
      if (r.after && !d.reacted.has(r.after)) continue;
      if (d.temp < r.minTemp) continue;
      d.reacted.add(r.id);
      d.reactionColor = new THREE.Color(r.color);
      if (r.heat) d.temp += r.heat;
      if (r.fx && !d.fx.some(f => f.type === r.fx.type)) d.fx.push(r.fx);
      say(`${r.name}: ${r.desc}`, 'ok');
    }
    void dt;
  };

  const pour = (tube, key) => {
    const d = tube.userData;
    const mat = materialOf(key);
    if (d.contents.includes(key)) return say(`${mat.name} bu tüpte zaten var.`, 'warn');
    if (d.contents.length >= MAX_CONTENTS) return say('Tüp dolu: en fazla üç malzeme karıştırılabilir.', 'warn');
    d.contents.push(key);
    d.target.copy(d.reactionColor ?? averageColor(d));
    heldKey = null;
    say(`${mat.name} tüpe döküldü.`, 'info');
    checkReactions(tube);
  };

  // ---------- Girdi: bakış ve hareket ----------
  const onKeyDown = e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
  };
  const onKeyUp = e => keys.delete(e.key.toLowerCase());
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const ndcCenter = new THREE.Vector2(0, 0);
  const ray = new THREE.Raycaster();
  const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP);
  const hitPoint = new THREE.Vector3();

  const rootOf = obj => {
    let o = obj;
    while (o && !o.userData?.kind) o = o.parent;
    return o;
  };
  const centerHit = () => {
    ray.setFromCamera(ndcCenter, camera);
    const hit = ray.intersectObjects(pickables(), true)[0];
    return hit ? rootOf(hit.object) : null;
  };
  const tableTarget = () => {
    ray.setFromCamera(ndcCenter, camera);
    if (!ray.ray.intersectPlane(tablePlane, hitPoint)) return null;
    if (Math.abs(hitPoint.x) > TABLE.hx - 0.15 || Math.abs(hitPoint.z) > TABLE.hz - 0.15) return null;
    return hitPoint.clone();
  };

  const interact = () => {
    const target = centerHit();
    if (target?.userData.kind === 'bottle') {
      const bottle = target;
      const key = bottle.userData.key;
      if (carried) return say('Önce elinizdeki tüpü masaya bırakın.', 'warn');
      if (heldKey === key) { heldKey = null; return say('Malzeme bırakıldı.', 'info'); }
      heldKey = key;
      return say(`${materialOf(key).name} elinizde. Bir tüpe ya da ocağa tıklayın.`, 'info');
    }
    if (target?.userData.kind === 'tube') {
      if (heldKey) return pour(target, heldKey);
      if (carried) return say('Tüp zaten elinizde. Masaya tıklayarak bırakın.', 'warn');
      carried = target;
      return say('Tüpü aldınız. Masada bir yere tıklayarak bırakın.', 'info');
    }
    if (target?.userData.kind === 'burner') {
      if (carried) return say('Tüpü ocağın üstüne yerleştirmek için masada ocağın yakınına tıklayın.', 'info');
      if (heldKey === 'kibrit') { lit = true; heldKey = null; return say('Ocak yandı. Tüpü ocağın yanına koyarak ısıtın.', 'ok'); }
      if (heldKey) return say('Bu malzeme ocakta kullanılmaz. Kibrit gerekir.', 'warn');
      lit = !lit;
      return say(lit ? 'Ocak yandı.' : 'Ocak söndü.', 'info');
    }
    // Hedef yok: masaya bırakma
    if (carried) {
      const p = tableTarget();
      if (!p) return say('Tüpü bırakmak için masaya bakın.', 'warn');
      carried.position.set(THREE.MathUtils.clamp(p.x, -TABLE.hx + 0.2, TABLE.hx - 0.2), TOP + 0.22, THREE.MathUtils.clamp(p.z, -TABLE.hz + 0.2, TABLE.hz - 0.2));
      carried = null;
      return say('Tüp masaya bırakıldı.', 'info');
    }
    if (heldKey) { heldKey = null; return say('Malzeme bırakıldı.', 'info'); }
    return null;
  };

  const onPointerDown = e => {
    press = { x: e.clientX, y: e.clientY, moved: false };
    renderer.domElement.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = e => {
    if (!press) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (!press.moved && Math.hypot(dx, dy) > 6) { press.moved = true; dragging = true; }
    if (dragging) {
      player.yaw -= (e.clientX - (press.lx ?? press.x)) * 0.005;
      player.pitch = THREE.MathUtils.clamp(player.pitch - (e.clientY - (press.ly ?? press.y)) * 0.004, -1.2, 1.2);
    }
    press.lx = e.clientX;
    press.ly = e.clientY;
  };
  const onPointerUp = e => {
    if (!press) return;
    if (!press.moved) interact();
    press = null;
    dragging = false;
    renderer.domElement.releasePointerCapture?.(e.pointerId);
  };
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);

  // ---------- Her karede güncelleme ----------
  const collidesTable = (x, z) => Math.abs(x) < TABLE.hx + 0.2 && Math.abs(z) < TABLE.hz + 0.2;

  const movePlayer = dt => {
    const forward = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
    const strafe = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    if (!forward && !strafe) return;
    const sin = Math.sin(player.yaw);
    const cos = Math.cos(player.yaw);
    let dx = (-sin * forward + cos * strafe);
    let dz = (-cos * forward - sin * strafe);
    const len = Math.hypot(dx, dz) || 1;
    dx = (dx / len) * PLAYER_SPEED * dt;
    dz = (dz / len) * PLAYER_SPEED * dt;
    const nx = THREE.MathUtils.clamp(player.x + dx, ROOM.minX, ROOM.maxX);
    const nz = THREE.MathUtils.clamp(player.z + dz, ROOM.minZ, ROOM.maxZ);
    if (!collidesTable(nx, player.z)) player.x = nx;
    if (!collidesTable(player.x, nz)) player.z = nz;
  };

  const step = dt => {
    time += dt;
    movePlayer(dt);
    camera.position.set(player.x, 1.55, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);

    // Taşınan tüp: bakılan masa noktasının üstünde süzülür
    if (carried) {
      const p = tableTarget();
      if (p) carried.position.lerp(new THREE.Vector3(p.x, TOP + 0.4, p.z), Math.min(1, dt * 10));
    }

    flame.visible = lit;
    if (lit) flame.scale.set(1 + Math.sin(time * 18) * 0.08, 1 + Math.sin(time * 23) * 0.12, 1 + Math.sin(time * 18) * 0.08);
    flameLight.position.set(BURNER_POS[0], TOP + 0.3, BURNER_POS[1]);
    flameLight.intensity = lit ? 1.2 + Math.sin(time * 15) * 0.15 : 0;

    for (const tube of tubes) {
      const d = tube.userData;
      const near = !carried || carried !== tube
        ? lit && Math.hypot(tube.position.x - BURNER_POS[0], tube.position.z - BURNER_POS[1]) < HEAT_RANGE
        : false;
      const goal = near ? 260 : 20;
      const rate = near ? 90 : 35;
      const delta = goal - d.temp;
      d.temp += Math.sign(delta) * Math.min(Math.abs(delta), rate * dt);

      if (d.reacted.has('kaynama') && d.temp >= 100) d.volume = Math.max(0.35, d.volume - dt * 0.02);
      checkReactions(tube, dt);

      const fillSum = d.contents.reduce((s, k) => s + materialOf(k).fill, 0);
      const level = Math.min(1, fillSum) * d.volume;
      d.content.visible = level > 0.001;
      if (d.content.visible) {
        const h = Math.max(0.001, level * CONTENT_H);
        d.content.scale.y = h;
        d.content.position.y = -0.18 + h / 2;
        d.content.material.color.lerp(d.reactionColor ?? averageColor(d), Math.min(1, dt * 4));
      }

      for (const fx of d.fx) {
        if (d.temp < fx.minTemp) continue;
        const spec = FX[fx.type];
        d.emitAcc[fx.type] = (d.emitAcc[fx.type] || 0) + dt * spec.rate;
        while (d.emitAcc[fx.type] >= 1) {
          d.emitAcc[fx.type] -= 1;
          spawn(tube.position.x, tube.position.y + spec.y - 0.22, tube.position.z, spec.color, spec.vy, spec.spread, spec.life);
        }
      }
    }

    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (pLife[i] <= 0) continue;
      pLife[i] -= dt;
      if (pLife[i] <= 0) { pPos[i * 3 + 1] = -100; continue; }
      pPos[i * 3] += pVel[i * 3] * dt;
      pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
      pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;

    // Bakılan nesneye göre ipucu
    const target = centerHit();
    let hint = '';
    if (carried) hint = 'Tüp elinizde: masaya tıklayarak bırakın';
    else if (heldKey) hint = `Elinizde ${materialOf(heldKey).name}: tüpe ya da ocağa tıklayın`;
    else if (target?.userData.kind === 'bottle') hint = `Al: ${materialOf(target.userData.key).name}`;
    else if (target?.userData.kind === 'tube') hint = 'Tüpü al (elinizde malzeme yoksa) ya da malzeme dök';
    else if (target?.userData.kind === 'burner') hint = lit ? 'Ocağı söndür' : 'Ocağı yak (kibrit gerekir)';
    else hint = 'W A S D ile gezin, sürükleyerek bakın';
    if (hint !== hintEl.textContent) hintEl.textContent = hint;
  };

  // ---------- Boyut ----------
  const onResize = () => {
    camera.aspect = width() / height();
    camera.updateProjectionMatrix();
    renderer.setSize(width(), height());
  };
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
  resizeObserver?.observe(container);

  // ---------- Temizlik ----------
  let frameId = 0;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frameId);
    resizeObserver?.disconnect();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
    renderer.domElement.removeEventListener('pointercancel', onPointerUp);
    scene.traverse(obj => {
      obj.geometry?.dispose();
      if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose());
    });
    renderer.dispose();
    renderer.domElement.remove();
    hud.remove();
  };

  // ---------- Ana döngü ----------
  let last = performance.now();
  let heartbeat = 0;
  const loop = now => {
    if (disposed) return;
    if (!container.isConnected) { dispose(); return; }
    frameId = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    step(dt);
    renderer.render(scene, camera);
    heartbeat += dt;
    if (heartbeat > 0.25) { heartbeat = 0; emit(); }
  };
  frameId = requestAnimationFrame(loop);

  // ---------- Dış arayüz ----------
  return {
    isAlive: () => !disposed && container.isConnected,
    dispose,
    select(key) {
      if (carried) return say('Önce elinizdeki tüpü bırakın.', 'warn');
      heldKey = heldKey === key ? null : key;
      say(heldKey ? `${materialOf(heldKey).name} elinizde. Bir tüpe ya da ocağa tıklayın.` : 'Malzeme bırakıldı.', 'info');
      return heldKey;
    },
    toggleBurner() {
      lit = !lit;
      say(lit ? 'Ocak yandı.' : 'Ocak söndü.', 'info');
      return lit;
    },
    reset() {
      tubes.forEach((tube, i) => {
        const d = tube.userData;
        d.contents = [];
        d.reacted.clear();
        d.reactionColor = null;
        d.fx = [];
        d.emitAcc = {};
        d.temp = 20;
        d.volume = 1;
        d.content.visible = false;
        d.target.set(0xffffff);
        tube.position.set(TUBE_START[i][0], TOP + 0.22, TUBE_START[i][1]);
      });
      pLife.fill(0);
      for (let i = 0; i < MAX_PARTICLES; i++) pPos[i * 3 + 1] = -100;
      lit = false;
      heldKey = null;
      carried = null;
      player.x = 0; player.z = 2.1; player.yaw = 0; player.pitch = -0.2;
      say('Laboratuvar sıfırlandı.', 'info');
    },
  };
}
