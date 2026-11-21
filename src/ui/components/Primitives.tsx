import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { C, FONT, R, SP, textStyle, useTextScale, type TextVariant } from '../theme';
import { Icon } from './Icon';
import { useSettings } from '../../state/settingsStore';

export function AppText({
  children,
  variant = 'body',
  color = C.text,
  style,
  numberOfLines,
  align,
  adjustsFontSizeToFit,
  minimumFontScale,
}: {
  children: React.ReactNode;
  variant?: TextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  align?: 'left' | 'center' | 'right';
  adjustsFontSizeToFit?: boolean;
  minimumFontScale?: number;
}) {
  const scale = useTextScale();
  return (
    <Text
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      minimumFontScale={minimumFontScale}
      style={[
        textStyle(variant, scale),
        { color, textAlign: align },
        variant === 'micro' ? { textTransform: 'uppercase' } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function useReducedMotion(): boolean {
  return useSettings((s) => s.settings.reducedMotion);
}

export function PressableScale({
  children,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  style,
  hitSlop = 6,
  accessibilityLabel,
  accessibilityHint,
  pressedScale = 0.96,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  pressedScale?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const animate = useCallback(
    (to: number) => {
      if (reduced) return;
      Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
    },
    [reduced, scale],
  );
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        disabled={disabled}
        hitSlop={hitSlop}
        onPressIn={() => {
          animate(pressedScale);
          onPressIn?.();
        }}
        onPressOut={() => {
          animate(1);
          onPressOut?.();
        }}
        onPress={onPress}
        style={({ pressed }) => (disabled ? { opacity: 0.45 } : pressed ? { opacity: 0.92 } : null)}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconRight,
  disabled,
  compact,
  style,
  full,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: string;
  iconRight?: string;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  full?: boolean;
}) {
  const palette = {
    primary: { bg: C.accent, fg: C.ink, border: 'transparent' },
    secondary: { bg: C.glassStrong, fg: C.text, border: C.borderStrong },
    ghost: { bg: 'transparent', fg: C.textSecondary, border: C.border },
    danger: { bg: C.dangerDim, fg: '#F4C9BF', border: 'rgba(217,129,112,0.4)' },
    quiet: { bg: 'transparent', fg: C.textMuted, border: 'transparent' },
  }[variant];
  const scale = useTextScale();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[full ? { alignSelf: 'stretch' } : null, style]}
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.button,
          compact ? styles.buttonCompact : null,
          {
            backgroundColor: palette.bg,
            borderColor: palette.border,
            borderRadius: compact ? R.sm : R.md,
          },
          full ? { width: '100%' } : null,
        ]}
      >
        {icon ? <Icon name={icon} size={compact ? 17 : 19} color={palette.fg} /> : null}
        <Text
          style={[
            styles.buttonLabel,
            {
              color: palette.fg,
              fontFamily: FONT.semibold,
              fontSize: Math.round((compact ? 13 : 15) * scale),
            },
          ]}
        >
          {label}
        </Text>
        {iconRight ? <Icon name={iconRight} size={compact ? 16 : 18} color={palette.fg} /> : null}
      </View>
    </PressableScale>
  );
}

export function IconButton({
  name,
  onPress,
  size = 46,
  color = C.text,
  label,
  badge,
  active,
}: {
  name: string;
  onPress: () => void;
  size?: number;
  color?: string;
  label?: string;
  badge?: number | string;
  active?: boolean;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label}>
      <View
        style={[
          styles.iconButton,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: active ? C.accentDim : C.glass,
            borderColor: active ? C.accentLine : C.border,
          },
        ]}
      >
        <Icon name={name} size={size * 0.46} color={active ? C.accent : color} />
        {badge !== undefined && badge !== 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <AppText variant="micro" color={C.textMuted}>
        {children}
      </AppText>
      {right}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  tone = 'neutral',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
  tone?: 'neutral' | 'good' | 'bad' | 'accent';
}) {
  const toneColor =
    tone === 'bad' ? C.danger : tone === 'good' ? C.success : tone === 'accent' ? C.accent : C.textSecondary;
  const content = (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: selected ? C.accentDim : C.glass,
          borderColor: selected ? C.accentLine : C.border,
        },
      ]}
    >
      {icon ? <Icon name={icon} size={14} color={selected ? C.accent : toneColor} /> : null}
      <AppText variant="caption" color={selected ? C.accent : toneColor}>
        {label}
      </AppText>
    </View>
  );
  if (!onPress) return content;
  return (
    <PressableScale onPress={onPress} style={{ alignSelf: 'flex-start' }} accessibilityLabel={label}>
      {content}
    </PressableScale>
  );
}

export function ProgressRing({
  progress,
  size = 72,
  stroke = 4,
  color = C.accent,
  track = 'rgba(233,240,226,0.16)',
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function MeterBar({
  value,
  max = 100,
  color = C.accent,
  height = 6,
  track = 'rgba(233,240,226,0.12)',
  style,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  track?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <View style={[{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }, style]}>
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          borderRadius: height,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={styles.toggleRow}
    >
      <View
        style={[
          styles.toggleTrack,
          { backgroundColor: value ? 'rgba(232,201,143,0.35)' : 'rgba(233,240,226,0.1)', borderColor: value ? C.accentLine : C.border },
        ]}
      >
        <View
          style={[
            styles.toggleKnob,
            { backgroundColor: value ? C.accent : C.textMuted, transform: [{ translateX: value ? 18 : 0 }] },
          ]}
        />
      </View>
    </Pressable>
  );
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  label,
  format,
  width = 220,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  format?: (v: number) => string;
  width?: number;
}) {
  const [trackWidth, setTrackWidth] = useState(width);
  const widthRef = useRef(width);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));

  const update = useCallback((x: number) => {
    const w = widthRef.current;
    if (w <= 0) return;
    const p = Math.max(0, Math.min(1, x / w));
    onChangeRef.current(min + p * (max - min));
  }, [min, max]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => update(e.nativeEvent.locationX),
        onPanResponderMove: (e) => update(e.nativeEvent.locationX),
        onPanResponderTerminationRequest: () => false,
      }),
    [update],
  );

  const knobSize = 22;
  const knobLeft = Math.max(0, Math.min(trackWidth - knobSize, pct * trackWidth - knobSize / 2));

  return (
    <View style={styles.sliderContainer}>
      <View
        style={[styles.sliderTrackArea, { width }]}
        onLayout={(e) => {
          widthRef.current = e.nativeEvent.layout.width;
          setTrackWidth(e.nativeEvent.layout.width);
        }}
        {...responder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value }}
      >
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${pct * 100}%` }]} />
        </View>
        <View style={[styles.sliderKnob, { width: knobSize, height: knobSize, borderRadius: knobSize / 2, left: knobLeft }]} />
      </View>
      <View style={styles.sliderValue}>
        <AppText variant="label" color={C.textSecondary}>
          {format ? format(value) : Math.round(pct * 100).toString()}
        </AppText>
      </View>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={[styles.segment, active ? styles.segmentActive : null]}
          >
            {opt.icon ? <Icon name={opt.icon} size={14} color={active ? C.ink : C.textSecondary} /> : null}
            <AppText variant="caption" color={active ? C.ink : C.textSecondary}>
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 980,
  closeLabel,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  closeLabel?: string;
}) {
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: reduced ? 0 : 220, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(anim, { toValue: 0, duration: reduced ? 0 : 160, useNativeDriver: true }).start(() =>
        setMounted(false),
      );
    }
  }, [visible, reduced, anim, mounted]);

  if (!mounted) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.scrim, opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={closeLabel} />
      </Animated.View>
      <SafeAreaView style={styles.sheetSafe} edges={['top', 'bottom', 'left', 'right']} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            {
              maxWidth,
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <AppText variant="title">{title}</AppText>
              {subtitle ? (
                <AppText variant="caption" color={C.textMuted} style={{ marginTop: 2 }}>
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            <IconButton name="close" onPress={onClose} label={closeLabel ?? 'Close'} size={40} />
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: string; title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={26} color={C.textMuted} />
      </View>
      <AppText variant="heading" color={C.textSecondary} align="center">
        {title}
      </AppText>
      {body ? (
        <AppText variant="body" color={C.textMuted} align="center" style={{ marginTop: 6, maxWidth: 420 }}>
          {body}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    paddingHorizontal: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonCompact: { minHeight: 38, paddingHorizontal: 12, gap: 6 },
  buttonLabel: { letterSpacing: 0.2 },
  iconButton: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: C.ink, fontFamily: FONT.semibold, fontSize: 10 },
  card: {
    backgroundColor: C.glass,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: SP.md,
  },
  divider: { height: 1, backgroundColor: C.border, marginVertical: SP.sm },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SP.xs,
    marginTop: SP.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: R.pill,
    borderWidth: 1,
  },
  toggleRow: { paddingVertical: 4 },
  toggleTrack: { width: 44, height: 26, borderRadius: 13, borderWidth: 1, padding: 3, justifyContent: 'center' },
  toggleKnob: { width: 18, height: 18, borderRadius: 9 },
  sliderContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sliderTrackArea: { height: 42, justifyContent: 'center' },
  sliderTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(233,240,226,0.12)', overflow: 'hidden' },
  sliderFill: { height: '100%', backgroundColor: C.accent, borderRadius: 3 },
  sliderKnob: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.accent,
    borderWidth: 3,
    borderColor: C.bgAlt,
  },
  sliderValue: { minWidth: 48, alignItems: 'flex-end' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(233,240,226,0.07)',
    borderRadius: R.pill,
    padding: 3,
    gap: 2,
    alignSelf: 'flex-start',
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: R.pill,
  },
  segmentActive: { backgroundColor: C.accent },
  sheetSafe: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SP.sm },
  sheet: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(10,21,17,0.97)',
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.borderStrong,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SP.lg,
    paddingTop: SP.md,
    paddingBottom: SP.sm,
    gap: SP.md,
  },
  sheetContent: { paddingHorizontal: SP.lg, paddingBottom: SP.lg },
  sheetFooter: {
    paddingHorizontal: SP.lg,
    paddingVertical: SP.sm,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: 'rgba(6,14,12,0.45)',
  },
  empty: { alignItems: 'center', paddingVertical: SP.xxl, gap: SP.sm },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SP.xs,
  },
});
