# Known issues & verification gaps

Last updated: 2026-11-21.

AFTERLIGHT has not yet been certified on physical hardware. This file is the honest list of what
is proven and what is not.

## Not yet verified

1. **Physical Android device.** The signed release APK boots, enters the world, accepts input and
   saves/resumes on a Galaxy S22+ (Android 16). Frame pacing, thermal behaviour, memory pressure,
   touch latency and long sessions still need to be measured on a mid-range phone (target: stable
   30 FPS).
2. **iOS.** No macOS/Xcode in the build environment. The scene uses GLSL ES 1.0 and
   platform-neutral APIs, but an archive has not been produced.
3. **Release minification.** The first release APK crashed creating `GLView` because R8 removed a
   reflected constructor. `expo-build-properties` now injects keep rules for
   `expo.modules.gl.**` and all `View` constructors. This is verified on device and must stay in
   place for every release build.
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
