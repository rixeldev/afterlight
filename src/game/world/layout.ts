import type { HarvestNode } from '../types';
import { poiDef, POIS, REGION } from '../../data/world';
import { isUnderwater, lakeFactor, terrainHeight, WATER_LEVEL } from './terrain';

/** Small deterministic PRNG (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Candidate {
  x: number;
  z: number;
}

function nearPoi(x: number, z: number, padding: number): boolean {
  return POIS.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + padding);
}

function tooClose(nodes: Candidate[], x: number, z: number, spacing: number): boolean {
  return nodes.some((n) => (n.x - x) ** 2 + (n.z - z) ** 2 < spacing * spacing);
}

function sampleAround(
  rng: () => number,
  cx: number,
  cz: number,
  radius: number,
): Candidate {
  const angle = rng() * Math.PI * 2;
  const dist = Math.sqrt(rng()) * radius;
  return { x: cx + Math.cos(angle) * dist, z: cz + Math.sin(angle) * dist };
}

function validTreeSpot(x: number, z: number): boolean {
  if (Math.hypot(x, z) > REGION.playRadius) return false;
  if (Math.hypot(x - REGION.camp.x, z - REGION.camp.z) < 15) return false;
  if (lakeFactor(x, z) < 1.22) return false;
  if (terrainHeight(x, z) < WATER_LEVEL + 0.35) return false;
  if (nearPoi(x, z, 1.5)) return false;
  return true;
}

/**
 * Hand-authored Greenhaven resource layout.
 * Volumes: ~120 trees, ~30 rocks, ~26 bushes, ~40 fibre, 3 springs, story caches.
 */
export function generateHarvestNodes(): HarvestNode[] {
  const rng = makeRng(0xa57e_11fe);
  const nodes: HarvestNode[] = [];
  const treeSpots: Candidate[] = [];
  let id = 0;
  const nextId = (prefix: string) => `${prefix}_${String((id += 1)).padStart(3, '0')}`;

  // ── Trees: dense at the treeline, sparse in the clearing ────────────────
  const treeTarget = 118;
  for (let attempt = 0; attempt < 4200 && treeSpots.length < treeTarget; attempt += 1) {
    const dist = 18 + Math.sqrt(rng()) * 58;
    const angle = rng() * Math.PI * 2;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (!validTreeSpot(x, z)) continue;
    const edgeBias = Math.min(1, Math.max(0.18, (dist - 16) / 34));
    if (rng() > edgeBias) continue;
    if (tooClose(treeSpots, x, z, 2.9)) continue;
    treeSpots.push({ x, z });
    nodes.push({
      id: nextId('tree'),
      kind: 'tree',
      x,
      z,
      scale: 0.85 + rng() * 0.55,
      rot: rng() * Math.PI * 2,
      charges: 3,
      yields: [{ id: 'wood_log', qty: 2 }],
      toolKind: 'axe',
      respawnMinutes: 26,
    });
  }

  // A few landmark trees framing the homestead.
  const landmarks: Candidate[] = [
    { x: -11.5, z: -9.5 },
    { x: 12.5, z: -6.5 },
    { x: -8, z: 13.5 },
    { x: 10.5, z: 13 },
  ];
  for (const spot of landmarks) {
    nodes.push({
      id: nextId('tree'),
      kind: 'tree',
      x: spot.x,
      z: spot.z,
      scale: 1.25,
      rot: rng() * Math.PI * 2,
      charges: 3,
      yields: [{ id: 'wood_log', qty: 2 }],
      toolKind: 'axe',
      respawnMinutes: 26,
    });
  }

  // ── Rocks: quarry clusters ──────────────────────────────────────────────
  const rockClusters = [
    { x: -26, z: 6, r: 12, n: 11 },
    { x: -14, z: -30, r: 11, n: 9 },
    { x: 22, z: 30, r: 10, n: 8 },
  ];
  const rockSpots: Candidate[] = [];
  for (const cluster of rockClusters) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const spot = sampleAround(rng, cluster.x, cluster.z, cluster.r);
      if (lakeFactor(spot.x, spot.z) < 1.2) continue;
      if (isUnderwater(spot.x, spot.z) || terrainHeight(spot.x, spot.z) < WATER_LEVEL + 0.3) continue;
      if (Math.hypot(spot.x, spot.z) < 16) continue;
      if (nearPoi(spot.x, spot.z, 2)) continue;
      if (tooClose(rockSpots, spot.x, spot.z, 2.4)) continue;
      rockSpots.push(spot);
      const rich = rockSpots.length % 3 === 0;
      nodes.push({
        id: nextId('rock'),
        kind: 'rock',
        x: spot.x,
        z: spot.z,
        scale: 0.8 + rng() * 0.8,
        rot: rng() * Math.PI * 2,
        charges: 3,
        yields: rich
          ? [{ id: 'stone_chunk', qty: 2 }, { id: 'scrap_metal', qty: 1 }]
          : [{ id: 'stone_chunk', qty: 2 }],
        toolKind: 'pickaxe',
        respawnMinutes: 34,
      });
    }
  }

  // ── Berry bushes near the forest edge ───────────────────────────────────
  const bushSpots: Candidate[] = [];
  for (let attempt = 0; attempt < 900 && bushSpots.length < 24; attempt += 1) {
    const dist = 15 + rng() * 34;
    const angle = rng() * Math.PI * 2;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (lakeFactor(x, z) < 1.2 || isUnderwater(x, z) || terrainHeight(x, z) < WATER_LEVEL + 0.3) continue;
    if (nearPoi(x, z, 1) || tooClose(bushSpots, x, z, 4.4)) continue;
    bushSpots.push({ x, z });
    nodes.push({
      id: nextId('bush'),
      kind: 'bush',
      x,
      z,
      scale: 0.8 + rng() * 0.45,
      rot: rng() * Math.PI * 2,
      charges: 1,
      yields: [{ id: 'wild_berries', qty: 3 }, { id: 'plant_fiber', qty: 1 }],
      respawnMinutes: 15,
    });
  }

  // ── Fibre grass in the meadows ──────────────────────────────────────────
  const fiberSpots: Candidate[] = [];
  for (let attempt = 0; attempt < 900 && fiberSpots.length < 34; attempt += 1) {
    const dist = 12 + rng() * 45;
    const angle = rng() * Math.PI * 2;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (lakeFactor(x, z) < 1.14 || isUnderwater(x, z) || terrainHeight(x, z) < WATER_LEVEL + 0.2) continue;
    if (nearPoi(x, z, 0.5) || tooClose(fiberSpots, x, z, 3.4)) continue;
    fiberSpots.push({ x, z });
    nodes.push({
      id: nextId('fiber'),
      kind: 'fiber',
      x,
      z,
      scale: 0.9 + rng() * 0.3,
      rot: rng() * Math.PI * 2,
      charges: 1,
      yields: [{ id: 'plant_fiber', qty: 2 }],
      respawnMinutes: 11,
    });
  }

  // ── Springs along the lake shore ────────────────────────────────────────
  const springs: Candidate[] = [
    { x: 20.5, z: 2 },
    { x: 23, z: 22.5 },
    { x: 41, z: 33 },
  ];
  for (const spot of springs) {
    nodes.push({
      id: nextId('water'),
      kind: 'water',
      x: spot.x,
      z: spot.z,
      scale: 1,
      rot: 0,
      charges: 9999,
      yields: [{ id: 'dirty_water', qty: 1 }],
      respawnMinutes: 0,
    });
  }

  // ── Story props at the ranger camp ──────────────────────────────────────
  nodes.push({
    id: nextId('cache'),
    kind: 'cache',
    x: 34.5,
    z: -33.5,
    scale: 1,
    rot: 0.4,
    charges: 1,
    yields: [{ id: 'damaged_recorder', qty: 1 }],
    respawnMinutes: 0,
  });
  nodes.push({
    id: nextId('crate'),
    kind: 'crate',
    x: 29.5,
    z: -33,
    scale: 1,
    rot: -0.3,
    charges: 2,
    yields: [{ id: 'scrap_metal', qty: 2 }, { id: 'plant_fiber', qty: 2 }],
    respawnMinutes: 180,
  });
  nodes.push({
    id: nextId('crate'),
    kind: 'crate',
    x: -37,
    z: 23,
    scale: 1,
    rot: 0.9,
    charges: 2,
    yields: [{ id: 'scrap_metal', qty: 1 }, { id: 'wood_log', qty: 3 }],
    respawnMinutes: 180,
  });

  return nodes;
}

export interface DecorItem {
  x: number;
  z: number;
  scale: number;
  rot: number;
  variant: number;
}

export interface WorldDecor {
  grass: DecorItem[];
  ferns: DecorItem[];
  pebbles: DecorItem[];
  logs: DecorItem[];
  flowers: DecorItem[];
}

/** Purely visual scatter (never saved, never harvested). */
export function generateDecor(): WorldDecor {
  const rng = makeRng(0x51de_c0de);
  const grass: DecorItem[] = [];
  const ferns: DecorItem[] = [];
  const pebbles: DecorItem[] = [];
  const logs: DecorItem[] = [];
  const flowers: DecorItem[] = [];

  for (let i = 0; i < 520; i += 1) {
    const x = (rng() * 2 - 1) * 66;
    const z = (rng() * 2 - 1) * 66;
    if (lakeFactor(x, z) < 1.16) continue;
    if (terrainHeight(x, z) < WATER_LEVEL + 0.2) continue;
    grass.push({ x, z, scale: 0.3 + rng() * 0.42, rot: rng() * Math.PI, variant: i % 3 });
  }
  for (let i = 0; i < 90; i += 1) {
    const x = (rng() * 2 - 1) * 60;
    const z = (rng() * 2 - 1) * 60;
    if (lakeFactor(x, z) < 1.22 || Math.hypot(x, z) < 14) continue;
    ferns.push({ x, z, scale: 0.55 + rng() * 0.45, rot: rng() * Math.PI * 2, variant: i % 2 });
  }
  for (let i = 0; i < 70; i += 1) {
    const x = (rng() * 2 - 1) * 68;
    const z = (rng() * 2 - 1) * 68;
    if (lakeFactor(x, z) < 1.1) continue;
    pebbles.push({ x, z, scale: 0.3 + rng() * 0.5, rot: rng() * Math.PI * 2, variant: i % 2 });
  }
  for (let i = 0; i < 12; i += 1) {
    const angle = rng() * Math.PI * 2;
    const dist = 18 + rng() * 36;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (lakeFactor(x, z) < 1.25) continue;
    logs.push({ x, z, scale: 0.9 + rng() * 0.6, rot: rng() * Math.PI * 2, variant: i % 2 });
  }
  for (let i = 0; i < 64; i += 1) {
    const angle = rng() * Math.PI * 2;
    const dist = 10 + rng() * 32;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (lakeFactor(x, z) < 1.2 || isUnderwater(x, z)) continue;
    flowers.push({ x, z, scale: 0.6 + rng() * 0.7, rot: rng() * Math.PI * 2, variant: i % 3 });
  }
  return { grass, ferns, pebbles, logs, flowers };
}

/** Points of interest geometry helpers used by the ranger-camp renderer. */
export const RANGER_CABIN = { x: 34, z: -38, rot: -0.35, scale: 0.55 };
export const FOOTBRIDGE = { x: -34, z: 26, rot: 0.5 };
export const LOOKOUT = { x: 14, z: 46 };
export const SILENT_GATE = { x: -46, z: -44, rot: 0.9 };

export function rangerCampPoi() {
  return poiDef('ranger_camp');
}

export { POIS };
