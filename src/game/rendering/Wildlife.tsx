import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber/native';
import { getEngine } from '../runtime/session';

const BIRDS = 5;
const FIREFLIES = 34;

/** Small signs of life: birds over the valley by day, fireflies after dusk. */
export function Wildlife() {
  const birdGroups = useRef<(THREE.Group | null)[]>([]);
  const wings = useRef<(THREE.Mesh | null)[]>([]);
  const points = useRef<THREE.Points>(null);
  const birdBases = useMemo(
    () =>
      Array.from({ length: BIRDS }, (_, i) => ({
        angle: (i / BIRDS) * Math.PI * 2,
        radius: 26 + (i % 3) * 7,
        height: 22 + (i % 3) * 3,
        speed: 0.028 + (i % 2) * 0.012,
        phase: i * 1.7,
      })),
    [],
  );

  const flyPositions = useMemo(() => {
    const positions = new Float32Array(FIREFLIES * 3);
    let seed = 771;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < FIREFLIES; i += 1) {
      const angle = rand() * Math.PI * 2;
      const dist = 6 + rand() * 20;
      positions[i * 3] = Math.cos(angle) * dist;
      positions[i * 3 + 1] = 0.5 + rand() * 2.2;
      positions[i * 3 + 2] = Math.sin(angle) * dist;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry, positions };
  }, []);

  useFrame((state, rawDelta) => {
    const delta = Math.min(0.05, rawDelta);
    const engine = getEngine();
    const hour = engine ? (engine.state.minutes % 1440) / 60 : 12;
    const day = hour > 6 && hour < 19.5;
    const night = hour >= 19.5 || hour < 6;

    birdGroups.current.forEach((group, i) => {
      if (!group) return;
      const b = birdBases[i]!;
      group.visible = day;
      if (!day) return;
      const a = b.angle + state.clock.elapsedTime * b.speed;
      group.position.set(
        Math.cos(a) * b.radius,
        b.height + Math.sin(state.clock.elapsedTime * 0.6 + b.phase) * 1.6,
        Math.sin(a) * b.radius,
      );
      group.rotation.y = -a + Math.PI / 2;
    });

    wings.current.forEach((wing, i) => {
      if (!wing) return;
      wing.rotation.z = Math.sin(state.clock.elapsedTime * 7.5 + i * 0.9) * 0.55;
    });

    if (points.current) {
      points.current.visible = night;
      const mat = points.current.material as THREE.PointsMaterial;
      mat.opacity = night ? 0.85 : 0;
      // Drift the swarm slowly around the clearing.
      const pos = flyPositions.geometry.getAttribute('position') as THREE.BufferAttribute;
      const t = state.clock.elapsedTime;
      for (let i = 0; i < FIREFLIES; i += 1) {
        const x0 = flyPositions.positions[i * 3]!;
        const z0 = flyPositions.positions[i * 3 + 2]!;
        const angle = 0.008 * delta;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = x0 * cos - z0 * sin;
        const z = x0 * sin + z0 * cos;
        flyPositions.positions[i * 3] = x;
        flyPositions.positions[i * 3 + 2] = z;
        pos.setY(i, flyPositions.positions[i * 3 + 1]! + Math.sin(t * 0.9 + i) * 0.35);
      }
      pos.needsUpdate = true;
    }
  });

  return (
    <group>
      {Array.from({ length: BIRDS }).map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            birdGroups.current[i] = el;
          }}
          scale={0.7}
          visible={false}
        >
          <mesh>
            <coneGeometry args={[0.12, 0.55, 5]} />
            <meshBasicMaterial color="#26332E" />
          </mesh>
          <mesh
            ref={(el) => {
              wings.current[i * 2] = el;
            }}
            position={[-0.14, 0.02, 0]}
            rotation={[0, 0, 0.2]}
          >
            <boxGeometry args={[0.34, 0.02, 0.16]} />
            <meshBasicMaterial color="#26332E" />
          </mesh>
          <mesh
            ref={(el) => {
              wings.current[i * 2 + 1] = el;
            }}
            position={[0.14, 0.02, 0]}
            rotation={[0, 0, 0.2]}
          >
            <boxGeometry args={[0.34, 0.02, 0.16]} />
            <meshBasicMaterial color="#26332E" />
          </mesh>
        </group>
      ))}

      <points ref={points} geometry={flyPositions.geometry} frustumCulled={false} visible={false}>
        <pointsMaterial
          size={0.11}
          color="#F7E7A2"
          transparent
          opacity={0.85}
          depthWrite={false}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
