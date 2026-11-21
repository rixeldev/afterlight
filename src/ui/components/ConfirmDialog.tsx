import { StyleSheet, View } from 'react-native';
import { C, R, SP } from '../theme';
import { AppText, Button } from './Primitives';
import { useT } from '../../state/settingsStore';

export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: C.scrimStrong }]}>
        <View style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.dialog}>
          <View style={[styles.iconWrap, destructive ? { backgroundColor: C.dangerDim } : null]}>
            <View style={styles.dot} />
          </View>
          <AppText variant="title" align="center">
            {title}
          </AppText>
          {body ? (
            <AppText variant="body" color={C.textMuted} align="center" style={{ marginTop: 8 }}>
              {body}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <Button label={cancelLabel ?? t('common.cancel')} variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.lg },
  dialog: {
    width: 400,
    maxWidth: '92%',
    padding: SP.lg,
    borderRadius: R.xl,
    backgroundColor: 'rgba(10,21,17,0.98)',
    borderWidth: 1,
    borderColor: C.borderStrong,
    alignItems: 'center',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.accent },
  actions: { flexDirection: 'row', gap: 10, marginTop: SP.lg, alignSelf: 'stretch' },
});
