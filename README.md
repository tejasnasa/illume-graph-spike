# illume-graph-spike

A measurement harness for answering one question: **can a React Native app render a
force-directed dependency graph of 25,000 nodes, and which renderer should do it?**

This is a standalone spike. It exists to produce a numbers table, not a product.

---

## Why this exists

[Illume](https://github.com/tejasnasa/illume) is a codebase-onboarding tool that renders an
interactive 3D dependency graph in the browser. Porting the frontend to React Native runs into
one genuine unknown: everything else in that app is tedious-but-known work, but the graph is a
real risk.

The stack the web app uses does not transfer. `react-force-graph-3d` is DOM-coupled — it
reaches for `document`, `window`, and a 2D canvas. And the library that would replace it is in
an awkward state: React Three Fiber v10 moved React Native support into a separate package
whose own README says **"DO NOT USE YET"**, and the maintainers cite performance problems with
ExpoGL as their reason for steering native toward WebGPU:

> *"With SIGNIFICANT performance issues with ExpoGL most of us internally are pretty
> anti-React-Native."* — [pmndrs/native](https://github.com/pmndrs/native)

So rather than pick a renderer on vibes, this project measures three of them on the same data,
on real hardware, and writes down what happened.

There is a second question folded in: the web app's entire theme is authored in `oklch()`, and
React Native's colour parser has historically not supported it. The **Environment diagnostics**
screen answers that in about ten seconds.

---

## What it measures

Three things, separately, because conflating them is how you end up optimising the wrong one:

| Metric | What it tells you |
| --- | --- |
| **Simulation time** | Cost of running the force layout, measured once before rendering starts |
| **Frame rate** | Sustained rate while the camera orbits a frozen graph |
| **Frame-time percentiles** | p50 / p95 / max, plus a count of frames slower than 33ms |

Percentiles are reported alongside the average because the average hides stutter. A run
alternating between 2ms and 38ms frames has a respectable mean frame rate and looks terrible.
The [`summarise` tests](src/lib/metrics/__tests__/summarise.test.ts) include a case that
demonstrates exactly this.

---

## The three renderers

| Renderer | Approach | Why it's here |
| --- | --- | --- |
| **Raw `expo-gl` + three** | Imperative. Scene built once, `requestAnimationFrame` loop drives the camera. | Most stable path. First-party GL module, mature renderer, no reconciler in the way. |
| **R3F v9** | Declarative, `@react-three/fiber/native`. | What the web client's model maps onto most directly. Also the path the maintainers have withdrawn from. |
| **Skia 2D** | Software-projected point cloud via `@shopify/react-native-skia`. | The stability hedge. Not real 3D — depth is faked with size and opacity. |

All three receive **byte-identical input**: the same frozen positions, the same indexed links,
the same colours. A difference in the numbers is a difference in the renderer.

### A caveat about the Skia numbers

Skia projects on the JS thread and rebuilds its draw paths every frame. That is the
straightforward implementation, not the fastest one — a production version would project inside
a Reanimated worklet on the UI thread, or use Skia's `Atlas` API to draw thousands of sprites in
a single call.

**Treat Skia's result as a floor, not a ceiling.** At high node counts it will look far worse
than Skia is actually capable of.

---

## Quick start

There is no Android SDK or JDK required. The development build is produced in Expo's cloud.

### 1. Prerequisites

- Node 20+
- An [Expo account](https://expo.dev/signup) (free)
- The **Expo Go** app is *not* sufficient — see below

### 2. Build a development client

```bash
npm install
npx eas login
npx eas build --profile development --platform android
```

When the build finishes, EAS prints a URL and a QR code. Open it on your Android device and
install. This is a real APK containing `expo-gl`, Skia, and the rest — which is why it cannot be
Expo Go.

> **Why not Expo Go?** Expo Go is a pre-built sandbox containing a fixed set of Expo's native
> modules. Remote push notifications were removed from it in SDK 53, and `expo-gl` is
> unreliable there (frequent blank canvases on Android). This project needs native modules Expo
> Go does not carry, so a development build is required. Building it in the cloud means no local
> Android SDK, no JDK, and no 5GB download.

### 3. Run

```bash
npx expo start --dev-client
```

Scan the QR code with the installed development client.

---

## Using it

1. **Environment diagnostics** first. Check the four `oklch` swatches — if the two halves of
   each pair match, this RN build parses `oklch` and the web theme can be copied verbatim.
2. Pick a renderer, a node count, and a measurement window.
3. **Run benchmark.** It simulates, warms up for 3 seconds, then measures.
4. **Results → Export as JSON.** Results live in memory and are cleared when the app closes.

Run the same configuration on all three renderers before drawing conclusions. A single number
means nothing; the comparison is the output.

### Choosing a window

- **Quick (20s)** — for iterating.
- **Sustained (2 min)** — for conclusions. Phones throttle hard under sustained GPU load, and a
  device that is perfectly smooth for twenty seconds can fall apart after two minutes. The
  sustained window is the only one that catches this.

### Do not benchmark on an emulator

An emulator's GPU is the host machine's GPU through a translation layer. Its numbers do not
transfer to a phone in any useful way. Every result records `isDevice` and the results screen
marks emulator runs, so a bad run cannot quietly make it into a conclusion.

---

## Methodology

**The layout is run to completion before rendering begins, then stopped.** This isolates
simulation cost from render cost. Leaving the simulation running would mean a renderer that
draws more slowly also appears to have worse physics, because its slower frames give the
simulation less opportunity to settle.

**Graphs are synthetic and deterministic.** `d3-force-3d` is the same simulation the web client
uses underneath `react-force-graph-3d`, so the layout matches production rather than
approximating it. Graphs are generated from a seeded PRNG, so two runs of the same configuration
produce byte-identical input.

Why synthetic rather than real: the sample payloads available top out at 281 nodes, roughly two
orders of magnitude below the range that stresses a phone GPU. Benchmarks are generated at
500 / 1,000 / 2,500 / 5,000 / 10,000 / 25,000 nodes.

**The graph shape is a power law, not a uniform mesh.** A uniform random graph has no hubs, and
hubs are what make rendering expensive — they concentrate both the geometry and the link
density. The generator uses preferential attachment so the degree distribution resembles a real
repository. A test asserts the top 1% of nodes hold more than 20% of all inbound links.

**The camera auto-orbits at a fixed angular velocity.** A hand-dragged camera moves differently
every run, and a static scene can be cached. All three renderers travel the same path.

**Frame times are sampled on the JS thread** via `requestAnimationFrame`, identically for all
three. One consequence worth stating plainly: a renderer whose drawing happens entirely on the
UI thread can keep painting smoothly while the JS thread is congested. This sampler reports that
congestion, which is a real cost to responsiveness — but it is not the same thing as dropped GPU
frames. It is the right metric for comparing these three against each other.

---

## Reading the results

| Field | Meaning |
| --- | --- |
| `fpsAvg` | Frames per second across the whole window |
| `frameMsP50` | Median frame time. The "typical" experience |
| `frameMsP95` | 95th percentile frame time. Where stutter shows up |
| `frameMsMax` | Worst single frame. Shader compilation and GC pauses land here |
| `jankFrames` | Frames slower than 33ms — below 30fps |
| `simulationMs` | Time spent in the force layout, before rendering |
| `ticks` | Simulation iterations actually run |

**A rule of thumb for the decision this project exists to make:** p95 frame time under 33ms
means the graph is usable. p95 above that means it stutters visibly while you interact with it,
regardless of what the average says.

---

## Project structure

```
src/
├── app/                        expo-router screens
│   ├── index.tsx               setup: renderer, size, window
│   ├── bench.tsx               the runner (simulate → warm → measure)
│   ├── results.tsx             stored runs and JSON export
│   └── diagnostics.tsx         oklch check and device info
├── lib/
│   ├── graph/
│   │   ├── generate.ts         seeded synthetic graphs
│   │   ├── layout.ts           d3-force-3d, run to completion
│   │   └── random.ts           mulberry32 PRNG
│   └── metrics/
│       ├── summarise.ts        frame statistics (pure, tested)
│       ├── useFrameSampler.ts  rAF sampling
│       ├── device.ts           device identification
│       └── store.ts            in-memory results
├── renderers/
│   ├── ThreeGLRenderer.tsx     raw expo-gl + three
│   ├── R3FRenderer.tsx         R3F v9 native
│   ├── SkiaRenderer.tsx        Skia software projection
│   └── camera.ts               shared orbit maths (pure, tested)
└── theme.ts                    dark palette
```

---

## Development

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest, 53 tests
npm run lint        # expo lint
```

Vitest covers the pure logic — graph generation, layout, frame statistics, and projection
maths. Component and renderer tests are deliberately absent: every one of them would need a
device or a GL context, and a test that stubs those out asserts that the code *runs* rather
than that it *draws*, which is precisely the claim this project exists to measure rather than
mock.

The tests have already earned their keep. They caught three real defects during development:

- A cumulative-weight table indexed by node id but holding prefix sums in shuffled rank order,
  which made the binary search in the degree sampler invalid — and silently produced a graph
  with no hubs, defeating the point of the generator.
- A d3 link force given numeric indices while its `id` accessor returned string ids, which
  failed at runtime with `node not found`.
- A `Math.max(...spread)` over 25,000 elements, which overflows the call stack.

---

## Status and limitations

**The application code has not been run on a device.** It typechecks cleanly and its pure logic
is covered by passing tests, but no screen in this repo has been observed rendering a frame.
The first run on hardware should be treated as a debugging session, not a confirmation. The
likely friction points are the `expo-gl` canvas shim in `ThreeGLRenderer`, the R3F native canvas
props, and the Skia path updates.

Known limitations, stated rather than discovered later:

- **Skia is not optimised** (see above). Its numbers are a floor.
- **The Skia renderer loses depth ordering**, because nodes are bucketed by colour rather than
  sorted by depth — four draw calls instead of 25,000 React children.
- **No iOS verification.** Built and tested against Android only. R3F's own docs note that iOS
  simulators often have unreliable OpenGL ES support, so iOS needs a physical device.
- **Results are in-memory.** Export before closing the app.
- **No offline support** and no persistence beyond the JSON export.

---

## Licence

MIT — see [LICENSE](LICENSE).
