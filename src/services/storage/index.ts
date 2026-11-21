import { SqliteSaveRepository, type SaveRepository } from './repository';
import { SaveService } from './saveService';

let repository: SaveRepository | null = null;
let service: SaveService | null = null;
let initPromise: Promise<SaveService> | null = null;

/**
 * Initialises the durable repository once. If native SQLite is unavailable
 * (for example on an unsupported platform) the app degrades to an in-memory
 * repository instead of crashing — the game stays playable for the session.
 */
export function ensureSaveService(): Promise<SaveService> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      repository = new SqliteSaveRepository();
      const candidate = new SaveService(repository);
      await candidate.init();
      service = candidate;
      return candidate;
    } catch {
      const { MemorySaveRepository } = await import('./repository');
      repository = new MemorySaveRepository();
      const fallback = new SaveService(repository);
      await fallback.init();
      service = fallback;
      return fallback;
    }
  })();
  return initPromise;
}

export function getSaveService(): SaveService {
  if (!service) throw new Error('Save service not initialised');
  return service;
}

export type { SaveRepository };
