<!---
This file is a template. Fill it in from the app's Results screen — export the JSON, and
copy the numbers in. Delete this comment when you do.

Do not fill it in from a single run. One number per renderer means nothing; the comparison
is the output.
-->

# Findings

**Device:** <!-- e.g. Pixel 7a -->
**OS:** <!-- e.g. Android 15 -->
**Expo SDK:** <!-- shown on the diagnostics screen -->
**Date:** <!-- yyyy-mm-dd -->
**Build:** <!-- development build, or a commit SHA -->

<!-- If any run in this table was on an emulator, say so here. Its numbers do not transfer
     to real hardware and should not be used to draw a conclusion. -->

---

## Results

Sustained window (2 minutes), auto-orbit, seed 1, all three renderers on identical input.

| Nodes | Links | Renderer | avg fps | p50 | p95 | max | jank | sim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 500 | | Raw GL | | | | | | |
| 500 | | R3F v9 | | | | | | |
| 500 | | Skia 2D | | | | | | |
| 1,000 | | Raw GL | | | | | | |
| 1,000 | | R3F v9 | | | | | | |
| 1,000 | | Skia 2D | | | | | | |
| 2,500 | | Raw GL | | | | | | |
| 2,500 | | R3F v9 | | | | | | |
| 2,500 | | Skia 2D | | | | | | |
| 5,000 | | Raw GL | | | | | | |
| 5,000 | | R3F v9 | | | | | | |
| 5,000 | | Skia 2D | | | | | | |
| 10,000 | | Raw GL | | | | | | |
| 10,000 | | R3F v9 | | | | | | |
| 10,000 | | Skia 2D | | | | | | |
| 25,000 | | Raw GL | | | | | | |
| 25,000 | | R3F v9 | | | | | | |
| 25,000 | | Skia 2D | | | | | | |

---

## Thermal behaviour

Compare the 20-second and 2-minute runs at the same configuration. If p95 degrades sharply
between them, the device is throttling and the sustained number is the honest one.

| Nodes | Renderer | p95 (20s) | p95 (2 min) | Degradation |
| --- | --- | --- | --- | --- |
| | | | | |

---

## oklch support

<!-- From the diagnostics screen: did the two halves of each swatch match? -->

- [ ] Raw GL renders correctly
- [ ] R3F renders correctly
- [ ] Skia renders correctly

---

## Verdict

<!-- The decision this project exists to produce. Answer all three. -->

**Which renderer, and why?**

**Largest node count that holds p95 under 33ms?**

**Does Skia remain a viable fallback?**

---

## Follow-ups

<!-- Anything that blocked a measurement, or that a production implementation would need. -->
