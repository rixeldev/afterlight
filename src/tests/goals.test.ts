import { createNewSave, GameEngine } from '../game/engine/GameEngine';
import { GOALS, goalFlag, isGoalDone, nextGoal } from '../data/goals';
import { addItem } from '../game/inventory/inventory';
import { generateHarvestNodes } from '../game/world/layout';

describe('homestead goals', () => {
  it('starts with the pickaxe and advances in order', () => {
    const save = createNewSave();
    expect(nextGoal(save)?.goal.id).toBe('pickaxe');

    save.inventory = addItem(save.inventory, 'stone_pickaxe', 1).inventory;
    // The director reports the satisfied goal until the engine banks it.
    expect(nextGoal(save)?.progress.current).toBe(1);
    save.flags[goalFlag('pickaxe')] = true;
    expect(nextGoal(save)?.goal.id).toBe('workbench');

    save.flags[goalFlag('workbench')] = true;
    expect(nextGoal(save)?.goal.id).toBe('crate');
  });

  it('tracks structure, discovery, level and stat goals', () => {
    const save = createNewSave();
    save.structures.push({ id: 's_1', defId: 'water_collector', x: 0, z: 0, rot: 0, builtAt: 0 });
    const collector = GOALS.find((g) => g.id === 'collector')!;
    expect(collector.check(save)).toEqual({ current: 1, target: 1 });

    save.discoveries.push('lookout');
    expect(GOALS.find((g) => g.id === 'lookout')!.check(save).current).toBe(1);

    save.stats.threatsDrivenOff = 1;
    expect(GOALS.find((g) => g.id === 'stalker')!.check(save).current).toBe(1);
  });

  it('never repeats a completed goal', () => {
    const save = createNewSave();
    save.flags[goalFlag('pickaxe')] = true;
    expect(isGoalDone(save, GOALS[0]!)).toBe(true);
    expect(nextGoal(save)?.goal.id).not.toBe('pickaxe');
  });

  it('awards XP once when the engine sees a goal completed', () => {
    const engine = new GameEngine(createNewSave(), generateHarvestNodes());
    engine.debugAddItem('stone_pickaxe', 1);
    const before = engine.state.player.xp + engine.state.player.level * 1000;
    engine.tick(0.05, { moveX: 0, moveY: 0, sprint: false, cameraYaw: 0 });
    for (let i = 0; i < 80; i += 1) {
      engine.tick(0.05, { moveX: 0, moveY: 0, sprint: false, cameraYaw: 0 });
    }
    expect(engine.state.flags.goal_pickaxe).toBe(true);
    const after = engine.state.player.xp + engine.state.player.level * 1000;
    expect(after).toBeGreaterThan(before);
    // Second pass must not award again.
    const xp = engine.state.player.xp;
    for (let i = 0; i < 80; i += 1) {
      engine.tick(0.05, { moveX: 0, moveY: 0, sprint: false, cameraYaw: 0 });
    }
    expect(engine.state.player.xp).toBe(xp);
  });
});
