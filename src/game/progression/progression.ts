import type { PlayerSave, SkillId } from '../types';

export const MAX_LEVEL = 30;
export const SKILL_MAX = 10;

/** XP required to go from `level` to `level + 1`. */
export function xpForNextLevel(level: number): number {
  return Math.round(90 * Math.pow(level, 1.32));
}

export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i += 1) total += xpForNextLevel(i);
  return total;
}

export function skillXpForNext(level: number): number {
  return Math.round(45 * Math.pow(level, 1.18));
}

export interface XpResult {
  level: number;
  xp: number;
  levelsGained: number;
  spent: number;
}

/** Applies XP with rollover; XP is stored as progress toward the next level. */
export function applyXp(player: PlayerSave, amount: number): XpResult {
  let level = player.level;
  let xp = player.xp + Math.max(0, amount);
  let levelsGained = 0;
  while (level < MAX_LEVEL && xp >= xpForNextLevel(level)) {
    xp -= xpForNextLevel(level);
    level += 1;
    levelsGained += 1;
  }
  if (level >= MAX_LEVEL) xp = Math.min(xp, xpForNextLevel(MAX_LEVEL));
  return { level, xp, levelsGained, spent: amount };
}

export interface SkillResult {
  level: number;
  xp: number;
  levelsGained: number;
}

export function applySkillXp(player: PlayerSave, skill: SkillId, amount: number): SkillResult {
  let level = player.skills[skill];
  let xp = player.skillXp[skill] + Math.max(0, amount);
  let levelsGained = 0;
  while (level < SKILL_MAX && xp >= skillXpForNext(level)) {
    xp -= skillXpForNext(level);
    level += 1;
    levelsGained += 1;
  }
  player.skills[skill] = level;
  player.skillXp[skill] = xp;
  return { level, xp, levelsGained };
}

export function levelFromXp(xp: number): number {
  let level = 1;
  let remaining = xp;
  while (level < MAX_LEVEL && remaining >= xpForNextLevel(level)) {
    remaining -= xpForNextLevel(level);
    level += 1;
  }
  return level;
}

/** Skill bonuses are intentionally modest; they smooth the grind, not gate it. */
export const skillBonus = {
  /** Extra yield multiplier for gathering. */
  gather: (level: number) => 1 + 0.06 * (level - 1),
  /** Needs drain multiplier (lower is better). */
  needsDrain: (level: number) => 1 - 0.035 * (level - 1),
  /** Crafting duration multiplier. */
  craftTime: (level: number) => Math.max(0.55, 1 - 0.045 * (level - 1)),
  /** Combat damage multiplier. */
  damage: (level: number) => 1 + 0.07 * (level - 1),
  /** Fallback: exploration XP multiplier. */
  discoveryXp: (level: number) => 1 + 0.08 * (level - 1),
};

export const SKILL_META: { id: SkillId; nameKey: string; descKey: string; icon: string }[] = [
  { id: 'survival', nameKey: 'skill.survival.name', descKey: 'skill.survival.desc', icon: 'health' },
  { id: 'gathering', nameKey: 'skill.gathering.name', descKey: 'skill.gathering.desc', icon: 'wood' },
  { id: 'crafting', nameKey: 'skill.crafting.name', descKey: 'skill.crafting.desc', icon: 'craft' },
  { id: 'combat', nameKey: 'skill.combat.name', descKey: 'skill.combat.desc', icon: 'scrap' },
  { id: 'exploration', nameKey: 'skill.exploration.name', descKey: 'skill.exploration.desc', icon: 'map' },
];
