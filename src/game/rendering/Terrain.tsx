import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { terrainHeight, WATER_LEVEL } from '../world/terrain';
import { getNormalMap, getRippleNormal, getTexture } from './assets';

const SIZE = 170;

interface TerrainProps {
  shadows: boolean;
  lowQuality: boolean;
}

/**
 * Single-mesh heightfield built from the shared terrain function, with baked
 * vertex colors (grass, dirt clearing, rock on steep slopes, sand at the shore).
 */
export function Terrain({ shadows, lowQuality }: TerrainProps) {
  const segments = lowQuality ? 72 : 112;
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);

    const grass = new THREE.Color('#789760');
    const grassDark = new THREE.Color('#526F4A');
    const dry = new THREE.Color('#94A064');
    const dirt = new THREE.Color('#967C58');
    const rock = new THREE.Color('#8E9284');
    const sand = new THREE.Color('#BEB28C');
    const underwater = new THREE.Color('#5C7361');

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = terrainHeight(x, z);
      pos.setY(i, y);

      const slope =
        Math.abs(terrainHeight(x + 0.8, z) - terrainHeight(x - 0.8, z)) +
        Math.abs(terrainHeight(x, z + 0.8) - terrainHeight(x, z - 0.8));
      const noise = pseudoNoise(x, z);
      const color = new THREE.Color();
      if (y < WATER_LEVEL - 0.05) {
        color.copy(underwater).lerp(sand, Math.max(0, 1 - Math.abs(y - WATER_LEVEL) * 0.6));
      } else if (y < WATER_LEVEL + 0.7) {
        color.copy(sand);
      } else if (slope > 1.6) {
        color.copy(rock).lerp(grassDark, Math.max(0, 1.5 - slope * 0.5));
      } else {
        const macro = (Math.sin(x * 0.031 + z * 0.017) + Math.cos(x * 0.021 - z * 0.028) + 2) / 4;
        const micro = pseudoNoise(x * 4.1, z * 4.1);
        const patch = (Math.sin(x * 0.12 + z * 0.08) + Math.cos(x * 0.07 - z * 0.13) + 2) / 4;
        color.copy(grass).lerp(grassDark, 0.18 + noise * 0.3 + macro * 0.34);
        if (patch > 0.62) color.lerp(dry, (patch - 0.62) * 0.55);
        color.offsetHSL(0.003 * macro, 0.015 * micro, (micro - 0.5) * 0.045);
      }
      const campDist = Math.hypot(x, z);
      if (campDist < 13 && y > WATER_LEVEL) {
        const blend = Math.max(0, Math.min(1, (13 - campDist) / 6));
        color.lerp(dirt, blend * 0.6);
      }
      // Worn trails radiating from the homestead.
      const trail = Math.min(
        trailDistance(x, z),
        PathDist(x, z),
        LookoutDist(x, z),
      );
      if (trail < 2.6 && y > WATER_LEVEL) {
        const blend = Math.max(0, Math.min(1, (2.6 - trail) / 1.6));
        color.lerp(dirt, blend * 0.55);
      }
      // Shoreline sand tint.
      if (y > WATER_LEVEL && y < WATER_LEVEL + 1.1) {
        color.lerp(sand, 0.45);
      }
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [segments]);

  // Brightness stays near 1 so the grass albedo keeps its detail; the old
  // 2.1 multiplier clipped most pixels to white and read as flat paint.
  const texture = useMemo(() => getTexture('grass_albedo', lowQuality ? 22 : 40, 1.62), [lowQuality]);
  const normalMap = useMemo(() => getNormalMap('grass_albedo', lowQuality ? 22 : 40, 0.85), [lowQuality]);
  const normalScale = useMemo(() => new THREE.Vector2(0.65, 0.65), []);

  return (
    <mesh geometry={geometry} receiveShadow={shadows} frustumCulled={false}>
      <meshStandardMaterial
        vertexColors
        map={texture}
        normalMap={normalMap}
        normalScale={normalScale}
        roughness={0.98}
        metalness={0}
        color="#FFFFFF"
      />
    </mesh>
  );
}

export function Water({ lowQuality }: { lowQuality: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const ripple = useMemo(() => getRippleNormal(), []);
  const normalScale = useMemo(() => new THREE.Vector2(0.45, 0.45), []);
  useFrame((state, rawDelta) => {
    const t = state.clock.elapsedTime;
    ripple.offset.x += Math.min(0.05, rawDelta) * 0.012;
    ripple.offset.y += Math.min(0.05, rawDelta) * 0.007;
    if (!material.current) return;
    material.current.opacity = 0.82 + Math.sin(t * 0.35) * 0.02;
    if (mesh.current) mesh.current.position.y = WATER_LEVEL + Math.sin(t * 0.22) * 0.012;
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_LEVEL, 0]} renderOrder={1}>
      <planeGeometry args={[SIZE + 30, SIZE + 30, 1, 1]} />
      <meshStandardMaterial
        ref={material}
        color="#3E5F5B"
        normalMap={ripple}
        normalScale={normalScale}
        transparent
        opacity={0.82}
        roughness={lowQuality ? 0.42 : 0.14}
        metalness={0.35}
        depthWrite={false}
      />
    </mesh>
  );
}

function segmentDistance(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = x - ax;
  const wz = z - az;
  const len = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / len));
  return Math.hypot(x - (ax + vx * t), z - (az + vz * t));
}

function polylineDistance(x: number, z: number, points: [number, number][]): number {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    best = Math.min(best, segmentDistance(x, z, a[0], a[1], b[0], b[1]));
  }
  return best;
}

const RANGER_PATH: [number, number][] = [
  [0, 4],
  [10, -4],
  [22, -20],
  [32, -36],
];
const BRIDGE_PATH: [number, number][] = [
  [0, 4],
  [-12, 10],
  [-24, 18],
  [-34, 26],
];
const LOOKOUT_PATH: [number, number][] = [
  [0, 4],
  [8, 20],
  [14, 46],
];

export function trailDistance(x: number, z: number): number {
  return polylineDistance(x, z, RANGER_PATH);
}
function PathDist(x: number, z: number): number {
  return polylineDistance(x, z, BRIDGE_PATH);
}
function LookoutDist(x: number, z: number): number {
  return polylineDistance(x, z, LOOKOUT_PATH);
}

function pseudoNoise(x: number, z: number): number {
  const v = Math.sin(x * 0.37 + z * 0.19) * Math.cos(x * 0.13 - z * 0.41);
  return (v + 1) / 2;
}
