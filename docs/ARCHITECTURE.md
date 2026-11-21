# Architecture

AFTERLIGHT keeps three concerns deliberately separate:

1. **Simulation** — pure TypeScript, no React, no Three.js. Owns time, needs, inventory,
   crafting, building, quests, threat AI and save state.
2. **Rendering** — Three.js driven by `@react-three/fiber` inside `expo-gl`. Reads the
   simulation each frame; owns nothing durable.
3. **Interface** — React Native screens, HUD and panels. Receives small snapshots at ~8 Hz,
   never per-frame transforms.

This lets the entire game loop be unit-tested in Node, and stops a 60 FPS scene from thrashing
the React tree.

---

## Frame flow

```
Touch handlers ──▶ src/game/runtime/input.ts        (plain mutable object, no re-render)
                         │
R3F useFrame ──▶ GameEngine.tick(dt, input) ──▶ simulation state
                         │                         │
                         │                         ├──▶ events queue (toasts, sfx, haptics, quest)
                         │                         └──▶ snapshot()
                         ▼
             Three.js scene reads player/threat/node/structure state directly
                         │
GameScreen interval (130 ms) ──▶ session.sync() ──▶ Zustand snapshot ──▶ HUD/panels
```

- `dt` is clamped to 80 ms. Backgrounding the app pauses the loop, so needs never drain in one
  huge jump.
- When any panel is open the loop calls `tick(0)`, which freezes time and needs while still
  recomputing the interaction target and camera yaw.
- The canvas stays mounted for the whole game session; menus are overlays, never scene rebuilds.

---

## Simulation state

`GameSave` (in `src/game/types.ts`) is the only durable state and contains no class instances.
It stores:

- absolute game minutes, player transform, needs, XP and skills
- inventory and storage as fixed slot arrays
- harvested-node charges and respawn timestamps keyed by stable node id
- structure instances (`defId` + transform + production timers), never meshes
- quest objective counters keyed `${stepId}:${objectiveId}`
- discoveries, story entries, flags, tutorial state, statistics
- the crafting queue with absolute end times

`GameEngine` wraps that state with a non-serialised `runtime` object for threat position,
current interaction, gather progress, cooldowns, autosave timer and the build ghost.

### Determinism

- Terrain uses a seeded value-noise field shared by renderer, physics and the minimap.
- World layout uses a seeded PRNG and is asserted deterministic by tests.
- Harvest node ids never depend on load order.
- Threat AI uses `Math.random` intentionally (combat should not be predictable); it is never
  written to the save.

---

## Interaction contract

Every interactable resolves to one `InteractionTarget`:

| kind | Source | UI result |
| --- | --- | --- |
| `gather` | tree / rock / bush / fibre / spring / cache / crate | hold action button, progress ring, repeat |
| `campfire` / `workbench` | built structure | opens crafting |
| `storage` | built crate | opens storage transfer |
| `shelter` / `sleep` | built shelter / starter bedroll | rest confirmation |
| `collect` | production structure with pending output | collects units |
| `gate` | north gate POI | locked-route message |

Nearest target wins, gated by range, a line-of-sight check and node charges. Gathering validates
free inventory space **before** consuming a charge, so full packs never delete resources.

---

## Rendering budget

- One merged terrain mesh (116 × 116 heightfield).
- Trees, rocks, stumps, bushes, grass, ferns and pebbles are instanced.
- GLB models are parsed from embedded Base64 once and flattened into instanced geometry parts.
- One directional light; shadows only on the *Detailed* preset and only within a follow camera.
- No per-frame React updates; grass sway and flames are cheap transform animations.
- Quality presets: Battery saver (no shadows, lower density), Balanced, Detailed.

---

## Save integrity

`SaveService` + `SaveRepository`:

- SQLite key/value table, transactional writes (`INSERT … ON CONFLICT`).
- Writes are validated with the same Zod schema used on load; an invalid payload is rejected
  before touching the database.
- The previous valid main slot is rotated into `save.backup` before each write.
- Loading validates `save.main`; on failure it validates and promotes `save.backup`, and reports
  `recovered: true` so the UI can tell the player.
- Unknown future schema versions are refused rather than guessed.
- v1 migrations are idempotent and total; new fields get safe defaults.

Settings live in a separate slot so a corrupted journey never locks the player out of the menu.

---

## Localisation

`src/i18n/en.ts` is the source of truth. `es.ts` is typed as the same dictionary, so a missing or
extra key is a compile error, and a test also checks placeholder parity (`{qty}`, `{item}`).
Entity names are translated by key (`item.<id>.name`, `quest.<step>.title`), never stored as text.

---

## Audio

`tools/audio/generate-audio.mjs` synthesises every sound from oscillators and noise, then encodes
to mono MP3. The runtime uses a defensive `expo-audio` wrapper with per-sound players, separate
music/ambience/SFX buses, fades, app-background suspension and rate limiting.

---

## Extending the slice

- **New item** → add to `data/items.ts` + both dictionaries; it is save-safe because ids are stable.
- **New recipe** → `data/recipes.ts`; station and outputs are validated by the engine.
- **New structure** → definition + a procedural renderer case; placement, refund, production and
  storage slots are generic.
- **New quest step** → `data/quests.ts`; objective counters persist automatically. Add a save
  migration only if existing counters should be remapped.
- **New region** → `data/world.ts` + a layout module. Chapter 2 (Silent City) is scaffolded by the
  locked gate.
