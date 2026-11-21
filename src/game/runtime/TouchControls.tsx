import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { useSettings } from '../../state/settingsStore';
import { getEngine } from './session';
import { rotateCamera, setMove } from './input';
import { C } from '../../ui/theme';
import { Icon } from '../../ui/components/Icon';

const BASE = 106;
const KNOB = 48;
const MAX = 42;

/**
 * One transparent layer owns every open-world touch. Because it is a single
 * view using raw touch events (not PanResponder), two fingers work at the same
 * time: the left thumb drives the stick while the right thumb turns the camera.
 * HUD controls sit above this layer and keep their taps.
 */
export function TouchControls() {
  const { width, height } = useWindowDimensions();
  const leftHanded = useSettings((s) => s.settings.leftHanded);
  const sensitivity = useSettings((s) => s.settings.cameraSensitivity);
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;

  const home = useMemo(
    () => ({
      x: leftHanded ? width - 16 - BASE / 2 : 16 + BASE / 2,
      y: height - 16 - BASE / 2,
    }),
    [width, height, leftHanded],
  );
  const zone = useMemo(
    () => ({
      width: Math.max(250, Math.min(380, width * 0.44)),
      height: Math.min(330, Math.max(260, height * 0.75)),
    }),
    [width, height],
  );

  const [active, setActive] = useState(false);
  const knob = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const moveTouch = useRef<number | null>(null);
  const cameraTouch = useRef<number | null>(null);
  const cameraLast = useRef({ x: 0, y: 0 });
  const homeRef = useRef(home);
  homeRef.current = home;
  const zoneRef = useRef(zone);
  zoneRef.current = zone;

  const releaseStick = useCallback(() => {
    moveTouch.current = null;
    setActive(false);
    setMove(0, 0);
    Animated.spring(knob, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
      speed: 26,
      bounciness: 5,
    }).start();
  }, [knob]);

  const inStickZone = (x: number, y: number) => {
    const z = zoneRef.current;
    const h = homeRef.current;
    const nearHome = Math.hypot(x - h.x, y - h.y) <= Math.max(BASE * 1.35, 110);
    const leftSide = h.x < width / 2;
    const xOk = leftSide ? x <= z.width : x >= width - z.width;
    const yOk = y >= height - z.height;
    return nearHome || (xOk && yOk);
  };

  const applyStick = (x: number, y: number) => {
    const h = homeRef.current;
    const dx = x - h.x;
    const dy = y - h.y;
    const len = Math.hypot(dx, dy);
    const clamp = len > MAX ? MAX / len : 1;
    const kx = dx * clamp;
    const ky = dy * clamp;
    knob.setValue({ x: kx, y: ky });
    setMove(kx / MAX, -ky / MAX);
  };

  const onTouchStart = (event: GestureResponderEvent) => {
    for (const touch of event.nativeEvent.changedTouches) {
      const x = touch.locationX;
      const y = touch.locationY;
      if (moveTouch.current === null && inStickZone(x, y)) {
        moveTouch.current = touch.identifier;
        getEngine()?.setAuto(false);
        setActive(true);
        applyStick(x, y);
        continue;
      }
      if (cameraTouch.current === null) {
        cameraTouch.current = touch.identifier;
        cameraLast.current = { x, y };
      }
    }
  };

  const onTouchMove = (event: GestureResponderEvent) => {
    for (const touch of event.nativeEvent.changedTouches) {
      if (touch.identifier === moveTouch.current) {
        applyStick(touch.locationX, touch.locationY);
      } else if (touch.identifier === cameraTouch.current) {
        const dx = touch.locationX - cameraLast.current.x;
        const dy = touch.locationY - cameraLast.current.y;
        cameraLast.current = { x: touch.locationX, y: touch.locationY };
        rotateCamera(dx, dy, sensitivityRef.current);
      }
    }
  };

  const endTouches = (event: GestureResponderEvent) => {
    for (const touch of event.nativeEvent.changedTouches) {
      if (touch.identifier === moveTouch.current) releaseStick();
      if (touch.identifier === cameraTouch.current) cameraTouch.current = null;
    }
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={endTouches}
      onTouchCancel={endTouches}
      accessibilityLabel="World touch controls"
    >
      <View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            left: home.x - BASE / 2,
            top: home.y - BASE / 2,
            opacity: active ? 1 : 0.55,
            borderColor: active ? C.accentLine : 'rgba(233,240,226,0.18)',
            backgroundColor: active ? 'rgba(232,201,143,0.06)' : 'rgba(6,14,12,0.2)',
          },
        ]}
      >
        <View style={styles.cardinal}>
          <Icon name="chevron_down" size={12} color="rgba(233,240,226,0.28)" />
        </View>
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.knob,
          {
            left: home.x - KNOB / 2,
            top: home.y - KNOB / 2,
            transform: [{ translateX: knob.x }, { translateY: knob.y }],
            backgroundColor: active ? 'rgba(232,201,143,0.4)' : 'rgba(233,240,226,0.16)',
            borderColor: active ? C.accent : 'rgba(233,240,226,0.26)',
          },
        ]}
      >
        <View style={styles.dot} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    width: BASE,
    height: BASE,
    borderRadius: BASE / 2,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardinal: { position: 'absolute', top: 6 },
  knob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(242,238,226,0.45)' },
});
