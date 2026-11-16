// ============================================================================
// OKULUM v96 — 3D KİMYA LABORATUVARI MODÜLÜ
// Three.js tabanlı oyun tarzı kimya deney simülasyonu
// ============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------- Deney malzemeleri ----------
const MATERIALS = {
  su: { name: 'Su', color: 0x4a90e2, radius: 0.12, height: 0.25, type: 'liquid', desc: 'Sıvı — reaksiyon ortamı' },
  toz: { name: 'Beyaz Toz', color: 0xf0f0f0, radius: 0.1, height: 0.15, type: 'powder', desc: 'Toz — suyla karışır' },
  kagit: { name: 'Kağıt', color: 0xffffff, radius: 0.14, height: 0.08, type: 'solid', desc: 'Katışık — ısınırsa yanar' },
  tuz: { name: 'Tuz', color: 0xe8f4f8, radius: 0.09, height: 0.12, type: 'powder', desc: 'Tuz — suya eriyor' },
  madeni_su: { name: 'Madeni Su', color: 0x87ceeb, radius: 0.12, height: 0.25, type: 'liquid', desc: 'Sıvı — efervesan' },
};

// ---------- Kimyasal reaksiyonlar ----------
const REACTIONS = [
  { inputs: ['toz', 'su'], output: 'cozelti', name: 'Çözelti Oluştu', color: 0x6fa8dc, desc: 'Beyaz toz suya eriyerek şeffaf çözelti oldu.' },
  { inputs: ['tuz', 'su'], output: 'tuzlu_su', name: 'Tuzlu Su', color: 0xb0d4e3, desc: 'Tuz suya erişti — tuzlu çözelti hazır.' },
  { inputs: ['kagit', 'isik'], output: 'yanik_kagit', name: 'Yanık Kağıt', color: 0x8b4513, desc: 'Kağıt ısındığında yanıp kuru oldu.' },
  { inputs: ['su', 'isik'], output: 'buhar', name: 'Buharlaşma', color: 0xffffff, desc: 'Su ısıtıldığında buhar haline geldi.' },
];

export function initChem3d(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  // ---------- Sahne kurulumu ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f4f8);
  scene.fog = new THREE.Fog(0xf0f4f8, 2, 12);

  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 50);
  camera.position.set(3, 3, 4);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 2;
  controls.maxDistance = 8;

  // ---------- Işıklandırma ----------
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(3, 5, 3);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  scene.add(dirLight);

  const spotLight = new THREE.SpotLight(0xffeecc, 0.5);
  spotLight.position.set(0, 4, 0);
  spotLight.lookAt(0, 0, 0);
  scene.add(spotLight);

  // ---------- Masası ----------
  const tableGeo = new THREE.BoxGeometry(2.2, 0.1, 1.4);
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.position.set(0, 0, 0);
  table.castShadow = true;
  table.receiveShadow = true;
  scene.add(table);

  // ---------- Tüp ----------
  const createTestTube = (x, y, z, color = 0xffffff) => {
    const group = new THREE.Group();
    const glassGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.4, 16);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.3, metalness: 0.1 });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.y = 0.2;
    glass.castShadow = true;
    glass.receiveShadow = true;
    group.add(glass);

    const bottomGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.02, 16);
    const bottomMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
    const bottom = new THREE.Mesh(bottomGeo, bottomMat);
    bottom.position.y = -0.01;
    group.add(bottom);

    // İçerik (sıvı/toz)
    const contentGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.35, 16);
    const contentMat = new THREE.MeshStandardMaterial({ color });
    const content = new THREE.Mesh(contentGeo, contentMat);
    content.position.y = 0.18;
    content.visible = false;
    group.add(content);

    group.position.set(x, y, z);
    group.userData = { type: 'testtube', content: null, contentMesh: content, contentGeo: contentGeo };
    scene.add(group);
    return group;
  };

  const tube1 = createTestTube(-0.5, 0.05, -0.2);
  const tube2 = createTestTube(0.5, 0.05, -0.2);
  const tube3 = createTestTube(0, 0.05, 0.4);

  // ---------- Parçacık sistemi (buhar/duman) ----------
  const particlesGeo = new THREE.BufferGeometry();
  const maxParticles = 200;
  const positions = new Float32Array(maxParticles * 3);
  const velocities = new Float32Array(maxParticles * 3);
  const lifeTimes = new Float32Array(maxParticles);
  particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particlesMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, transparent: true, opacity: 0.6 });
  const particles = new THREE.Points(particlesGeo, particlesMat);
  scene.add(particles);

  let activeParticles = 0;
  const spawnParticle = (x, y, z, color = 0xffffff, rise = true) => {
    if (activeParticles >= maxParticles) return;
    const i = activeParticles * 3;
    positions[i] = x;
    positions[i + 1] = y;
    positions[i + 2] = z;
    velocities[i] = (Math.random() - 0.5) * 0.02;
    velocities[i + 1] = rise ? 0.02 + Math.random() * 0.03 : -0.01;
    velocities[i + 2] = (Math.random() - 0.5) * 0.02;
    lifeTimes[i / 3] = 1.0;
    activeParticles++;
  };

  // ---------- Sıcaklık simülasyonu ----------
  let temperature = 20; // °C
  let heatInterval = null;
  const tempDisplay = document.getElementById('chem3d-temp');

  const startHeating = () => {
    if (heatInterval) return;
    temperature = 20;
    heatInterval = setInterval(() => {
      temperature += 2;
      if (tempDisplay) tempDisplay.textContent = `${Math.round(temperature)}°C`;
      if (temperature >= 100) {
        clearInterval(heatInterval);
        heatInterval = null;
        toast3d('Su kaynadı! Buhar oluştu.', 'ok');
        spawnParticle(0, 0.3, 0);
      }
    }, 300);
  };

  const stopHeating = () => {
    if (heatInterval) clearInterval(heatInterval);
    heatInterval = null;
  };

  // ---------- Reaksiyon motoru ----------
  const checkReaction = (tube) => {
    const content = tube.userData.content;
    if (!content) return null;

    // Basit reaksiyon mantığı
    if (content === 'toz' && temperature >= 60) {
      return { name: 'Toz ısındı', color: 0xffd54f, desc: 'Toz ısındığında kıvamlandı.' };
    }
    if (content === 'su' && temperature >= 100) {
      return { name: 'Buharlaşma', color: 0xffffff, desc: 'Su kaynayıp buhar haline geldi.' };
    }
    if (content === 'kagit' && temperature >= 200) {
      return { name: 'Yanma', color: 0xff5722, desc: 'Kağıt yanıp kuru oldu.' };
    }
    return null;
  };

  const applyReaction = (tube, reaction) => {
    const contentMesh = tube.userData.contentMesh;
    contentMesh.material.color.set(reaction.color);
    contentMesh.scale.set(1, 1.2, 1);

    // Parçacık efekt
    for (let i = 0; i < 30; i++) {
      spawnParticle(
        tube.position.x + (Math.random() - 0.5) * 0.1,
        tube.position.y + 0.3,
        tube.position.z + (Math.random() - 0.5) * 0.1,
        reaction.color
      );
    }

    toast3d(`${reaction.name}: ${reaction.desc}`, 'ok');
  };

  // ---------- Deney malzemesi yerleştirme ----------
  let selectedMaterial = null;
  const materialButtons = {};
  const updateMaterialButtons = () => {
    Object.entries(materialButtons).forEach(([key, btn]) => btn.classList.toggle('active', key === selectedMaterial));
  };

  const placeMaterial = (tube, materialKey) => {
    const mat = MATERIALS[materialKey];
    if (!mat) return;

    tube.userData.content = materialKey;
    const contentMesh = tube.userData.contentMesh;
    contentMesh.visible = true;
    contentMesh.material.color.set(mat.color);
    contentMesh.scale.set(1, 1, 1);

    // Sıvı ise biraz aşağı indir
    if (mat.type === 'liquid') {
      contentMesh.position.y = 0.05;
      contentMesh.scale.set(1, 0.6, 1);
    }

    toast3d(`${mat.name} tüpün içine kondu.`, 'info');
    checkAndReact(tube);
  };

  const checkAndReact = (tube) => {
    const reaction = checkReaction(tube);
    if (reaction) applyReaction(tube, reaction);
  };

  // ---------- UI ----------

  const toast3d = (message, tone = 'ok') => {
    const el = document.getElementById('chem3d-toast');
    if (!el) return;
    el.textContent = message;
    el.className = `chem3d-toast chem3d-toast-${tone} show`;
    setTimeout(() => el.classList.remove('show'), 3000);
  };

  const resetLab = () => {
    [tube1, tube2, tube3].forEach((tube) => {
      tube.userData.content = null;
      tube.userData.contentMesh.visible = false;
      tube.userData.contentMesh.scale.set(1, 1, 1);
      tube.userData.contentMesh.position.y = 0.18;
    });
    stopHeating();
    temperature = 20;
    if (tempDisplay) tempDisplay.textContent = '20°C';
    toast3d('Laboratuvar sıfırlandı.', 'info');
  };

  // ---------- Sürükle-bırak ----------
  let isDragging = false;
  let dragTube = null;
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const onMouseDown = (event) => {
    if (event.target.tagName === 'BUTTON' || event.target.tagName === 'INPUT') return;
    mouse.x = (event.clientX / container.clientWidth) * 2 - 1;
    mouse.y = -(event.clientY / container.clientHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([tube1, tube2, tube3]);
    if (intersects.length > 0 && selectedMaterial) {
      isDragging = true;
      dragTube = intersects[0].object;
      placeMaterial(dragTube, selectedMaterial);
      selectedMaterial = null;
      updateMaterialButtons();
    }
  };

  const onMouseMove = (event) => {
    if (!isDragging || !dragTube) return;
    mouse.x = (event.clientX / container.clientWidth) * 2 - 1;
    mouse.y = -(event.clientY / container.clientHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.05);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, target);
    if (target) {
      dragTube.position.x = THREE.MathUtils.lerp(dragTube.position.x, target.x, 0.15);
      dragTube.position.z = THREE.MathUtils.lerp(dragTube.position.z, target.z, 0.15);
    }
  };

  const onMouseUp = () => {
    isDragging = false;
    dragTube = null;
  };

  const onTouchStart = (e) => onMouseDown(e.touches[0]);
  const onTouchMove = (e) => onMouseMove(e.touches[0]);
  const onTouchEnd = onMouseUp;

  renderer.domElement.addEventListener('mousedown', onMouseDown);
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('mouseup', onMouseUp);
  renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
  renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
  renderer.domElement.addEventListener('touchend', onTouchEnd);

  // ---------- Animasyon döngüsü ----------
  let frameId;
  const animate = () => {
    frameId = requestAnimationFrame(animate);
    controls.update();

    // Parçacık güncellemesi
    let activeCount = 0;
    for (let i = 0; i < maxParticles; i++) {
      if (lifeTimes[i] <= 0) continue;
      positions[i * 3] += velocities[i * 3];
      positions[i * 3 + 1] += velocities[i * 3 + 1];
      positions[i * 3 + 2] += velocities[i * 3 + 2];
      lifeTimes[i] -= 0.02;
      if (lifeTimes[i] > 0) activeCount++;
    }
    activeParticles = activeCount;
    particlesGeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  };
  animate();

  // ---------- Temizlik ----------
  const dispose = () => {
    cancelAnimationFrame(frameId);
    stopHeating();
    renderer.domElement.removeEventListener('mousedown', onMouseDown);
    renderer.domElement.removeEventListener('mousemove', onMouseMove);
    renderer.domElement.removeEventListener('mouseup', onMouseUp);
    renderer.domElement.removeEventListener('touchstart', onTouchStart);
    renderer.domElement.removeEventListener('touchmove', onTouchMove);
    renderer.domElement.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  };

  const onResize = () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  window.addEventListener('resize', onResize);

  // ---------- Public API ----------
  let heating = false;
  return {
    toggleHeating: () => { heating = !heating; heating ? startHeating() : stopHeating(); },
    startHeating,
    stopHeating,
    resetLab,
    dispose,
    placeMaterial,
    getTemperature: () => temperature,
    MATERIALS,
  };
}

export function destroyChem3d(instance) {
  if (instance) instance.dispose();
}

// ---------- Toast helper (global) ----------
let toast3dTimer = null;
window.toast3d = (message, tone = 'ok') => {
  let el = document.getElementById('chem3d-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'chem3d-toast';
    el.className = 'chem3d-toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `chem3d-toast chem3d-toast-${tone} show`;
  if (toast3dTimer) clearTimeout(toast3dTimer);
  toast3dTimer = setTimeout(() => el.classList.remove('show'), 3000);
};
