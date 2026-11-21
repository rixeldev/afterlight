import { getLocales } from 'expo-localization';
import type { LanguageSetting } from '../game/types';
import { en, type Dictionary, type TranslationKey } from './en';
import { es } from './es';

export type Locale = 'en' | 'es';

const DICTIONARIES: Record<Locale, Dictionary> = { en, es };

export function detectDeviceLocale(): Locale {
  try {
    const locales = getLocales();
    const code = locales[0]?.languageCode ?? 'en';
    return code.toLowerCase().startsWith('es') ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

export function resolveLocale(setting: LanguageSetting): Locale {
  if (setting === 'en' || setting === 'es') return setting;
  return detectDeviceLocale();
}

export type TranslateParams = Record<string, string | number>;

/**
 * Structured missing-key behaviour: fall back to English, then to the key.
 * Extra params are ignored; missing ones leave the placeholder untouched.
 */
export function translate(locale: Locale, key: string, params?: TranslateParams): string {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES.en;
  const template = dict[key as TranslationKey] ?? DICTIONARIES.en[key as TranslationKey] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export function createTranslator(locale: Locale) {
  return (key: string, params?: TranslateParams) => translate(locale, key, params);
}

export type Translator = ReturnType<typeof createTranslator>;

export function formatPlaytime(minutes: number, locale: Locale): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours <= 0) return translate(locale, 'common.minutes', { n: mins });
  return `${hours} h ${String(mins).padStart(2, '0')} min`;
}

export function formatClock(minutes: number): string {
  const rem = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(rem / 60);
  const m = Math.floor(rem % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function localeForSpeech(locale: Locale): string {
  return locale === 'es' ? 'es-ES' : 'en-US';
}

export type { TranslationKey, Dictionary };
export { en, es };
