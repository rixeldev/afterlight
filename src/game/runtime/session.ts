import { GameEngine } from '../engine/GameEngine';

let current: GameEngine | null = null;

export function setEngine(engine: GameEngine | null): void {
  current = engine;
}

export function getEngine(): GameEngine | null {
  return current;
}

export function requireEngine(): GameEngine {
  if (!current) throw new Error('No active game session');
  return current;
}
