/**
 * Durable key/value storage for saves and settings.
 * SQLite gives us transactional writes; the repository boundary keeps the
 * service testable with an in-memory implementation.
 */
export interface SaveRepository {
  init(): Promise<void>;
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
  size(key: string): Promise<number>;
}

export class MemorySaveRepository implements SaveRepository {
  private store = new Map<string, string>();

  async init(): Promise<void> {}

  async read(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async write(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }

  async keys(): Promise<string[]> {
    return [...this.store.keys()];
  }

  async size(key: string): Promise<number> {
    return this.store.get(key)?.length ?? 0;
  }
}

/** Lazily imported so Node/Jest environments never touch native SQLite. */
export class SqliteSaveRepository implements SaveRepository {
  private db: import('expo-sqlite').SQLiteDatabase | null = null;

  async init(): Promise<void> {
    const SQLite = await import('expo-sqlite');
    this.db = await SQLite.openDatabaseAsync('afterlight.db');
    await this.db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  private requireDb() {
    if (!this.db) throw new Error('SaveRepository not initialised');
    return this.db;
  }

  async read(key: string): Promise<string | null> {
    const row = await this.requireDb().getFirstAsync<{ value: string }>(
      'SELECT value FROM kv WHERE key = ?',
      key,
    );
    return row?.value ?? null;
  }

  async write(key: string, value: string): Promise<void> {
    const db = this.requireDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
        key,
        value,
        Date.now(),
      );
    });
  }

  async remove(key: string): Promise<void> {
    await this.requireDb().runAsync('DELETE FROM kv WHERE key = ?', key);
  }

  async keys(): Promise<string[]> {
    const rows = await this.requireDb().getAllAsync<{ key: string }>('SELECT key FROM kv ORDER BY key');
    return rows.map((r) => r.key);
  }

  async size(key: string): Promise<number> {
    const row = await this.requireDb().getFirstAsync<{ len: number }>(
      'SELECT length(value) AS len FROM kv WHERE key = ?',
      key,
    );
    return row?.len ?? 0;
  }
}
