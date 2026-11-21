import { create } from 'zustand';
import type { GameEvent, GameSave, GraphicsQuality } from '../game/types';
import { GameEngine, isNight, type GameSnapshot } from '../game/engine/GameEngine';
import { getEngine, setEngine } from '../game/runtime/session';
import { QUEST_STEPS, questStep } from '../data/quests';
import { audio } from '../services/audio/audio';
import { haptic } from '../services/haptics';
import { translate } from '../i18n';
import { ensureSaveService } from '../services/storage';
import { useSettings } from './settingsStore';
import { resetInput } from '../game/runtime/input';

export type Panel =
  | 'none'
  | 'inventory'
  | 'craft'
  | 'build'
  | 'map'
  | 'journal'
  | 'character'
  | 'settings'
  | 'pause'
  | 'storage'
  | 'story'
  | 'credits';

export type Phase = 'boot' | 'menu' | 'game';

export interface ToastItem {
  id: number;
  kind: 'gain' | 'info' | 'warn' | 'error' | 'story';
  text: string;
  icon?: string;
  createdAt: number;
}

export interface SaveInfo {
  exists: boolean;
  savedAt: number;
  playtimeMinutes: number;
  level: number;
  chapterTitleKey: string;
  chapterComplete: boolean;
  questCompleted: number;
  recovered: boolean;
}

export interface SessionState {
  phase: Phase;
  snapshot: GameSnapshot | null;
  saveInfo: SaveInfo;
  panel: Panel;
  panelData: string | null;
  storageId: string | null;
  toasts: ToastItem[];
  collapse: boolean;
  chapterComplete: boolean;
  saving: boolean;
  savePulse: boolean;
  tutorialVisible: boolean;
  rendererFailed: boolean;
  fatalError: string | null;

  boot: () => Promise<void>;
  startNew: () => Promise<void>;
  continueGame: () => Promise<void>;
  quitToMenu: () => Promise<void>;
  sync: () => void;
  saveNow: (reason?: 'auto' | 'manual' | 'exit') => Promise<void>;

  openPanel: (panel: Panel, data?: string | null) => void;
  closePanel: () => void;
  dismissToast: (id: number) => void;
  dismissTutorial: () => void;
  skipTutorial: () => void;

  startBuild: (defId?: string) => void;
  selectBuild: (defId: string) => void;
  moveGhost: (dx: number, dz: number) => void;
  rotateGhost: () => void;
  confirmBuild: () => void;
  removeStructure: (id: string) => void;

  consumeItem: (id: string) => void;
  equip: (id: string) => void;
  dropItem: (id: string, qty: number) => void;
  sortInventory: () => void;
  craft: (recipeId: string) => void;
  cancelCraft: (jobId: string) => void;
  collectStructure: (id: string) => void;
  deposit: (id: string, qty: number) => void;
  withdraw: (id: string, qty: number) => void;
  sleep: () => void;
  attack: () => void;

  acknowledgeCollapse: () => void;
  acknowledgeChapter: () => void;
  resetJourney: () => Promise<void>;
  replayTutorial: () => void;
  setGraphics: (quality: GraphicsQuality) => void;
  markTutorialSeen: (step: number) => void;
  setRendererFailed: (failed: boolean) => void;
}

let toastSeq = 1;
let loadedSave: GameSave | null = null;
let syncTick = 0;

const emptyInfo: SaveInfo = {
  exists: false,
  savedAt: 0,
  playtimeMinutes: 0,
  level: 1,
  chapterTitleKey: 'quest.wake.title',
  chapterComplete: false,
  questCompleted: 0,
  recovered: false,
};

function infoFromSave(save: GameSave, recovered = false): SaveInfo {
  const active = save.quest.activeStep ? questStep(save.quest.activeStep) : null;
  return {
    exists: true,
    savedAt: save.savedAt || Date.now(),
    playtimeMinutes: save.stats.minutesPlayed / 60,
    level: save.player.level,
    chapterTitleKey: active?.titleKey ?? 'chapter.title',
    chapterComplete: save.quest.completed.includes('return_home'),
    questCompleted: save.quest.completed.length,
    recovered,
  };
}

function localeNow() {
  return useSettings.getState().locale;
}

function pushToast(
  toasts: ToastItem[],
  kind: ToastItem['kind'],
  text: string,
  icon?: string,
): ToastItem[] {
  const item: ToastItem = { id: toastSeq++, kind, text, icon, createdAt: Date.now() };
  const next = [...toasts, item].slice(-4);
  setTimeout(() => {
    useSession.setState((state) => ({ toasts: state.toasts.filter((t) => t.id !== item.id) }));
  }, 3200);
  return next;
}

export const useSession = create<SessionState>((set, get) => ({
  phase: 'boot',
  snapshot: null,
  saveInfo: emptyInfo,
  panel: 'none',
  panelData: null,
  storageId: null,
  toasts: [],
  collapse: false,
  chapterComplete: false,
  saving: false,
  savePulse: false,
  tutorialVisible: true,
  rendererFailed: false,
  fatalError: null,

  boot: async () => {
    const service = await ensureSaveService();
    const result = await service.load();
    loadedSave = result.save;
    const info = result.save ? infoFromSave(result.save, result.recovered) : emptyInfo;
    set({ phase: 'menu', saveInfo: info });
    audio.playMusic('menu');
    if (result.recovered) {
      set({ toasts: pushToast(get().toasts, 'info', translate(localeNow(), 'toast.save_recovered')) });
    }
  },

  startNew: async () => {
    resetInput();
    const engine = GameEngine.createNew();
    setEngine(engine);
    loadedSave = null;
    audio.playMusic('explore');
    audio.playAmbience(isNight(engine.minutes) ? 'night' : 'day');
    set({
      phase: 'game',
      panel: 'none',
      panelData: null,
      toasts: [],
      collapse: false,
      chapterComplete: false,
      snapshot: engine.snapshot(),
      saveInfo: infoFromSave(engine.state),
    });
    set({ toasts: pushToast(get().toasts, 'story', translate(localeNow(), 'intro.wake'), 'sunrise') });
    await get().saveNow('manual');
  },

  continueGame: async () => {
    let save = loadedSave;
    if (!save) {
      const service = await ensureSaveService();
      const result = await service.load();
      save = result.save;
      if (save) loadedSave = save;
    }
    if (!save) {
      await get().boot();
      return;
    }
    resetInput();
    const engine = new GameEngine(JSON.parse(JSON.stringify(save)) as GameSave);
    setEngine(engine);
    audio.playMusic('explore');
    audio.playAmbience(isNight(engine.minutes) ? 'night' : 'day');
    set({
      phase: 'game',
      panel: 'none',
      panelData: null,
      toasts: [],
      collapse: false,
      chapterComplete: false,
      snapshot: engine.snapshot(),
      saveInfo: infoFromSave(save),
    });
  },

  quitToMenu: async () => {
    await get().saveNow('exit');
    audio.playMusic('menu');
    audio.stopAmbience(0.5);
    setEngine(null);
    resetInput();
    const engineSnapshot = get().snapshot;
    const info = engineSnapshot
      ? { ...get().saveInfo, exists: true, savedAt: Date.now() }
      : get().saveInfo;
    void engineSnapshot;
    set({
      phase: 'menu',
      panel: 'none',
      snapshot: null,
      saveInfo: info,
      collapse: false,
      chapterComplete: false,
    });
  },

  sync: () => {
    const engine = getEngine();
    if (!engine || get().phase !== 'game') return;
    syncTick += 1;
    const snapshot = engine.snapshot();
    const events = engine.consumeEvents();
    set({ snapshot });
    audio.playAmbience(isNight(engine.minutes) ? 'night' : 'day');
    if (events.length > 0) {
      let toasts = get().toasts;
      for (const event of events) toasts = handleEvent(event, toasts, set);
      if (toasts !== get().toasts) set({ toasts });
    }
    if (engine.consumeSaveRequest() && !get().saving) {
      void get().saveNow('auto');
    }
    // Keep the save card meta reasonable without extra reads.
    if (syncTick % 40 === 0) {
      set({ saveInfo: infoFromSave(engine.state, get().saveInfo.recovered) });
    }
  },

  saveNow: async (reason = 'manual') => {
    const engine = getEngine();
    if (!engine) return;
    if (get().saving) return;
    set({ saving: true });
    const guard = setTimeout(() => {
      if (useSession.getState().saving) {
        useSession.setState({
          saving: false,
          toasts: pushToast(useSession.getState().toasts, 'error', translate(localeNow(), 'toast.save_failed')),
        });
      }
    }, 8000);
    try {
      const service = await ensureSaveService();
      const timeout = new Promise<{ ok: false; bytes: 0; error: string }>((resolve) =>
        setTimeout(() => resolve({ ok: false, bytes: 0, error: 'timeout' }), 6000),
      );
      const result = await Promise.race([service.save(engine.toSave()), timeout]);
      if (result.ok) {
        loadedSave = engine.toSave();
        set({
          saving: false,
          savePulse: true,
          saveInfo: infoFromSave(engine.state, get().saveInfo.recovered),
        });
        setTimeout(() => useSession.setState({ savePulse: false }), 900);
        if (reason === 'manual') {
          set({ toasts: pushToast(get().toasts, 'info', translate(localeNow(), 'toast.saved')) });
        }
      } else {
        set({
          saving: false,
          toasts: pushToast(get().toasts, 'error', translate(localeNow(), 'toast.save_failed')),
        });
      }
    } catch {
      set({
        saving: false,
        toasts: pushToast(get().toasts, 'error', translate(localeNow(), 'toast.save_failed')),
      });
    } finally {
      clearTimeout(guard);
    }
  },

  openPanel: (panel, data = null) => {
    if (panel === 'storage') set({ panel, storageId: data, panelData: data });
    else set({ panel, panelData: data });
    if (panel !== 'none') audio.playSfx('ui_open', 0.6);
    if (panel === 'pause') audio.playSfx('ui_open', 0.4);
  },

  closePanel: () => {
    const current = get().panel;
    if (current === 'build') getEngine()?.setBuildMode(null);
    set({ panel: 'none', panelData: null, storageId: null });
    audio.playSfx('ui_close', 0.55);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  dismissTutorial: () => {
    getEngine()?.dismissTutorialHint();
    audio.playSfx('ui_tap', 0.5);
    get().sync();
  },

  skipTutorial: () => {
    getEngine()?.skipTutorial();
    set({ toasts: pushToast(get().toasts, 'info', translate(localeNow(), 'toast.tutorial_skipped')) });
  },

  startBuild: (defId = 'campfire') => {
    const engine = getEngine();
    if (!engine) return;
    engine.setBuildMode(defId);
    set({ panel: 'build' });
    audio.playSfx('ui_open', 0.5);
  },

  selectBuild: (defId) => {
    getEngine()?.setBuildMode(defId);
    get().sync();
    audio.playSfx('ui_tap', 0.5);
  },

  moveGhost: (dx, dz) => {
    getEngine()?.moveBuildGhost(dx, dz);
  },

  rotateGhost: () => {
    getEngine()?.rotateBuildGhost();
    get().sync();
  },

  confirmBuild: () => {
    const engine = getEngine();
    if (!engine) return;
    const ok = engine.confirmBuild();
    if (ok) {
      // Keep build mode open for repeatable structures.
      const snapshot = engine.snapshot();
      const ghost = snapshot.build;
      if (!ghost) set({ panel: 'none' });
      get().sync();
    } else {
      get().sync();
    }
  },

  removeStructure: (id) => {
    getEngine()?.removeStructure(id);
    get().sync();
    void get().saveNow('manual');
  },

  consumeItem: (id) => {
    getEngine()?.useItem(id);
    get().sync();
  },
  equip: (id) => {
    getEngine()?.equip(id);
    get().sync();
  },
  dropItem: (id, qty) => {
    getEngine()?.dropItem(id, qty);
    get().sync();
  },
  sortInventory: () => {
    getEngine()?.sortInventory();
    get().sync();
  },
  craft: (recipeId) => {
    getEngine()?.craft(recipeId);
    get().sync();
  },
  cancelCraft: (jobId) => {
    getEngine()?.cancelCraft(jobId);
    get().sync();
  },
  collectStructure: (id) => {
    getEngine()?.collectStructure(id);
    get().sync();
  },
  deposit: (id, qty) => {
    getEngine()?.deposit(id, qty);
    get().sync();
  },
  withdraw: (id, qty) => {
    getEngine()?.withdraw(id, qty);
    get().sync();
  },
  sleep: () => {
    getEngine()?.sleep();
    set({ panel: 'none' });
    get().sync();
    audio.playSfx('sleep', 0.8);
    void get().saveNow('manual');
  },
  attack: () => {
    getEngine()?.attack();
  },

  acknowledgeCollapse: () => {
    set({ collapse: false });
    void get().saveNow('auto');
  },

  acknowledgeChapter: () => {
    set({ chapterComplete: false });
    void get().saveNow('manual');
  },

  resetJourney: async () => {
    const service = await ensureSaveService();
    await service.clear().catch(() => undefined);
    loadedSave = null;
    setEngine(null);
    resetInput();
    audio.playMusic('menu');
    audio.stopAmbience(0.3);
    set({
      phase: 'menu',
      panel: 'none',
      snapshot: null,
      collapse: false,
      chapterComplete: false,
      toasts: [],
      saveInfo: emptyInfo,
    });
  },

  replayTutorial: () => {
    const engine = getEngine();
    if (!engine) return;
    engine.replayTutorial();
    set({ tutorialVisible: true, toasts: pushToast(get().toasts, 'info', translate(localeNow(), 'settings.tutorial_done')) });
  },

  setGraphics: (quality) => {
    useSettings.getState().update({ graphics: quality });
  },

  markTutorialSeen: (step) => {
    void step;
  },

  setRendererFailed: (failed) => {
    if (get().rendererFailed !== failed) set({ rendererFailed: failed });
  },
}));

function handleEvent(
  event: GameEvent,
  toasts: ToastItem[],
  set: (partial: Partial<SessionState>) => void,
): ToastItem[] {
  const locale = localeNow();
  const t = (key: string, params?: Record<string, string | number>) => translate(locale, key, params);
  // Engine events carry i18n keys as params (item names, quest titles, POIs).
  // Resolve any param that is itself a translation key before interpolating.
  const resolveParams = (params?: Record<string, string | number>) => {
    if (!params) return params;
    const out: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(params)) {
      out[key] = typeof value === 'string' && translate(locale, value) !== value ? translate(locale, value) : value;
    }
    return out;
  };
  switch (event.type) {
    case 'toast':
      return pushToast(toasts, event.kind, t(event.textKey, resolveParams(event.params)), event.icon);
    case 'sfx':
      audio.playSfx(event.id, event.volume ?? 1);
      return toasts;
    case 'haptic':
      void haptic(event.style);
      return toasts;
    case 'quest:updated':
      return toasts;
    case 'chapter:complete':
      set({ chapterComplete: true, panel: 'none' });
      audio.playSfx('quest', 1);
      return toasts;
    case 'collapse':
      set({ collapse: true, panel: 'none' });
      return toasts;
    case 'story:unlocked':
      if (event.entryId !== 'log_chapter_end') {
        set({ panel: 'story', panelData: event.entryId });
      }
      return toasts;
    case 'level:up':
      return pushToast(toasts, 'story', t('toast.level_up', { level: event.level }), 'energy');
    case 'discovery':
      return toasts;
    case 'threat:driven-off':
      return toasts;
    case 'tutorial:updated':
      return toasts;
    default:
      return toasts;
  }
}

export function isSimulationPaused(): boolean {
  const s = useSession.getState();
  return (
    s.phase !== 'game' ||
    s.panel !== 'none' ||
    s.collapse ||
    s.chapterComplete ||
    !s.snapshot
  );
}

/** Tutorial hint shown for the current chapter step, if not dismissed. */
export function currentTutorialHint(snapshot: GameSnapshot): { step: number; hintKey: string } | null {
  if (snapshot.tutorial.skipped) return null;
  const active = snapshot.quest.activeStep;
  if (!active) return null;
  const index = QUEST_STEPS.findIndex((s) => s.id === active);
  const step = questStep(active);
  if (!step?.hintKey) return null;
  if (snapshot.tutorial.step > index) return null;
  return { step: index, hintKey: step.hintKey };
}

export { getEngine };
