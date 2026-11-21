import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { C, R, SP } from '../theme';
import { AppText, Button, Chip, EmptyState, MeterBar, Sheet } from '../components/Primitives';
import { ItemIcon, itemEffectText, useItemDescription, useItemName } from '../components/ItemIcon';
import { useT } from '../../state/settingsStore';
import { useSession } from '../../state/sessionStore';
import { itemDef } from '../../data/items';

const QUICK_ITEMS = ['wild_berries', 'roasted_berries', 'clean_water', 'basic_medkit'];

export function InventoryPanel() {
  const { t } = useT();
  const open = useSession((s) => s.panel === 'inventory');
  const close = useSession((s) => s.closePanel);
  const snapshot = useSession((s) => s.snapshot);
  const consumeItem = useSession((s) => s.consumeItem);
  const equip = useSession((s) => s.equip);
  const drop = useSession((s) => s.dropItem);
  const sortInventory = useSession((s) => s.sortInventory);
  const [selected, setSelected] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const nameOf = useItemName();
  const descOf = useItemDescription();
  const wide = width > 760;

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    snapshot?.inventory.slots.forEach((s) => {
      if (!s) return;
      map.set(s.id, (map.get(s.id) ?? 0) + s.qty);
    });
    return map;
  }, [snapshot?.inventory]);

  const held = selected ? counts.get(selected) ?? 0 : 0;
  const def = selected ? itemDef(selected) : null;
  const equipped = snapshot?.equipped;
  const usedSlots = snapshot?.inventory.slots.filter(Boolean).length ?? 0;
  const capacity = snapshot?.capacity ?? 24;

  return (
    <Sheet
      visible={open}
      onClose={close}
      title={t('inv.title')}
      subtitle={t('inv.capacity', { used: usedSlots, total: capacity })}
      closeLabel={t('inv.close')}
    >
      <View style={styles.quickRow}>
        <AppText variant="micro" color={C.textMuted} style={{ marginRight: 4 }}>
          {t('inv.quick')}
        </AppText>
        {QUICK_ITEMS.filter((id) => (counts.get(id) ?? 0) > 0).map((id) => (
          <Chip
            key={id}
            icon={itemDef(id).icon}
            label={`${nameOf(id)} ×${counts.get(id)}`}
            onPress={() => {
              consumeItem(id);
              setSelected(id);
            }}
            tone="accent"
          />
        ))}
        {QUICK_ITEMS.every((id) => (counts.get(id) ?? 0) === 0) ? (
          <AppText variant="caption" color={C.textMuted}>
            —
          </AppText>
        ) : null}
        <View style={{ flex: 1 }} />
        <Button label={t('inv.sort')} icon="backpack" variant="secondary" compact onPress={sortInventory} />
      </View>

      <MeterBar value={usedSlots} max={capacity} color={C.accent} height={5} style={{ marginTop: 10 }} />

      <View style={[styles.body, wide ? { flexDirection: 'row', gap: SP.lg } : null]}>
        <View style={{ flex: 1, marginTop: SP.md }}>
          {usedSlots === 0 ? (
            <EmptyState icon="backpack" title={t('inv.empty')} />
          ) : (
            <View style={styles.grid}>
              {snapshot?.inventory.slots.map((slot, index) => {
                if (!slot) return null;
                const active = selected === slot.id;
                return (
                  <Pressable
                    key={`${slot.id}-${index}`}
                    onPress={() => setSelected(slot.id)}
                    accessibilityLabel={nameOf(slot.id)}
                    style={[
                      styles.slot,
                      active ? { borderColor: C.accent, backgroundColor: C.accentDim } : null,
                      equipped === slot.id ? { borderColor: C.accentLine } : null,
                    ]}
                  >
                    <ItemIcon id={slot.id} size={46} />
                    <View style={styles.slotFooter}>
                      <AppText variant="caption" color={C.textSecondary} numberOfLines={1} style={{ fontSize: 10 }}>
                        {nameOf(slot.id)}
                      </AppText>
                      <AppText variant="micro" color={C.accent}>
                        {slot.qty}
                      </AppText>
                    </View>
                    {equipped === slot.id ? (
                      <View style={styles.equipDot}>
                        <AppText variant="micro" color={C.ink} style={{ fontSize: 7 }}>
                          ✓
                        </AppText>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
              {Array.from({ length: Math.max(0, Math.min(6, capacity - usedSlots)) }).map((_, i) => (
                <View key={`empty-${i}`} style={[styles.slot, styles.slotEmpty]} />
              ))}
            </View>
          )}
        </View>

        <View style={[styles.detail, wide ? { width: 300 } : { marginTop: SP.lg }]}>
          {def ? (
            <>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <ItemIcon id={def.id} size={58} />
                <View style={{ flex: 1 }}>
                  <AppText variant="heading" numberOfLines={2}>
                    {nameOf(def.id)}
                  </AppText>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <Chip label={t(`inv.category.${def.category}`)} />
                    <Chip label={`×${held}`} tone="accent" />
                    {equipped === def.id ? <Chip label={t('inv.equipped')} selected /> : null}
                  </View>
                </View>
              </View>
              <AppText variant="body" color={C.textSecondary} style={{ marginTop: 12 }}>
                {descOf(def.id)}
              </AppText>
              <View style={{ gap: 4, marginTop: 10 }}>
                {itemEffectText(def.id, t).map((line) => (
                  <View key={line} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <View style={styles.bullet} />
                    <AppText variant="caption" color={C.accent}>
                      {line}
                    </AppText>
                  </View>
                ))}
              </View>
              <View style={styles.actions}>
                {def.category === 'tool' ? (
                  <>
                    <Button
                      label={equipped === def.id ? t('inv.unequip') : t('inv.equip')}
                      icon={def.tool ? 'sword' : 'bag'}
                      onPress={() => equip(def.id)}
                      compact
                    />
                    {def.carryBonus ? (
                      <Button label={t('inv.use')} icon="backpack" variant="secondary" compact onPress={() => consumeItem(def.id)} />
                    ) : null}
                  </>
                ) : def.category === 'food' || def.category === 'consumable' ? (
                  <Button label={t('inv.use')} icon="leaf" onPress={() => consumeItem(def.id)} compact />
                ) : null}
                <Button
                  label={t('inv.drop')}
                  variant="ghost"
                  icon="trash"
                  compact
                  onPress={() => {
                    drop(def.id, 1);
                    if (held <= 1) setSelected(null);
                  }}
                />
              </View>
            </>
          ) : (
            <View style={styles.detailEmpty}>
              <AppText variant="caption" color={C.textMuted} align="center">
                {t('inv.details')}
              </AppText>
            </View>
          )}
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  body: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    width: 88,
    height: 88,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.glass,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotEmpty: { backgroundColor: 'rgba(233,240,226,0.025)', borderStyle: 'dashed' },
  slotFooter: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2 },
  equipDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detail: {
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(233,240,226,0.03)',
    padding: SP.md,
  },
  detailEmpty: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  bullet: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: SP.md },
});
