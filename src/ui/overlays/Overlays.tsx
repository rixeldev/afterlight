import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, SP } from '../../ui/theme';
import { AppText, Button } from '../../ui/components/Primitives';
import { Icon } from '../../ui/components/Icon';
import { useT } from '../../state/settingsStore';
import { useSession } from '../../state/sessionStore';
import { formatPlaytime } from '../../i18n';
import { QUEST_STEPS } from '../../data/quests';

export function ChapterCompleteOverlay() {
  const { t, locale } = useT();
  const insets = useSafeAreaInsets();
  const visible = useSession((s) => s.chapterComplete);
  const snapshot = useSession((s) => s.snapshot);
  const acknowledge = useSession((s) => s.acknowledgeChapter);
  const openPanel = useSession((s) => s.openPanel);
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    translate.setValue(18);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, [visible, opacity, translate]);

  if (!visible || !snapshot) return null;
  const stats = snapshot.stats;
  const rows = [
    { icon: 'clock', label: t('chapter.stats.time'), value: formatPlaytime(stats.minutesPlayed / 60, locale) },
    { icon: 'wood', label: t('chapter.stats.gathered'), value: String(stats.itemsGathered) },
    { icon: 'home', label: t('chapter.stats.built'), value: String(stats.structuresBuilt) },
    { icon: 'map', label: t('chapter.stats.discoveries'), value: String(snapshot.discoveries.length) },
    { icon: 'star', label: t('chapter.stats.level'), value: String(snapshot.player.level) },
  ];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
      <LinearGradient colors={['#050D0B', '#0B1B16', '#1B2B21']} style={StyleSheet.absoluteFill} />
      <View style={styles.sunWrap} pointerEvents="none">
        <View style={styles.sunGlow} />
        <View style={styles.sun} />
        <View style={styles.ridge} />
      </View>
      <View
        style={[
          styles.chapterContent,
          { paddingTop: insets.top + SP.lg, paddingBottom: insets.bottom + SP.lg, paddingLeft: insets.left + SP.xl, paddingRight: insets.right + SP.xl },
        ]}
      >
        <Animated.View style={{ transform: [{ translateY: translate }], flex: 1, justifyContent: 'center', maxWidth: 760 }}>
          <View style={styles.chapterBadge}>
            <View style={styles.chapterDot} />
            <AppText variant="micro" color={C.accent}>
              {t('chapter.title')}
            </AppText>
          </View>
          <AppText variant="display" style={{ marginTop: 8, letterSpacing: 1 }}>
            {t('chapter.subtitle')}
          </AppText>
          <AppText variant="body" color={C.textSecondary} style={{ marginTop: SP.md, lineHeight: 26, fontSize: 16 }}>
            {t('chapter.epilogue')}
          </AppText>
          <View style={styles.chapterQuote}>
            <View style={styles.quoteLine} />
            <AppText variant="body" color={C.accent} style={{ flex: 1 }}>
              {t('chapter.next')}
            </AppText>
          </View>
          <View style={styles.statRow}>
            {rows.map((row) => (
              <View key={row.label} style={styles.statCell}>
                <Icon name={row.icon} size={15} color={C.accent} />
                <AppText variant="heading" style={{ fontSize: 18 }}>
                  {row.value}
                </AppText>
                <AppText variant="micro" color={C.textMuted} numberOfLines={2}>
                  {row.label}
                </AppText>
              </View>
            ))}
          </View>
          <View style={styles.chapterActions}>
            <Button label={t('chapter.continue')} icon="compass" onPress={acknowledge} />
            <Button
              label={t('journal.story')}
              variant="secondary"
              icon="book"
              onPress={() => {
                acknowledge();
                openPanel('journal');
              }}
            />
          </View>
          <View style={styles.progressLine}>
            <AppText variant="micro" color={C.textMuted}>
              {snapshot.quest.completed.length}/{QUEST_STEPS.length} · {t('chapter.save_note')}
            </AppText>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export function CollapseOverlay() {
  const { t } = useT();
  const visible = useSession((s) => s.collapse);
  const acknowledge = useSession((s) => s.acknowledgeCollapse);
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={['#140A09', '#1D0E0C', '#0A0C0A']} style={StyleSheet.absoluteFill} />
      <View style={styles.collapseWrap}>
        <View style={styles.collapseRing}>
          <Icon name="health" size={26} color={C.danger} />
        </View>
        <AppText variant="title" align="center" color="#F0C6BC">
          {t('death.title')}
        </AppText>
        <AppText variant="body" align="center" color={C.textMuted} style={{ maxWidth: 460, marginTop: 8 }}>
          {t('death.body')}
        </AppText>
        <Button label={t('death.continue')} icon="sunrise" onPress={acknowledge} style={{ marginTop: SP.lg }} />
        <AppText variant="micro" color={C.textMuted} style={{ marginTop: SP.md }}>
          {t('app.tagline')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sunWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'flex-end', justifyContent: 'flex-end' },
  sunGlow: {
    position: 'absolute',
    right: -120,
    bottom: -220,
    width: 620,
    height: 620,
    borderRadius: 310,
    backgroundColor: 'rgba(232,201,143,0.09)',
  },
  sun: {
    position: 'absolute',
    right: 60,
    bottom: 40,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(246,220,169,0.9)',
  },
  ridge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 240,
    backgroundColor: 'rgba(9,20,16,0.75)',
    borderTopLeftRadius: 400,
    borderTopRightRadius: 120,
  },
  chapterContent: { flex: 1, flexDirection: 'row' },
  chapterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.accentLine,
    backgroundColor: 'rgba(232,201,143,0.1)',
  },
  chapterDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent },
  chapterQuote: { flexDirection: 'row', gap: 12, marginTop: SP.lg, alignItems: 'stretch' },
  quoteLine: { width: 2, borderRadius: 1, backgroundColor: C.accentLine },
  statRow: { flexDirection: 'row', gap: 8, marginTop: SP.lg, flexWrap: 'wrap' },
  statCell: {
    minWidth: 112,
    padding: 10,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(233,240,226,0.04)',
    gap: 2,
  },
  chapterActions: { flexDirection: 'row', gap: 10, marginTop: SP.lg, flexWrap: 'wrap' },
  progressLine: { marginTop: SP.md },
  collapseWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.xl },
  collapseRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(217,129,112,0.5)',
    backgroundColor: 'rgba(217,129,112,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SP.md,
  },
});
