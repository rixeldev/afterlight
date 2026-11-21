import type { PlayerSave } from '../types';

export const NEED_WARNING = 25;
export const NEED_CRITICAL = 12;

export interface NeedsDrain {
  hungerPerMinute: number;
  thirstPerMinute: number;
  staminaPerSecond: number;
  staminaRegenPerSecond: number;
}

export const BASE_DRAIN: NeedsDrain = {
  hungerPerMinute: 0.52,
  thirstPerMinute: 0.78,
  staminaPerSecond: 13,
  staminaRegenPerSecond: 8.5,
};

export interface NeedsTickInput {
  /** In-game minutes elapsed. */
  gameMinutes: number;
  /** Real seconds elapsed (stamina/health are frame-rate based). */
  seconds: number;
  sprinting: boolean;
  moving: boolean;
  drainMultiplier: number;
  sinceDamage: number;
  restedAtCampfire: boolean;
}

export type NeedId = 'health' | 'hunger' | 'thirst' | 'stamina';

function clamp01to100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/**
 * Applies survival drain and regeneration. Pure: mutates a copy supplied by the
 * caller and returns the new values so it can be unit-tested in isolation.
 */
export function tickNeeds(player: PlayerSave, input: NeedsTickInput): PlayerSave {
  const next: PlayerSave = { ...player };
  const { gameMinutes, seconds, sprinting, moving, drainMultiplier, sinceDamage, restedAtCampfire } = input;

  next.hunger = clamp01to100(next.hunger - (BASE_DRAIN.hungerPerMinute * gameMinutes * drainMultiplier));
  next.thirst = clamp01to100(next.thirst - (BASE_DRAIN.thirstPerMinute * gameMinutes * drainMultiplier));

  if (sprinting) {
    next.stamina = clamp01to100(next.stamina - BASE_DRAIN.staminaPerSecond * seconds);
  } else if (moving) {
    next.stamina = clamp01to100(next.stamina + BASE_DRAIN.staminaRegenPerSecond * 0.55 * seconds);
  } else {
    next.stamina = clamp01to100(next.stamina + BASE_DRAIN.staminaRegenPerSecond * seconds);
  }

  // Starvation / dehydration are slow and never instantly lethal.
  let healthDelta = 0;
  if (next.hunger <= 0) healthDelta -= 0.45 * seconds;
  if (next.thirst <= 0) healthDelta -= 0.6 * seconds;

  const wellFed = next.hunger > 55 && next.thirst > 55;
  if (wellFed && sinceDamage > 12) healthDelta += (restedAtCampfire ? 0.9 : 0.4) * seconds;
  if (next.hunger < 10 || next.thirst < 10) healthDelta -= 0.15 * seconds;

  next.health = clamp01to100(next.health + healthDelta);
  return next;
}

export function needState(value: number): 'ok' | 'warning' | 'critical' {
  if (value <= NEED_CRITICAL) return 'critical';
  if (value <= NEED_WARNING) return 'warning';
  return 'ok';
}

/** Highest-priority need warning for HUD hints. */
export function mostUrgentNeed(player: PlayerSave): NeedId | null {
  const candidates: { id: NeedId; value: number }[] = [
    { id: 'health', value: player.health },
    { id: 'thirst', value: player.thirst },
    { id: 'hunger', value: player.hunger },
    { id: 'stamina', value: player.stamina },
  ];
  const critical = candidates.find((c) => c.value <= NEED_CRITICAL);
  if (critical) return critical.id;
  const warning = candidates.filter((c) => c.value <= NEED_WARNING).sort((a, b) => a.value - b.value)[0];
  return warning ? warning.id : null;
}
