import ambienceDay from '../../../assets/audio/ambience_day.mp3';
import ambienceNight from '../../../assets/audio/ambience_night.mp3';
import build from '../../../assets/audio/build.mp3';
import chop from '../../../assets/audio/chop.mp3';
import consume from '../../../assets/audio/consume.mp3';
import craftDone from '../../../assets/audio/craft_done.mp3';
import craft from '../../../assets/audio/craft.mp3';
import equip from '../../../assets/audio/equip.mp3';
import footstep from '../../../assets/audio/footstep.mp3';
import growl from '../../../assets/audio/growl.mp3';
import hit from '../../../assets/audio/hit.mp3';
import hurt from '../../../assets/audio/hurt.mp3';
import levelUp from '../../../assets/audio/level_up.mp3';
import mine from '../../../assets/audio/mine.mp3';
import musicExplore from '../../../assets/audio/music_explore.mp3';
import musicMenu from '../../../assets/audio/music_menu.mp3';
import pick from '../../../assets/audio/pick.mp3';
import pickup from '../../../assets/audio/pickup.mp3';
import quest from '../../../assets/audio/quest.mp3';
import sleep from '../../../assets/audio/sleep.mp3';
import swing from '../../../assets/audio/swing.mp3';
import uiClose from '../../../assets/audio/ui_close.mp3';
import uiError from '../../../assets/audio/ui_error.mp3';
import uiOpen from '../../../assets/audio/ui_open.mp3';
import uiTap from '../../../assets/audio/ui_tap.mp3';
import water from '../../../assets/audio/water.mp3';

export const SFX_SOURCES = {
  ui_tap: uiTap,
  ui_open: uiOpen,
  ui_close: uiClose,
  ui_error: uiError,
  chop,
  mine,
  pick,
  water,
  pickup,
  craft,
  craft_done: craftDone,
  build,
  quest,
  level_up: levelUp,
  hurt,
  growl,
  hit,
  sleep,
  footstep,
  equip,
  consume,
  swing,
} as const;

export const MUSIC_SOURCES = {
  menu: musicMenu,
  explore: musicExplore,
} as const;

export const AMBIENCE_SOURCES = {
  day: ambienceDay,
  night: ambienceNight,
} as const;

export type SfxId = keyof typeof SFX_SOURCES;
export type MusicId = keyof typeof MUSIC_SOURCES;
export type AmbienceId = keyof typeof AMBIENCE_SOURCES;
