import { validatePlacement, snapToGrid, refundFor, normalizeRotation } from '../game/building/building';
import { terrainSlope, terrainHeight } from '../game/world/terrain';

const ctx = { structures: [], obstacles: [] };

describe('building placement', () => {
  it('snaps to the structure grid', () => {
    expect(snapToGrid(1.2, -3.1)).toEqual({ x: 1.5, z: -3 });
  });

  it('accepts a campfire on flat ground inside the homestead', () => {
    const result = validatePlacement('campfire', 3, 2, 0, ctx);
    expect(result.valid).toBe(true);
    expect(result.reason).toBe('ok');
    expect(result.y).toBeCloseTo(terrainHeight(result.x, result.z), 5);
  });

  it('rejects placements outside the build plot', () => {
    const result = validatePlacement('campfire', 40, 0, 0, ctx);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('outside_plot');
  });

  it('rejects overlapping structures', () => {
    const result = validatePlacement('campfire', 3, 2, 0, {
      structures: [{ id: 's_1', defId: 'workbench', x: 3, z: 2, rot: 0, builtAt: 0 }],
      obstacles: [],
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('overlap');
  });

  it('rejects a blocked spot under a tree', () => {
    const result = validatePlacement('campfire', 3, 2, 0, {
      structures: [],
      obstacles: [{ x: 3, z: 2, radius: 0.6 }],
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('obstructed');
  });

  it('rejects a second unique structure', () => {
    const result = validatePlacement('campfire', -3, 2, 0, {
      structures: [{ id: 's_1', defId: 'campfire', x: 4, z: 4, rot: 0, builtAt: 0 }],
      obstacles: [],
    });
    expect(result.reason).toBe('unique');
  });

  it('refunds half of the cost, never zero', () => {
    const refund = refundFor('campfire');
    expect(refund.wood_log).toBe(2);
    expect(refund.stone_chunk).toBe(3);
  });

  it('normalises rotation into quarter turns', () => {
    expect(normalizeRotation(5)).toBe(1);
    expect(normalizeRotation(-1)).toBe(3);
  });

  it('flattens the homestead so it can host buildings', () => {
    expect(Math.abs(terrainHeight(0, 0))).toBeLessThan(0.01);
    expect(terrainSlope(0, 0)).toBeLessThan(0.2);
  });
});
