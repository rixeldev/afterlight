import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { terrainHeight, WATER_LEVEL } from '../world/terrain';
import { getTexture } from './assets';

const SIZE = 170;
const SEGMENTS = 116;

interface TerrainProps {
  shadows: boolean;
  lowQuality: boolean;
}

/**
 * Single-mesh heightfield built from the shared terrain function, with baked
 * vertex colors (grass, dirt clearing, rock on steep slopes, sand at the shore).
 */
export function Terrain({ shadows, lowQuality }: TerrainProps) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);

    const grass = new THREE.Color('#4C6A46');
    const grassDark = new THREE.Color('#3B5639');
    const dirt = new THREE.Color('#6B5A42');
    const rock = new THREE.Color('#666A5E');
    const sand = new THREE.Color('#8A8264');
    const underwater = new THREE.Color('#3D4F42');

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
        color.copy(grass).lerp(grassDark, noise * 0.7);
      }
      const campDist = Math.hypot(x, z);
      if (campDist < 13 && y > WATER_LEVEL) {
        const blend = Math.max(0, Math.min(1, (13 - campDist) / 6));
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
  }, []);

  const texture = useMemo(() => getTexture('grass_albedo', lowQuality ? 18 : 30), [lowQuality]);

  return (
    <mesh geometry={geometry} receiveShadow={shadows} frustumCulled={false}>
      <meshStandardMaterial
        vertexColors
        map={texture}
        roughness={0.98}
        metalness={0}
        color="#B8C4AE"
      />
    </mesh>
  );
}

export function Water({ lowQuality }: { lowQuality: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state) => {
    if (!material.current) return;
    const t = state.clock.elapsedTime;
    material.current.opacity = 0.78 + Math.sin(t * 0.35) * 0.03;
    if (mesh.current) mesh.current.position.y = WATER_LEVEL + Math.sin(t * 0.22) * 0.015;
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_LEVEL, 0]} renderOrder={1}>
      <planeGeometry args={[SIZE + 30, SIZE + 30, 1, 1]} />
      <meshStandardMaterial
        ref={material}
        color="#2C4A47"
        transparent
        opacity={0.8}
        roughness={lowQuality ? 0.5 : 0.18}
        metalness={0.32}
        depthWrite={false}
      />
    </mesh>
  );
}

function pseudoNoise(x: number, z: number): number {
  const v = Math.sin(x * 0.37 + z * 0.19) * Math.cos(x * 0.13 - z * 0.41);
  return (v + 1) / 2;
}
