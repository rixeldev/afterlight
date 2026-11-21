import { StyleSheet, View } from 'react-native';
import { C, R, SP } from '../theme';
import { AppText, Chip, MeterBar, PressableScale, Sheet } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useItemName } from '../components/ItemIcon';
import { useT } from '../../state/settingsStore';
import { useSession } from '../../state/sessionStore';
import { QUEST_STEPS, questStep } from '../../data/quests';
import { GOALS, isGoalDone } from '../../data/goals';
import { STORY } from '../../data/world';

export function JournalPanel() {
  const { t } = useT();
  const open = useSession((s) => s.panel === 'journal');
  const close = useSession((s) => s.closePanel);
  const openPanel = useSession((s) => s.openPanel);
  const snapshot = useSession((s) => s.snapshot);
  const nameOf = useItemName();
  if (!snapshot) return null;

  const quest = snapshot.quest;
  const step = quest.activeStep ? questStep(quest.activeStep) : null;
  const completedCount = quest.completed.length;
  const chapterPct = completedCount / QUEST_STEPS.length;
  const story = STORY.filter((s) => s.id !== 'log_chapter_end');

  return (
    <Sheet
      visible={open}
      onClose={close}
      title={t('journal.title')}
      subtitle={t('journal.chapter')}
      closeLabel={t('common.close')}
      maxWidth={1000}
    >
      <View style={styles.cols}>
        <View style={{ flex: 1.25, gap: SP.md, minWidth: 320 }}>
          <View style={styles.chapterCard}>
            <View style={styles.chapterTop}>
              <View style={{ flex: 1 }}>
                <AppText variant="micro" color={C.accent}>
                  {t('journal.chapter')}
                </AppText>
                <AppText variant="title" style={{ marginTop: 2 }}>
                  {step ? t(step.titleKey) : t('journal.done')}
                </AppText>
                <AppText variant="body" color={C.textSecondary} style={{ marginTop: 4 }}>
                  {step ? t(step.summaryKey) : t('chapter.next')}
                </AppText>
              </View>
              <View style={styles.chapterRing}>
                <AppText variant="heading">{Math.round(chapterPct * 100)}%</AppText>
                <AppText variant="micro" color={C.textMuted}>
                  1 / 1
                </AppText>
              </View>
            </View>
            <MeterBar value={chapterPct * 100} color={C.accent} height={6} style={{ marginTop: 12 }} />
          </View>

          {step ? (
            <View style={styles.card}>
              <AppText variant="micro" color={C.textMuted}>
                {t('journal.objectives')}
              </AppText>
              <View style={{ gap: 10, marginTop: 8 }}>
                {step.objectives.map((obj) => {
                  const value = quest.progress[`${step.id}:${obj.id}`] ?? 0;
                  const amount = obj.amount ?? 1;
                  const done = value >= amount;
                  return (
                    <View key={obj.id} style={styles.objective}>
                      <View style={[styles.check, done ? { backgroundColor: C.success, borderColor: C.success } : null]}>
                        {done ? <Icon name="check" size={11} color={C.ink} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText variant="body" color={done ? C.textMuted : C.text}>
                          {t(obj.textKey)}
                        </AppText>
                        {amount > 1 ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <MeterBar value={Math.min(value, amount)} max={amount} color={done ? C.success : C.accent} height={4} style={{ flex: 1 }} />
                            <AppText variant="micro" color={C.textMuted}>
                              {Math.min(value, amount)}/{amount}
                            </AppText>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.rewards}>
                <AppText variant="micro" color={C.textMuted}>
                  {t('journal.rewards')}
                </AppText>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  <Chip icon="energy" label={t('journal.reward_xp', { xp: step.rewardXp })} tone="accent" />
                  {step.rewardItems
                    ? Object.entries(step.rewardItems).map(([id, qty]) => (
                        <Chip key={id} icon="leaf" label={`${nameOf(id)} ×${qty}`} />
                      ))
                    : null}
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <AppText variant="heading" color={C.success}>
                {t('journal.done')}
              </AppText>
              <AppText variant="body" color={C.textSecondary} style={{ marginTop: 4 }}>
                {t('chapter.next')}
              </AppText>
            </View>
          )}

          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText variant="micro" color={C.accent}>
                {t('journal.goals')}
              </AppText>
              {snapshot.goal ? (
                <AppText variant="micro" color={C.textMuted}>
                  {snapshot.goal.current}/{snapshot.goal.target}
                </AppText>
              ) : null}
            </View>
            <AppText variant="caption" color={C.textMuted} style={{ marginTop: 3 }}>
              {snapshot.goal ? t(snapshot.goal.descKey) : t('journal.goal_all')}
            </AppText>
            <View style={styles.goalGrid}>
              {GOALS.map((goal, index) => {
                const done = isGoalDone({ flags: snapshot.flags }, goal);
                const active = snapshot.goal?.id === goal.id;
                return (
                  <View key={goal.id} style={[styles.goalItem, active ? styles.goalItemActive : null]}>
                    <View
                      style={[
                        styles.goalDot,
                        done ? { backgroundColor: C.success, borderColor: C.success } : null,
                        active ? { borderColor: C.accent } : null,
                      ]}
                    >
                      {done ? (
                        <Icon name="check" size={9} color={C.ink} />
                      ) : (
                        <AppText variant="micro" color={active ? C.accent : C.textMuted} style={{ fontSize: 8 }}>
                          {index + 1}
                        </AppText>
                      )}
                    </View>
                    <AppText
                      variant="caption"
                      color={done ? C.textMuted : active ? C.text : C.textMuted}
                      numberOfLines={1}
                      style={{ flex: 1 }}
                    >
                      {t(goal.titleKey)}
                    </AppText>
                    {active ? <Chip label={`${snapshot.goal?.current ?? 0}/${snapshot.goal?.target ?? 1}`} selected /> : null}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <AppText variant="micro" color={C.textMuted}>
              {t('journal.progress', { done: completedCount, total: QUEST_STEPS.length })}
            </AppText>
            <View style={{ gap: 2, marginTop: 8 }}>
              {QUEST_STEPS.map((s, index) => {
                const done = quest.completed.includes(s.id);
                const active = quest.activeStep === s.id;
                return (
                  <View key={s.id} style={styles.stepRow}>
                    <View
                      style={[
                        styles.stepDot,
                        done ? { backgroundColor: C.success, borderColor: C.success } : null,
                        active ? { borderColor: C.accent } : null,
                      ]}
                    >
                      {done ? (
                        <Icon name="check" size={9} color={C.ink} />
                      ) : (
                        <AppText variant="micro" color={active ? C.accent : C.textMuted} style={{ fontSize: 8 }}>
                          {index + 1}
                        </AppText>
                      )}
                    </View>
                    <AppText variant="caption" color={active ? C.text : done ? C.textMuted : C.textMuted} numberOfLines={1}>
                      {t(s.titleKey)}
                    </AppText>
                    {active ? <Chip label={t('journal.tracked')} selected /> : null}
                    {done ? (
                      <AppText variant="micro" color={C.success}>
                        ✓
                      </AppText>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={{ flex: 1, gap: 8, minWidth: 260 }}>
          <AppText variant="micro" color={C.textMuted}>
            {t('journal.story')}
          </AppText>
          {story.map((entry) => {
            const unlocked = snapshot.story.includes(entry.id);
            return (
              <PressableScale
                key={entry.id}
                disabled={!unlocked}
                onPress={() => openPanel('story', entry.id)}
                style={{ opacity: unlocked ? 1 : 0.5 }}
              >
                <View style={styles.storyRow}>
                  <View style={styles.storyIcon}>
                    <Icon name={unlocked ? (entry.kind === 'audio_log' ? 'volume' : 'book') : 'lock'} size={16} color={unlocked ? C.accent : C.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="caption" color={unlocked ? C.text : C.textMuted} numberOfLines={1}>
                      {unlocked ? t(entry.titleKey) : t('journal.locked_entry')}
                    </AppText>
                    <AppText variant="micro" color={C.textMuted}>
                      {t(`story.kind.${entry.kind}`)}
                    </AppText>
                  </View>
                  {unlocked ? <Icon name="chevron_right" size={14} color={C.textMuted} /> : null}
                </View>
              </PressableScale>
            );
          })}
          <View style={styles.tip}>
            <Icon name="compass" size={14} color={C.textMuted} />
            <AppText variant="caption" color={C.textMuted} style={{ flex: 1 }}>
              {t('poi.ranger_camp.desc')}
            </AppText>
          </View>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cols: { flexDirection: 'row', gap: SP.lg, flexWrap: 'wrap' },
  chapterCard: {
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(232,201,143,0.07)',
    padding: SP.md,
  },
  chapterTop: { flexDirection: 'row', gap: SP.md, alignItems: 'flex-start' },
  chapterRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: C.accentLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(233,240,226,0.03)',
    padding: SP.md,
  },
  objective: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  check: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.4,
    borderColor: C.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rewards: { marginTop: SP.md, paddingTop: SP.sm, borderTopWidth: 1, borderTopColor: C.border },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  goalItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  goalItemActive: { borderColor: C.accentLine, backgroundColor: C.accentDim },
  goalDot: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.glass,
  },
  storyIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tip: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 4,
    padding: 10,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(233,240,226,0.02)',
  },
});
