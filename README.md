# Slurry

A single-file particle physics sandbox with fluids, solids, fire, evolving cells, Meltdown, turbines, motors, wires and NAND gates.

## Run locally

No build step or package installation is required. From this directory, run:

```sh
python3 -m http.server 8000
```

Open **http://localhost:8000** in your browser. The game uses WebGPU when available and falls back to its CPU simulation. Static hosting should serve `index.html` over HTTPS for WebGPU access.

## Play

Choose materials and paint them into the world. Left/right clicking a material assigns it to that mouse button. Space pauses; `[` and `]` change brush size. The game opens to an empty world. Use **Demo** if you want a sample scene.

Select **Player** in the element menu and click to place the white box-headed character. No player spawns automatically, and only one can exist at a time. Control him with **A/D** to walk, **W** to jump or swim upward, and **S** to dive or fast-fall. **Fire, lava, Meltdown, acid and explosions kill him.** After death, select Player and click to place another. The old W material shortcut is now **K**. Movement pauses with the simulation, and releasing keys or switching away clears held movement.

Cells have nine independently combinable organelles. The original five are chemophile, predator, thermophile, radiophile and roller. Four rare organelles occupy a separate four-bit clause in the existing genome:

- **Rigid body (6%)**: a fixed ivory shell that resists predator punctures, with flexible physical flagella.
- **Jellyfish (5%)**: a pulsing violet bell with trailing particle tendrils.
- **Acid defense (4%)**: chartreuse glands spray acid droplets toward nearby predators; the carrier is immune. Acid neutralizes into water after a short lifetime.
- **Plantlike (5%)**: green moss that suppresses swimming, anchors on dry surfaces, grows roots through terrain, makes free jelly, and launches seeds that germinate on dry ground.

Mobile cells keep their organelle-specific resource targets as first choice and seek nearby jelly as second choice. Cells without specialist targets also seek jelly. This uses one additional channel in the existing shared food cache, with the same sensing range and refresh cadence. Plantlike and frozen cells stay passive.

Traits are sampled independently, so hybrids can inherit any of the 512 combinations. Plantlike takes precedence over active locomotion. Rare cells are placed as complete anatomy with one click of the Life tool; ordinary life can still be painted. Growth and sprays share a capped emission queue, and rigid shape calculations visit each colony's particles in linear time. They swim, feed, reproduce and freeze/thaw. Fire and lava immediately turn exposed non-thermophile life into jelly.

**??? (0.1% of new Life strains)** is a reserved ultra-rare genome with charcoal cytoplasm, a bright white membrane and blinking eye organelles. It admits every particle material, including armored or frozen life, ice, acid and Meltdown. Matter stays chemically active while slowly passing through its membrane; undigested nitro can still explode. Absorbed particles enlarge the same body without creating daughters, seeds or new particles. It cannot starve, freeze, mutate or die from heat, acid, predators or explosions. Gravity and collisions still apply, and the editor can erase it. Feeding uses bounded local grid queries and the existing rare-body passes, with no new GPU buffers.

All game code, shaders and interface styles are in `index.html`.

## Controller checks

With Node.js installed:

```sh
node tests/player.test.cjs
node tests/mercury.test.cjs
node tests/rare-organelles.test.cjs
node tests/jelly-navigation.test.cjs
node tests/unknown.test.cjs
```
