# Known issues & verification gaps

Last updated: 2026-11-21.

AFTERLIGHT has not yet been certified on physical hardware. This file is the honest list of what
is proven and what is not.

## Not yet verified

1. **Physical Android device.** The Hermes bundle builds and the world/GLB pipeline is exercised
   by tests and bundling, but frame pacing, thermal behaviour, memory pressure, touch latency and
   `expo-gl` context loss must still be measured on a mid-range phone (target: stable 30 FPS).
2. **iOS.** No macOS/Xcode in the build environment. The scene uses GLSL ES 1.0 and
   platform-neutral APIs, but an archive has not been produced.
3. **Emulator smoke test.** A local API 37 emulator with SwiftShader is used as a first smoke
   test. Software GL is not representative of device performance.
4. **Full 5–20 minute playthrough on hardware.** The chapter is covered by unit/integration tests,
   not by a recorded device session.
5. **Accessibility audit.** Large text, reduced motion and left-handed layout are implemented;
   screen-reader labelling and colour-contrast measurement are partial.
6. **Low-memory / background kill recovery.** Autosave and atomic writes exist; an OS-initiated
   kill mid-write has not been forced on device.

## Known limitations (by design or scope)

- **No cloud saves or accounts.** Offline-first; data lives on the device only.
- **Combat is intentionally simple.** One threat, melee only, no ranged weapons or dodge roll.
- **No swimming.** Deep water blocks movement; the lake is a boundary and a resource.
- **One save slot.** Backup recovery exists, but no multiple journeys.
- **The north gate is a teaser.** It cannot be opened in Chapter 1.
- **World size is a compact valley** (~150 m across). No streaming or vehicles yet.
- **English and Spanish only.** The i18n layer is ready for more locales.
- **Left-handed mode mirrors HUD placement**, but some prompts still animate from the right.

## Reporting a bug

Include device model, OS version, build type (debug/release), steps to reproduce, and whether the
save survived. `docs/TESTING.md` has the checklist used for device QA.
