/**
 * Core domain types shared by simulation, save layer and UI.
 * Everything here must stay serialisable: no Three.js objects, no class instances.
 */

export type ItemCategory = 'material' | 'food' | 'tool' | 'consumable' | 'quest';

export interface ItemDef {
  id: string;
  category: ItemCategory;
  stackLimit: number;
  icon: string;
  nameKey: string;
  descKey: string;
  /** Nutrition restored when eaten (0-100 scale). */
  hunger?: number;
  /** Hydration restored when drunk (0-100 scale). */
  thirst?: number;
  /** Health restored when used. */
  heal?: number;
  /** Negative health applied on use (raw water). */
  healthCost?: number;
  /** Equippable tool metadata. */
  tool?: {
    kind: 'axe' | 'pickaxe' | 'torch';
    /** Multiplier applied to matching gather yields. */
    gatherBonus: number;
    /** Damage dealt to threats per swing. */
    damage: number;
    /** Emits light / keeps predators at bay. */
    lightRadius?: number;
  };
  /** Passive bonus while carried. */
  carryBonus?: number;
  /** Flavour category for sorting in the inventory UI. */
  sortOrder: number;
}

export interface RecipeDef {
  id: string;
  nameKey: string;
  descKey: string;
  station: 'handcraft' | 'campfire' | 'workbench';
  durationSeconds: number;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  /** Recipe becomes visible once this flag is set. */
  requiresFlag?: string;
  /** Skill used for XP. */
  skill: SkillId;
  xp: number;
  category: 'tools' | 'survival' | 'building';
}

export type SkillId = 'survival' | 'gathering' | 'crafting' | 'combat' | 'exploration';

export interface StructureDef {
  id: string;
  nameKey: string;
  descKey: string;
  cost: Record<string, number>;
  /** Footprint radius in world units. */
  radius: number;
  /** Whether only one may exist at the homestead. */
  unique: boolean;
  /** Unlock requirement (flag). */
  requiresFlag?: string;
  icon: string;
  /** Station provided by this structure. */
  station?: 'campfire' | 'workbench';
  /** Passive production. */
  production?: {
    itemId: string;
    /** Game minutes per unit. */
    minutes: number;
    /** Maximum units waiting to be collected. */
    capacity: number;
  };
  /** Enables sleeping / respawn point. */
  shelter?: boolean;
  /** Adds storage slots when built. */
  storageSlots?: number;
}

export interface StructureInstance {
  id: string;
  defId: string;
  x: number;
  z: number;
  /** Quarter turns, 0..3. */
  rot: number;
  builtAt: number;
  /** Pending production units. */
  pending?: number;
  /** Absolute game minute when the next unit is ready. */
  readyAt?: number;
  /** Crop plot planting state. */
  plantedAt?: number;
}

export interface InventorySlot {
  id: string;
  qty: number;
}

export interface InventoryState {
  size: number;
  slots: (InventorySlot | null)[];
}

export interface PlayerSave {
  x: number;
  z: number;
  facing: number;
  health: number;
  hunger: number;
  thirst: number;
  stamina: number;
  equipped: string | null;
  level: number;
  xp: number;
  skills: Record<SkillId, number>;
  skillXp: Record<SkillId, number>;
}

export interface NodeState {
  /** Remaining gather charges before depletion. */
  charges: number;
  /** Absolute minute at which charges reset. */
  respawnAt: number;
}

export interface QuestSave {
  /** Currently tracked chapter step. */
  activeStep: string | null;
  completed: string[];
  /** Objective counters keyed by `${stepId}:${objectiveId}`. */
  progress: Record<string, number>;
}

export interface TutorialSave {
  step: number;
  completed: boolean;
  skipped: boolean;
}

export interface GameStats {
  itemsGathered: number;
  itemsCrafted: number;
  structuresBuilt: number;
  distanceTravelled: number;
  minutesPlayed: number;
  nightsSurvived: number;
  threatsDrivenOff: number;
  collapses: number;
}

export interface GameSave {
  schemaVersion: number;
  createdAt: number;
  savedAt: number;
  seed: number;
  /** Absolute in-game minutes since world start. */
  minutes: number;
  player: PlayerSave;
  inventory: InventoryState;
  storage: InventoryState;
  storageSlots: number;
  nodes: Record<string, NodeState>;
  structures: StructureInstance[];
  quest: QuestSave;
  discoveries: string[];
  story: string[];
  tutorial: TutorialSave;
  flags: Record<string, boolean>;
  stats: GameStats;
  crafting: CraftJob[];
  nextStructureId: number;
}

export interface CraftJob {
  id: string;
  recipeId: string;
  startedAt: number;
  endsAt: number;
}

export type GraphicsQuality = 'low' | 'medium' | 'high';
export type LanguageSetting = 'auto' | 'en' | 'es';

export interface AppSettings {
  language: LanguageSetting;
  graphics: GraphicsQuality;
  musicVolume: number;
  sfxVolume: number;
  ambienceVolume: number;
  cameraSensitivity: number;
  haptics: boolean;
  reducedMotion: boolean;
  largeText: boolean;
  leftHanded: boolean;
  showFps: boolean;
}

export type ToastKind = 'gain' | 'info' | 'warn' | 'error' | 'story';

export type GameEvent =
  | { type: 'toast'; kind: ToastKind; textKey: string; params?: Record<string, string | number>; icon?: string }
  | { type: 'sfx'; id: string; volume?: number }
  | { type: 'haptic'; style: 'light' | 'medium' | 'heavy' | 'success' | 'warning' }
  | { type: 'quest:updated'; stepId: string }
  | { type: 'chapter:complete' }
  | { type: 'discovery'; poiId: string }
  | { type: 'story:unlocked'; entryId: string }
  | { type: 'level:up'; level: number }
  | { type: 'collapse' }
  | { type: 'threat:driven-off' }
  | { type: 'tutorial:updated'; step: number };

export interface HarvestNode {
  id: string;
  kind: 'tree' | 'rock' | 'bush' | 'fiber' | 'water' | 'cache' | 'crate';
  x: number;
  z: number;
  scale: number;
  rot: number;
  /** Total gather charges per cycle. */
  charges: number;
  /** Items granted per successful gather action. */
  yields: { id: string; qty: number }[];
  /** Tool that speeds up this node (bonus multiplier). */
  toolKind?: 'axe' | 'pickaxe';
  /** Minutes until charges return after depletion. */
  respawnMinutes: number;
}

export interface PoiDef {
  id: string;
  nameKey: string;
  descKey: string;
  x: number;
  z: number;
  radius: number;
  icon: 'camp' | 'bridge' | 'lookout' | 'gate';
  xp: number;
  storyEntry?: string;
  /** Gate that stays locked in this chapter. */
  locked?: boolean;
}

export type ObjectiveKind =
  | 'collect'
  | 'craft'
  | 'build'
  | 'discover'
  | 'recover'
  | 'travel'
  | 'drive_off'
  | 'return_home';

export interface ObjectiveDef {
  id: string;
  kind: ObjectiveKind;
  target?: string;
  amount?: number;
  textKey: string;
}

export interface QuestStepDef {
  id: string;
  titleKey: string;
  summaryKey: string;
  objectives: ObjectiveDef[];
  rewardXp: number;
  rewardItems?: Record<string, number>;
  /** Flags set when the step completes. */
  grantsFlags?: string[];
  /** Hint shown by the tutorial coach. */
  hintKey?: string;
}
