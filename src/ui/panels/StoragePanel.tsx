import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { C, R, SP } from '../theme';
import { AppText, EmptyState, Sheet } from '../components/Primitives';
import { ItemIcon, useItemName } from '../components/ItemIcon';
import { useT } from '../../state/settingsStore';
import { useSession } from '../../state/sessionStore';
import type { InventoryState } from '../../game/types';

function aggregate(inv: InventoryState | undefined) {
  const map = new Map<string, number>();
  inv?.slots.forEach((s) => {
    if (!s) return;
    map.set(s.id, (map.get(s.id) ?? 0) + s.qty);
  });
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export function StoragePanel() {
  const { t } = useT();
  const panel = useSession((s) => s.panel);
  const close = useSession((s) => s.closePanel);
  const snapshot = useSession((s) => s.snapshot);
  const deposit = useSession((s) => s.deposit);
  const withdraw = useSession((s) => s.withdraw);
  const nameOf = useItemName();
  const open = panel === 'storage';

  const pack = useMemo(() => aggregate(snapshot?.inventory), [snapshot?.inventory]);
  const storage = useMemo(() => aggregate(snapshot?.storage), [snapshot?.storage]);

  return (
    <Sheet visible={open} onClose={close} title={t('storage.title')} subtitle={t('interact.storage')} closeLabel={t('common.close')}>
      <View style={styles.cols}>
        <Column
          title={t('inv.title')}
          count={snapshot?.inventory.slots.filter(Boolean).length ?? 0}
          total={snapshot?.capacity ?? 24}
          items={pack}
          actionIcon="arrow_right"
          onAction={(id) => deposit(id, 1)}
          onAll={(id) => deposit(id, 9999)}
          nameOf={nameOf}
          empty={t('inv.empty')}
        />
        <Column
          title={t('storage.title')}
          count={snapshot?.storageSlots ?? 0}
          total={snapshot?.storageSlots ?? 0}
          items={storage}
          actionIcon="arrow_left"
          onAction={(id) => withdraw(id, 1)}
          onAll={(id) => withdraw(id, 9999)}
          nameOf={nameOf}
          empty={t('storage.empty')}
        />
      </View>
    </Sheet>
  );
}

function Column({
  title,
  count,
  total,
  items,
  actionIcon,
  onAction,
  onAll,
  nameOf,
  empty,
}: {
  title: string;
  count: number;
  total: number;
  items: [string, number][];
  actionIcon: string;
  onAction: (id: string) => void;
  onAll: (id: string) => void;
  nameOf: (id: string) => string;
  empty: string;
}) {
  return (
    <View style={styles.col}>
      <View style={styles.colHeader}>
        <AppText variant="label" color={C.text}>
          {title}
        </AppText>
        <AppText variant="micro" color={C.textMuted}>
          {count}/{total}
        </AppText>
      </View>
      {items.length === 0 ? (
        <EmptyState icon="bag" title={empty} />
      ) : (
        items.map(([id, qty]) => (
          <View key={id} style={styles.row}>
            <ItemIcon id={id} size={34} />
            <View style={{ flex: 1 }}>
              <AppText variant="caption" color={C.text} numberOfLines={1}>
                {nameOf(id)}
              </AppText>
              <AppText variant="micro" color={C.textMuted}>
                ×{qty}
              </AppText>
            </View>
            <Pressable onPress={() => onAction(id)} style={styles.transfer} accessibilityLabel="Move one">
              <AppText variant="caption" color={C.accent}>
                {actionIcon === 'arrow_right' ? '›' : '‹'}
              </AppText>
            </Pressable>
            <Pressable onPress={() => onAll(id)} style={styles.transfer} accessibilityLabel="Move all">
              <AppText variant="micro" color={C.textMuted}>
                ALL
              </AppText>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cols: { flexDirection: 'row', gap: SP.lg, flexWrap: 'wrap' },
  col: { flex: 1, minWidth: 280, gap: 6 },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 7,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.glass,
  },
  transfer: {
    minWidth: 34,
    height: 30,
    paddingHorizontal: 6,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
