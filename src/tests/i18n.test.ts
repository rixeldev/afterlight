import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { translate, formatClock } from '../i18n';

describe('localisation', () => {
  it('has identical keys in every language', () => {
    const enKeys = Object.keys(en).sort();
    const esKeys = Object.keys(es).sort();
    expect(esKeys).toEqual(enKeys);
  });

  it('has no empty strings', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(`${key}:${value.length > 0}`).toBe(`${key}:true`);
    }
    for (const [key, value] of Object.entries(es)) {
      expect(`${key}:${value.length > 0}`).toBe(`${key}:true`);
    }
  });

  it('keeps interpolation placeholders consistent', () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(`${key} -> ${placeholders(es[key])}`).toBe(`${key} -> ${placeholders(en[key])}`);
    }
  });

  it('interpolates values and falls back to the key', () => {
    expect(translate('en', 'toast.item_gained', { qty: 2, item: 'Wood' })).toBe('+2 Wood');
    expect(translate('es', 'hud.day', { day: 3 })).toBe('Día 3');
    expect(translate('en', 'not.a.real.key')).toBe('not.a.real.key');
  });

  it('formats clocks as 24h', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(8 * 60 + 5)).toBe('08:05');
    expect(formatClock(18 * 60 + 40)).toBe('18:40');
    expect(formatClock(1440 + 61)).toBe('01:01');
  });
});
