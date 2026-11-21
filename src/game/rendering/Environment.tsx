import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getEngine } from '../runtime/session';

type Stop = { h: number; top: string; horizon: string; sun: string; ambient: number; direct: number; fog: string };

const STOPS: Stop[] = [
  { h: 0, top: '#04080D', horizon: '#121C24', sun: '#9FB4CC', ambient: 0.42, direct: 0.32, fog: '#0C161C' },
  { h: 5, top: '#061016', horizon: '#1A2730', sun: '#9FB4CC', ambient: 0.42, direct: 0.3, fog: '#101B20' },
  { h: 6.5, top: '#1B2C33', horizon: '#E0B487', sun: '#FFD9A0', ambient: 0.62, direct: 0.75, fog: '#6E7A6C' },
  { h: 9, top: '#33505C', horizon: '#A9BCA6', sun: '#FFF3D6', ambient: 0.78, direct: 1.2, fog: '#8FA090' },
  { h: 16, top: '#33505C', horizon: '#ACBDA4', sun: '#FFF0CC', ambient: 0.78, direct: 1.15, fog: '#8FA090' },
  { h: 18.5, top: '#2A3140', horizon: '#D8916A', sun: '#FFB27A', ambient: 0.6, direct: 0.72, fog: '#7C7568' },
  { h: 20.5, top: '#0B1520', horizon: '#29323A', sun: '#9FB4CC', ambient: 0.44, direct: 0.3, fog: '#1A2329' },
  { h: 24, top: '#04080D', horizon: '#121C24', sun: '#9FB4CC', ambient: 0.42, direct: 0.32, fog: '#0C161C' },
];

const COLOR_CACHE = STOPS.map((s) => ({
  top: new THREE.Color(s.top),
  horizon: new THREE.Color(s.horizon),
  sun: new THREE.Color(s.sun),
  fog: new THREE.Color(s.fog),
  ambient: s.ambient,
  direct: s.direct,
  h: s.h,
}));

function sampleTime(hour: number) {
  let a = COLOR_CACHE[0];
  let b = COLOR_CACHE[COLOR_CACHE.length - 1];
  for (let i = 0; i < COLOR_CACHE.length - 1; i += 1) {
    const cur = COLOR_CACHE[i];
    const next = COLOR_CACHE[i + 1];
    if (cur && next && hour >= cur.h && hour <= next.h) {
      a = cur;
      b = next;
      break;
    }
  }
  const span = Math.max(0.0001, b.h - a.h);
  const t = Math.max(0, Math.min(1, (hour - a.h) / span));
  return { a, b, t };
}

const VERTEX = `
varying vec3 vWorldPosition;
void main() {
  vWorldPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform float uNight;
varying vec3 vWorldPosition;
void main() {
  vec3 dir = normalize(vWorldPosition);
  float h = smoothstep(-0.04, 0.62, dir.y);
  vec3 col = mix(uHorizon, uTop, h);
  // A faint cosmic wash keeps night skies from reading as flat black.
  col += uNight * vec3(0.012, 0.02, 0.035) * (1.0 - h);
  gl_FragColor = vec4(col, 1.0);
}
`;

export function Environment({ quality }: { quality: 'low' | 'medium' | 'high' }) {
  const { scene } = useThree();
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#33505C') },
      uHorizon: { value: new THREE.Color('#A9BCA6') },
      uNight: { value: 0 },
    }),
    [],
  );

  const sunLight = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sunDisc = useRef<THREE.Mesh>(null);
  const stars = useRef<THREE.Points>(null);
  const fogColor = useMemo(() => new THREE.Color('#8FA090'), []);

  const starsGeometry = useMemo(() => {
    const count = 420;
    const positions = new Float32Array(count * 3);
    let seed = 7331;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < count; i += 1) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(rand() * 0.92);
      const r = 250;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) + 10;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  const fog = useMemo(() => new THREE.FogExp2(fogColor.getHex(), 0.0085), [fogColor]);
  scene.fog = fog;

  useEffect(() => {
    // The shadow camera follows the player so high quality shadows exist
    // everywhere in the valley, not just at spawn.
    const light = sunLight.current;
    if (!light) return;
    scene.add(light.target);
    return () => {
      scene.remove(light.target);
    };
  }, [scene]);

  useFrame((state) => {
    const engine = getEngine();
    const minutes = engine ? engine.state.minutes % 1440 : 600;
    const hour = minutes / 60;
    const { a, b, t } = sampleTime(hour);

    uniforms.uTop.value.copy(a.top).lerp(b.top, t);
    uniforms.uHorizon.value.copy(a.horizon).lerp(b.horizon, t);
    uniforms.uNight.value = hour < 6 || hour > 19.5 ? 1 : 0;

    const fogCol = a.fog.clone().lerp(b.fog, t);
    fogColor.copy(fogCol);
    fog.color.copy(fogCol);
    fog.density = quality === 'low' ? 0.011 : 0.0085;

    // Sun / moon arc across the valley.
    const theta = ((hour - 6) / 12) * Math.PI;
    const dir = new THREE.Vector3(Math.cos(theta) * 120, Math.sin(theta) * 95, 48);
    const isNight = dir.y < 2;
    const lightDir = isNight ? new THREE.Vector3(-dir.x, Math.abs(dir.y) * 0.8 + 18, -dir.z) : dir;
    if (sunLight.current) {
      const enginePlayer = engine?.state.player;
      const px = enginePlayer?.x ?? 0;
      const pz = enginePlayer?.z ?? 0;
      const d = lightDir.clone().normalize().multiplyScalar(90);
      sunLight.current.position.set(px + d.x, d.y, pz + d.z);
      sunLight.current.target.position.set(px, 0, pz);
      sunLight.current.target.updateMatrixWorld();
      sunLight.current.intensity = (a.direct + (b.direct - a.direct) * t) * (isNight ? 0.8 : 1);
      sunLight.current.color.copy(a.sun).lerp(b.sun, t);
    }
    if (hemi.current) {
      hemi.current.intensity = a.ambient + (b.ambient - a.ambient) * t;
      hemi.current.color.copy(uniforms.uTop.value);
      hemi.current.groundColor.copy(fogCol);
    }
    if (sunDisc.current) {
      const discDir = isNight ? new THREE.Vector3(-dir.x, Math.abs(dir.y) + 12, -dir.z) : dir;
      const d = discDir.clone().normalize().multiplyScalar(215);
      sunDisc.current.position.set(d.x, d.y, d.z);
      const mat = sunDisc.current.material as THREE.MeshBasicMaterial;
      mat.color.copy(a.sun).lerp(b.sun, t);
      mat.opacity = isNight ? 0.55 : 0.95;
    }
    if (stars.current) {
      const mat = stars.current.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, Math.min(0.9, uniforms.uNight.value * 0.8 - 0.08));
    }
    // The sky sphere must always contain the camera.
    void state;
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#9FB7A8', '#2C3B33', 0.7]} />
      <directionalLight
        ref={sunLight}
        position={[40, 90, 30]}
        intensity={1.1}
        color="#FFEFD2"
        castShadow={quality === 'high'}
        shadow-mapSize-width={quality === 'high' ? 1024 : 512}
        shadow-mapSize-height={quality === 'high' ? 1024 : 512}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={1}
        shadow-camera-far={180}
        shadow-bias={-0.0006}
      />
      <mesh scale={[1, 1, 1]} frustumCulled={false}>
        <sphereGeometry args={[260, 24, 16]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={VERTEX}
          fragmentShader={FRAGMENT}
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>
      <points ref={stars} geometry={starsGeometry} frustumCulled={false}>
        <pointsMaterial size={1.7} color="#DDE7EA" transparent opacity={0} depthWrite={false} fog={false} sizeAttenuation={false} />
      </points>
      <mesh ref={sunDisc} frustumCulled={false}>
        <sphereGeometry args={[7.5, 16, 12]} />
        <meshBasicMaterial color="#FFEFC9" transparent opacity={0.95} fog={false} />
      </mesh>
    </>
  );
}
