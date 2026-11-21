/** Balance constants tuned for 5–20 minute sessions on a phone. */

export const SAVE_SCHEMA_VERSION = 1;

/** Game minutes that pass per real second (1 real minute = 4 game minutes). */
export const MINUTES_PER_SECOND = 4 / 60;
export const MINUTES_PER_DAY = 1440;

/** Speeds in world units per second. */
export const WALK_SPEED = 2.3;
export const RUN_SPEED = 4.4;
export const SPRINT_SPEED = 7.1;
export const SPRINT_STAMINA_MIN = 8;

export const PLAYER_RADIUS = 0.36;
export const BASE_INVENTORY_SLOTS = 24;
export const BASE_STORAGE_SLOTS = 0;
export const MAX_STORAGE_SLOTS = 32;
export const CRAFT_QUEUE_LIMIT = 3;

export const INTERACT_RANGE = 3.6;
export const GATHER_RANGE = 3.8;
export const STATION_RANGE = 6.5;
export const CAMP_RADIUS = 14;
export const SLEEP_RESTORE = 100;

export const TREES_PER_CHUNK_NOTE = 'static handcrafted layout; streaming is chunk-visibility only';

export const THREAT = {
  spawnDistance: 26,
  maxHealth: 60,
  prowlSpeed: 1.7,
  chaseSpeed: 4.6,
  fleeSpeed: 5.4,
  detectRange: 20,
  loseRange: 32,
  attackRange: 2.6,
  attackDamage: 11,
  attackCooldown: 2.4,
  torchFearRange: 10,
  despawnAtDawn: true,
} as const;

export const AUTOSAVE_SECONDS = 60;

export const SFX = {
  uiTap: 'ui_tap',
  uiOpen: 'ui_open',
  uiClose: 'ui_close',
  error: 'ui_error',
  chop: 'chop',
  mine: 'mine',
  pick: 'pick',
  water: 'water',
  pickup: 'pickup',
  craft: 'craft',
  craftDone: 'craft_done',
  build: 'build',
  quest: 'quest',
  levelUp: 'level_up',
  hurt: 'hurt',
  growl: 'growl',
  hit: 'hit',
  sleep: 'sleep',
  footstep: 'footstep',
} as const;
