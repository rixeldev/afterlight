import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { C, R } from '../theme';
import { AppText, Chip, Sheet } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useT } from '../../state/settingsStore';
import { useSession } from '../../state/sessionStore';
import { POIS, REGION } from '../../data/world';
import { questStep } from '../../data/quests';
import { getEngine } from '../../game/runtime/session';

export function MapPanel() {
  const { t } = useT();
  const open = useSession((s) => s.panel === 'map');
  const close = useSession((s) => s.closePanel);
  const snapshot = useSession((s) => s.snapshot);
  const engine = getEngine();

  const forest = useMemo(() => {
    const nodes = engine?.nodes ?? [];
    return nodes
      .filter((n) => n.kind === 'tree')
      .map((n) => ({ x: n.x, z: n.z, s: n.scale }))
      .slice(0, 160);
  }, [engine]);

  if (!snapshot) return null;
  const player = snapshot.player;
  const discoveries = snapshot.discoveries;
  const step = snapshot.quest.activeStep ? questStep(snapshot.quest.activeStep) : null;
  let questTarget: { x: number; z: number } | null = null;
  if (step) {
    if (step.id === 'signal' || step.id === 'recording') {
      const poi = POIS.find((p) => p.id === 'ranger_camp');
      if (poi) questTarget = { x: poi.x, z: poi.z };
    } else if (step.id === 'return_home') {
      questTarget = { x: REGION.camp.x, z: REGION.camp.z };
    }
  }
  const facingDeg = -(player.facing * 180) / Math.PI;
  const discoveredCount = discoveries.filter((d) => d !== 'silent_gate').length;
  const total = POIS.filter((p) => p.id !== 'silent_gate').length;

  return (
    <Sheet
      visible={open}
      onClose={close}
      title={t('map.title')}
      subtitle={t('map.subtitle')}
      closeLabel={t('common.close')}
      maxWidth={1100}
    >
      <View style={styles.row}>
        <View style={styles.mapCard}>
          <Svg viewBox="-84 -84 168 168" width="100%" height="100%">
            <Rect x={-84} y={-84} width={168} height={168} fill="#12211B" rx={6} />
            {Array.from({ length: 17 }).map((_, i) => (
              <G key={i} opacity={0.1}>
                <Line x1={-80 + i * 10} y1={-80} x2={-80 + i * 10} y2={80} stroke="#9FB49A" strokeWidth={0.15} />
                <Line x1={-80} y1={-80 + i * 10} x2={80} y2={-80 + i * 10} stroke="#9FB49A" strokeWidth={0.15} />
              </G>
            ))}
            <Circle cx={0} cy={0} r={REGION.playRadius} fill="none" stroke="#41584A" strokeWidth={0.5} strokeDasharray="2 2" />
            <Ellipse cx={REGION.lake.x} cy={REGION.lake.z} rx={REGION.lake.rx} ry={REGION.lake.rz} fill="#2C4C4F" opacity={0.95} />
            <Ellipse cx={REGION.lake.x} cy={REGION.lake.z} rx={REGION.lake.rx + 2.4} ry={REGION.lake.rz + 2.4} fill="#3E5340" opacity={0.35} />
            {/* forest texture */}
            {forest.map((tree, i) => (
              <Circle key={i} cx={tree.x} cy={tree.z} r={0.75 * tree.s} fill="#2F4A38" opacity={0.7} />
            ))}
            {/* likely paths */}
            <Path
              d="M0 4 Q14 -8 26 -22 T32 -36"
              fill="none"
              stroke="rgba(232,201,143,0.25)"
              strokeWidth={0.7}
              strokeDasharray="1.6 1.6"
            />
            <Path
              d="M0 4 Q-16 12 -30 22 T-34 26"
              fill="none"
              stroke="rgba(232,201,143,0.2)"
              strokeWidth={0.7}
              strokeDasharray="1.6 1.6"
            />
            <Path
              d="M0 4 Q4 24 10 42 T14 46"
              fill="none"
              stroke="rgba(232,201,143,0.18)"
              strokeWidth={0.7}
              strokeDasharray="1.6 1.6"
            />

            {/* structures */}
            {snapshot.structures.map((s) => (
              <Rect key={s.id} x={s.x - 0.9} y={s.z - 0.9} width={1.8} height={1.8} rx={0.4} fill={C.accent} opacity={0.9} />
            ))}

            {/* POIs */}
            {POIS.map((poi) => {
              const known = discoveries.includes(poi.id);
              const locked = poi.locked;
              return (
                <G key={poi.id}>
                  {known ? (
                    <>
                      <Circle cx={poi.x} cy={poi.z} r={poi.radius * 0.42} fill="rgba(232,201,143,0.08)" stroke="rgba(232,201,143,0.45)" strokeWidth={0.35} />
                      <Circle cx={poi.x} cy={poi.z} r={1.4} fill={locked ? C.textMuted : C.accent} />
                      <Circle cx={poi.x} cy={poi.z} r={2.6} fill="none" stroke={locked ? 'rgba(233,240,226,0.35)' : C.accent} strokeWidth={0.3} />
                    </>
                  ) : (
                    <G opacity={0.5}>
                      <Circle cx={poi.x} cy={poi.z} r={1.8} fill="none" stroke="#6C7A6E" strokeWidth={0.35} strokeDasharray="0.8 0.8" />
                      <SvgText x={poi.x} y={poi.z + 1.2} fill="#8E9E90" fontSize={3} textAnchor="middle">
                        ?
                      </SvgText>
                    </G>
                  )}
                  <SvgText
                    x={poi.x}
                    y={poi.z - (known ? 4.4 : 3.6)}
                    fill={known ? '#E9E5D6' : '#7C8A7E'}
                    fontSize={3.1}
                    textAnchor="middle"
                  >
                    {known ? t(poi.nameKey) : t('map.undiscovered')}
                  </SvgText>
                </G>
              );
            })}

            {/* quest target */}
            {questTarget ? (
              <G>
                <Circle cx={questTarget.x} cy={questTarget.z} r={4.2} fill="none" stroke={C.accent} strokeWidth={0.45} strokeDasharray="1.2 1.2" />
                <Circle cx={questTarget.x} cy={questTarget.z} r={6.3} fill="none" stroke="rgba(232,201,143,0.3)" strokeWidth={0.3} />
              </G>
            ) : null}

            {/* player */}
            <G transform={`translate(${player.x} ${player.z}) rotate(${facingDeg})`}>
              <Circle r={3.4} fill="rgba(6,14,12,0.7)" />
              <Polygon points="0,-3.3 2.4,2.6 0,1.4 -2.4,2.6" fill={C.text} stroke={C.accent} strokeWidth={0.4} />
            </G>
            <SvgText x={player.x} y={player.z + 6.4} fill="#F2EEE2" fontSize={3} textAnchor="middle">
              {t('map.you')}
            </SvgText>

            {/* compass rose */}
            <G transform="translate(70 -70)">
              <Circle r={7} fill="rgba(6,14,12,0.55)" stroke="rgba(233,240,226,0.2)" strokeWidth={0.3} />
              <Polygon points="0,-5.4 1.7,0 0,0 -1.7,0" fill={C.accent} />
              <Polygon points="0,5.4 1.7,0 0,0 -1.7,0" fill="#83968A" />
              <SvgText y={-6.9} fill={C.accent} fontSize={2.6} textAnchor="middle">
                N
              </SvgText>
            </G>
          </Svg>
          <View style={styles.watermark}>
            <Icon name="compass" size={12} color={C.textMuted} />
            <AppText variant="micro" color={C.textMuted}>
              {t('map.discovered', { count: discoveredCount, total })}
            </AppText>
          </View>
        </View>

        <View style={styles.side}>
          <AppText variant="micro" color={C.textMuted}>
            {t('map.legend')}
          </AppText>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: C.accent }]} />
            <AppText variant="caption" color={C.textSecondary}>
              {t('map.homestead')}
            </AppText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: C.stamina }]} />
            <AppText variant="caption" color={C.textSecondary}>
              {t('map.structures')}
            </AppText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendRing]} />
            <AppText variant="caption" color={C.textSecondary}>
              {t('map.marker_quest')}
            </AppText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: C.textMuted }]} />
            <AppText variant="caption" color={C.textSecondary}>
              {t('map.locked')}
            </AppText>
          </View>

          <View style={{ height: 12 }} />
          <AppText variant="micro" color={C.textMuted}>
            {t('journal.title')}
          </AppText>
          {POIS.filter((p) => discoveries.includes(p.id)).map((poi) => (
            <View key={poi.id} style={styles.poiRow}>
              <View style={styles.poiDot} />
              <View style={{ flex: 1 }}>
                <AppText variant="caption" color={C.text}>
                  {t(poi.nameKey)}
                </AppText>
                <AppText variant="micro" color={C.textMuted} numberOfLines={2}>
                  {t(poi.descKey)}
                </AppText>
              </View>
            </View>
          ))}
          <View style={{ height: 12 }} />
          <Chip label={`${t('map.discovered', { count: discoveredCount, total })}`} icon="map" />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  mapCard: {
    flex: 1,
    minWidth: 300,
    aspectRatio: 1,
    maxWidth: 640,
    borderRadius: R.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#0B1714',
  },
  watermark: {
    position: 'absolute',
    left: 10,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: R.pill,
    backgroundColor: 'rgba(6,14,12,0.6)',
  },
  side: { width: 260, gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendRing: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: C.accent },
  poiRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  poiDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent, marginTop: 6 },
});
