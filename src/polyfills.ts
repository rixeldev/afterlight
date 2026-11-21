/**
 * React Native compatibility shims that must run before any third-party module.
 *
 * Three.js still ships a deprecation shim in `three.cjs` that calls
 * `process.emitWarning(...)` at module load. React Native's `process` shim does
 * not implement it, and Metro resolves CommonJS builds for native, so importing
 * Three would otherwise throw "undefined is not a function" before React mounts.
 *
 * Keep this file dependency-free and import it first in `index.ts`.
 */

interface ProcessShim {
  emitWarning?: (warning: unknown, ...args: unknown[]) => void;
  env?: Record<string, string | undefined>;
}

const runtime = globalThis as unknown as { process?: ProcessShim; __DEV__?: boolean };

if (!runtime.process) {
  runtime.process = {};
}

const proc = runtime.process;

if (typeof proc.emitWarning !== 'function') {
  proc.emitWarning = () => {
    // Deprecation notices are not actionable inside the game runtime.
  };
}

if (!proc.env) {
  proc.env = { NODE_ENV: runtime.__DEV__ ? 'development' : 'production' };
}

export {};
