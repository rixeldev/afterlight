import { memo } from 'react';
import { SvgXml } from 'react-native-svg';
import { KIT_ICONS } from '../../game/assets/generated/icons';
import { C } from '../theme';

/**
 * Extra glyphs drawn in the same 24px, 1.7 stroke language as the starter kit
 * so the whole interface reads as one set.
 */
const CUSTOM_PATHS: Record<string, string> = {
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  chevron_right: '<path d="M9 5l7 7-7 7"/>',
  chevron_left: '<path d="M15 5l-7 7 7 7"/>',
  chevron_down: '<path d="M5 9l7 7 7-7"/>',
  arrow_right: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  arrow_left: '<path d="M20 12H4M10 6l-6 6 6 6"/>',
  pause: '<rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/>',
  play: '<path d="M8 5.5l11 6.5-11 6.5z"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 016.5 3H20v16.5H6.5A2.5 2.5 0 004 22z"/><path d="M4 5.5v16.5M8 7h8M8 11h6"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5a7.5 7.5 0 0115 0"/>',
  quest: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3 2"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  clock: '<circle cx="12" cy="12" r="8.7"/><path d="M12 7v5.4l3.4 2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 019.5 4a8.6 8.6 0 1010.5 10.5z"/>',
  flame: '<path d="M12 3c3.6 3.9 5.6 6.4 5.6 9.4A5.6 5.6 0 0112 18a5.6 5.6 0 01-5.6-5.6C6.4 9.4 8.4 6.9 12 3z"/><path d="M12 21v-3"/>',
  sword: '<path d="M14.5 3.5H20V9l-8 8-5-5z"/><path d="M6.5 17.5L3 21M8 12l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>',
  rotate: '<path d="M20 12a8 8 0 11-2.6-5.9M20 3v5h-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  alert: '<path d="M12 3l9.5 17H2.5z"/><path d="M12 9v5M12 17.2v.6"/>',
  lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V7.5a4 4 0 018 0V10"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/>',
  star: '<path d="M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.2-5.6-3-5.6 3 1.2-6.2L3 9.6l6.3-.8z"/>',
  sort: '<path d="M4 7h16M6.5 12h11M9 17h6"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.2 6.2l2.6 2.6M15.2 15.2l2.6 2.6M17.8 6.2l-2.6 2.6M8.8 15.2l-2.6 2.6"/>',
  volume: '<path d="M4 9.5h3.5L13 5v14L7.5 14.5H4z"/><path d="M16.5 9a4.5 4.5 0 010 6M19 6.5a8 8 0 010 11"/>',
  hand: '<path d="M9 11V5.5a1.5 1.5 0 013 0V11M12 11V4.5a1.5 1.5 0 013 0V11M15 11V6.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1.5a6 6 0 01-5.2-3L4 14.5a1.6 1.6 0 012.6-1.8L9 15.5"/>',
  leaf: '<path d="M20 4C9 4 4 9 4 16v4M20 4c0 9-6 13-12 13"/>',
  drop: '<path d="M12 3s6 6.4 6 10.5A6 6 0 016 13.5C6 9.4 12 3 12 3z"/>',
  bag: '<path d="M5 8h14l-1.2 12H6.2z"/><path d="M8.5 8V6.5a3.5 3.5 0 017 0V8"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  sunrise: '<path d="M3 18h18M6 18a6 6 0 0112 0M12 3v2.5M5 7l1.7 1.7M19 7l-1.7 1.7"/>',
};

export type IconName =
  | keyof typeof KIT_ICONS
  | keyof typeof CUSTOM_PATHS;

function buildXml(name: string, color: string): string | null {
  const custom = CUSTOM_PATHS[name];
  if (custom) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${custom}</svg>`;
  }
  const kit = KIT_ICONS[name];
  if (!kit) return null;
  return kit.replace(/#D9E4DA/gi, color);
}

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  opacity?: number;
}

export const Icon = memo(function Icon({ name, size = 22, color = C.textSecondary, opacity = 1 }: IconProps) {
  const xml = buildXml(name, color);
  if (!xml) return null;
  return <SvgXml xml={xml} width={size} height={size} opacity={opacity} />;
});

export { CUSTOM_PATHS };
