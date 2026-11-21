import type { ItemDef } from '../game/types';

/**
 * Item catalogue. IDs are stable save identifiers — never renumber or rename.
 * Display names live in the i18n dictionaries under `item.<id>.name`.
 */
export const ITEMS: Record<string, ItemDef> = {
  wood_log: {
    id: 'wood_log',
    category: 'material',
    stackLimit: 99,
    icon: 'wood',
    nameKey: 'item.wood_log.name',
    descKey: 'item.wood_log.desc',
    sortOrder: 10,
  },
  stone_chunk: {
    id: 'stone_chunk',
    category: 'material',
    stackLimit: 99,
    icon: 'stone',
    nameKey: 'item.stone_chunk.name',
    descKey: 'item.stone_chunk.desc',
    sortOrder: 11,
  },
  plant_fiber: {
    id: 'plant_fiber',
    category: 'material',
    stackLimit: 99,
    icon: 'fiber',
    nameKey: 'item.plant_fiber.name',
    descKey: 'item.plant_fiber.desc',
    sortOrder: 12,
  },
  fiber_rope: {
    id: 'fiber_rope',
    category: 'material',
    stackLimit: 40,
    icon: 'fiber',
    nameKey: 'item.fiber_rope.name',
    descKey: 'item.fiber_rope.desc',
    sortOrder: 13,
  },
  scrap_metal: {
    id: 'scrap_metal',
    category: 'material',
    stackLimit: 60,
    icon: 'scrap',
    nameKey: 'item.scrap_metal.name',
    descKey: 'item.scrap_metal.desc',
    sortOrder: 14,
  },
  wild_berries: {
    id: 'wild_berries',
    category: 'food',
    stackLimit: 30,
    icon: 'food',
    nameKey: 'item.wild_berries.name',
    descKey: 'item.wild_berries.desc',
    hunger: 12,
    thirst: 3,
    sortOrder: 20,
  },
  roasted_berries: {
    id: 'roasted_berries',
    category: 'food',
    stackLimit: 30,
    icon: 'food',
    nameKey: 'item.roasted_berries.name',
    descKey: 'item.roasted_berries.desc',
    hunger: 38,
    thirst: 2,
    sortOrder: 21,
  },
  dirty_water: {
    id: 'dirty_water',
    category: 'consumable',
    stackLimit: 20,
    icon: 'water',
    nameKey: 'item.dirty_water.name',
    descKey: 'item.dirty_water.desc',
    thirst: 20,
    healthCost: 4,
    sortOrder: 22,
  },
  clean_water: {
    id: 'clean_water',
    category: 'consumable',
    stackLimit: 20,
    icon: 'water',
    nameKey: 'item.clean_water.name',
    descKey: 'item.clean_water.desc',
    thirst: 42,
    sortOrder: 23,
  },
  basic_medkit: {
    id: 'basic_medkit',
    category: 'consumable',
    stackLimit: 5,
    icon: 'health',
    nameKey: 'item.basic_medkit.name',
    descKey: 'item.basic_medkit.desc',
    heal: 45,
    sortOrder: 24,
  },
  stone_axe: {
    id: 'stone_axe',
    category: 'tool',
    stackLimit: 1,
    icon: 'wood',
    nameKey: 'item.stone_axe.name',
    descKey: 'item.stone_axe.desc',
    tool: { kind: 'axe', gatherBonus: 1.5, damage: 18 },
    sortOrder: 30,
  },
  stone_pickaxe: {
    id: 'stone_pickaxe',
    category: 'tool',
    stackLimit: 1,
    icon: 'stone',
    nameKey: 'item.stone_pickaxe.name',
    descKey: 'item.stone_pickaxe.desc',
    tool: { kind: 'pickaxe', gatherBonus: 1.5, damage: 12 },
    sortOrder: 31,
  },
  reinforced_axe: {
    id: 'reinforced_axe',
    category: 'tool',
    stackLimit: 1,
    icon: 'scrap',
    nameKey: 'item.reinforced_axe.name',
    descKey: 'item.reinforced_axe.desc',
    tool: { kind: 'axe', gatherBonus: 2, damage: 34 },
    sortOrder: 32,
  },
  torch: {
    id: 'torch',
    category: 'tool',
    stackLimit: 3,
    icon: 'energy',
    nameKey: 'item.torch.name',
    descKey: 'item.torch.desc',
    tool: { kind: 'torch', gatherBonus: 1, damage: 8, lightRadius: 9 },
    sortOrder: 33,
  },
  field_pack: {
    id: 'field_pack',
    category: 'tool',
    stackLimit: 2,
    icon: 'backpack',
    nameKey: 'item.field_pack.name',
    descKey: 'item.field_pack.desc',
    carryBonus: 8,
    sortOrder: 34,
  },
  damaged_recorder: {
    id: 'damaged_recorder',
    category: 'quest',
    stackLimit: 1,
    icon: 'scrap',
    nameKey: 'item.damaged_recorder.name',
    descKey: 'item.damaged_recorder.desc',
    sortOrder: 50,
  },
};

export const ITEM_LIST = Object.values(ITEMS).sort((a, b) => a.sortOrder - b.sortOrder);

export function itemDef(id: string): ItemDef {
  const def = ITEMS[id];
  if (!def) throw new Error(`Unknown item id: ${id}`);
  return def;
}

export function isItemId(id: string): boolean {
  return id in ITEMS;
}
