# @sammii/prism-ui

Cursor-reactive React components with spring physics and position-mapped colour. Dark-first. Zero runtime dependencies.

## Install

```bash
pnpm add @sammii/prism-ui
# peer deps
pnpm add react react-dom tailwindcss
```

## Usage

Import the whole barrel:

```tsx
import { RippleButton, GlowInput, TiltCard } from "@sammii/prism-ui";
```

Or cherry-pick per subpath (recommended — keeps bundles lean):

```tsx
import { RippleButton } from "@sammii/prism-ui/ripple-button";
import { GlowInput } from "@sammii/prism-ui/glow-input";
import { colourField, pastelColour } from "@sammii/prism-ui/gradient";
import { usePointer } from "@sammii/prism-ui/use-pointer";
```

## Tailwind

Every component ships Tailwind class strings and inline colour values — Tailwind is a peer dep.

**Tailwind v3** — register the preset so `bg-prism-bg` resolves to `#050505`:

```ts
import prismPreset from "@sammii/prism-ui/tailwind.preset";

export default {
  presets: [prismPreset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./node_modules/@sammii/prism-ui/dist/**/*.js",
  ],
};
```

**Tailwind v4** (CSS-first) — tell Tailwind to scan the package's dist so JIT picks up any utilities used inside compiled components:

```css
@import "tailwindcss";
@source "../node_modules/@sammii/prism-ui/dist";

@theme {
  --color-prism-bg: #050505;
}
```

## Components

22 client components (all ship with `"use client"` preserved): animated-border, avatar, floating-dock, fluid-tooltip, glow-badge, glow-checkbox, glow-input, glow-select, glow-slider, glow-textarea, hover-reveal, icon-button, magnetic-button, morph-tabs, progress-bar, pulse-dot, ripple-button, shimmer-text, skeleton, spotlight-card, spring-toggle, tilt-card.

Plus the core primitives (`cursor-glow`, `gradient`) and the `use-pointer` hook.
