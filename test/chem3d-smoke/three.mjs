// Test için hafif THREE taklidi: sahne grafiği, vektör/renk işlemleri ve no-op geometri/malzemeler.
export const SCENE_OBJECTS = [];
export const HIT = { list: [] };
const V = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);
export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
  applyQuaternion() { return this; }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
}
export class Vector2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; return this; } }
export class Color {
  constructor(r = 0, g = 0, b = 0) { if (typeof r === 'number' && arguments.length === 1) { this.r = ((r >> 16) & 255) / 255; this.g = ((r >> 8) & 255) / 255; this.b = (r & 255) / 255; } else { this.r = r; this.g = g; this.b = b; } }
  set(h) { return this.constructor === Color && typeof h === 'number' ? (this.r = ((h >> 16) & 255) / 255, this.g = ((h >> 8) & 255) / 255, this.b = (h & 255) / 255, this) : this; }
  copy(c) { this.r = c.r; this.g = c.g; this.b = c.b; return this; }
  add(c) { this.r += c.r; this.g += c.g; this.b += c.b; return this; }
  multiplyScalar(s) { this.r *= s; this.g *= s; this.b *= s; return this; }
  lerp(c, t) { this.r += (c.r - this.r) * t; this.g += (c.g - this.g) * t; this.b += (c.b - this.b) * t; return this; }
}
export class Plane { constructor(normal = V(0, 1, 0), constant = 0) { this.normal = normal; this.constant = constant; } }
class Obj3D {
  constructor() {
    this.position = new Vector3(); this.rotation = { x: 0, y: 0, z: 0, order: 'XYZ', set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.scale = { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z ?? x; }, setScalar(s) { this.x = this.y = this.z = s; } };
    this.quaternion = {}; this.children = []; this.userData = {}; this.visible = true; this.parent = null;
    this.castShadow = false; this.receiveShadow = false; this.material = null; this.geometry = null; this.isMesh = false;
  }
  add(...objs) { for (const o of objs) { o.parent = this; this.children.push(o); SCENE_OBJECTS.push(o); } return this; }
  remove(o) { this.children = this.children.filter(c => c !== o); o.parent = null; return this; }
  traverse(fn) { fn(this); for (const c of this.children) c.traverse(fn); }
  getWorldPosition(v = new Vector3()) { return v.copy(this.position); }
  localToWorld(v) { return v.clone(); }
  worldToLocal(v) { return v.clone(); }
  lookAt() {}
}
export class Group extends Obj3D {}
export class Scene extends Obj3D { constructor() { super(); this.background = null; this.environment = null; } }
export class Mesh extends Obj3D { constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; this.isMesh = true; } }
export class Points extends Obj3D { constructor(g, m) { super(); this.geometry = g; this.material = m; } }
export class PerspectiveCamera extends Obj3D { constructor() { super(); this.aspect = 1; } updateProjectionMatrix() {} }
export class Light extends Obj3D { constructor() { super(); this.intensity = 1; this.shadow = { mapSize: { set() {} } }; } }
export class HemisphereLight extends Light {}
export class DirectionalLight extends Light {}
export class PointLight extends Light {}
const geom = class { constructor() { this.attributes = { position: { needsUpdate: false }, color: { needsUpdate: false } }; } dispose() {} setAttribute(n, a) { this.attributes[n] = a; } };
const mat = class { constructor(p = {}) { Object.assign(this, p); this.color = new Color(p.color ?? 0xffffff); this.emissive = new Color(0); } dispose() {} };
export class BufferGeometry extends geom {}
export class BufferAttribute { constructor(a) { this.array = a; this.needsUpdate = false; } }
export class BoxGeometry extends geom {} export class CircleGeometry extends geom {} export class ConeGeometry extends geom {}
export class CylinderGeometry extends geom {} export class LatheGeometry extends geom {} export class PlaneGeometry extends geom {}
export class SphereGeometry extends geom {} export class TorusGeometry extends geom {}
export class MeshBasicMaterial extends mat {} export class MeshPhysicalMaterial extends mat {} export class MeshStandardMaterial extends mat {} export class PointsMaterial extends mat {}
export class CanvasTexture { constructor(c) { this.canvas = c; this.repeat = { set() {} }; } dispose() {} }
export class PMREMGenerator { constructor() {} fromScene() { return { texture: {} }; } dispose() {} }
export class Raycaster {
  setFromCamera() {}
  intersectObjects() { return HIT.list.map(o => ({ object: o.object ?? o, uv: o.uv ?? { x: 0.5, y: 0.5 } })); }
  get ray() { return { intersectPlane: (plane, target) => { target.set(0, 0.9, 0.2); return true; } }; }
}
export class WebGLRenderer {
  constructor() { this.domElement = globalThis.__makeEl('canvas'); this.shadowMap = {}; (globalThis.__renderers ||= []).push(this); }
  setPixelRatio() {} setSize() {} render() {} dispose() {}
}
export const MathUtils = { clamp: (v, a, b) => Math.min(b, Math.max(a, v)), lerp: (a, b, t) => a + (b - a) * t };
export const ACESFilmicToneMapping = 4, PCFSoftShadowMap = 2, RepeatWrapping = 1000, SRGBColorSpace = 'srgb', DoubleSide = 2;
