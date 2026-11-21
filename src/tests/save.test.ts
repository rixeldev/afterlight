import { createNewSave } from '../game/engine/GameEngine';
import { deserializeSave, serializeSave, validateSave } from '../game/save/schema';
import { SaveService, DEFAULT_SETTINGS } from '../services/storage/saveService';
import { MemorySaveRepository } from '../services/storage/repository';

describe('save schema', () => {
  it('round-trips a fresh save', () => {
    const save = createNewSave(1234);
    const json = serializeSave(save);
    const result = deserializeSave(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.save.schemaVersion).toBe(1);
    expect(result.save.player.health).toBe(100);
    expect(result.save.inventory.size).toBe(24);
    expect(result.save.quest.activeStep).toBe('wake');
  });

  it('rejects corrupt JSON', () => {
    expect(deserializeSave('{ nope').ok).toBe(false);
    expect(validateSave({ schemaVersion: 1 }).ok).toBe(false);
  });

  it('rejects saves from a future schema version', () => {
    const save = createNewSave();
    const result = validateSave({ ...save, schemaVersion: 99 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('future');
  });

  it('repairs slot arrays whose length drifted', () => {
    const save = createNewSave();
    const broken = { ...save, inventory: { size: 24, slots: [null, { id: 'wood_log', qty: 1 }] } };
    const result = validateSave(broken);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.save.inventory.slots).toHaveLength(24);
  });

  it('drops references to content that no longer exists', () => {
    const save = createNewSave();
    save.inventory.slots[0] = { id: 'removed_item', qty: 5 };
    save.player.equipped = 'removed_tool';
    save.structures = [{ id: 's_9', defId: 'removed_structure', x: 0, z: 0, rot: 0, builtAt: 0 }];
    save.crafting = [{ id: 'j1', recipeId: 'removed_recipe', startedAt: 0, endsAt: 1 }];
    const result = validateSave(save);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.save.inventory.slots[0]).toBeNull();
    expect(result.save.player.equipped).toBeNull();
    expect(result.save.structures).toHaveLength(0);
    expect(result.save.crafting).toHaveLength(0);
  });

  it('serialises node harvest state', () => {
    const save = createNewSave();
    save.nodes['tree_001'] = { charges: 0, respawnAt: 200 };
    const result = deserializeSave(serializeSave(save));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.save.nodes['tree_001']).toEqual({ charges: 0, respawnAt: 200 });
  });
});

describe('save service', () => {
  it('persists, loads and rotates a valid backup', async () => {
    const repo = new MemorySaveRepository();
    const service = new SaveService(repo);
    await service.init();
    const save = createNewSave();
    save.player.level = 4;
    const first = await service.save(save);
    expect(first.ok).toBe(true);

    save.player.level = 5;
    const second = await service.save(save);
    expect(second.ok).toBe(true);

    const loaded = await service.load();
    expect(loaded.save?.player.level).toBe(5);
    const backup = await repo.read('save.backup');
    expect(backup).not.toBeNull();
    expect(deserializeSave(backup!).ok).toBe(true);
  });

  it('recovers from a corrupt main slot using the backup', async () => {
    const repo = new MemorySaveRepository();
    const service = new SaveService(repo);
    await service.init();
    const save = createNewSave();
    save.stats.itemsGathered = 42;
    await service.save(save);
    await service.save(save);
    await repo.write('save.main', '{ corrupted');

    const loaded = await service.load();
    expect(loaded.recovered).toBe(true);
    expect(loaded.save?.stats.itemsGathered).toBe(42);
  });

  it('never overwrites a good backup with corrupt data', async () => {
    const repo = new MemorySaveRepository();
    const service = new SaveService(repo);
    await service.init();
    const save = createNewSave();
    await service.save(save);
    const backupBefore = await repo.read('save.backup');
    const bad = { ...save, player: { ...save.player, health: -50 } };
    const outcome = await service.save(bad as never);
    expect(outcome.ok).toBe(false);
    expect(await repo.read('save.backup')).toBe(backupBefore);
  });

  it('round-trips settings with sanitisation', async () => {
    const repo = new MemorySaveRepository();
    const service = new SaveService(repo);
    await service.init();
    expect(await service.loadSettings()).toEqual(DEFAULT_SETTINGS);
    await service.saveSettings({ ...DEFAULT_SETTINGS, musicVolume: 0.2, graphics: 'high' });
    const loaded = await service.loadSettings();
    expect(loaded.musicVolume).toBe(0.2);
    expect(loaded.graphics).toBe('high');
  });

  it('clears both save slots', async () => {
    const repo = new MemorySaveRepository();
    const service = new SaveService(repo);
    await service.init();
    await service.save(createNewSave());
    await service.clear();
    expect(await service.hasSave()).toBe(false);
    expect(await repo.read('save.backup')).toBeNull();
  });
});
