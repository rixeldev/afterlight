# AFTERLIGHT — Development log

Living document. Newest entries on top.

---

## 2026-11-21 — Vertical slice implemented (Chapter 1)

### Phase 0 — Feasibility and setup

| Task | Status |
| --- | --- |
| Expo SDK 58 / RN 0.88 / React 19.3 pinned in `package-lock.json` | Done |
| Expo development build, TypeScript strict, lint, tests | Done |
| Three.js 0.187 + `expo-gl` 58 + `@react-three/fiber` 9.8 native bridge | Done |
| GLB loading proven at the Metro/bundle level from embedded bytes | Done |
| GL rendering + GLB proven on a **physical** device | **Pending** — see Known issues |

The chosen bridge is `@react-three/fiber/native`, the maintained Expo-GL integration. The four
starter-kit GLBs are inlined as Base64 modules and parsed with `GLTFLoader.parse` from an
`ArrayBuffer`; the runtime never relies on `fetch('file://')` or `TextureLoader` network paths,
which are the least portable part of Three.js on React Native.

**Compatibility gate:** `npx expo export --platform android` produces a valid Hermes bundle with
the full scene graph. This proves module resolution, Metro asset handling and GLTF/Loader
inclusion. It does **not** prove frame pacing or context lifecycle; that needs hardware.

### Phase 1 — Movement prototype — Done

- Deterministic Greenhaven heightfield shared by physics, rendering and the minimap.
- Kinematic controller: walk/run/sprint, stamina, slope slowdown, wading, circle collisions,
  world boundary, camera-relative input, smooth third-person orbit with terrain clearance.
- Touch joystick, right-side camera drag, left-handed layout.
- Day/night sky shader, sun/moon arc, star field, fog palette, instanced vegetation.

### Phase 2 — Gathering & inventory — Done

- Seven node kinds incl. springs and story caches; charge-based depletion and timed respawn.
- Hold-to-gather with progress ring, tool bonuses, skill scaling, capacity pre-check.
- 24-slot inventory, stack limits, quick use, item details, equip/unequip, drop.
- 71 automated tests across inventory, needs, building, quests, saves and engine flows.

### Phase 3 — Crafting & building — Done

- Handcraft / campfire / workbench stations; timed queue (3) with cancel + refund.
- Six structures with grid snapping, quarter-turn rotation, ghost preview, colour-coded validity,
  unique constraints, obstacle checks, cost validation, 50% refunds and persistence.
- Storage crate (16 slots), water collector and crop plot passive production.

### Phase 4 — Survival & threat — Done

- Health, hunger, thirst, stamina; warning thresholds, campfire recovery bonus, slow starvation.
- Collapse is recoverable: wake at camp with partial needs, structures and items intact.
- The Hollow Stalker spawns after dark outside the safe clearing, chases, attacks, fears torches,
  and can be driven off for XP and scrap. One defeat per night.

### Phase 5 — Exploration & quests — Done

- Seven-step chapter, objective counters by stable ids, rewards, flags, scripted dusk finale.
- Three POIs plus the locked north gate; four authored story fragments (EN/ES).
- Map with fog-of-war style discovery, structures, quest marker and player heading.
- Journal timeline, character sheet, skills and journey statistics.

### Phase 6 — Reliability & polish — Mostly done

- Zod save schema, idempotent v1 migrations, SQLite atomic writes, backup rotation, recovery.
- Autosave every 60 s, on background, on chapter completion and on quit.
- Procedural audio (26 files), three buses, fades, background suspension, haptics.
- EN/ES localisation with typed key parity test; large text, reduced motion, sensitivity,
  left-handed layout and three graphics presets.
- Honest fallback UI if the GL renderer fails, with a “reduce graphics and retry” path.
- **Pending:** release-build profiling, memory-pressure test, device QA matrix, screenshots.

### Phase 7/8 — Deferred

Silent City, Frostfall, survivors/jobs, advanced combat, iOS archive. The locked gate and story
hook are in place; content is intentionally out of scope for the slice.

---

## Decisions worth remembering

- **No React state in the frame loop.** The simulation is a plain object graph; UI reads snapshots
  at ~8 Hz.
- **Entity keys, not object references.** Saves store node ids, structure defIds and transforms.
- **Art is embedded at build time.** GLBs/PNG/SVG are compiled by `tools/assets/build-assets.mjs`
  into TypeScript modules, so device builds cannot fail on asset URI differences.
- **Audio is original by construction.** No sample licences to audit; the generator is committed.
- **Fair failure.** No item or structure loss on collapse; only time and a walk home.
- **Deliberately no network.** No analytics, ads or remote config, per the build guide.
