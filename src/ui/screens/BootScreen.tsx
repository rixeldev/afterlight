import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { C, SP } from '../theme';
import { AppText } from '../components/Primitives';
import { useSettings, useT } from '../../state/settingsStore';

const TIPS = ['boot.tip.1', 'boot.tip.2', 'boot.tip.3', 'boot.tip.4'];

export function BootScreen() {
  const { t } = useT();
  const { width } = useWindowDimensions();
  const reducedMotion = useSettings((s) => s.settings.reducedMotion);
  const pulse = useRef(new Animated.Value(0)).current;
  const [tipIndex, setTipIndex] = useState(0);
  const [progress, setProgress] = useState(0.12);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ]),
    );
    if (!reducedMotion) loop.start();
    const tipTimer = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), 3400);
    const progressTimer = setInterval(() => setProgress((p) => Math.min(0.92, p + (0.92 - p) * 0.08)), 220);
    return () => {
      loop.stop();
      clearInterval(tipTimer);
      clearInterval(progressTimer);
    };
  }, [pulse, reducedMotion]);

  const portrait = width < 600;

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#050D0B', '#0A1A15', '#12231C']} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.glow, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] }) }]} pointerEvents="none" />

      <View style={[styles.content, portrait ? { flexDirection: 'column', justifyContent: 'center' } : null]}>
        <View style={styles.mark}>
          <Svg width={96} height={96} viewBox="0 0 96 96">
            <Circle cx={48} cy={54} r={16} fill="#FFEFC9" opacity={0.95} />
            <Circle cx={48} cy={54} r={30} fill="#F6D79C" opacity={0.12} />
            <Path d="M4 76 L22 66 L40 72 L58 62 L76 71 L92 64 L92 92 L4 92 Z" fill="#0B1512" />
            <Path d="M60 40 L68 58 L63 57 L72 70 L56 68 L56 92 L64 92" stroke="#FFEFC9" strokeWidth={2} fill="none" opacity={0.5} />
          </Svg>
        </View>
        <AppText variant="display" style={styles.title}>
          {t('app.title')}
        </AppText>
        <AppText variant="micro" color={C.accent} style={{ letterSpacing: 4 }}>
          {t('app.tagline')}
        </AppText>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <AppText variant="caption" color={C.textMuted}>
          {t('app.loading')}
        </AppText>
      </View>

      <View style={styles.tipWrap}>
        <View style={styles.tipLine} />
        <AppText variant="caption" color={C.textSecondary} align="center" style={{ maxWidth: 560 }}>
          {t(TIPS[tipIndex] ?? TIPS[0] ?? 'boot.tip.1')}
        </AppText>
      </View>

      <View style={styles.version}>
        <AppText variant="micro" color={C.textMuted}>
          {t('app.offline')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: 'rgba(232,201,143,0.16)',
  },
  content: { alignItems: 'center', gap: 10 },
  mark: { marginBottom: 6 },
  title: { fontSize: 46, letterSpacing: 8, lineHeight: 52 },
  progressTrack: { width: 190, height: 3, borderRadius: 2, backgroundColor: 'rgba(233,240,226,0.12)', overflow: 'hidden', marginTop: SP.md },
  progressFill: { height: 3, backgroundColor: C.accent, borderRadius: 2 },
  tipWrap: {
    position: 'absolute',
    bottom: 42,
    left: 24,
    right: 24,
    alignItems: 'center',
    gap: 8,
  },
  tipLine: { width: 28, height: 1, backgroundColor: C.accentLine },
  version: { position: 'absolute', bottom: 16, right: 20 },
});
