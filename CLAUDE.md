# Prism

Visual experiments by Sammii. A living gallery of interactive web experiments, built daily.

## Architecture

- **Next.js App Router** — gallery index + dynamic `[slug]` routes
- **Dark-first** — `#050505` background, white/opacity text
- **Tailwind CSS** — styling
- **No external UI libraries** — everything is hand-built

## Structure

```
app/
  page.tsx                  Gallery grid
  [slug]/
    page.tsx                Dynamic route (SSG via generateStaticParams)
    experiment-layout.tsx   Shared nav bar wrapper
  lib/
    registry.ts             Experiment metadata (add new experiments here)
    primitives/
      gradient.ts           Core colour system (colourField, colourBlend, cursorColour, pastelColour)
      cursor-glow.tsx       Lerp-smoothed cursor glow component
      spotlight-card.tsx    Cursor-reactive pastel border card
      index.ts              Barrel export
    hooks/
      use-pointer.ts        Shared pointer tracking hook with lerp smoothing
  experiments/
    colour-field.tsx        Experiment 001: interactive gradient canvas
    <slug>.tsx              Each experiment is a default-exported React component
```

## Adding a new experiment

1. Create `app/experiments/<slug>.tsx` — export default a React component
2. Add entry to `app/lib/registry.ts`
3. That's it. The dynamic route picks it up automatically.

## Visual primitives (use these in experiments)

- `colourField(xPc, yPc, time, opacity)` — 4-blob cursor-reactive CSS gradient
- `colourBlend(xPc, yPc, opacity)` — 3-circle vivid colour mix
- `cursorColour(xPc, yPc)` — single RGB from cursor position
- `pastelColour(xPc, yPc, time)` — soft pastel variant (floors at 140)
- `usePointer({ lerp })` — hook returning smoothed xPc, yPc, time, clientX, clientY
- `<CursorGlow />` — floating cursor light
- `<SpotlightCard />` — card with reactive pastel border

## Pipeline (Orbit-style)

```
pipeline/
  orchestrator.sh           Shell orchestrator
  agents/
    scout.json              Haiku + Chrome — browse X for creative coding inspiration
    curator.json            Sonnet — pick today's experiment, write build brief
    publisher.json          Haiku — post to X via Spellcast
  mcp-configs/              Agent-specific MCP configs (gitignored)
  state/                    Runtime state (gitignored)
```

Commands:
```bash
./pipeline/orchestrator.sh inspire       # Morning: scout + curator
./pipeline/orchestrator.sh record <slug> # Record experiment as mp4
./pipeline/orchestrator.sh publish       # Post to X
```

## Screen recording

```bash
npx tsx scripts/record.ts <slug> [duration_seconds]
```

Records at 1080x1080 (square, good for X/IG). Simulates organic cursor movement.
Outputs to `recordings/<slug>.mp4` (requires ffmpeg for mp4 conversion).

## Rules

- Dark background always (#050505)
- Experiments should be interactive (cursor, click, scroll, audio)
- Each experiment must look visually striking in a 12-second recording
- Use the colour primitives — that's Sammii's visual identity
- Keep experiments self-contained (one file per experiment)
- No external UI component libraries
