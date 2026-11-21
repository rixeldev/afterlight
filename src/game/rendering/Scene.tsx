import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as THREE from 'three';
import { getEngine } from '../runtime/session';
import { inputState } from '../runtime/input';
import { useSession } from '../../state/sessionStore';
import { terrainHeight } from '../world/terrain';
import { Environment } from './Environment';
import { Terrain, Water } from './Terrain';
import { Vegetation, useWorldRevision } from './Vegetation';
import {
  Footbridge,
  Lookout,
  RangerCamp,
  SilentGate,
  StarterCamp,
  Structures,
} from './WorldProps';
import { PlayerAvatar } from './PlayerAvatar';
import { ThreatActor } from './ThreatActor';
import { ImpactFx } from './ImpactFx';
import { AppText, Button } from '../../ui/components/Primitives';
import { C } from '../../ui/theme';
import { useSettings, useT } from '../../state/settingsStore';

import { renderStats } from './stats';

/** Rendering-only frame hook; the simulation lives in SimulationLoop. */
function RenderTicker() {
  useFrame(() => {
    const engine = getEngine();
    if (!engine) return;
    if (useSession.getState().panel === 'build') {
      const dx = inputState.moveX;
      const dz = -inputState.moveY;
      if (Math.hypot(dx, dz) > 0.15) engine.moveBuildGhost(dx * 0.13, dz * 0.13);
    }
  });
  return null;
}

function FpsSampler() {
  const { gl: renderer } = useThree();
  const acc = useRef({ frames: 0, time: 0 });
  useFrame((_, delta) => {
    const a = acc.current;
    a.frames += 1;
    a.time += delta;
    if (a.time >= 1) {
      renderStats.fps = Math.round(a.frames / a.time);
      a.frames = 0;
      a.time = 0;
      const info = renderer.info.render;
      renderStats.drawCalls = info.calls;
      renderStats.triangles = info.triangles;
    }
  });
  return null;
}

function CameraRig() {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 1.5, 0));
  const desired = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());
  const initialized = useRef(false);
  useFrame((state, delta) => {
    const engine = getEngine();
    if (!engine) return;
    const p = engine.state.player;
    const baseY = terrainHeight(p.x, p.z);
    const pitch = inputState.cameraPitch;
    const dist = inputState.cameraDistance;
    target.current.set(p.x, baseY + 1.5, p.z);
    desired.current.set(
      p.x + Math.sin(inputState.cameraYaw) * Math.cos(pitch) * dist,
      baseY + 1.55 + Math.sin(pitch) * dist,
      p.z + Math.cos(inputState.cameraYaw) * Math.cos(pitch) * dist,
    );
    const ground = terrainHeight(desired.current.x, desired.current.z) + 0.85;
    if (desired.current.y < ground) desired.current.y = ground;
    if (!initialized.current) {
      camera.position.copy(desired.current);
      look.current.copy(target.current);
      initialized.current = true;
    } else {
      const k = 1 - Math.exp(-delta * 9.5);
      camera.position.lerp(desired.current, k);
      look.current.lerp(target.current, k);
    }
    const impactShake = engine.runtime.damageFlash;
    if (impactShake > 0.01) {
      const t = state.clock.elapsedTime * 46;
      camera.position.x += Math.sin(t * 1.7) * 0.11 * impactShake;
      camera.position.y += Math.cos(t * 2.3) * 0.08 * impactShake;
    }
    camera.lookAt(look.current);
    if (camera instanceof THREE.PerspectiveCamera) {
      const wantFov = 58;
      if (Math.abs(camera.fov - wantFov) > 0.01) {
        camera.fov = wantFov;
        camera.updateProjectionMatrix();
      }
    }
  });
  return null;
}

function SceneContents({ quality }: { quality: 'low' | 'medium' | 'high' }) {
  const revision = useWorldRevision();
  const shadows = quality === 'high';
  return (
    <>
      <Environment quality={quality} />
      <RenderTicker />
      <CameraRig />
      <FpsSampler />
      <Terrain shadows={shadows} lowQuality={quality === 'low'} />
      <Water lowQuality={quality === 'low'} />
      <Vegetation revision={revision} shadows={shadows} quality={quality} />
      <StarterCamp shadows={shadows} />
      <RangerCamp shadows={shadows} />
      <Footbridge shadows={shadows} />
      <Lookout shadows={shadows} />
      <SilentGate shadows={shadows} />
      <Structures revision={revision} />
      <PlayerAvatar shadows={shadows} />
      <ThreatActor shadows={shadows} />
      <ImpactFx />
    </>
  );
}

interface BoundaryState {
  error: Error | null;
}

class RendererBoundary extends React.Component<{ children: React.ReactNode; onRetry: () => void }, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.warn('Renderer error', error.message);
  }

  override render() {
    if (this.state.error) {
      return <RendererFallback onRetry={() => this.setState({ error: null })} message={this.state.error.message} />;
    }
    return this.props.children;
  }
}

function RendererFallback({ onRetry, message }: { onRetry: () => void; message?: string }) {
  const { t } = useT();
  const update = useSettings((s) => s.update);
  return (
    <View style={styles.fallback}>
      <AppText variant="heading" align="center">
        {t('common.webgl_error')}
      </AppText>
      <AppText variant="body" color={C.textMuted} align="center" style={{ maxWidth: 520, marginTop: 8 }}>
        {t('common.webgl_error_body')}
      </AppText>
      {message ? (
        <AppText variant="caption" color={C.textMuted} align="center" style={{ maxWidth: 520, marginTop: 8 }}>
          {message}
        </AppText>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
        <Button label={t('common.retry')} icon="rotate" onPress={onRetry} />
        <Button
          label={t('common.reduce_graphics')}
          variant="secondary"
          icon="settings"
          onPress={() => {
            update({ graphics: 'low' });
            onRetry();
          }}
        />
      </View>
    </View>
  );
}

export function GameScene({ quality }: { quality: 'low' | 'medium' | 'high' }) {
  const { t } = useT();
  const [attempt, setAttempt] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [glReady, setGlReady] = useState(false);
  const [glFailed, setGlFailed] = useState(false);
  const update = useSettings((s) => s.update);

  useEffect(() => {
    // Let the screen paint before creating the GL surface (avoids a black frame
    // during navigation and gives the native context a stable view size).
    const id = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    useSession.getState().setRendererFailed(glFailed && !glReady);
  }, [glFailed, glReady]);

  useEffect(() => {
    if (!mounted || glReady || glFailed) return;
    // Some drivers fail to create an Expo GL context without throwing. Never
    // leave the player looking at an unexplained black screen.
    const id = setTimeout(() => setGlFailed(true), 30000);
    return () => clearTimeout(id);
  }, [mounted, glReady, glFailed]);

  const retry = () => {
    setGlFailed(false);
    setGlReady(false);
    setAttempt((a) => a + 1);
  };

  if (!mounted) return <View style={styles.container} />;
  if (glFailed && !glReady) {
    return (
      <View style={styles.container}>
        <View style={styles.fallbackInner}>
          <AppText variant="heading" align="center">
            {t('common.webgl_error')}
          </AppText>
          <AppText variant="body" color={C.textMuted} align="center" style={{ maxWidth: 520, marginTop: 8 }}>
            {t('common.webgl_error_body')}
          </AppText>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
            <Button label={t('common.retry')} icon="rotate" onPress={retry} />
            <Button
              label={t('common.reduce_graphics')}
              variant="secondary"
              icon="settings"
              onPress={() => {
                update({ graphics: 'low' });
                retry();
              }}
            />
          </View>
        </View>
      </View>
    );
  }
  const loading = mounted && !glReady && !glFailed;
  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <AppText variant="caption" color={C.textMuted}>
            {t('app.loading')}
          </AppText>
        </View>
      ) : null}
      <RendererBoundary key={attempt} onRetry={retry}>
        <Canvas
          style={styles.canvas}
          frameloop="always"
          flat
          shadows={quality === 'high'}
          gl={{ antialias: quality !== 'low' }}
          camera={{ fov: 58, near: 0.12, far: 420, position: [0, 8, 14] }}
          onCreated={({ gl, scene }) => {
            setGlReady(true);
            useSession.getState().setRendererFailed(false);
            gl.setClearColor('#0B1714', 1);
            gl.toneMappingExposure = 1.18;
            scene.background = new THREE.Color('#0B1714');
          }}
        >
          <SceneContents quality={quality} />
        </Canvas>
      </RendererBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  canvas: { flex: 1 },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 120,
    alignItems: 'center',
    zIndex: 2,
  },
  fallbackInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: C.bg,
  },
});
