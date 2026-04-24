# Prism Component Library Plan

## The vision

A comprehensive, cursor-reactive component library where every element responds chromatically to pointer position. Colours flow and shift as the cursor moves across the viewport. No other library does this.

Minimal. Bold. Alive.

## What makes Prism different

Every component library ships static components. Even "animated" ones like Aceternity or Magic UI use fixed colours and predefined motion. Prism components are alive — they respond to where you are on the page. Move your cursor left: blues and purples. Move right: pinks and corals. Every interaction is unique because the colour depends on where you triggered it.

**The colour system is configurable.** Users pick a palette — ocean, sunset, neon, monochrome purple, whatever — and every component in the library responds through that palette. Not random rainbow. Intentional, themeable, position-mapped colour.

---

## Colour system (the core primitive)

### Current state

- `pastelColour(xPc, yPc, t)` — soft pastel RGB from cursor position
- `cursorColour(xPc, yPc)` — vivid RGB from cursor position
- `colourField(xPc, yPc, t, opacity)` — 4-blob ambient gradient background
- `colourBlend(xPc, yPc, opacity)` — 3-circle vivid blend
- `usePointer({ lerp })` — smoothed pointer tracking hook

### Future: themeable palettes

For now, ship with the full spectrum multi-colour palette — it's the signature look.

Later, add a `PrismProvider` that constrains the colour range:

```tsx
<PrismProvider palette="sunset">
  <Button>Click me</Button>
</PrismProvider>
```

Palette ideas:
- **spectrum** — full range, current behaviour (default)
- **ocean** — teals, blues, deep purples
- **sunset** — ambers, corals, warm pinks
- **neon** — electric blues, hot pinks, lime greens
- **monochrome** — single hue (configurable), varies in lightness/saturation
- **frost** — icy blues, whites, pale lavenders
- **ember** — deep reds, oranges, warm golds
- **custom** — user provides their own colour stops

Under the hood: `pastelColour` and `cursorColour` would sample from the palette's colour space instead of raw RGB. Position still drives which colour you get, but the range is constrained to the palette.

Per-component overrides:

```tsx
<Button>Default palette</Button>
<Button palette="neon">Neon button</Button>
<Button hueRange={[200, 260]}>Blues only</Button>
```

Package structure when ready for npm:

```
@prism-ui/core          — palette engine, usePointer, colour primitives
@prism-ui/components    — all components
@prism-ui/backgrounds   — background effects
@prism-ui/text          — text animation effects
```

---

## Component categories

### 1. Layout

| Component | Interaction | Status |
|-----------|------------|--------|
| Card | Border glow follows cursor, colour shifts with position | Exists (spotlight-card) |
| Bento Grid | Each cell glows independently based on cursor proximity | TODO |
| Stack | Stacked cards, drag to reorder, colour trails on movement | TODO |
| Separator | Gradient line that shifts colour with cursor | TODO |
| Aspect Ratio | Container with ambient colour field background | TODO |
| Collapsible | Expand/collapse with colour pulse on toggle | TODO |
| Resizable | Drag handle glows with position-mapped colour | TODO |
| Scroll Area | Scrollbar thumb colour tracks cursor position | TODO |
| Masonry | Cards with staggered colour-reactive borders | TODO |

### 2. Navigation

| Component | Interaction | Status |
|-----------|------------|--------|
| Floating Dock | Icons scale on proximity, glow colour shifts per position | TODO |
| Tabs | Active indicator slides with spring physics, colour-reactive underline | TODO |
| Navbar | Background blur with subtle colour field that follows cursor | TODO |
| Breadcrumb | Active crumb glows, colour shifts on hover | TODO |
| Pagination | Page numbers glow on proximity, active page pulses | TODO |
| Command (cmdk) | Search palette with colour-reactive highlight on selected item | TODO |
| Sidebar | Active item border colour tracks cursor, hover glow on items | TODO |
| Floating Navbar | Scroll-responsive nav with colour-reactive backdrop | TODO |
| Context Menu | Items highlight with position-mapped colour on hover | TODO |

### 3. Forms and input

| Component | Interaction | Status |
|-----------|------------|--------|
| Button | Magnetic pull toward cursor, glow colour shifts | Exists (magnetic-button) |
| Ripple Button | Click-origin ripple with position-mapped colour | Exists (ripple-button) |
| Input | Focus ring colour shifts with cursor position | TODO |
| Textarea | Multi-line input with colour-reactive focus border | TODO |
| Select | Dropdown with colour-reactive option highlights | TODO |
| Checkbox | Check animation with colour burst | TODO |
| Radio | Selection ring with position-mapped colour | TODO |
| Switch | Toggle track fills with cursor-mapped gradient | TODO |
| Slider | Track and thumb glow with position colour, range fill gradient | TODO |
| Toggle | Press state with colour pulse | TODO |
| Toggle Group | Active toggle glows, colour shifts across group | TODO |
| Date Picker | Selected date pulses, month grid has proximity glow | TODO |
| File Upload | Drop zone with colour-reactive border on drag | TODO |
| OTP Input | Each digit box glows sequentially with colour shift | TODO |
| Combobox | Filtered list with colour-reactive match highlights | TODO |

### 4. Feedback and overlay

| Component | Interaction | Status |
|-----------|------------|--------|
| Dialog / Modal | Backdrop with subtle colour field, content card with glow border | TODO |
| Drawer | Slide-in panel with colour-reactive edge glow | TODO |
| Toast | Notification slides in with colour accent matching trigger position | TODO |
| Alert | Static alert with palette-tinted accent border | TODO |
| Tooltip | Floating tip with colour-reactive background tint | TODO |
| Hover Card | Preview card with spotlight border on hover | TODO |
| Popover | Floating content with colour-reactive border | TODO |
| Sheet | Full-height panel with colour-reactive header glow | TODO |
| Progress | Bar fills with gradient that shifts with cursor position | TODO |
| Skeleton | Loading placeholder with colour-reactive shimmer sweep | TODO |
| Spinner | Rotating element with colour-reactive trail | TODO |
| Confetti | Burst of particles using palette colours | TODO |

### 5. Data display

| Component | Interaction | Status |
|-----------|------------|--------|
| Avatar | Ring glow colour-reactive on hover | TODO |
| Badge | Subtle colour-reactive background tint | TODO |
| Table | Row hover glow with position-mapped colour | TODO |
| Chart | Data points and lines use palette colours, hover glow | TODO |
| Counter | Spring-animated number with colour pulse on change | TODO |
| Progress Ring | Circular progress with gradient stroke from palette | TODO |
| Kbd | Keyboard shortcut badge with subtle glow | TODO |
| Timeline | Vertical line with colour gradient, nodes glow on proximity | TODO |
| Code Block | Syntax highlighting using palette colours | TODO |
| Terminal | Typing output with palette-tinted text | TODO |

### 6. Text effects

| Component | Interaction | Status |
|-----------|------------|--------|
| Gradient Text | Text fill gradient shifts with cursor position | TODO |
| Text Reveal | Characters reveal with colour cascade | TODO |
| Text Scramble | Characters scramble through palette colours before resolving | TODO |
| Typewriter | Typing animation, each character tinted by position | TODO |
| Flip Words | Words rotate with colour transition | TODO |
| Blur Text | Text blurs in/out with colour fade | TODO |
| Morphing Text | Text morphs between words with colour blend | TODO |
| Shiny Text | Shimmer sweep across text using palette gradient | TODO |
| Aurora Text | Northern lights effect behind text | TODO |

### 7. Animation and micro-interactions

| Component | Interaction | Status |
|-----------|------------|--------|
| Cursor Glow | Ambient light following cursor | Exists |
| Spotlight | Radial light that follows cursor within element | Exists (primitive) |
| Particle Burst | Click-triggered particles using palette colours | TODO |
| Animated Border | Rotating border gradient using palette | TODO |
| Beam | Animated light beam between elements | TODO |
| Marquee | Infinite scroll with colour-reactive items | TODO |
| Morphing Shape | SVG shapes morph between forms with colour shift | TODO |
| Stagger Reveal | Items reveal sequentially with colour cascade | TODO |
| Magnetic | Any element gains magnetic cursor attraction | TODO |
| Spring | Configurable spring physics wrapper | TODO |
| Gesture Cards | Swipe-to-dismiss with colour trail | TODO |
| Flip Card | 3D flip with colour shift on back face | TODO |
| Gravity | Drop and bounce with palette-coloured elements | TODO |
| Path Drawing | SVG stroke animation with palette gradient | TODO |
| Lens | Magnifying glass effect with colour enhancement | TODO |
| Scroll Parallax | Multi-layer parallax with colour depth | TODO |

### 8. Backgrounds

| Component | Interaction | Status |
|-----------|------------|--------|
| Colour Field | 4-blob cursor-reactive gradient | Exists |
| Aurora | Northern lights with cursor influence | TODO |
| Particles | Floating particles using palette colours | TODO |
| Grid | Interactive grid that deforms near cursor | TODO |
| Waves | Animated wave layers with palette gradient | TODO |
| Dots | Dot pattern with proximity colour reaction | TODO |
| Meteors | Shooting streaks using palette colours | TODO |
| Noise | Animated noise texture with colour tint | TODO |
| Silk | Flowing silk texture with palette colours | TODO |
| Ripple | Click-triggered expanding ripples | TODO |

---

## Daily drop schedule

One component per day. Build, record, post to X. Most visually striking first — the early posts need to hook people and build momentum.

### Week 1 — the bangers (stop the scroll)

| Day | Component | Why first |
|-----|-----------|-----------|
| 1 | **Floating Dock** | The "wow" moment. Proximity scale + colour glow. Everyone knows the macOS dock, nobody's seen it react with colour. |
| 2 | **Animated Border** | Simple, mesmerising loop. Rotating gradient mapped to cursor. Easy to appreciate in 3 seconds. |
| 3 | **Gradient Text** | Text that shifts colour as you move. Instantly communicates the whole concept. |
| 4 | **Particle Burst** | Click-triggered colour explosions. Pure dopamine. |
| 5 | **Morphing Shape** | SVG morphs between forms, colour shifts with position. Hypnotic. |
| 6 | **Slider** | Drag interaction + colour-filling track. Satisfying and familiar. |
| 7 | **Gesture Cards** | Swipe-to-dismiss with colour trails. Physical, tactile feel. |

### Week 2 — the essentials (elevated)

| Day | Component | Why now |
|-----|-----------|--------|
| 8 | **Tabs** | Everyone uses tabs. Sliding indicator with colour underline shows Prism elevates everyday components. |
| 9 | **Switch** | Small toggle, big impact. Colour fill on toggle is satisfying. |
| 10 | **Input** | Focus ring that shifts colour. Developers will want this immediately. |
| 11 | **Progress Ring** | Circular progress with palette gradient stroke. Clean. |
| 12 | **Checkbox + Radio** | Selection states with colour bursts. Micro-interaction heaven. |
| 13 | **Toast** | Notification slides in with colour accent from trigger position. Practical + beautiful. |
| 14 | **Tooltip** | Floating tip with reactive tint. Quick build, good content. |

### Week 3 — depth and variety

| Day | Component | Why now |
|-----|-----------|--------|
| 15 | **Command (cmdk)** | Search palette with colour-reactive highlights. Dev Twitter loves cmdk. |
| 16 | **Card** | Upgraded spotlight card with palette support. Foundation component. |
| 17 | **Dialog / Modal** | Colour field backdrop, glowing content card. |
| 18 | **Badge + Avatar** | Quick wins. Avatar ring glow, badge colour tint. Two-for-one post. |
| 19 | **Counter** | Spring-animated number with colour pulse. Satisfying loop video. |
| 20 | **Text Scramble** | Characters scramble through palette colours. Eye-catching text effect. |
| 21 | **Stagger Reveal** | Items cascade in with colour wave. Great for list/grid content. |

### Week 4 — the full picture

| Day | Component | Why now |
|-----|-----------|--------|
| 22 | **Separator** | Gradient line that reacts. Quick build, shows attention to detail. |
| 23 | **Skeleton** | Loading shimmer with colour sweep. Everyone needs loading states. |
| 24 | **Select / Dropdown** | Colour-reactive option highlights. Essential form component. |
| 25 | **Accordion** | Expand/collapse with colour pulse. |
| 26 | **Table** | Row hover glow. Data-heavy but still alive. |
| 27 | **Marquee** | Infinite scroll with colour-reactive items. Mesmerising loop. |
| 28 | **Flip Card** | 3D flip with colour shift. Physical and fun. |

### Week 5+ — backgrounds, text effects, the long tail

Continue daily with: Aurora background, Particles, Grid, Waves, Dots, Typewriter, Blur Text, Flip Words, Timeline, Drawer, Popover, Breadcrumb, Pagination, Sidebar, OTP Input, Date Picker, File Upload, etc.

### Week 5 — text effects

| Day | Component |
|-----|-----------|
| 29 | **Aurora Text** |
| 30 | **Shiny Text** |
| 31 | **Blur Text** |
| 32 | **Flip Words** |
| 33 | **Spinning Text** |
| 34 | **Line Shadow Text** |
| 35 | **Morphing Text** |

### Week 6 — more form components

| Day | Component |
|-----|-----------|
| 36 | **Textarea** |
| 37 | **Combobox** |
| 38 | **OTP Input** |
| 39 | **Date Picker** |
| 40 | **File Upload** |
| 41 | **Toggle Group** |
| 42 | **Elastic Slider** |

### Week 7 — navigation

| Day | Component |
|-----|-----------|
| 43 | **Floating Navbar** |
| 44 | **Sidebar** |
| 45 | **Breadcrumb** |
| 46 | **Pagination** |
| 47 | **Context Menu** |
| 48 | **Dropdown Menu** |
| 49 | **Menubar** |

### Week 8 — data display

| Day | Component |
|-----|-----------|
| 50 | **Timeline** |
| 51 | **Code Block** |
| 52 | **Terminal** |
| 53 | **Chart** |
| 54 | **Data Table** |
| 55 | **Kbd** |
| 56 | **File Tree** |

### Week 9 — overlays and feedback

| Day | Component |
|-----|-----------|
| 57 | **Drawer** |
| 58 | **Sheet** |
| 59 | **Popover** |
| 60 | **Hover Card** |
| 61 | **Alert** |
| 62 | **Alert Dialog** |
| 63 | **Confetti** |

### Week 10 — cards and layouts

| Day | Component |
|-----|-----------|
| 64 | **3D Card** |
| 65 | **Wobble Card** |
| 66 | **Bento Grid** |
| 67 | **Masonry** |
| 68 | **Stack** |
| 69 | **Collapsible** |
| 70 | **Resizable** |

### Week 11 — backgrounds

| Day | Component |
|-----|-----------|
| 71 | **Aurora Background** |
| 72 | **Particles** |
| 73 | **Interactive Grid** |
| 74 | **Waves** |
| 75 | **Dots** |
| 76 | **Meteors** |
| 77 | **Silk** |

### Week 12 — more micro-interactions

| Day | Component |
|-----|-----------|
| 78 | **Beam** |
| 79 | **Path Drawing** |
| 80 | **Gravity Balls** |
| 81 | **Lens** |
| 82 | **Scroll Parallax** |
| 83 | **Sticky Scroll Reveal** |
| 84 | **Spring Playground** |

### Week 13 — more backgrounds and effects

| Day | Component |
|-----|-----------|
| 85 | **Noise Background** |
| 86 | **Ripple Background** |
| 87 | **Grid Distortion** |
| 88 | **Lightning** |
| 89 | **Iridescence** |
| 90 | **Liquid Chrome** |
| 91 | **Vortex** |

### Week 14 — advanced components

| Day | Component |
|-----|-----------|
| 92 | **Kanban Board** |
| 93 | **Calendar** |
| 94 | **Carousel** |
| 95 | **Scroll Area** |
| 96 | **Aspect Ratio** |
| 97 | **Spinner** |
| 98 | **Progress Steps** |

### Week 15 — the last stretch

| Day | Component |
|-----|-----------|
| 99 | **Infinite Scroll** |
| 100 | **Drag Reorder** |
| 101 | **Notification Stack** |
| 102 | **Cursor Trail** |
| 103 | **Image Trail** |
| 104 | **Spotlight (standalone)** |
| 105 | **Tracing Beam** |

That's 105 days. 15 weeks. One component per day, every day posted to X.

---

## Technical architecture

Ship as a Next.js site first. Package and publish to npm once the library is substantial (50+ components). Keep the current structure:

```
app/lib/primitives/     — colour system, cursor glow, spotlight
app/lib/hooks/          — usePointer and future hooks
app/lib/components/     — all components (one file each)
app/demos/              — demo pages for recording
app/[slug]/             — dynamic routes
```

---

## Design principles

1. **Every component reacts to the cursor.** No static elements. Even subtle components (separator, badge) have micro-reactions.
2. **Palettes, not random colour.** The multi-colour effect is intentional and configurable. Users control the mood.
3. **Minimal and bold.** Dark backgrounds. Clean typography. The colour IS the decoration — no gradients-on-gradients, no excessive effects.
4. **Spring physics everywhere.** No CSS transitions. Everything moves with spring equations — overshoot, bounce, settle.
5. **Works without colour.** Components are fully functional with colour disabled. The reactive colour is an enhancement layer, not a dependency.
6. **Records well.** Every component should look incredible in a 10-second screen recording. If it doesn't pop on video, it's not done.

---

## Competitive gap

| Library | Components | Animated | Cursor-reactive | Colour-mapped | Themeable palette |
|---------|-----------|----------|----------------|--------------|-------------------|
| shadcn/ui | 59 | No | No | No | Yes (CSS vars) |
| Radix | 30 | No | No | No | No |
| Aceternity | 90+ | Yes | Some (spotlight) | No | No |
| Magic UI | 70+ | Yes | No | No | No |
| React Bits | 135 | Yes | Some (cursor) | No | No |
| **Prism** | **100+** | **Yes** | **Every component** | **Yes** | **Yes** |

No one has done this. Prism is the first cursor-colour-reactive component library with themeable palettes.
