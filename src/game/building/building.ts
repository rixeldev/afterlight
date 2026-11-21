import type { StructureDef, StructureInstance } from '../types';
import { STRUCTURES } from '../../data/recipes';
import { REGION } from '../../data/world';
import { isUnderwater, terrainHeight, terrainSlope, WATER_LEVEL } from '../world/terrain';

export const BUILD_CELL = 1.5;

export type PlacementReason =
  | 'ok'
  | 'outside_plot'
  | 'water'
  | 'slope'
  | 'overlap'
  | 'obstructed'
  | 'unique'
  | 'unknown';

export interface PlacementResult {
  valid: boolean;
  reason: PlacementReason;
  x: number;
  z: number;
  y: number;
}

export interface StaticObstacle {
  x: number;
  z: number;
  radius: number;
}

export function snapToGrid(x: number, z: number, cell = BUILD_CELL): { x: number; z: number } {
  return {
    x: Math.round(x / cell) * cell,
    z: Math.round(z / cell) * cell,
  };
}

export function normalizeRotation(rot: number): number {
  return ((rot % 4) + 4) % 4;
}

export function structureDef(defId: string): StructureDef | undefined {
  return STRUCTURES[defId];
}

export interface PlacementContext {
  structures: StructureInstance[];
  obstacles: StaticObstacle[];
  buildRadius?: number;
}

/** Validates a grid-snapped, rotated placement. Never mutates. */
export function validatePlacement(
  defId: string,
  rawX: number,
  rawZ: number,
  rot: number,
  ctx: PlacementContext,
): PlacementResult {
  const def = STRUCTURES[defId];
  if (!def) return { valid: false, reason: 'unknown', x: rawX, z: rawZ, y: 0 };
  const cell = def.radius > 2 ? BUILD_CELL * 2 : BUILD_CELL;
  const snapped = snapToGrid(rawX, rawZ, cell);
  const y = terrainHeight(snapped.x, snapped.z);
  const buildRadius = ctx.buildRadius ?? REGION.buildRadius;

  const base = { x: snapped.x, z: snapped.z, y };
  const fail = (reason: PlacementReason): PlacementResult => ({ valid: false, reason, ...base });

  if (Math.hypot(snapped.x - REGION.camp.x, snapped.z - REGION.camp.z) > buildRadius) return fail('outside_plot');
  if (isUnderwater(snapped.x, snapped.z) || y < WATER_LEVEL + 0.35) return fail('water');
  if (terrainSlope(snapped.x, snapped.z) > 1.05) return fail('slope');

  if (def.unique && ctx.structures.some((s) => s.defId === defId)) return fail('unique');

  for (const s of ctx.structures) {
    const other = STRUCTURES[s.defId];
    if (!other) continue;
    const minDist = (def.radius + other.radius) * 0.72;
    if (Math.hypot(snapped.x - s.x, snapped.z - s.z) < minDist) return fail('overlap');
  }
  for (const o of ctx.obstacles) {
    if (Math.hypot(snapped.x - o.x, snapped.z - o.z) < def.radius * 0.72 + o.radius) return fail('obstructed');
  }

  // Rotation is a quarter turn; it only matters for visual orientation today, but
  // validating it here keeps the contract stable for future rotated footprints.
  normalizeRotation(rot);
  return { valid: true, reason: 'ok', ...base };
}

/** Refund rule: half the build cost, rounded down but never zero. */
export function refundFor(defId: string): Record<string, number> {
  const def = STRUCTURES[defId];
  if (!def) return {};
  const refund: Record<string, number> = {};
  for (const [id, qty] of Object.entries(def.cost)) {
    refund[id] = Math.max(1, Math.floor(qty * 0.5));
  }
  return refund;
}

/** Structures that provide a crafting station double as interaction targets. */
export function stationStructures(structures: StructureInstance[]): StructureInstance[] {
  return structures.filter((s) => {
    const def = STRUCTURES[s.defId];
    return Boolean(def?.station);
  });
}
