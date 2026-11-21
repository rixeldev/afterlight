import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber/native';
import { getEngine } from '../runtime/session';
import { terrainHeight } from '../world/terrain';

const COAT = '#5A8069';
const COAT_DARK = '#436354';
const SKIN = '#D8B592';
const SCARF = '#DDBB7E';
const BELT = '#4A3A2A';
const BOOT = '#41352B';

export function PlayerAvatar({ shadows }: { shadows: boolean }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const toolGroup = useRef<THREE.Group>(null);
  const torchGroup = useRef<THREE.Group>(null);
  const torchLight = useRef<THREE.PointLight>(null);
  const flame = useRef<THREE.Mesh>(null);
  const shadowDisc = useRef<THREE.Mesh>(null);
  const phase = useRef(0);
  const last = useRef({ x: 0, z: 0 });
  const grounded = useRef(0);

  const legGeometry = useMemo(() => new THREE.CapsuleGeometry(0.11, 0.42, 3, 7), []);
  const armGeometry = useMemo(() => new THREE.CapsuleGeometry(0.088, 0.36, 3, 7), []);
  const coatMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: COAT }), []);
  const coatDarkMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: COAT_DARK }), []);
  const skinMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: SKIN }), []);
  const scarfMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: SCARF }), []);
  const bootMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: BOOT }), []);
  const beltMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: BELT }), []);
  const metalMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8A8F87', metalness: 0.5, roughness: 0.5 }), []);
  const stoneMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: '#7C8076' }), []);
  const woodMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: '#5C4530' }), []);

  useFrame((state, delta) => {
    const engine = getEngine();
    if (!engine || !root.current) return;
    const p = engine.state.player;
    const y = terrainHeight(p.x, p.z);
    root.current.position.set(p.x, y, p.z);
    root.current.rotation.y = p.facing + Math.PI;

    const dx = p.x - last.current.x;
    const dz = p.z - last.current.z;
    const speed = Math.min(1, Math.hypot(dx, dz) / Math.max(0.0001, delta) / 4.5);
    last.current = { x: p.x, z: p.z };
    phase.current += delta * (2.6 + speed * 7.2);
    grounded.current += delta;

    const action = engine.getActionInfo();
    const attack = engine.runtime.attackFlash;

    if (action) {
      const p = action.progress;
      const swing = Math.sin(Math.min(1, p) * Math.PI);
      const chopping = action.kind === 'tree' || action.kind === 'rock' || action.kind === 'crate' || action.kind === 'cache';
      if (leftLeg.current) leftLeg.current.rotation.x = 0.08;
      if (rightLeg.current) rightLeg.current.rotation.x = -0.08;
      if (leftArm.current) leftArm.current.rotation.x = -0.35 - swing * 0.35;
      if (rightArm.current) {
        rightArm.current.rotation.x = chopping ? -0.15 - swing * 2.1 : -0.55 - swing * 1.15;
        rightArm.current.rotation.z = chopping ? -0.18 : -0.05;
      }
      if (body.current) {
        body.current.rotation.x = chopping ? 0.08 + swing * 0.16 : 0.26 + swing * 0.2;
        body.current.position.y = chopping ? 0 : -0.16 * swing;
        body.current.position.z = chopping ? 0.08 * swing : 0.04 * swing;
      }
    } else {
      const swing = Math.sin(phase.current) * 0.55 * speed;
      if (leftLeg.current) leftLeg.current.rotation.x = swing;
      if (rightLeg.current) rightLeg.current.rotation.x = -swing;
      if (leftArm.current) leftArm.current.rotation.x = -swing * 0.7;
      if (rightArm.current) {
        rightArm.current.rotation.x = swing * 0.5 - attack * 1.9;
        rightArm.current.rotation.z = -attack * 0.35;
      }
      if (body.current) {
        body.current.position.y = Math.abs(Math.sin(phase.current)) * 0.035 * speed;
        body.current.position.z = 0;
        body.current.rotation.x = speed * 0.05;
      }
      if (body.current && speed < 0.02) {
        body.current.position.y = Math.sin(state.clock.elapsedTime * 1.6) * 0.008;
      }
    }

    const equipped = engine.state.player.equipped;
    if (toolGroup.current) {
      const kind = equipped ? engine.equippedTool()?.kind : null;
      if (kind === 'axe' || kind === 'pickaxe') {
        toolGroup.current.visible = true;
        toolGroup.current.rotation.z = kind === 'pickaxe' ? 0.5 : 0;
      } else {
        toolGroup.current.visible = false;
      }
    }
    const torchEquipped = equipped === 'torch';
    if (torchGroup.current) torchGroup.current.visible = torchEquipped;
    if (torchLight.current) torchLight.current.visible = torchEquipped;
    if (flame.current && torchEquipped) {
      const t = state.clock.elapsedTime;
      flame.current.scale.set(1 + Math.sin(t * 8.1) * 0.1, 1 + Math.sin(t * 11.3) * 0.16, 1);
    }
    if (shadowDisc.current) {
      shadowDisc.current.position.y = 0.02;
      const mat = shadowDisc.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.28;
    }
  });

  return (
    <group ref={root}>
      {/* soft contact shadow */}
      <mesh ref={shadowDisc} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.55, 18]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
      </mesh>

      <group ref={body}>
        {/* legs */}
        <group ref={leftLeg} position={[-0.15, 0.72, 0]}>
          <mesh geometry={legGeometry} material={coatDarkMaterial} position={[0, -0.28, 0]} castShadow={shadows} />
          <mesh position={[0, -0.56, 0.05]} material={bootMaterial} castShadow={shadows}>
            <boxGeometry args={[0.2, 0.14, 0.32]} />
          </mesh>
        </group>
        <group ref={rightLeg} position={[0.15, 0.72, 0]}>
          <mesh geometry={legGeometry} material={coatDarkMaterial} position={[0, -0.28, 0]} castShadow={shadows} />
          <mesh position={[0, -0.56, 0.05]} material={bootMaterial} castShadow={shadows}>
            <boxGeometry args={[0.2, 0.14, 0.32]} />
          </mesh>
        </group>

        {/* torso */}
        <mesh position={[0, 1.06, 0]} material={coatMaterial} castShadow={shadows}>
          <capsuleGeometry args={[0.26, 0.42, 4, 9]} />
        </mesh>
        <mesh position={[0, 0.86, 0]} rotation={[0, 0, 0]} material={beltMaterial}>
          <cylinderGeometry args={[0.27, 0.27, 0.1, 10]} />
        </mesh>
        {/* cloak back */}
        <mesh position={[0, 1.0, -0.19]} rotation={[0.08, 0, 0]} material={coatDarkMaterial} castShadow={shadows}>
          <boxGeometry args={[0.5, 0.85, 0.08]} />
        </mesh>

        {/* scarf */}
        <mesh position={[0, 1.3, 0]} material={scarfMaterial}>
          <torusGeometry args={[0.19, 0.06, 6, 12]} />
        </mesh>

        {/* head + hood */}
        <mesh position={[0, 1.44, 0]} material={skinMaterial} castShadow={shadows}>
          <sphereGeometry args={[0.155, 10, 8]} />
        </mesh>
        <mesh position={[0, 1.47, -0.035]} material={coatDarkMaterial} castShadow={shadows}>
          <sphereGeometry args={[0.185, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        </mesh>
        <mesh position={[0, 1.58, -0.06]} rotation={[0.25, 0, 0]} material={coatMaterial}>
          <coneGeometry args={[0.19, 0.3, 8]} />
        </mesh>

        {/* backpack */}
        <mesh position={[0, 1.1, -0.28]} rotation={[0.05, 0, 0]} material={beltMaterial} castShadow={shadows}>
          <boxGeometry args={[0.38, 0.46, 0.18]} />
        </mesh>
        <mesh position={[0, 1.1, -0.38]} material={scarfMaterial}>
          <boxGeometry args={[0.3, 0.12, 0.05]} />
        </mesh>

        {/* arms */}
        <group ref={leftArm} position={[-0.31, 1.26, 0]}>
          <mesh geometry={armGeometry} material={coatMaterial} position={[0, -0.2, 0]} castShadow={shadows} />
          <mesh position={[0, -0.4, 0]} material={skinMaterial}>
            <sphereGeometry args={[0.075, 8, 6]} />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.31, 1.26, 0]}>
          <mesh geometry={armGeometry} material={coatMaterial} position={[0, -0.2, 0]} castShadow={shadows} />
          <mesh position={[0, -0.4, 0]} material={skinMaterial}>
            <sphereGeometry args={[0.075, 8, 6]} />
          </mesh>

          {/* tool in hand */}
          <group ref={toolGroup} position={[0, -0.42, 0.02]} visible={false}>
            <mesh rotation={[1.2, 0, 0]} material={woodMaterial}>
              <cylinderGeometry args={[0.025, 0.03, 0.72, 6]} />
            </mesh>
            <mesh position={[0, -0.24, 0.16]} rotation={[0, 0, 0.2]} material={stoneMaterial}>
              <boxGeometry args={[0.3, 0.14, 0.06]} />
            </mesh>
          </group>
          <group ref={torchGroup} position={[0, -0.42, 0.04]} visible={false}>
            <mesh rotation={[0.2, 0, 0]} material={woodMaterial}>
              <cylinderGeometry args={[0.022, 0.028, 0.55, 5]} />
            </mesh>
            <mesh ref={flame} position={[0, 0.32, 0]}>
              <coneGeometry args={[0.08, 0.24, 6]} />
              <meshBasicMaterial color="#FFC46B" transparent opacity={0.95} />
            </mesh>
            <pointLight ref={torchLight} position={[0, 0.36, 0]} color="#FFB25A" intensity={2.0} distance={10} decay={2} />
          </group>
        </group>
        <mesh position={[0.34, 1.06, 0.05]} material={metalMaterial}>
          <boxGeometry args={[0.06, 0.14, 0.03]} />
        </mesh>
      </group>
    </group>
  );
}
