import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber/native';
import { getEngine } from '../runtime/session';
import { terrainHeight } from '../world/terrain';

const DURATION = 0.55;
const CHIPS = 9;

const COLORS: Record<string, string> = {
  tree: '#C99A5E',
  rock: '#A9ACA0',
  bush: '#B85A4C',
  fiber: '#9FBF6B',
  water: '#8FC6D6',
  cache: '#E8C98F',
  crate: '#C99A5E',
  build: '#D8C9A0',
  hit: '#E07A64',
};

/**
 * A tiny pooled burst of chips plus an expanding ground ring, played whenever
 * the engine registers a harvest, a hit or a completed build. Gives every
 * action a physical "thunk" without a particle system.
 */
export function ImpactFx() {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const chips = useRef<(THREE.Mesh | null)[]>([]);
  const state = useRef({ age: 999, at: 0, visible: false });
  const directions = useMemo(
    () =>
      Array.from({ length: CHIPS }, (_, i) => {
        const a = (i / CHIPS) * Math.PI * 2 + (i % 2) * 0.25;
        return { x: Math.cos(a), z: Math.sin(a), up: 0.9 + (i % 3) * 0.35, spin: 0.6 + (i % 5) * 0.3 };
      }),
    [],
  );

  useFrame((_, rawDelta) => {
    const delta = Math.min(0.05, rawDelta);
    const engine = getEngine();
    const impact = engine?.getImpact();
    if (impact && impact.at !== state.current.at) {
      state.current.at = impact.at;
      state.current.age = 0;
      state.current.visible = true;
      const color = new THREE.Color(COLORS[impact.kind] ?? '#E8C98F');
      if (group.current) {
        group.current.visible = true;
        group.current.position.set(impact.x, terrainHeight(impact.x, impact.z) + 0.08, impact.z);
      }
      if (ring.current) {
        const mat = ring.current.material as THREE.MeshBasicMaterial;
        mat.color.copy(color);
        ring.current.scale.setScalar(0.6);
      }
      chips.current.forEach((chip, i) => {
        if (!chip) return;
        const mat = chip.material as THREE.MeshBasicMaterial;
        mat.color.copy(color);
        mat.opacity = 1;
        chip.visible = true;
        chip.userData.dir = directions[i];
      });
    }

    if (!state.current.visible) {
      if (group.current) group.current.visible = false;
      return;
    }

    state.current.age += delta;
    const t = state.current.age / DURATION;
    if (t >= 1) {
      state.current.visible = false;
      if (group.current) group.current.visible = false;
      return;
    }

    if (ring.current) {
      const mat = ring.current.material as THREE.MeshBasicMaterial;
      ring.current.scale.setScalar(0.6 + t * 2.6);
      mat.opacity = (1 - t) * 0.5;
    }

    chips.current.forEach((chip) => {
      if (!chip) return;
      const dir = chip.userData.dir as { x: number; z: number; up: number; spin: number } | undefined;
      if (!dir) return;
      const dist = 0.25 + t * 1.15;
      const lift = dir.up * t - t * t * 1.1;
      chip.position.set(dir.x * dist, 0.18 + lift, dir.z * dist);
      chip.rotation.x = t * dir.spin * 6;
      chip.rotation.z = t * dir.spin * 4;
      const scale = Math.max(0.02, 0.09 * (1 - t));
      chip.scale.setScalar(scale / 0.09);
      (chip.material as THREE.MeshBasicMaterial).opacity = 1 - t;
    });
  });

  return (
    <group ref={group} visible={false}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.22, 0.3, 28]} />
        <meshBasicMaterial color="#E8C98F" transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: CHIPS }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            chips.current[i] = el;
          }}
          visible={false}
        >
          <boxGeometry args={[0.09, 0.07, 0.03]} />
          <meshBasicMaterial color="#C99A5E" transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
