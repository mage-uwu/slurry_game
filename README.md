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

Cells have five independently combinable organelles: chemophile, predator, thermophile, radiophile and roller. They swim, feed, reproduce and freeze/thaw. Fire and lava immediately turn exposed non-thermophile life into jelly.

All game code, shaders and interface styles are in `index.html`.
