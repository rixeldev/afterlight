import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, R } from '../theme';
import { Icon } from '../components/Icon';
import { AppText, Button, MeterBar, ProgressRing } from '../components/Primitives';
import { useSettings, useT } from '../../state/settingsStore';
import { currentTutorialHint, useSession } from '../../state/sessionStore';
import { xpForNextLevel } from '../../game/progression/progression';
import { questStep } from '../../data/quests';
import { ActionCluster, AutoButton, BuildControls, Dock, QuickBar } from './Controls';
import { Radar } from './Radar';
import { formatClock } from '../../i18n';
import { renderStats } from '../../game/rendering/stats';
import { THREAT } from '../../game/engine/constants';

export function Hud() {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const leftHanded = useSettings((s) => s.settings.leftHanded);
  const showFps = useSettings((s) => s.settings.showFps);
  const snapshot = useSession((s) => s.snapshot);
  const panel = useSession((s) => s.panel);
  const openPanel = useSession((s) => s.openPanel);
  const tutorialVisible = useSession((s) => s.tutorialVisible);
  const savePulse = useSession((s) => s.savePulse);
  const rendererFailed = useSession((s) => s.rendererFailed);
  const [restOpen, setRestOpen] = useState(false);
  const [fps, setFps] = useState(0);
  const [draws, setDraws] = useState(0);

  useEffect(() => {
    if (!showFps) return;
    const id = setInterval(() => {
      setFps(renderStats.fps);
      setDraws(renderStats.drawCalls);
    }, 1000);
    return () => clearInterval(id);
  }, [showFps]);

  if (!snapshot) return null;
  const hint = tutorialVisible && !rendererFailed ? currentTutorialHint(snapshot) : null;
  const compact = width < 780;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* damage vignette */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderWidth: 3,
            borderColor: 'rgba(217,129,112,0.55)',
            opacity: snapshot.damageFlash * 0.9,
          },
        ]}
      />
      {snapshot.threat ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.threatEdge]}>
          <View style={{ flex: 1, borderWidth: 2, borderColor: 'rgba(217,129,112,0.35)' }} />
        </View>
      ) : null}

      <View
        style={[
          styles.topBar,
          { paddingTop: insets.top + 8, paddingLeft: insets.left + 12, paddingRight: insets.right + 12 },
        ]}
        pointerEvents="box-none"
      >
        <ProfileCard />
        <ContextCard onPress={() => openPanel('journal')} />
        <RadarCluster onPause={() => openPanel('pause')} onMap={() => openPanel('map')} compact={compact} />
      </View>

      {snapshot.goal && !compact ? null : null}

      <ToastStack top={insets.top + 128} />

      {savePulse ? (
        <View style={[styles.savePill, { top: insets.top + 118 }]} pointerEvents="none">
          <Icon name="check" size={11} color={C.success} />
          <AppText variant="micro" color={C.success}>
            {t('hud.autosaved')}
          </AppText>
        </View>
      ) : null}

      {showFps ? (
        <View style={[styles.fps, { top: insets.top + 128, left: insets.left + 16 }]} pointerEvents="none">
          <AppText variant="micro" color={C.textMuted}>
            {t('hud.fps', { fps })} · {draws} dc
          </AppText>
        </View>
      ) : null}

      {panel === 'build' ? (
        <BuildControls leftHanded={leftHanded} />
      ) : (
        <>
          <AutoButton leftHanded={leftHanded} />
          <QuickBar />
          <Dock />
          <ActionCluster leftHanded={leftHanded} onRest={() => setRestOpen(true)} />
        </>
      )}

      {hint ? (
        <TutorialCoach hintKey={hint.hintKey} bottomOffset={panel === 'build' ? 220 : 160} />
      ) : null}

      <RestDialog open={restOpen} onClose={() => setRestOpen(false)} />
    </View>
  );
}

function ProfileCard() {
  const { t } = useT();
  const snapshot = useSession((s) => s.snapshot);
  const player = snapshot?.player;
  const saving = useSession((s) => s.saving);
  if (!player) return null;
  const xpNeeded = xpForNextLevel(player.level);
  const xpProgress = Math.min(1, player.xp / xpNeeded);
  const used = snapshot?.inventory.slots.filter(Boolean).length ?? 0;
  const cap = snapshot?.capacity ?? 24;
  return (
    <View style={styles.profile} pointerEvents="none">
      <View style={styles.profileTop}>
        <ProgressRing progress={xpProgress} size={40} stroke={3} color={C.accent} track="rgba(233,240,226,0.14)">
          <AppText variant="label" color={C.text} style={{ fontFamily: FONT.display }}>
            {player.level}
          </AppText>
        </ProgressRing>
        <View style={{ flex: 1 }}>
          <AppText variant="label" color={C.text} numberOfLines={1}>
            {t('char.title')}
          </AppText>
          <AppText variant="micro" color={C.textMuted}>
            {t('hud.level', { level: player.level })} · {used}/{cap}
          </AppText>
        </View>
      </View>
      <View style={styles.healthRow}>
        <Icon name="health" size={13} color="#9ED08C" />
        <MeterBar value={player.health} color="#8FCB7E" height={8} style={{ flex: 1 }} />
        <AppText variant="label" color="#C7E5BC" style={{ width: 30, textAlign: 'right' }}>
          {Math.round(player.health)}
        </AppText>
      </View>
      <View style={styles.miniRow}>
        <Icon name="food" size={12} color={C.hunger} />
        <MeterBar value={player.hunger} color={C.hunger} height={4} style={{ flex: 1 }} />
        <Icon name="water" size={12} color={C.thirst} />
        <MeterBar value={player.thirst} color={C.thirst} height={4} style={{ flex: 1 }} />
      </View>
      <View style={styles.miniRow}>
        <Icon name="energy" size={12} color={C.stamina} />
        <MeterBar value={player.stamina} color={C.stamina} height={4} style={{ flex: 1 }} />
        <AppText variant="micro" color={C.textMuted}>
          {saving ? t('hud.autosaving') : `Lv ${player.level}`}
        </AppText>
      </View>
    </View>
  );
}

function ContextCard({ onPress }: { onPress: () => void }) {
  const { t } = useT();
  const snapshot = useSession((s) => s.snapshot);
  if (!snapshot) return null;
  const threat = snapshot.threat;

  if (threat) {
    return (
      <View style={[styles.context, styles.enemyCard]} pointerEvents="none">
        <View style={styles.contextHeader}>
          <View style={styles.enemyDot} />
          <AppText variant="micro" color="#F0B3A4" numberOfLines={1} style={{ flex: 1 }}>
            {t('threat.name')} · {Math.round(threat.distance)} m
          </AppText>
          <AppText variant="micro" color={(threat.mode === 'chase' ? C.danger : C.warning) as string}>
            {threat.mode.toUpperCase()}
          </AppText>
        </View>
        <MeterBar value={threat.health} max={threat.maxHealth || THREAT.maxHealth} color={C.danger} height={7} style={{ marginTop: 4 }} />
        <AppText variant="micro" color={C.textMuted} style={{ marginTop: 2 }}>
          {Math.round(threat.health)} / {threat.maxHealth || THREAT.maxHealth}
        </AppText>
      </View>
    );
  }

  const step = snapshot.quest.activeStep ? questStep(snapshot.quest.activeStep) : null;
  if (!step) return null;
  const total = step.objectives.length;
  const done = step.objectives.filter((o) => (snapshot.quest.progress[`${step.id}:${o.id}`] ?? 0) >= (o.amount ?? 1)).length;
  const next = step.objectives.find((o) => (snapshot.quest.progress[`${step.id}:${o.id}`] ?? 0) < (o.amount ?? 1));
  const nextValue = next ? snapshot.quest.progress[`${step.id}:${next.id}`] ?? 0 : 0;

  return (
    <Pressable onPress={onPress} style={styles.context} accessibilityRole="button" accessibilityLabel={t('journal.title')}>
      <View style={styles.contextHeader}>
        <View style={styles.questDot} />
        <AppText variant="micro" color={C.accent} numberOfLines={1} style={{ flex: 1 }}>
          {t('hud.tracked')}
        </AppText>
        <AppText variant="micro" color={C.textMuted}>
          {done}/{total}
        </AppText>
      </View>
      <AppText variant="heading" numberOfLines={1} style={{ fontSize: 16 }}>
        {t(step.titleKey)}
      </AppText>
      {next ? (
        <AppText variant="caption" color={C.textSecondary} numberOfLines={1}>
          {t(next.textKey)}
          {next.amount && next.amount > 1 ? ` · ${Math.min(next.amount, Math.floor(nextValue))}/${next.amount}` : ''}
        </AppText>
      ) : null}
      <View style={styles.questBar}>
        <View style={[styles.questFill, { width: `${(done / total) * 100}%` }]} />
      </View>
      {snapshot.goal ? (
        <>
          <View style={styles.goalDivider} />
          <View style={styles.goalRow}>
            <Icon name="target" size={12} color={C.accent} />
            <AppText variant="micro" color={C.textMuted} style={{ width: 32 }}>
              {t('hud.next_goal_short')}
            </AppText>
            <AppText variant="caption" color={C.textSecondary} numberOfLines={1} style={{ flex: 1 }}>
              {t(snapshot.goal.titleKey)}
            </AppText>
            <AppText variant="micro" color={C.accent}>
              {snapshot.goal.current}/{snapshot.goal.target}
            </AppText>
          </View>
        </>
      ) : null}
    </Pressable>
  );
}

function RadarCluster({ onPause, onMap, compact }: { onPause: () => void; onMap: () => void; compact: boolean }) {
  const { t } = useT();
  const snapshot = useSession((s) => s.snapshot);
  const isNight = (snapshot?.timeOfDay ?? 0.5) > 0.79 || (snapshot?.timeOfDay ?? 0.5) < 0.23;
  return (
    <View style={styles.radarCluster}>
      <Radar onPress={onMap} />
      <View style={styles.radarColumn}>
        <Pressable onPress={onPause} style={styles.pauseButton} accessibilityLabel={t('pause.title')}>
          <Icon name="pause" size={17} color={C.text} />
        </Pressable>
        {!compact ? (
          <View style={styles.timePill} pointerEvents="none">
            <Icon name={isNight ? 'moon' : 'sun'} size={13} color={isNight ? '#B9CBDA' : C.accent} />
            <View>
              <AppText variant="label" color={C.text} style={{ fontSize: 12 }}>
                {formatClock(snapshot?.minutes ?? 0)}
              </AppText>
              <AppText variant="micro" color={C.textMuted} style={{ fontSize: 7 }}>
                {t('hud.day', { day: snapshot?.day ?? 1 })}
              </AppText>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ToastStack({ top }: { top: number }) {
  const toasts = useSession((s) => s.toasts);
  const { width } = useWindowDimensions();
  return (
    <View style={[styles.toastWrap, { top, maxWidth: Math.min(400, width * 0.5) }]} pointerEvents="none">
      {toasts.map((toast) => (
        <Toast key={toast.id} icon={toast.icon} kind={toast.kind} text={toast.text} />
      ))}
    </View>
  );
}

function Toast({ text, icon, kind }: { text: string; icon?: string; kind: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(-8)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [opacity, translate]);
  const color =
    kind === 'warn' ? C.warning : kind === 'error' ? C.danger : kind === 'gain' ? C.text : kind === 'story' ? C.accent : C.textSecondary;
  return (
    <Animated.View
      style={[
        styles.toast,
        { opacity, transform: [{ translateY: translate }], borderColor: kind === 'story' ? C.accentLine : C.border },
      ]}
    >
      <Icon name={icon ?? (kind === 'story' ? 'sparkle' : kind === 'warn' ? 'alert' : 'leaf')} size={14} color={color} />
      <AppText variant="caption" color={color} numberOfLines={2} style={{ flexShrink: 1 }}>
        {text}
      </AppText>
    </Animated.View>
  );
}

function TutorialCoach({ hintKey, bottomOffset }: { hintKey: string; bottomOffset: number }) {
  const { t } = useT();
  const dismiss = useSession((s) => s.dismissTutorial);
  const skip = useSession((s) => s.skipTutorial);
  return (
    <View style={[styles.coach, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={styles.coachIcon}>
        <Icon name="sparkle" size={17} color={C.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="micro" color={C.accent}>
          {t('tutorial.title')}
        </AppText>
        <AppText variant="body" color={C.text} style={{ marginTop: 2 }}>
          {t(hintKey)}
        </AppText>
      </View>
      <View style={{ gap: 4 }}>
        <Button label={t('tutorial.got_it')} compact variant="primary" onPress={dismiss} />
        <Pressable onPress={skip} accessibilityLabel={t('tutorial.skip')}>
          <AppText variant="micro" color={C.textMuted} align="center">
            {t('tutorial.skip')}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

function RestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const sleep = useSession((s) => s.sleep);
  if (!open) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: C.scrimStrong }]} onPress={onClose} />
      <View style={styles.dialog}>
        <View style={styles.dialogIcon}>
          <Icon name="sunrise" size={26} color={C.accent} />
        </View>
        <AppText variant="title" align="center">
          {t('interact.sleep')}
        </AppText>
        <AppText variant="body" color={C.textMuted} align="center" style={{ marginTop: 6 }}>
          {t('toast.slept')}
        </AppText>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button
            label={t('common.confirm')}
            icon="sunrise"
            onPress={() => {
              onClose();
              sleep();
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  profile: {
    width: 224,
    padding: 8,
    borderRadius: R.md,
    backgroundColor: 'rgba(5,13,11,0.72)',
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  context: {
    flex: 1,
    maxWidth: 300,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: R.md,
    backgroundColor: 'rgba(5,13,11,0.72)',
    borderWidth: 1,
    borderColor: C.border,
    gap: 2,
  },
  enemyCard: { borderColor: 'rgba(217,129,112,0.4)', backgroundColor: 'rgba(24,10,9,0.8)' },
  contextHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  questDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent },
  enemyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.danger },
  questBar: { height: 3, borderRadius: 2, backgroundColor: 'rgba(233,240,226,0.12)', marginTop: 4, overflow: 'hidden' },
  questFill: { height: 3, backgroundColor: C.accent, borderRadius: 2 },
  goalDivider: { height: 1, backgroundColor: C.border, marginTop: 4 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  radarCluster: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  radarColumn: { alignItems: 'center', gap: 6, paddingTop: 1 },
  pauseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(5,13,11,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: R.sm,
    backgroundColor: 'rgba(5,13,11,0.72)',
    borderWidth: 1,
    borderColor: C.border,
  },
  savePill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.pill,
    backgroundColor: 'rgba(5,13,11,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(147,192,140,0.3)',
  },
  fps: { position: 'absolute' },
  threatEdge: { opacity: 0.8 },
  toastWrap: { position: 'absolute', alignSelf: 'center', gap: 5, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: R.pill,
    backgroundColor: 'rgba(5,13,11,0.85)',
    borderWidth: 1,
    maxWidth: '100%',
  },
  coach: {
    position: 'absolute',
    left: '18%',
    right: '18%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: R.lg,
    backgroundColor: 'rgba(9,21,17,0.94)',
    borderWidth: 1,
    borderColor: C.accentLine,
  },
  coachIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    position: 'absolute',
    alignSelf: 'center',
    top: '28%',
    width: 380,
    padding: 22,
    borderRadius: R.xl,
    backgroundColor: 'rgba(10,21,17,0.98)',
    borderWidth: 1,
    borderColor: C.borderStrong,
    alignItems: 'center',
  },
  dialogIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
});
