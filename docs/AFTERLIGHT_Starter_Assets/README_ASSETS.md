# AFTERLIGHT Starter Asset Kit

Original procedural starter assets for the AFTERLIGHT mobile survival RPG.

## Contents
- `models/`: low-poly GLB examples (tree, rock, starter cabin).
- `textures/`: procedural albedo texture examples.
- `ui/icons/`: monochrome SVG inventory/navigation icons.
- `data/`: JSON examples for items, recipes, regions, and balance.
- `reference/`: editable SVG moodboard.

These are functional blockout assets for testing loading, scale, placement, and content pipelines. They are not finished commercial art. Refine or replace them consistently as production progresses.

## React Native + Three.js
Load GLB files with `GLTFLoader` in the 3D runtime. Use PNGs as material maps. Render SVG icons with a compatible SVG component or convert them to PNG/WebP. Validate JSON content with a runtime schema such as Zod.

All included files were generated for this starter kit. No third-party commercial assets are included.
