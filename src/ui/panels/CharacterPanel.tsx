import { StyleSheet, View } from 'react-native';
import { C, R, SP } from '../theme';
import { AppText, Button, Chip, MeterBar, ProgressRing, Sheet } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { ItemIcon, useItemName } from '../components/ItemIcon';
import { useT } from '../../state/settingsStore';
import { useSession } from '../../state/sessionStore';
import { SKILL_META, skillXpForNext, xpForNextLevel } from '../../game/progression/progression';
import { formatPlaytime } from '../../i18n';

export function CharacterPanel() {
  const { t, locale } = useT();
  const open = useSession((s) => s.panel === 'character');
  const close = useSession((s) => s.closePanel);
  const snapshot = useSession((s) => s.snapshot);
  const equip = useSession((s) => s.equip);
  const nameOf = useItemName();
  if (!snapshot) return null;
  const p = snapshot.player;
  const stats = snapshot.stats;
  const xpNeeded = xpForNextLevel(p.level);
  const equipped = snapshot.equipped;

  const journey = [
    { label: t('char.stat.gathered'), value: String(stats.itemsGathered), icon: 'wood' },
    { label: t('char.stat.crafted'), value: String(stats.itemsCrafted), icon: 'craft' },
    { label: t('char.stat.structures'), value: String(stats.structuresBuilt), icon: 'home' },
    { label: t('char.stat.distance'), value: `${Math.round(stats.distanceTravelled)} m`, icon: 'map' },
    { label: t('char.stat.nights'), value: String(stats.nightsSurvived), icon: 'moon' },
    { label: t('char.stat.threats'), value: String(stats.threatsDrivenOff), icon: 'sword' },
    { label: t('char.stat.collapses'), value: String(stats.collapses), icon: 'health' },
    { label: t('char.stat.playtime'), value: formatPlaytime(stats.minutesPlayed / 60, locale), icon: 'clock' },
  ];

  return (
    <Sheet visible={open} onClose={close} title={t('char.title')} subtitle={t('char.level', { level: p.level })} closeLabel={t('common.close')}>
      <View style={styles.row}>
        <View style={{ flex: 1.2, minWidth: 300, gap: SP.md }}>
          <View style={styles.hero}>
            <ProgressRing progress={p.xp / xpNeeded} size={92} stroke={5} color={C.accent} track="rgba(233,240,226,0.12)">
              <View style={{ alignItems: 'center' }}>
                <AppText variant="display" style={{ fontSize: 26 }}>
                  {p.level}
                </AppText>
                <AppText variant="micro" color={C.textMuted}>
                  LV
                </AppText>
              </View>
            </ProgressRing>
            <View style={{ flex: 1 }}>
              <AppText variant="title">{t('char.title')}</AppText>
              <AppText variant="caption" color={C.textMuted} style={{ marginTop: 2 }}>
                {t('char.xp_next', { current: Math.round(p.xp), needed: xpNeeded })}
              </AppText>
              <MeterBar value={p.xp} max={xpNeeded} color={C.accent} height={5} style={{ marginTop: 8 }} />
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <Chip icon="health" label={`${Math.round(p.health)}`} />
                <Chip icon="energy" label={`${Math.round(p.stamina)}`} />
                <Chip icon="star" label={`${stats.threatsDrivenOff}`} />
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <AppText variant="micro" color={C.textMuted}>
              {t('char.equipment')}
            </AppText>
            {equipped ? (
              <View style={styles.equipped}>
                <ItemIcon id={equipped} size={40} />
                <View style={{ flex: 1 }}>
                  <AppText variant="label">{nameOf(equipped)}</AppText>
                  <AppText variant="micro" color={C.accent}>
                    {t('inv.equipped')}
                  </AppText>
                </View>
                <Button label={t('char.unequip')} compact variant="ghost" onPress={() => equip(equipped)} />
              </View>
            ) : (
              <View style={styles.equipped}>
                <View style={styles.emptyHand}>
                  <AppText variant="micro" color={C.textMuted}>
                    ∅
                  </AppText>
                </View>
                <AppText variant="caption" color={C.textMuted}>
                  {t('char.nothing_equipped')}
                </AppText>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <AppText variant="micro" color={C.textMuted}>
              {t('char.skills')}
            </AppText>
            <View style={{ gap: 10, marginTop: 8 }}>
              {SKILL_META.map((skill) => {
                const level = p.skills[skill.id];
                const xp = p.skillXp[skill.id];
                const needed = skillXpForNext(level);
                return (
                  <View key={skill.id} style={styles.skillRow}>
                    <View style={styles.skillIcon}>
                      <Icon name={skill.icon} size={16} color={C.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <AppText variant="label">{t(skill.nameKey)}</AppText>
                        <AppText variant="micro" color={C.accent}>
                          {t('char.skill_level', { level })}
                        </AppText>
                      </View>
                      <AppText variant="micro" color={C.textMuted} numberOfLines={1}>
                        {t(skill.descKey)}
                      </AppText>
                      <MeterBar value={xp} max={needed} color={C.stamina} height={3} style={{ marginTop: 4 }} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={{ flex: 1, minWidth: 260, gap: 8 }}>
          <AppText variant="micro" color={C.textMuted}>
            {t('char.stats')}
          </AppText>
          <View style={styles.statGrid}>
            {journey.map((stat) => (
              <View key={stat.label} style={styles.statCard}>
                <Icon name={stat.icon} size={15} color={C.accent} />
                <AppText variant="heading" style={{ fontSize: 17 }}>
                  {stat.value}
                </AppText>
                <AppText variant="micro" color={C.textMuted} numberOfLines={2}>
                  {stat.label}
                </AppText>
              </View>
            ))}
          </View>
          <View style={styles.quote}>
            <AppText variant="caption" color={C.textMuted}>
              “{t('app.tagline')}.”
            </AppText>
          </View>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SP.lg, flexWrap: 'wrap' },
  hero: {
    flexDirection: 'row',
    gap: SP.md,
    alignItems: 'center',
    padding: SP.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(232,201,143,0.06)',
  },
  card: {
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(233,240,226,0.03)',
    padding: SP.md,
  },
  equipped: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  emptyHand: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  skillIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    width: 118,
    padding: 10,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.glass,
    gap: 2,
  },
  quote: {
    marginTop: 6,
    padding: 12,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(233,240,226,0.02)',
    alignItems: 'center',
  },
});
