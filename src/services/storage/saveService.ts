import type { AppSettings, GameSave } from '../../game/types';
import { deserializeSave, serializeSave, validateSave } from '../../game/save/schema';
import type { SaveRepository } from './repository';

export const SAVE_KEY = 'save.main';
export const BACKUP_KEY = 'save.backup';
export const SETTINGS_KEY = 'app.settings';

export interface LoadResult {
  save: GameSave | null;
  /** True when the main save was corrupt and the backup was used. */
  recovered: boolean;
  reason?: 'corrupt' | 'future' | 'unsupported' | 'missing' | 'error';
}

export interface SaveOutcome {
  ok: boolean;
  bytes: number;
  error?: unknown;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'auto',
  graphics: 'medium',
  musicVolume: 0.55,
  sfxVolume: 0.8,
  ambienceVolume: 0.7,
  cameraSensitivity: 0.85,
  haptics: true,
  reducedMotion: false,
  largeText: false,
  leftHanded: false,
  showFps: false,
};

const settingsSchemaVersion = 1;

interface StoredSettings {
  version: number;
  settings: AppSettings;
}

/**
 * Owns save/load with validation, backup rotation and recovery.
 * A corrupt save never overwrites a good one: the main slot is only rotated
 * into backup when it validates.
 */
export class SaveService {
  constructor(private repo: SaveRepository) {}

  async init(): Promise<void> {
    await this.repo.init();
  }

  async load(): Promise<LoadResult> {
    try {
      const main = await this.repo.read(SAVE_KEY);
      if (main) {
        const result = deserializeSave(main);
        if (result.ok) return { save: result.save, recovered: false };
        const backup = await this.repo.read(BACKUP_KEY);
        if (backup) {
          const restored = deserializeSave(backup);
          if (restored.ok) {
            // Promote the backup so the next save starts from a valid base.
            await this.repo.write(SAVE_KEY, backup);
            return { save: restored.save, recovered: true, reason: result.reason };
          }
        }
        return { save: null, recovered: false, reason: result.reason };
      }
      const backup = await this.repo.read(BACKUP_KEY);
      if (backup) {
        const restored = deserializeSave(backup);
        if (restored.ok) {
          await this.repo.write(SAVE_KEY, backup);
          return { save: restored.save, recovered: true, reason: 'missing' };
        }
      }
      return { save: null, recovered: false, reason: 'missing' };
    } catch {
      return { save: null, recovered: false, reason: 'error' };
    }
  }

  async save(save: GameSave): Promise<SaveOutcome> {
    const payload = serializeSave(save);
    // Never persist a payload our own validator would reject.
    const check = validateSave(JSON.parse(payload));
    if (!check.ok) return { ok: false, bytes: 0, error: check.reason };
    try {
      const existing = await this.repo.read(SAVE_KEY);
      if (existing) {
        const valid = deserializeSave(existing);
        if (valid.ok) await this.repo.write(BACKUP_KEY, existing);
      }
      await this.repo.write(SAVE_KEY, payload);
      return { ok: true, bytes: payload.length };
    } catch (error) {
      return { ok: false, bytes: 0, error };
    }
  }

  async hasSave(): Promise<boolean> {
    const raw = await this.repo.read(SAVE_KEY).catch(() => null);
    if (!raw) return false;
    return deserializeSave(raw).ok;
  }

  async clear(): Promise<void> {
    await this.repo.remove(SAVE_KEY);
    await this.repo.remove(BACKUP_KEY);
  }

  async loadSettings(): Promise<AppSettings> {
    try {
      const raw = await this.repo.read(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw) as Partial<StoredSettings>;
      if (!parsed || typeof parsed !== 'object' || parsed.version !== settingsSchemaVersion) {
        return { ...DEFAULT_SETTINGS };
      }
      return sanitizeSettings(parsed.settings);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const payload: StoredSettings = { version: settingsSchemaVersion, settings };
    await this.repo.write(SETTINGS_KEY, JSON.stringify(payload));
  }

  async saveSize(): Promise<number> {
    return this.repo.size(SAVE_KEY).catch(() => 0);
  }
}

export function sanitizeSettings(input: Partial<AppSettings> | undefined): AppSettings {
  const base = { ...DEFAULT_SETTINGS };
  if (!input) return base;
  const clamp01 = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
  return {
    language: input.language === 'en' || input.language === 'es' ? input.language : 'auto',
    graphics:
      input.graphics === 'low' || input.graphics === 'high' || input.graphics === 'medium'
        ? input.graphics
        : 'medium',
    musicVolume: clamp01(input.musicVolume, base.musicVolume),
    sfxVolume: clamp01(input.sfxVolume, base.sfxVolume),
    ambienceVolume: clamp01(input.ambienceVolume, base.ambienceVolume),
    cameraSensitivity:
      typeof input.cameraSensitivity === 'number' && Number.isFinite(input.cameraSensitivity)
        ? Math.max(0.4, Math.min(2, input.cameraSensitivity))
        : base.cameraSensitivity,
    haptics: typeof input.haptics === 'boolean' ? input.haptics : base.haptics,
    reducedMotion: typeof input.reducedMotion === 'boolean' ? input.reducedMotion : base.reducedMotion,
    largeText: typeof input.largeText === 'boolean' ? input.largeText : base.largeText,
    leftHanded: typeof input.leftHanded === 'boolean' ? input.leftHanded : base.leftHanded,
    showFps: typeof input.showFps === 'boolean' ? input.showFps : base.showFps,
  };
}
