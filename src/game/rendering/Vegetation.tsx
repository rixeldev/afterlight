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
}: {
  parts: ModelPart[];
  items: Xform[];
  castShadow: boolean;
  tint?: [number, number, number];
}) {
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const color = tint ? new THREE.Color(...tint) : null;
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
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (color && mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
        (mesh.material as THREE.Material).needsUpdate = true;
      }
      mesh.computeBoundingSphere();
    });
  }, [parts, items, tint]);

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

  const { trees, stumps, rocks, rockStumps, bushes, fibers, grassTufts, ferns, pebbles, logs, ao } = useMemo(() => {
    void revision;
    const engine = getEngine();
    const nodes = engine?.nodes ?? [];
    const treeItems: Xform[] = [];
    const stumpItems: Xform[] = [];
    const rockItems: Xform[] = [];
    const rockStumpItems: Xform[] = [];
    const bushItems: Xform[] = [];
    const fiberItems: Xform[] = [];
    const aoItems: { x: number; z: number; y: number; r: number }[] = [];

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
        }
      } else if (node.kind === 'bush') {
        if (!depleted) {
          aoItems.push({ x: node.x, z: node.z, y, r: 0.9 * node.scale });
          bushItems.push({ x: node.x, y, z: node.z, rot: node.rot, sx: node.scale, sy: node.scale, sz: node.scale });
        }
      } else if (node.kind === 'fiber') {
        if (!depleted) {
          for (let i = 0; i < 5; i += 1) {
            const a = node.rot + (i / 5) * Math.PI * 2;
            fiberItems.push({
              x: node.x + Math.cos(a) * 0.22,
              y,
              z: node.z + Math.sin(a) * 0.22,
              rot: a,
              sx: node.scale,
              sy: node.scale * (0.85 + (i % 3) * 0.12),
              sz: node.scale,
            });
          }
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
        sx: d.scale * 1.35,
        sy: d.scale * 1.55,
        sz: d.scale * 1.35,
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
      stumps: stumpItems,
      rocks: rockItems,
      rockStumps: rockStumpItems,
      bushes: bushItems,
      fibers: fiberItems,
      grassTufts: tufts,
      ferns: fernItems,
      pebbles: pebbleItems,
      logs: logItems,
      ao: aoItems,
    };
  }, [revision, decor, quality]);

  const bladeGeometry = useMemo(() => {
    const geo = new THREE.ConeGeometry(0.05, 0.62, 3, 1, true);
    geo.translate(0, 0.5, 0);
    geo.rotateX(0.12);
    return geo;
  }, []);

  const bushGeometry = useMemo(() => new THREE.IcosahedronGeometry(0.62, 0), []);
  const berryGeometry = useMemo(() => new THREE.SphereGeometry(0.08, 5, 4), []);
  const grassMaterial = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#5C7C49', side: THREE.DoubleSide }),
    [],
  );
  const fernMaterial = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#41633B', side: THREE.DoubleSide }),
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
    () => [{ geometry: bladeGeometry, material: new THREE.MeshLambertMaterial({ color: '#94A868', side: THREE.DoubleSide }) }],
    [bladeGeometry],
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
        <InstancedParts parts={treeParts} items={trees} castShadow={shadows} />
      ) : (
        <FallbackTrees items={trees} />
      )}

      {rocks.length > 0 && rockParts.length > 0 ? (
        <InstancedParts parts={rockParts} items={rocks} castShadow={shadows} tint={rockTint} />
      ) : (
        <FallbackRocks items={rocks} />
      )}

      {stumps.length > 0 ? <InstancedParts parts={stumpParts} items={stumps} castShadow={false} /> : null}

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

      <GroundShadows items={ao} />
    </group>
  );
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
