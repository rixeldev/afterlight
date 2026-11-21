import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { REGION } from '../../data/world';
import { terrainHeight, WATER_LEVEL } from '../world/terrain';

interface Item {
  x: number;
  y: number;
  z: number;
  rot: number;
  sx: number;
  sy: number;
  sz: number;
}

function Instances({
  geometry,
  material,
  items,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: Item[];
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D();
    items.forEach((item, i) => {
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(0, item.rot, 0);
      dummy.scale.set(item.sx, item.sy, item.sz);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [items]);
  if (items.length === 0) return null;
  return <instancedMesh ref={mesh} args={[geometry, material, items.length]} count={items.length} frustumCulled={false} />;
}

/** Reeds and lily pads turn the lake from a blue shape into a habitat. */
export function LakeLife() {
  const { reeds, heads, pads } = useMemo(() => {
    let seed = 90210;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const reeds: Item[] = [];
    const heads: Item[] = [];
    const pads: Item[] = [];
    const { x: cx, z: cz, rx, rz } = REGION.lake;
    for (let i = 0; i < 64; i += 1) {
      const angle = rand() * Math.PI * 2;
      const r = 0.83 + rand() * 0.14;
      const x = cx + Math.cos(angle) * rx * r;
      const z = cz + Math.sin(angle) * rz * r;
      const ground = terrainHeight(x, z);
      if (ground > WATER_LEVEL + 0.5 || ground < WATER_LEVEL - 0.9) continue;
      const s = 0.7 + rand() * 0.8;
      const base = Math.max(ground, WATER_LEVEL - 0.15);
      reeds.push({ x, y: base, z, rot: rand() * Math.PI, sx: s, sy: s, sz: s });
      heads.push({ x, y: base + 1.08 * s, z, rot: 0, sx: s, sy: s, sz: s });
    }
    for (let i = 0; i < 22; i += 1) {
      const angle = rand() * Math.PI * 2;
      const r = 0.18 + rand() * 0.5;
      const x = cx + Math.cos(angle) * rx * r;
      const z = cz + Math.sin(angle) * rz * r;
      pads.push({
        x,
        y: WATER_LEVEL + 0.03,
        z,
        rot: rand() * Math.PI * 2,
        sx: 0.7 + rand() * 0.75,
        sy: 1,
        sz: 0.7 + rand() * 0.75,
      });
    }
    return { reeds, heads, pads };
  }, []);

  const stemGeo = useMemo(() => new THREE.CylinderGeometry(0.018, 0.035, 1.2, 4), []);
  const headGeo = useMemo(() => new THREE.CylinderGeometry(0.045, 0.035, 0.24, 5), []);
  const padGeo = useMemo(() => new THREE.CircleGeometry(0.42, 12).rotateX(-Math.PI / 2), []);
  const stemMat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#6E8048' }), []);
  const headMat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#7E6B3D' }), []);
  const padMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#4F774B', side: THREE.DoubleSide }),
    [],
  );

  return (
    <group>
      <Instances geometry={stemGeo} material={stemMat} items={reeds} />
      <Instances geometry={headGeo} material={headMat} items={heads} />
      <Instances geometry={padGeo} material={padMat} items={pads} />
    </group>
  );
}
