import { useEffect, useRef, useState } from 'react';
import { Animated, ImageBackground, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import keyart from '../../../assets/branding/menu_keyart.png';
import { C, R, SP } from '../theme';
import { AppText, Button } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useT } from '../../state/settingsStore';
import { useSession } from '../../state/sessionStore';
import { formatPlaytime } from '../../i18n';

function formatSavedAt(timestamp: number): string {
  const date = new Date(timestamp);
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function MainMenuScreen() {
  const { t, locale } = useT();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const saveInfo = useSession((s) => s.saveInfo);
  const startNew = useSession((s) => s.startNew);
  const continueGame = useSession((s) => s.continueGame);
  const openPanel = useSession((s) => s.openPanel);
  const [confirmNew, setConfirmNew] = useState(false);
  const [busy, setBusy] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(22)).current;
  const fog = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fog, { toValue: 1, duration: 14000, useNativeDriver: true }),
        Animated.timing(fog, { toValue: 0, duration: 14000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [fade, rise, fog]);


  const compact = height < 420 || width < 760;

  const start = async (mode: 'new' | 'continue') => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'new') await startNew();
      else await continueGame();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ImageBackground source={keyart} style={styles.root} resizeMode="cover">
      <LinearGradient
        colors={['rgba(4,10,9,0.86)', 'rgba(4,10,9,0.25)', 'rgba(4,10,9,0.9)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient colors={['rgba(3,8,7,0.9)', 'rgba(3,8,7,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />

      <Animated.View style={[styles.fog, { opacity: 0.22, transform: [{ translateX: fog.interpolate({ inputRange: [0, 1], outputRange: [-40, 60] }) }] }]} pointerEvents="none">
        <LinearGradient colors={['rgba(220,228,211,0)', 'rgba(220,228,211,0.35)', 'rgba(220,228,211,0)']} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View
        style={[
          styles.content,
          { paddingTop: insets.top + SP.lg, paddingBottom: insets.bottom + SP.lg, paddingLeft: insets.left + SP.xl, paddingRight: insets.right + SP.xl, opacity: fade },
        ]}
      >
        <View style={styles.left}>
          <Animated.View style={{ transform: [{ translateY: rise }] }}>
            <View style={styles.markRow}>
              <Svg width={26} height={26} viewBox="0 0 24 24">
                <Path d="M3 18h18M6 18a6 6 0 0112 0M12 3v2.6" stroke={C.accent} strokeWidth={1.5} fill="none" strokeLinecap="round" />
              </Svg>
              <AppText variant="micro" color={C.accent} style={{ letterSpacing: 4 }}>
                {t('app.tagline')}
              </AppText>
            </View>
            <AppText variant="display" style={[styles.title, compact ? { fontSize: 40 } : null]}>
              {t('app.title')}
            </AppText>
            <AppText variant="body" color={C.textSecondary} style={{ marginTop: 6, maxWidth: 420 }}>
              {t('region.greenhaven.subtitle')} — {t('map.subtitle')}
            </AppText>

            <View style={styles.menu}>
              {saveInfo.exists ? (
                <Button
                  label={busy ? t('common.loading') : t('menu.continue')}
                  icon="play"
                  onPress={() => void start('continue')}
                  full
                />
              ) : null}
              <Button
                label={busy && !saveInfo.exists ? t('common.loading') : t('menu.new_game')}
                icon="sparkle"
                variant={saveInfo.exists ? 'secondary' : 'primary'}
                onPress={() => (saveInfo.exists ? setConfirmNew(true) : void start('new'))}
                full
              />
              <View style={styles.secondaryRow}>
                <Button label={t('menu.settings')} icon="settings" variant="ghost" compact onPress={() => openPanel('settings')} />
                <Button label={t('menu.credits')} icon="book" variant="ghost" compact onPress={() => openPanel('credits')} />
              </View>
            </View>

            <View style={styles.footer}>
              <AppText variant="micro" color={C.textMuted}>
                {t('app.version', { version: '0.1.0' })}
              </AppText>
              <View style={styles.footerDot} />
              <AppText variant="micro" color={C.textMuted}>
                {t('app.offline')}
              </AppText>
            </View>
          </Animated.View>
        </View>

        {!compact ? <View style={styles.right}>
          <View style={styles.journeyCard}>
            <View style={styles.journeyHeader}>
              <View style={styles.journeyIcon}>
                <Icon name="home" size={18} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="micro" color={C.textMuted}>
                  {saveInfo.exists ? t('menu.chapter', { n: 1, title: t(saveInfo.chapterTitleKey) }) : t('menu.slot_empty')}
                </AppText>
                <AppText variant="heading" style={{ marginTop: 1 }}>
                  {saveInfo.exists ? t('map.title') : t('menu.fresh_start')}
                </AppText>
              </View>
            </View>
            {saveInfo.exists ? (
              <>
                <View style={styles.journeyStats}>
                  <View style={styles.journeyStat}>
                    <AppText variant="heading">{saveInfo.level}</AppText>
                    <AppText variant="micro" color={C.textMuted}>
                      {t('char.title')}
                    </AppText>
                  </View>
                  <View style={styles.journeyDivider} />
                  <View style={styles.journeyStat}>
                    <AppText variant="heading">{formatPlaytime(saveInfo.playtimeMinutes, locale)}</AppText>
                    <AppText variant="micro" color={C.textMuted}>
                      {t('char.stat.playtime')}
                    </AppText>
                  </View>
                  <View style={styles.journeyDivider} />
                  <View style={styles.journeyStat}>
                    <AppText variant="heading">{saveInfo.questCompleted}/7</AppText>
                    <AppText variant="micro" color={C.textMuted}>
                      {t('journal.title')}
                    </AppText>
                  </View>
                </View>
                <View style={styles.journeyFooter}>
                  <Icon name="clock" size={12} color={C.textMuted} />
                  <AppText variant="micro" color={C.textMuted}>
                    {t('menu.last_saved', {
                      time: formatSavedAt(saveInfo.savedAt),
                    })}
                  </AppText>
                </View>
                <Pressable onPress={() => void start('continue')} style={styles.resumeRow} accessibilityLabel={t('menu.resume')}>
                  <AppText variant="label" color={C.accent}>
                    {t('menu.resume')}
                  </AppText>
                  <Icon name="arrow_right" size={16} color={C.accent} />
                </Pressable>
              </>
            ) : (
              <View style={{ marginTop: SP.md }}>
                <AppText variant="body" color={C.textMuted}>
                  {t('quest.wake.summary')}
                </AppText>
                <Button label={t('menu.fresh_start')} icon="sunrise" onPress={() => void start('new')} style={{ marginTop: SP.md }} />
              </View>
            )}
          </View>
          <AppText variant="micro" color={C.textMuted} align="center" style={{ marginTop: 10 }}>
            {t('menu.autosave_note')}
          </AppText>
        </View> : null}
      </Animated.View>

      <ConfirmDialog
        visible={confirmNew}
        title={t('menu.new_game_title')}
        body={t('menu.new_game_body')}
        confirmLabel={t('menu.new_game_confirm')}
        destructive
        onCancel={() => setConfirmNew(false)}
        onConfirm={() => {
          setConfirmNew(false);
          void start('new');
        }}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  fog: { position: 'absolute', left: 0, right: 0, bottom: 80, height: 260 },
  content: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: SP.xl },
  left: { flex: 1.25, justifyContent: 'flex-end' },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  title: { fontSize: 64, letterSpacing: 6, lineHeight: 70 },
  menu: { marginTop: SP.lg, gap: 8, maxWidth: 380 },
  secondaryRow: { flexDirection: 'row', gap: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: SP.lg },
  footerDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: C.textMuted },
  right: { width: 340, maxWidth: '44%', justifyContent: 'flex-end', paddingBottom: 4 },
  journeyCard: {
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: 'rgba(8,19,15,0.82)',
    padding: SP.md,
  },
  journeyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  journeyIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.accentDim, alignItems: 'center', justifyContent: 'center' },
  journeyStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SP.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  journeyStat: { flex: 1, alignItems: 'center', gap: 2 },
  journeyDivider: { width: 1, height: 26, backgroundColor: C.border },
  journeyFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  resumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
});
