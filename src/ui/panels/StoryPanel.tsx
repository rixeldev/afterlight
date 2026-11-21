import { StyleSheet, View } from 'react-native';
import { C, R, SP } from '../theme';
import { AppText, Chip, Sheet } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useT } from '../../state/settingsStore';
import { useSession } from '../../state/sessionStore';
import { storyEntry } from '../../data/world';

export function StoryPanel() {
  const { t } = useT();
  const open = useSession((s) => s.panel === 'story');
  const data = useSession((s) => s.panelData);
  const close = useSession((s) => s.closePanel);
  const entry = data ? storyEntry(data) : undefined;

  return (
    <Sheet
      visible={open}
      onClose={close}
      title={entry ? t(entry.titleKey) : t('story.title')}
      subtitle={entry ? t(`story.kind.${entry.kind}`) : undefined}
      closeLabel={t('common.close')}
      maxWidth={720}
    >
      {entry ? (
        <View style={styles.wrap}>
          <View style={styles.badgeRow}>
            <Chip icon={entry.kind === 'audio_log' ? 'volume' : 'book'} label={t(`story.kind.${entry.kind}`)} tone="accent" />
            <Chip icon="sparkle" label={t('story.title')} />
          </View>
          <View style={styles.bodyCard}>
            <View style={styles.mark} />
            <AppText variant="body" style={styles.body}>
              {t(entry.bodyKey)}
            </AppText>
          </View>
          <View style={styles.footer}>
            <Icon name="compass" size={14} color={C.textMuted} />
            <AppText variant="micro" color={C.textMuted} style={{ flex: 1 }}>
              {t('poi.ranger_camp.name')} · Greenhaven
            </AppText>
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SP.md, paddingTop: SP.sm },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  bodyCard: {
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(232,201,143,0.05)',
    padding: SP.lg,
    flexDirection: 'row',
    gap: SP.md,
  },
  mark: { width: 3, borderRadius: 2, backgroundColor: C.accentLine },
  body: { flex: 1, fontSize: 17, lineHeight: 27, color: C.text },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
