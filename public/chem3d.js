// ============================================================================
// OKULUM — 3D KİMYA LABORATUVARI (birinci şahıs)
// Gezin: W A S D / ok tuşları. Bakış: sürükleyin. Etkileşim: tıklayın. Q: elindekini bırak.
// Raftan malzeme al, tüpe dök. Duvardaki periyodik tablodan element al (Na, Mg).
// Termometreyle tüpü ölç. Üçayağı ocağa kur, amyant telinin üstünde ısıt.
// Kurallar ve maddeler public/chemistry.js içinde.
// ============================================================================

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SUBSTANCES, ELEMENTS, applicableReactions, mixtureProps, elementInfo } from './chemistry.js';

const SHELF_KEYS = ['su', 'asit', 'baz', 'fenolftalein', 'toz', 'tuz', 'efervesan', 'kagit', 'kibrit', 'tripod', 'termometre'];
const ICONS = { su: '💧', asit: '🧪', baz: '🧫', fenolftalein: '🩷', toz: '⚪', tuz: '🧂', efervesan: '💊', kagit: '📄', kibrit: '🔥', tripod: '🔺', termometre: '🌡️' };
export const CHEM3D_MATERIALS = SHELF_KEYS.map(key => ({ key, name: SUBSTANCES[key].name, icon: ICONS[key], color: SUBSTANCES[key].color, tool: Boolean(SUBSTANCES[key].tool) }));

const TOP = 0.9;
const TABLE = { hx: 1.3, hz: 0.6 };
const BURNER_POS = [0, 0.05];
const HEAT_RANGE = 0.3;
const TUBE_START = [[-0.8, -0.1], [0.8, -0.1], [0, -0.35]];
const GLASS_H = 0.4;
const CONTENT_H = 0.36;
const MAX_PARTICLES = 420;
const MAX_CONTENTS = 3;
const SHELF_Y = [1.25, 1.75, 2.25];
const SHELF_X = [-2.4, -1.2, 0, 1.2, 2.4];
const PLAYER_SPEED = 1.8;
const ROOM = { minX: -3.5, maxX: 3.5, minZ: -3.1, maxZ: 3.4 };
const FX = {
  steam: { color: 0xffffff, rate: 18, vy: 0.35, spread: 0.05, life: 1.3, y: 0.42 },
  bubbles: { color: 0xcfefff, rate: 24, vy: 0.5, spread: 0.06, life: 0.9, y: 0.05 },
  smoke: { color: 0x666666, rate: 14, vy: 0.25, spread: 0.1, life: 1.6, y: 0.42 },
};

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.cursor = 'crosshair';
  container.appendChild(renderer.domElement);

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
  const flameLight = new THREE.PointLight(0xff8a2b, 0, 2);
  scene.add(flameLight);
  const blastLight = new THREE.PointLight(0xffb060, 0, 4);
  blastLight.position.set(0, TOP + 0.4, 0);
  scene.add(blastLight);

  // ---------- Oda ----------
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  // ---------- Dokular ----------
  const canvasTex = (size, paint, repeat = 1) => {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    paint(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 4;
    return t;
  };
  const woodTex = canvasTex(512, (g, s) => {
    g.fillStyle = '#b07c4f';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 240; i += 1) {
      g.strokeStyle = `rgba(90,50,20,${0.05 + Math.random() * 0.12})`;
      g.lineWidth = 0.6 + Math.random() * 1.6;
      const y = Math.random() * s;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(s * 0.3, y + (Math.random() - 0.5) * 14, s * 0.7, y + (Math.random() - 0.5) * 14, s, y);
      g.stroke();
    }
  }, 1);
  const tileTex = canvasTex(256, (g, s) => {
    g.fillStyle = '#e6e2da';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#b3ab9e';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, s - 3, s - 3);
    for (let i = 0; i < s * 0.6; i += 1) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  }, 5);
  const plasterTex = canvasTex(256, (g, s) => {
    g.fillStyle = '#eef2ee';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < s * 1.5; i += 1) { g.fillStyle = `rgba(80,90,80,${Math.random() * 0.035})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  }, 3);
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.5 });
  const plasterMat = new THREE.MeshStandardMaterial({ map: plasterTex, roughness: 0.95 });
  const floorMat = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.35 });
  const roundedBox = (w, h, d) => new RoundedBoxGeometry(w, h, d, 3, Math.min(0.02, Math.min(w, h, d) / 3));
  const addMesh = (geo, mat, x, y, z, parent = scene) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  // Renk sayısı verilirse standart malzeme, malzeme verilirse doğrudan kullanılır
  const addBox = (w, h, d, x, y, z, mat, parent = scene) =>
    addMesh(roundedBox(w, h, d), typeof mat === 'number' ? std(mat) : mat, x, y, z, parent);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  addBox(9, 3.2, 0.1, 0, 1.6, -3.7, plasterMat); // arka duvar
  addBox(0.1, 3.2, 9, -4.2, 1.6, 0, plasterMat); // sol duvar
  addBox(0.1, 3.2, 9, 4.2, 1.6, 0, plasterMat); // sağ duvar
  addBox(9, 0.1, 9, 0, 3.2, 0, plasterMat); // tavan
  SHELF_Y.forEach(y => addBox(5.4, 0.06, 0.5, 0, y, -3.4, 0x8d6e63));

  // Masa
  addBox(TABLE.hx * 2, 0.08, TABLE.hz * 2, 0, TOP - 0.04, 0, woodMat);
  [[-1.2, -0.5], [1.2, -0.5], [-1.2, 0.5], [1.2, 0.5]].forEach(([x, z]) => addBox(0.08, TOP - 0.08, 0.08, x, (TOP - 0.08) / 2, z, woodMat));

  // ---------- Periyodik tablo (sol duvarda) ----------
  const TILE = 64;
  const BOARD_W = 18 * TILE;
  const BOARD_H = TILE * 5; // 1 başlık + 4 periyot
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = BOARD_W;
  boardCanvas.height = BOARD_H;
  const bctx = boardCanvas.getContext('2d');
  bctx.fillStyle = '#fbfcfb';
  bctx.fillRect(0, 0, BOARD_W, BOARD_H);
  bctx.fillStyle = '#1b6b50';
  bctx.font = '600 34px system-ui, sans-serif';
  bctx.textAlign = 'center';
  bctx.fillText('Periyodik Tablo — tıklayıp element alın', BOARD_W / 2, 44);
  const CATEGORY = el => (['Li', 'Na', 'K'].includes(el[0]) ? '#ffd7c2' : ['Be', 'Mg', 'Ca'].includes(el[0]) ? '#ffe9c2' : el[2] >= 13 ? '#dbeaff' : '#e8f7ee');
  ELEMENTS.forEach(el => {
    const x = (el[2] - 1) * TILE;
    const y = TILE + (el[3] - 1) * TILE;
    bctx.fillStyle = CATEGORY(el);
    bctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
    bctx.fillStyle = '#17352b';
    bctx.font = '600 24px system-ui, sans-serif';
    bctx.textAlign = 'left';
    bctx.fillText(el[0], x + 8, y + 28);
    bctx.font = '12px system-ui, sans-serif';
    bctx.fillText(el[4].toFixed(1), x + 8, y + 50);
  });
  const boardTex = new THREE.CanvasTexture(boardCanvas);
  boardTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 4.6 * (BOARD_H / BOARD_W)),
    new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.6 })
  );
  board.position.set(-4.14, 1.5, 0);
  board.rotation.y = Math.PI / 2;
  board.userData = { kind: 'board' };
  scene.add(board);

  // ---------- Raftaki malzemeler ----------
  // Dönel geometri (profil: [yarıçap, yükseklik] noktaları)
  const lathe = pts => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 40);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.24, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide, depthWrite: false });
  const BOTTLE_OUTER = [[0, -0.13], [0.07, -0.13], [0.078, -0.115], [0.078, 0.05], [0.036, 0.085], [0.03, 0.12], [0.03, 0.14], [0, 0.14]];
  const BOTTLE_LIQUID = [[0, -0.12], [0.065, -0.12], [0.07, -0.1], [0.07, 0.04], [0, 0.04]];
  const bottles = [];
  SHELF_KEYS.forEach((key, i) => {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const s2 = SUBSTANCES[key];
    const group = new THREE.Group();
    if (s2.tool) {
      addMesh(roundedBox(0.24, 0.05, 0.06), new THREE.MeshStandardMaterial({ color: s2.color, roughness: 0.4, metalness: 0.2 }), 0, 0.03, 0, group);
    } else {
      group.add(new THREE.Mesh(lathe(BOTTLE_LIQUID), new THREE.MeshPhysicalMaterial({ color: s2.color, roughness: 0.15, transparent: true, opacity: 0.85 })));
      group.add(new THREE.Mesh(lathe(BOTTLE_OUTER), glassMat));
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.04, 20), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.5 }));
      cap.position.y = 0.16;
      group.add(cap);
    }
    group.position.set(SHELF_X[col], SHELF_Y[row] + (s2.tool ? 0 : 0.13), -3.4);
    group.userData = { kind: 'bottle', key };
    scene.add(group);
    bottles.push(group);
  });

  // ---------- Tüpler ----------
  const TUBE_GLASS = [[0, -0.2], [0.1, -0.2], [0.126, -0.19], [0.13, -0.17], [0.13, 0.19], [0.136, 0.2], [0.138, 0.21]];
  const TUBE_INNER = [[0, 0], [0.104, 0], [0.113, 0.012], [0.116, 0.03], [0.116, 1], [0, 1]];
  const createTube = (x, z) => {
    const root = new THREE.Group();
    const glass = new THREE.Mesh(lathe(TUBE_GLASS), glassMat);
    glass.castShadow = true;
    const content = new THREE.Mesh(
      lathe(TUBE_INNER),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.12, transparent: true, opacity: 0.9, clearcoat: 0.6 })
    );
    content.visible = false;
    content.position.y = -0.18;
    root.add(glass, content);
    root.position.set(x, TOP + 0.22, z);
    root.userData = {
      kind: 'tube', content, contents: [], lastAdded: null, reacted: new Set(), reactionColor: null,
      target: new THREE.Color(0xffffff), fx: [], emitAcc: {}, temp: 20, volume: 1, home: [x, z],
    };
    scene.add(root);
    return root;
  };
  const tubes = TUBE_START.map(([x, z]) => createTube(x, z));

  // ---------- İspirto ocağı, üçayak, amyant teli ----------
  const burner = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x9aa6ad, metalness: 0.6, roughness: 0.35 }));
  body.position.y = 0.06;
  body.castShadow = true;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 20), new THREE.MeshStandardMaterial({ color: 0x5f6b72, metalness: 0.5, roughness: 0.4 }));
  cap.position.y = 0.135;
  const flame = new THREE.Group();
  const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 14), new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5500, emissiveIntensity: 0.9, transparent: true, opacity: 0.9 }));
  outerFlame.position.y = 0.16;
  const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffd000, emissiveIntensity: 1 }));
  innerFlame.position.y = 0.1;
  flame.add(outerFlame, innerFlame);
  flame.position.y = 0.15;
  flame.visible = false;
  burner.add(body, cap, flame);
  burner.position.set(BURNER_POS[0], TOP, BURNER_POS[1]);
  burner.userData = { kind: 'burner' };
  scene.add(burner);

  const tripod = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x6b6b6b, metalness: 0.7, roughness: 0.4 });
  for (let k = 0; k < 3; k += 1) {
    const a = (k / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8), iron);
    leg.position.set(Math.cos(a) * 0.2, 0.25, Math.sin(a) * 0.2);
    leg.rotation.set(Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18);
    leg.castShadow = true;
    tripod.add(leg);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.01, 8, 36), iron);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.5;
  const gauze = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.44, 12, 12), new THREE.MeshBasicMaterial({ color: 0x8e8e8e, wireframe: true }));
  gauze.rotation.x = -Math.PI / 2;
  gauze.position.y = 0.5;
  tripod.add(ring, gauze);
  tripod.position.set(BURNER_POS[0], TOP, BURNER_POS[1]);
  tripod.visible = false;
  tripod.userData = { kind: 'tripod' };
  scene.add(tripod);

  // ---------- Parçacıklar ----------
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAX_PARTICLES * 3);
  const pCol = new Float32Array(MAX_PARTICLES * 3);
  const pVel = new Float32Array(MAX_PARTICLES * 3);
  const pLife = new Float32Array(MAX_PARTICLES);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  for (let i = 0; i < MAX_PARTICLES; i++) pPos[i * 3 + 1] = -100;
  scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false })));
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
  const blast = (tube) => {
    for (let i = 0; i < 90; i += 1) {
      const hot = Math.random() < 0.5;
      spawn(tube.position.x, TOP + 0.3, tube.position.z, hot ? 0xffa040 : 0xffffff, 0.8 + Math.random() * 1.6, 1.8, 1.1);
    }
  };

  // ---------- Oyuncu ----------
  const player = { x: 0, z: 2.6, yaw: 0, pitch: -0.2 };
  const keys = new Set();
  const pickables = () => [...bottles, ...tubes, burner, tripod, board];

  // ---------- Durum ----------
  let heldKey = null;
  let carried = null;
  let lit = false;
  let tripodOn = false;
  let shake = 0;
  let disposed = false;
  let time = 0;
  let dragging = false;
  let press = null;

  const materialOf = key => SUBSTANCES[key];
  const hottest = () => Math.round(Math.max(...tubes.map(t => t.userData.temp)));
  const heldLabel = () => {
    if (carried) return 'Elinizde: tüp';
    if (heldKey) return `Elinizde: ${materialOf(heldKey).name}`;
    return '';
  };
  const tubeInfo = tube => {
    const d = tube.userData;
    const mix = mixtureProps(d.contents);
    const contents = d.contents.length ? d.contents.map(k => materialOf(k).name).join(' + ') : 'boş';
    return `Tüp: ${Math.round(d.temp)}°C · ${mix.volumeMl} mL · ${mix.massG} g · yoğunluk ${mix.densityGmL} g/mL · ${contents}`;
  };
  const emit = (message, tone, info) => {
    if (disposed) return;
    heldEl.textContent = heldLabel();
    onStatus({ hottest: hottest(), selected: heldKey, carrying: Boolean(carried), burnerOn: lit, message, tone, info });
  };
  const say = (message, tone = 'info') => {
    if (disposed) return;
    msgEl.textContent = message;
    msgEl.dataset.tone = tone;
    emit(message, tone);
  };

  // ---------- Tepkimeler ----------
  const averageColor = d => {
    const sum = new THREE.Color(0, 0, 0);
    d.contents.forEach(k => sum.add(new THREE.Color(materialOf(k).color)));
    return d.contents.length ? sum.multiplyScalar(1 / d.contents.length) : new THREE.Color(0xffffff);
  };

  const checkReactions = tube => {
    const d = tube.userData;
    const events = applicableReactions({ contents: d.contents, temp: d.temp, lastAdded: d.lastAdded, reacted: d.reacted });
    for (const r of events) {
      d.reacted.add(r.id);
      d.reactionColor = new THREE.Color(r.color);
      if (r.heat) d.temp += r.heat;
      if (r.fx && !d.fx.some(f => f.type === r.fx.type)) d.fx.push(r.fx);
      if (r.explosion) { blast(tube); shake = 1; blastLight.intensity = 6; }
      say(`${r.name}: ${r.desc}`, r.tone);
    }
  };

  const pour = (tube, key) => {
    const d = tube.userData;
    const mat = materialOf(key);
    if (d.contents.includes(key)) return say(`${mat.name} bu tüpte zaten var.`, 'warn');
    if (d.contents.length >= MAX_CONTENTS) return say('Tüp dolu: en fazla üç malzeme karıştırılabilir.', 'warn');
    d.contents.push(key);
    d.lastAdded = key;
    d.target.copy(d.reactionColor ?? averageColor(d));
    heldKey = null;
    say(`${mat.name} tüpe döküldü.`, 'info');
    checkReactions(tube);
  };

  // ---------- Girdi ----------
  const onKeyDown = e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (e.key.toLowerCase() === 'q' && !e.repeat) { dropAll(); return; }
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
  const hitCenter = () => {
    ray.setFromCamera(ndcCenter, camera);
    return ray.intersectObjects(pickables(), true).find(h => rootOf(h.object)?.userData.kind !== 'tripod' || tripodOn) ?? null;
  };
  const centerHit = () => {
    const h = hitCenter();
    return h ? rootOf(h.object) : null;
  };
  const tableTarget = () => {
    ray.setFromCamera(ndcCenter, camera);
    if (!ray.ray.intersectPlane(tablePlane, hitPoint)) return null;
    if (Math.abs(hitPoint.x) > TABLE.hx - 0.15 || Math.abs(hitPoint.z) > TABLE.hz - 0.15) return null;
    return hitPoint.clone();
  };

  const dropCarried = () => {
    if (!carried) return false;
    const p = tableTarget();
    const [hx, hz] = carried.userData.home;
    const x = THREE.MathUtils.clamp(p ? p.x : hx, -TABLE.hx + 0.2, TABLE.hx - 0.2);
    const z = THREE.MathUtils.clamp(p ? p.z : hz, -TABLE.hz + 0.2, TABLE.hz - 0.2);
    carried.position.set(x, TOP + 0.22, z);
    carried.userData.home = [x, z];
    carried = null;
    return true;
  };
  const dropHeld = () => {
    if (!heldKey) return false;
    heldKey = null;
    return true;
  };
  const dropAll = () => {
    const had = dropCarried() || dropHeld();
    say(had ? 'Elinizdekini bıraktınız.' : 'Elinizde bir şey yok.', 'info');
  };

  const boardElement = hit => {
    const u = hit.uv.x;
    const vPx = (1 - hit.uv.y) * BOARD_H;
    if (vPx < TILE) return null;
    const group = Math.floor(u * 18) + 1;
    const period = Math.floor((vPx - TILE) / TILE) + 1;
    const el = ELEMENTS.find(e => e[2] === group && e[3] === period);
    return el ? el[0] : null;
  };

  const interact = () => {
    const hit = hitCenter();
    const target = hit ? rootOf(hit.object) : null;
    if (carried) { dropCarried(); return say('Tüp bırakıldı.', 'info'); }

    if (target?.userData.kind === 'board') {
      const symbol = boardElement(hit);
      if (!symbol) return say('Bu alan periyodik tablo dışında.', 'info');
      const e = elementInfo(symbol);
      if (e.item) {
        if (heldKey) dropHeld();
        heldKey = e.item;
        return say(`${e.name} (${e.symbol}) alındı. Tüpe ya da suya dökün.`, 'ok');
      }
      return say(`${e.name} (${e.symbol}): grup ${e.group}, periyot ${e.period}, atom kütlesi ${e.mass} g/mol. Bu element laboratuvarda yok.`, 'info');
    }

    if (heldKey) {
      const held = materialOf(heldKey);
      if (target?.userData.kind === 'bottle') {
        if (target.userData.key === heldKey) { dropHeld(); return say('Bıraktınız.', 'info'); }
        heldKey = target.userData.key;
        return say(`${materialOf(heldKey).name} elinizde. Bir tüpe ya da ocağa tıklayın.`, 'info');
      }
      if (target?.userData.kind === 'tube') {
        if (heldKey === 'termometre') {
          dropHeld();
          return say(`Sıcaklık: ${Math.round(target.userData.temp)} °C`, 'info');
        }
        if (held.tool) { dropHeld(); return say(`${held.name} tüpe kullanılmaz; bıraktınız.`, 'warn'); }
        return pour(target, heldKey);
      }
      if (target?.userData.kind === 'burner') {
        if (heldKey === 'kibrit') {
          lit = true; dropHeld();
          return say(tripodOn ? 'Ocak yandı. Tüpü amyant telinin üstüne koyun.' : 'Ocak yandı. Önce üç ayaklıyı ocağın üstüne koyun.', 'ok');
        }
        if (heldKey === 'tripod') {
          if (tripodOn) return say('Üç ayaklı zaten ocağın üstünde.', 'warn');
          tripodOn = true; dropHeld();
          return say('Üç ayaklı kuruldu. Tüpü amyant telinin üstüne koyup ısıtın.', 'ok');
        }
        dropHeld();
        return say(`${held.name} ocakta kullanılmaz; bıraktınız.`, 'warn');
      }
      dropHeld();
      return say(`${held.name} bırakıldı.`, 'info');
    }

    if (target?.userData.kind === 'bottle') {
      heldKey = target.userData.key;
      return say(`${materialOf(heldKey).name} elinizde. Bir tüpe ya da ocağa tıklayın.`, 'info');
    }
    if (target?.userData.kind === 'tube') {
      carried = target;
      return say('Tüpü aldınız. Bırakmak için masaya tıklayın ya da Q tuşuna basın.', 'info');
    }
    if (target?.userData.kind === 'tripod') {
      tripodOn = false;
      heldKey = 'tripod';
      return say('Üç ayaklıyı aldınız. Bırakmak için tıklayın ya da Q.', 'info');
    }
    if (target?.userData.kind === 'burner') {
      lit = !lit;
      const note = lit && !tripodOn ? ' Üç ayaklıyı koymayı unutmayın.' : '';
      return say(lit ? `Ocak yandı.${note}` : 'Ocak söndü.', 'info');
    }
    return null;
  };

  const onPointerDown = e => {
    press = { x: e.clientX, y: e.clientY, moved: false, lx: e.clientX, ly: e.clientY };
    renderer.domElement.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = e => {
    if (!press) return;
    if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) { press.moved = true; dragging = true; }
    if (dragging) {
      player.yaw -= (e.clientX - press.lx) * 0.005;
      player.pitch = THREE.MathUtils.clamp(player.pitch - (e.clientY - press.ly) * 0.004, -1.2, 1.2);
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

  // ---------- Her karede ----------
  const collidesTable = (x, z) => Math.abs(x) < TABLE.hx + 0.2 && Math.abs(z) < TABLE.hz + 0.2;
  const movePlayer = dt => {
    const forward = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
    const strafe = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    if (!forward && !strafe) return;
    const sin = Math.sin(player.yaw);
    const cos = Math.cos(player.yaw);
    let dx = -sin * forward + cos * strafe;
    let dz = -cos * forward - sin * strafe;
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
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 2.2);
      camera.position.x += (Math.random() - 0.5) * shake * 0.08;
      camera.position.y += (Math.random() - 0.5) * shake * 0.08;
    }
    blastLight.intensity = Math.max(0, blastLight.intensity - dt * 8);

    if (carried) {
      const p = tableTarget();
      if (p) carried.position.lerp(new THREE.Vector3(p.x, TOP + 0.4, p.z), Math.min(1, dt * 10));
    }

    flame.visible = lit;
    tripod.visible = tripodOn;
    if (lit) flame.scale.set(1 + Math.sin(time * 18) * 0.08, 1 + Math.sin(time * 23) * 0.12, 1 + Math.sin(time * 18) * 0.08);
    flameLight.position.set(BURNER_POS[0], TOP + 0.3, BURNER_POS[1]);
    flameLight.intensity = lit ? 1.2 + Math.sin(time * 15) * 0.15 : 0;

    for (const tube of tubes) {
      const d = tube.userData;
      const inRange = Math.hypot(tube.position.x - BURNER_POS[0], tube.position.z - BURNER_POS[1]) < HEAT_RANGE;
      const onGauze = tripodOn && inRange && tube !== carried;
      const near = lit && onGauze;
      if (tube !== carried) {
        const yGoal = onGauze ? TOP + 0.72 : TOP + 0.22;
        tube.position.y += (yGoal - tube.position.y) * Math.min(1, dt * 8);
      }
      const goal = near ? 260 : 20;
      const rate = near ? 90 : 35;
      const delta = goal - d.temp;
      d.temp += Math.sign(delta) * Math.min(Math.abs(delta), rate * dt);
      if (d.reacted.has('kaynama') && d.temp >= 100) d.volume = Math.max(0.35, d.volume - dt * 0.02);
      checkReactions(tube);

      const fillSum = d.contents.reduce((s, k) => s + (materialOf(k).fill ?? 0), 0);
      const level = Math.min(1, fillSum) * d.volume;
      d.content.visible = level > 0.001;
      if (d.content.visible) {
        const h = Math.max(0.001, level * CONTENT_H);
        d.content.scale.y = h;
        d.content.position.y = -0.18;
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
      pVel[i * 3 + 1] -= dt * 0.6;
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;

    // İpucu ve tüp bilgisi
    const target = centerHit();
    let hint = '';
    let info = '';
    if (carried) hint = 'Tüp elinizde: tıklayın ya da Q ile bırakın';
    else if (heldKey) hint = `Elinizde ${materialOf(heldKey).name}: tüpe/ocağa tıklayın, boşluğa tıklayın ya da Q`;
    else if (target?.userData.kind === 'bottle') hint = `Al: ${materialOf(target.userData.key).name}`;
    else if (target?.userData.kind === 'tube') { hint = 'Tüp: malzeme dökmek için elinizde malzeme olmalı; boşsa tüpü alın'; info = tubeInfo(target); }
    else if (target?.userData.kind === 'burner') hint = lit ? 'Ocağı söndür' : 'Ocağı yak (kibrit ve üç ayaklı gerekir)';
    else if (target?.userData.kind === 'tripod') hint = 'Üç ayaklıyı al';
    else if (target?.userData.kind === 'board') hint = 'Periyodik tablo: element almak için tıklayın';
    else hint = 'W A S D ile gezin, sürükleyerek bakın';
    if (hint !== hintEl.textContent) hintEl.textContent = hint;
    if (info) onStatusInfo = info; else onStatusInfo = '';
  };
  let onStatusInfo = '';

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
    [boardTex, woodTex, tileTex, plasterTex].forEach(t => t.dispose());
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
    if (heartbeat > 0.2) { heartbeat = 0; emit(undefined, undefined, onStatusInfo); }
  };
  frameId = requestAnimationFrame(loop);

  // ---------- Dış arayüz ----------
  return {
    isAlive: () => !disposed && container.isConnected,
    dispose,
    select(key) {
      dropCarried();
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
        Object.assign(d, { contents: [], lastAdded: null, reactionColor: null, fx: [], emitAcc: {}, temp: 20, volume: 1, home: [TUBE_START[i][0], TUBE_START[i][1]] });
        d.reacted.clear();
        d.content.visible = false;
        d.target.set(0xffffff);
        tube.position.set(TUBE_START[i][0], TOP + 0.22, TUBE_START[i][1]);
      });
      pLife.fill(0);
      for (let i = 0; i < MAX_PARTICLES; i++) pPos[i * 3 + 1] = -100;
      lit = false;
      tripodOn = false;
      heldKey = null;
      carried = null;
      player.x = 0; player.z = 2.6; player.yaw = 0; player.pitch = -0.2;
      say('Laboratuvar sıfırlandı.', 'info');
    },
  };
}
