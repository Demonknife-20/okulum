// ============================================================================
// OKULUM — 3D KİMYA LABORATUVARI (birinci şahıs)
// Gezin: W A S D / ok tuşları. Bakış: sürükleyin. Etkileşim: tıklayın. Q: elindekini bırak.
// Önce koruyucu ekipmanı (eldiven, gözlük, önlük) raftan/askıdan alıp giyin.
// Isınma fiziksel olarak hesaplanır (kütle × özgül ısı). Element tablosu: 118 element.
// Radyoaktif maddeler yalnızca kutudan cımbızla alınır; radyasyon ölçerle doz okunur.
// Kurallar ve veriler: public/chemistry.js
// ============================================================================

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  SUBSTANCES, ELEMENTS, elementLayout, elementBySymbol, elementItemKey, ensureElementSubstance,
  applicableReactions, mixtureProps, stepTemperature, doseRate, requiredPpe, missingPpe, elementInfo,
} from './chemistry.js';

const SHELF_KEYS = ['su', 'asit', 'baz', 'fenolftalein', 'toz', 'tuz', 'efervesan', 'kagit', 'kibrit', 'tripod', 'termometre', 'tup', 'cimbiz', 'radyasyon', 'etanol', 'yag', 'permanganat', 'bakir_sulfat', 'cinko_toz', 'kalsiyum_karbonat'];
const PPE_KEYS = ['eldiven', 'gozluk', 'onluk'];
const ICONS = { etanol: '🍶', yag: '🫒', permanganat: '🟣', bakir_sulfat: '🔵', cinko_toz: '⚙️', kalsiyum_karbonat: '🦴', su: '💧', asit: '🧪', baz: '🧫', fenolftalein: '🩷', toz: '⚪', tuz: '🧂', efervesan: '💊', kagit: '📄', kibrit: '🔥', tripod: '🔺', termometre: '🌡️', tup: '🧪', cimbiz: '🥢', radyasyon: '☢️', eldiven: '🧤', gozluk: '🥽', onluk: '🥼' };
export const CHEM3D_MATERIALS = [...SHELF_KEYS, ...PPE_KEYS].map(key => ({ key, name: SUBSTANCES[key].name, icon: ICONS[key], color: SUBSTANCES[key].color, tool: Boolean(SUBSTANCES[key].tool) }));

const TOP = 0.9;
const TABLE = { hx: 1.3, hz: 0.6 };
const BURNER_POS = [0, 0.05];
const HEAT_RANGE = 0.3;
const TUBE_START = [[-0.8, -0.1], [0.8, -0.1], [0, -0.35]];
const MAX_TUBES = 5;
const GLASS_H = 0.4;
const CONTENT_H = 0.36;
const MAX_PARTICLES = 420;
const MAX_CONTENTS = 3;
const SHELF_Y = [0.95, 1.3, 1.65, 2.0];
const SHELF_X = [-2.4, -1.2, 0, 1.2, 2.4];
const PLAYER_SPEED = 1.8;
const ROOM = { minX: -3.5, maxX: 3.5, minZ: -3.1, maxZ: 3.4 };
const BOX_POS = [1.0, 0.3];
const BOX_ITEMS = ['Ra', 'U', 'Po', 'Th'];
const FX = {
  steam: { color: 0xffffff, rate: 18, vy: 0.9, spread: 0.08, life: 2.0, y: 0.42 },
  bubbles: { color: 0xcfefff, rate: 24, vy: 0.5, spread: 0.06, life: 0.9, y: 0.05 },
  smoke: { color: 0x666666, rate: 14, vy: 0.25, spread: 0.1, life: 1.6, y: 0.42 },
};

export function initChem3d(containerId, { onStatus = () => {} } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  const width = () => Math.max(container.clientWidth, 1);
  const height = () => Math.max(container.clientHeight, 1);

  // ---------- Sahne, kamera, render ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe7ea);
  const camera = new THREE.PerspectiveCamera(68, width() / height(), 0.05, 40);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width(), height());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
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
  hud.innerHTML = '<div class="chem3d-pad" data-pad><button type="button" data-k="w">▲</button><div class="chem3d-pad-row"><button type="button" data-k="a">◀</button><button type="button" data-k="s">▼</button><button type="button" data-k="d">▶</button></div></div><div class="chem3d-cross">+</div><div class="chem3d-held" data-held></div><div class="chem3d-msg-hud" data-msg></div><div class="chem3d-hint" data-hint></div>'
    + '<div class="chem3d-lcd" data-lcd hidden><div class="chem3d-lcd-title" data-lcd-title>Lazerli termometre</div><div class="chem3d-lcd-val" data-lcd-val>— °C</div><div class="chem3d-lcd-info" data-lcd-info></div></div>';
  container.appendChild(hud);
  const hintEl = hud.querySelector('[data-hint]');
  const msgEl = hud.querySelector('[data-msg]');
  const heldEl = hud.querySelector('[data-held]');
  const lcd = hud.querySelector('[data-lcd]');
  const padKeys = new Map();
  hud.querySelectorAll('[data-pad] button').forEach(btn => {
    const k = btn.dataset.k;
    const down = e => { e.preventDefault(); keys.add(k); btn.setPointerCapture?.(e.pointerId); };
    const up = () => keys.delete(k);
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
    padKeys.set(btn, { down, up });
  });
  const lcdTitle = hud.querySelector('[data-lcd-title]');
  const lcdVal = hud.querySelector('[data-lcd-val]');
  const lcdInfo = hud.querySelector('[data-lcd-info]');

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

  // ---------- Dokular ve yardımcılar ----------
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
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
  });
  const tileTex = canvasTex(256, (g, s) => {
    g.fillStyle = '#e6e2da';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#b3ab9e';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, s - 3, s - 3);
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
  const addBox = (w, h, d, x, y, z, mat, parent = scene) => addMesh(roundedBox(w, h, d), typeof mat === 'number' ? std(mat) : mat, x, y, z, parent);
  const lathe = pts => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 40);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.24, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide, depthWrite: false });

  // ---------- Oda ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  addBox(9, 3.2, 0.1, 0, 1.6, -3.7, plasterMat);
  addBox(0.1, 3.2, 9, -4.2, 1.6, 0, plasterMat);
  addBox(0.1, 3.2, 9, 4.2, 1.6, 0, plasterMat);
  addBox(9, 0.1, 9, 0, 3.2, 0, plasterMat);
  SHELF_Y.forEach(y => addBox(5.4, 0.06, 0.5, 0, y, -3.4, 0x8d6e63));
  addBox(TABLE.hx * 2, 0.08, TABLE.hz * 2, 0, TOP - 0.04, 0, woodMat);
  [[-1.2, -0.5], [1.2, -0.5], [-1.2, 0.5], [1.2, 0.5]].forEach(([x, z]) => addBox(0.08, TOP - 0.08, 0.08, x, (TOP - 0.08) / 2, z, woodMat));

  // ---------- Periyodik tablo (sol duvarda, 118 element) ----------
  const TILE = 64;
  const TITLE = 64;
  const GAP = 32;
  const BOARD_W = 18 * TILE;
  const BOARD_H = TITLE + 7 * TILE + GAP + 2 * TILE;
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = BOARD_W;
  boardCanvas.height = BOARD_H;
  const bctx = boardCanvas.getContext('2d');
  const CATEGORY_COLOR = { a: '#ffd7c2', e: '#ffe9c2', t: '#dfe9f7', p: '#e4ece8', m: '#e8e2c8', n: '#e8f7ee', h: '#d4f3ea', g: '#eadcff', l: '#e3f3c8', c: '#ffd2d2' };
  bctx.fillStyle = '#fbfcfb';
  bctx.fillRect(0, 0, BOARD_W, BOARD_H);
  bctx.fillStyle = '#1b6b50';
  bctx.font = '600 34px system-ui, sans-serif';
  bctx.textAlign = 'center';
  bctx.fillText('Periyodik Tablo — tıklayıp element alın (kırmızı: radyoaktif)', BOARD_W / 2, 44);
  const tilePos = e => {
    const l = elementLayout(e);
    if (l.row === 'main') return { x: (l.group - 1) * TILE, y: TITLE + (l.period - 1) * TILE };
    if (l.row === 'lan') return { x: (2 + l.col) * TILE, y: TITLE + 7 * TILE + GAP };
    return { x: (2 + l.col) * TILE, y: TITLE + 7 * TILE + GAP + TILE };
  };
  ELEMENTS.forEach(e => {
    const { x, y } = tilePos(e);
    bctx.fillStyle = CATEGORY_COLOR[e.cat] ?? '#eeeeee';
    bctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    if (e.radioactive) {
      bctx.strokeStyle = '#d32f2f';
      bctx.lineWidth = 3;
      bctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
    }
    bctx.fillStyle = '#17352b';
    bctx.font = '600 22px system-ui, sans-serif';
    bctx.textAlign = 'left';
    bctx.fillText(e.symbol, x + 6, y + 26);
    bctx.font = '11px system-ui, sans-serif';
    bctx.fillText(String(e.z), x + 6, y + 44);
    bctx.fillText(e.mass.toFixed(1), x + 6, y + 58);
  });
  const boardTex = new THREE.CanvasTexture(boardCanvas);
  boardTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 4.8 * (BOARD_H / BOARD_W)),
    new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.6 })
  );
  board.position.set(-4.14, 1.6, 0);
  board.rotation.y = Math.PI / 2;
  board.userData = { kind: 'board' };
  scene.add(board);

  // Tabloda tıklanan noktadaki elementi bulur
  const elementAtUv = uv => {
    const px = uv.x * BOARD_W;
    const py = (1 - uv.y) * BOARD_H;
    const col = Math.floor(px / TILE);
    if (py < TITLE) return null;
    if (py < TITLE + 7 * TILE) {
      const period = Math.floor((py - TITLE) / TILE) + 1;
      return ELEMENTS.find(e => {
        const l = elementLayout(e);
        return l.row === 'main' && l.period === period && l.group === col + 1;
      }) ?? null;
    }
    const lanTop = TITLE + 7 * TILE + GAP;
    if (py >= lanTop && py < lanTop + TILE) return ELEMENTS.find(e => elementLayout(e).row === 'lan' && elementLayout(e).col === col - 2) ?? null;
    if (py >= lanTop + TILE && py < lanTop + 2 * TILE) return ELEMENTS.find(e => elementLayout(e).row === 'act' && elementLayout(e).col === col - 2) ?? null;
    return null;
  };

  // ---------- Raftaki malzemeler ----------
  const bottles = [];
  const lathePts = {
    outer: [[0, -0.13], [0.07, -0.13], [0.078, -0.115], [0.078, 0.05], [0.036, 0.085], [0.03, 0.12], [0.03, 0.14], [0, 0.14]],
    liquid: [[0, -0.12], [0.065, -0.12], [0.07, -0.1], [0.07, 0.04], [0, 0.04]],
  };
  SHELF_KEYS.forEach((key, i) => {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const s = SUBSTANCES[key];
    const group = new THREE.Group();
    if (s.tool) {
      addMesh(roundedBox(0.24, 0.05, 0.06), new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.4, metalness: 0.2 }), 0, 0.03, 0, group);
    } else {
      group.add(new THREE.Mesh(lathe(lathePts.liquid), new THREE.MeshPhysicalMaterial({ color: s.color, roughness: 0.15, transparent: true, opacity: 0.85 })));
      group.add(new THREE.Mesh(lathe(lathePts.outer), glassMat));
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.04, 20), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.5 }));
      cap.position.y = 0.16;
      group.add(cap);
    }
    group.position.set(SHELF_X[col], SHELF_Y[row] + (s.tool ? 0 : 0.13), -3.4);
    group.userData = { kind: 'bottle', key };
    scene.add(group);
    bottles.push(group);
  });

  // ---------- Koruyucu ekipman askısı (sağ duvar) ----------
  const rack = new THREE.Group();
  rack.position.set(4.12, 1.4, 0);
  rack.rotation.y = -Math.PI / 2;
  scene.add(rack);
  addBox(1.6, 0.06, 0.25, 0, 0.6, 0, 0x8d6e63, rack);
  const ppeItems = {};
  // Eldiven: iki küçük mavi kutu
  const gloves = new THREE.Group();
  addBox(0.12, 0.2, 0.05, -0.12, 0, 0, 0x42a5f5, gloves);
  addBox(0.12, 0.2, 0.05, 0.12, 0, 0, 0x42a5f5, gloves);
  gloves.position.set(-0.5, 0.95, 0.05);
  rack.add(gloves);
  ppeItems.eldiven = gloves;
  // Gözlük: çerçeve + lens
  const goggleModel = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.4 });
  [-0.07, 0.07].forEach(x => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 8, 24), frameMat);
    ring.position.x = x;
    goggleModel.add(ring);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.047, 24), new THREE.MeshPhysicalMaterial({ color: 0x90caf9, transparent: true, opacity: 0.35, roughness: 0.05 }));
    lens.position.x = x;
    lens.position.z = 0.002;
    goggleModel.add(lens);
  });
  goggleModel.position.set(0, 0.95, 0.05);
  rack.add(goggleModel);
  ppeItems.gozluk = goggleModel;
  // Önlük: beyaz kıyafet
  const coatModel = addBox(0.5, 0.7, 0.04, 0, 0.95, 0.05, 0xf5f5f5, rack);
  ppeItems.onluk = coatModel;
  ppeItems.eldiven.position.x = -0.5;
  ppeItems.gozluk.position.x = 0;
  ppeItems.onluk.position.x = 0.5;
  // Tıklama için kullanıcı verisi
  PPE_KEYS.forEach(k => ppeItems[k].traverse(o => { o.userData = { kind: 'ppe', key: k }; }));
  ppeItems.eldiven.userData = { kind: 'ppe', key: 'eldiven' };
  ppeItems.gozluk.userData = { kind: 'ppe', key: 'gozluk' };
  ppeItems.onluk.userData = { kind: 'ppe', key: 'onluk' };
  const ppeHitList = () => PPE_KEYS.map(k => ppeItems[k]);

  // ---------- Radyoaktif kutu (masada) ----------
  const box = new THREE.Group();
  box.position.set(BOX_POS[0], TOP, BOX_POS[1]);
  addBox(0.5, 0.18, 0.34, 0, 0.09, 0, 0x37474f, box);
  const lid = new THREE.Group();
  addBox(0.52, 0.04, 0.36, 0, 0.02, 0, 0x455a64, lid);
  addBox(0.08, 0.03, 0.08, 0, 0.05, 0, 0xffb300, lid);
  lid.position.set(0, 0.18, -0.17);
  box.add(lid);
  // Radyasyon simgesi
  const sign = new THREE.Mesh(new THREE.CircleGeometry(0.05, 3), new THREE.MeshBasicMaterial({ color: 0xffd600 }));
  sign.position.set(0, 0.095, 0.172);
  box.add(sign);
  box.userData = { kind: 'box' };
  lid.userData = { kind: 'box' };
  scene.add(box);
  let boxOpen = false;
  let boxItems = [...BOX_ITEMS];
  const boxPos = () => new THREE.Vector3(BOX_POS[0], TOP + 0.1, BOX_POS[1]);

  // ---------- Tüpler ----------
  const TUBE_GLASS = [[0, -0.2], [0.1, -0.2], [0.126, -0.19], [0.13, -0.17], [0.13, 0.19], [0.136, 0.2], [0.138, 0.21]];
  const TUBE_INNER = [[0, 0], [0.104, 0], [0.113, 0.012], [0.116, 0.03], [0.116, 1], [0, 1]];
  const createTube = (x, z) => {
    const root = new THREE.Group();
    const glass = new THREE.Mesh(lathe(TUBE_GLASS), glassMat);
    glass.castShadow = true;
    const content = new THREE.Mesh(lathe(TUBE_INNER), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.12, transparent: true, opacity: 0.9, clearcoat: 0.6 }));
    content.visible = false;
    content.position.y = -0.18;
    root.add(glass, content);
    // Ölçek çizgileri: 0, 10, 20, 30 mL işaretleri (sağ tarafta)
    [0.05, 0.1, 0.15, 0.19].forEach((y, i) => {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(i % 2 ? 0.03 : 0.05, 0.003, 0.003), new THREE.MeshBasicMaterial({ color: 0x37474f }));
      mark.position.set(0.14, y - 0.05, 0);
      root.add(mark);
    });
    root.position.set(x, TOP + 0.22, z);
    root.userData = {
      kind: 'tube', content, contents: [], lastAdded: null, reacted: new Set(), reactionColor: null,
      target: new THREE.Color(0xffffff), fx: [], emitAcc: {}, temp: 20, volume: 1, home: [x, z],
    };
    scene.add(root);
    return root;
  };
  const tubes = TUBE_START.map(([x, z]) => createTube(x, z));
  const spawnTube = (x, z) => {
    const t = createTube(x, z);
    tubes.push(t);
    return t;
  };
  const removeExtraTubes = () => {
    while (tubes.length > TUBE_START.length) {
      const t = tubes.pop();
      scene.remove(t);
      t.children.forEach(c => { c.geometry?.dispose(); c.material?.dispose(); });
    }
  };

  // ---------- İspirto ocağı, üçayak, amyant teli ----------
  const burner = new THREE.Group();
  addMesh(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x9aa6ad, metalness: 0.6, roughness: 0.35 }), 0, 0.06, 0, burner);
  addMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 20), new THREE.MeshStandardMaterial({ color: 0x5f6b72, metalness: 0.5, roughness: 0.4 }), 0, 0.135, 0, burner);
  const flame = new THREE.Group();
  const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 14), new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5500, emissiveIntensity: 0.9, transparent: true, opacity: 0.9 }));
  outerFlame.position.y = 0.16;
  const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffd000, emissiveIntensity: 1 }));
  innerFlame.position.y = 0.1;
  flame.add(outerFlame, innerFlame);
  flame.position.y = 0.15;
  flame.visible = false;
  burner.add(flame);
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
  const blast = tube => {
    for (let i = 0; i < 90; i += 1) {
      const hot = Math.random() < 0.5;
      spawn(tube.position.x, TOP + 0.3, tube.position.z, hot ? 0xffa040 : 0xffffff, 0.8 + Math.random() * 1.6, 1.8, 1.1);
    }
  };

  // ---------- Kollar, önlük, gözlük (birinci şahıs) ----------
  const arms = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf0c8a0, roughness: 0.7 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x42a5f5, roughness: 0.5 });
  const leftArm = addMesh(roundedBox(0.14, 0.14, 0.42), skinMat, -0.24, -0.3, -0.5, arms);
  const rightArm = addMesh(roundedBox(0.14, 0.14, 0.42), skinMat, 0.24, -0.3, -0.5, arms);
  leftArm.rotation.x = 0.25;
  rightArm.rotation.x = 0.25;
  camera.add(arms);
  const coatOverlay = new THREE.Group();
  addBox(0.09, 0.22, 0.02, -0.4, -0.3, -0.46, 0xf5f5f5, coatOverlay);
  addBox(0.09, 0.22, 0.02, 0.4, -0.3, -0.46, 0xf5f5f5, coatOverlay);
  coatOverlay.visible = false;
  camera.add(coatOverlay);
  const goggleView = new THREE.Group();
  [-0.05, 0.05].forEach(x => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 8, 20), frameMat);
    r.position.set(x, 0, 0);
    goggleView.add(r);
  });
  goggleView.position.set(0, -0.35, -0.3);
  goggleView.visible = false;
  camera.add(goggleView);
  const tongsView = new THREE.Group();
  addBox(0.012, 0.012, 0.22, -0.02, 0, 0, 0xb0bec5, tongsView);
  addBox(0.012, 0.012, 0.22, 0.02, 0, 0, 0xb0bec5, tongsView);
  tongsView.position.set(0.2, -0.28, -0.45);
  tongsView.visible = false;
  camera.add(tongsView);

  // ---------- Oyuncu ----------
  const player = { x: 0, z: 2.6, yaw: 0, pitch: -0.12 };
  const keys = new Set();
  const pickables = () => [...bottles, ...tubes, burner, tripod, board, box, ...ppeHitList()];

  // ---------- Durum ----------
  let heldKey = null;       // elde tutulan malzeme veya alet
  let tongsSample = null;   // cımbızın tuttuğu radyoaktif örnek (sembol)
  let carried = null;       // elde tutulan tüp
  let lit = false;
  let tripodOn = false;
  const worn = new Set();   // giyilen koruyucu ekipman
  const equipTweens = [];   // ekipman giyme animasyonları
  let armTime = -1;         // kol kaldırma animasyonu zamanı
  let shake = 0;
  let disposed = false;
  let time = 0;
  let dragging = false;
  let press = null;

  const itemName = key => (key && SUBSTANCES[key] ? SUBSTANCES[key].name : key);
  const hottest = () => Math.round(Math.max(...tubes.map(t => t.userData.temp)));
  const heldLabel = () => {
    if (carried) return 'Elinizde: tüp';
    if (heldKey === 'cimbiz') return tongsSample ? `Cımbız: ${tongsSample} örneği` : 'Elinizde: cımbız';
    if (heldKey) return `Elinizde: ${itemName(heldKey)}`;
    return '';
  };
  const tubeInfo = tube => {
    const d = tube.userData;
    const mix = mixtureProps(d.contents);
    const contents = d.contents.length ? d.contents.map(itemName).join(' + ') : 'boş';
    return `Tüp: ${d.temp.toFixed(1)}°C · ${mix.volumeMl} mL · ${mix.massG} g · yoğunluk ${mix.densityGmL} g/mL · ${contents}`;
  };
  const emit = (message, tone, info) => {
    if (disposed) return;
    heldEl.textContent = heldLabel();
    onStatus({ hottest: hottest(), selected: heldKey, carrying: Boolean(carried), burnerOn: lit, message, tone, info, worn: [...worn] });
  };
  const say = (message, tone = 'info') => {
    if (disposed) return;
    msgEl.textContent = message;
    msgEl.dataset.tone = tone;
    emit(message, tone);
  };
  const requirePpe = (action, label) => {
    const missing = missingPpe([...worn], requiredPpe(action));
    if (!missing.length) return true;
    const names = { gozluk: 'koruyucu gözlük', eldiven: 'eldiven', onluk: 'önlük' };
    say(`${label} için önce ${missing.map(k => names[k]).join(', ')} giyin.`, 'warn');
    return false;
  };

  // ---------- Tepkimeler ----------
  const averageColor = d => {
    const sum = new THREE.Color(0, 0, 0);
    d.contents.forEach(k => sum.add(new THREE.Color(SUBSTANCES[k]?.color ?? 0xffffff)));
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
    const s = SUBSTANCES[key];
    if (s.radioactive) return say('Radyoaktif örnek tüpe dökülmez; örneği kutuya geri koyun.', 'warn');
    const action = (key === 'asit' || key === 'baz') ? 'pour_acid_base' : 'pour';
    if (!requirePpe(action, 'Dökme')) return null;
    if (d.contents.includes(key)) return say(`${s.name} bu tüpte zaten var.`, 'warn');
    if (d.contents.length >= MAX_CONTENTS) return say('Tüp dolu: en fazla üç malzeme karıştırılabilir.', 'warn');
    d.contents.push(key);
    d.lastAdded = key;
    d.target.copy(d.reactionColor ?? averageColor(d));
    heldKey = null;
    say(`${s.name} tüpe döküldü.`, 'info');
    checkReactions(tube);
    return null;
  };

  // ---------- Giyme animasyonu ----------
  const equip = key => {
    if (worn.has(key)) return say(`${itemName(key)} zaten giyili.`, 'info');
    const mesh = ppeItems[key];
    const from = mesh.getWorldPosition(new THREE.Vector3());
    equipTweens.push({ key, mesh, from, t: 0 });
    armTime = 0;
    return say(`${itemName(key)} alınıyor…`, 'info');
  };
  const finishEquip = key => {
    worn.add(key);
    if (key === 'eldiven') { leftArm.material = gloveMat; rightArm.material = gloveMat; }
    if (key === 'onluk') coatOverlay.visible = true;
    if (key === 'gozluk') goggleView.visible = true;
    say(`${itemName(key)} giyildi.`, 'ok');
  };

  // ---------- Ocak sesi (hafif çıtırtı) ----------
  let audioCtx = null;
  let flameNode = null;
  const startFlameSound = () => {
    if (disposed) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      if (flameNode) return;
      const len = audioCtx.sampleRate * 2;
      const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * 0.5;
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const band = audioCtx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1400;
      const gain = audioCtx.createGain();
      gain.gain.value = 0.04;
      src.connect(band).connect(gain).connect(audioCtx.destination);
      src.start();
      flameNode = { src, gain };
    } catch (e) { /* ses desteklenmiyorsa sessiz devam */ }
  };
  const stopFlameSound = () => {
    if (!flameNode) return;
    try { flameNode.src.stop(); } catch (e) { /* zaten durmuş */ }
    flameNode = null;
  };

  // ---------- Girdi ----------
  const onKeyDown = e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (e.key.toLowerCase() === 'q' && !e.repeat) { dropAll(); return; }
    keys.add(e.key.toLowerCase());
  };
  const onKeyUp = e => keys.delete(e.key.toLowerCase());
  const clearKeys = () => keys.clear();
  const onVisibility = () => { if (document.hidden) keys.clear(); };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearKeys);
  document.addEventListener('visibilitychange', onVisibility);

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
    return ray.intersectObjects(pickables(), true).find(h => {
      const r = rootOf(h.object);
      return r?.userData.kind !== 'tripod' || tripodOn;
    }) ?? null;
  };
  const centerRoot = () => {
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
  const dropAll = () => {
    if (dropCarried()) return say('Tüpü bıraktınız.', 'info');
    if (heldKey === 'cimbiz' && tongsSample) return say('Radyoaktif örneği önce kutuya geri koyun.', 'warn');
    if (heldKey) { heldKey = null; return say('Elinizdekini bıraktınız.', 'info'); }
    return say('Elinizde bir şey yok.', 'info');
  };

  const sourcesNear = () => {
    const eye = camera.getWorldPosition(new THREE.Vector3());
    const sources = [];
    if (boxItems.length) {
      const d = eye.distanceTo(boxPos());
      boxItems.forEach(sym => sources.push({ symbol: sym, distance: d }));
    }
    if (tongsSample) sources.push({ symbol: tongsSample, distance: 0.6 });
    return sources;
  };

  const interact = () => {
    const hit = hitCenter();
    const target = hit ? rootOf(hit.object) : null;

    // Elde tüp: her tıklama bırakır
    if (carried) { dropCarried(); return say('Tüp bırakıldı.', 'info'); }

    // Koruyucu ekipman: giy (elde bir şey olsa da)
    if (target?.userData.kind === 'ppe') return equip(target.userData.key);

    // Kutu: aç/kapat; cımbızla örnek al ya da geri koy
    if (target?.userData.kind === 'box') {
      if (heldKey === 'cimbiz') {
        if (!requirePpe('radioactive', 'Radyoaktif madde')) return null;
        if (!boxOpen) { boxOpen = true; lid.rotation.x = -1.4; return say('Kutu açıldı. Cımbızla bir örnek alabilirsiniz.', 'info'); }
        if (tongsSample) {
          boxItems.push(tongsSample);
          const back = tongsSample;
          tongsSample = null;
          return say(`${back} örneği kutuya geri kondu.`, 'ok');
        }
        if (!boxItems.length) return say('Kutu boş.', 'info');
        tongsSample = boxItems.pop();
        return say(`${tongsSample} örneği cımbızla alındı. Radyasyon ölçerle doz kontrol edin.`, 'warn');
      }
      if (heldKey) return say('Kutuya dokunmak için önce cımbız alın.', 'warn');
      if (!boxOpen) { boxOpen = true; lid.rotation.x = -1.4; return say('Kutu açıldı. Cımbız ile çalışın.', 'info'); }
      boxOpen = false;
      lid.rotation.x = 0;
      return say('Kutu kapatıldı.', 'info');
    }

    // Cımbızdayken her şeyi cımbızla yapın
    if (heldKey === 'cimbiz') {
      if (tongsSample && target?.userData.kind === 'tube') return say('Radyoaktif örnek tüpe konmaz; önce kutuya koyun.', 'warn');
      if (tongsSample && target?.userData.kind !== 'box') return say('Radyoaktif örneği kutuya geri koyun.', 'warn');
      heldKey = null;
      return say('Cımbızı bıraktınız.', 'info');
    }

    // Periyodik tablo: element al
    if (target?.userData.kind === 'board') {
      const e = elementAtUv(hit.uv);
      if (!e) return say('Bu alan periyodik tablo dışında.', 'info');
      const info = elementInfo(e.symbol);
      if (e.radioactive) return say(`${info.name} (${info.symbol}) radyoaktif: yalnızca kutudan cımbızla alınır.`, 'warn');
      if (heldKey) return say('Önce elinizdekini bırakın.', 'warn');
      if (!requirePpe('pour', 'Element alma')) return null;
      ensureElementSubstance(e.symbol);
      heldKey = info.item;
      return say(`${info.name} (${info.symbol}) alındı. Tüpe dökün ya da tabloya dönüp bırakın.`, 'ok');
    }

    if (heldKey === 'tup') {
      const p = tableTarget();
      if (!p || target?.userData.kind === 'tube') return say('Yeni tüpü masanın boş bir yerine tıklayarak koyun.', 'warn');
      if (tubes.length >= MAX_TUBES) return say(`En fazla ${MAX_TUBES} tüp olabilir.`, 'warn');
      spawnTube(THREE.MathUtils.clamp(p.x, -TABLE.hx + 0.2, TABLE.hx - 0.2), THREE.MathUtils.clamp(p.z, -TABLE.hz + 0.2, TABLE.hz - 0.2));
      heldKey = null;
      return say(`Yeni tüp masaya kondu (${tubes.length}/${MAX_TUBES}).`, 'ok');
    }

    if (heldKey) {
      const s = SUBSTANCES[heldKey];
      if (target?.userData.kind === 'bottle') {
        if (target.userData.key === heldKey) { heldKey = null; return say('Bıraktınız.', 'info'); }
        heldKey = target.userData.key;
        return say(`${itemName(heldKey)} elinizde. Bir tüpe ya da ocağa tıklayın.`, 'info');
      }
      if (target?.userData.kind === 'tube') {
        if (heldKey === 'termometre') return say(`Sıcaklık: ${target.userData.temp.toFixed(1)} °C`, 'info');
        if (s.tool) { heldKey = null; return say(`${s.name} tüpe kullanılmaz; bıraktınız.`, 'warn'); }
        return pour(target, heldKey);
      }
      if (target?.userData.kind === 'burner') {
        if (heldKey === 'kibrit') {
          if (!requirePpe('light', 'Ocağı yakma')) return null;
          lit = true; heldKey = null; startFlameSound();
          return say(tripodOn ? 'Ocak yandı. Tüpü amyant telinin üstüne koyun.' : 'Ocak yandı. Önce üç ayaklıyı ocağın üstüne koyun.', 'ok');
        }
        if (heldKey === 'tripod') {
          if (tripodOn) return say('Üç ayaklı zaten ocağın üstünde.', 'warn');
          tripodOn = true; heldKey = null;
          return say('Üç ayaklı kuruldu. Tüpü amyant telinin üstüne koyup ısıtın.', 'ok');
        }
        heldKey = null;
        return say(`${s.name} ocakta kullanılmaz; bıraktınız.`, 'warn');
      }
      if (target?.userData.kind === 'tripod') return say('Üç ayaklı ocağın üstünde; ocağa tıklayın.', 'info');
      heldKey = null;
      return say(`${s.name} bırakıldı.`, 'info');
    }

    // Elde değil: al
    if (target?.userData.kind === 'bottle') {
      heldKey = target.userData.key;
      return say(`${itemName(heldKey)} elinizde. Bir tüpe ya da ocağa tıklayın.`, 'info');
    }
    if (target?.userData.kind === 'tube') {
      carried = target;
      return say('Tüpü aldınız. Bırakmak için masaya tıklayın ya da Q.', 'info');
    }
    if (target?.userData.kind === 'tripod') {
      tripodOn = false;
      heldKey = 'tripod';
      return say('Üç ayaklıyı aldınız. Bırakmak için tıklayın ya da Q.', 'info');
    }
    if (target?.userData.kind === 'burner') {
      lit = !lit;
      if (lit) startFlameSound(); else stopFlameSound();
      const note = lit && !tripodOn ? ' Üç ayaklıyı koymayı unutmayın.' : '';
      return say(lit ? `Ocak yandı.${note}` : 'Ocak söndü.', 'info');
    }
    return null;
  };

  const onContextMenu = e => e.preventDefault();
  renderer.domElement.addEventListener('contextmenu', onContextMenu);
  const onPointerDown = e => {
    press = { x: e.clientX, y: e.clientY, moved: false, lx: e.clientX, ly: e.clientY, button: e.button };
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
    if (!press.moved && press.button === 0) interact();
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
    camera.position.set(player.x, 1.45, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 2.2);
      camera.position.x += (Math.random() - 0.5) * shake * 0.08;
      camera.position.y += (Math.random() - 0.5) * shake * 0.08;
    }
    blastLight.intensity = Math.max(0, blastLight.intensity - dt * 8);

    // Giyme animasyonu: eşya yüze/ele doğru süzülür, kollar kalkar
    for (let i = equipTweens.length - 1; i >= 0; i -= 1) {
      const tw = equipTweens[i];
      tw.t = Math.min(1, tw.t + dt / 0.8);
      const eye = camera.getWorldPosition(new THREE.Vector3());
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const goal = eye.clone().add(fwd.multiplyScalar(0.45));
      const p = tw.from.clone().lerp(goal, tw.t);
      tw.mesh.parent === rack ? tw.mesh.position.copy(rack.worldToLocal(p.clone())) : null;
      tw.mesh.visible = tw.t < 1;
      if (tw.t >= 1) { finishEquip(tw.key); equipTweens.splice(i, 1); tw.mesh.visible = false; }
    }
    if (armTime >= 0) {
      armTime += dt;
      const lift = Math.max(0, 0.9 - armTime * 2.2);
      leftArm.rotation.x = 0.25 + lift;
      rightArm.rotation.x = 0.25 + lift;
      if (armTime > 0.9) armTime = -1;
    }

    if (carried) {
      const p = tableTarget();
      if (p) carried.position.lerp(new THREE.Vector3(p.x, TOP + 0.4, p.z), Math.min(1, dt * 10));
    }

    flame.visible = lit;
    tripod.visible = tripodOn;
    if (lit) flame.scale.set(1 + Math.sin(time * 18) * 0.08, 1 + Math.sin(time * 23) * 0.12, 1 + Math.sin(time * 18) * 0.08);
    flameLight.position.set(BURNER_POS[0], TOP + 0.3, BURNER_POS[1]);
    flameLight.intensity = lit ? 1.2 + Math.sin(time * 15) * 0.15 : 0;

    // Isınma: fiziksel model (ısı kapasitesi, kaynama plato, buharlaşma)
    for (const tube of tubes) {
      const d = tube.userData;
      const inRange = Math.hypot(tube.position.x - BURNER_POS[0], tube.position.z - BURNER_POS[1]) < HEAT_RANGE;
      const onGauze = tripodOn && inRange && tube !== carried;
      const heating = lit && onGauze;
      if (tube !== carried) {
        const yGoal = onGauze ? TOP + 0.72 : TOP + 0.22;
        tube.position.y += (yGoal - tube.position.y) * Math.min(1, dt * 8);
      }
      const r = stepTemperature(d.temp, d.contents, dt, heating);
      d.temp = r.temp;
      if (r.evaporatedMl > 0 && d.contents.includes('su')) {
        d.volume = Math.max(0, d.volume - r.evaporatedMl / 50);
        if (d.volume <= 0.02) {
          d.contents = d.contents.filter(k => k !== 'su');
          d.reacted.delete('kaynama');
          d.fx = d.fx.filter(f => f.type !== 'steam');
          d.volume = 1;
          say('Su tamamen buharlaştı ve havaya karıştı.', 'info');
        }
      }
      if (heating && d.contents.includes('su') && d.temp >= 99.5 && Math.random() < dt * 6) {
        spawn(tube.position.x + (Math.random() - 0.5) * 0.06, tube.position.y + 0.15, tube.position.z, 0xffffff, 0.9, 0.08, 2.0);
      }
      checkReactions(tube);

      const fillSum = d.contents.reduce((s, k) => s + (SUBSTANCES[k]?.fill ?? 0), 0);
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

    // Elde tutulan alet görünümleri
    tongsView.visible = heldKey === 'cimbiz';
    const measuring = heldKey === 'termometre' || heldKey === 'radyasyon';
    lcd.hidden = !measuring;
    const root = centerRoot();
    if (measuring) {
      if (heldKey === 'termometre') {
        lcdTitle.textContent = 'Lazerli termometre';
        const t = root?.userData.kind === 'tube' ? root : null;
        lcdVal.textContent = t ? `${t.userData.temp.toFixed(1)} °C` : '— °C';
        lcdInfo.textContent = t ? tubeInfo(t) : 'Ölçmek için bir tüpe bakın';
      } else {
        lcdTitle.textContent = 'Radyasyon ölçer';
        const dose = doseRate(sourcesNear());
        lcdVal.textContent = `${dose} µSv/h`;
        lcdInfo.textContent = boxItems.length || tongsSample ? (dose > 5 ? 'Yüksek doz! Uzaklaşın.' : 'Doz izlenebilir düzeyde.') : 'Çevrede radyoaktif kaynak yok.';
      }
    }

    // İpucu ve tüp bilgisi
    let hint = '';
    let info = '';
    if (carried) hint = 'Tüp elinizde: tıklayın ya da Q ile bırakın';
    else if (heldKey === 'cimbiz') hint = tongsSample ? `Cımbızda ${tongsSample}: kutuya tıklayarak geri koyun` : 'Cımbız: kutuya bakıp tıklayın';
    else if (heldKey === 'termometre') hint = 'Termometre elinizde: tüpe bakıp tıklayın (ekranda okunur)';
    else if (heldKey === 'radyasyon') hint = 'Radyasyon ölçer elinizde: kutuya ya da örneğe yaklaşın';
    else if (heldKey === 'tup') hint = 'Yeni tüp elinizde: masanın boş bir yerine tıklayın';
    else if (heldKey) hint = `Elinizde ${itemName(heldKey)}: tüpe/ocağa tıklayın, boşluğa tıklayın ya da Q`;
    else if (root?.userData.kind === 'bottle') hint = `Al: ${itemName(root.userData.key)}`;
    else if (root?.userData.kind === 'tube') { hint = 'Tüp: elinizde malzeme varsa dökün, yoksa alın'; info = tubeInfo(root); }
    else if (root?.userData.kind === 'burner') hint = lit ? 'Ocağı söndür' : 'Ocağı yak (kibrit, gözlük ve üç ayaklı gerekir)';
    else if (root?.userData.kind === 'tripod') hint = 'Üç ayaklıyı al';
    else if (root?.userData.kind === 'ppe') hint = `Giy: ${itemName(root.userData.key)}`;
    else if (root?.userData.kind === 'box') hint = boxOpen ? 'Kutu açık: cımbızla örnek alın' : 'Kutuyu aç (radyoaktif örnekler içinde)';
    else if (root?.userData.kind === 'board') {
      const e = elementAtUv(hitCenter().uv);
      if (e) { const i = elementInfo(e.symbol); hint = `${i.name} (${i.symbol}) · ${i.category} · ${i.mass} g/mol${i.radioactive ? ' · RADYOAKTİF' : ''}`; }
      else hint = 'Periyodik tablo';
    }
    else hint = 'W A S D ile gezin, sürükleyerek bakın';
    if (hint !== hintEl.textContent) hintEl.textContent = hint;
    onStatusInfo = info;
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
    renderer.domElement.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('blur', clearKeys);
    document.removeEventListener('visibilitychange', onVisibility);
    scene.traverse(obj => {
      obj.geometry?.dispose();
      if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose());
    });
    [boardTex, woodTex, tileTex, plasterTex].forEach(t => t.dispose());
    padKeys.forEach((h, btn) => { btn.removeEventListener('pointerdown', h.down); btn.removeEventListener('pointerup', h.up); });
    stopFlameSound();
    audioCtx?.close?.().catch?.(() => {});
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
      if (PPE_KEYS.includes(key)) return equip(key);
      if (carried) dropCarried();
      heldKey = heldKey === key ? null : key;
      say(heldKey ? `${itemName(heldKey)} elinizde. Bir tüpe ya da ocağa tıklayın.` : 'Malzeme bırakıldı.', 'info');
      return heldKey;
    },
    toggleBurner() {
      if (!lit && !requirePpe('light', 'Ocağı yakma')) return lit;
      lit = !lit;
      if (lit) startFlameSound(); else stopFlameSound();
      say(lit ? 'Ocak yandı.' : 'Ocak söndü.', 'info');
      return lit;
    },
    reset() {
      carried = null;
      removeExtraTubes();
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
      tongsSample = null;
      boxOpen = false;
      lid.rotation.x = 0;
      boxItems = [...BOX_ITEMS];
      player.x = 0; player.z = 2.6; player.yaw = 0; player.pitch = -0.2;
      say('Laboratuvar sıfırlandı. Koruyucu ekipmanınızı giymeyi unutmayın.', 'info');
    },
  };
}
