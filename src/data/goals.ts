import type { GameSave } from '../game/types';
import { countItem } from '../game/inventory/inventory';

export interface GoalProgress {
  current: number;
  target: number;
}

export interface GoalDef {
  id: string;
  titleKey: string;
  descKey: string;
  rewardXp: number;
  rewardItems?: Record<string, number>;
  /** Evaluated against the persisted save; never mutates it. */
  check: (save: GameSave) => GoalProgress;
}

const hasStructure = (save: GameSave, id: string): number =>
  save.structures.some((s) => s.defId === id) ? 1 : 0;

const hasItem = (save: GameSave, id: string): number =>
  countItem(save.inventory, id) > 0 || countItem(save.storage, id) > 0 ? 1 : 0;

const discovered = (save: GameSave, id: string): number =>
  save.discoveries.includes(id) ? 1 : 0;

/**
 * A gentle, sequential director. The chapter quests tell the story; these goals
 * always give the player one concrete, useful next step in the homestead loop.
 * Completion lives in `flags.goal_<id>`, so no schema migration is needed.
 */
export const GOALS: GoalDef[] = [
  {
    id: 'pickaxe',
    titleKey: 'goal.pickaxe.title',
    descKey: 'goal.pickaxe.desc',
    rewardXp: 40,
    check: (save) => ({ current: hasItem(save, 'stone_pickaxe'), target: 1 }),
  },
  {
    id: 'workbench',
    titleKey: 'goal.workbench.title',
    descKey: 'goal.workbench.desc',
    rewardXp: 60,
    rewardItems: { plant_fiber: 2 },
    check: (save) => ({ current: hasStructure(save, 'workbench'), target: 1 }),
  },
  {
    id: 'crate',
    titleKey: 'goal.crate.title',
    descKey: 'goal.crate.desc',
    rewardXp: 50,
    rewardItems: { fiber_rope: 1 },
    check: (save) => ({ current: hasStructure(save, 'storage_crate'), target: 1 }),
  },
  {
    id: 'cooked',
    titleKey: 'goal.cooked.title',
    descKey: 'goal.cooked.desc',
    rewardXp: 45,
    rewardItems: { clean_water: 1 },
    check: (save) => ({ current: save.flags.cooked_once ? 1 : 0, target: 1 }),
  },
  {
    id: 'collector',
    titleKey: 'goal.collector.title',
    descKey: 'goal.collector.desc',
    rewardXp: 70,
    check: (save) => ({ current: hasStructure(save, 'water_collector'), target: 1 }),
  },
  {
    id: 'crops',
    titleKey: 'goal.crops.title',
    descKey: 'goal.crops.desc',
    rewardXp: 70,
    check: (save) => ({ current: hasStructure(save, 'crop_plot'), target: 1 }),
  },
  {
    id: 'bridge',
    titleKey: 'goal.bridge.title',
    descKey: 'goal.bridge.desc',
    rewardXp: 90,
    check: (save) => ({ current: discovered(save, 'footbridge'), target: 1 }),
  },
  {
    id: 'lookout',
    titleKey: 'goal.lookout.title',
    descKey: 'goal.lookout.desc',
    rewardXp: 120,
    check: (save) => ({ current: discovered(save, 'lookout'), target: 1 }),
  },
  {
    id: 'level3',
    titleKey: 'goal.level3.title',
    descKey: 'goal.level3.desc',
    rewardXp: 80,
    check: (save) => ({ current: Math.min(3, save.player.level), target: 3 }),
  },
  {
    id: 'reinforced',
    titleKey: 'goal.reinforced.title',
    descKey: 'goal.reinforced.desc',
    rewardXp: 130,
    check: (save) => ({ current: hasItem(save, 'reinforced_axe'), target: 1 }),
  },
  {
    id: 'stalker',
    titleKey: 'goal.stalker.title',
    descKey: 'goal.stalker.desc',
    rewardXp: 150,
    rewardItems: { basic_medkit: 1 },
    check: (save) => ({ current: Math.min(1, save.stats.threatsDrivenOff), target: 1 }),
  },
  {
    id: 'pack',
    titleKey: 'goal.pack.title',
    descKey: 'goal.pack.desc',
    rewardXp: 100,
    check: (save) => ({ current: save.inventory.size > 24 ? 1 : 0, target: 1 }),
  },
];

export function goalFlag(id: string): string {
  return `goal_${id}`;
}

export function isGoalDone(save: { flags: Record<string, boolean> }, goal: GoalDef): boolean {
  return Boolean(save.flags[goalFlag(goal.id)]);
}

/** The next incomplete goal in order, with live progress. */
export function nextGoal(save: GameSave): { goal: GoalDef; progress: GoalProgress } | null {
  for (const goal of GOALS) {
    if (isGoalDone(save, goal)) continue;
    const progress = goal.check(save);
    return {
      goal,
      progress: { current: Math.min(progress.current, progress.target), target: progress.target },
    };
  }
  return null;
}

export function goalProgress(save: GameSave, goal: GoalDef): GoalProgress {
  return goal.check(save);
}
