# Testing

## Automated gates

```bash
npm run typecheck   # TypeScript strict
npm test            # Jest (73 tests, 8 suites)
npm run lint        # ESLint, zero warnings
npx expo export --platform android --output-dir /tmp/afterlight-export   # Metro/Hermes bundle
```

| Suite | Covers |
| --- | --- |
| `inventory.test.ts` | stacking, overflow, atomic costs, capacity, immutability |
| `needs.test.ts` | drain rates, clamping, stamina, starvation, regen, HUD states |
| `building.test.ts` | grid snapping, plot bounds, overlap, obstacles, refunds, flat camp |
| `quests.test.ts` | objective matching, capping, rollover, full chapter order |
| `save.test.ts` | schema round-trip, corrupt/future rejection, backup rotation, recovery, settings |
| `engine.test.ts` | pause freeze, gathering, full pack, crafting, stations, building, sleep, collapse, threat, production |
| `world.test.ts` | determinism, resource coverage, camp clearing, no underwater nodes, lakes/hills |
| `i18n.test.ts` | key parity EN/ES, placeholders, interpolation, clock formatting |

## Installing on the phone

Android emulators are **not** used in this project: software GL burns the workstation and does not
represent a phone. Install the signed release APK on the connected device:

```bash
adb devices
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell am start -n dev.rixel.afterlight/.MainActivity
```

`keystore.properties` is read at Gradle time; the APK is signed with the upload key. Never commit
the keystore or the APK.

## Manual device checklist

Record: device model, OS, build type, FPS observations, crashes, battery/thermal notes.

### Cold start
- [ ] Splash → boot animation → menu under 6 s on a mid-range phone
- [ ] Continue card shows the correct chapter, level and playtime
- [ ] New journey replaces the save only after confirmation

### Movement & camera
- [ ] Joystick is thumb-reachable in landscape on a 6.1" phone and a small tablet
- [ ] Camera drag never fights the joystick or dock
- [ ] Camera does not clip through terrain on the lookout hill
- [ ] Sprint disables at low stamina and regenerates when idle
- [ ] Deep water and the world edge produce clear feedback

### Gathering & inventory
- [ ] Hold-to-gather fills the ring and repeats while held
- [ ] Moving cancels the action without consuming a node charge
- [ ] Full pack refuses the harvest and says so
- [ ] Tool equip changes gather speed and the contextual prompt
- [ ] Quick-use restores the correct need; raw water costs a little health

### Crafting & building
- [ ] Handcraft works away from camp
- [ ] Campfire/workbench recipes refuse when out of range
- [ ] Queue progress matches real time; cancel refunds inputs
- [ ] Build ghost turns red outside the plot, over water, trees and other structures
- [ ] Rotation, confirm, refund and persistence after restart
- [ ] Storage crate transfer in both directions; full storage returns items

### Survival & threat
- [ ] Needs warnings appear before critical, not during the tutorial
- [ ] Campfire slows drain and helps recovery
- [ ] Stalker only appears at night, outside camp
- [ ] Torch keeps it at range; axe drives it off and rewards scrap
- [ ] Collapse keeps structures and items; wakes at camp

### Story & UI
- [ ] Ranger camp discovery unlocks its journal entry
- [ ] Recorder pickup advances the chapter
- [ ] Chapter finale overlay, stats and journal continuity
- [ ] Every panel opens, closes and is fully reachable with one thumb
- [ ] EN/ES switch applies immediately; no clipped strings
- [ ] Large text does not overflow the HUD
- [ ] Left-handed layout mirrors controls

### Persistence
- [ ] Autosave indicator appears after ~60 s
- [ ] Kill the app, reopen, continue: position, inventory, structures, quest and story intact
- [ ] Background for 10 minutes: needs do not drain by the full wall-clock time
- [ ] Corrupt the main save (debug): backup recovery message appears
- [ ] Airplane mode from first launch: no errors, no requests

### Performance
- [ ] Detailed preset on a mid-range device: stable 30 FPS in the clearing and at the lake
- [ ] Battery saver reduces draw calls and improves frame time
- [ ] No visible GC hitching while sprinting through dense trees
- [ ] 10-minute session: thermal throttling noted, no crashes
