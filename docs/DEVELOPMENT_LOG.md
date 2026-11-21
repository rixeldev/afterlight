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
| GL rendering + GLB proven on an Android emulator (API 37, x86_64, SwiftShader) | Done |
| GL rendering + GLB proven on a **physical** device | **Pending** — see Known issues |

The chosen bridge is `@react-three/fiber/native`, the maintained Expo-GL integration. The four
starter-kit GLBs are inlined as Base64 modules and parsed with `GLTFLoader.parse` from an
`ArrayBuffer`; the runtime never relies on `fetch('file://')` or `TextureLoader` network paths,
which are the least portable part of Three.js on React Native.

**Compatibility gate:** `npx expo export --platform android` produces a valid Hermes bundle with
the full scene graph. A debug APK was installed on an API 37 x86_64 emulator: the boot flow,
menu, new journey, 3D world, GLB models, instanced vegetation, HUD, joystick input and save/continue
all ran. That proves the integration end to end. It does **not** prove frame pacing, thermal
behaviour or context lifecycle on real hardware.

### Compatibility findings that cost real time (fixed)

1. **Two R3F stores.** Mixing `@react-three/fiber` (CJS on native) with `@react-three/fiber/native`
   (ESM) produced a canvas that rendered one frozen frame: the frame loop had no subscribers.
   Every renderer import now comes from the native entry.
2. **Three's CJS deprecation shim** calls `process.emitWarning` at import, which React Native's
   `process` shim does not implement. `src/polyfills.ts` installs it and is imported first.
3. **Expo module manifests regressed** in `expo-sqlite@58.0.18` and `expo-haptics@58.0.8`: their
   `expo-module.config.json` dropped `android.modules`, so the generated module list omitted them
   and `requireNativeModule` threw. Pinned to 58.0.10 / 58.0.4 and excluded from version checks.
4. **Render-coupled simulation** froze the clock on slow devices. Moved to a fixed 50 ms loop.
5. **Silent GL failure.** The emulator eventually could not create a GL context after a display
   resize; the app now shows a retry / reduce-graphics screen after 60 s instead of a black screen.

### Device feedback round 2 — release APK (Galaxy S22+, Android 16)

- **Release crash fixed.** The first release build died as soon as the 3D canvas was created:
  `IllegalStateException: Didn't find a correct constructor for class w21` in
  `SimpleViewManagerWrapper.createViewInstance`. R8 had renamed/removed
  `expo.modules.gl.GLView`'s reflected `(Context, AppContext)` constructor. Added ProGuard keep
  rules through `expo-build-properties`; the release APK now enters a new journey and survives.
- **Complete translation pass.** Every item, recipe, structure and station name/description was
  missing from both dictionaries. Added them plus a coverage test that scans literal `t('…')` calls
  and every dynamic content key.
- **Joystick overhaul.** Replaced the small fixed ring with a floating movement zone that appears
  under the thumb. Added a dead zone, analog speed, sub-stepped collision and axis sliding.
- **Action animation.** Chop, mine, forage and water actions now drive a real arm/torso pose, the
  avatar turns to the target, and impacts spawn wood/stone chips plus a ground ring. Camera shake
  on damage.
- **Sequential goals.** Twelve homestead goals with rewards, a permanent "next goal" row in the
  HUD and a full roadmap in the journal.
- **Visual pass.** 256 px textures with generated normal maps, textured GLB/props, scrolling water
  ripples, instanced contact shadows, shadows on the Balanced preset and a cinematic vignette.
- **Settings layout.** The custom slider was re-laid out with a measured track, a proper thumb and
  a dedicated value column; the sheet content is capped and centred.

### Device smoke test — Android emulator (historical)

Environment: Android API 37 x86_64, SwiftShader software GL, debug APK, Metro dev bundle.

**Passed**
- Cold boot → splash → menu; font loading; key art and journey card.
- New journey; 3D scene rendered with the starter GLB tree/rock/cabin, instanced vegetation,
  terrain, water plane, day palette and the survivor avatar.
- HUD vitals, compass, tracked objective, dock and action cluster at 2400×1080.
- Joystick movement advanced the walk objective to 16.3 m and the world clock to 08:11, proving
  input, fixed-step simulation and HUD sync.
- Autosave produced a valid SQLite save; process restart resumed to the menu with the same
  position, needs and quest counters. The save was extracted and validated offline.
- After the emulator's GL context stopped initialising, the new watchdog surfaced the retry /
  reduce-graphics screen instead of a black view.

**Blocked by the environment**
- The emulator eventually stopped creating any `expo-gl` context, including after an AVD wipe and
  cold boot. This is a host GPU/SwiftShader limitation, not a JS exception; the same APK rendered
  the world earlier. Physical-device QA remains mandatory.
- Panel flows beyond the HUD (pack, map, journal, crafting, building) were not exercised on this
  emulator; they are covered by unit logic and compile-time checks, not yet by device taps.

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
- 73 automated tests across inventory, needs, building, quests, saves and engine flows.

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

### Phase 8 — Release preparation (Android) — Partial

- Release AAB built locally with the gitignored upload keystore and verified with `jarsigner`.
- R8, resource shrinking and `lintVitalRelease` pass; ABIs are arm64-v8a + armeabi-v7a.
- Upload to Play Console and the iOS archive remain pending (account access / macOS).

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
