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
  const head = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftKnee = useRef<THREE.Group>(null);
  const rightKnee = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftElbow = useRef<THREE.Group>(null);
  const rightElbow = useRef<THREE.Group>(null);
  const cloak = useRef<THREE.Group>(null);
  const toolGroup = useRef<THREE.Group>(null);
  const torchGroup = useRef<THREE.Group>(null);
  const torchLight = useRef<THREE.PointLight>(null);
  const flame = useRef<THREE.Mesh>(null);
  const shadowDisc = useRef<THREE.Mesh>(null);
  const phase = useRef(0);
  const last = useRef({ x: 0, z: 0 });
  const smoothY = useRef<number | null>(null);

  const upperLegGeometry = useMemo(() => new THREE.CapsuleGeometry(0.105, 0.3, 3, 7), []);
  const lowerLegGeometry = useMemo(() => new THREE.CapsuleGeometry(0.085, 0.26, 3, 7), []);
  const upperArmGeometry = useMemo(() => new THREE.CapsuleGeometry(0.085, 0.26, 3, 7), []);
  const forearmGeometry = useMemo(() => new THREE.CapsuleGeometry(0.07, 0.24, 3, 7), []);
  const coatMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: COAT }), []);
  const coatDarkMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: COAT_DARK }), []);
  const skinMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: SKIN }), []);
  const scarfMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: SCARF }), []);
  const bootMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: BOOT }), []);
  const beltMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: BELT }), []);
  const metalMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8A8F87', metalness: 0.5, roughness: 0.5 }), []);
  const stoneMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: '#7C8076' }), []);
  const woodMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: '#5C4530' }), []);
  const eyeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#1E1B17' }), []);

  useFrame((state, delta) => {
    const engine = getEngine();
    if (!engine || !root.current) return;
    const p = engine.state.player;
    const groundY = terrainHeight(p.x, p.z);
    if (smoothY.current === null) smoothY.current = groundY;
    smoothY.current += (groundY - smoothY.current) * Math.min(1, delta * 20);
    root.current.position.set(p.x, smoothY.current, p.z);
    root.current.rotation.y = p.facing + Math.PI;

    const dx = p.x - last.current.x;
    const dz = p.z - last.current.z;
    const speed = Math.min(1, Math.hypot(dx, dz) / Math.max(0.0001, delta) / 4.5);
    last.current = { x: p.x, z: p.z };
    phase.current += delta * (2.8 + speed * 7.6);

    const action = engine.getActionInfo();
    const attack = engine.runtime.attackFlash;
    const swing = Math.sin(phase.current);
    const cos = Math.cos(phase.current);

    const setPose = (
      hipL: number,
      hipR: number,
      kneeL: number,
      kneeR: number,
      shoulderL: number,
      shoulderR: number,
      elbowL: number,
      elbowR: number,
      lean: number,
      crouch: number,
    ) => {
      if (leftLeg.current) leftLeg.current.rotation.x = hipL;
      if (rightLeg.current) rightLeg.current.rotation.x = hipR;
      if (leftKnee.current) leftKnee.current.rotation.x = kneeL;
      if (rightKnee.current) rightKnee.current.rotation.x = kneeR;
      if (leftArm.current) leftArm.current.rotation.x = shoulderL;
      if (rightArm.current) rightArm.current.rotation.x = shoulderR;
      if (leftElbow.current) leftElbow.current.rotation.x = elbowL;
      if (rightElbow.current) rightElbow.current.rotation.x = elbowR;
      if (body.current) {
        body.current.rotation.x = lean;
        body.current.position.y = crouch;
        body.current.position.z = 0;
      }
    };

    if (action) {
      const pct = action.progress;
      const arc = Math.sin(Math.min(1, pct) * Math.PI);
      const chopping = action.kind === 'tree' || action.kind === 'rock' || action.kind === 'crate' || action.kind === 'cache';
      if (chopping) {
        setPose(
          0.14,
          -0.08,
          0.08,
          0.16,
          -0.4 - arc * 0.4,
          -0.1 - arc * 2.15,
          -0.35,
          0.12 + arc * 0.55,
          0.06 + arc * 0.17,
          0,
        );
      } else {
        setPose(
          -0.35,
          -0.2,
          0.55,
          0.42,
          -0.5 - arc * 0.4,
          -0.6 - arc * 1.15,
          -0.4,
          0.3 + arc * 0.5,
          0.24 + arc * 0.18,
          -0.13 * arc,
        );
      }
      if (cloak.current) cloak.current.rotation.x = 0.08 + arc * 0.1;
    } else {
      const hip = swing * 0.58 * speed;
      const kneeBack = Math.max(0, -swing) * 0.85 * speed;
      const kneeFront = Math.max(0, swing) * 0.5 * speed;
      setPose(
        hip,
        -hip,
        kneeBack + 0.04,
        kneeFront + 0.04,
        -swing * 0.72 * speed,
        swing * 0.55 * speed - attack * 1.9,
        0.16 + Math.max(0, -swing) * 0.25 * speed,
        0.18 + Math.max(0, swing) * 0.33 * speed + attack * 0.6,
        speed * 0.07,
        Math.abs(cos) * 0.03 * speed,
      );
      if (cloak.current) {
        cloak.current.rotation.x = 0.05 + speed * 0.14;
        cloak.current.rotation.z = Math.sin(phase.current * 0.5) * 0.04 * speed;
      }
      if (body.current && speed < 0.02) {
        body.current.position.y = Math.sin(state.clock.elapsedTime * 1.6) * 0.008;
        if (head.current) {
          head.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.14;
        }
      } else if (head.current) {
        head.current.rotation.y *= 0.9;
      }
    }

    const equipped = engine.state.player.equipped;
    const kind = equipped ? engine.equippedTool()?.kind : null;
    if (toolGroup.current) {
      toolGroup.current.visible = kind === 'axe' || kind === 'pickaxe';
      toolGroup.current.rotation.z = kind === 'pickaxe' ? 0.5 : 0;
    }
    const torchEquipped = equipped === 'torch';
    if (torchGroup.current) torchGroup.current.visible = torchEquipped;
    if (torchLight.current) torchLight.current.visible = torchEquipped;
    if (flame.current && torchEquipped) {
      const t = state.clock.elapsedTime;
      flame.current.scale.set(1 + Math.sin(t * 8.1) * 0.1, 1 + Math.sin(t * 11.3) * 0.16, 1);
    }
    if (shadowDisc.current) {
      (shadowDisc.current.material as THREE.MeshBasicMaterial).opacity = 0.3;
    }
  });

  return (
    <group ref={root}>
      <mesh ref={shadowDisc} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.52, 18]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
      </mesh>

      <group ref={body}>
        {/* legs with knees */}
        <group ref={leftLeg} position={[-0.14, 0.74, 0]}>
          <mesh geometry={upperLegGeometry} material={coatDarkMaterial} position={[0, -0.16, 0]} castShadow={shadows} />
          <group ref={leftKnee} position={[0, -0.34, 0]}>
            <mesh geometry={lowerLegGeometry} material={coatDarkMaterial} position={[0, -0.15, 0]} castShadow={shadows} />
            <mesh position={[0, -0.32, 0.05]} material={bootMaterial} castShadow={shadows}>
              <boxGeometry args={[0.19, 0.13, 0.31]} />
            </mesh>
          </group>
        </group>
        <group ref={rightLeg} position={[0.14, 0.74, 0]}>
          <mesh geometry={upperLegGeometry} material={coatDarkMaterial} position={[0, -0.16, 0]} castShadow={shadows} />
          <group ref={rightKnee} position={[0, -0.34, 0]}>
            <mesh geometry={lowerLegGeometry} material={coatDarkMaterial} position={[0, -0.15, 0]} castShadow={shadows} />
            <mesh position={[0, -0.32, 0.05]} material={bootMaterial} castShadow={shadows}>
              <boxGeometry args={[0.19, 0.13, 0.31]} />
            </mesh>
          </group>
        </group>

        {/* hips / belt */}
        <mesh position={[0, 0.82, 0]} material={beltMaterial}>
          <cylinderGeometry args={[0.24, 0.25, 0.12, 10]} />
        </mesh>
        <mesh position={[0, 1.08, 0]} material={coatMaterial} castShadow={shadows}>
          <capsuleGeometry args={[0.25, 0.42, 4, 9]} />
        </mesh>
        <mesh position={[0, 1.22, 0.14]} rotation={[0.2, 0, 0]} material={coatDarkMaterial}>
          <boxGeometry args={[0.28, 0.34, 0.06]} />
        </mesh>

        {/* cloak */}
        <group ref={cloak} position={[0, 1.16, -0.16]}>
          <mesh rotation={[0.12, 0, 0]} material={coatDarkMaterial} castShadow={shadows}>
            <boxGeometry args={[0.5, 0.86, 0.05]} />
          </mesh>
          <mesh position={[0, -0.44, 0.02]} rotation={[0.08, 0, 0.04]} material={coatMaterial}>
            <boxGeometry args={[0.44, 0.28, 0.04]} />
          </mesh>
        </group>

        {/* scarf */}
        <mesh position={[0, 1.32, 0]} material={scarfMaterial}>
          <torusGeometry args={[0.18, 0.058, 6, 12]} />
        </mesh>

        {/* head, hood and face */}
        <group ref={head} position={[0, 1.44, 0]}>
          <mesh material={skinMaterial} castShadow={shadows}>
            <sphereGeometry args={[0.15, 10, 8]} />
          </mesh>
          <mesh position={[0, 0.04, -0.035]} material={coatDarkMaterial} castShadow={shadows}>
            <sphereGeometry args={[0.185, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          </mesh>
          <mesh position={[0, 0.13, -0.05]} rotation={[0.25, 0, 0]} material={coatMaterial}>
            <coneGeometry args={[0.19, 0.3, 8]} />
          </mesh>
          <mesh position={[-0.055, 0.01, 0.135]} material={eyeMaterial}>
            <sphereGeometry args={[0.018, 5, 4]} />
          </mesh>
          <mesh position={[0.055, 0.01, 0.135]} material={eyeMaterial}>
            <sphereGeometry args={[0.018, 5, 4]} />
          </mesh>
          <mesh position={[0, -0.08, 0.13]} rotation={[0.2, 0, 0]} material={scarfMaterial}>
            <boxGeometry args={[0.17, 0.08, 0.03]} />
          </mesh>
        </group>

        {/* backpack and bedroll */}
        <mesh position={[0, 1.08, -0.24]} rotation={[0.05, 0, 0]} material={beltMaterial} castShadow={shadows}>
          <boxGeometry args={[0.32, 0.38, 0.13]} />
        </mesh>
        <mesh position={[0, 1.26, -0.24]} rotation={[0, 0, Math.PI / 2]} material={scarfMaterial}>
          <cylinderGeometry args={[0.055, 0.055, 0.32, 6]} />
        </mesh>

        {/* arms with elbows */}
        <group ref={leftArm} position={[-0.3, 1.26, 0]}>
          <mesh geometry={upperArmGeometry} material={coatMaterial} position={[0, -0.14, 0]} castShadow={shadows} />
          <group ref={leftElbow} position={[0, -0.29, 0]}>
            <mesh geometry={forearmGeometry} material={coatMaterial} position={[0, -0.13, 0]} castShadow={shadows} />
            <mesh position={[0, -0.27, 0]} material={skinMaterial}>
              <sphereGeometry args={[0.07, 8, 6]} />
            </mesh>
          </group>
        </group>
        <group ref={rightArm} position={[0.3, 1.26, 0]}>
          <mesh geometry={upperArmGeometry} material={coatMaterial} position={[0, -0.14, 0]} castShadow={shadows} />
          <group ref={rightElbow} position={[0, -0.29, 0]}>
            <mesh geometry={forearmGeometry} material={coatMaterial} position={[0, -0.13, 0]} castShadow={shadows} />
            <mesh position={[0, -0.27, 0]} material={skinMaterial}>
              <sphereGeometry args={[0.07, 8, 6]} />
            </mesh>

            <group ref={toolGroup} position={[0, -0.3, 0.02]} visible={false}>
              <mesh rotation={[1.25, 0, 0]} material={woodMaterial}>
                <cylinderGeometry args={[0.025, 0.03, 0.75, 6]} />
              </mesh>
              <mesh position={[0, -0.3, 0.14]} rotation={[0, 0, 0.2]} material={stoneMaterial}>
                <boxGeometry args={[0.31, 0.14, 0.06]} />
              </mesh>
            </group>

            <group ref={torchGroup} position={[0, -0.3, 0.04]} visible={false}>
              <mesh rotation={[0.2, 0, 0]} material={woodMaterial}>
                <cylinderGeometry args={[0.022, 0.028, 0.55, 5]} />
              </mesh>
              <mesh ref={flame} position={[0, 0.32, 0]}>
                <coneGeometry args={[0.08, 0.24, 6]} />
                <meshBasicMaterial color="#FFC46B" transparent opacity={0.95} />
              </mesh>
              <pointLight ref={torchLight} position={[0, 0.36, 0]} color="#FFB25A" intensity={2} distance={10} decay={2} />
            </group>
          </group>
        </group>

        {/* shoulder strap */}
        <mesh position={[0.18, 1.24, 0.08]} rotation={[0, 0, 0.4]} material={beltMaterial}>
          <boxGeometry args={[0.05, 0.34, 0.04]} />
        </mesh>
        <mesh position={[0.34, 1.05, 0.05]} material={metalMaterial}>
          <boxGeometry args={[0.06, 0.13, 0.03]} />
        </mesh>
      </group>
    </group>
  );
}
