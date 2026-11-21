import type {
  CraftJob,
  GameEvent,
  GameSave,
  GameStats,
  HarvestNode,
  InventoryState,
  NodeState,
  ObjectiveDef,
  PlayerSave,
  QuestSave,
  StructureInstance,
  ToastKind,
} from '../types';
import { ITEMS, itemDef } from '../../data/items';
import { RECIPES, STRUCTURES } from '../../data/recipes';
import { POIS, REGION, storyEntry } from '../../data/world';
import { questStep } from '../../data/quests';
import { goalFlag, nextGoal } from '../../data/goals';
import {
  addItem,
  cloneInventory,
  consumeItems,
  countItem,
  createInventory,
  hasItems,
  missingItems,
  removeItem,
  resizeInventory,
  freeSlots,
} from '../inventory/inventory';
import {
  applySkillXp,
  applyXp,
  skillBonus,
  skillXpForNext,
} from '../progression/progression';
import { tickNeeds } from '../survival/needs';
import { advanceQuest, createQuestSave, isStepComplete } from '../quests/questSystem';
import {
  CAMP_RADIUS,
  CRAFT_QUEUE_LIMIT,
  INTERACT_RANGE,
  MAX_STORAGE_SLOTS,
  MINUTES_PER_DAY,
  MINUTES_PER_SECOND,
  PLAYER_RADIUS,
  RUN_SPEED,
  SFX,
  SPRINT_SPEED,
  SPRINT_STAMINA_MIN,
  STATION_RANGE,
  THREAT,
  WALK_SPEED,
  AUTOSAVE_SECONDS,
} from './constants';
import {
  BUILD_CELL,
  normalizeRotation,
  PlacementResult,
  refundFor,
  snapToGrid,
  validatePlacement,
  type StaticObstacle,
} from '../building/building';
import { generateHarvestNodes } from '../world/layout';
import {
  isUnderwater,
  terrainHeight,
  terrainSlope,
  WATER_LEVEL,
} from '../world/terrain';

export interface TickInput {
  moveX: number;
  moveY: number;
  sprint: boolean;
  cameraYaw: number;
}

export interface InteractionTarget {
  id: string;
  kind: 'gather' | 'campfire' | 'workbench' | 'storage' | 'shelter' | 'collect' | 'sleep' | 'gate';
  labelKey: string;
  nodeId?: string;
  structureId?: string;
  poiId?: string;
  distance: number;
}

export interface BuildGhost {
  defId: string;
  x: number;
  y: number;
  z: number;
  rot: number;
  valid: boolean;
  reason: string;
  cost: Record<string, number>;
  affordable: boolean;
}

export interface ThreatSummary {
  active: boolean;
  x: number;
  z: number;
  distance: number;
  health: number;
  maxHealth: number;
  mode: 'prowl' | 'chase' | 'flee';
}

export interface GameSnapshot {
  minutes: number;
  day: number;
  timeOfDay: number;
  player: PlayerSave;
  inventory: InventoryState;
  storage: InventoryState;
  storageSlots: number;
  structures: StructureInstance[];
  quest: QuestSave;
  goal: { id: string; titleKey: string; descKey: string; current: number; target: number } | null;
  discoveries: string[];
  story: string[];
  tutorial: GameSave['tutorial'];
  flags: Record<string, boolean>;
  stats: GameStats;
  crafting: CraftJob[];
  interaction: InteractionTarget | null;
  action: { labelKey: string; progress: number; active: boolean } | null;
  threat: ThreatSummary | null;
  build: BuildGhost | null;
  station: { campfire: boolean; workbench: boolean };
  damageFlash: number;
  attackFlash: number;
  equipped: string | null;
  cameraYaw: number;
  capacity: number;
  canSleep: boolean;
  autosaveAt: number;
  playing: boolean;
}

interface ThreatRuntime {
  x: number;
  z: number;
  health: number;
  mode: 'prowl' | 'chase' | 'flee';
  cooldown: number;
  id: number;
  spawnedAt: number;
}

interface GatherAction {
  nodeId: string;
  elapsed: number;
  duration: number;
  labelKey: string;
  repeat: boolean;
}

interface Impact {
  x: number;
  z: number;
  kind: HarvestNode['kind'] | 'build' | 'hit';
  at: number;
}

interface Runtime {
  threat: ThreatRuntime | null;
  impact: Impact | null;
  defeatedOnDay: number;
  gather: GatherAction | null;
  heldInteract: boolean;
  attackCooldown: number;
  attackFlash: number;
  damageFlash: number;
  sinceDamage: number;
  autosaveIn: number;
  build: { defId: string; x: number; z: number; rot: number } | null;
  interaction: InteractionTarget | null;
  lastCameraYaw: number;
  obstacleCache: StaticObstacle[] | null;
  gatherSfxTimer: number;
  discoverCooldown: number;
  gateNoticeCooldown: number;
  warnedFull: number;
  lastSnapshotVersion: number;
  interactCooldownUntil: number;
  nodeRevision: number;
  goalTimer: number;
}

const GATHER_DURATION: Record<HarvestNode['kind'], { base: number; tool: number; sfx: string; label: string }> = {
  tree: { base: 1.8, tool: 1.05, sfx: SFX.chop, label: 'interact.chop' },
  rock: { base: 1.9, tool: 1.15, sfx: SFX.mine, label: 'interact.mine' },
  bush: { base: 0.75, tool: 0.6, sfx: SFX.pick, label: 'interact.forage' },
  fiber: { base: 0.7, tool: 0.55, sfx: SFX.pick, label: 'interact.gather_fiber' },
  water: { base: 1.3, tool: 1.3, sfx: SFX.water, label: 'interact.draw_water' },
  cache: { base: 1.4, tool: 1.4, sfx: SFX.pickup, label: 'interact.search' },
  crate: { base: 1.3, tool: 1.3, sfx: SFX.pickup, label: 'interact.search' },
};

const TOOL_LABEL: Record<string, string> = {
  axe: 'interact.chop_tool',
  pickaxe: 'interact.mine_tool',
};

export function isNight(minutes: number): boolean {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return m >= 19 * 60 || m < 5.5 * 60;
}

export function clockParts(minutes: number): { day: number; hour: number; minute: number; timeOfDay: number } {
  const absolute = Math.max(0, minutes);
  const day = Math.floor(absolute / MINUTES_PER_DAY) + 1;
  const rem = absolute % MINUTES_PER_DAY;
  return {
    day,
    hour: Math.floor(rem / 60),
    minute: Math.floor(rem % 60),
    timeOfDay: rem / MINUTES_PER_DAY,
  };
}

const DIST = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function makeStats(): GameStats {
  return {
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

function makePlayer(): PlayerSave {
  return {
    x: REGION.spawn.x,
    z: REGION.spawn.z,
    facing: Math.PI,
    health: 100,
    hunger: 92,
    thirst: 88,
    stamina: 100,
    equipped: null,
    level: 1,
    xp: 0,
    skills: { survival: 1, gathering: 1, crafting: 1, combat: 1, exploration: 1 },
    skillXp: { survival: 0, gathering: 0, crafting: 0, combat: 0, exploration: 0 },
  };
}

/** Creates a brand-new save with starter inventory. */
export function createNewSave(now = Date.now()): GameSave {
  let inventory = createInventory(24);
  for (const [id, qty] of Object.entries({ wood_log: 5, stone_chunk: 3, wild_berries: 5, clean_water: 2 })) {
    inventory = addItem(inventory, id, qty).inventory;
  }
  const save: GameSave = {
    schemaVersion: 1,
    createdAt: now,
    savedAt: now,
    seed: (Date.now() ^ 0x9e3779b9) >>> 0,
    minutes: REGION.startMinute,
    player: makePlayer(),
    inventory,
    storage: createInventory(0),
    storageSlots: 0,
    nodes: {},
    structures: [],
    quest: createQuestSave(),
    discoveries: ['homestead'],
    story: [],
    tutorial: { step: 0, completed: false, skipped: false },
    flags: {},
    stats: makeStats(),
    crafting: [],
    nextStructureId: 1,
  };
  return save;
}

export class GameEngine {
  state: GameSave;
  readonly nodes: HarvestNode[];
  runtime: Runtime;
  private events: GameEvent[] = [];
  private saveRequested = false;

  constructor(state: GameSave, nodes: HarvestNode[] = generateHarvestNodes()) {
    this.state = state;
    this.nodes = nodes;
    for (const node of nodes) {
      if (!state.nodes[node.id]) {
        state.nodes[node.id] = { charges: node.charges, respawnAt: 0 };
      }
    }
    this.runtime = {
      threat: null,
      impact: null,
      defeatedOnDay: 0,
      gather: null,
      heldInteract: false,
      attackCooldown: 0,
      attackFlash: 0,
      damageFlash: 0,
      sinceDamage: 999,
      autosaveIn: AUTOSAVE_SECONDS,
      build: null,
      interaction: null,
      lastCameraYaw: 0,
      obstacleCache: null,
      gatherSfxTimer: 0,
      discoverCooldown: 0,
      gateNoticeCooldown: 0,
      warnedFull: -999,
      lastSnapshotVersion: 0,
      interactCooldownUntil: 0,
      nodeRevision: 0,
      goalTimer: 3,
    };
  }

  static createNew(now = Date.now()): GameEngine {
    return new GameEngine(createNewSave(now));
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  get minutes(): number {
    return this.state.minutes;
  }

  nodeState(nodeId: string): NodeState {
    const node = this.nodes.find((n) => n.id === nodeId);
    const existing = this.state.nodes[nodeId];
    if (existing) return existing;
    const fresh = { charges: node?.charges ?? 0, respawnAt: 0 };
    this.state.nodes[nodeId] = fresh;
    return fresh;
  }

  equippedTool() {
    const id = this.state.player.equipped;
    return id ? itemDef(id).tool ?? null : null;
  }

  inventoryCapacity(): number {
    return this.state.inventory.size;
  }

  stationInRange(station: 'campfire' | 'workbench'): boolean {
    const p = this.state.player;
    return this.state.structures.some((s) => {
      const def = STRUCTURES[s.defId];
      return def?.station === station && DIST(p.x, p.z, s.x, s.z) <= STATION_RANGE;
    });
  }

  nearestStation(structureId: string): StructureInstance | undefined {
    return this.state.structures.find((s) => s.id === structureId);
  }

  getThreat(): ThreatRuntime | null {
    return this.runtime.threat;
  }

  getImpact(): Impact | null {
    return this.runtime.impact;
  }

  /** Pose data for the avatar while a hold-to-gather action is running. */
  getActionInfo(): { kind: HarvestNode['kind']; progress: number; labelKey: string } | null {
    const action = this.runtime.gather;
    if (!action) return null;
    const node = this.nodes.find((n) => n.id === action.nodeId);
    if (!node) return null;
    return {
      kind: node.kind,
      progress: Math.max(0, Math.min(1, action.elapsed / action.duration)),
      labelKey: action.labelKey,
    };
  }

  getBuildGhost(): BuildGhost | null {
    const b = this.runtime.build;
    if (!b) return null;
    return this.validateBuild(b.defId, b.x, b.z, b.rot);
  }

  getNodeView(): { node: HarvestNode; charges: number; respawnAt: number; y: number; depleted: boolean }[] {
    return this.nodes.map((node) => {
      const st = this.nodeState(node.id);
      return {
        node,
        charges: st.charges,
        respawnAt: st.respawnAt,
        y: terrainHeight(node.x, node.z),
        depleted: st.charges <= 0 && node.kind !== 'water',
      };
    });
  }

  // ── Event plumbing ──────────────────────────────────────────────────────

  private emit(event: GameEvent) {
    this.events.push(event);
  }

  private toast(kind: ToastKind, textKey: string, params?: Record<string, string | number>, icon?: string) {
    this.emit({ type: 'toast', kind, textKey, params, icon });
  }

  private sfx(id: string, volume?: number) {
    this.emit({ type: 'sfx', id, volume });
  }

  private haptic(style: 'light' | 'medium' | 'heavy' | 'success' | 'warning') {
    this.emit({ type: 'haptic', style });
  }

  consumeEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  consumeSaveRequest(): boolean {
    const requested = this.saveRequested;
    this.saveRequested = false;
    return requested;
  }

  requestSave() {
    this.saveRequested = true;
  }

  // ── Progression helpers ─────────────────────────────────────────────────

  private grantXp(amount: number) {
    if (amount <= 0) return;
    const result = applyXp(this.state.player, amount);
    this.state.player.level = result.level;
    this.state.player.xp = result.xp;
    if (result.levelsGained > 0) {
      this.emit({ type: 'level:up', level: result.level });
      this.sfx(SFX.levelUp);
      this.haptic('success');
    }
  }

  private grantSkill(skill: keyof PlayerSave['skills'], amount: number) {
    const res = applySkillXp(this.state.player, skill, amount);
    if (res.levelsGained > 0) {
      this.sfx(SFX.levelUp);
      this.toast('story', 'toast.skill_up', { skill: `skill.${skill}.name`, level: res.level });
    }
  }

  /** Adds items and advances collect/recover objectives. */
  private giveItem(id: string, qty: number, counted = true, silent = false): number {
    const res = addItem(this.state.inventory, id, qty);
    this.state.inventory = res.inventory;
    const def = ITEMS[id];
    if (res.added > 0 && !silent) {
      this.toast('gain', 'toast.item_gained', { qty: res.added, item: def?.nameKey ?? id }, def?.icon);
    }
    if (res.overflow) {
      this.toast('warn', 'toast.inventory_full');
      this.sfx(SFX.error);
    }
    if (counted && res.added > 0) {
      this.advanceQuest('collect', id, res.added);
      if (id === 'damaged_recorder') this.advanceQuest('recover', id, res.added);
    }
    return res.added;
  }

  private advanceQuest(kind: ObjectiveDef['kind'], target: string | undefined, amount: number) {
    const update = advanceQuest(this.state.quest, kind, target, amount);
    this.state.quest = update.quest;
    if (update.completedSteps.length > 0) {
      for (const step of update.completedSteps) {
        this.grantXp(step.rewardXp);
        if (step.rewardItems) {
          for (const [id, qty] of Object.entries(step.rewardItems)) this.giveItem(id, qty, false, true);
        }
        if (step.grantsFlags) {
          for (const flag of step.grantsFlags) this.state.flags[flag] = true;
        }
        this.emit({ type: 'quest:updated', stepId: step.id });
        this.toast('story', 'toast.quest_complete', { quest: step.titleKey });
        this.sfx(SFX.quest);
        this.haptic('success');
        this.state.flags[`quest_${step.id}`] = true;
        if (step.id === 'homestead') {
          this.toast('warn', 'toast.nightfall_warning');
          this.state.tutorial.step = Math.max(this.state.tutorial.step, 4);
        }
        if (step.id === 'return_home') {
          this.state.tutorial.completed = true;
          this.unlockStory('log_chapter_end');
          this.emit({ type: 'chapter:complete' });
        }
      }
      this.requestSave();
      const next = this.state.quest.activeStep ? questStep(this.state.quest.activeStep) : null;
      if (next) {
        this.toast('story', 'toast.new_objective', { quest: next.titleKey });
        this.emit({ type: 'tutorial:updated', step: this.tutorialStepIndex() });
      }
      // Dusk falls as the chapter finale begins.
      if (this.state.quest.activeStep === 'return_home') {
        const dayStart = Math.floor(this.state.minutes / MINUTES_PER_DAY) * MINUTES_PER_DAY;
        this.state.minutes = Math.max(this.state.minutes, dayStart + 19 * 60 + 5);
      }
    }
  }

  private tutorialStepIndex(): number {
    return this.state.tutorial.step;
  }

  private unlockStory(entryId: string) {
    if (this.state.story.includes(entryId)) return;
    this.state.story.push(entryId);
    const entry = storyEntry(entryId);
    if (entry) {
      this.emit({ type: 'story:unlocked', entryId });
      this.toast('story', 'toast.story_unlocked', { title: entry.titleKey });
      this.grantXp(60);
    }
  }

  // ── Simulation ──────────────────────────────────────────────────────────

  tick(dtRaw: number, input: TickInput) {
    if (this.state.player.health <= 0) this.collapse();
    const dt = clamp(dtRaw, 0, 0.08);
    if (dt <= 0) {
      this.runtime.lastCameraYaw = input.cameraYaw;
      this.recomputeInteraction();
      return;
    }
    const gameMinutes = dt * MINUTES_PER_SECOND;
    this.runtime.lastCameraYaw = input.cameraYaw;
    this.runtime.sinceDamage += dt;
    this.runtime.attackCooldown = Math.max(0, this.runtime.attackCooldown - dt);
    this.runtime.attackFlash = Math.max(0, this.runtime.attackFlash - dt * 3);
    this.runtime.damageFlash = Math.max(0, this.runtime.damageFlash - dt * 1.8);
    this.runtime.discoverCooldown = Math.max(0, this.runtime.discoverCooldown - dt);
    this.runtime.gateNoticeCooldown = Math.max(0, this.runtime.gateNoticeCooldown - dt);
    this.runtime.gatherSfxTimer = Math.max(0, this.runtime.gatherSfxTimer - dt);

    this.state.minutes += gameMinutes;
    this.state.stats.minutesPlayed += dt;

    this.updateMovement(dt, input);
    this.updateNeeds(dt, gameMinutes, input);
    if (this.state.player.health <= 0) this.collapse();
    this.updateNodes();
    this.updateStructures(gameMinutes);
    this.updateCrafting();
    this.updateDiscoveries();
    this.updateThreat(dt);
    this.updateQuestPassive();
    this.updateGoals(dt);
    this.recomputeInteraction();
    this.updateGather(dt, input);
    this.updateAutosave(dt);

    if (this.state.player.health <= 0) this.collapse();
  }

  private updateMovement(dt: number, input: TickInput) {
    const p = this.state.player;

    // If a structure was placed on top of us (or a save is old), step out first.
    if (!this.isPositionFree(p.x, p.z)) {
      const push = this.nearestObstaclePush(p.x, p.z);
      if (push && this.isPositionFree(p.x + push.x, p.z + push.z)) {
        p.x += push.x;
        p.z += push.z;
      }
    }

    const mag = Math.hypot(input.moveX, input.moveY);
    const deadZone = 0.12;
    const analog = mag <= deadZone ? 0 : Math.min(1, (mag - deadZone) / (1 - deadZone));

    if (analog > 0.02) {
      const fwdX = -Math.sin(input.cameraYaw);
      const fwdZ = -Math.cos(input.cameraYaw);
      const rightX = Math.cos(input.cameraYaw);
      const rightZ = -Math.sin(input.cameraYaw);
      let dirX = fwdX * input.moveY + rightX * input.moveX;
      let dirZ = fwdZ * input.moveY + rightZ * input.moveX;
      const len = Math.hypot(dirX, dirZ) || 1;
      dirX /= len;
      dirZ /= len;

      const sprinting =
        input.sprint &&
        analog > 0.55 &&
        p.stamina > SPRINT_STAMINA_MIN &&
        !this.runtime.gather;
      let speed = WALK_SPEED + (RUN_SPEED - WALK_SPEED) * analog;
      if (sprinting) speed = SPRINT_SPEED * (0.75 + 0.25 * analog);
      const slope = terrainSlope(p.x, p.z, 0.8);
      if (slope > 0.9) speed *= 0.62;
      if (isUnderwater(p.x, p.z)) speed *= 0.55;

      const moved = this.moveWithCollisions(p.x, p.z, dirX * speed * dt, dirZ * speed * dt);
      if (moved.distance > 0.0001) {
        p.x = moved.x;
        p.z = moved.z;
        this.state.stats.distanceTravelled += moved.distance;
        this.advanceQuest('travel', undefined, moved.distance);
        p.facing = lerpAngle(p.facing, Math.atan2(dirX, -dirZ), Math.min(1, dt * 14));
        this.runtime.gatherSfxTimer -= moved.distance;
        if (this.runtime.gatherSfxTimer <= 0) {
          this.runtime.gatherSfxTimer = 1.65;
          this.sfx(SFX.footstep, isUnderwater(p.x, p.z) ? 0.4 : 0.32);
        }
      }
    }

    if (this.runtime.gather && analog > 0.2) this.cancelGather();

    const distCamp = DIST(p.x, p.z, REGION.camp.x, REGION.camp.z);
    if (distCamp > REGION.playRadius) {
      const k = REGION.playRadius / distCamp;
      p.x = REGION.camp.x + (p.x - REGION.camp.x) * k;
      p.z = REGION.camp.z + (p.z - REGION.camp.z) * k;
      this.toast('info', 'toast.world_edge');
    }
  }

  /** True when the player's body can occupy this point. */
  private isPositionFree(x: number, z: number): boolean {
    if (terrainHeight(x, z) < WATER_LEVEL - 0.55) return false;
    const radius = PLAYER_RADIUS;
    for (const o of this.obstacles()) {
      const dx = x - o.x;
      const dz = z - o.z;
      const min = o.radius + radius;
      if (dx * dx + dz * dz < min * min) return false;
    }
    return true;
  }

  private nearestObstaclePush(x: number, z: number): { x: number; z: number } | null {
    const radius = PLAYER_RADIUS;
    let best: { x: number; z: number; depth: number } | null = null;
    for (const o of this.obstacles()) {
      const dx = x - o.x;
      const dz = z - o.z;
      const min = o.radius + radius;
      const dist = Math.hypot(dx, dz);
      if (dist < min && dist > 0.0001) {
        const depth = min - dist;
        if (!best || depth > best.depth) {
          best = { x: (dx / dist) * (depth + 0.02), z: (dz / dist) * (depth + 0.02), depth };
        }
      }
    }
    return best ? { x: best.x, z: best.z } : null;
  }

  /**
   * Sub-stepped movement with axis sliding. Full step first, then X-only and
   * Z-only so the player slides around trunks and walls instead of sticking.
   */
  private moveWithCollisions(
    x: number,
    z: number,
    dx: number,
    dz: number,
  ): { x: number; z: number; distance: number } {
    const length = Math.hypot(dx, dz);
    if (length < 1e-5) return { x, z, distance: 0 };
    const steps = Math.min(8, Math.max(1, Math.ceil(length / 0.22)));
    const stepX = dx / steps;
    const stepZ = dz / steps;
    let cx = x;
    let cz = z;
    let moved = 0;

    for (let i = 0; i < steps; i += 1) {
      const nx = cx + stepX;
      const nz = cz + stepZ;
      if (this.isPositionFree(nx, nz)) {
        cx = nx;
        cz = nz;
        moved += Math.hypot(stepX, stepZ);
        continue;
      }
      if (Math.abs(stepX) > 1e-5 && this.isPositionFree(nx, cz)) {
        cx = nx;
        moved += Math.abs(stepX);
        continue;
      }
      if (Math.abs(stepZ) > 1e-5 && this.isPositionFree(cx, nz)) {
        cz = nz;
        moved += Math.abs(stepZ);
        continue;
      }
      break;
    }

    return { x: cx, z: cz, distance: moved };
  }

  private obstacles(): StaticObstacle[] {
    if (this.runtime.obstacleCache) return this.runtime.obstacleCache;
    const list: StaticObstacle[] = [];
    for (const node of this.nodes) {
      if (node.kind === 'tree') list.push({ x: node.x, z: node.z, radius: 0.5 * node.scale });
      else if (node.kind === 'rock') list.push({ x: node.x, z: node.z, radius: 0.72 * node.scale });
    }
    list.push({ x: 34, z: -38, radius: 3.0 });
    for (const s of this.state.structures) {
      const def = STRUCTURES[s.defId];
      if (def) list.push({ x: s.x, z: s.z, radius: def.radius * 0.66 });
    }
    this.runtime.obstacleCache = list;
    return list;
  }

  private updateNeeds(dt: number, gameMinutes: number, input: TickInput) {
    const sprinting =
      input.sprint && Math.hypot(input.moveX, input.moveY) > 0.45 && this.state.player.stamina > SPRINT_STAMINA_MIN;
    const moving = Math.hypot(input.moveX, input.moveY) > 0.08;
    const nearFire = this.state.structures.some((s) => {
      const def = STRUCTURES[s.defId];
      return def?.station === 'campfire' && DIST(this.state.player.x, this.state.player.z, s.x, s.z) < 7;
    });
    const drainMultiplier =
      skillBonus.needsDrain(this.state.player.skills.survival) * (nearFire ? 0.82 : 1);
    this.state.player = tickNeeds(this.state.player, {
      gameMinutes,
      seconds: dt,
      sprinting: Boolean(sprinting),
      moving,
      drainMultiplier,
      sinceDamage: this.runtime.sinceDamage,
      restedAtCampfire: nearFire,
    });
  }

  private updateNodes() {
    for (const node of this.nodes) {
      const st = this.state.nodes[node.id];
      if (!st) continue;
      if (st.charges <= 0 && st.respawnAt > 0 && this.state.minutes >= st.respawnAt && node.kind !== 'cache') {
        st.charges = node.charges;
        st.respawnAt = 0;
        this.runtime.nodeRevision += 1;
      }
    }
  }

  private updateStructures(gameMinutes: number) {
    for (const s of this.state.structures) {
      const def = STRUCTURES[s.defId];
      if (!def?.production) continue;
      const pending = s.pending ?? 0;
      if (pending >= def.production.capacity) continue;
      let readyAt = s.readyAt ?? this.state.minutes;
      if (readyAt <= 0) readyAt = this.state.minutes;
      if (this.state.minutes >= readyAt) {
        const units = Math.min(
          def.production.capacity - pending,
          Math.max(1, Math.floor((this.state.minutes - readyAt) / def.production.minutes) + 1),
        );
        s.pending = pending + units;
        s.readyAt = readyAt + units * def.production.minutes;
      }
      void gameMinutes;
    }
  }

  private updateCrafting() {
    if (this.state.crafting.length === 0) return;
    const now = this.state.minutes;
    const remaining: CraftJob[] = [];
    for (const job of this.state.crafting) {
      if (now < job.endsAt) {
        remaining.push(job);
        continue;
      }
      const recipe = RECIPES[job.recipeId];
      if (!recipe) continue;
      let blocked = false;
      for (const [id, qty] of Object.entries(recipe.outputs)) {
        const test = addItem(this.state.inventory, id, qty);
        if (test.overflow) blocked = true;
      }
      if (blocked) {
        if (now - (this.runtime.warnedFull ?? 0) > 20) {
          this.runtime.warnedFull = now;
          this.toast('warn', 'toast.inventory_full');
        }
        remaining.push({ ...job, endsAt: now + 8 });
        continue;
      }
      for (const [id, qty] of Object.entries(recipe.outputs)) {
        this.state.inventory = addItem(this.state.inventory, id, qty).inventory;
        this.toast('gain', 'toast.item_gained', { qty, item: itemDef(id).nameKey }, itemDef(id).icon);
        this.advanceQuest('collect', id, qty);
      }
      this.state.stats.itemsCrafted += 1;
      if (recipe.id === 'roasted_berries') this.state.flags.cooked_once = true;
      this.grantXp(recipe.xp);
      this.grantSkill(recipe.skill, Math.round(recipe.xp * 0.6));
      this.advanceQuest('craft', recipe.id, 1);
      this.sfx(SFX.craftDone);
      this.haptic('success');
    }
    this.state.crafting = remaining;
  }

  private updateDiscoveries() {
    if (this.runtime.discoverCooldown > 0) return;
    for (const poi of POIS) {
      if (this.state.discoveries.includes(poi.id)) continue;
      if (DIST(this.state.player.x, this.state.player.z, poi.x, poi.z) > poi.radius) continue;
      if (poi.locked) continue;
      this.discoverPoi(poi.id);
      this.runtime.discoverCooldown = 1.5;
      break;
    }
    const gate = POIS.find((p) => p.id === 'silent_gate');
    if (
      gate &&
      this.runtime.gateNoticeCooldown <= 0 &&
      DIST(this.state.player.x, this.state.player.z, gate.x, gate.z) < gate.radius
    ) {
      this.runtime.gateNoticeCooldown = 45;
      this.toast('info', 'poi.silent_gate.blocked');
      this.sfx(SFX.error);
    }
  }

  private discoverPoi(poiId: string) {
    const poi = POIS.find((p) => p.id === poiId);
    if (!poi || this.state.discoveries.includes(poiId)) return;
    this.state.discoveries.push(poiId);
    const xp = Math.round(poi.xp * skillBonus.discoveryXp(this.state.player.skills.exploration));
    this.grantXp(xp);
    this.grantSkill('exploration', Math.round(poi.xp * 0.5));
    this.emit({ type: 'discovery', poiId });
    this.toast('story', 'toast.discovery', { name: poi.nameKey });
    this.sfx(SFX.quest);
    this.haptic('success');
    this.advanceQuest('discover', poiId, 1);
    if (poi.storyEntry) this.unlockStory(poi.storyEntry);
    this.requestSave();
  }

  private updateQuestPassive() {
    if (this.state.flags.recording_recovered && this.state.quest.activeStep === 'return_home') {
      const dist = DIST(this.state.player.x, this.state.player.z, REGION.camp.x, REGION.camp.z);
      if (dist < 10 && !this.runtime.gather) this.advanceQuest('return_home', undefined, 1);
    }
  }

  private updateGoals(dt: number) {
    this.runtime.goalTimer -= dt;
    if (this.runtime.goalTimer > 0) return;
    this.runtime.goalTimer = 2;
    const next = nextGoal(this.state);
    if (!next) return;
    if (next.progress.current < next.progress.target) return;
    const { goal } = next;
    this.state.flags[goalFlag(goal.id)] = true;
    this.grantXp(goal.rewardXp);
    if (goal.rewardItems) {
      for (const [id, qty] of Object.entries(goal.rewardItems)) this.giveItem(id, qty, false);
    }
    this.toast('story', 'toast.goal_complete', { goal: goal.titleKey });
    this.sfx(SFX.quest);
    this.haptic('success');
    this.requestSave();
  }

  private updateAutosave(dt: number) {
    this.runtime.autosaveIn -= dt;
    if (this.runtime.autosaveIn <= 0) {
      this.runtime.autosaveIn = AUTOSAVE_SECONDS;
      this.requestSave();
    }
  }

  private updateThreat(dt: number) {
    const p = this.state.player;
    const night = isNight(this.state.minutes);
    const campDist = DIST(p.x, p.z, REGION.camp.x, REGION.camp.z);
    const torch = this.state.player.equipped === 'torch';

    if (this.runtime.threat) {
      const t = this.runtime.threat;
      t.cooldown = Math.max(0, t.cooldown - dt);
      const dist = DIST(p.x, p.z, t.x, t.z);

      if (THREAT.despawnAtDawn && !night) {
        this.runtime.threat = null;
        this.toast('info', 'threat.retreats');
      } else {
        let mode: ThreatRuntime['mode'] = 'prowl';
        if (torch && dist < THREAT.torchFearRange) mode = 'flee';
        else if (dist < THREAT.detectRange) mode = 'chase';
        t.mode = mode;

        const speed = mode === 'chase' ? THREAT.chaseSpeed : mode === 'flee' ? THREAT.fleeSpeed : THREAT.prowlSpeed;
        let dirX = p.x - t.x;
        let dirZ = p.z - t.z;
        if (mode === 'flee') {
          dirX = -dirX;
          dirZ = -dirZ;
        }
        const len = Math.hypot(dirX, dirZ) || 1;
        let nx = t.x + (dirX / len) * speed * dt;
        let nz = t.z + (dirZ / len) * speed * dt;

        // The homestead is a safe zone: predators refuse to cross the boundary.
        if (mode !== 'flee' && campDist < CAMP_RADIUS + 2) {
          const dx = nx - REGION.camp.x;
          const dz = nz - REGION.camp.z;
          const d = Math.hypot(dx, dz) || 1;
          if (d < CAMP_RADIUS + 2) {
            nx = REGION.camp.x + (dx / d) * (CAMP_RADIUS + 2);
            nz = REGION.camp.z + (dz / d) * (CAMP_RADIUS + 2);
          }
        }
        t.x = nx;
        t.z = nz;

        if (mode === 'chase' && dist < THREAT.attackRange && t.cooldown <= 0) {
          t.cooldown = THREAT.attackCooldown;
          this.damagePlayer(THREAT.attackDamage);
        }
        if (mode === 'prowl' && dist > THREAT.loseRange + 12) {
          this.runtime.threat = null;
        }
      }
    } else if (
      this.state.flags.nightfall &&
      night &&
      this.runtime.defeatedOnDay !== this.dayNumber() &&
      campDist > CAMP_RADIUS + 3
    ) {
      this.spawnThreat();
    }
  }

  private spawnThreat() {
    const p = this.state.player;
    const angle = Math.random() * Math.PI * 2;
    let x = p.x + Math.cos(angle) * THREAT.spawnDistance;
    let z = p.z + Math.sin(angle) * THREAT.spawnDistance;
    const dist = Math.hypot(x, z);
    if (dist > REGION.playRadius - 4) {
      const k = (REGION.playRadius - 6) / dist;
      x *= k;
      z *= k;
    }
    this.runtime.threat = {
      x,
      z,
      health: THREAT.maxHealth,
      mode: 'prowl',
      cooldown: 1.5,
      id: Date.now(),
      spawnedAt: this.state.minutes,
    };
    this.toast('warn', 'threat.spotted');
    this.sfx(SFX.growl);
    this.haptic('warning');
  }

  private damagePlayer(amount: number) {
    this.state.player.health = Math.max(0, this.state.player.health - amount);
    this.runtime.sinceDamage = 0;
    this.runtime.damageFlash = 1;
    this.sfx(SFX.hurt);
    this.haptic('heavy');
    if (this.state.player.health <= 0) this.collapse();
  }

  private collapse() {
    if (this.state.player.health > 0) return;
    const p = this.state.player;
    p.health = 50;
    p.hunger = Math.max(35, p.hunger);
    p.thirst = Math.max(35, p.thirst);
    p.stamina = 60;
    p.x = REGION.spawn.x;
    p.z = REGION.spawn.z;
    this.state.minutes += 45;
    this.state.stats.collapses += 1;
    this.runtime.threat = null;
    this.runtime.gather = null;
    this.runtime.sinceDamage = 0;
    this.emit({ type: 'collapse' });
    this.toast('warn', 'toast.collapsed');
    this.sfx(SFX.sleep);
    this.requestSave();
  }

  dayNumber(): number {
    return Math.floor(this.state.minutes / MINUTES_PER_DAY) + 1;
  }

  private updateGather(dt: number, input: TickInput) {
    const action = this.runtime.gather;
    if (!action) return;
    const node = this.nodes.find((n) => n.id === action.nodeId);
    if (!node) {
      this.cancelGather();
      return;
    }
    const dist = DIST(this.state.player.x, this.state.player.z, node.x, node.z);
    if (dist > GATHER_LIMIT || !this.runtime.heldInteract) {
      this.cancelGather();
      this.recomputeInteraction();
      return;
    }
    const tool = this.equippedTool();
    const matches = tool && node.toolKind && tool.kind === node.toolKind;
    action.duration = matches ? GATHER_DURATION[node.kind].tool : GATHER_DURATION[node.kind].base;
    action.elapsed += dt * (matches ? 1.18 : 1);
    const cfg = GATHER_DURATION[node.kind];
    if (action.elapsed >= 0.0001 && cfg.sfx && action.elapsed < action.duration) {
      // playback pulse per action is handled on completion; keeps audio clean
    }
    if (action.elapsed >= action.duration) {
      action.elapsed = 0;
      this.completeGather(node);
      if (!action.repeat) this.cancelGather();
    }
    void input;
  }

  private completeGather(node: HarvestNode) {
    const st = this.nodeState(node.id);
    if (st.charges <= 0 && node.kind !== 'water') {
      this.cancelGather();
      this.recomputeInteraction();
      return;
    }
    const tool = this.equippedTool();
    const matching = tool && node.toolKind && tool.kind === node.toolKind;
    const toolBonus = matching ? tool.gatherBonus : 1;
    const noToolPenalty = node.toolKind && !matching ? 0.6 : 1;
    const skill = skillBonus.gather(this.state.player.skills.gathering);

    const yields = node.yields.map((y) => ({
      id: y.id,
      qty: Math.max(1, Math.round(y.qty * toolBonus * noToolPenalty * skill * (0.85 + Math.random() * 0.3))),
    }));

    // Make sure everything fits before consuming the node charge.
    let probe = this.state.inventory;
    for (const y of yields) {
      const test = addItem(probe, y.id, y.qty);
      if (test.overflow) {
        this.toast('warn', 'toast.inventory_full');
        this.sfx(SFX.error);
        this.cancelGather();
        return;
      }
      probe = test.inventory;
    }

    this.state.inventory = probe;
    let gathered = 0;
    for (const y of yields) {
      const def = itemDef(y.id);
      this.toast('gain', 'toast.item_gained', { qty: y.qty, item: def.nameKey }, def.icon);
      this.state.stats.itemsGathered += y.qty;
      gathered += y.qty;
      this.advanceQuest('collect', y.id, y.qty);
      if (y.id === 'damaged_recorder') {
        this.advanceQuest('recover', y.id, y.qty);
        this.state.flags.recorder_found = true;
      }
    }
    this.grantXp(3 + gathered * 3);
    this.grantSkill('gathering', 4 + gathered * 2);
    const cfg = GATHER_DURATION[node.kind];
    this.sfx(cfg.sfx);
    this.haptic(node.kind === 'tree' || node.kind === 'rock' ? 'medium' : 'light');
    if (node.kind === 'water') {
      this.runtime.interactCooldownUntil = this.state.minutes + 2;
    } else {
      this.state.nodes[node.id] = {
        charges: Math.max(0, st.charges - 1),
        respawnAt: st.charges - 1 <= 0 ? this.state.minutes + node.respawnMinutes : 0,
      };
    }
    this.runtime.nodeRevision += 1;
    this.runtime.impact = { x: node.x, z: node.z, kind: node.kind, at: Date.now() };
    void gathered;
  }

  // ── Interactions ────────────────────────────────────────────────────────

  private recomputeInteraction() {
    const p = this.state.player;
    let best: InteractionTarget | null = null;
    const consider = (t: InteractionTarget) => {
      if (!best || t.distance < best.distance) best = t;
    };

    for (const node of this.nodes) {
      const st = this.nodeState(node.id);
      if (st.charges <= 0 && node.kind !== 'water') continue;
      if (node.kind === 'water' && this.runtime.interactCooldownUntil && this.state.minutes < this.runtime.interactCooldownUntil) {
        continue;
      }
      const dist = DIST(p.x, p.z, node.x, node.z);
      if (dist > INTERACT_RANGE) continue;
      if (!this.hasLineOfSight(node.x, node.z)) continue;
      const cfg = GATHER_DURATION[node.kind];
      const tool = this.equippedTool();
      const matches = tool && node.toolKind && tool.kind === node.toolKind;
      const label = matches ? TOOL_LABEL[tool.kind] ?? cfg.label : cfg.label;
      consider({ id: node.id, kind: 'gather', nodeId: node.id, labelKey: label, distance: dist });
    }

    for (const s of this.state.structures) {
      const def = STRUCTURES[s.defId];
      if (!def) continue;
      const dist = DIST(p.x, p.z, s.x, s.z);
      if (dist > 4.6) continue;
      if (def.station === 'campfire') {
        consider({ id: s.id, kind: 'campfire', structureId: s.id, labelKey: 'interact.cook', distance: dist });
      } else if (def.station === 'workbench') {
        consider({ id: s.id, kind: 'workbench', structureId: s.id, labelKey: 'interact.craft', distance: dist });
      } else if (def.storageSlots) {
        consider({ id: s.id, kind: 'storage', structureId: s.id, labelKey: 'interact.storage', distance: dist });
      } else if (def.shelter) {
        consider({ id: s.id, kind: 'shelter', structureId: s.id, labelKey: 'interact.rest', distance: dist });
      }
      if (def.production && (s.pending ?? 0) > 0) {
        consider({ id: `${s.id}:collect`, kind: 'collect', structureId: s.id, labelKey: 'interact.collect', distance: dist });
      }
    }

    // Starter bedroll (always available) so a new player can rest and save.
    const bedDist = DIST(p.x, p.z, 1.8, -2.4);
    if (bedDist < 3.4) {
      consider({ id: 'bedroll', kind: 'sleep', labelKey: 'interact.sleep', distance: bedDist + 0.1 });
    }

    const gate = POIS.find((p2) => p2.id === 'silent_gate');
    if (gate) {
      const dist = DIST(p.x, p.z, gate.x, gate.z);
      if (dist < gate.radius) consider({ id: gate.id, kind: 'gate', poiId: gate.id, labelKey: 'interact.inspect', distance: dist });
    }

    this.runtime.interaction = best;
  }

  private hasLineOfSight(tx: number, tz: number): boolean {
    const p = this.state.player;
    const dx = tx - p.x;
    const dz = tz - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.2) return true;
    const steps = Math.ceil(dist / 0.6);
    const blocks: StaticObstacle[] = [
      { x: 34, z: -38, radius: 2.2 },
      ...this.state.structures
        .filter((s) => STRUCTURES[s.defId]?.shelter)
        .map((s) => ({ x: s.x, z: s.z, radius: (STRUCTURES[s.defId]?.radius ?? 1) * 0.8 })),
    ];
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = p.x + dx * t;
      const z = p.z + dz * t;
      for (const b of blocks) {
        if (Math.hypot(x - b.x, z - b.z) < b.radius * 0.55) return false;
      }
    }
    return true;
  }

  pressInteract(): InteractionTarget | null {
    this.runtime.heldInteract = true;
    const target = this.runtime.interaction;
    if (!target) return null;
    if (target.kind === 'gather' && target.nodeId) {
      const node = this.nodes.find((n) => n.id === target.nodeId);
      if (!node) return null;
      this.state.player.facing = Math.atan2(node.x - this.state.player.x, -(node.z - this.state.player.z));
      this.runtime.gather = {
        nodeId: node.id,
        elapsed: 0,
        duration: GATHER_DURATION[node.kind].base,
        labelKey: target.labelKey,
        repeat: true,
      };
      this.sfx('ui_tap');
      return target;
    }
    if (target.kind === 'sleep') {
      this.sleep();
      this.runtime.heldInteract = false;
      return target;
    }
    if (target.kind === 'collect' && target.structureId) {
      this.collectStructure(target.structureId);
      this.runtime.heldInteract = false;
      return target;
    }
    this.sfx(SFX.uiTap);
    return target;
  }

  releaseInteract() {
    this.runtime.heldInteract = false;
    this.cancelGather();
  }

  private cancelGather() {
    if (this.runtime.gather) this.runtime.gather = null;
  }

  /** Returns the production units collected into the inventory. */
  collectStructure(id: string): number {
    const s = this.state.structures.find((st) => st.id === id);
    if (!s) return 0;
    const def = STRUCTURES[s.defId];
    if (!def?.production) return 0;
    const pending = s.pending ?? 0;
    if (pending <= 0) {
      this.toast('info', 'toast.nothing_ready');
      return 0;
    }
    const res = addItem(this.state.inventory, def.production.itemId, pending);
    if (res.added <= 0) {
      this.toast('warn', 'toast.inventory_full');
      return 0;
    }
    this.state.inventory = res.inventory;
    s.pending = pending - res.added;
    const item = itemDef(def.production.itemId);
    this.toast('gain', 'toast.item_gained', { qty: res.added, item: item.nameKey }, item.icon);
    this.advanceQuest('collect', def.production.itemId, res.added);
    this.sfx(SFX.pickup);
    this.haptic('light');
    return res.added;
  }

  // ── Inventory actions ───────────────────────────────────────────────────

  useItem(itemId: string): boolean {
    const def = ITEMS[itemId];
    if (!def) return false;
    if (countItem(this.state.inventory, itemId) <= 0) return false;

    if (def.carryBonus) {
      if (this.state.inventory.size >= 24 + 16) {
        this.toast('info', 'toast.capacity_max');
        return false;
      }
      this.state.inventory = resizeInventory(
        removeItem(this.state.inventory, itemId, 1).inventory,
        this.state.inventory.size + def.carryBonus,
      );
      this.toast('story', 'toast.capacity_up', { slots: def.carryBonus });
      this.sfx(SFX.craftDone);
      this.haptic('success');
      return true;
    }

    if (def.category === 'tool') {
      return this.equip(itemId);
    }

    if (def.hunger || def.thirst || def.heal) {
      const p = this.state.player;
      if (p.hunger >= 99 && p.thirst >= 99 && p.health >= 99) {
        this.toast('info', 'toast.no_need');
        return false;
      }
      this.state.inventory = removeItem(this.state.inventory, itemId, 1).inventory;
      if (def.hunger) p.hunger = Math.min(100, p.hunger + def.hunger);
      if (def.thirst) p.thirst = Math.min(100, p.thirst + def.thirst);
      if (def.heal) p.health = Math.min(100, p.health + def.heal);
      if (def.healthCost) p.health = Math.max(1, p.health - def.healthCost);
      this.grantSkill('survival', 4);
      this.toast('gain', 'toast.item_used', { item: def.nameKey }, def.icon);
      this.sfx('consume');
      this.haptic('light');
      return true;
    }

    this.toast('info', 'toast.cannot_use');
    return false;
  }

  equip(itemId: string): boolean {
    const def = ITEMS[itemId];
    if (!def?.tool) {
      this.toast('warn', 'toast.not_equippable');
      return false;
    }
    if (countItem(this.state.inventory, itemId) <= 0) return false;
    this.state.player.equipped = this.state.player.equipped === itemId ? null : itemId;
    this.sfx('equip');
    this.haptic('light');
    return true;
  }

  dropItem(itemId: string, qty: number): boolean {
    const result = removeItem(this.state.inventory, itemId, qty);
    if (result.removed <= 0) return false;
    this.state.inventory = result.inventory;
    if (this.state.player.equipped === itemId && countItem(this.state.inventory, itemId) <= 0) {
      this.state.player.equipped = null;
    }
    this.toast('info', 'toast.item_dropped', { qty: result.removed, item: itemDef(itemId).nameKey });
    this.sfx(SFX.uiTap);
    return true;
  }

  // ── Crafting ────────────────────────────────────────────────────────────

  craft(recipeId: string): boolean {
    const recipe = RECIPES[recipeId];
    if (!recipe) return false;
    if (this.state.crafting.length >= CRAFT_QUEUE_LIMIT) {
      this.toast('warn', 'toast.queue_full');
      this.sfx(SFX.error);
      return false;
    }
    if (recipe.station !== 'handcraft' && !this.stationInRange(recipe.station)) {
      this.toast('warn', 'toast.need_station', { station: `station.${recipe.station}` });
      this.sfx(SFX.error);
      return false;
    }
    const missing = missingItems(this.state.inventory, recipe.inputs);
    if (Object.keys(missing).length > 0) {
      this.toast('warn', 'toast.missing_items');
      this.sfx(SFX.error);
      return false;
    }
    // Fail early if the outputs cannot fit.
    let probe = this.state.inventory;
    for (const [id, qty] of Object.entries(recipe.outputs)) {
      const test = addItem(probe, id, qty);
      if (test.overflow) {
        this.toast('warn', 'toast.inventory_full');
        this.sfx(SFX.error);
        return false;
      }
      probe = test.inventory;
    }
    const next = consumeItems(this.state.inventory, recipe.inputs);
    if (!next) return false;
    this.state.inventory = next;
    const duration =
      recipe.durationSeconds *
      skillBonus.craftTime(this.state.player.skills.crafting) /
      (this.stationInRange('workbench') ? 1.15 : 1);
    this.state.crafting.push({
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      recipeId,
      startedAt: this.state.minutes,
      endsAt: this.state.minutes + Math.max(0.02, duration * MINUTES_PER_SECOND),
    });
    this.sfx(SFX.craft);
    this.haptic('medium');
    return true;
  }

  cancelCraft(jobId: string): boolean {
    const index = this.state.crafting.findIndex((j) => j.id === jobId);
    if (index < 0) return false;
    const job = this.state.crafting[index];
    if (!job) return false;
    const recipe = RECIPES[job.recipeId];
    if (!recipe) return false;
    this.state.crafting.splice(index, 1);
    for (const [id, qty] of Object.entries(recipe.inputs)) {
      this.state.inventory = addItem(this.state.inventory, id, qty).inventory;
    }
    this.toast('info', 'toast.craft_cancelled');
    this.sfx(SFX.uiClose);
    return true;
  }

  // ── Building ────────────────────────────────────────────────────────────

  setBuildMode(defId: string | null) {
    if (!defId) {
      this.runtime.build = null;
      return;
    }
    const def = STRUCTURES[defId];
    if (!def) return;
    const p = this.state.player;
    const yaw = this.runtime.lastCameraYaw;
    const gx = p.x - Math.sin(yaw) * 4.2;
    const gz = p.z - Math.cos(yaw) * 4.2;
    const snapped = snapToGrid(gx, gz, def.radius > 2 ? BUILD_CELL * 2 : BUILD_CELL);
    this.runtime.build = { defId, x: snapped.x, z: snapped.z, rot: 0 };
  }

  moveBuildGhost(dx: number, dz: number) {
    if (!this.runtime.build) return;
    const b = this.runtime.build;
    const def = STRUCTURES[b.defId];
    const cell = (def?.radius ?? 1) > 2 ? BUILD_CELL * 2 : BUILD_CELL;
    const snapped = snapToGrid(b.x + dx, b.z + dz, cell);
    b.x = snapped.x;
    b.z = snapped.z;
  }

  rotateBuildGhost() {
    if (!this.runtime.build) return;
    this.runtime.build.rot = normalizeRotation(this.runtime.build.rot + 1);
    this.sfx(SFX.uiTap);
  }

  private validateBuild(defId: string, x: number, z: number, rot: number): BuildGhost {
    const def = STRUCTURES[defId];
    const placement: PlacementResult = validatePlacement(defId, x, z, rot, {
      structures: this.state.structures,
      obstacles: this.obstacles(),
    });
    return {
      defId,
      x: placement.x,
      y: placement.y,
      z: placement.z,
      rot,
      valid: placement.valid,
      reason: placement.reason,
      cost: def?.cost ?? {},
      affordable: def ? hasItems(this.state.inventory, def.cost) : false,
    };
  }

  confirmBuild(): boolean {
    const b = this.runtime.build;
    if (!b) return false;
    const def = STRUCTURES[b.defId];
    if (!def) return false;
    const ghost = this.validateBuild(b.defId, b.x, b.z, b.rot);
    if (!ghost.valid) {
      this.toast('warn', `build.invalid.${ghost.reason}`);
      this.sfx(SFX.error);
      return false;
    }
    if (!hasItems(this.state.inventory, def.cost)) {
      this.toast('warn', 'toast.missing_items');
      this.sfx(SFX.error);
      return false;
    }
    const next = consumeItems(this.state.inventory, def.cost);
    if (!next) return false;
    this.state.inventory = next;
    const structure: StructureInstance = {
      id: `s_${this.state.nextStructureId}`,
      defId: def.id,
      x: ghost.x,
      z: ghost.z,
      rot: b.rot,
      builtAt: this.state.minutes,
    };
    if (def.production) {
      structure.pending = 0;
      structure.readyAt = this.state.minutes + def.production.minutes;
    }
    this.state.nextStructureId += 1;
    this.state.structures.push(structure);
    if (def.storageSlots) {
      const target = Math.min(MAX_STORAGE_SLOTS, this.state.storageSlots + def.storageSlots);
      if (target > this.state.storageSlots) {
        this.state.storage = resizeInventory(this.state.storage, target);
        this.state.storageSlots = target;
      }
    }
    this.runtime.obstacleCache = null;
    this.runtime.impact = { x: structure.x, z: structure.z, kind: 'build', at: Date.now() };
    this.state.stats.structuresBuilt += 1;
    this.grantXp(45);
    this.grantSkill('crafting', 25);
    this.advanceQuest('build', def.id, 1);
    this.toast('story', 'toast.structure_built', { name: def.nameKey });
    this.sfx(SFX.build);
    this.haptic('success');
    this.requestSave();
    if (def.unique) this.runtime.build = null;
    return true;
  }

  removeStructure(structureId: string): boolean {
    const index = this.state.structures.findIndex((s) => s.id === structureId);
    if (index < 0) return false;
    const [structure] = this.state.structures.splice(index, 1);
    if (!structure) return false;
    const refund = refundFor(structure.defId);
    for (const [id, qty] of Object.entries(refund)) {
      this.state.inventory = addItem(this.state.inventory, id, qty).inventory;
    }
    this.runtime.obstacleCache = null;
    this.toast('info', 'toast.structure_removed', { name: STRUCTURES[structure.defId]?.nameKey ?? structure.defId });
    this.sfx(SFX.uiClose);
    this.requestSave();
    return true;
  }

  // ── Storage ─────────────────────────────────────────────────────────────

  deposit(itemId: string, qty: number): boolean {
    if (this.state.storageSlots <= 0) return false;
    const res = removeItem(this.state.inventory, itemId, qty);
    if (res.removed <= 0) return false;
    const stored = addItem(this.state.storage, itemId, res.removed);
    this.state.inventory = addItem(this.state.inventory, itemId, res.removed - stored.added).inventory;
    this.state.storage = stored.inventory;
    if (stored.added <= 0) {
      this.toast('warn', 'toast.storage_full');
      return false;
    }
    this.sfx(SFX.uiTap);
    return true;
  }

  withdraw(itemId: string, qty: number): boolean {
    const res = removeItem(this.state.storage, itemId, qty);
    if (res.removed <= 0) return false;
    const added = addItem(this.state.inventory, itemId, res.removed);
    this.state.storage = addItem(this.state.storage, itemId, res.removed - added.added).inventory;
    this.state.inventory = added.inventory;
    if (added.added <= 0) {
      this.toast('warn', 'toast.inventory_full');
      return false;
    }
    this.sfx(SFX.uiTap);
    return true;
  }

  // ── Rest ────────────────────────────────────────────────────────────────

  canSleep(): boolean {
    return true;
  }

  sleep() {
    const p = this.state.player;
    const before = this.state.minutes;
    const rem = before % MINUTES_PER_DAY;
    let target = Math.floor(before / MINUTES_PER_DAY) * MINUTES_PER_DAY + 6.5 * 60;
    if (rem >= 6.5 * 60 && rem < 19 * 60) target += MINUTES_PER_DAY;
    const skippedMinutes = target - before;
    this.state.minutes = target;
    p.health = Math.min(100, p.health + 35);
    p.hunger = Math.max(p.hunger, 70);
    p.thirst = Math.max(p.thirst, 70);
    p.stamina = 100;
    this.runtime.threat = null;
    this.state.stats.nightsSurvived += 1;
    this.toast('story', 'toast.slept', { hours: Math.round(skippedMinutes / 60) });
    this.sfx(SFX.sleep);
    this.haptic('success');
    this.requestSave();
  }

  // ── Combat ──────────────────────────────────────────────────────────────

  attack(): boolean {
    if (this.runtime.attackCooldown > 0) return false;
    this.runtime.attackCooldown = 0.55;
    this.runtime.attackFlash = 1;
    const p = this.state.player;
    const tool = this.equippedTool();
    const base = tool?.damage ?? 7;
    const damage = base * skillBonus.damage(this.state.player.skills.combat);
    const t = this.runtime.threat;
    if (t) {
      const dist = DIST(p.x, p.z, t.x, t.z);
      const targetAngle = Math.atan2(t.x - p.x, -(t.z - p.z));
      if (dist < 4.2) p.facing = targetAngle;
      const delta = Math.abs((((targetAngle - p.facing + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
      if (dist < 3.8 && delta < 1.5) {
        t.health -= damage;
        this.runtime.impact = { x: t.x, z: t.z, kind: 'hit', at: Date.now() };
        this.grantSkill('combat', 5);
        this.grantXp(4);
        this.sfx(SFX.hit);
        this.haptic('medium');
        const dx = t.x - p.x;
        const dz = t.z - p.z;
        const len = Math.hypot(dx, dz) || 1;
        t.x += (dx / len) * 0.9;
        t.z += (dz / len) * 0.9;
        if (t.health <= 0) this.driveOffThreat();
        return true;
      }
    }
    // Swinging at nothing still costs a little stamina for feedback parity.
    p.stamina = Math.max(0, p.stamina - 1.5);
    this.sfx('swing', 0.5);
    return false;
  }

  private driveOffThreat() {
    this.runtime.threat = null;
    this.runtime.defeatedOnDay = this.dayNumber();
    this.state.stats.threatsDrivenOff += 1;
    this.grantXp(90);
    this.grantSkill('combat', 40);
    this.giveItem('scrap_metal', 2, false);
    this.toast('story', 'threat.driven_off');
    this.sfx(SFX.quest);
    this.haptic('success');
    this.emit({ type: 'threat:driven-off' });
    this.advanceQuest('drive_off', 'stalker', 1);
    this.requestSave();
  }

  // ── Tutorial ────────────────────────────────────────────────────────────

  dismissTutorialHint() {
    this.state.tutorial.step += 1;
    this.emit({ type: 'tutorial:updated', step: this.state.tutorial.step });
    this.requestSave();
  }

  skipTutorial() {
    this.state.tutorial.skipped = true;
    this.state.tutorial.step = 99;
    this.requestSave();
  }

  replayTutorial() {
    this.state.tutorial = { step: 0, completed: false, skipped: false };
    this.requestSave();
  }

  // ── Snapshot ────────────────────────────────────────────────────────────

  snapshot(): GameSnapshot {
    const clock = clockParts(this.state.minutes);
    const interaction = this.runtime.interaction;
    const action = this.runtime.gather;
    const threat = this.runtime.threat;
    return {
      minutes: this.state.minutes,
      day: clock.day,
      timeOfDay: clock.timeOfDay,
      player: { ...this.state.player, skills: { ...this.state.player.skills }, skillXp: { ...this.state.player.skillXp } },
      inventory: cloneInventory(this.state.inventory),
      storage: cloneInventory(this.state.storage),
      storageSlots: this.state.storageSlots,
      structures: this.state.structures.map((s) => ({ ...s })),
      quest: {
        ...this.state.quest,
        completed: [...this.state.quest.completed],
        progress: { ...this.state.quest.progress },
      },
      goal: (() => {
        const next = nextGoal(this.state);
        return next
          ? {
              id: next.goal.id,
              titleKey: next.goal.titleKey,
              descKey: next.goal.descKey,
              current: next.progress.current,
              target: next.progress.target,
            }
          : null;
      })(),
      discoveries: [...this.state.discoveries],
      story: [...this.state.story],
      tutorial: { ...this.state.tutorial },
      flags: { ...this.state.flags },
      stats: { ...this.state.stats },
      crafting: this.state.crafting.map((j) => ({ ...j })),
      interaction: interaction ? { ...interaction } : null,
      action: action
        ? { labelKey: action.labelKey, progress: Math.min(1, action.elapsed / action.duration), active: true }
        : interaction?.kind === 'gather'
          ? { labelKey: interaction.labelKey, progress: 0, active: false }
          : null,
      threat: threat
        ? {
            active: true,
            x: threat.x,
            z: threat.z,
            distance: DIST(this.state.player.x, this.state.player.z, threat.x, threat.z),
            health: Math.max(0, threat.health),
            maxHealth: THREAT.maxHealth,
            mode: threat.mode,
          }
        : null,
      build: this.getBuildGhost(),
      station: {
        campfire: this.stationInRange('campfire'),
        workbench: this.stationInRange('workbench'),
      },
      damageFlash: this.runtime.damageFlash,
      attackFlash: this.runtime.attackFlash,
      equipped: this.state.player.equipped,
      cameraYaw: this.runtime.lastCameraYaw,
      capacity: this.state.inventory.size,
      canSleep: this.canSleep(),
      autosaveAt: this.runtime.autosaveIn,
      playing: true,
    };
  }

  get nodeRevision(): number {
    return this.runtime.nodeRevision;
  }

  toSave(): GameSave {
    return {
      ...this.state,
      savedAt: Date.now(),
      player: { ...this.state.player },
      inventory: cloneInventory(this.state.inventory),
      storage: cloneInventory(this.state.storage),
      structures: this.state.structures.map((s) => ({ ...s })),
      nodes: { ...this.state.nodes },
      quest: { ...this.state.quest },
      crafting: this.state.crafting.map((j) => ({ ...j })),
    };
  }

  // Missing type shims for TS strictness.
  getFreeSlots(): number {
    return freeSlots(this.state.inventory);
  }

  totalOf(itemId: string): number {
    return countItem(this.state.inventory, itemId);
  }

  skillProgress(skill: keyof PlayerSave['skills']): { level: number; xp: number; needed: number } {
    return {
      level: this.state.player.skills[skill],
      xp: this.state.player.skillXp[skill],
      needed: skillXpForNext(this.state.player.skills[skill]),
    };
  }

  /** Debug/testing helper used by unit tests. */
  debugAddItem(id: string, qty: number) {
    this.state.inventory = addItem(this.state.inventory, id, qty).inventory;
  }

  debugSetMinutes(m: number) {
    this.state.minutes = m;
  }

  /** True when the active quest step is complete but not yet advanced. */
  stepReady(): boolean {
    const step = this.state.quest.activeStep ? questStep(this.state.quest.activeStep) : null;
    return Boolean(step && isStepComplete(this.state.quest, step));
  }

  tutorialHintKey(): string | null {
    if (this.state.tutorial.skipped) return null;
    const step = this.state.quest.activeStep ? questStep(this.state.quest.activeStep) : null;
    return step?.hintKey ?? null;
  }
}

const GATHER_LIMIT = 4.6;

function lerpAngle(from: number, to: number, t: number): number {
  let delta = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}

export { makeStats };
