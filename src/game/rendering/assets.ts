import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toByteArray } from 'base64-js';
import { MODEL_GLB_BASE64, type ModelId } from '../assets/generated/models';
import { TEXTURE_RGBA_BASE64, TEXTURE_SIZE, type TextureId } from '../assets/generated/textures';

const modelCache = new Map<string, Promise<THREE.Group | null>>();
const textureCache = new Map<string, THREE.DataTexture>();
const normalCache = new Map<string, THREE.DataTexture>();
const rawCache = new Map<string, Uint8Array>();
const materialCache = new Map<string, THREE.MeshStandardMaterial>();

function rawPixels(id: TextureId): Uint8Array {
  const cached = rawCache.get(id);
  if (cached) return cached;
  const bytes = toByteArray(TEXTURE_RGBA_BASE64[id]);
  rawCache.set(id, bytes);
  return bytes;
}

export interface ModelPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

/**
 * Parses a bundled GLB with GLTFLoader directly from bytes. This avoids any
 * runtime file:// fetching, which is the least reliable part of Three.js on
 * React Native. Results are cached as promises so concurrent mounts share work.
 */
export function loadModel(id: ModelId): Promise<THREE.Group | null> {
  const cached = modelCache.get(id);
  if (cached) return cached;
  const promise = new Promise<THREE.Group | null>((resolve) => {
    try {
      const bytes = toByteArray(MODEL_GLB_BASE64[id]);
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const loader = new GLTFLoader();
      loader.parse(
        buffer,
        '',
        (gltf) => {
          gltf.scene.updateMatrixWorld(true);
          resolve(gltf.scene);
        },
        () => resolve(null),
      );
    } catch {
      resolve(null);
    }
  });
  modelCache.set(id, promise);
  return promise;
}

/** Flattens a model into world-space geometry parts for instancing. */
export async function loadModelParts(id: ModelId): Promise<ModelPart[]> {
  const scene = await loadModel(id);
  if (!scene) return [];
  const parts: ModelPart[] = [];
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!material) return;
    const clone = decorateModelMaterial(material.clone());
    parts.push({ geometry, material: clone });
  });
  return parts;
}

export function getTexture(id: TextureId, repeat = 24, brightness = 1): THREE.DataTexture {
  const cacheKey = `${id}:${repeat}:${brightness}`;
  const existing = textureCache.get(cacheKey);
  if (existing) return existing;
  const source = rawPixels(id);
  const bytes = brightness === 1 ? source : new Uint8Array(source.length);
  if (brightness !== 1) {
    for (let i = 0; i < source.length; i += 4) {
      bytes[i] = Math.min(255, source[i]! * brightness);
      bytes[i + 1] = Math.min(255, source[i + 1]! * brightness);
      bytes[i + 2] = Math.min(255, source[i + 2]! * brightness);
      bytes[i + 3] = source[i + 3] ?? 255;
    }
  }
  const texture = new THREE.DataTexture(bytes, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Derives a tangent-space normal map from the albedo's luminance with a Sobel
 * gradient. It costs a few milliseconds once per texture and adds real relief
 * to low-poly geometry without shipping another megabyte of assets.
 */
export function getNormalMap(id: TextureId, repeat = 24, strength = 2.2): THREE.DataTexture {
  const cacheKey = `${id}:${repeat}:${strength}`;
  const existing = normalCache.get(cacheKey);
  if (existing) return existing;

  const src = rawPixels(id);
  const size = TEXTURE_SIZE;
  const out = new Uint8Array(size * size * 4);
  const luminance = (x: number, y: number): number => {
    const px = ((x + size) % size) + ((y + size) % size) * size;
    const i = px * 4;
    return ((src[i] ?? 0) * 0.299 + (src[i + 1] ?? 0) * 0.587 + (src[i + 2] ?? 0) * 0.114) / 255;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = luminance(x + 1, y) - luminance(x - 1, y);
      const dy = luminance(x, y + 1) - luminance(x, y - 1);
      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (x + y * size) * 4;
      out[i] = (nx * 0.5 + 0.5) * 255;
      out[i + 1] = (ny * 0.5 + 0.5) * 255;
      out[i + 2] = (nz * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(out, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  normalCache.set(cacheKey, texture);
  return texture;
}

/** A tileable ripple normal for the lake surface. */
export function getRippleNormal(): THREE.DataTexture {
  const cached = normalCache.get('ripple');
  if (cached) return cached;
  const size = 128;
  const out = new Uint8Array(size * size * 4);
  const height = (x: number, y: number) => {
    const u = (x / size) * Math.PI * 2;
    const v = (y / size) * Math.PI * 2;
    return Math.sin(u * 2 + Math.sin(v)) * 0.5 + Math.sin(v * 3 + Math.cos(u * 2)) * 0.35 + Math.sin((u + v) * 5) * 0.15;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = height(x + 1, y) - height(x - 1, y);
      const dy = height(x, y + 1) - height(x, y - 1);
      let nx = -dx * 0.55;
      let ny = -dy * 0.55;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (x + y * size) * 4;
      out[i] = (nx * 0.5 + 0.5) * 255;
      out[i + 1] = (ny * 0.5 + 0.5) * 255;
      out[i + 2] = (nz * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(out, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  normalCache.set('ripple', texture);
  return texture;
}

export interface TextureMaterialOptions {
  color?: string;
  repeat?: number;
  brightness?: number;
  roughness?: number;
  metalness?: number;
  normalStrength?: number;
  side?: THREE.Side;
  emissive?: string;
  emissiveIntensity?: number;
}

/** Shared textured material, cached so repeated props reuse one program. */
export function texturedMaterial(id: TextureId, options: TextureMaterialOptions = {}): THREE.MeshStandardMaterial {
  const key = `${id}:${JSON.stringify(options)}`;
  const cached = materialCache.get(key);
  if (cached) return cached;
  const repeat = options.repeat ?? 2;
  const material = new THREE.MeshStandardMaterial({
    map: getTexture(id, repeat, options.brightness ?? 1),
    normalMap: getNormalMap(id, repeat, options.normalStrength ?? 1.8),
    color: options.color ?? '#FFFFFF',
    roughness: options.roughness ?? 0.92,
    metalness: options.metalness ?? 0,
    side: options.side ?? THREE.FrontSide,
    emissive: options.emissive ? new THREE.Color(options.emissive) : new THREE.Color('#000000'),
    emissiveIntensity: options.emissiveIntensity ?? 0,
  });
  material.normalScale.set(0.65, 0.65);
  materialCache.set(key, material);
  return material;
}

/** Picks a sensible texture for a GLB part based on its authored material name. */
export function decorateModelMaterial(material: THREE.Material): THREE.Material {
  const mesh = material as THREE.MeshStandardMaterial;
  const name = (mesh.name || '').toLowerCase();
  let next: THREE.MeshStandardMaterial = mesh;

  if (name.includes('bark')) {
    next = texturedMaterial('bark_albedo', { color: '#E3C39B', repeat: 1.6, brightness: 1.7, normalStrength: 2.4 });
  } else if (name.includes('canopy')) {
    next = texturedMaterial('grass_albedo', { color: '#B4D39A', repeat: 2.4, brightness: 1.5, normalStrength: 1.2, roughness: 1 });
  } else if (name.includes('stone')) {
    next = texturedMaterial('stone_albedo', { color: '#E1E4D8', repeat: 1.8, brightness: 1.25, normalStrength: 2.2 });
  } else if (name.includes('timber') || name.includes('door')) {
    next = texturedMaterial('weathered_wood_albedo', {
      color: name.includes('door') ? '#C69C74' : '#E0BE94',
      repeat: 1.8,
      brightness: 1.55,
      normalStrength: 1.8,
    });
  } else if (name.includes('roof')) {
    next = texturedMaterial('grass_albedo', { color: '#9CB18C', repeat: 2.2, brightness: 1.1, normalStrength: 1.4 });
  } else if (name.includes('window')) {
    next = new THREE.MeshStandardMaterial({
      color: '#E8C98F',
      emissive: new THREE.Color('#FFCB7A'),
      emissiveIntensity: 0.55,
      roughness: 0.3,
    });
  } else if (mesh.color) {
    mesh.color.multiplyScalar(1.35);
  }

  if (next !== mesh) {
    next.side = THREE.FrontSide;
    next.needsUpdate = true;
  }
  return next;
}

export function disposeModelCache(): void {
  modelCache.clear();
  textureCache.forEach((t) => t.dispose());
  textureCache.clear();
}
