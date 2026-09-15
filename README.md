# Monomage / Slurry

A particle physics sandbox with fluids, solids, fire, evolving cells, Meltdown, turbines, motors, wires, lights and NAND gates.

## Run locally

No build step or package installation is required. From this directory, run:

```sh
python3 -m http.server 8000
```

Open **http://localhost:8000** for the Monomage landing page, or **http://localhost:8000/slurry/** to play. The game uses WebGPU when available and falls back to its CPU simulation. Static hosting should serve the repository root over HTTPS for WebGPU access. No build command is needed: `/index.html` is the landing page and `/slurry/index.html` is the game entry point. Keep the `assets/` directory alongside it. Cloudflare deploys `worker.js` with repository-root static assets using `wrangler.jsonc`; `/slurry/` resolves to the game automatically. The `.assetsignore` file excludes server code and tests from public assets.

## Play

Choose materials and paint them into the world. Left/right clicking a material assigns it to that mouse button. Space pauses; `[` and `]` change brush size. The game opens to an empty world.

**Light:** place a light, then wire a turbine's P terminal or a gate output to either side. Both terminals are connected internally, so wire the other side to the next light to make a chain. Lights do not create or retain electrical power. Their anchored body blocks particles even when off. Powered lights glow and heat material on contact: water boils, ice/snow/jelly melt, oil ignites, powder and nitro explode, and unprotected life dies into jelly. Thermophiles tolerate the heat; frozen cells thaw. Up to 64 lights share the existing machine contact map/pass, with constant-time lookup per particle.

**Eraser:** select Eraser in the element menu and drag to delete particles, walls, wires and objects. It works while running or paused, on CPU and WebGPU.

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

The simulation and shaders are in `slurry/index.html`; shared save validation, the engine bridge, and the showcase interface are in `assets/showcase-*.js`, `assets/project-bridge.js`, and `assets/showcase.css`. The English homepage is at `/` (`index.html`), and the Japanese homepage is at `/ja/` (`ja/index.html`). The header language links work without JavaScript. Each page has its own language tag, translated description and image alt text, canonical URL, and reciprocal language links for search engines. Both play links open `/slurry/`.

The landing page is a minimal static homepage: the Monomage Games header, a real gameplay screenshot in `assets/slurry.jpg`, and an invitation to play. It loads no game engine, fonts or third-party assets. A small first-party script updates the visitor total in the bottom-right footer.

## Controller checks

With Node.js installed:

```sh
node tests/player.test.cjs
node tests/mercury.test.cjs
node tests/rare-organelles.test.cjs
node tests/jelly-navigation.test.cjs
node tests/unknown.test.cjs
node tests/abiogenesis.test.cjs
node tests/lights.test.cjs
```

Optional native GPU regression checks, with Node.js, Python, NumPy and wgpu installed:

```sh
python3 tests/unknown-gpu.test.py
python3 tests/lights-gpu.test.py
```

The GPU checks exercise partial workgroups, mixed ordinary/??? particles, positive and negative momentum at the full 128k particle capacity, and clearing the indirect body dispatch.

## Visitor counter

Both homepages show the same persistent visitor total. Direct game arrivals count too. Counting starts with the counter deployment; historical traffic is not imported. Each browser receives a random anonymous ID stored locally and in a first-party cookie. Refreshing or changing language does not add another visitor. Different devices or clearing all site storage can count again; this is an approximate browser total, not a count of identified people. No IP addresses, fingerprints or third-party analytics are stored.

`POST /api/visitors` records a browser once and returns the total; `GET` reads without incrementing. A SQLite Durable Object serializes atomic updates and retains them across deployments. Keep the existing `visitors-v1` migration and `monomage-total-v1` object name when updating the Worker. If the endpoint is unavailable, the footer displays an em dash and the site/game continues working.

For the complete local site including the counter:

```sh
npx wrangler dev
```

A plain static HTTP server still runs the game and landing pages, but cannot provide the visitor total. Deploy with `npx wrangler deploy`; the existing Cloudflare Git build can use the same configuration. The SQLite Durable Object binding is provisioned by the included migration.

Counter regression check (requires Node.js and Miniflare 4 installed):

```sh
node tests/visitors.test.cjs
```

This exercises repeat visits, concurrent increments, malformed requests, static fallback, and persistence across Worker restarts.


## Public project showcase

Use **Save project** to enter a project name and character name, and **Showcase** to browse previews sorted by newest or most liked. **Load** replaces the current world after confirmation and opens it paused. Edit the loaded world and save it under your own character name to publish a new version. The original project is always credited and never overwritten. A successful new save, including a published fork, consumes one daily slot; browsing, loading, and editing locally do not.

- Four new projects per anonymous browser profile per UTC calendar day. The server also applies a four-save daily network cap to deter cookie-reset spam. People sharing a public IP share that additional cap. This is an anonymous sandbox, not verified accounts: different browsers/devices are separate profiles, and IP rotation is not prevented.
- Profiles use random server-issued secrets in Secure, HttpOnly, SameSite cookies. Editing local storage cannot change the quota. Network keys are salted hashes; raw IP addresses are not stored. Short-lived rate-limit records expire automatically. There is no sign-in, recovery, or cross-device profile synchronization.
- Public project and character names replace common profanity/slurs with `♥♥♥`, including the explicitly requested terms, common leetspeak, spacing, punctuation, zero-width and accent obfuscations. Filtering runs on the server as well as the client. Innocent names such as Dickinson and Scunthorpe are retained. A word filter cannot identify every possible abusive spelling or drawing.
- One thumbs-up per profile per project; repeat requests are idempotent, and creators cannot like their own projects. A new anonymous profile is a separate voter. Votes can be removed.
- A save contains particle positions and momentum, material/genome words, IDs and bonds, sleep anchors, walls, wires, circuit signals, turbines, lights, NAND gates, character state/name, gravity, speed, and view. Runtime sensing/rare-body caches rebuild after load; transient explosions and random-generator state are not checkpointed. A CPU device refuses worlds above its 12,000-particle capacity without replacing the current world. WebGPU supports all 131,072 particles.
- The 16 MiB request limit is checked while streaming. The server validates the version, dimensions, finite numbers, array lengths, types, and machine limits, then generates previews from validated world data. Snapshot data is split into 250,000-character SQLite rows. Public lists do not include full snapshots, profile IDs, tokens, or network hashes.
- Save IDs make retries safe after lost responses. Quotas, insertion and votes use SQLite transactions. Public submissions persist across Worker deployments. No delete/overwrite endpoint is exposed.

`showcase-worker.js` exports the `Showcase` SQLite Durable Object. The included `SHOWCASE` binding and additive `showcase-v1` migration provision its database during the existing Cloudflare deployment; no dashboard database, API key or third-party service is needed. Preserve both existing migration tags and the `slurry-showcase-v1` object name. The original visitor counter remains separate.

Run `npm ci`, then `npm run dev` for the complete application, or `npm run deploy` to deploy. A plain static server still runs the simulation and character naming, but public saves/loads need the Worker. All showcase APIs live under `/api/showcase`: `/session`, `/projects`, `/projects/:id`, and `/projects/:id/like`. Mutations require a same-origin JSON request. General requests and writes are rate limited on the server.

Run `npm test` for format validation/moderation, CPU snapshot restoration, API concurrency/persistence/full-capacity checks, the DOM save/load/fork flow, and existing visitor/player/light regressions. The DOM test does not replace a real browser layout/WebGPU smoke test. `npx wrangler deploy --dry-run` checks the Worker bundle and bindings without publishing.
