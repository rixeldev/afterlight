import { z } from 'zod';
import type { GameSave } from '../types';
import { SAVE_SCHEMA_VERSION } from '../engine/constants';

const inventorySlot = z.object({ id: z.string().min(1), qty: z.number().int().positive() }).nullable();

const inventory = z.object({
  size: z.number().int().min(0).max(200),
  slots: z.array(inventorySlot).max(200),
});

const player = z.object({
  x: z.number().finite(),
  z: z.number().finite(),
  facing: z.number().finite(),
  health: z.number().min(0).max(100),
  hunger: z.number().min(0).max(100),
  thirst: z.number().min(0).max(100),
  stamina: z.number().min(0).max(100),
  equipped: z.string().nullable(),
  level: z.number().int().min(1).max(30),
  xp: z.number().min(0),
  skills: z.object({
    survival: z.number().int().min(1).max(10),
    gathering: z.number().int().min(1).max(10),
    crafting: z.number().int().min(1).max(10),
    combat: z.number().int().min(1).max(10),
    exploration: z.number().int().min(1).max(10),
  }),
  skillXp: z.object({
    survival: z.number().min(0),
    gathering: z.number().min(0),
    crafting: z.number().min(0),
    combat: z.number().min(0),
    exploration: z.number().min(0),
  }),
});

const structure = z.object({
  id: z.string(),
  defId: z.string(),
  x: z.number().finite(),
  z: z.number().finite(),
  rot: z.number().int().min(0).max(3),
  builtAt: z.number(),
  pending: z.number().optional(),
  readyAt: z.number().optional(),
  plantedAt: z.number().optional(),
});

const quest = z.object({
  activeStep: z.string().nullable(),
  completed: z.array(z.string()),
  progress: z.record(z.string(), z.number()),
});

const saveSchema = z.object({
  schemaVersion: z.number().int().min(1),
  createdAt: z.number(),
  savedAt: z.number(),
  seed: z.number().int(),
  minutes: z.number().min(0),
  player,
  inventory,
  storage: inventory,
  storageSlots: z.number().int().min(0).max(64).default(0),
  nodes: z.record(z.string(), z.object({ charges: z.number().int(), respawnAt: z.number() })),
  structures: z.array(structure),
  quest,
  discoveries: z.array(z.string()),
  story: z.array(z.string()),
  tutorial: z.object({
    step: z.number().int(),
    completed: z.boolean(),
    skipped: z.boolean(),
  }),
  flags: z.record(z.string(), z.boolean()),
  stats: z.object({
    itemsGathered: z.number(),
    itemsCrafted: z.number(),
    structuresBuilt: z.number(),
    distanceTravelled: z.number(),
    minutesPlayed: z.number(),
    nightsSurvived: z.number(),
    threatsDrivenOff: z.number(),
    collapses: z.number(),
  }),
  crafting: z.array(
    z.object({ id: z.string(), recipeId: z.string(), startedAt: z.number(), endsAt: z.number() }),
  ),
  nextStructureId: z.number().int().min(1),
});

export type ValidationResult =
  | { ok: true; save: GameSave }
  | { ok: false; reason: 'corrupt' | 'future' | 'unsupported' };

/** Validates a raw save object, applying migrations when needed. */
export function validateSave(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'corrupt' };
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== 'number') return { ok: false, reason: 'corrupt' };
  if (version > SAVE_SCHEMA_VERSION) return { ok: false, reason: 'future' };
  if (version < 1) return { ok: false, reason: 'unsupported' };

  const migrated = migrate(JSON.parse(JSON.stringify(raw)) as Record<string, unknown>);
  const parsed = saveSchema.safeParse(migrated);
  if (!parsed.success) return { ok: false, reason: 'corrupt' };

  const save = parsed.data as unknown as GameSave;
  // Repair invariants that schema alone cannot express.
  if (save.inventory.slots.length !== save.inventory.size) {
    const slots = save.inventory.slots.slice(0, save.inventory.size);
    while (slots.length < save.inventory.size) slots.push(null);
    save.inventory.slots = slots;
  }
  if (save.storage.slots.length !== save.storage.size) {
    const slots = save.storage.slots.slice(0, save.storage.size);
    while (slots.length < save.storage.size) slots.push(null);
    save.storage.slots = slots;
  }
  if (save.player.health <= 0) save.player.health = 50;
  return { ok: true, save };
}

/** Version migration chain. Each step must be idempotent and total. */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  let version = Number(raw.schemaVersion ?? 1);
  const save = raw;

  if (version === 1) {
    // Future-proofing example: fill fields added after v1.
    if (save.storageSlots === undefined) save.storageSlots = 0;
    if (save.nextStructureId === undefined) save.nextStructureId = 1;
    if (save.stats === undefined) {
      save.stats = {
        itemsGathered: 0,
        itemsCrafted: 0,
        structuresBuilt: 0,
        distanceTravelled: 0,
        minutesPlayed: 0,
        nightsSurvived: 0,
        threatsDrivenOff: 0,
        collapses: 0,
      };
    }
  }

  version = SAVE_SCHEMA_VERSION;
  save.schemaVersion = version;
  return save;
}

export function serializeSave(save: GameSave): string {
  return JSON.stringify(save);
}

export function deserializeSave(json: string): ValidationResult {
  try {
    return validateSave(JSON.parse(json));
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
}

export function saveByteSize(json: string): number {
  return json.length;
}
