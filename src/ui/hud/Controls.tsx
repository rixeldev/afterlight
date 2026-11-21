import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { C, FONT, R, SP } from '../theme';
import { Icon } from '../components/Icon';
import { AppText, ProgressRing } from '../components/Primitives';
import { useSettings, useT } from '../../state/settingsStore';
import { isSimulationPaused, useSession, type Panel } from '../../state/sessionStore';
import { inputState, rotateCamera, setMove } from '../../game/runtime/input';
import { getEngine } from '../../game/runtime/session';
import type { GameSnapshot } from '../../game/engine/GameEngine';

export function CameraDragLayer() {
  const sensitivity = useSettings((s) => s.settings.cameraSensitivity);
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isSimulationPaused(),
        onMoveShouldSetPanResponder: (_, g) => !isSimulationPaused() && Math.abs(g.dx) + Math.abs(g.dy) > 4,
        onPanResponderMove: (_, g) => {
          if (isSimulationPaused()) return;
          rotateCamera(g.dx, g.dy, sensitivityRef.current);
        },
      }),
    [],
  );
  return <View style={StyleSheet.absoluteFill} {...responder.panHandlers} />;
}

const JOY_SIZE = 118;
const KNOB = 52;

export function Joystick({ leftHanded }: { leftHanded: boolean }) {
  const knob = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [active, setActive] = useState(false);
  const max = (JOY_SIZE - KNOB) / 2;

  const reset = useCallback(() => {
    setMove(0, 0);
    setActive(false);
    Animated.spring(knob, { toValue: { x: 0, y: 0 }, useNativeDriver: false, speed: 28, bounciness: 6 }).start();
  }, [knob]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => setActive(true),
        onPanResponderMove: (_, g) => {
          const len = Math.hypot(g.dx, g.dy);
          const clamped = len > max ? max / len : 1;
          const x = g.dx * clamped;
          const y = g.dy * clamped;
          knob.setValue({ x, y });
          setMove(x / max, -y / max);
        },
        onPanResponderRelease: reset,
        onPanResponderTerminate: reset,
        onPanResponderTerminationRequest: () => false,
      }),
    [knob, max, reset],
  );

  return (
    <View
      style={[
        styles.joyWrap,
        leftHanded ? { left: undefined, right: 18 } : { left: 18 },
      ]}
      {...responder.panHandlers}
      accessibilityLabel="Movement joystick"
    >
      <View style={[styles.joyRing, active ? { borderColor: C.accentLine, backgroundColor: 'rgba(232,201,143,0.08)' } : null]}>
        <View style={styles.joyCardinal}>
          <Icon name="chevron_down" size={12} color="rgba(233,240,226,0.25)" />
        </View>
      </View>
      <Animated.View
        style={[
          styles.joyKnob,
          {
            transform: [{ translateX: knob.x }, { translateY: knob.y }],
            backgroundColor: active ? 'rgba(232,201,143,0.32)' : 'rgba(233,240,226,0.13)',
            borderColor: active ? C.accent : 'rgba(233,240,226,0.22)',
          },
        ]}
      >
        <View style={styles.joyDot} />
      </Animated.View>
    </View>
  );
}

export function SprintButton({ leftHanded }: { leftHanded: boolean }) {
  const [sprint, setSprint] = useState(inputState.sprint);
  const stamina = useSession((s) => s.snapshot?.player.stamina ?? 100);
  useEffect(() => {
    if (stamina < 8 && inputState.sprint) {
      inputState.sprint = false;
      setSprint(false);
    }
  }, [stamina]);
  const toggle = () => {
    const next = !inputState.sprint;
    inputState.sprint = next;
    setSprint(next);
  };
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: sprint }}
      accessibilityLabel="Sprint"
      style={[
        styles.sprint,
        leftHanded ? { left: undefined, right: 148 } : null,
        sprint ? { backgroundColor: C.accentDim, borderColor: C.accentLine } : null,
      ]}
    >
      <Icon name="energy" size={20} color={sprint ? C.accent : C.textSecondary} />
      <AppText variant="micro" color={sprint ? C.accent : C.textMuted}>
        {sprint ? 'ON' : 'RUN'}
      </AppText>
    </Pressable>
  );
}

type HudAction =
  | { type: 'none' }
  | { type: 'gather' }
  | { type: 'craft' }
  | { type: 'storage'; id: string }
  | { type: 'rest'; id: string }
  | { type: 'collect'; id: string }
  | { type: 'gate' };

function resolveAction(snapshot: GameSnapshot | null): HudAction {
  const target = snapshot?.interaction;
  if (!target) return { type: 'none' };
  if (target.kind === 'gather') return { type: 'gather' };
  if (target.kind === 'campfire' || target.kind === 'workbench') return { type: 'craft' };
  if (target.kind === 'storage' && target.structureId) return { type: 'storage', id: target.structureId };
  if (target.kind === 'shelter') return { type: 'rest', id: target.id };
  if (target.kind === 'collect' && target.structureId) return { type: 'collect', id: target.structureId };
  if (target.kind === 'gate') return { type: 'gate' };
  if (target.kind === 'sleep') return { type: 'rest', id: 'bedroll' };
  return { type: 'none' };
}

export function ActionCluster({
  leftHanded,
  onRest,
}: {
  leftHanded: boolean;
  onRest: (id: string) => void;
}) {
  const { t } = useT();
  const snapshot = useSession((s) => s.snapshot);
  const openPanel = useSession((s) => s.openPanel);
  const collectStructure = useSession((s) => s.collectStructure);
  const attack = useSession((s) => s.attack);
  const action = resolveAction(snapshot);
  const target = snapshot?.interaction;
  const progress = snapshot?.action?.progress ?? 0;
  const isGathering = snapshot?.action?.active ?? false;
  const threat = snapshot?.threat;
  const attackFlash = snapshot?.attackFlash ?? 0;

  const handlePressIn = () => {
    const engine = getEngine();
    if (!engine) return;
    switch (action.type) {
      case 'gather':
        engine.pressInteract();
        break;
      case 'craft':
        openPanel('craft');
        break;
      case 'storage':
        openPanel('storage', action.id);
        break;
      case 'rest':
        onRest(action.id);
        break;
      case 'collect':
        collectStructure(action.id);
        break;
      case 'gate':
        engine.pressInteract();
        break;
      default:
        break;
    }
  };
  const handlePressOut = () => {
    if (action.type === 'gather') getEngine()?.releaseInteract();
  };

  const label = target ? t(target.labelKey) : t('interact.hold');
  const disabled = action.type === 'none';

  return (
    <View
      style={[styles.actionWrap, leftHanded ? { left: 18, right: undefined, alignItems: 'flex-start' } : null]}
      pointerEvents="box-none"
    >
      <View style={styles.actionRow}>
        <Pressable
          onPress={attack}
          accessibilityLabel="Attack"
          style={[
            styles.attackButton,
            threat ? { borderColor: 'rgba(217,129,112,0.6)', backgroundColor: 'rgba(217,129,112,0.14)' } : null,
          ]}
        >
          <Icon name="sword" size={22} color={threat ? '#F0B3A4' : C.textSecondary} />
          {attackFlash > 0.2 ? <View style={styles.attackFlash} pointerEvents="none" /> : null}
        </Pressable>
        {target ? (
          <View style={styles.actionLabel} pointerEvents="none">
            <AppText variant="caption" color={C.text} numberOfLines={1} style={{ fontWeight: '600' }}>
              {label}
            </AppText>
            {action.type === 'gather' && !isGathering ? (
              <AppText variant="micro" color={C.textMuted}>
                {t('interact.hold')}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>

      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.actionButton,
          disabled ? { opacity: 0.5 } : null,
          pressed ? { transform: [{ scale: 0.97 }] } : null,
          action.type === 'gather' ? { borderColor: C.accentLine } : null,
        ]}
      >
        <ProgressRing
          progress={isGathering ? progress : 0}
          size={92}
          stroke={5}
          color={C.accent}
          track="rgba(233,240,226,0.14)"
        >
          <View style={styles.actionInner}>
            <Icon
              name={
                action.type === 'gather'
                  ? 'hand'
                  : action.type === 'craft'
                    ? 'craft'
                    : action.type === 'storage'
                      ? 'bag'
                      : action.type === 'rest'
                        ? 'home'
                        : action.type === 'collect'
                          ? 'sparkle'
                          : 'target'
              }
              size={30}
              color={disabled ? C.textMuted : C.accent}
            />
          </View>
        </ProgressRing>
      </Pressable>
      <View style={[styles.attackSpacer]} />
    </View>
  );
}

const DOCK_ITEMS: { id: Panel | 'build'; icon: string; labelKey: string }[] = [
  { id: 'inventory', icon: 'backpack', labelKey: 'inv.title' },
  { id: 'craft', icon: 'craft', labelKey: 'craft.title' },
  { id: 'build', icon: 'home', labelKey: 'build.title' },
  { id: 'map', icon: 'map', labelKey: 'map.title' },
  { id: 'journal', icon: 'quest', labelKey: 'journal.title' },
];

export function Dock({ leftHanded }: { leftHanded: boolean }) {
  const { t } = useT();
  const openPanel = useSession((s) => s.openPanel);
  const startBuild = useSession((s) => s.startBuild);
  const panel = useSession((s) => s.panel);
  const crafting = useSession((s) => s.snapshot?.crafting.length ?? 0);
  const takeCount = useSession((s) => {
    const structures = s.snapshot?.structures ?? [];
    return structures.reduce((n, st) => n + (st.pending ?? 0), 0);
  });
  return (
    <View style={[styles.dock, leftHanded ? { left: SP.md, right: undefined } : { right: SP.md }]}>
      {DOCK_ITEMS.map((item) => {
        const active = panel === item.id;
        const badge = item.id === 'craft' ? crafting : item.id === 'build' ? takeCount : 0;
        return (
          <Pressable
            key={item.id}
            onPress={() => {
              if (item.id === 'build') startBuild();
              else openPanel(item.id as Panel);
            }}
            accessibilityRole="button"
            accessibilityLabel={t(item.labelKey)}
            style={[styles.dockButton, active ? styles.dockButtonActive : null]}
          >
            <Icon name={item.icon} size={20} color={active ? C.accent : C.textSecondary} />
            <AppText variant="micro" color={active ? C.accent : C.textMuted} style={{ fontSize: 8 }}>
              {t(item.labelKey)}
            </AppText>
            {badge > 0 ? (
              <View style={styles.dockBadge}>
                <AppText variant="micro" color={C.ink} style={{ fontSize: 8 }}>
                  {badge}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function BuildControls() {
  const { t } = useT();
  const snapshot = useSession((s) => s.snapshot);
  const closePanel = useSession((s) => s.closePanel);
  const confirmBuild = useSession((s) => s.confirmBuild);
  const rotateGhost = useSession((s) => s.rotateGhost);
  const selectBuild = useSession((s) => s.selectBuild);
  const ghost = snapshot?.build;
  const structures = snapshot?.structures ?? [];
  const [selected, setSelected] = useState(ghost?.defId ?? 'campfire');

  useEffect(() => {
    if (ghost?.defId) setSelected(ghost.defId);
  }, [ghost?.defId]);

  const options = [
    { id: 'campfire', icon: 'energy', nameKey: 'structure.campfire.name' },
    { id: 'simple_shelter', icon: 'home', nameKey: 'structure.simple_shelter.name' },
    { id: 'workbench', icon: 'craft', nameKey: 'structure.workbench.name' },
    { id: 'storage_crate', icon: 'bag', nameKey: 'structure.storage_crate.name' },
    { id: 'water_collector', icon: 'water', nameKey: 'structure.water_collector.name' },
    { id: 'crop_plot', icon: 'food', nameKey: 'structure.crop_plot.name' },
  ];
  const reasonKey = ghost ? `build.invalid.${ghost.reason}` : 'build.needs_plot';

  return (
    <View style={styles.buildWrap} pointerEvents="box-none">
      <View style={styles.buildPanel}>
        <View style={styles.buildHeader}>
          <View style={{ flex: 1 }}>
            <AppText variant="micro" color={C.textMuted}>
              {t('build.title')}
            </AppText>
            <AppText variant="heading">{ghost ? t(`structure.${ghost.defId}.name`) : t('build.placing', { name: '' })}</AppText>
          </View>
          <Pressable onPress={closePanel} style={styles.buildClose} accessibilityLabel={t('build.exit')}>
            <Icon name="close" size={18} color={C.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.buildChipsRow}>
          <View
            style={[
              styles.buildStatus,
              {
                borderColor: ghost?.valid ? 'rgba(147,192,140,0.4)' : 'rgba(217,129,112,0.45)',
                backgroundColor: ghost?.valid ? 'rgba(147,192,140,0.12)' : 'rgba(217,129,112,0.12)',
              },
            ]}
          >
            <Icon name={ghost?.valid ? 'check' : 'alert'} size={13} color={ghost?.valid ? C.success : C.danger} />
            <AppText variant="caption" color={ghost?.valid ? C.success : C.danger}>
              {ghost?.valid ? (ghost.affordable ? t('build.invalid.ok') : t('toast.missing_items')) : t(reasonKey)}
            </AppText>
          </View>
          {ghost
            ? Object.entries(ghost.cost).map(([id, qty]) => (
                <View key={id} style={styles.costChip}>
                  <AppText variant="caption" color={C.textSecondary}>
                    {t(`item.${id}.name`)}
                  </AppText>
                  <AppText variant="caption" color={C.accent}>
                    ×{qty}
                  </AppText>
                </View>
              ))
            : null}
        </View>

        <View style={styles.buildButtonsRow}>
          <View style={styles.buildRotate}>
            <Pressable onPress={rotateGhost} style={styles.buildIconButton} accessibilityLabel={t('build.rotate')}>
              <Icon name="rotate" size={20} color={C.text} />
            </Pressable>
            <AppText variant="micro" color={C.textMuted}>
              {t('build.rotate')}
            </AppText>
          </View>
          <Pressable
            onPress={confirmBuild}
            disabled={!ghost?.valid || !ghost.affordable}
            style={[
              styles.buildConfirm,
              !ghost?.valid || !ghost.affordable ? { opacity: 0.45 } : null,
            ]}
            accessibilityLabel={t('build.confirm')}
          >
            <Icon name="check" size={18} color={C.ink} />
            <AppText variant="label" color={C.ink} style={{ fontFamily: FONT.semibold }}>
              {t('build.confirm')}
            </AppText>
          </Pressable>
        </View>

        <View style={styles.carousel}>
          {options.map((opt) => {
            const isSelected = selected === opt.id;
            const built = structures.some((s) => s.defId === opt.id);
            const uniqueBuilt = built && ['campfire', 'simple_shelter', 'workbench', 'storage_crate', 'water_collector'].includes(opt.id);
            return (
              <Pressable
                key={opt.id}
                onPress={() => {
                  if (uniqueBuilt) return;
                  setSelected(opt.id);
                  selectBuild(opt.id);
                }}
                style={[
                  styles.buildCard,
                  isSelected ? { borderColor: C.accentLine, backgroundColor: C.accentDim } : null,
                  uniqueBuilt ? { opacity: 0.35 } : null,
                ]}
                disabled={uniqueBuilt}
              >
                <Icon name={opt.icon} size={19} color={isSelected ? C.accent : C.textSecondary} />
                <AppText variant="micro" color={isSelected ? C.accent : C.textMuted} numberOfLines={1} style={{ fontSize: 8 }}>
                  {t(opt.nameKey)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="micro" color={C.textMuted} align="center" style={{ marginTop: 4 }}>
          {t('build.move_hint')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  joyWrap: {
    position: 'absolute',
    bottom: 16,
    width: JOY_SIZE + 24,
    height: JOY_SIZE + 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joyRing: {
    width: JOY_SIZE,
    height: JOY_SIZE,
    borderRadius: JOY_SIZE / 2,
    borderWidth: 1.4,
    borderColor: 'rgba(233,240,226,0.16)',
    backgroundColor: 'rgba(6,14,12,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joyCardinal: { position: 'absolute', top: 6 },
  joyKnob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(242,238,226,0.45)' },
  sprint: {
    position: 'absolute',
    bottom: 24,
    right: 148,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.glass,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  actionWrap: {
    position: 'absolute',
    bottom: 18,
    right: 18,
    alignItems: 'flex-end',
  },
  actionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 8 },
  actionLabel: {
    maxWidth: 180,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: R.pill,
    backgroundColor: 'rgba(6,14,12,0.62)',
    borderWidth: 1,
    borderColor: C.border,
  },
  attackButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attackFlash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.14)' },
  actionButton: {
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    backgroundColor: 'rgba(8,19,15,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionInner: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attackSpacer: { height: 0 },
  dock: {
    position: 'absolute',
    bottom: 18,
    right: 18,
    flexDirection: 'row',
    gap: 4,
    padding: 6,
    borderRadius: R.lg,
    backgroundColor: 'rgba(6,14,12,0.6)',
    borderWidth: 1,
    borderColor: C.border,
  },
  dockButton: {
    width: 56,
    height: 50,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dockButtonActive: { backgroundColor: C.accentDim },
  dockBadge: {
    position: 'absolute',
    top: 4,
    right: 6,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  buildWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  buildPanel: {
    width: '78%',
    maxWidth: 760,
    marginBottom: 12,
    padding: 12,
    borderRadius: R.lg,
    backgroundColor: 'rgba(8,19,15,0.9)',
    borderWidth: 1,
    borderColor: C.borderStrong,
    gap: 8,
  },
  buildHeader: { flexDirection: 'row', alignItems: 'center' },
  buildClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  buildStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: R.pill,
    borderWidth: 1,
  },
  costChip: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.border,
  },
  buildButtonsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  buildRotate: { alignItems: 'center', gap: 2 },
  buildIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildConfirm: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 46,
    borderRadius: R.md,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carousel: { flexDirection: 'row', gap: 6 },
  buildCard: {
    flex: 1,
    height: 54,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.glass,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
});
