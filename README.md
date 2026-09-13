# Slurry

A single-file particle physics sandbox with fluids, solids, fire, evolving cells, Meltdown, turbines, motors, wires and NAND gates.

## Run locally

No build step or package installation is required. From this directory, run:

```sh
python3 -m http.server 8000
```

Open **http://localhost:8000** in your browser. The game uses WebGPU when available and falls back to its CPU simulation. Static hosting should serve `index.html` over HTTPS for WebGPU access.

## Play

Choose materials and paint them into the world. Left/right clicking a material assigns it to that mouse button. Space pauses; `[` and `]` change brush size. Use **Life lab** and **Power lab** for built-in scenes.

Select **Player** in the element menu and click to place the white box-headed character. No player spawns automatically, and only one can exist at a time. Control him with **A/D** to walk, **W** to jump or swim upward, and **S** to dive or fast-fall. **Fire, lava, Meltdown and explosions kill him.** After death, select Player and click to place another. The old W material shortcut is now **K**. Movement pauses with the simulation, and releasing keys or switching away clears held movement.

Cells have five independently combinable organelles: chemophile, predator, thermophile, radiophile and roller. They swim, feed, reproduce and freeze/thaw. Fire and lava immediately turn exposed non-thermophile life into jelly.

All game code, shaders and interface styles are in `index.html`.

## Controller checks

With Node.js installed:

```sh
node tests/player.test.cjs
```
