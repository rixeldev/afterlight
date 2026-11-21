import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { C, R, SP } from '../theme';
import { AppText, Button, Sheet } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useT } from '../../state/settingsStore';
import { useSession } from '../../state/sessionStore';
import { formatPlaytime } from '../../i18n';
import { questStep } from '../../data/quests';

export function PausePanel() {
  const { t, locale } = useT();
  const open = useSession((s) => s.panel === 'pause');
  const close = useSession((s) => s.closePanel);
  const openPanel = useSession((s) => s.openPanel);
  const quit = useSession((s) => s.quitToMenu);
  const saveNow = useSession((s) => s.saveNow);
  const snapshot = useSession((s) => s.snapshot);
  const [help, setHelp] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);

  const step = snapshot?.quest.activeStep ? questStep(snapshot.quest.activeStep) : null;

  const items: { icon: string; label: string; action: () => void }[] = [
    { icon: 'play', label: t('pause.resume'), action: close },
    { icon: 'quest', label: t('pause.journal'), action: () => openPanel('journal') },
    { icon: 'map', label: t('map.title'), action: () => openPanel('map') },
    { icon: 'user', label: t('pause.character'), action: () => openPanel('character') },
    { icon: 'settings', label: t('pause.settings'), action: () => openPanel('settings') },
  ];

  return (
    <>
      <Sheet
        visible={open}
        onClose={close}
        title={t('pause.title')}
        subtitle={step ? t(step.titleKey) : t('journal.done')}
        closeLabel={t('pause.resume')}
        maxWidth={560}
      >
        <View style={styles.meta}>
          <View style={styles.metaCell}>
            <AppText variant="micro" color={C.textMuted}>
              {t('char.level', { level: snapshot?.player.level ?? 1 })}
            </AppText>
            <AppText variant="heading">{t('hud.day', { day: snapshot?.day ?? 1 })}</AppText>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaCell}>
            <AppText variant="micro" color={C.textMuted}>
              {t('char.stat.playtime')}
            </AppText>
            <AppText variant="heading">{formatPlaytime((snapshot?.stats.minutesPlayed ?? 0) / 60, locale)}</AppText>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaCell}>
            <AppText variant="micro" color={C.textMuted}>
              {t('journal.title')}
            </AppText>
            <AppText variant="heading">
              {snapshot?.quest.completed.length ?? 0}/7
            </AppText>
          </View>
        </View>

        <View style={{ gap: 6 }}>
          {items.map((item) => (
            <Pressable key={item.label} onPress={item.action} style={styles.row} accessibilityRole="button" accessibilityLabel={item.label}>
              <View style={styles.rowIcon}>
                <Icon name={item.icon} size={18} color={C.textSecondary} />
              </View>
              <AppText variant="body" style={{ flex: 1 }}>
                {item.label}
              </AppText>
              <Icon name="chevron_right" size={14} color={C.textMuted} />
            </Pressable>
          ))}
          <Pressable onPress={() => setHelp((h) => !h)} style={styles.row} accessibilityRole="button" accessibilityLabel={t('pause.help')}>
            <View style={styles.rowIcon}>
              <Icon name="book" size={18} color={C.textSecondary} />
            </View>
            <AppText variant="body" style={{ flex: 1 }}>
              {t('pause.help')}
            </AppText>
            <Icon name={help ? 'chevron_down' : 'chevron_right'} size={14} color={C.textMuted} />
          </Pressable>
          {help ? (
            <View style={styles.helpBox}>
              <AppText variant="caption" color={C.textSecondary}>
                {t('pause.help_body')}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Button
            label={t('settings.save_now')}
            compact
            variant="ghost"
            icon="check"
            onPress={() => {
              void saveNow('manual');
            }}
          />
          <Button label={t('pause.save_quit')} compact variant="danger" icon="close" onPress={() => setConfirmQuit(true)} />
        </View>
        <AppText variant="micro" color={C.textMuted} align="center" style={{ marginTop: SP.md }}>
          {t('menu.autosave_note')}
        </AppText>
      </Sheet>

      <ConfirmDialog
        visible={confirmQuit}
        title={t('pause.return_menu_title')}
        body={t('pause.return_menu_body')}
        confirmLabel={t('pause.return_menu_confirm')}
        onCancel={() => setConfirmQuit(false)}
        onConfirm={() => {
          setConfirmQuit(false);
          void quit();
        }}
      />
    </>
  );
}

export function CreditsPanel() {
  const { t } = useT();
  const open = useSession((s) => s.panel === 'credits');
  const close = useSession((s) => s.closePanel);
  return (
    <Sheet visible={open} onClose={close} title={t('credits.title')} subtitle={t('app.tagline')} closeLabel={t('credits.close')} maxWidth={620}>
      <View style={styles.credits}>
        <AppText variant="display" align="center" style={{ letterSpacing: 2 }}>
          {t('app.title')}
        </AppText>
        <AppText variant="body" color={C.textMuted} align="center">
          {t('credits.made')}
        </AppText>
        <View style={styles.creditBlock}>
          <AppText variant="caption" color={C.textSecondary} align="center">
            {t('credits.assets')}
          </AppText>
          <AppText variant="caption" color={C.textSecondary} align="center">
            {t('credits.audio')}
          </AppText>
          <AppText variant="caption" color={C.textSecondary} align="center">
            {t('credits.engine')}
          </AppText>
        </View>
        <AppText variant="body" color={C.accent} align="center" style={{ marginTop: SP.md }}>
          {t('credits.thanks')}
        </AppText>
        <AppText variant="micro" color={C.textMuted} align="center" style={{ marginTop: SP.md }}>
          {t('app.offline')}
        </AppText>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.glass,
    marginBottom: SP.md,
  },
  metaCell: { flex: 1, alignItems: 'center', gap: 2 },
  metaDivider: { width: 1, height: 28, backgroundColor: C.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(233,240,226,0.03)',
  },
  rowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.glass, alignItems: 'center', justifyContent: 'center' },
  helpBox: { padding: 12, borderRadius: R.md, backgroundColor: C.glass },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SP.lg, gap: 8 },
  credits: { alignItems: 'center', gap: 6, paddingVertical: SP.md },
  creditBlock: { gap: 4, marginTop: SP.md, paddingTop: SP.md, borderTopWidth: 1, borderTopColor: C.border, alignSelf: 'stretch' },
});
