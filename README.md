# Monomage / Slurry

A single-file particle physics sandbox with fluids, solids, fire, evolving cells, Meltdown, turbines, motors, wires and NAND gates.

## Run locally

No build step or package installation is required. From this directory, run:

```sh
python3 -m http.server 8000
```

Open **http://localhost:8000** for the Monomage landing page, or **http://localhost:8000/slurry/** to play. The game uses WebGPU when available and falls back to its CPU simulation. Static hosting should serve the repository root over HTTPS for WebGPU access. No build command is needed: `/index.html` is the landing page and `/slurry/index.html` is the complete game. On Cloudflare, keep the existing root output directory; `/slurry/` resolves to the game automatically.

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

**??? (0.1% of new Life strains)** is a reserved ultra-rare genome with charcoal cytoplasm, a bright white membrane and blinking eye organelles. It admits every particle material, including armored or frozen life, ice, acid and Meltdown. Matter stays chemically active while slowly passing through its membrane; undigested nitro can still explode. Absorbed particles enlarge the same body without creating daughters, seeds or new particles. It cannot starve, freeze, mutate or die from heat, acid, predators or explosions. Gravity and collisions still apply, and the editor can erase it. Feeding caches each parcel’s host by stable particle ID and validates contact before reusing it; a bounded local search runs only when needed. Body statistics are reduced by GPU workgroups, and each particle’s body correction runs in parallel. The body dispatch is skipped when no ??? exists. The CPU path reuses its snapshot scan and avoids per-particle body metadata. These changes retain gradual digestion, growth, gravity and immortality.

**Spontaneous life:** jelly touching Meltdown has a very small chance (1 in 100,000 per birth roll) to become a new life particle, even with no existing cells in the world. The new genome uses the same independent trait probabilities as the Life brush. Each jelly particle gets one roll regardless of how many Meltdown particles touch it. The contact flag reuses the existing physics payload; a successful reaction converts the jelly in place before it melts, with no new particle allocation, neighbor search or simulation pass.

All game code, shaders and interface styles are in `slurry/index.html`. The landing page in `index.html` is a minimal static homepage: the Monomage Games header, a real gameplay screenshot in `assets/slurry.jpg`, and an invitation to play. It loads no game engine, scripts, fonts or third-party assets.

## Controller checks

With Node.js installed:

```sh
node tests/player.test.cjs
node tests/mercury.test.cjs
node tests/rare-organelles.test.cjs
node tests/jelly-navigation.test.cjs
node tests/unknown.test.cjs
node tests/abiogenesis.test.cjs
```

Optional native GPU regression checks, with Node.js, Python, NumPy and wgpu installed:

```sh
python3 tests/unknown-gpu.test.py
```

The GPU checks exercise partial workgroups, mixed ordinary/??? particles, positive and negative momentum at the full 128k particle capacity, and clearing the indirect body dispatch.
