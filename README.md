# TEN BILLION YEARS
### The life of a star, compressed into one scroll.

A single continuous WebGL scene. One particle universe of 130,000 grains that
morphs through every age of a sun-like star as you scroll:

molecular cloud → gravitational collapse → protostellar disk → **ignition** →
main sequence (with planets) → red giant (which eats them) → planetary nebula →
white dwarf → a detour past **a black hole** (the ending heavier stars get) → you.

## Run it

```
python dream-site/fable/serve.py
```

Any Python 3 works. No build step, no dependencies, fully offline. Three.js and fonts are vendored.

## Notes for the curious

- The stellar clock, chapter timeline, camera, bloom, palette and star physics
  are all driven by ~30 keyframed scroll tracks (`js/main.js`).
- Your cursor is part of the story: it is **gravity** before ignition
  (it attracts the dust) and **radiation pressure** after (it pushes).
- The ignition flash is triggered by *crossing* T = 0, so it never sticks
  if you park the scrollbar on it.
- Red giants that stay red under ACES tone mapping + bloom require running
  the photosphere a stop and a half darker than you'd think.
- The black hole is not a sprite: each pixel integrates a photon path around
  the singularity (Schwarzschild null-geodesic approximation), so the arcs
  above and below the shadow really are the disk's far side, bent into view.

Built with vanilla Three.js r160, two typefaces, and zero templates.
