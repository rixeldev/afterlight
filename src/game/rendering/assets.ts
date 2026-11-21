import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toByteArray } from 'base64-js';
import { MODEL_GLB_BASE64, type ModelId } from '../assets/generated/models';
import { TEXTURE_RGBA_BASE64, TEXTURE_SIZE, type TextureId } from '../assets/generated/textures';

const modelCache = new Map<string, Promise<THREE.Group | null>>();
const textureCache = new Map<string, THREE.DataTexture>();

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
    const clone = material.clone();
    clone.side = THREE.FrontSide;
    parts.push({ geometry, material: clone });
  });
  return parts;
}

export function getTexture(id: TextureId, repeat = 24): THREE.DataTexture {
  const cacheKey = `${id}:${repeat}`;
  const existing = textureCache.get(cacheKey);
  if (existing) return existing;
  const bytes = toByteArray(TEXTURE_RGBA_BASE64[id]);
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

export function disposeModelCache(): void {
  modelCache.clear();
  textureCache.forEach((t) => t.dispose());
  textureCache.clear();
}
