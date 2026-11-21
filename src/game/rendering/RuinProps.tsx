import { useMemo } from 'react';
import * as THREE from 'three';
import { terrainHeight } from '../world/terrain';

const RUST = '#8A5B42';
const RUST_DARK = '#6B4534';
const GLASS = '#2F3A38';
const TIRE = '#2A2723';
const WOOD = '#9A7A52';
const METAL = '#7C8078';

function Pole({
  x,
  z,
  height = 5.2,
  lean = 0,
}: {
  x: number;
  z: number;
  height?: number;
  lean?: number;
}) {
  const y = terrainHeight(x, z);
  const post = useMemo(() => new THREE.MeshLambertMaterial({ color: '#6B543C' }), []);
  const arm = useMemo(() => new THREE.MeshLambertMaterial({ color: '#5D4834' }), []);
  const insulator = useMemo(() => new THREE.MeshLambertMaterial({ color: '#9FB0A4' }), []);
  return (
    <group position={[x, y, z]} rotation={[0, 0, lean]}>
      <mesh position={[0, height / 2, 0]} material={post} castShadow>
        <cylinderGeometry args={[0.11, 0.16, height, 6]} />
      </mesh>
      <mesh position={[0, height - 0.55, 0]} material={arm} castShadow>
        <boxGeometry args={[1.6, 0.11, 0.12]} />
      </mesh>
      {[-0.6, 0.6].map((dx) => (
        <mesh key={dx} position={[dx, height - 0.42, 0]} material={insulator}>
          <cylinderGeometry args={[0.05, 0.05, 0.2, 5]} />
        </mesh>
      ))}
    </group>
  );
}

/** Sagging utility wires between the poles along the ranger trail. */
function Wires({ points }: { points: { x: number; y: number; z: number }[] }) {
  const wires = useMemo(() => {
    return points.slice(0, -1).map((from, i) => {
      const to = points[i + 1]!;
      const mid = new THREE.Vector3((from.x + to.x) / 2, (from.y + to.y) / 2 - 0.55, (from.z + to.z) / 2);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(from.x, from.y, from.z),
        mid,
        new THREE.Vector3(to.x, to.y, to.z),
      ]);
      return new THREE.TubeGeometry(curve, 8, 0.022, 4, false);
    });
  }, [points]);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#2E332F' }), []);
  return (
    <group>
      {wires.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={material} />
      ))}
    </group>
  );
}

/** Wrecked pickup: the collapse left the valley's traffic where it stood. */
function WreckedTruck({ x, z, rot }: { x: number; z: number; rot: number }) {
  const y = terrainHeight(x, z);
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: RUST, metalness: 0.25, roughness: 0.86 }), []);
  const dark = useMemo(() => new THREE.MeshLambertMaterial({ color: RUST_DARK }), []);
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: GLASS, metalness: 0.4, roughness: 0.35 }), []);
  const tire = useMemo(() => new THREE.MeshLambertMaterial({ color: TIRE }), []);
  const wheel = useMemo(() => new THREE.CylinderGeometry(0.33, 0.33, 0.22, 10).rotateZ(Math.PI / 2), []);
  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]}>
      <group rotation={[0, 0, -0.035]}>
        <mesh position={[0, 0.62, 0]} material={body} castShadow>
          <boxGeometry args={[3.1, 0.72, 1.5]} />
        </mesh>
        <mesh position={[-0.35, 1.18, 0]} material={body} castShadow>
          <boxGeometry args={[1.55, 0.66, 1.4]} />
        </mesh>
        <mesh position={[-0.35, 1.2, 0]} material={glass}>
          <boxGeometry args={[1.3, 0.42, 1.44]} />
        </mesh>
        <mesh position={[1.5, 0.74, 0]} material={dark}>
          <boxGeometry args={[0.6, 0.42, 1.44]} />
        </mesh>
        <mesh position={[0.2, 0.86, 0.76]} material={dark}>
          <boxGeometry args={[2.4, 0.5, 0.06]} />
        </mesh>
        {[-0.95, 0.95].map((dx) =>
          [-0.74, 0.74].map((dz) => (
            <mesh key={`${dx}-${dz}`} geometry={wheel} material={tire} position={[dx, 0.3, dz]} castShadow />
          )),
        )}
        <mesh position={[0.6, 1.35, 0]} rotation={[0.1, 0.2, 0.06]} material={dark}>
          <boxGeometry args={[0.9, 0.08, 0.8]} />
        </mesh>
      </group>
    </group>
  );
}

/** A rowboat pulled up on the sand, oars still inside. */
function Rowboat({ x, z, rot }: { x: number; z: number; rot: number }) {
  const y = terrainHeight(x, z);
  const hull = useMemo(() => new THREE.MeshLambertMaterial({ color: '#77909A' }), []);
  const trim = useMemo(() => new THREE.MeshLambertMaterial({ color: WOOD }), []);
  return (
    <group position={[x, y + 0.16, z]} rotation={[0.06, rot, 0.02]}>
      <mesh material={hull} castShadow>
        <boxGeometry args={[2.4, 0.36, 0.9]} />
      </mesh>
      <mesh position={[0, 0.24, 0]} material={trim}>
        <boxGeometry args={[2.32, 0.08, 0.84]} />
      </mesh>
      <mesh position={[0, 0.3, 0.18]} rotation={[0, 0.25, 0]} material={trim}>
        <boxGeometry args={[0.1, 0.05, 1.5]} />
      </mesh>
      <mesh position={[0, 0.3, -0.2]} rotation={[0, -0.2, 0]} material={trim}>
        <boxGeometry args={[0.1, 0.05, 1.5]} />
      </mesh>
      <mesh position={[0, 0.36, 0]} material={trim}>
        <boxGeometry args={[0.34, 0.06, 0.8]} />
      </mesh>
    </group>
  );
}

/** Split-rail fence around the homestead edge. */
function FenceRail({ x, z, rot, length = 2.4 }: { x: number; z: number; rot: number; length?: number }) {
  const y = terrainHeight(x, z);
  const material = useMemo(() => new THREE.MeshLambertMaterial({ color: WOOD }), []);
  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]}>
      {[0.42, 0.86].map((h) => (
        <mesh key={h} position={[0, h, 0]} material={material} castShadow>
          <boxGeometry args={[length, 0.08, 0.06]} />
        </mesh>
      ))}
      {[-length / 2, length / 2].map((dx) => (
        <mesh key={dx} position={[dx, 0.55, 0]} material={material} castShadow>
          <boxGeometry args={[0.11, 1.1, 0.11]} />
        </mesh>
      ))}
    </group>
  );
}

const POLES = [
  { x: 7.5, z: -0.5 },
  { x: 15.5, z: -9.5 },
  { x: 23.5, z: -20.5 },
  { x: 30.5, z: -31 },
];

const TOWERS = POLES.map((p) => ({ x: p.x, y: terrainHeight(p.x, p.z) + 4.75, z: p.z }));

const SIGN_METAL = new THREE.MeshLambertMaterial({ color: METAL });
const SIGN_BOARD = new THREE.MeshLambertMaterial({ color: '#C9A46C' });

export function RuinProps() {
  return (
    <group>
      {POLES.map((p, i) => (
        <Pole key={i} x={p.x} z={p.z} lean={i === 3 ? -0.04 : 0} />
      ))}
      <Wires points={TOWERS} />
      <WreckedTruck x={24.6} z={-25.4} rot={0.72} />
      <Rowboat x={20.4} z={13.6} rot={1.15} />
      <FenceRail x={8.6} z={5.4} rot={0.55} />
      <FenceRail x={10.7} z={7.1} rot={0.55} />
      <FenceRail x={12.8} z={8.8} rot={0.55} />
      <mesh position={[25.4, terrainHeight(25.4, -23.2) + 0.55, -23.2]} rotation={[0, 0.4, 0]} material={SIGN_METAL}>
        <boxGeometry args={[0.5, 0.9, 0.08]} />
      </mesh>
      <mesh position={[25.4, terrainHeight(25.4, -23.2) + 1.15, -23.2]} rotation={[0, 0.4, 0]} material={SIGN_BOARD}>
        <boxGeometry args={[0.62, 0.34, 0.05]} />
      </mesh>
    </group>
  );
}
