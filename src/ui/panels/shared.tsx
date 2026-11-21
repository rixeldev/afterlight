import { StyleSheet, View } from 'react-native';
import { C, R } from '../theme';
import { AppText } from '../components/Primitives';
import { ItemIcon } from '../components/ItemIcon';
import { useT } from '../../state/settingsStore';

/** Ingredient/cost chips that turn red when the pack is short. */
export function CostChips({
  cost,
  available,
  size = 'normal',
}: {
  cost: Record<string, number>;
  available: (id: string) => number;
  size?: 'normal' | 'small';
}) {
  const { t } = useT();
  return (
    <View style={styles.costRow}>
      {Object.entries(cost).map(([id, qty]) => {
        const have = available(id);
        const ok = have >= qty;
        return (
          <View
            key={id}
            style={[
              styles.costChip,
              size === 'small' ? { paddingVertical: 3, paddingHorizontal: 7 } : null,
              { borderColor: ok ? C.border : 'rgba(217,129,112,0.4)' },
            ]}
          >
            <ItemIcon id={id} size={size === 'small' ? 18 : 22} />
            <AppText variant="caption" color={ok ? C.textSecondary : C.danger}>
              {t(`item.${id}.name`)}
            </AppText>
            <AppText variant="caption" color={ok ? C.textMuted : C.danger}>
              {have}/{qty}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

export function SectionCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <AppText variant="body" color={C.textMuted}>
        {label}
      </AppText>
      <AppText variant="label" color={C.text}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  costRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  costChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: R.pill,
    borderWidth: 1,
    backgroundColor: C.glass,
  },
  card: {
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.glass,
    padding: 14,
  },
  kv: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
});
