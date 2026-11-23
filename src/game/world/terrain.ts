/** Deterministic terrain shared by the renderer, physics and minimap. */

export const WATER_LEVEL = -0.8;
export const WORLD_SEED = 20260921;

function hash2(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}

function fbm(x: number, z: number, seed: number, octaves = 3): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i += 1) {
    value += valueNoise(x * freq, z * freq, seed + i * 31) * amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return value;
}

const CAMP = { x: 0, z: 0 };
const CAMP_FLAT_RADIUS = 17;
const CAMP_BLEND_RADIUS = 30;
const LAKE = { x: 44, z: 8, rx: 26, rz: 20 };
const LOOKOUT = { x: 14, z: 46, r: 16, height: 7.5 };

function gaussian(x: number, z: number, cx: number, cz: number, spread: number): number {
  const dx = x - cx;
  const dz = z - cz;
  return Math.exp(-(dx * dx + dz * dz) / (2 * spread * spread));
}

/** Raw noise-based elevation before water/flattening passes. */
function baseHeight(x: number, z: number): number {
  const rolling = (fbm(x * 0.028, z * 0.028, WORLD_SEED, 3) - 0.5) * 8.5;
  const detail = (fbm(x * 0.11, z * 0.11, WORLD_SEED + 7, 2) - 0.5) * 1.4;
  const ridge = gaussian(x, z, -26, -46, 30) * 5.2;
  const hill = gaussian(x, z, LOOKOUT.x, LOOKOUT.z, LOOKOUT.r) * LOOKOUT.height;
  return rolling + detail + ridge + hill;
}

/** Elliptical distance normalised to 1 at the shoreline. */
export function lakeFactor(x: number, z: number): number {
  const dx = (x - LAKE.x) / LAKE.rx;
  const dz = (z - LAKE.z) / LAKE.rz;
  const warp = (fbm(x * 0.06, z * 0.06, WORLD_SEED + 91, 2) - 0.5) * 0.24;
  return Math.sqrt(dx * dx + dz * dz) + warp;
}

/**
 * Smooth value noise in 0..1 for surface colouring. Sine-based mottling
 * produced visible diagonal bands across the meadow; this does not.
 */
export function terrainTone(x: number, z: number, seed = WORLD_SEED): number {
  return Math.min(1, fbm(x, z, seed, 2) / 0.75);
}

export function terrainHeight(x: number, z: number): number {
  let h = baseHeight(x, z);

  // Lake basin.
  const lf = lakeFactor(x, z);
  if (lf < 1.18) {
    const basin = 1 - smooth(Math.min(1, Math.max(0, lf / 1.18)));
    h = h * (1 - basin) + (WATER_LEVEL - 2.2) * basin;
  }

  // Flatten the homestead so placed structures sit cleanly.
  const campDist = Math.hypot(x - CAMP.x, z - CAMP.z);
  if (campDist < CAMP_BLEND_RADIUS) {
    const t = 1 - smooth(Math.min(1, Math.max(0, (campDist - CAMP_FLAT_RADIUS) / (CAMP_BLEND_RADIUS - CAMP_FLAT_RADIUS))));
    h = h * (1 - t) + 0 * t;
  }

  // Ranger camp clearing.
  const ranger = gaussian(x, z, 32, -36, 11);
  if (ranger > 0.02) h = h * (1 - ranger * 0.85) + 1.1 * (ranger * 0.85);

  // Footbridge approach stays walkable.
  const bridge = gaussian(x, z, -34, 26, 9);
  if (bridge > 0.02) h = h * (1 - bridge * 0.5) + 0.4 * (bridge * 0.5);

  return h;
}

export function isUnderwater(x: number, z: number): boolean {
  return terrainHeight(x, z) < WATER_LEVEL - 0.15;
}

/** Slope magnitude used to block building and steep walk penalties. */
export function terrainSlope(x: number, z: number, step = 0.7): number {
  const hx = terrainHeight(x + step, z) - terrainHeight(x - step, z);
  const hz = terrainHeight(x, z + step) - terrainHeight(x, z - step);
  return Math.hypot(hx, hz) / (step * 2);
}

export function distanceToWater(x: number, z: number): number {
  // Approximate: sample radially until dry, max 30 units.
  for (let r = 0; r <= 30; r += 1.5) {
    if (!isUnderwater(x + r, z) && !isUnderwater(x, z + r)) return r;
  }
  return 30;
}
