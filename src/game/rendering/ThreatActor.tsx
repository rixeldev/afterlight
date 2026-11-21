import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber/native';
import { getEngine } from '../runtime/session';
import { terrainHeight } from '../world/terrain';

/** A low, long-limbed silhouette with two embers for eyes. */
export function ThreatActor({ shadows }: { shadows: boolean }) {
  const root = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const head = useRef<THREE.Group>(null);
  const phase = useRef(0);
  const wasVisible = useRef(false);
  const eyeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#FF7A5C' }), []);
  const hideMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: '#201A1B' }), []);
  const boneMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: '#3A2E2B' }), []);

  useFrame((state, delta) => {
    const engine = getEngine();
    if (!root.current) return;
    const threat = engine?.getThreat();
    if (!threat) {
      root.current.visible = false;
      wasVisible.current = false;
      return;
    }
    root.current.visible = true;
    const y = terrainHeight(threat.x, threat.z);
    const target = new THREE.Vector3(threat.x, y, threat.z);
    if (!wasVisible.current) {
      root.current.position.copy(target);
      wasVisible.current = true;
    } else {
      root.current.position.lerp(target, Math.min(1, delta * 10));
    }
    const p = engine!.state.player;
    const angle = Math.atan2(p.x - threat.x, -(p.z - threat.z));
    root.current.rotation.y = angle;
    phase.current += delta * (threat.mode === 'prowl' ? 3.2 : 7.4);
    legs.current.forEach((leg, i) => {
      if (!leg) return;
      leg.rotation.x = Math.sin(phase.current + (i % 2 === 0 ? 0 : Math.PI)) * 0.55;
    });
    if (head.current) {
      head.current.rotation.x = Math.sin(state.clock.elapsedTime * 1.4) * 0.06 + (threat.mode === 'chase' ? -0.12 : 0);
      head.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.15;
    }
    const s = threat.mode === 'flee' ? 0.94 : 1;
    root.current.scale.setScalar(s);
  });

  return (
    <group ref={root} visible={false}>
      <mesh position={[0, 0.62, 0]} material={hideMaterial} castShadow={shadows}>
        <boxGeometry args={[0.5, 0.42, 1.15]} />
      </mesh>
      <mesh position={[0, 0.82, -0.1]} rotation={[0.1, 0, 0]} material={hideMaterial} castShadow={shadows}>
        <boxGeometry args={[0.38, 0.2, 0.9]} />
      </mesh>
      {/* ribs */}
      {[-0.32, -0.08, 0.16, 0.38].map((z, i) => (
        <mesh key={i} position={[0, 0.66, z]} rotation={[0, 0, Math.PI / 2]} material={boneMaterial}>
          <cylinderGeometry args={[0.035, 0.035, 0.52, 5]} />
        </mesh>
      ))}
      <group ref={head} position={[0, 0.78, 0.72]}>
        <mesh material={hideMaterial} castShadow={shadows}>
          <boxGeometry args={[0.32, 0.28, 0.42]} />
        </mesh>
        <mesh position={[0, -0.06, 0.24]} material={boneMaterial}>
          <boxGeometry args={[0.22, 0.12, 0.24]} />
        </mesh>
        <mesh position={[-0.09, 0.06, 0.19]} material={eyeMaterial}>
          <sphereGeometry args={[0.035, 6, 5]} />
        </mesh>
        <mesh position={[0.09, 0.06, 0.19]} material={eyeMaterial}>
          <sphereGeometry args={[0.035, 6, 5]} />
        </mesh>
        <mesh position={[0, 0.17, -0.02]} rotation={[0.5, 0, 0]} material={boneMaterial}>
          <coneGeometry args={[0.035, 0.22, 4]} />
        </mesh>
      </group>
      {[
        [-0.24, 0.44],
        [0.24, 0.44],
        [-0.24, -0.42],
        [0.24, -0.42],
      ].map(([x, z], i) => (
        <group
          key={i}
          ref={(el) => {
            legs.current[i] = el;
          }}
          position={[x, 0.5, z]}
        >
          <mesh position={[0, -0.24, 0]} material={hideMaterial} castShadow={shadows}>
            <cylinderGeometry args={[0.055, 0.04, 0.5, 5]} />
          </mesh>
          <mesh position={[0, -0.5, 0.02]} material={boneMaterial}>
            <boxGeometry args={[0.12, 0.06, 0.2]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.7, -0.62]} rotation={[0.9, 0, 0]} material={boneMaterial}>
        <cylinderGeometry args={[0.03, 0.02, 0.75, 4]} />
      </mesh>
    </group>
  );
}
