import { StyleSheet, View } from 'react-native';
import { ITEMS, itemDef } from '../../data/items';
import type { ItemDef } from '../../game/types';
import { C, R } from '../theme';
import { Icon } from './Icon';
import { AppText } from './Primitives';
import { useT } from '../../state/settingsStore';

const TONE: Record<string, { bg: string; fg: string }> = {
  material: { bg: 'rgba(157,183,155,0.14)', fg: '#BBD0B6' },
  food: { bg: 'rgba(214,178,110,0.14)', fg: '#E3C588' },
  consumable: { bg: 'rgba(127,169,182,0.14)', fg: '#A9CDD8' },
  tool: { bg: 'rgba(232,201,143,0.16)', fg: '#F0D9A9' },
  quest: { bg: 'rgba(184,154,214,0.16)', fg: '#D6C2EA' },
};

export function ItemIcon({
  id,
  size = 44,
  showCount,
  count,
  dim,
}: {
  id: string;
  size?: number;
  showCount?: number;
  count?: number;
  dim?: boolean;
}) {
  const def = ITEMS[id];
  const tone = TONE[def?.category ?? 'material'] ?? TONE.material;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.icon,
          {
            width: size,
            height: size,
            borderRadius: Math.max(10, size * 0.28),
            backgroundColor: tone.bg,
            opacity: dim ? 0.45 : 1,
          },
        ]}
      >
        <Icon name={def?.icon ?? 'wood'} size={size * 0.52} color={tone.fg} />
      </View>
      {showCount !== undefined && showCount > 0 ? (
        <View style={styles.count}>
          <AppText variant="micro" color={C.ink} style={{ fontSize: 9, letterSpacing: 0 }}>
            {showCount}
          </AppText>
        </View>
      ) : null}
      {count !== undefined && count > 0 ? (
        <View style={styles.count}>
          <AppText variant="micro" color={C.ink} style={{ fontSize: 9, letterSpacing: 0 }}>
            {count}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

export function itemName(def: ItemDef | string): string {
  const d = typeof def === 'string' ? ITEMS[def] : def;
  return d?.nameKey ?? '';
}

export function useItemName(): (id: string) => string {
  const { t } = useT();
  return (id: string) => {
    const def = ITEMS[id];
    return def ? t(def.nameKey) : id;
  };
}

export function useItemDescription(): (id: string) => string {
  const { t } = useT();
  return (id: string) => {
    const def = ITEMS[id];
    return def ? t(def.descKey) : '';
  };
}

export function itemEffectText(id: string, t: (key: string, params?: Record<string, string | number>) => string): string[] {
  const def = itemDef(id);
  const lines: string[] = [];
  if (def.hunger) lines.push(`+${def.hunger} ${t('hud.hunger')}`);
  if (def.thirst) lines.push(`+${def.thirst} ${t('hud.thirst')}`);
  if (def.heal) lines.push(`+${def.heal} ${t('hud.health')}`);
  if (def.healthCost) lines.push(`-${def.healthCost} ${t('hud.health')}`);
  if (def.tool) {
    lines.push(t('inv.tool_bonus', { bonus: def.tool.gatherBonus.toFixed(1) }));
    lines.push(t('inv.damage', { damage: def.tool.damage }));
  }
  if (def.carryBonus) lines.push(t('inv.carry'));
  return lines;
}

export function storageCount(id: string, slots: (import('../../game/types').InventorySlot | null)[]): number {
  return slots.reduce((n, s) => (s?.id === id ? n + s.qty : n), 0);
}

const styles = StyleSheet.create({
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(233,240,226,0.09)',
  },
  count: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0B1714',
  },
  chip: { borderRadius: R.pill },
});
