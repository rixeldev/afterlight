import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import type { AppSettings } from '../../game/types';
import { AMBIENCE_SOURCES, MUSIC_SOURCES, SFX_SOURCES, type AmbienceId, type MusicId, type SfxId } from './audioSources';

type VolumeKey = 'musicVolume' | 'sfxVolume' | 'ambienceVolume';

/**
 * Thin, defensive wrapper around expo-audio.
 * Audio must never crash gameplay on a device with a broken codec or a
 * suspended audio session, so every call is guarded.
 */
class AudioService {
  private sfx = new Map<string, AudioPlayer>();
  private music: AudioPlayer | null = null;
  private ambience: AudioPlayer | null = null;
  private musicId: MusicId | null = null;
  private ambienceId: AmbienceId | null = null;
  private volumes: Record<VolumeKey, number> = { musicVolume: 0.55, sfxVolume: 0.8, ambienceVolume: 0.7 };
  private enabled = true;
  private suspended = false;
  private initialised = false;
  private lastPlay = new Map<string, number>();

  async init(settings: AppSettings): Promise<void> {
    this.applySettings(settings);
    if (this.initialised) return;
    this.initialised = true;
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'mixWithOthers',
        allowsRecording: false,
      });
    } catch {
      // Audio session is optional; the game remains fully playable silent.
    }
  }

  applySettings(settings: AppSettings): void {
    this.volumes = {
      musicVolume: settings.musicVolume,
      sfxVolume: settings.sfxVolume,
      ambienceVolume: settings.ambienceVolume,
    };
    if (this.music) this.music.volume = this.volumes.musicVolume * 0.9;
    if (this.ambience) this.ambience.volume = this.volumes.ambienceVolume * 0.8;
  }

  playSfx(id: string, volume = 1): void {
    if (!this.enabled || this.suspended) return;
    const source = SFX_SOURCES[id as SfxId];
    if (!source) return;
    // Rate-limit identical one-shots to avoid machine-gun artefacts.
    const now = Date.now();
    const last = this.lastPlay.get(id) ?? 0;
    if (now - last < 45) return;
    this.lastPlay.set(id, now);
    try {
      let player = this.sfx.get(id);
      if (!player) {
        player = createAudioPlayer(source);
        this.sfx.set(id, player);
      }
      player.volume = Math.max(0, Math.min(1, volume * this.volumes.sfxVolume));
      player.seekTo(0);
      player.play();
    } catch {
      // ignore
    }
  }

  playMusic(id: MusicId, fadeSeconds = 1.2): void {
    if (this.musicId === id && this.music) return;
    this.musicId = id;
    try {
      if (this.music) {
        const old = this.music;
        this.volumeRamp(old, 0, fadeSeconds * 600, () => {
          try {
            old.pause();
          } catch {
            /* noop */
          }
        });
      }
      const player = createAudioPlayer(MUSIC_SOURCES[id]);
      player.loop = true;
      player.volume = 0;
      this.music = player;
      if (!this.suspended) player.play();
      this.volumeRamp(player, this.volumes.musicVolume * 0.9, fadeSeconds * 1000);
    } catch {
      // ignore
    }
  }

  playAmbience(id: AmbienceId, fadeSeconds = 1.5): void {
    if (this.ambienceId === id && this.ambience) return;
    this.ambienceId = id;
    try {
      if (this.ambience) {
        const old = this.ambience;
        this.volumeRamp(old, 0, fadeSeconds * 600, () => {
          try {
            old.pause();
          } catch {
            /* noop */
          }
        });
      }
      const player = createAudioPlayer(AMBIENCE_SOURCES[id]);
      player.loop = true;
      player.volume = 0;
      this.ambience = player;
      if (!this.suspended) player.play();
      this.volumeRamp(player, this.volumes.ambienceVolume * 0.8, fadeSeconds * 1000);
    } catch {
      // ignore
    }
  }

  stopMusic(fadeSeconds = 0.6): void {
    this.musicId = null;
    if (!this.music) return;
    const player = this.music;
    this.volumeRamp(player, 0, fadeSeconds * 1000, () => {
      try {
        player.pause();
      } catch {
        /* noop */
      }
    });
    this.music = null;
  }

  stopAmbience(fadeSeconds = 0.6): void {
    this.ambienceId = null;
    if (!this.ambience) return;
    const player = this.ambience;
    this.volumeRamp(player, 0, fadeSeconds * 1000, () => {
      try {
        player.pause();
      } catch {
        /* noop */
      }
    });
    this.ambience = null;
  }

  suspend(): void {
    this.suspended = true;
    try {
      this.music?.pause();
      this.ambience?.pause();
    } catch {
      // ignore
    }
  }

  resume(): void {
    if (!this.enabled) return;
    this.suspended = false;
    try {
      this.music?.play();
      this.ambience?.play();
    } catch {
      // ignore
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.suspend();
  }

  private volumeRamp(player: AudioPlayer, target: number, durationMs: number, done?: () => void): void {
    const steps = Math.max(1, Math.min(16, Math.round(durationMs / 60)));
    const start = player.volume;
    let step = 0;
    try {
      player.volume = start;
    } catch {
      /* noop */
    }
    const timer = setInterval(() => {
      step += 1;
      const t = step / steps;
      try {
        player.volume = Math.max(0, Math.min(1, start + (target - start) * t));
      } catch {
        /* noop */
      }
      if (step >= steps) {
        clearInterval(timer);
        done?.();
      }
    }, 60);
  }
}

export const audio = new AudioService();
