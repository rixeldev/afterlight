import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, R } from '../theme';
import { Icon } from '../components/Icon';
import { AppText, Button, MeterBar, ProgressRing } from '../components/Primitives';
import { useSettings, useT } from '../../state/settingsStore';
import { currentTutorialHint, useSession } from '../../state/sessionStore';
import { xpForNextLevel } from '../../game/progression/progression';
import { REGION, POIS } from '../../data/world';
import { questStep } from '../../data/quests';
import { ActionCluster, BuildControls, CameraDragLayer, Dock, Joystick } from './Controls';
import { formatClock } from '../../i18n';
import { renderStats } from '../../game/rendering/stats';

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
 const compact = width < 820;
  const hint = tutorialVisible && !rendererFailed ? currentTutorialHint(snapshot) : null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <CameraDragLayer />

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

      {/* ── top cluster ─────────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8, paddingLeft: insets.left + 14, paddingRight: insets.right + 14 }]} pointerEvents="box-none">
        <VitalsCard />
        <QuestTracker onPress={() => openPanel('journal')} hidden={compact && snapshot.threat !== null} />
        <View style={styles.topRight} pointerEvents="box-none">
          {!compact ? <Compass /> : null}
          <TimeChip />
          <Pressable
            onPress={() => openPanel('pause')}
            style={styles.pauseButton}
            accessibilityLabel={t('pause.title')}
          >
            <Icon name="pause" size={17} color={C.text} />
          </Pressable>
        </View>
      </View>

      {showFps ? (
        <View style={[styles.fps, { top: insets.top + 108, left: insets.left + 16 }]} pointerEvents="none">
          <AppText variant="micro" color={C.textMuted}>
            {t('hud.fps', { fps })} · {draws} dc
          </AppText>
        </View>
      ) : null}

      {snapshot.threat ? (
        <View style={[styles.threatChip, { top: insets.top + 8 }]} pointerEvents="none">
          <View style={styles.threatDot} />
          <AppText variant="caption" color="#F0B3A4">
            {t('threat.name')} · {Math.round(snapshot.threat.distance)} m
          </AppText>
        </View>
      ) : null}

      {savePulse ? (
        <View style={[styles.savePill, { top: insets.top + 8 }]} pointerEvents="none">
          <Icon name="check" size={12} color={C.success} />
          <AppText variant="micro" color={C.success}>
            {t('hud.autosaved')}
          </AppText>
        </View>
      ) : null}

      <ToastStack top={insets.top + 96} />

      {/* ── bottom controls ─────────────────────────────────────────── */}
      {panel === 'build' ? (
        <BuildControls />
      ) : (
        <>
          <Joystick leftHanded={leftHanded} />
          <ActionCluster leftHanded={leftHanded} onRest={() => setRestOpen(true)} />
          <Dock />
        </>
      )}

      {hint ? (
        <TutorialCoach hintKey={hint.hintKey} bottomOffset={panel === 'build' ? 250 : 190} />
      ) : null}

      <RestDialog open={restOpen} onClose={() => setRestOpen(false)} />
    </View>
  );
}

function VitalsCard() {
  const { t } = useT();
  const snapshot = useSession((s) => s.snapshot);
  const player = snapshot?.player;
  const saving = useSession((s) => s.saving);
  if (!player) return null;
  const xpNeeded = xpForNextLevel(player.level);
  const xpProgress = Math.min(1, player.xp / xpNeeded);
  const totalInv = snapshot?.inventory.slots.reduce((n, s) => n + (s ? 1 : 0), 0) ?? 0;
  const cap = snapshot?.capacity ?? 24;
  return (
    <View style={styles.vitals} pointerEvents="none">
      <View style={styles.vitalsRow}>
        <ProgressRing progress={xpProgress} size={44} stroke={3} color={C.accent} track="rgba(233,240,226,0.14)">
          <AppText variant="label" color={C.text} style={{ fontFamily: FONT.display }}>
            {player.level}
          </AppText>
        </ProgressRing>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.vitalLine}>
            <Icon name="health" size={14} color={C.health} />
            <MeterBar value={player.health} color={C.health} height={6} style={{ flex: 1 }} />
            <AppText variant="micro" color={C.textMuted} style={{ width: 24, textAlign: 'right' }}>
              {Math.round(player.health)}
            </AppText>
          </View>
          <View style={styles.vitalLine}>
            <Icon name="food" size={13} color={C.hunger} />
            <MeterBar value={player.hunger} color={C.hunger} height={4} style={{ flex: 1 }} />
            <Icon name="water" size={13} color={C.thirst} />
            <MeterBar value={player.thirst} color={C.thirst} height={4} style={{ flex: 1 }} />
          </View>
          <View style={styles.vitalLine}>
            <Icon name="energy" size={13} color={C.stamina} />
            <MeterBar value={player.stamina} color={C.stamina} height={4} style={{ flex: 1 }} />
            <AppText variant="micro" color={C.textMuted}>
              {totalInv}/{cap}
            </AppText>
          </View>
        </View>
      </View>
      {saving ? (
        <AppText variant="micro" color={C.textMuted} style={{ marginTop: 4 }}>
          {t('hud.autosaving')}
        </AppText>
      ) : null}
    </View>
  );
}

function QuestTracker({ onPress, hidden }: { onPress: () => void; hidden?: boolean }) {
  const { t } = useT();
  const snapshot = useSession((s) => s.snapshot);
  if (!snapshot || hidden) return null;
  const step = snapshot.quest.activeStep ? questStep(snapshot.quest.activeStep) : null;
  if (!step) return null;
  const done = step.objectives.filter((o) => {
    const value = snapshot.quest.progress[`${step.id}:${o.id}`] ?? 0;
    return value >= (o.amount ?? 1);
  }).length;
  const total = step.objectives.length;
  const next = step.objectives.find((o) => {
    const value = snapshot.quest.progress[`${step.id}:${o.id}`] ?? 0;
    return value < (o.amount ?? 1);
  });
  const nextValue = next ? snapshot.quest.progress[`${step.id}:${next.id}`] ?? 0 : 0;
  return (
    <Pressable onPress={onPress} style={styles.questCard} accessibilityRole="button" accessibilityLabel={t('journal.title')}>
      <View style={styles.questHeader}>
        <View style={styles.questDot} />
        <AppText variant="micro" color={C.accent} numberOfLines={1}>
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
          {next.amount && next.amount > 1
            ? ` · ${Math.min(next.amount, Math.floor(nextValue))}/${next.amount}`
            : ''}
        </AppText>
      ) : (
        <AppText variant="caption" color={C.success}>
          {t('journal.completed')}
        </AppText>
      )}
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

function Compass() {
  const snapshot = useSession((s) => s.snapshot);
  const tune = (deg: number) => ((deg % 360) + 360) % 360;
  const player = snapshot?.player;
  if (!snapshot || !player) return null;
  const heading = tune((-snapshot.cameraYaw * 180) / Math.PI);
  const cardinals = [
    { label: 'N', bearing: 0 },
    { label: 'E', bearing: 90 },
    { label: 'S', bearing: 180 },
    { label: 'W', bearing: 270 },
  ];
  const step = snapshot.quest.activeStep ? questStep(snapshot.quest.activeStep) : null;
  let target: { x: number; z: number } | null = null;
  if (step) {
    if (step.id === 'signal' || step.id === 'recording') {
      const poi = POIS.find((p) => p.id === 'ranger_camp');
      if (poi) target = { x: poi.x, z: poi.z };
    } else {
      target = { x: REGION.camp.x, z: REGION.camp.z };
    }
  }
  let questOffset: number | null = null;
  if (target) {
    const bearing = (Math.atan2(target.x - player.x, -(target.z - player.z)) * 180) / Math.PI;
    let delta = tune(bearing - heading);
    if (delta > 180) delta -= 360;
    questOffset = Math.max(-62, Math.min(62, delta * 1.15));
  }
  return (
    <View style={styles.compass} pointerEvents="none">
      <View style={styles.compassLine} />
      {cardinals.map((card) => {
        let delta = tune(card.bearing - heading);
        if (delta > 180) delta -= 360;
        if (Math.abs(delta) > 62) return null;
        return (
          <AppText
            key={card.label}
            variant="micro"
            color={Math.abs(delta) < 8 ? C.accent : C.textMuted}
            style={{ position: 'absolute', left: 62 + delta * 1.15 - 5 }}
          >
            {card.label}
          </AppText>
        );
      })}
      {questOffset !== null ? (
        <View style={{ position: 'absolute', left: 62 + questOffset, top: 18 }}>
          <Icon name="chevron_down" size={11} color={C.accent} />
        </View>
      ) : null}
      <View style={styles.compassNeedle} />
    </View>
  );
}

function TimeChip() {
  const { t } = useT();
  const snapshot = useSession((s) => s.snapshot);
  if (!snapshot) return null;
  const isNight = snapshot.timeOfDay > 0.79 || snapshot.timeOfDay < 0.23;
  return (
    <View style={styles.timeChip} pointerEvents="none">
      <Icon name={isNight ? 'moon' : 'sunrise'} size={15} color={isNight ? '#B9CBDA' : C.accent} />
      <View>
        <AppText variant="label" color={C.text} style={{ fontSize: 13 }}>
          {formatClock(snapshot.minutes)}
        </AppText>
        <AppText variant="micro" color={C.textMuted} style={{ fontSize: 8 }}>
          {t('hud.day', { day: snapshot.day })}
        </AppText>
      </View>
    </View>
  );
}

function ToastStack({ top }: { top: number }) {
  const toasts = useSession((s) => s.toasts);
  const { width } = useWindowDimensions();
  return (
    <View style={[styles.toastWrap, { top, maxWidth: Math.min(420, width * 0.5) }]} pointerEvents="none">
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
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY: translate }], borderColor: kind === 'story' ? C.accentLine : C.border }]}>
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
    justifyContent: 'space-between',
    gap: 10,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vitals: {
    minWidth: 214,
    padding: 9,
    borderRadius: R.lg,
    backgroundColor: 'rgba(5,13,11,0.62)',
    borderWidth: 1,
    borderColor: C.border,
  },
  vitalsRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  vitalLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  questCard: {
    flex: 1,
    maxWidth: 300,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: R.md,
    backgroundColor: 'rgba(5,13,11,0.62)',
    borderWidth: 1,
    borderColor: C.border,
    gap: 2,
  },
  questHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  questDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent },
  questBar: { height: 3, borderRadius: 2, backgroundColor: 'rgba(233,240,226,0.12)', marginTop: 4, overflow: 'hidden' },
  questFill: { height: 3, backgroundColor: C.accent, borderRadius: 2 },
  goalDivider: { height: 1, backgroundColor: C.border, marginTop: 5 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  compass: {
    width: 124,
    height: 40,
    borderRadius: R.pill,
    backgroundColor: 'rgba(5,13,11,0.55)',
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  compassLine: { position: 'absolute', width: 96, height: 1, backgroundColor: 'rgba(233,240,226,0.18)' },
  compassNeedle: { position: 'absolute', bottom: 4, width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: C.accent },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: R.md,
    backgroundColor: 'rgba(5,13,11,0.62)',
    borderWidth: 1,
    borderColor: C.border,
  },
  pauseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(5,13,11,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fps: { position: 'absolute' },
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
  threatChip: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: 'rgba(39,14,12,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(217,129,112,0.45)',
  },
  threatDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.danger },
  threatEdge: { opacity: 0.8 },
  toastWrap: { position: 'absolute', alignSelf: 'center', gap: 5, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: R.pill,
    backgroundColor: 'rgba(5,13,11,0.82)',
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
