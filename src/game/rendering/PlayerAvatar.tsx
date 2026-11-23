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

/** One set of joint angles for the damped pose blender. */
interface Pose {
  hipL: number;
  hipR: number;
  kneeL: number;
  kneeR: number;
  shL: number;
  shR: number;
  elL: number;
  elR: number;
  lean: number;
  crouch: number;
}

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
  const rotY = useRef(0);
  const pose = useRef<Pose>({
    hipL: 0, hipR: 0, kneeL: 0.06, kneeR: 0.06,
    shL: -0.06, shR: -0.06, elL: 0.2, elR: 0.2,
    lean: 0.02, crouch: 0,
  });
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
    smoothY.current += (groundY - smoothY.current) * Math.min(1, delta * 14);
    root.current.position.set(p.x, smoothY.current, p.z);

    // Turn smoothly instead of snapping: circling the stick no longer spins
    // the body frame to frame.
    const wantedFacing = p.facing + Math.PI;
    let diff = wantedFacing - rotY.current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    rotY.current += diff * Math.min(1, delta * 9);
    root.current.rotation.y = rotY.current;

    const dx = p.x - last.current.x;
    const dz = p.z - last.current.z;
    const speed = Math.min(1, Math.hypot(dx, dz) / Math.max(0.0001, delta) / 4.5);
    last.current = { x: p.x, z: p.z };
    // One stride per half-second at a walk, ~2.5 at a sprint.
    phase.current += delta * (2.4 + speed * 5.6);

    const action = engine.getActionInfo();
    const attack = engine.runtime.attackFlash;
    const swing = Math.sin(phase.current);

    // Target joint angles, then ease every joint towards them so poses blend
    // instead of teleporting between idle / walk / gather / strike.
    let t: Pose = {
      hipL: 0, hipR: 0, kneeL: 0.06, kneeR: 0.06,
      shL: -0.06, shR: -0.06, elL: 0.2, elR: 0.2,
      lean: 0.02, crouch: 0,
    };
    if (action) {
      const arc = Math.sin(Math.min(1, action.progress) * Math.PI);
      const chopping =
        action.kind === 'tree' || action.kind === 'rock' || action.kind === 'crate' || action.kind === 'cache';
      if (chopping) {
        t = {
          hipL: 0.12, hipR: -0.06, kneeL: 0.1, kneeR: 0.14,
          shL: -0.5 - arc * 0.35, shR: -0.2 - arc * 1.55,
          elL: -0.3, elR: 0.15 + arc * 0.45,
          lean: 0.1 + arc * 0.14, crouch: 0,
        };
      } else {
        t = {
          hipL: -0.3, hipR: -0.16, kneeL: 0.45, kneeR: 0.34,
          shL: -0.45 - arc * 0.3, shR: -0.55 - arc * 0.85,
          elL: -0.35, elR: 0.28 + arc * 0.4,
          lean: 0.2 + arc * 0.14, crouch: -0.1 * arc,
        };
      }
      if (cloak.current) cloak.current.rotation.x = 0.08 + arc * 0.08;
    } else if (speed > 0.02) {
      const hip = swing * 0.46 * speed;
      t = {
        hipL: hip, hipR: -hip,
        kneeL: Math.max(0, -swing) * 0.62 * speed + 0.06,
        kneeR: Math.max(0, swing) * 0.42 * speed + 0.06,
        shL: -swing * 0.44 * speed - 0.06,
        shR: swing * 0.38 * speed - 0.06 - attack * 1.2,
        elL: 0.22 + Math.max(0, -swing) * 0.18 * speed,
        elR: 0.22 + Math.max(0, swing) * 0.24 * speed + attack * 0.45,
        lean: 0.03 + speed * 0.06,
        crouch: Math.abs(Math.cos(phase.current)) * 0.024 * speed,
      };
      if (cloak.current) {
        cloak.current.rotation.x = 0.05 + speed * 0.1;
        cloak.current.rotation.z = Math.sin(phase.current * 0.5) * 0.03 * speed;
      }
    } else {
      // Idle: quiet breathing, an occasional look around.
      t.crouch = Math.sin(state.clock.elapsedTime * 1.5) * 0.008;
      t.shL = -0.06 + Math.sin(state.clock.elapsedTime * 1.5) * 0.02;
      if (head.current) {
        head.current.rotation.y += (Math.sin(state.clock.elapsedTime * 0.3) * 0.12 - head.current.rotation.y) * Math.min(1, delta * 2);
      }
      if (cloak.current) cloak.current.rotation.x += (0.05 - cloak.current.rotation.x) * Math.min(1, delta * 4);
    }

    const ease = Math.min(1, delta * (action ? 14 : 10));
    for (const key of Object.keys(pose.current) as (keyof Pose)[]) {
      pose.current[key] += (t[key] - pose.current[key]) * ease;
    }
    leftLeg.current!.rotation.x = pose.current.hipL;
    rightLeg.current!.rotation.x = pose.current.hipR;
    leftKnee.current!.rotation.x = pose.current.kneeL;
    rightKnee.current!.rotation.x = pose.current.kneeR;
    leftArm.current!.rotation.x = pose.current.shL;
    rightArm.current!.rotation.x = pose.current.shR;
    leftElbow.current!.rotation.x = pose.current.elL;
    rightElbow.current!.rotation.x = pose.current.elR;
    if (body.current) {
      body.current.rotation.x = pose.current.lean;
      body.current.position.y = pose.current.crouch;
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
