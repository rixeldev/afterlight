import { Component, useEffect, useState, type ReactNode } from 'react';
import { LogBox, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Sora_600SemiBold } from '@expo-google-fonts/sora/600SemiBold';
import { Sora_700Bold } from '@expo-google-fonts/sora/700Bold';
import { BootScreen } from './src/ui/screens/BootScreen';
import { MainMenuScreen } from './src/ui/screens/MainMenuScreen';
import { GameScreen } from './src/ui/screens/GameScreen';
import { SettingsPanel } from './src/ui/panels/SettingsPanel';
import { CreditsPanel } from './src/ui/panels/PausePanel';
import { useSession } from './src/state/sessionStore';
import { useSettings } from './src/state/settingsStore';
import { C } from './src/ui/theme';
import { Button, AppText } from './src/ui/components/Primitives';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Benign third-party warnings that would otherwise cover the game HUD in dev.
LogBox.ignoreLogs([
  'THREE.Clock',
  'WEBGL_lose_context',
  'ImageBackground is deprecated',
  'Require cycle: src/ui/hud/Controls.tsx',
]);

class AppBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.warn('App error', error.message);
  }

  override render() {
    if (this.state.error) {
      return (
        <View style={styles.errorRoot}>
          <AppText variant="title" align="center">
            Something went wrong
          </AppText>
          <AppText variant="body" color={C.textMuted} align="center" style={{ marginTop: 8, maxWidth: 460 }}>
            AFTERLIGHT hit an unexpected problem. Your save is stored on this device and is safe.
          </AppText>
          <Button label="Reload" icon="rotate" onPress={() => this.setState({ error: null })} style={{ marginTop: 20 }} />
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const phase = useSession((s) => s.phase);
  const boot = useSession((s) => s.boot);
  const initSettings = useSettings((s) => s.init);
  const settingsReady = useSettings((s) => s.ready);
  const [booted, setBooted] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);

  const [fontsLoaded, fontError] = useFonts({
    Sora_700Bold,
    Sora_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(C.bg).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (booted) return;
    if (!fontsLoaded && !fontError) return;
    (async () => {
      try {
        await initSettings();
        await boot();
        setBooted(true);
      } catch (error) {
        setFatal(error instanceof Error ? error.message : String(error));
        setBooted(true);
      } finally {
        void SplashScreen.hideAsync().catch(() => undefined);
      }
    })();
  }, [booted, fontsLoaded, fontError, initSettings, boot]);

  const ready = booted && settingsReady && (fontsLoaded || Boolean(fontError));

  return (
    <AppBoundary>
      <SafeAreaProvider>
        <StatusBar hidden />
        <View style={styles.root}>
          {!ready ? (
            <BootScreen />
          ) : phase === 'game' ? (
            <GameScreen />
          ) : (
            <MainMenuScreen />
          )}
          <SettingsPanel />
          <CreditsPanel />
          {fatal ? (
            <View style={styles.fatal}>
              <AppText variant="caption" color={C.textMuted} align="center">
                {fatal}
              </AppText>
            </View>
          ) : null}
        </View>
      </SafeAreaProvider>
    </AppBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  errorRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: C.bg },
  fatal: { position: 'absolute', bottom: 8, left: 16, right: 16 },
});
