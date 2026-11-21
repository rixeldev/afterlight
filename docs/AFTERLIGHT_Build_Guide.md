# AFTERLIGHT — Complete Build Guide

**Tagline:** A world worth rebuilding.  
**Genre:** Third-person survival RPG, crafting, exploration, settlement building  
**Platforms:** Android and iOS  
**Stack:** React Native, TypeScript, Three.js  
**First milestone:** A polished, offline-first playable vertical slice.

---

## 1. Vision

AFTERLIGHT is a mobile survival RPG set in a post-collapse world reclaimed by nature. The player wakes alone in Greenhaven, gathers resources, crafts tools, builds a shelter, explores abandoned locations, uncovers the cause of the collapse, and gradually recruits survivors to create a settlement.

The long-term fantasy is transforming a vulnerable campsite into a thriving community. The game should reward curiosity, planning, exploration, and visible progress.

### Design pillars
1. A satisfying gather → craft → build → explore → return loop.
2. Visible progression in character, equipment, shelter, and settlement.
3. Hand-authored points of interest with resources, secrets, and story.
4. A persistent player-owned home base.
5. Fair retention: no punishment for taking breaks and no mandatory daily chores.
6. Responsive, accessible mobile controls.

Do not begin with an enormous seamless world, MMO features, or complex social simulation. Build a compact, high-quality semi-open world first.

---

## 2. Core Loop

1. Return to the shelter and review player needs.
2. Collect completed production and check inventory.
3. Choose a goal: craft, build, upgrade, explore, or complete a quest.
4. Prepare tools, food, water, and equipment.
5. Travel to a nearby point of interest.
6. Gather, discover, solve encounters, and manage danger.
7. Return with materials, discoveries, and experience.
8. Unlock a useful capability through crafting or construction.
9. Advance the story and open new objectives.

Target 5–20 minutes of meaningful play per session, with deeper goals for longer sessions. Avoid artificial waiting and excessive meter management.

---

## 3. First Release Scope: A Complete Vertical Slice

Build only what is needed for a satisfying first chapter:

- One controllable third-person character.
- One compact outdoor region: Greenhaven.
- One persistent shelter/build plot.
- Gathering: wood, stone, berries, fiber, and water.
- Inventory with stack limits.
- Crafting: stone axe, campfire, simple shelter pieces.
- Placement with grid snapping, rotation, validation, and removal.
- Survival needs: health, hunger, thirst, stamina.
- One simple threat introduced after the tutorial.
- Three points of interest.
- A short quest chain with a clear chapter endpoint.
- Local save/load and recovery.
- Settings, tutorial, pause, and basic accessibility.

Defer multiplayer, huge world streaming, vehicles, advanced combat, procedural story generation, ads, and purchases until the vertical slice is stable.

The first slice is complete only when a new player can start, learn, gather, craft, build, explore, complete the opening objective, save, close, and resume without losing progress.

---

## 4. Compatibility Spike — Do This First

React Native and Three.js require a verified native rendering integration. Do not assume web Three.js examples work unchanged on phones.

Before implementing gameplay, pin and verify compatible versions of:
- Expo SDK and React Native
- `expo-gl`
- `expo-three` or another maintained React Native Three.js integration
- Three.js and GLTFLoader
- Android Gradle/Kotlin toolchain
- iOS deployment target and Xcode

Create a small test app that:
1. Opens a GL rendering surface.
2. Creates the Three.js renderer.
3. Loads `stylized_tree.glb` from this asset kit.
4. Displays a controllable camera and basic lighting.
5. Handles background/foreground transitions.
6. Runs on a physical Android device.
7. Documents the iOS build and verification path.

Verify asset URIs, texture loading, shader support, context lifecycle, and frame pacing on real hardware. Pin dependencies in the lockfile. If the selected bridge is unstable, evaluate a maintained alternative before building the game on it.

---

## 5. Recommended Architecture

Keep the 3D simulation independent from React rendering. React Native owns menus, HUD, inventory panels, settings, dialogs, and navigation. The game runtime owns the Three.js scene, simulation, entities, collision queries, and game clock.

Suggested structure:

```text
src/
  app/                 # navigation, screens, providers
  game/
    runtime/           # GameRuntime, GameLoop, GameClock, GameEvents
    rendering/         # RendererHost, SceneManager, Camera, AssetLoader
    world/             # WorldManager, ChunkManager, SpawnSystem, POIs
    player/             # PlayerController, Stats, Interaction, Progression
    survival/           # Needs and survival simulation
    inventory/          # Items, inventory model and service
    crafting/           # Recipes and crafting service
    building/           # Placement, grid, structure definitions
    quests/             # Quest definitions and quest service
    combat/             # Damage and combat services
    save/               # Save service, schemas, migrations
  ui/                   # HUD, inventory, crafting, map, quests, settings
  data/                 # JSON or validated content definitions
  services/             # audio, platform, optional analytics
  tests/
```

Use TypeScript strict mode, focused modules, explicit interfaces, and data-driven definitions. Use Zustand or a similar store for application/UI state. SQLite is suitable for durable local persistence. Zod (or equivalent) should validate content and save data.

Do not store per-frame transforms in React state. Send intentional events to the UI only when meaningful values change. Avoid giant manager classes and unnecessary global mutable state.

### Game loop
Use a fixed or semi-fixed simulation timestep with capped delta time. Handle pause, app suspension, low-memory warnings, and context loss. Returning from background must not simulate an enormous delta or drain needs unexpectedly.

---

## 6. World Design and Streaming

### Greenhaven
A handcrafted starter region containing:
- Safe starting clearing.
- Lake or stream.
- Forest edges and resource clearings.
- Rocky resource area.
- Abandoned ranger camp.
- Collapsed footbridge.
- Lookout point.
- Locked route to a future region.

### Chunk strategy
- Divide the region into fixed-size chunks.
- Load chunks within a configurable radius.
- Unload distant non-persistent scenery.
- Persist harvested nodes and player-built structures separately.
- Use deterministic seeds for decorative placement.
- Never respawn a harvested node simply because its chunk unloaded.

Use instancing for repeated vegetation and props, LOD for distant objects, simple collision meshes, compressed textures, and limited real-time lights/shadows.

---

## 7. Player Controls and Camera

Use landscape orientation for the 3D world unless user testing shows portrait is better.

Controls:
- Left virtual joystick for movement.
- Right-side contextual interaction and action buttons.
- Touch drag to rotate camera.
- Optional sprint button.
- Clear pressed/disabled feedback and configurable sensitivity.

Movement:
- Walk and run.
- Stamina-limited sprint.
- Ground detection and slope handling.
- Basic collision and obstacle avoidance.
- Camera-relative movement.
- Interaction range and blocked-movement feedback.

Start with a reliable kinematic controller. Use a third-person follow camera with smooth follow, obstruction handling, pitch limits, touch rotation, and optional recentering. Test around trees, walls, narrow spaces, and the shelter.

---

## 8. Gathering and Interaction

Use a common interaction contract for trees, rocks, plants, water sources, containers, workstations, doors, and gates.

Requirements:
- Detect the nearest valid target.
- Show a clear contextual prompt.
- Prevent interaction through walls.
- Show progress for longer actions.
- Cancel cleanly when the player moves away or is interrupted.
- Validate inventory capacity before granting rewards.
- Apply cooldowns and provide animation/audio feedback.

Use generous interaction radii; do not require tapping tiny 3D objects.

---

## 9. Inventory and Crafting

Inventory requirements:
- Slots or grid.
- Stack limits.
- Item icon, name, description, and category.
- Move, split, consume, equip, and discard where applicable.
- Clear full-inventory feedback.
- Quick access to essential consumables.
- Persistent storage and validation.

Use stable item IDs, never display names, as save identifiers.

Crafting:
- Recipe list and ingredient requirements.
- Required workstation.
- Meaningful craft duration only where useful.
- Batch crafting where appropriate.
- Queue cancellation and output capacity checks.
- Unlock prerequisites.
- Clear missing-ingredient explanation.

Crafting should unlock new activities, not just bigger numbers.

---

## 10. Building and Settlement

Start with a bounded build plot and grid-snapped placement.

- Placement preview with valid/invalid state.
- Rotation in fixed increments.
- Terrain and collision checks.
- Resource validation before placement.
- Confirm/cancel controls.
- Transparent removal/refund rules.
- Save placed structures as stable instance IDs, definition IDs, transforms, levels, and state—not Three.js object references.

Starter structures:
1. Campfire
2. Storage crate
3. Simple shelter
4. Workbench
5. Water collector
6. Small crop plot

Later updates can add settlement jobs, survivors, production buildings, and expanded plots.

---

## 11. Survival and Difficulty

Track health, hunger, thirst, and stamina. Introduce needs gradually. Do not punish new players during the tutorial.

- Warn before a need becomes critical.
- Pause or reduce drain during menus and dialogue.
- Make food and water accessible early.
- Keep failure recoverable.
- Never unexpectedly delete permanent progression or the player's base.
- Tune needs to support exploration rather than constant meter babysitting.

---

## 12. Progression and Quests

Suggested skills:
- Survival: recovery and needs efficiency.
- Gathering: resource yield.
- Crafting: recipes and material efficiency.
- Combat: defense and weapon mastery.
- Exploration: navigation and discovery.

Award XP for meaningful activities; avoid making repetitive low-value grinding optimal.

### Opening quest chain
1. Wake up and assess surroundings.
2. Gather wood and stone.
3. Craft a basic tool.
4. Build a campfire and shelter.
5. Find a signal source near the ranger camp.
6. Recover a damaged recording.
7. Return and complete the first chapter.

Every quest must have a stable ID, prerequisites, objective conditions, rewards, optional objectives, localization keys, and save-safe progress. Never rely on scene object names for quest state.

---

## 13. Narrative

The mystery concerns a failed energy research project that preceded the collapse. Reveal it through recordings, notes, radio fragments, and locations.

Keep dialogue concise and skippable. Use environmental storytelling. Make the first chapter emotionally satisfying while leaving the larger mystery open. Use authored narrative content, not uncontrolled random generation.

---

## 14. UI / UX

Required screens:
- Boot/loading and main menu.
- New game/continue.
- Tutorial prompts.
- In-game HUD.
- Inventory and item details.
- Crafting.
- Building mode.
- Map and discovered locations.
- Quest journal.
- Character stats and skills.
- Pause/settings.
- Save recovery feedback.
- Chapter completion.

Principles:
- Respect safe areas and cutouts.
- Keep primary controls thumb-reachable.
- Use clear icons with labels where needed.
- Provide immediate feedback for every action.
- Confirm destructive actions.
- Avoid unnecessary modal dialogs.
- Keep HUD minimal and readable.
- Support scalable text and localization.
- Include sensitivity, audio, vibration, and quality settings.
- Teach one mechanic at a time; let players replay or skip hints.

All visible controls must work. Never ship decorative buttons that do nothing.

---

## 15. Audio and Feedback

Create an audio service for ambient forest loops, music, footsteps by surface, gathering, crafting, construction, UI, wildlife, weather, and threat cues.

Use original or properly licensed audio. Add separate music, effects, and ambience volume controls. Avoid repetitive or intrusive notifications.

---

## 16. Save System and Data Integrity

The game must be offline-first. Persist:
- Save schema version.
- Player region and position.
- Stats, progression, inventory, and equipment.
- Survival needs.
- Harvested node states.
- Built structure instances.
- Crafting queues.
- Quest progress.
- Discovered locations and story entries.
- Settings.

Use atomic/staged writes where possible, validation, backups, migrations, recovery from corrupt saves, and safe autosave checkpoints. Never silently overwrite a valid save with invalid data. Store compact state, not runtime meshes or Three.js objects.

---

## 17. Mobile Performance

Set a performance target before content production. Aim for stable 30 FPS on supported mid-range phones, with 60 FPS on capable devices only when profiling supports it.

Measure frame time, draw calls, triangles, texture memory, JS/UI thread activity, render thread activity, garbage collection, load time, battery, and thermal behavior.

Rules:
- Avoid per-frame React updates.
- Reuse temporary math objects in hot paths.
- Instance repeated meshes.
- Use frustum culling and chunk visibility.
- Limit active AI.
- Avoid excessive dynamic shadows and transparency.
- Compress textures and unload unused assets.
- Profile release builds on real devices.

---

## 18. Testing and Quality Gates

Unit-test:
- Inventory operations and stack limits.
- Recipe validation and crafting output.
- Gathering yields.
- Survival clamping and pause rules.
- Building placement validation.
- Quest completion.
- Save serialization and migrations.

Integration-test:
- Fresh start and tutorial.
- Gather, craft, build, and save.
- Force close and resume.
- Discover a point of interest.
- Complete the opening quest chain.
- Full inventory and interrupted interactions.
- Background/foreground transitions.
- Low graphics and memory pressure.

Test at least one mid-range physical Android device and one iPhone before claiming iOS readiness. Record model, OS, build type, frame-rate observations, crashes, and known issues. A successful compile is not proof of device compatibility.

---

## 19. Development Roadmap

### Phase 0 — Feasibility and setup
Inspect tooling, create repository and Expo development build, pin dependencies, and verify the Three.js bridge. Load the supplied GLB on a physical device.

**Exit gate:** The sample model renders reliably and the app resumes after backgrounding.

### Phase 1 — Movement prototype
Block out Greenhaven, add movement, camera, joystick, touch camera, collision, interaction targeting, lighting.

**Exit gate:** Movement and camera feel responsive on a phone.

### Phase 2 — Gathering and inventory
Add resource nodes, interactions, item definitions, inventory UI, and feedback.

**Exit gate:** Gather, stack, inspect, consume, and save items.

### Phase 3 — Crafting and building
Add recipes, workbench, placement preview, grid, starter structures, persistence.

**Exit gate:** A functional shelter-building loop works.

### Phase 4 — Survival and first threat
Add needs, one threat, tuned difficulty, and recoverable consequences.

**Exit gate:** Survival creates meaningful decisions without frustrating micromanagement.

### Phase 5 — Exploration and quests
Add points of interest, map, discoveries, opening story, and progression.

**Exit gate:** The first chapter is playable from fresh save to conclusion.

### Phase 6 — Reliability and polish
Add migrations, backup, autosave, animation, audio, VFX, accessibility, localization, and profiling.

**Exit gate:** Core tests pass and physical-device QA is complete.

### Phase 7 — Content expansion
Only after the vertical slice is stable, add Silent City, advanced crafting, NPC survivors, settlement jobs, and Frostfall.

### Phase 8 — Release preparation
Configure signing and app identity, verify offline behavior, run regression tests, build Android release, and create iOS archive using macOS/Xcode.

---

## 20. Starter Asset Kit

The companion ZIP contains:
- Procedural low-poly GLB examples: tree, rock, starter cabin.
- PNG albedo texture examples.
- SVG UI icons.
- JSON examples for items, recipes, regions, and balance.
- An editable SVG moodboard.

These are original blockout assets, not final production art. Verify scale, normals, materials, UVs, and loading in the selected renderer. Refine or replace assets consistently.

Use stable asset IDs, compress textures for mobile, prefer GLB for runtime models, keep collision geometry simple, document third-party licenses, and avoid loading all assets at startup.

---

## 21. Definition of Done

The first release candidate is complete only when:
- A new player can start without prior setup knowledge.
- The game runs on the selected supported physical devices.
- The player can move, gather, craft, build, explore, and complete the opening chapter.
- All UI controls work and are touch-friendly.
- Save/load survives app termination and restart.
- No known critical data-loss or progression-blocking bug remains.
- Core automated tests pass.
- Performance has been measured on physical hardware.
- Setup, build, test, and known limitations are documented.

Do not promise “zero bugs” without evidence. Maintain a known-issues log and fix all release-blocking defects.

---

## 22. Instructions for the Coding Agent

1. Inspect the repository and environment before changing files.
2. Complete the compatibility spike before gameplay.
3. Maintain `docs/DEVELOPMENT_LOG.md`.
4. Work phase by phase and respect exit gates.
5. Implement real functionality, not mock controls.
6. Run type checks, lint, unit tests, and device smoke tests regularly.
7. Preserve working features; avoid broad rewrites without evidence.
8. Do not delete unrelated user files.
9. Keep player-facing text localizable.
10. Do not add analytics, ads, purchases, or network dependencies without approval.
11. Report exact native dependency blockers and tested alternatives.
12. Keep the app runnable at the end of each phase.
13. Report completed, partial, deferred, and unverified work separately.

### Start now

Begin with Phase 0. Inspect the environment, create the application skeleton, pin compatible dependencies, and prove that a supplied GLB renders on a physical device. Only then build the movement prototype.

**Build a real, cohesive, reliable mobile survival RPG—not a visual mockup or disconnected code samples.**
