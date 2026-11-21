import { generateHarvestNodes, generateDecor } from '../game/world/layout';
import { terrainHeight, terrainSlope, isUnderwater, WATER_LEVEL } from '../game/world/terrain';
import { REGION } from '../data/world';

describe('world generation', () => {
  const nodes = generateHarvestNodes();

  it('is deterministic', () => {
    const again = generateHarvestNodes();
    expect(again.map((n) => n.id)).toEqual(nodes.map((n) => n.id));
    expect(again[10]?.x).toBeCloseTo(nodes[10]?.x ?? 0, 6);
  });

  it('generates every resource type the slice needs', () => {
    const kinds = new Set(nodes.map((n) => n.kind));
    for (const kind of ['tree', 'rock', 'bush', 'fiber', 'water']) {
      expect(kinds.has(kind as never)).toBe(true);
    }
    expect(nodes.some((n) => n.yields.some((y) => y.id === 'damaged_recorder'))).toBe(true);
    expect(nodes.length).toBeGreaterThan(120);
  });

  it('keeps the homestead clearing free of obstacles', () => {
    const inCamp = nodes.filter((n) => Math.hypot(n.x, n.z) < 13);
    expect(inCamp).toHaveLength(0);
  });

  it('never places gatherables under water', () => {
    const wet = nodes.filter((n) => isUnderwater(n.x, n.z));
    expect(wet).toMatchInlineSnapshot(`[]`);
  });

  it('keeps the playable area inside the region boundary', () => {
    for (const node of nodes) {
      expect(Math.hypot(node.x, node.z)).toBeLessThanOrEqual(REGION.playRadius);
    }
  });

  it('has stable, unique ids', () => {
    const ids = nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('builds decorative scatter only on land', () => {
    const decor = generateDecor();
    expect(decor.grass.length).toBeGreaterThan(200);
    for (const tuft of decor.grass.slice(0, 100)) {
      expect(isUnderwater(tuft.x, tuft.z)).toBe(false);
    }
  });

  it('flattens the camp and forms a lake below water level', () => {
    expect(Math.abs(terrainHeight(0, 0))).toBeLessThan(0.01);
    expect(terrainSlope(0, 0)).toBeLessThan(0.2);
    expect(terrainHeight(REGION.lake.x, REGION.lake.z)).toBeLessThan(WATER_LEVEL);
    expect(isUnderwater(REGION.lake.x, REGION.lake.z)).toBe(true);
  });

  it('keeps the lookout hill above the valley floor', () => {
    expect(terrainHeight(14, 46)).toBeGreaterThan(terrainHeight(0, 10));
  });
});
