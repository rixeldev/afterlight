import {
  addItem,
  countItem,
  createInventory,
  craftableCount,
  consumeItems,
  removeItem,
  resizeInventory,
  sortInventory,
} from '../game/inventory/inventory';

describe('inventory', () => {
  it('creates the requested number of empty slots', () => {
    const inv = createInventory(4);
    expect(inv.size).toBe(4);
    expect(inv.slots).toHaveLength(4);
    expect(inv.slots.every((s) => s === null)).toBe(true);
  });

  it('sorts by category while keeping every stack and the slot count', () => {
    let inv = createInventory(6);
    inv = addItem(inv, 'wood_log', 5).inventory;
    inv = addItem(inv, 'wild_berries', 3).inventory;
    inv = addItem(inv, 'stone_axe', 1).inventory;
    inv = addItem(inv, 'stone_chunk', 4).inventory;
    inv = addItem(inv, 'clean_water', 2).inventory;
    const sorted = sortInventory(inv);
    expect(sorted.size).toBe(6);
    expect(sorted.slots).toHaveLength(6);
    expect(sorted.slots.map((s) => (s ? s.id : null))).toEqual([
      'stone_axe',
      'stone_chunk',
      'wood_log',
      'wild_berries',
      'clean_water',
      null,
    ]);
    expect(countItem(sorted, 'wood_log')).toBe(5);
    expect(countItem(sorted, 'wild_berries')).toBe(3);
  });

  it('stacks up to the item limit and spills into a new slot', () => {
    let inv = createInventory(3);
    const first = addItem(inv, 'wood_log', 120);
    inv = first.inventory;
    expect(first.added).toBe(120);
    expect(first.overflow).toBe(false);
    expect(inv.slots[0]).toEqual({ id: 'wood_log', qty: 99 });
    expect(inv.slots[1]).toEqual({ id: 'wood_log', qty: 21 });
    expect(countItem(inv, 'wood_log')).toBe(120);
  });

  it('reports overflow instead of silently losing items', () => {
    const inv = createInventory(1);
    const result = addItem(inv, 'stone_chunk', 150);
    expect(result.added).toBe(99);
    expect(result.overflow).toBe(true);
    expect(countItem(result.inventory, 'stone_chunk')).toBe(99);
  });

  it('removes from the last matching stack first', () => {
    let inv = createInventory(3);
    inv = addItem(inv, 'wood_log', 110).inventory;
    const removed = removeItem(inv, 'wood_log', 15);
    expect(removed.removed).toBe(15);
    expect(countItem(removed.inventory, 'wood_log')).toBe(95);
  });

  it('validates and consumes a cost atomically', () => {
    let inv = createInventory(4);
    inv = addItem(inv, 'wood_log', 5).inventory;
    inv = addItem(inv, 'stone_chunk', 2).inventory;
    expect(consumeItems(inv, { wood_log: 6, stone_chunk: 2 })).toBeNull();
    const next = consumeItems(inv, { wood_log: 3, stone_chunk: 2 });
    expect(next).not.toBeNull();
    expect(countItem(next!, 'wood_log')).toBe(2);
    expect(countItem(next!, 'stone_chunk')).toBe(0);
  });

  it('counts how many batches fit', () => {
    let inv = createInventory(6);
    inv = addItem(inv, 'wood_log', 7).inventory;
    inv = addItem(inv, 'stone_chunk', 5).inventory;
    expect(craftableCount(inv, { wood_log: 3, stone_chunk: 2 })).toBe(2);
  });

  it('resizes up, preserving items and padding with empties', () => {
    let inv = createInventory(2);
    inv = addItem(inv, 'plant_fiber', 4).inventory;
    const bigger = resizeInventory(inv, 5);
    expect(bigger.size).toBe(5);
    expect(bigger.slots).toHaveLength(5);
    expect(bigger.slots[0]).toEqual({ id: 'plant_fiber', qty: 4 });
    expect(bigger.slots[4]).toBeNull();
  });

  it('never mutates the input inventory', () => {
    const inv = createInventory(2);
    const result = addItem(inv, 'wild_berries', 3);
    expect(inv.slots[0]).toBeNull();
    expect(result.inventory.slots[0]).toEqual({ id: 'wild_berries', qty: 3 });
  });
});
