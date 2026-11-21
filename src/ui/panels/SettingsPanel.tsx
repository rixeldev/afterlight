import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { C, R, SP } from '../theme';
import { AppText, Button, Chip, Segmented, Sheet, Slider, Toggle } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useSettings, useT } from '../../state/settingsStore';
import { useSession } from '../../state/sessionStore';
import { ensureSaveService } from '../../services/storage';

export function SettingsPanel() {
  const { t } = useT();
  const open = useSession((s) => s.panel === 'settings');
  const close = useSession((s) => s.closePanel);
  const openPanel = useSession((s) => s.openPanel);
  const saveNow = useSession((s) => s.saveNow);
  const resetJourney = useSession((s) => s.resetJourney);
  const replayTutorial = useSession((s) => s.replayTutorial);
  const phase = useSession((s) => s.phase);
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const [resetOpen, setResetOpen] = useState(false);
  const [size, setSize] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    ensureSaveService()
      .then((service) => service.saveSize())
      .then(setSize)
      .catch(() => setSize(0));
  }, [open]);

  const row = (label: string, icon: string, control: React.ReactNode, hint?: string) => (
    <View style={styles.row} key={label}>
      <View style={styles.rowLabel}>
        <View style={styles.rowIcon}>
          <Icon name={icon} size={16} color={C.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="body" color={C.text}>
            {label}
          </AppText>
          {hint ? (
            <AppText variant="micro" color={C.textMuted}>
              {hint}
            </AppText>
          ) : null}
        </View>
      </View>
      {control}
    </View>
  );

  return (
    <>
      <Sheet
        visible={open}
        onClose={close}
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        closeLabel={t('common.close')}
        maxWidth={820}
      >
        <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>
        <Section title={t('settings.audio')} />
        {row(
          t('settings.music'),
          'volume',
          <Slider label={t('settings.music')} value={settings.musicVolume} onChange={(v) => update({ musicVolume: v })} format={(v) => `${Math.round(v * 100)}%`} />,
        )}
        {row(
          t('settings.sfx'),
          'volume',
          <Slider label={t('settings.sfx')} value={settings.sfxVolume} onChange={(v) => update({ sfxVolume: v })} format={(v) => `${Math.round(v * 100)}%`} />,
        )}
        {row(
          t('settings.ambience'),
          'leaf',
          <Slider label={t('settings.ambience')} value={settings.ambienceVolume} onChange={(v) => update({ ambienceVolume: v })} format={(v) => `${Math.round(v * 100)}%`} />,
        )}

        <Section title={t('settings.controls')} />
        {row(
          t('settings.sensitivity'),
          'compass',
          <Slider label={t('settings.sensitivity')} min={0.4} max={2} value={settings.cameraSensitivity} onChange={(v) => update({ cameraSensitivity: v })} format={(v) => `${v.toFixed(1)}×`} />,
        )}
        {row(t('settings.haptics'), 'sparkle', <Toggle label={t('settings.haptics')} value={settings.haptics} onChange={(v) => update({ haptics: v })} />)}
        {row(t('settings.left_handed'), 'hand', <Toggle label={t('settings.left_handed')} value={settings.leftHanded} onChange={(v) => update({ leftHanded: v })} />)}

        <Section title={t('settings.display')} />
        <View style={styles.segmentRow}>
          <Segmented
            value={settings.graphics}
            onChange={(v) => update({ graphics: v })}
            options={[
              { value: 'low', label: t('settings.graphics.low') },
              { value: 'medium', label: t('settings.graphics.medium') },
              { value: 'high', label: t('settings.graphics.high') },
            ]}
          />
        </View>
        <AppText variant="micro" color={C.textMuted} style={{ marginBottom: SP.sm }}>
          {t('settings.graphics.note')}
        </AppText>
        {row(t('settings.show_fps'), 'target', <Toggle label={t('settings.show_fps')} value={settings.showFps} onChange={(v) => update({ showFps: v })} />)}

        <Section title={t('settings.language')} />
        <View style={styles.segmentRow}>
          <Segmented
            value={settings.language}
            onChange={(v) => update({ language: v })}
            options={[
              { value: 'auto', label: t('settings.language.auto') },
              { value: 'en', label: t('settings.language.en') },
              { value: 'es', label: t('settings.language.es') },
            ]}
          />
        </View>

        <Section title={t('settings.accessibility')} />
        {row(t('settings.reduced_motion'), 'pause', <Toggle label={t('settings.reduced_motion')} value={settings.reducedMotion} onChange={(v) => update({ reducedMotion: v })} />)}
        {row(t('settings.large_text'), 'book', <Toggle label={t('settings.large_text')} value={settings.largeText} onChange={(v) => update({ largeText: v })} />)}
        <View style={styles.buttonRow}>
          <Button
            label={t('settings.tutorial')}
            variant="secondary"
            compact
            icon="sparkle"
            onPress={() => {
              replayTutorial();
              setSaved(true);
              setTimeout(() => setSaved(false), 1400);
            }}
          />
          {saved ? <Chip label={t('settings.tutorial_done')} tone="good" icon="check" /> : null}
        </View>

        {phase === 'game' ? (
          <>
            <Section title={t('settings.data')} />
            <View style={styles.dataRow}>
              <View>
                <AppText variant="body">{t('settings.storage_used')}</AppText>
                <AppText variant="micro" color={C.textMuted}>
                  {(size / 1024).toFixed(1)} KB
                </AppText>
              </View>
              <Button
                label={t('settings.save_now')}
                compact
                icon="check"
                onPress={() => {
                  void saveNow('manual');
                }}
              />
            </View>
            <Button label={t('settings.reset')} variant="danger" icon="trash" compact onPress={() => setResetOpen(true)} style={{ marginTop: 8 }} />
          </>
        ) : null}

        <Section title={t('settings.about')} />
        <View style={styles.aboutRow}>
          <Button label={t('settings.credits')} variant="ghost" compact icon="book" onPress={() => openPanel('credits')} />
          <AppText variant="micro" color={C.textMuted}>
            {t('app.version', { version: Constants.expoConfig?.version ?? '0.1.0' })}
          </AppText>
        </View>
        <View style={styles.privacy}>
          <Icon name="lock" size={15} color={C.textMuted} />
          <View style={{ flex: 1 }}>
            <AppText variant="label" color={C.textSecondary}>
              {t('settings.privacy')}
            </AppText>
            <AppText variant="caption" color={C.textMuted}>
              {t('settings.privacy_body')}
            </AppText>
          </View>
        </View>
        <AppText variant="micro" color={C.textMuted} align="center" style={{ marginTop: SP.md }}>
          {t('app.offline')}
        </AppText>
        </View>
      </Sheet>

      <ConfirmDialog
        visible={resetOpen}
        title={t('settings.reset_title')}
        body={t('settings.reset_body')}
        confirmLabel={t('settings.reset_confirm')}
        destructive
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          setResetOpen(false);
          void resetJourney();
        }}
      />
    </>
  );
}

function Section({ title }: { title: string }) {
  return (
    <View style={styles.section}>
      <AppText variant="micro" color={C.textMuted}>
        {title}
      </AppText>
      <View style={styles.sectionLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: SP.lg, marginBottom: 2 },
  sectionLine: { flex: 1, height: 1, backgroundColor: C.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(233,240,226,0.05)',
  },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: C.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentRow: { paddingVertical: 6 },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  dataRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  privacy: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SP.sm,
    padding: 12,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(233,240,226,0.02)',
  },
});
