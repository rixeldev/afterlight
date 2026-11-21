import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { C, R, SP } from '../theme';
import { AppText, Button, Chip, EmptyState, MeterBar, Sheet } from '../components/Primitives';
import { ItemIcon, useItemName } from '../components/ItemIcon';
import { CostChips } from './shared';
import { useT } from '../../state/settingsStore';
import { useSession } from '../../state/sessionStore';
import { RECIPES, RECIPE_LIST } from '../../data/recipes';
import { countItem } from '../../game/inventory/inventory';

type Filter = 'all' | 'tools' | 'survival' | 'building';

export function CraftingPanel() {
  const { t } = useT();
  const open = useSession((s) => s.panel === 'craft');
  const close = useSession((s) => s.closePanel);
  const snapshot = useSession((s) => s.snapshot);
  const craft = useSession((s) => s.craft);
  const cancelCraft = useSession((s) => s.cancelCraft);
  const [filter, setFilter] = useState<Filter>('all');
  const nameOf = useItemName();

  const inventory = snapshot?.inventory;
  const station = snapshot?.station ?? { campfire: false, workbench: false };
  const queue = snapshot?.crafting ?? [];
  const now = snapshot?.minutes ?? 0;

  const recipes = useMemo(
    () => RECIPE_LIST.filter((r) => (filter === 'all' ? true : r.category === filter)),
    [filter],
  );

  const available = (id: string) => (inventory ? countItem(inventory, id) : 0);

  return (
    <Sheet
      visible={open}
      onClose={close}
      title={t('craft.title')}
      subtitle={t('craft.subtitle')}
      closeLabel={t('common.close')}
    >
      <View style={styles.stationRow}>
        <View style={styles.stationChips}>
          {(['handcraft', 'campfire', 'workbench'] as const).map((s) => {
            const isNear = s === 'handcraft' ? true : s === 'campfire' ? station.campfire : station.workbench;
            return (
              <View
                key={s}
                style={[
                  styles.stationChip,
                  { borderColor: isNear ? 'rgba(147,192,140,0.4)' : C.border },
                  isNear ? { backgroundColor: 'rgba(147,192,140,0.1)' } : null,
                ]}
              >
                <ItemIcon id={s === 'campfire' ? 'wood_log' : s === 'workbench' ? 'scrap_metal' : 'plant_fiber'} size={18} />
                <AppText variant="caption" color={isNear ? C.success : C.textMuted}>
                  {t(`craft.station.${s}`)}
                </AppText>
              </View>
            );
          })}
        </View>
        <AppText variant="micro" color={C.textMuted}>
          {queue.length}/3
        </AppText>
      </View>

      {queue.length > 0 ? (
        <View style={styles.queue}>
          <AppText variant="micro" color={C.textMuted}>
            {t('craft.queue')}
          </AppText>
          {queue.map((job) => {
            const recipe = RECIPES[job.recipeId];
            if (!recipe) return null;
            const total = Math.max(0.01, job.endsAt - job.startedAt);
            const progress = Math.max(0, Math.min(1, (now - job.startedAt) / total));
            return (
              <View key={job.id} style={styles.queueRow}>
                <ItemIcon id={Object.keys(recipe.outputs)[0] ?? 'wood_log'} size={30} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText variant="caption" color={C.text}>
                      {t(recipe.nameKey)}
                    </AppText>
                    <AppText variant="micro" color={C.textMuted}>
                      {Math.round(progress * 100)}%
                    </AppText>
                  </View>
                  <MeterBar value={progress * 100} color={C.accent} height={4} />
                </View>
                <Pressable onPress={() => cancelCraft(job.id)} accessibilityLabel={t('craft.cancel')} style={styles.cancel}>
                  <AppText variant="micro" color={C.textMuted}>
                    ✕
                  </AppText>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.filterRow}>
        {(['all', 'tools', 'survival', 'building'] as Filter[]).map((f) => (
          <Chip key={f} label={t(`craft.filter.${f}`)} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>

      {recipes.length === 0 ? (
        <EmptyState icon="craft" title={t('inv.empty')} />
      ) : (
        <View style={styles.grid}>
          {recipes.map((recipe) => {
            const stationOk =
              recipe.station === 'handcraft' || (recipe.station === 'campfire' ? station.campfire : station.workbench);
            const missing = Object.entries(recipe.inputs).filter(([id, qty]) => available(id) < qty);
            const canCraft = stationOk && missing.length === 0 && queue.length < 3;
            const outputId = Object.keys(recipe.outputs)[0] ?? 'wood_log';
            return (
              <View key={recipe.id} style={[styles.card, !stationOk ? { opacity: 0.6 } : null]}>
                <View style={styles.cardTop}>
                  <ItemIcon id={outputId} size={44} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="heading" style={{ fontSize: 16 }}>
                      {t(recipe.nameKey)}
                    </AppText>
                    <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 3 }}>
                      <Chip label={t(`craft.station_short.${recipe.station}`)} icon="flame" />
                      <Chip label={t('craft.duration', { seconds: recipe.durationSeconds })} icon="clock" />
                    </View>
                  </View>
                </View>
                <AppText variant="caption" color={C.textMuted} numberOfLines={2} style={{ marginTop: 6 }}>
                  {t(recipe.descKey)}
                </AppText>
                <View style={{ marginTop: 8 }}>
                  <CostChips cost={recipe.inputs} available={available} size="small" />
                </View>
                <View style={styles.cardFooter}>
                  {!stationOk ? (
                    <AppText variant="micro" color={C.warning}>
                      {t('toast.need_station', { station: t(`station.${recipe.station}`) })}
                    </AppText>
                  ) : missing.length > 0 ? (
                    <AppText variant="micro" color={C.danger}>
                      {t('craft.missing', { count: missing.length })}
                    </AppText>
                  ) : (
                    <AppText variant="micro" color={C.success}>
                      {t('craft.output')} {nameOf(outputId)} ×{recipe.outputs[outputId]}
                    </AppText>
                  )}
                  <Button
                    label={t('craft.craft')}
                    compact
                    disabled={!canCraft}
                    onPress={() => craft(recipe.id)}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
      <AppText variant="micro" color={C.textMuted} style={{ marginTop: SP.md }}>
        {t('craft.batch_hint')}
      </AppText>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stationChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  stationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: R.pill,
    borderWidth: 1,
    backgroundColor: C.glass,
  },
  queue: { marginTop: SP.md, gap: 8 },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cancel: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: { flexDirection: 'row', gap: 6, marginTop: SP.md, flexWrap: 'wrap' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: SP.sm },
  card: {
    width: 310,
    maxWidth: '100%',
    flexGrow: 1,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.glass,
    padding: 12,
  },
  cardTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
});
