import { tickNeeds, mostUrgentNeed, needState } from '../game/survival/needs';
import type { PlayerSave } from '../game/types';

function player(overrides: Partial<PlayerSave> = {}): PlayerSave {
  return {
    x: 0,
    z: 0,
    facing: 0,
    health: 100,
    hunger: 100,
    thirst: 100,
    stamina: 100,
    equipped: null,
    level: 1,
    xp: 0,
    skills: { survival: 1, gathering: 1, crafting: 1, combat: 1, exploration: 1 },
    skillXp: { survival: 0, gathering: 0, crafting: 0, combat: 0, exploration: 0 },
    ...overrides,
  };
}

const base = {
  seconds: 10,
  sprinting: false,
  moving: false,
  drainMultiplier: 1,
  sinceDamage: 0,
  restedAtCampfire: false,
};

describe('survival needs', () => {
  it('drains hunger and thirst over game minutes', () => {
    const next = tickNeeds(player(), { ...base, gameMinutes: 60 });
    expect(next.hunger).toBeCloseTo(68.8, 1);
    expect(next.thirst).toBeCloseTo(53.2, 1);
  });

  it('clamps needs at zero and never exceeds one hundred', () => {
    const next = tickNeeds(player({ hunger: 1, thirst: 1 }), { ...base, gameMinutes: 600 });
    expect(next.hunger).toBe(0);
    expect(next.thirst).toBe(0);
  });

  it('drains stamina while sprinting and regenerates when idle', () => {
    const sprint = tickNeeds(player(), { ...base, gameMinutes: 0.1, sprinting: true, seconds: 2 });
    expect(sprint.stamina).toBeCloseTo(74, 0);
    const rest = tickNeeds(player({ stamina: 20 }), { ...base, gameMinutes: 0.1, seconds: 2 });
    expect(rest.stamina).toBeCloseTo(37, 0);
  });

  it('applies starvation damage only after needs hit zero', () => {
    const starving = tickNeeds(player({ hunger: 0, thirst: 0 }), { ...base, gameMinutes: 1, sinceDamage: 0 });
    expect(starving.health).toBeLessThan(100);
    const healthy = tickNeeds(player(), { ...base, gameMinutes: 1, sinceDamage: 20 });
    expect(healthy.health).toBeGreaterThan(100 - 1);
  });

  it('regenerates health when well fed and out of combat', () => {
    const next = tickNeeds(player({ health: 60 }), { ...base, gameMinutes: 1, sinceDamage: 30, seconds: 10 });
    expect(next.health).toBeGreaterThan(60);
  });

  it('flags needs for the HUD', () => {
    expect(needState(100)).toBe('ok');
    expect(needState(20)).toBe('warning');
    expect(needState(5)).toBe('critical');
    expect(mostUrgentNeed(player({ thirst: 5, hunger: 20 }))).toBe('thirst');
    expect(mostUrgentNeed(player())).toBeNull();
  });
});
