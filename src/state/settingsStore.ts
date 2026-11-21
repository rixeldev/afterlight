import { useMemo } from 'react';
import { create } from 'zustand';
import type { AppSettings } from '../game/types';
import { createTranslator, resolveLocale, type Locale, type Translator } from '../i18n';
import { audio } from '../services/audio/audio';
import { setHapticsEnabled } from '../services/haptics';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../services/storage/saveService';
import { ensureSaveService } from '../services/storage';

interface SettingsState {
  settings: AppSettings;
  locale: Locale;
  ready: boolean;
  init: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => void;
  replace: (settings: AppSettings) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function localeOf(settings: AppSettings): Locale {
  return resolveLocale(settings.language);
}

function applyRuntimeSettings(settings: AppSettings): void {
  audio.applySettings(settings);
  setHapticsEnabled(settings.haptics);
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  locale: localeOf(DEFAULT_SETTINGS),
  ready: false,

  init: async () => {
    const service = await ensureSaveService();
    const settings = sanitizeSettings(await service.loadSettings());
    applyRuntimeSettings(settings);
    void audio.init(settings);
    set({ settings, locale: localeOf(settings), ready: true });
  },

  update: (patch) => {
    const next = sanitizeSettings({ ...get().settings, ...patch });
    set({ settings: next, locale: localeOf(next) });
    applyRuntimeSettings(next);
    void audio.init(next);
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      ensureSaveService()
        .then((service) => service.saveSettings(next))
        .catch(() => undefined);
    }, 220);
  },

  replace: (settings) => {
    const next = sanitizeSettings(settings);
    set({ settings: next, locale: localeOf(next) });
    applyRuntimeSettings(next);
  },
}));

/** Translation hook; re-renders when the locale changes. */
export function useT(): { t: Translator; locale: Locale } {
  const locale = useSettings((s) => s.locale);
  const t = useMemo(() => createTranslator(locale), [locale]);
  return { t, locale };
}

export function useLargeText(): boolean {
  return useSettings((s) => s.settings.largeText);
}
