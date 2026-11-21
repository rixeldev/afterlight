import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber/native';
import { getEngine } from '../runtime/session';
import { terrainHeight } from '../world/terrain';
import { STRUCTURES } from '../../data/recipes';
import { loadModel } from './assets';
import { FOOTBRIDGE, LOOKOUT, RANGER_CABIN, SILENT_GATE } from '../world/layout';

const FIRE = '#FFB35C';

function Cabin({ shadows }: { shadows: boolean }) {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  useEffect(() => {
    let alive = true;
    loadModel('starter_cabin').then((s) => {
      if (!alive || !s) return;
      const clone = s.clone(true);
      clone.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = shadows;
          mesh.receiveShadow = true;
        }
      });
      setScene(clone);
    });
    return () => {
      alive = false;
    };
  }, [shadows]);
  if (!scene) {
    return (
      <group>
        <mesh position={[0, 1.1, 0]} castShadow={shadows}>
          <boxGeometry args={[5.4, 2.2, 4.4]} />
          <meshLambertMaterial color="#6B5238" />
        </mesh>
        <mesh position={[0, 2.6, 0]} rotation={[0, 0, 0]}>
          <coneGeometry args={[4.2, 1.8, 4]} />
          <meshLambertMaterial color="#3E5142" />
        </mesh>
      </group>
    );
  }
  return <primitive object={scene} />;
}

export function RangerCamp({ shadows }: { shadows: boolean }) {
  const y = terrainHeight(RANGER_CABIN.x, RANGER_CABIN.z);
  const towerY = terrainHeight(RANGER_CABIN.x + 3, RANGER_CABIN.z - 3);
  const blink = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!blink.current) return;
    const t = state.clock.elapsedTime;
    const pulse = Math.max(0, Math.sin(t * 1.6));
    (blink.current.material as THREE.MeshBasicMaterial).opacity = 0.25 + pulse * 0.75;
  });
  return (
    <group>
      <group position={[RANGER_CABIN.x, y + 0.02, RANGER_CABIN.z]} rotation={[0, RANGER_CABIN.rot, 0]} scale={1.65}>
        <Cabin shadows={shadows} />
      </group>

      {/* Radio tower */}
      <group position={[RANGER_CABIN.x + 3.4, towerY, RANGER_CABIN.z - 3.4]}>
        {[
          [-0.7, -0.7],
          [0.7, -0.7],
          [-0.7, 0.7],
          [0.7, 0.7],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x * 0.55, 4.6, z * 0.55]} rotation={[z * 0.06, 0, -x * 0.06]} castShadow={shadows}>
            <cylinderGeometry args={[0.045, 0.07, 9.2, 5]} />
            <meshLambertMaterial color="#5B5F58" />
          </mesh>
        ))}
        {[2.2, 4.2, 6.2, 8.2].map((h, i) => (
          <mesh key={`bar-${i}`} position={[0, h, 0]} rotation={[0, Math.PI / 4, 0]}>
            <boxGeometry args={[1.1, 0.05, 0.05]} />
            <meshLambertMaterial color="#4D514B" />
          </mesh>
        ))}
        <mesh position={[0, 9.3, 0]}>
          <boxGeometry args={[0.7, 0.18, 0.7]} />
          <meshLambertMaterial color="#3D423C" />
        </mesh>
        <mesh ref={blink} position={[0, 9.55, 0]}>
          <sphereGeometry args={[0.12, 8, 6]} />
          <meshBasicMaterial color="#E06A55" transparent opacity={0.9} />
        </mesh>
        <pointLight position={[0, 9.5, 0]} color="#E06A55" intensity={1.1} distance={8} />
      </group>

      {/* Searchlight case and crates */}
      <group position={[RANGER_CABIN.x + 0.4, terrainHeight(RANGER_CABIN.x + 0.4, RANGER_CABIN.z + 4.4) + 0.25, RANGER_CABIN.z + 4.4]} rotation={[0, 0.4, 0]}>
        <mesh castShadow={shadows}>
          <boxGeometry args={[0.85, 0.5, 0.6]} />
          <meshStandardMaterial color="#4E5350" metalness={0.6} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[0.35, 0.08, 0.4]} />
          <meshStandardMaterial color="#2C2F2C" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0.26, 0.26, 0]} rotation={[0, 0, -0.4]}>
          <cylinderGeometry args={[0.03, 0.03, 0.5, 5]} />
          <meshStandardMaterial color="#8A8F87" metalness={0.7} roughness={0.4} />
        </mesh>
      </group>

      <mesh position={[RANGER_CABIN.x - 4.6, terrainHeight(RANGER_CABIN.x - 4.6, RANGER_CABIN.z + 4) + 0.35, RANGER_CABIN.z + 4]} rotation={[0, -0.3, 0]} castShadow={shadows}>
        <boxGeometry args={[1.1, 0.7, 0.8]} />
        <meshStandardMaterial color="#5C4632" roughness={0.9} />
      </mesh>
    </group>
  );
}

export function Footbridge({ shadows }: { shadows: boolean }) {
  const y = terrainHeight(FOOTBRIDGE.x, FOOTBRIDGE.z);
  const planks = useMemo(() => Array.from({ length: 7 }, (_, i) => i), []);
  return (
    <group position={[FOOTBRIDGE.x, y + 0.15, FOOTBRIDGE.z]} rotation={[0, FOOTBRIDGE.rot, 0]}>
      {planks.map((i) => {
        const broken = i === 3;
        return (
          <mesh key={i} position={[(i - 3) * 0.7, broken ? -0.55 : 0, broken ? 0.12 : 0]} rotation={[broken ? 0.25 : 0, 0, broken ? 0.1 : 0]} castShadow={shadows}>
            <boxGeometry args={[0.62, 0.1, 2.6]} />
            <meshLambertMaterial color={broken ? '#4A3B2B' : '#6A5238'} />
          </mesh>
        );
      })}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, -0.12, side * 1.15]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 5.2, 5]} />
          <meshLambertMaterial color="#4B3A28" />
        </mesh>
      ))}
      {[-2.6, 0, 2.6].map((x, i) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.55, -1.2]} castShadow={shadows}>
            <cylinderGeometry args={[0.07, 0.09, 1.6, 5]} />
            <meshLambertMaterial color="#4B3A28" />
          </mesh>
          <mesh position={[0, 0.55, 1.2]} castShadow={shadows}>
            <cylinderGeometry args={[0.07, 0.09, 1.6, 5]} />
            <meshLambertMaterial color="#4B3A28" />
          </mesh>
          {i < 2 ? (
            <mesh position={[1.3, 1.0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.025, 0.025, 2.4, 4]} />
              <meshLambertMaterial color="#8A7B5C" />
            </mesh>
          ) : null}
        </group>
      ))}
    </group>
  );
}

export function Lookout({ shadows }: { shadows: boolean }) {
  const y = terrainHeight(LOOKOUT.x, LOOKOUT.z);
  return (
    <group position={[LOOKOUT.x, y, LOOKOUT.z]} rotation={[0, 0.5, 0]}>
      {[
        [-1.1, -1.1],
        [1.1, -1.1],
        [-1.1, 1.1],
        [1.1, 1.1],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x * 0.72, 2.9, z * 0.72]} rotation={[z * 0.04, 0, -x * 0.04]} castShadow={shadows}>
          <boxGeometry args={[0.14, 5.9, 0.14]} />
          <meshLambertMaterial color="#58462F" />
        </mesh>
      ))}
      {[1.4, 3.2].map((h) => (
        <mesh key={h} position={[0, h, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[2.1, 0.06, 0.06]} />
          <meshLambertMaterial color="#4A3B29" />
        </mesh>
      ))}
      <mesh position={[0, 5.9, 0]} castShadow={shadows} receiveShadow>
        <boxGeometry args={[2.9, 0.16, 2.9]} />
        <meshLambertMaterial color="#6A5238" />
      </mesh>
      <mesh position={[0, 6.6, -1.35]}>
        <boxGeometry args={[2.9, 0.55, 0.08]} />
        <meshLambertMaterial color="#5C4830" />
      </mesh>
      <mesh position={[0, 6.6, 1.35]}>
        <boxGeometry args={[2.9, 0.55, 0.08]} />
        <meshLambertMaterial color="#5C4830" />
      </mesh>
      <mesh position={[-1.35, 6.6, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[2.9, 0.55, 0.08]} />
        <meshLambertMaterial color="#5C4830" />
      </mesh>
      {/* Broken roof beam */}
      <mesh position={[0.6, 7.2, 0]} rotation={[0, 0, 0.35]}>
        <boxGeometry args={[2.6, 0.1, 0.1]} />
        <meshLambertMaterial color="#4A3B29" />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={`ladder-${i}`} position={[1.55, 0.5 + i * 0.85, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.5, 0.06, 0.08]} />
          <meshLambertMaterial color="#5C4830" />
        </mesh>
      ))}
    </group>
  );
}

export function SilentGate({ shadows }: { shadows: boolean }) {
  const y = terrainHeight(SILENT_GATE.x, SILENT_GATE.z);
  return (
    <group position={[SILENT_GATE.x, y, SILENT_GATE.z]} rotation={[0, SILENT_GATE.rot, 0]}>
      {[-2.1, 2.1].map((x) => (
        <mesh key={x} position={[x, 1.9, 0]} castShadow={shadows}>
          <boxGeometry args={[0.35, 3.8, 0.35]} />
          <meshStandardMaterial color="#4E5350" metalness={0.5} roughness={0.6} />
        </mesh>
      ))}
      {[-1.4, -0.5, 0.4, 1.3].map((x) => (
        <mesh key={x} position={[x, 1.9, 0]} rotation={[0, 0, 0.06]}>
          <boxGeometry args={[0.16, 3.5, 0.12]} />
          <meshStandardMaterial color="#6A5A48" metalness={0.6} roughness={0.55} />
        </mesh>
      ))}
      <mesh position={[0, 2.6, 0]}>
        <boxGeometry args={[4.2, 0.14, 0.14]} />
        <meshStandardMaterial color="#6A5A48" metalness={0.6} roughness={0.55} />
      </mesh>
      <mesh position={[0, 2.9, 0.14]} rotation={[0, 0, -0.05]}>
        <boxGeometry args={[1.8, 0.5, 0.05]} />
        <meshLambertMaterial color="#C8B98A" />
      </mesh>
      <mesh position={[0, 4.15, 0]}>
        <boxGeometry args={[4.9, 0.22, 0.3]} />
        <meshStandardMaterial color="#4E5350" metalness={0.4} roughness={0.6} />
      </mesh>
    </group>
  );
}

export function StarterCamp({ shadows }: { shadows: boolean }) {
  const bedY = terrainHeight(1.8, -2.4);
  return (
    <group>
      {/* Bedroll */}
      <group position={[1.8, bedY + 0.1, -2.4]} rotation={[0, -0.5, 0]}>
        <mesh castShadow={shadows}>
          <boxGeometry args={[0.95, 0.14, 2.1]} />
          <meshLambertMaterial color="#6E5A3D" />
        </mesh>
        <mesh position={[0, 0.12, -0.6]}>
          <boxGeometry args={[0.8, 0.12, 0.55]} />
          <meshLambertMaterial color="#8C7A55" />
        </mesh>
      </group>
      {/* Fire ring (unlit starter pit) */}
      <group position={[0, terrainHeight(0, 0) + 0.02, 0]}>
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.95, 0.12, Math.sin(a) * 0.95]} rotation={[0.2, a, 0]}>
              <dodecahedronGeometry args={[0.26, 0]} />
              <meshLambertMaterial color="#6B6C62" />
            </mesh>
          );
        })}
        <mesh position={[0, 0.1, 0]} rotation={[0.4, 0.3, 0]}>
          <cylinderGeometry args={[0.13, 0.16, 1.2, 6]} />
          <meshLambertMaterial color="#3B2E22" />
        </mesh>
        <mesh position={[0, 0.09, 0]} rotation={[0.4, 1.1, 0]}>
          <cylinderGeometry args={[0.13, 0.16, 1.2, 6]} />
          <meshLambertMaterial color="#423326" />
        </mesh>
      </group>
      {/* Tripod and small pot */}
      <group position={[-2.2, terrainHeight(-2.2, 1.4), 1.4]}>
        {[0, 2.1, 4.2].map((a) => (
          <mesh key={a} position={[Math.cos(a) * 0.45, 0.8, Math.sin(a) * 0.45]} rotation={[Math.sin(a) * 0.16, 0, -Math.cos(a) * 0.16]}>
            <cylinderGeometry args={[0.035, 0.045, 1.7, 4]} />
            <meshLambertMaterial color="#4A3B29" />
          </mesh>
        ))}
        <mesh position={[0, 1.55, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.7, 5]} />
          <meshLambertMaterial color="#5B5F58" />
        </mesh>
        <mesh position={[0, 0.85, 0]}>
          <cylinderGeometry args={[0.26, 0.2, 0.32, 8]} />
          <meshStandardMaterial color="#3D4340" metalness={0.5} roughness={0.6} />
        </mesh>
      </group>
      {/* Signpost */}
      <group position={[-3.6, terrainHeight(-3.6, -1.2), -1.2]} rotation={[0, 0.3, 0]}>
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[0.12, 1.8, 0.12]} />
          <meshLambertMaterial color="#5A4632" />
        </mesh>
        <mesh position={[0.28, 1.45, 0]} rotation={[0, 0, -0.04]}>
          <boxGeometry args={[0.72, 0.3, 0.05]} />
          <meshLambertMaterial color="#C9B98F" />
        </mesh>
      </group>
      {/* Wood pile */}
      <group position={[3.2, terrainHeight(3.2, -0.6), -0.6]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.12 + (i % 2) * 0.2, (i - 1) * 0.2]} rotation={[0, 0.2 * i, Math.PI / 2]}>
            <cylinderGeometry args={[0.1, 0.1, 1.0, 5]} />
            <meshLambertMaterial color="#4B3A28" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function StructureMesh({ defId, structureId }: { defId: string; structureId: string }) {
  const engine = getEngine();
  const structure = engine?.state.structures.find((s) => s.id === structureId);
  const def = STRUCTURES[defId];
  const y = terrainHeight(structure?.x ?? 0, structure?.z ?? 0);
  const fireLight = useRef<THREE.PointLight>(null);
  const flame = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (fireLight.current) fireLight.current.intensity = 2.1 + Math.sin(t * 7.3) * 0.35 + Math.sin(t * 13.1) * 0.2;
    if (flame.current) {
      flame.current.scale.y = 1 + Math.sin(t * 9.2) * 0.12;
      flame.current.scale.x = 1 + Math.sin(t * 6.1 + 2) * 0.08;
    }
  });

  if (!structure || !def) return null;
  const pending = structure.pending ?? 0;
  const growth = def.production ? Math.min(1, 0.35 + pending * 0.16) : 1;

  switch (defId) {
    case 'campfire':
      return (
        <group position={[structure.x, y, structure.z]} rotation={[0, structure.rot * Math.PI * 0.5, 0]}>
          {Array.from({ length: 9 }).map((_, i) => {
            const a = (i / 9) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.9, 0.11, Math.sin(a) * 0.9]} rotation={[0.2, a, 0]} castShadow>
                <dodecahedronGeometry args={[0.24, 0]} />
                <meshLambertMaterial color="#737568" />
              </mesh>
            );
          })}
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 0.14, 0]} rotation={[0.35, (i / 3) * Math.PI, 0]}>
              <cylinderGeometry args={[0.12, 0.15, 1.1, 6]} />
              <meshLambertMaterial color="#3F2F21" />
            </mesh>
          ))}
          <mesh ref={flame} position={[0, 0.5, 0]}>
            <coneGeometry args={[0.28, 0.9, 7]} />
            <meshBasicMaterial color="#FFB25A" transparent opacity={0.9} />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <coneGeometry args={[0.16, 0.5, 6]} />
            <meshBasicMaterial color="#FFE7B0" />
          </mesh>
          <pointLight ref={fireLight} position={[0, 0.9, 0]} color={FIRE} intensity={2.2} distance={11} decay={2} />
        </group>
      );
    case 'workbench':
      return (
        <group position={[structure.x, y, structure.z]} rotation={[0, structure.rot * Math.PI * 0.5, 0]}>
          <mesh position={[0, 0.85, 0]} castShadow>
            <boxGeometry args={[1.9, 0.12, 1.0]} />
            <meshLambertMaterial color="#6A5238" />
          </mesh>
          {[
            [-0.8, -0.38],
            [0.8, -0.38],
            [-0.8, 0.38],
            [0.8, 0.38],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.42, z]}>
              <boxGeometry args={[0.1, 0.85, 0.1]} />
              <meshLambertMaterial color="#4B3A28" />
            </mesh>
          ))}
          <mesh position={[0.45, 0.99, 0.15]} rotation={[0, 0.4, 0]}>
            <boxGeometry args={[0.5, 0.16, 0.3]} />
            <meshStandardMaterial color="#5A5F59" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[-0.4, 1.0, 0]} rotation={[0, 0, 0.3]}>
            <boxGeometry args={[0.5, 0.06, 0.06]} />
            <meshStandardMaterial color="#8E9288" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[-0.4, 1.12, 0]} rotation={[0, 0, 0.3]}>
            <boxGeometry args={[0.18, 0.2, 0.05]} />
            <meshLambertMaterial color="#7A6A4C" />
          </mesh>
        </group>
      );
    case 'storage_crate':
      return (
        <group position={[structure.x, y, structure.z]} rotation={[0, structure.rot * Math.PI * 0.5, 0]}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[1.2, 0.9, 0.9]} />
            <meshLambertMaterial color="#6A5238" />
          </mesh>
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[1.22, 0.1, 0.92]} />
            <meshStandardMaterial color="#4F544D" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[1.05, 0.08, 0.8]} />
            <meshLambertMaterial color="#7C6344" />
          </mesh>
        </group>
      );
    case 'simple_shelter':
      return (
        <group position={[structure.x, y, structure.z]} rotation={[0, structure.rot * Math.PI * 0.5, 0]}>
          <mesh position={[-1.9, 1.1, 0]} rotation={[0, 0, -0.04]} castShadow>
            <boxGeometry args={[0.16, 2.6, 0.16]} />
            <meshLambertMaterial color="#58462F" />
          </mesh>
          <mesh position={[1.9, 1.1, 0]} castShadow>
            <boxGeometry args={[0.16, 2.6, 0.16]} />
            <meshLambertMaterial color="#58462F" />
          </mesh>
          <mesh position={[0, 2.0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <boxGeometry args={[0.14, 4.0, 0.14]} />
            <meshLambertMaterial color="#58462F" />
          </mesh>
          <mesh position={[0, 1.55, -1.25]} rotation={[0.62, 0, 0]} castShadow>
            <boxGeometry args={[4.3, 0.1, 3.1]} />
            <meshLambertMaterial color="#3E5142" />
          </mesh>
          <mesh position={[0, 1.55, 1.25]} rotation={[-0.62, 0, 0]} castShadow>
            <boxGeometry args={[4.3, 0.1, 3.1]} />
            <meshLambertMaterial color="#445847" />
          </mesh>
          <mesh position={[0, 0.28, 0]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.75, 0.75, 0.16, 10]} />
            <meshLambertMaterial color="#3C4A32" />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <boxGeometry args={[1.5, 0.06, 2.0]} />
            <meshLambertMaterial color="#6A5A3D" />
          </mesh>
          <pointLight position={[0, 1.2, 0]} color="#FFC48A" intensity={0.35} distance={5} />
        </group>
      );
    case 'water_collector':
      return (
        <group position={[structure.x, y, structure.z]} rotation={[0, structure.rot * Math.PI * 0.5, 0]}>
          <mesh position={[0, 0.6, 0]} castShadow>
            <cylinderGeometry args={[0.6, 0.52, 1.2, 10]} />
            <meshLambertMaterial color="#5C4830" />
          </mesh>
          <mesh position={[0, 0.62, 0]}>
            <cylinderGeometry args={[0.5, 0.5, 0.95, 10]} />
            <meshStandardMaterial color="#2F4A46" transparent opacity={0.7} roughness={0.2} metalness={0.2} />
          </mesh>
          <mesh position={[0, 1.4, 0]}>
            <coneGeometry args={[0.9, 0.55, 10, 1, true]} />
            <meshLambertMaterial color="#4E5A4A" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 1.75, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.3, 5]} />
            <meshLambertMaterial color="#4E5A4A" />
          </mesh>
        </group>
      );
    case 'crop_plot':
      return (
        <group position={[structure.x, y, structure.z]} rotation={[0, structure.rot * Math.PI * 0.5, 0]}>
          <mesh position={[0, 0.12, 0]} receiveShadow>
            <boxGeometry args={[2.3, 0.24, 1.5]} />
            <meshLambertMaterial color="#4E3F2C" />
          </mesh>
          {[
            [-0.6, -0.3],
            [0, 0.2],
            [0.6, -0.1],
            [0.3, 0.45],
            [-0.3, 0.4],
          ].map(([x, z], i) => (
            <group key={i} position={[x, 0.24, z]} scale={[growth, growth, growth]}>
              <mesh position={[0, 0.22, 0]}>
                <coneGeometry args={[0.16, 0.45, 5]} />
                <meshLambertMaterial color="#527A46" />
              </mesh>
              {[0, 1, 2].map((b) => {
                const a = (b / 3) * Math.PI * 2 + i;
                return (
                  <mesh key={b} position={[Math.cos(a) * 0.12, 0.32, Math.sin(a) * 0.12]}>
                    <sphereGeometry args={[0.055, 5, 4]} />
                    <meshLambertMaterial color={growth > 0.9 ? '#B8574A' : '#6E8A50'} />
                  </mesh>
                );
              })}
            </group>
          ))}
        </group>
      );
    default:
      return null;
  }
}

function BuildGhost() {
  const [defId, setDefId] = useState<string | null>(null);
  const group = useRef<THREE.Group>(null);
  const lastDef = useRef<string | null>(null);
  useFrame(() => {
    const g = getEngine()?.getBuildGhost() ?? null;
    if (!g) {
      if (group.current) group.current.visible = false;
      if (lastDef.current !== null) {
        lastDef.current = null;
        setDefId(null);
      }
      return;
    }
    if (group.current) {
      group.current.visible = true;
      group.current.position.set(g.x, g.y + 0.02, g.z);
      group.current.rotation.y = (g.rot * Math.PI) / 2;
      const color = g.valid ? (g.affordable ? '#8FD08A' : '#E8C98F') : '#D98170';
      group.current.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          const mat = mesh.material as THREE.MeshBasicMaterial;
          if (mat && 'color' in mat) mat.color.set(color);
        }
      });
    }
    if (lastDef.current !== g.defId) {
      lastDef.current = g.defId;
      setDefId(g.defId);
    }
  });
  if (!defId) return null;
  const def = STRUCTURES[defId];
  const radius = def?.radius ?? 1;
  return (
    <group ref={group} visible={false}>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[radius * 1.5, 1.2, radius * 1.5]} />
        <meshBasicMaterial color="#8FD08A" wireframe transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.95, radius * 1.08, 32]} />
        <meshBasicMaterial color="#8FD08A" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function Structures({ revision }: { revision: number }) {
  const engine = getEngine();
  const list = useMemo(() => {
    void revision;
    return engine?.state.structures.map((s) => ({ ...s })) ?? [];
  }, [revision, engine]);
  return (
    <group>
      {list.map((s) => (
        <StructureMesh key={s.id} defId={s.defId} structureId={s.id} />
      ))}
      <BuildGhost />
    </group>
  );
}
