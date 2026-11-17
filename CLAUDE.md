# Prism

## Context Layer — READ FIRST
Read the shared context layer at `~/.claude/projects/-Users-sammii-development/memory/`. Start with `MEMORY.md` (index), then `active-work.md` (multi-agent coordination). Update these files continuously as you work.

---

Design engineering component library by Sammii. Reusable, cursor-reactive UI components with spring physics and position-mapped colour.

## Architecture

- **Next.js App Router** — gallery index + dynamic `[slug]` routes
- **Dark-first** — `#050505` background, white/opacity text
- **Tailwind CSS** — styling
- **No external UI libraries** — everything is hand-built

## Structure

```
app/
  page.tsx                  Home: hero stage, showcase, principles, featured
  [slug]/
    page.tsx                Dynamic route with explicit componentMap (Turbopack requirement)
    item-detail.tsx         Detail template: stage, usage and props read from source
  lib/
    registry.ts             Component metadata (the lab is the one non-component entry)
    components/
      <slug>.tsx            Reusable components (named exports, props interface)
      index.ts              Barrel exports
    primitives/
      gradient.ts           Core colour system (colourField, colourBlend, cursorColour, pastelColour)
      cursor-glow.tsx       Lerp-smoothed cursor glow component
      spotlight-card.tsx    Cursor-reactive pastel border card
      index.ts              Barrel export
    hooks/
      attention.ts          Shared attention point: mouse, touch and keyboard focus
      reduced-motion.ts     reducedMotionNow / motionTime / useReducedMotion
      use-pointer.ts        Shared pointer tracking hook with lerp smoothing
    shell/                  Site layout kit, nav, footer, hero stage, readout
    docs/                   Build-time docs read from component source
  demos/
    <slug>.tsx              Demo pages for components (default export)
  showcase/                 Applied demos: darkroom, console, synth
scripts/
  record.ts                Playwright screen recorder (1080x1080, organic cursor, ffmpeg)
```

Components that are fun but not usable (things that move the target, chase the cursor or loop forever) belong in the separate chaos-components repo, not here. Prism is a usable collection.

## Adding a new component

1. Write component to `app/lib/components/<slug>.tsx` (named export, props interface)
2. Write demo to `app/demos/<slug>.tsx` (default export)
3. Add export to `app/lib/components/index.ts`
4. Add entry to `app/lib/registry.ts` (type: "component")
5. Add dynamic import to `app/[slug]/page.tsx` componentMap

## Visual primitives (use these in experiments)

- `colourField(xPc, yPc, time, opacity)` — 4-blob cursor-reactive CSS gradient
- `colourBlend(xPc, yPc, opacity)` — 3-circle vivid colour mix
- `cursorColour(xPc, yPc)` — single RGB from cursor position
- `pastelColour(xPc, yPc, time)` — soft pastel variant (floors at 140)
- `usePointer({ lerp })` — hook returning smoothed xPc, yPc, time, clientX, clientY
- `<CursorGlow />` — floating cursor light
- `<SpotlightCard />` — card with reactive pastel border

## Screen recording

```bash
npx tsx scripts/record.ts <slug> [duration_seconds]
```

Records at 1080x1080 (square, good for X/IG). Simulates organic cursor movement.
Outputs to `recordings/<slug>.mp4` (requires ffmpeg for mp4 conversion).

## Design language — quiet confidence

- Dark background always (#050505), luminous pastel accents
- Cursor-reactive: RGB channels mapped to pointer position (cursorColour, pastelColour)
- Spring physics: requestAnimationFrame + spring equations, never CSS transitions
- Subtle: 2-3px of overshoot, 2-3 degrees of tilt, barely-there glows
- Smooth: lerp everything, 0.06-0.12 factors, nothing snaps
- Functional: real components with real props APIs
- One file per component, no external UI dependencies
- Must look visually striking in a 12-second screen recording
