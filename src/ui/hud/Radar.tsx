import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { useSession } from '../../state/sessionStore';
import { useT } from '../../state/settingsStore';
import { getEngine } from '../../game/runtime/session';
import { POIS } from '../../data/world';
import { C } from '../theme';
import { Icon } from '../components/Icon';

const RANGE = 40;
const VIEW = 50;

const NODE_COLORS: Record<string, string> = {
  tree: '#7FAF72',
  rock: '#A7ACA2',
  bush: '#C96B5C',
  fiber: '#B6D28A',
  water: '#7FB6C6',
  cache: '#E8C98F',
  crate: '#C9A46C',
};

/** Circular local radar: resources, discoveries, structures and the threat. */
export function Radar({ onPress }: { onPress: () => void }) {
  const { t } = useT();
  const snapshot = useSession((s) => s.snapshot);
  const engine = getEngine();

  const dots = useMemo(() => {
    if (!snapshot) return { nodes: [], pois: [], structures: [] };
    const p = snapshot.player;
    const scale = (VIEW - 7) / RANGE;
    const nodes: { x: number; y: number; color: string; r: number }[] = [];
    for (const node of engine?.nodes ?? []) {
      const st = engine?.state.nodes[node.id];
      if (st && st.charges <= 0 && node.kind !== 'water') continue;
      const dx = node.x - p.x;
      const dz = node.z - p.z;
      if (Math.abs(dx) > RANGE || Math.abs(dz) > RANGE) continue;
      if (Math.hypot(dx, dz) > RANGE) continue;
      nodes.push({
        x: dx * scale,
        y: dz * scale,
        color: NODE_COLORS[node.kind] ?? '#9FB49A',
        r: node.kind === 'tree' ? 1.5 : 1.1,
      });
      if (nodes.length > 90) break;
    }
    const pois = POIS.filter((poi) => snapshot.discoveries.includes(poi.id)).map((poi) => {
      const dx = poi.x - p.x;
      const dz = poi.z - p.z;
      const clamped = Math.min(RANGE, Math.hypot(dx, dz));
      const len = Math.hypot(dx, dz) || 1;
      return {
        x: (dx / len) * clamped * scale,
        y: (dz / len) * clamped * scale,
        locked: Boolean(poi.locked),
        name: t(poi.nameKey),
      };
    });
    const structures = snapshot.structures.map((s) => ({
      x: (s.x - p.x) * scale,
      y: (s.z - p.z) * scale,
    }));
    return { nodes, pois, structures };
  }, [snapshot, engine, t]);

  if (!snapshot) return null;
  const p = snapshot.player;
  const facing = -(p.facing * 180) / Math.PI;
  const threat = snapshot.threat;
  const threatDot =
    threat && Math.hypot(threat.x - p.x, threat.z - p.z) < RANGE
      ? {
          x: (threat.x - p.x) * ((VIEW - 7) / RANGE),
          y: (threat.z - p.z) * ((VIEW - 7) / RANGE),
        }
      : null;

  return (
    <Pressable onPress={onPress} accessibilityLabel={t('map.title')} style={styles.wrap}>
      <Svg viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`} width="100%" height="100%">
        <Circle r={48} fill="rgba(5,13,11,0.78)" stroke="rgba(233,240,226,0.22)" strokeWidth={0.8} />
        <Circle r={32} fill="none" stroke="rgba(233,240,226,0.1)" strokeWidth={0.5} />
        <Circle r={16} fill="none" stroke="rgba(233,240,226,0.1)" strokeWidth={0.5} />
        <Line x1={-44} y1={0} x2={44} y2={0} stroke="rgba(233,240,226,0.06)" strokeWidth={0.4} />
        <Line x1={0} y1={-44} x2={0} y2={44} stroke="rgba(233,240,226,0.06)" strokeWidth={0.4} />

        {dots.nodes.map((dot, i) => (
          <Circle key={`n-${i}`} cx={dot.x} cy={dot.y} r={dot.r} fill={dot.color} opacity={0.85} />
        ))}
        {dots.structures.map((s, i) => (
          <Circle key={`s-${i}`} cx={s.x} cy={s.y} r={1.8} fill={C.accent} opacity={0.9} />
        ))}
        {dots.pois.map((poi, i) => (
          <Circle
            key={`p-${i}`}
            cx={poi.x}
            cy={poi.y}
            r={2.3}
            fill="none"
            stroke={poi.locked ? '#9FB49A' : C.accent}
            strokeWidth={1}
            opacity={0.95}
          />
        ))}
        {threatDot ? (
          <G>
            <Circle cx={threatDot.x} cy={threatDot.y} r={4.2} fill="none" stroke={C.danger} strokeWidth={0.9} />
            <Circle cx={threatDot.x} cy={threatDot.y} r={1.9} fill={C.danger} />
          </G>
        ) : null}

        <G transform={`rotate(${facing})`}>
          <Circle r={4.6} fill="rgba(6,14,12,0.9)" />
          <Polygon points="0,-4.4 3,3.2 0,1.6 -3,3.2" fill={C.text} stroke={C.accent} strokeWidth={0.5} />
        </G>
        <SvgText x={0} y={-44} fill={C.accent} fontSize={4.4} textAnchor="middle" fontWeight="600">
          N
        </SvgText>
      </Svg>
      <View style={styles.icon} pointerEvents="none">
        <Icon name="map" size={11} color={C.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(5,13,11,0.6)',
  },
  icon: {
    position: 'absolute',
    bottom: 5,
    right: 7,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(5,13,11,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
});
