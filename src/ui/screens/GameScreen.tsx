import { useEffect } from 'react';
import { AppState, BackHandler, StyleSheet, View } from 'react-native';
import { GameScene } from '../../game/rendering/Scene';
import { Hud } from '../hud/Hud';
import { InventoryPanel } from '../panels/InventoryPanel';
import { CraftingPanel } from '../panels/CraftingPanel';
import { MapPanel } from '../panels/MapPanel';
import { JournalPanel } from '../panels/JournalPanel';
import { CharacterPanel } from '../panels/CharacterPanel';
import { StoragePanel } from '../panels/StoragePanel';
import { StoryPanel } from '../panels/StoryPanel';
import { PausePanel } from '../panels/PausePanel';
import { ChapterCompleteOverlay, CollapseOverlay } from '../overlays/Overlays';
import { useSession } from '../../state/sessionStore';
import { useSettings } from '../../state/settingsStore';
import { audio } from '../../services/audio/audio';
import { startSimulationLoop, stopSimulationLoop } from '../../game/runtime/SimulationLoop';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { C } from '../theme';

/**
 * The 3D canvas stays mounted for the whole session. React only renders menus,
 * HUD and panels on top; the simulation runs inside the render loop.
 */
export function GameScreen() {
  const quality = useSettings((s) => s.settings.graphics);
  const sync = useSession((s) => s.sync);

  useEffect(() => {
    sync();
    startSimulationLoop();
    const id = setInterval(() => useSession.getState().sync(), 130);
    return () => {
      clearInterval(id);
      stopSimulationLoop();
    };
  }, [sync]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const state = useSession.getState();
      if (state.chapterComplete || state.collapse) return true;
      if (state.panel !== 'none') {
        state.closePanel();
        return true;
      }
      state.openPanel('pause');
      return true;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        audio.suspend();
        void useSession.getState().saveNow('auto');
      } else if (state === 'active') {
        audio.resume();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.root}>
      <GameScene quality={quality} />
      <Svg
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        width="100%"
        height="100%"
      >
        <Defs>
          <RadialGradient id="afterlight-vignette" cx="50%" cy="46%" r="78%">
            <Stop offset="0.5" stopColor="#000000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.42" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#afterlight-vignette)" />
      </Svg>
      <Hud />
      <InventoryPanel />
      <CraftingPanel />
      <MapPanel />
      <JournalPanel />
      <CharacterPanel />
      <StoragePanel />
      <StoryPanel />
      <PausePanel />
      <ChapterCompleteOverlay />
      <CollapseOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
});
