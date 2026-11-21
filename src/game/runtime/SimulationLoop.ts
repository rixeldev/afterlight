import { AppState } from 'react-native';
import { getEngine } from './session';
import { inputState, resetInput } from './input';
import { isSimulationPaused } from '../../state/sessionStore';

/**
 * Fixed-timestep simulation driver, independent from the render loop.
 *
 * Rendering can drop to 0.5 FPS on software GL or under thermal pressure; the
 * world clock, needs, movement, threat AI and quest progress must still advance
 * in real time. Each 50 ms tick catches up in 50 ms steps, capped at 0.5 s so a
 * suspended app never drains needs in one enormous jump.
 */
const TICK_MS = 50;
const MAX_STEP = 0.05;
const MAX_CATCHUP = 0.5;

let timer: ReturnType<typeof setInterval> | null = null;
let last = 0;
let subscription: { remove: () => void } | null = null;

function step(): void {
  const engine = getEngine();
  if (!engine) return;
  const paused = isSimulationPaused();
  const input = {
    moveX: paused ? 0 : inputState.moveX,
    moveY: paused ? 0 : inputState.moveY,
    sprint: inputState.sprint,
    cameraYaw: inputState.cameraYaw,
  };
  if (paused) {
    // Keep the camera yaw and interaction target fresh while menus are open.
    engine.tick(0, input);
    return;
  }
  let remaining = Math.min(MAX_CATCHUP, (Date.now() - last) / 1000);
  last = Date.now();
  let steps = 0;
  while (remaining > 0.0001 && steps < 10) {
    const dt = Math.min(MAX_STEP, remaining);
    engine.tick(dt, input);
    remaining -= dt;
    steps += 1;
  }
}

export function startSimulationLoop(): void {
  if (timer) return;
  last = Date.now();
  timer = setInterval(step, TICK_MS);
  subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      // Do not simulate the time spent in the background.
      last = Date.now();
    }
  });
}

export function stopSimulationLoop(): void {
  if (timer) clearInterval(timer);
  timer = null;
  subscription?.remove();
  subscription = null;
  resetInput();
}
