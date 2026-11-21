import { GameEngine, createNewSave, isNight, clockParts } from '../game/engine/GameEngine';
import { generateHarvestNodes } from '../game/world/layout';
import { countItem } from '../game/inventory/inventory';
import { MINUTES_PER_DAY } from '../game/engine/constants';

const idle = { moveX: 0, moveY: 0, sprint: false, cameraYaw: 0 };

function engineWith(overrides: Partial<ReturnType<typeof createNewSave>> = {}) {
  const save = { ...createNewSave(1), ...overrides };
  return new GameEngine(save, generateHarvestNodes());
}

function run(engine: GameEngine, seconds: number, input = idle) {
  const step = 0.05;
  let left = seconds;
  while (left > 0) {
    engine.tick(Math.min(step, left), input);
    left -= step;
  }
}

describe('game engine', () => {
  it('starts with the starter inventory and a safe camp', () => {
    const engine = engineWith();
    expect(countItem(engine.state.inventory, 'wood_log')).toBe(5);
    expect(countItem(engine.state.inventory, 'stone_chunk')).toBe(3);
    expect(engine.state.discoveries).toContain('homestead');
    const snap = engine.snapshot();
    expect(snap.quest.activeStep).toBe('wake');
    expect(snap.player.health).toBe(100);
  });

  it('freezes simulation while paused (dt = 0)', () => {
    const engine = engineWith();
    const before = engine.state.minutes;
    const hunger = engine.state.player.hunger;
    for (let i = 0; i < 100; i += 1) engine.tick(0, idle);
    expect(engine.state.minutes).toBe(before);
    expect(engine.state.player.hunger).toBe(hunger);
  });

  it('advances travel quest progress while walking', () => {
    const engine = engineWith();
    run(engine, 5, { moveX: 0, moveY: 1, sprint: false, cameraYaw: 0 });
    expect(engine.state.stats.distanceTravelled).toBeGreaterThan(1);
    expect(engine.state.quest.progress['wake:walk'] ?? 0).toBeGreaterThan(1);
  });

  it('gathers wood from a tree and depletes its charges', () => {
    const engine = engineWith();
    const tree = engine.nodes.find((n) => n.kind === 'tree')!;
    engine.state.player.x = tree.x + 1.2;
    engine.state.player.z = tree.z;
    engine.tick(0.016, idle);
    const target = engine.snapshot().interaction;
    expect(target?.nodeId).toBe(tree.id);
    engine.pressInteract();
    run(engine, 3);
    expect(countItem(engine.state.inventory, 'wood_log')).toBeGreaterThan(5);
    expect(engine.state.nodes[tree.id]?.charges).toBeLessThan(3);
    engine.releaseInteract();
  });

  it('does not gather when the inventory is full', () => {
    const engine = engineWith();
    const tree = engine.nodes.find((n) => n.kind === 'tree')!;
    engine.state.inventory = { size: 1, slots: [{ id: 'stone_chunk', qty: 99 }] };
    engine.state.player.x = tree.x + 1.2;
    engine.state.player.z = tree.z;
    engine.tick(0.016, idle);
    engine.pressInteract();
    run(engine, 3);
    expect(countItem(engine.state.inventory, 'wood_log')).toBe(0);
    expect(engine.state.nodes[tree.id]?.charges).toBe(3);
  });

  it('completes a handcraft after its duration', () => {
    const engine = engineWith();
    engine.debugAddItem('stone_chunk', 5);
    engine.debugAddItem('plant_fiber', 5);
    expect(engine.craft('stone_axe')).toBe(true);
    expect(engine.state.crafting).toHaveLength(1);
    run(engine, 4);
    expect(countItem(engine.state.inventory, 'stone_axe')).toBe(1);
    expect(engine.state.crafting).toHaveLength(0);
    expect(engine.state.stats.itemsCrafted).toBe(1);
  });

  it('refuses to craft at a missing workstation', () => {
    const engine = engineWith();
    engine.debugAddItem('scrap_metal', 5);
    expect(engine.craft('reinforced_axe')).toBe(false);
    expect(engine.state.crafting).toHaveLength(0);
  });

  it('builds a campfire inside the homestead and consumes materials', () => {
    const engine = engineWith();
    engine.debugAddItem('wood_log', 10);
    engine.debugAddItem('stone_chunk', 10);
    engine.setBuildMode('campfire');
    const beforeWood = countItem(engine.state.inventory, 'wood_log');
    expect(engine.confirmBuild()).toBe(true);
    expect(engine.state.structures).toHaveLength(1);
    expect(engine.state.structures[0]?.defId).toBe('campfire');
    expect(countItem(engine.state.inventory, 'wood_log')).toBe(beforeWood - 5);
    expect(engine.state.flags.tool_crafted).toBeUndefined();
  });

  it('refunds half when a structure is removed', () => {
    const engine = engineWith();
    engine.debugAddItem('wood_log', 10);
    engine.debugAddItem('stone_chunk', 10);
    engine.setBuildMode('campfire');
    engine.confirmBuild();
    const id = engine.state.structures[0]!.id;
    const wood = countItem(engine.state.inventory, 'wood_log');
    engine.removeStructure(id);
    expect(engine.state.structures).toHaveLength(0);
    expect(countItem(engine.state.inventory, 'wood_log')).toBe(wood + 2);
  });

  it('sleeps until dawn and restores needs', () => {
    const engine = engineWith();
    engine.state.minutes = 20 * 60;
    engine.state.player.health = 40;
    engine.state.player.stamina = 10;
    engine.sleep();
    const clock = clockParts(engine.state.minutes);
    expect(clock.hour).toBe(6);
    expect(engine.state.player.stamina).toBe(100);
    expect(engine.state.player.health).toBeGreaterThan(40);
    expect(engine.state.stats.nightsSurvived).toBe(1);
  });

  it('recovers from collapse without deleting structures', () => {
    const engine = engineWith();
    engine.debugAddItem('wood_log', 10);
    engine.debugAddItem('stone_chunk', 10);
    engine.setBuildMode('campfire');
    engine.confirmBuild();
    engine.state.player.health = 0;
    engine.tick(0.05, idle);
    expect(engine.state.player.health).toBe(50);
    expect(engine.state.structures).toHaveLength(1);
    expect(engine.state.stats.collapses).toBe(1);
    expect(engine.snapshot().player.x).toBeCloseTo(0, 1);
  });

  it('spawns the stalker at night away from camp', () => {
    const engine = engineWith();
    engine.state.flags.nightfall = true;
    engine.state.minutes = 20 * 60;
    engine.state.player.x = 40;
    engine.state.player.z = 10;
    run(engine, 1);
    expect(isNight(engine.state.minutes)).toBe(true);
    expect(engine.getThreat()).not.toBeNull();
  });

  it('does not spawn the stalker inside the safe camp', () => {
    const engine = engineWith();
    engine.state.flags.nightfall = true;
    engine.state.minutes = 20 * 60;
    run(engine, 2);
    expect(engine.getThreat()).toBeNull();
  });

  it('drives off the stalker with the axe and rewards the player', () => {
    const engine = engineWith();
    engine.debugAddItem('stone_axe', 1);
    engine.equip('stone_axe');
    engine.state.flags.nightfall = true;
    engine.state.minutes = 20 * 60 + 30;
    engine.state.player.x = 40;
    engine.state.player.z = 10;
    run(engine, 1);
    const threat = engine.getThreat();
    expect(threat).not.toBeNull();
    // Place the threat in front of the player and swing until it flees.
    for (let i = 0; i < 30 && engine.getThreat(); i += 1) {
      const t = engine.getThreat()!;
      engine.state.player.x = t.x;
      engine.state.player.z = t.z - 2;
      engine.state.player.facing = Math.atan2(t.x - engine.state.player.x, -(t.z - engine.state.player.z));
      engine.attack();
      engine.tick(0.6, idle);
    }
    expect(engine.state.stats.threatsDrivenOff).toBeGreaterThan(0);
    expect(countItem(engine.state.inventory, 'scrap_metal')).toBeGreaterThanOrEqual(2);
  });

  it('regenerates harvested nodes after their respawn window', () => {
    const engine = engineWith();
    const fiber = engine.nodes.find((n) => n.kind === 'fiber')!;
    engine.state.nodes[fiber.id] = { charges: 0, respawnAt: engine.state.minutes + 1 };
    run(engine, 2);
    expect(engine.state.nodes[fiber.id]?.charges).toBe(fiber.charges);
  });

  it('updates world clock across days', () => {
    const engine = engineWith();
    engine.state.minutes = MINUTES_PER_DAY - 1;
    run(engine, 2);
    expect(engine.snapshot().day).toBe(2);
  });

  it('produces water in a collector over time', () => {
    const engine = engineWith();
    engine.debugAddItem('wood_log', 20);
    engine.debugAddItem('plant_fiber', 20);
    engine.debugAddItem('stone_chunk', 20);
    engine.setBuildMode('water_collector');
    // Nudge the ghost to a free tile then place.
    engine.moveBuildGhost(2, 0);
    engine.confirmBuild();
    const collector = engine.state.structures[0]!;
    collector.readyAt = engine.state.minutes;
    run(engine, 2);
    expect(collector.pending ?? 0).toBeGreaterThan(0);
    const collected = engine.collectStructure(collector.id);
    expect(collected).toBeGreaterThan(0);
    expect(countItem(engine.state.inventory, 'dirty_water')).toBeGreaterThan(0);
  });
});
