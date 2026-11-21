import type { PoiDef } from '../game/types';

export const REGION = {
  id: 'greenhaven',
  nameKey: 'region.greenhaven.name',
  subtitleKey: 'region.greenhaven.subtitle',
  /** Homestead centre and build plot radius. */
  camp: { x: 0, z: 0 },
  buildRadius: 15,
  playRadius: 74,
  spawn: { x: 0, z: 5.5 },
  startMinute: 8 * 60 + 10,
  /** Lake centre/size used by terrain + minimap. */
  lake: { x: 44, z: 8, rx: 26, rz: 20 },
} as const;

export const POIS: PoiDef[] = [
  {
    id: 'homestead',
    nameKey: 'poi.homestead.name',
    descKey: 'poi.homestead.desc',
    x: 0,
    z: 0,
    radius: 18,
    icon: 'camp',
    xp: 0,
  },
  {
    id: 'ranger_camp',
    nameKey: 'poi.ranger_camp.name',
    descKey: 'poi.ranger_camp.desc',
    x: 32,
    z: -36,
    radius: 15,
    icon: 'camp',
    xp: 120,
    storyEntry: 'log_ranger_camp',
  },
  {
    id: 'footbridge',
    nameKey: 'poi.footbridge.name',
    descKey: 'poi.footbridge.desc',
    x: -34,
    z: 26,
    radius: 13,
    icon: 'bridge',
    xp: 90,
    storyEntry: 'log_footbridge',
  },
  {
    id: 'lookout',
    nameKey: 'poi.lookout.name',
    descKey: 'poi.lookout.desc',
    x: 14,
    z: 46,
    radius: 14,
    icon: 'lookout',
    xp: 140,
    storyEntry: 'log_lookout',
  },
  {
    id: 'silent_gate',
    nameKey: 'poi.silent_gate.name',
    descKey: 'poi.silent_gate.desc',
    x: -46,
    z: -44,
    radius: 12,
    icon: 'gate',
    xp: 0,
    locked: true,
  },
];

export function poiDef(id: string): PoiDef | undefined {
  return POIS.find((p) => p.id === id);
}

export interface StoryEntry {
  id: string;
  titleKey: string;
  bodyKey: string;
  /** Sorted order in the journal. */
  order: number;
  kind: 'audio_log' | 'note' | 'chapter';
}

export const STORY: StoryEntry[] = [
  {
    id: 'log_ranger_camp',
    titleKey: 'story.log_ranger_camp.title',
    bodyKey: 'story.log_ranger_camp.body',
    order: 1,
    kind: 'audio_log',
  },
  {
    id: 'log_footbridge',
    titleKey: 'story.log_footbridge.title',
    bodyKey: 'story.log_footbridge.body',
    order: 2,
    kind: 'note',
  },
  {
    id: 'log_lookout',
    titleKey: 'story.log_lookout.title',
    bodyKey: 'story.log_lookout.body',
    order: 3,
    kind: 'note',
  },
  {
    id: 'log_chapter_end',
    titleKey: 'story.log_chapter_end.title',
    bodyKey: 'story.log_chapter_end.body',
    order: 4,
    kind: 'chapter',
  },
];

export function storyEntry(id: string): StoryEntry | undefined {
  return STORY.find((s) => s.id === id);
}
