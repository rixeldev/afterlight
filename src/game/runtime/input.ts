/**
 * Mutable per-frame input shared between touch handlers and the 3D runtime.
 * Deliberately outside React state: camera drags must never re-render the tree.
 */
export interface InputState {
  /** -1..1, right positive. */
  moveX: number;
  /** -1..1, forward positive. */
  moveY: number;
  sprint: boolean;
  cameraYaw: number;
  cameraPitch: number;
  cameraDistance: number;
}

export const inputState: InputState = {
  moveX: 0,
  moveY: 0,
  sprint: false,
  cameraYaw: Math.PI * 0.15,
  cameraPitch: 0.16,
  cameraDistance: 6.6,
};

const PITCH_MIN = 0.04;
const PITCH_MAX = 0.85;

export function resetInput(): void {
  inputState.moveX = 0;
  inputState.moveY = 0;
  inputState.sprint = false;
}

export function setMove(x: number, y: number): void {
  const len = Math.hypot(x, y);
  if (len > 1) {
    inputState.moveX = x / len;
    inputState.moveY = y / len;
  } else {
    inputState.moveX = x;
    inputState.moveY = y;
  }
}

export function rotateCamera(dx: number, dy: number, sensitivity: number): void {
  inputState.cameraYaw -= dx * 0.0055 * sensitivity;
  inputState.cameraPitch = Math.max(
    PITCH_MIN,
    Math.min(PITCH_MAX, inputState.cameraPitch + dy * 0.0038 * sensitivity),
  );
}

export function adjustCameraDistance(delta: number): void {
  inputState.cameraDistance = Math.max(4.6, Math.min(10.5, inputState.cameraDistance + delta));
}

export function cameraYawDirection(): { x: number; z: number } {
  return { x: -Math.sin(inputState.cameraYaw), z: -Math.cos(inputState.cameraYaw) };
}
