import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber/native';
import { getEngine } from '../runtime/session';
import { generateDecor } from '../world/layout';
import { terrainHeight } from '../world/terrain';
import { loadModelParts, type ModelPart } from './assets';

interface Xform {
  x: number;
  y: number;
  z: number;
  rot: number;
  sx: number;
  sy: number;
  sz: number;
  tint?: number;
}

function useModelParts(model: 'stylized_tree' | 'stylized_rock'): ModelPart[] {
  const [parts, setParts] = useState<ModelPart[]>([]);
  useEffect(() => {
    let alive = true;
    loadModelParts(model).then((p) => {
      if (alive) setParts(p);
    });
    return () => {
      alive = false;
    };
  }, [model]);
  return parts;
}

function InstancedParts({
  parts,
  items,
  castShadow,
  tint,
  tints,
  tintPart,
}: {
  parts: ModelPart[];
  items: Xform[];
  castShadow: boolean;
  tint?: [number, number, number];
  tints?: string[];
  tintPart?: number;
}) {
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const color = tint ? new THREE.Color(...tint) : null;
    const perInstance = new THREE.Color();
    parts.forEach((_, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      items.forEach((item, idx) => {
        dummy.position.set(item.x, item.y, item.z);
        dummy.rotation.set(0, item.rot, 0);
        dummy.scale.set(item.sx, item.sy, item.sz);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
        if (color) mesh.setColorAt(idx, color);
        if (tints && tintPart === i && tints[idx]) {
          perInstance.set(tints[idx]!);
          mesh.setColorAt(idx, perInstance);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
        (mesh.material as THREE.Material).needsUpdate = true;
      }
      mesh.computeBoundingSphere();
    });
  }, [parts, items, tint, tints, tintPart]);

  return (
    <>
      {parts.map((part, i) => (
        <instancedMesh
          key={`${i}-${items.length}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
          args={[part.geometry, part.material, Math.max(1, items.length)]}
          count={items.length}
          castShadow={castShadow}
          receiveShadow={false}
          frustumCulled={false}
        />
      ))}
    </>
  );
}

/** Polls lightweight world revisions so instancing only rebuilds on change. */
export function useWorldRevision(): number {
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      const engine = getEngine();
      if (!engine) return;
      const production = engine.state.structures.reduce((n, s) => n + (s.pending ?? 0), 0);
      const next =
        engine.nodeRevision * 13 +
        engine.state.structures.length * 3 +
        production +
        (engine.getThreat() ? 1 : 0);
      setRev((prev) => (prev === next ? prev : next));
    }, 450);
    return () => clearInterval(id);
  }, []);
  return rev;
}

export function Vegetation({
  revision,
  shadows,
  quality,
}: {
  revision: number;
  shadows: boolean;
  quality: 'low' | 'medium' | 'high';
}) {
  const treeParts = useModelParts('stylized_tree');
  const rockParts = useModelParts('stylized_rock');
  const decor = useMemo(() => generateDecor(), []);

  const { trees, treeTints, stumps, rocks, rockStumps, bushes, fibers, grassTufts, ferns, pebbles, logs, flowers, flowerTints, ao, moss } = useMemo(() => {
    void revision;
    const engine = getEngine();
    const nodes = engine?.nodes ?? [];
    const treeItems: Xform[] = [];
    const treeColors: string[] = [];
    const stumpItems: Xform[] = [];
    const rockItems: Xform[] = [];
    const rockStumpItems: Xform[] = [];
    const bushItems: Xform[] = [];
    const fiberItems: Xform[] = [];
    const aoItems: { x: number; z: number; y: number; r: number }[] = [];
    const mossItems: Xform[] = [];

    for (const node of nodes) {
      const state = engine?.state.nodes[node.id];
      const charges = state?.charges ?? node.charges;
      const depleted = charges <= 0 && node.kind !== 'water';
      const y = terrainHeight(node.x, node.z);
      if (node.kind === 'tree') {
        if (depleted) {
          stumpItems.push({ x: node.x, y, z: node.z, rot: node.rot, sx: 0.5 * node.scale, sy: 0.7, sz: 0.5 * node.scale });
        } else {
          aoItems.push({ x: node.x, z: node.z, y, r: 1.55 * node.scale });
          treeItems.push({
            x: node.x,
            y,
            z: node.z,
            rot: node.rot,
            sx: node.scale,
            sy: node.scale * (0.9 + ((node.x * 7) % 5) * 0.03),
            sz: node.scale,
          });
          const palette = ['#79A86C', '#6A995F', '#8AB679', '#5E8C56', '#94BF82'];
          treeColors.push(palette[Math.abs(Math.round(node.x * 13 + node.z * 7)) % palette.length]!);
        }
      } else if (node.kind === 'rock') {
        if (depleted) {
          rockStumpItems.push({
            x: node.x,
            y,
            z: node.z,
            rot: node.rot,
            sx: node.scale * 0.6,
            sy: node.scale * 0.45,
            sz: node.scale * 0.6,
          });
        } else {
          aoItems.push({ x: node.x, z: node.z, y, r: 1.1 * node.scale });
          rockItems.push({ x: node.x, y: y - 0.1, z: node.z, rot: node.rot, sx: node.scale, sy: node.scale * 0.85, sz: node.scale });
          mossItems.push({
            x: node.x + Math.cos(node.rot) * 0.12 * node.scale,
            y: y + 0.48 * node.scale,
            z: node.z + Math.sin(node.rot) * 0.12 * node.scale,
            rot: node.rot,
            sx: node.scale * 0.5,
            sy: node.scale * 0.18,
            sz: node.scale * 0.45,
          });
        }
      } else if (node.kind === 'bush') {
        if (!depleted) {
          aoItems.push({ x: node.x, z: node.z, y, r: 0.9 * node.scale });
          bushItems.push({ x: node.x, y, z: node.z, rot: node.rot, sx: node.scale, sy: node.scale, sz: node.scale });
        }
      } else if (node.kind === 'fiber') {
        if (!depleted) {
          fiberItems.push({
            x: node.x,
            y,
            z: node.z,
            rot: node.rot,
            sx: node.scale * 1.1,
            sy: node.scale * 1.25,
            sz: node.scale * 1.1,
          });
        }
      }
    }

    const density = quality === 'low' ? 0.55 : quality === 'medium' ? 0.82 : 1;
    const tufts = decor.grass
      .filter((_, i) => i < decor.grass.length * density)
      .map<Xform>((d) => ({
        x: d.x,
        y: terrainHeight(d.x, d.z),
        z: d.z,
        rot: d.rot,
        sx: d.scale,
        sy: d.scale,
        sz: d.scale,
        tint: d.variant,
      }));
    const fernItems = decor.ferns
      .filter((_, i) => i < decor.ferns.length * density)
      .map<Xform>((d) => ({
        x: d.x,
        y: terrainHeight(d.x, d.z),
        z: d.z,
        rot: d.rot,
        sx: d.scale * 1.65,
        sy: d.scale * 1.9,
        sz: d.scale * 1.65,
      }));
    const pebbleItems = decor.pebbles.map<Xform>((d) => ({
      x: d.x,
      y: terrainHeight(d.x, d.z),
      z: d.z,
      rot: d.rot,
      sx: d.scale,
      sy: d.scale * 0.6,
      sz: d.scale,
    }));
    const flowerItems = decor.flowers.map<Xform>((d) => ({
      x: d.x,
      y: terrainHeight(d.x, d.z) + 0.14,
      z: d.z,
      rot: d.rot,
      sx: 1,
      sy: 0.8,
      sz: 1,
    }));
    const flowerTints = decor.flowers.map((d) =>
      ['#F0DFA6', '#E4C6D2', '#D9E0A8'][d.variant] ?? '#F0DFA6',
    );
    const logItems = decor.logs.map<Xform>((d) => ({
      x: d.x,
      y: terrainHeight(d.x, d.z) + 0.18,
      z: d.z,
      rot: d.rot,
      sx: d.scale,
      sy: d.scale,
      sz: d.scale,
    }));

    return {
      trees: treeItems,
      treeTints: treeColors,
      moss: mossItems,
      stumps: stumpItems,
      rocks: rockItems,
      rockStumps: rockStumpItems,
      bushes: bushItems,
      fibers: fiberItems,
      grassTufts: tufts,
      ferns: fernItems,
      pebbles: pebbleItems,
      logs: logItems,
      flowers: flowerItems,
      flowerTints,
      ao: aoItems,
    };
  }, [revision, decor, quality]);

  const bladeGeometry = useMemo(() => {
    // A single tuft of six tapered blades in one geometry: one instance draws a
    // convincing clump instead of a lone cone.
    const positions: number[] = [];
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * Math.PI * 2 + (i % 3) * 0.29;
      const height = 0.38 + (i % 4) * 0.12;
      const lean = 0.12 + (i % 5) * 0.04;
      const width = 0.032;
      const bx = Math.cos(a) * (0.05 + (i % 3) * 0.045);
      const bz = Math.sin(a) * (0.05 + (i % 3) * 0.045);
      const tx = bx + Math.cos(a) * lean;
      const tz = bz + Math.sin(a) * lean;
      const px = -Math.sin(a) * width;
      const pz = Math.cos(a) * width;
      positions.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, tx, height, tz);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  const bushGeometry = useMemo(() => new THREE.IcosahedronGeometry(0.62, 0), []);
  const berryGeometry = useMemo(() => new THREE.SphereGeometry(0.08, 5, 4), []);
  const grassMaterial = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#567A46', side: THREE.DoubleSide }),
    [],
  );
  const fernMaterial = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#3C5F38', side: THREE.DoubleSide }),
    [],
  );
  const fiberMaterial = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#A6AE67', side: THREE.DoubleSide }),
    [],
  );
  const stumpParts = useMemo<ModelPart[]>(
    () => [
      {
        geometry: new THREE.CylinderGeometry(0.34, 0.42, 0.42, 6),
        material: new THREE.MeshLambertMaterial({ color: '#5C4A33' }),
      },
    ],
    [],
  );
  const rockStumpParts = useMemo<ModelPart[]>(
    () => [
      {
        geometry: new THREE.DodecahedronGeometry(0.4, 0),
        material: new THREE.MeshLambertMaterial({ color: '#5A6059' }),
      },
    ],
    [],
  );
  const bushParts = useMemo<ModelPart[]>(
    () => [{ geometry: bushGeometry, material: new THREE.MeshLambertMaterial({ color: '#3E5D3F' }) }],
    [bushGeometry],
  );
  const berryParts = useMemo<ModelPart[]>(
    () => [
      {
        geometry: berryGeometry,
        material: new THREE.MeshLambertMaterial({ color: '#B8574A', emissive: '#3A0F0A' }),
      },
    ],
    [berryGeometry],
  );
  const fiberParts = useMemo<ModelPart[]>(
    () => [{ geometry: bladeGeometry, material: fiberMaterial }],
    [bladeGeometry, fiberMaterial],
  );
  const flowerParts = useMemo<ModelPart[]>(
    () => [
      {
        geometry: new THREE.SphereGeometry(0.055, 5, 4),
        material: new THREE.MeshBasicMaterial({ color: '#FFFFFF' }),
      },
    ],
    [],
  );
  const mossParts = useMemo<ModelPart[]>(
    () => [{ geometry: new THREE.IcosahedronGeometry(0.7, 0), material: new THREE.MeshLambertMaterial({ color: '#5D7C4B' }) }],
    [],
  );
  const pebbleParts = useMemo<ModelPart[]>(
    () => [
      {
        geometry: new THREE.DodecahedronGeometry(0.18, 0),
        material: new THREE.MeshLambertMaterial({ color: '#66695E' }),
      },
    ],
    [],
  );
  const logParts = useMemo<ModelPart[]>(
    () => [
      {
        geometry: new THREE.CylinderGeometry(0.32, 0.38, 2.4, 7),
        material: new THREE.MeshLambertMaterial({ color: '#4B3B2A' }),
      },
    ],
    [],
  );
  const rockTint = useMemo<[number, number, number]>(() => [0.62, 0.64, 0.6], []);


  // Gentle wind sway for grass and ferns.
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const fernRef = useRef<THREE.InstancedMesh>(null);
  const phase = useMemo(() => Math.random() * 10, []);
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.7 + phase;
    if (grassRef.current) {
      grassRef.current.rotation.z = Math.sin(t * 0.5) * 0.004;
      grassRef.current.rotation.x = Math.cos(t * 0.4) * 0.004;
    }
    if (fernRef.current) {
      fernRef.current.rotation.z = Math.sin(t * 0.42 + 1.3) * 0.006;
    }
  });

  return (
    <group>
      {trees.length > 0 && treeParts.length > 0 ? (
        <InstancedParts parts={treeParts} items={trees} castShadow={shadows} tints={treeTints} tintPart={1} />
      ) : (
        <FallbackTrees items={trees} />
      )}

      {rocks.length > 0 && rockParts.length > 0 ? (
        <InstancedParts parts={rockParts} items={rocks} castShadow={shadows} tint={rockTint} />
      ) : (
        <FallbackRocks items={rocks} />
      )}

      {stumps.length > 0 ? <InstancedParts parts={stumpParts} items={stumps} castShadow={false} /> : null}

      {moss.length > 0 ? <InstancedParts parts={mossParts} items={moss} castShadow={false} /> : null}

      <TreeDetails treeParts={treeParts} shadows={shadows} />

      {rockStumps.length > 0 ? (
        <InstancedParts parts={rockStumpParts} items={rockStumps} castShadow={false} />
      ) : null}

      {bushes.length > 0 ? (
        <InstancedParts
          parts={bushParts}
          items={bushes.map((b) => ({ ...b, sy: b.sy * 0.85 }))}
          castShadow={false}
        />
      ) : null}

      {bushes.length > 0 ? (
        <InstancedParts
          parts={berryParts}
          items={bushes.flatMap((b) =>
            [0, 1, 2, 3].map((i) => {
              const a = (i / 4) * Math.PI * 2 + b.rot;
              return {
                x: b.x + Math.cos(a) * 0.4 * b.sx,
                y: b.y + 0.45 + (i % 2) * 0.18,
                z: b.z + Math.sin(a) * 0.4 * b.sz,
                rot: 0,
                sx: 1,
                sy: 1,
                sz: 1,
              };
            }),
          )}
          castShadow={false}
        />
      ) : null}

      {fibers.length > 0 ? <InstancedParts parts={fiberParts} items={fibers} castShadow={false} /> : null}

      {grassTufts.length > 0 ? (
        <instancedMesh
          ref={grassRef}
          args={[bladeGeometry, grassMaterial, grassTufts.length]}
          count={grassTufts.length}
          frustumCulled={false}
        />
      ) : null}
      <GrassInstances items={grassTufts} refCallback={grassRef} />

      {ferns.length > 0 ? (
        <instancedMesh
          ref={fernRef}
          args={[bladeGeometry, fernMaterial, ferns.length]}
          count={ferns.length}
          frustumCulled={false}
        />
      ) : null}
      <GrassInstances items={ferns} refCallback={fernRef} />

      {pebbles.length > 0 ? <InstancedParts parts={pebbleParts} items={pebbles} castShadow={false} /> : null}

      {logs.length > 0 ? (
        <InstancedParts
          parts={logParts}
          items={logs.map((l) => ({ ...l, sx: l.sx, sy: 1, sz: l.sz }))}
          castShadow={shadows}
        />
      ) : null}

      {flowers.length > 0 ? (
        <InstancedParts
          parts={flowerParts}
          items={flowers}
          castShadow={false}
          tints={flowerTints}
          tintPart={0}
        />
      ) : null}

      <GroundShadows items={ao} />
    </group>
  );
}

/** Adds two extra canopy lobes and two branches to every living tree. */
function TreeDetails({ treeParts, shadows }: { treeParts: ModelPart[]; shadows: boolean }) {
  const engine = getEngine();
  const canopy = useMemo(
    () => treeParts.find((p) => /canopy/i.test(p.material.name ?? '')) ?? treeParts[1],
    [treeParts],
  );
  const bark = useMemo(
    () => treeParts.find((p) => /bark/i.test(p.material.name ?? '')) ?? treeParts[0],
    [treeParts],
  );

  const detail = useMemo(() => {
    if (!canopy || !engine) return null;
    const geo = canopy.geometry.clone();
    geo.computeBoundingBox();
    const center = geo.boundingBox?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3(0, 3, 0);
    geo.translate(-center.x, -center.y, -center.z);
    const lobes: Xform[] = [];
    const tints: string[] = [];
    const branches: { from: [number, number, number]; to: [number, number, number]; radius: number }[] = [];
    for (const node of engine.nodes) {
      if (node.kind !== 'tree') continue;
      const st = engine.state.nodes[node.id];
      if (st && st.charges <= 0) continue;
      const y = terrainHeight(node.x, node.z);
      const s = node.scale;
      const c = center.y;
      lobes.push({
        x: node.x + 0.62 * s,
        y: y + c * s + 0.12 * s,
        z: node.z + 0.28 * s,
        rot: node.rot + 0.6,
        sx: 0.6 * s,
        sy: 0.56 * s,
        sz: 0.6 * s,
      });
      tints.push('#A6D39A');
      lobes.push({
        x: node.x - 0.55 * s,
        y: y + c * s - 0.06 * s,
        z: node.z - 0.38 * s,
        rot: node.rot + 1.9,
        sx: 0.55 * s,
        sy: 0.5 * s,
        sz: 0.55 * s,
      });
      tints.push('#7FB47A');
      branches.push({
        from: [node.x, y + 1.75 * s, node.z],
        to: [node.x + 0.7 * s, y + (c - 0.2) * s, node.z + 0.3 * s],
        radius: 0.05 * s,
      });
      branches.push({
        from: [node.x, y + 1.95 * s, node.z],
        to: [node.x - 0.6 * s, y + (c - 0.3) * s, node.z - 0.4 * s],
        radius: 0.045 * s,
      });
    }
    return { geo, lobes, tints, branches };
  }, [canopy, engine]);

  if (!detail || detail.lobes.length === 0) return null;
  return (
    <group>
      <InstancedParts
        parts={[{ geometry: detail.geo, material: canopy!.material }]}
        items={detail.lobes}
        tints={detail.tints}
        tintPart={0}
        castShadow={shadows}
      />
      {bark ? <BranchInstances data={detail.branches} material={bark.material} /> : null}
    </group>
  );
}

function BranchInstances({
  data,
  material,
}: {
  data: { from: [number, number, number]; to: [number, number, number]; radius: number }[];
  material: THREE.Material;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 5), []);
  const materialRef = useMemo(() => material.clone(), [material]);
  useLayoutEffect(() => {
    if (!mesh.current || data.length === 0) return;
    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();
    const dir = new THREE.Vector3();
    data.forEach((branch, i) => {
      from.set(...branch.from);
      to.set(...branch.to);
      dir.copy(to).sub(from);
      const length = dir.length();
      dummy.position.copy(from).add(dir.clone().multiplyScalar(0.5));
      dummy.quaternion.setFromUnitVectors(up, dir.normalize());
      dummy.scale.set(branch.radius, length, branch.radius);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [data]);
  if (data.length === 0) return null;
  return <instancedMesh ref={mesh} args={[geometry, materialRef, data.length]} count={data.length} castShadow={false} frustumCulled={false} />;
}

function makeShadowTexture(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const d = Math.min(1, Math.hypot(dx, dy) * 2);
      const alpha = Math.pow(1 - d, 2.4);
      const i = (x + y * size) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/** Cheap baked contact shadows: one instanced draw call grounds the forest. */
function GroundShadows({ items }: { items: { x: number; z: number; y: number; r: number }[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: makeShadowTexture(),
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        color: '#06100C',
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [],
  );
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D();
    items.forEach((item, i) => {
      dummy.position.set(item.x, item.y + 0.04, item.z);
      dummy.scale.set(item.r * 2, 1, item.r * 2);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [items]);
  if (items.length === 0) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, items.length]}
      count={items.length}
      frustumCulled={false}
      renderOrder={0}
    />
  );
}

/** Writes matrices for a plain instanced mesh (grass/ferns). */
function GrassInstances({
  items,
  refCallback,
}: {
  items: Xform[];
  refCallback: React.RefObject<THREE.InstancedMesh | null>;
}) {
  useLayoutEffect(() => {
    const mesh = refCallback.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    items.forEach((item, i) => {
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(0, item.rot, 0);
      dummy.scale.set(item.sx, item.sy, item.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (item.tint !== undefined) {
        color.setHSL(0.26 + item.tint * 0.02, 0.24 + item.tint * 0.05, 0.32 + item.tint * 0.05);
        mesh.setColorAt(i, color);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, refCallback]);
  return null;
}

/** Procedural fallbacks keep the world readable if a GLB fails to parse. */
function FallbackTrees({ items }: { items: Xform[] }) {
  const trunk = useMemo(() => new THREE.CylinderGeometry(0.22, 0.34, 3.2, 6), []);
  const crown = useMemo(() => new THREE.ConeGeometry(1.5, 2.6, 7), []);
  const trunkMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: '#5A4430' }), []);
  const crownMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: '#39593B' }), []);
  return (
    <group>
      {items.map((t) => (
        <group key={`${t.x}-${t.z}`} position={[t.x, t.y, t.z]} rotation={[0, t.rot, 0]} scale={t.sx}>
          <mesh geometry={trunk} material={trunkMaterial} position={[0, 1.6, 0]} />
          <mesh geometry={crown} material={crownMaterial} position={[0, 3.4, 0]} />
        </group>
      ))}
    </group>
  );
}

function FallbackRocks({ items }: { items: Xform[] }) {
  const geo = useMemo(() => new THREE.DodecahedronGeometry(0.7, 0), []);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#777C70' }), []);
  return (
    <group>
      {items.map((r) => (
        <mesh key={`${r.x}-${r.z}`} geometry={geo} material={mat} position={[r.x, r.y + 0.3, r.z]} scale={r.sx} rotation={[0, r.rot, 0]} />
      ))}
    </group>
  );
}
