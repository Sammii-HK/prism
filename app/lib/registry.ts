export type ItemType = "component" | "playground";

export type Category =
  | "button"
  | "input"
  | "feedback"
  | "navigation"
  | "layout"
  | "text"
  | "disclosure"
  | "media"
  | "playground";

export type RegistryItem = {
  slug: string;
  title: string;
  /** One-line short description shown on gallery cards. */
  tagline?: string;
  /** Full description shown on detail pages. */
  description: string;
  date: string;
  tech: string[];
  tags: string[];
  type: ItemType;
  category: Category;
  featured?: boolean;
};

export const registry: RegistryItem[] = [
  // --- Components (reusable, importable) ---
  {
    slug: "async-button",
    title: "Async button",
    tagline: "A button that tells the truth about waiting.",
    description: "Button driven by a five-state machine (idle, pending, slow, success, error). It stays focusable while it works, ignores presses it cannot honour, says out loud when a request is slow, and offers a retry on failure. The demo shows the live state, the legal transitions and an event log. With reduced motion the moving progress bar becomes a still one and the colour change is instant.",
    date: "2026-10-30",
    tech: ["State Machine", "useReducer", "aria-live", "prefers-reduced-motion"],
    tags: ["button", "loading", "state", "accessibility", "reduced-motion", "keyboard"],
    type: "component",
    category: "button",
    featured: true,
  },
  {
    slug: "radial-menu",
    title: "Radial menu",
    tagline: "A menu that springs out of its trigger and still works from the keyboard.",
    description: "Items fan out on damped springs from a trigger. Built as a standard menu button: roving tabindex, arrow keys walk the ring and wrap, Home and End jump, typing jumps to a label, Escape closes and returns focus to the trigger, and the chosen item is announced through a polite live region. With reduced motion the items appear instantly in place with no spring.",
    date: "2026-10-30",
    tech: ["Spring Physics", "Roving Tabindex", "aria-live", "prefers-reduced-motion"],
    tags: ["menu", "radial", "keyboard", "spring", "accessibility", "reduced-motion"],
    type: "component",
    category: "navigation",
  },
  {
    slug: "motion-compare",
    title: "Motion compare",
    tagline: "Three ways to move one dot, each measured in your browser.",
    description: "Runs the same move three ways: a CSS transition, a linear requestAnimationFrame tween and a damped spring. Each run reads the dot's rendered position every frame and reports frames rendered, average and worst frame gap, overshoot count and settle time. Cells read 'not measured yet' until a run completes. Frame gaps come from rAF timestamps and reflect your display and page load, not the isolated cost of each approach. With reduced motion all three snap and nothing is measured.",
    date: "2026-10-30",
    tech: ["Spring Physics", "requestAnimationFrame", "CSS Transition", "prefers-reduced-motion"],
    tags: ["motion", "comparison", "measurement", "spring", "performance", "reduced-motion"],
    type: "component",
    category: "feedback",
  },
  {
    slug: "latency-adapt",
    title: "Latency adapt",
    tagline: "A region that changes what it shows to match how long the wait is.",
    description: "Content region driven by a pure reducer. A response under 150 ms renders with no skeleton flash; a longer wait shows a skeleton; past 2 s it says how many seconds have passed and offers Cancel; failure shows an inline Retry. The demo has a latency slider, an outcome toggle and a timestamped log of the state machine's events. With reduced motion the skeleton is still and nothing fades.",
    date: "2026-10-30",
    tech: ["State Machine", "useReducer", "AbortController", "aria-live", "prefers-reduced-motion"],
    tags: ["loading", "skeleton", "latency", "state", "accessibility", "reduced-motion"],
    type: "component",
    category: "feedback",
  },
  {
    slug: "token-compose",
    title: "Token compose",
    tagline: "A generative composer that can only say yes to the design system.",
    description: "A seeded composer builds small card layouts from a closed vocabulary: six spacing steps, five radii, six type sizes, three layouts and a palette sampled from pastelColour plus ink. A pure validateComposition() rejects any value outside those sets, naming the path and the rule. The demo generates 6 to 1000 compositions, runs the validator over every value and reports how many fall outside the system, and an inject button swaps in an off-token value to show it being rejected. The validator checks set membership only; it does not judge taste or contrast.",
    date: "2026-11-02",
    tech: ["Seeded PRNG", "Validation", "pastelColour", "Design Tokens"],
    tags: ["tokens", "generative", "validation", "design-system", "determinism"],
    type: "component",
    category: "layout",
  },
  {
    slug: "focus-trail",
    title: "Focus trail",
    tagline: "A modal dialog whose every focus move is logged where you can see it.",
    description: "A real role=dialog with aria-modal, a Tab and Shift+Tab focus trap, Escape to close and focus returned to the invoker, next to a live log of every focus move by element label with timestamps, including trap wraps and the return. The entrance animation is skipped with reduced motion. Aria-modal is set but the rest of the page is not made inert, and it has not been tried with a screen reader.",
    date: "2026-11-02",
    tech: ["Focus Management", "ARIA", "Dialog", "prefers-reduced-motion"],
    tags: ["focus", "dialog", "modal", "keyboard", "accessibility", "reduced-motion"],
    type: "component",
    category: "disclosure",
  },
  {
    slug: "animated-border",
    title: "Animated border",
    tagline: "Rotating conic gradient border with cursor-tinted palette.",
    description: "Card with a rotating conic gradient border. Colours shift based on cursor position via pastelColour — every spot on screen produces a unique palette.",
    date: "2026-03-10",
    tech: ["Spring Physics", "Conic Gradient", "requestAnimationFrame"],
    tags: ["border", "gradient", "conic", "card", "cursor"],
    type: "component",
    category: "layout",
  },
  {
    slug: "spotlight-card",
    title: "Spotlight card",
    tagline: "Cursor-reactive pastel border glow.",
    description: "Card with a cursor-reactive pastel border glow. Border colour shifts based on where the cursor sits within the card.",
    date: "2026-03-06",
    tech: ["CSS Border", "Pointer Events", "requestAnimationFrame"],
    tags: ["card", "spotlight", "border", "glow"],
    type: "component",
    category: "layout",
  },
  {
    slug: "glow-checkbox",
    title: "Glow checkbox",
    tagline: "Spring-overshoot checkmark with pastel bloom.",
    description: "Checkbox with a spring-physics checkmark that overshoots on toggle. Border glows with cursor-mapped pastel colour on proximity. Box fills with pastel when checked, with a subtle outer bloom.",
    date: "2026-03-15",
    tech: ["Spring Physics", "requestAnimationFrame", "pastelColour"],
    tags: ["checkbox", "form", "spring", "glow", "cursor"],
    type: "component",
    category: "input",
  },
  {
    slug: "glow-select",
    title: "Glow select",
    tagline: "Floating-label dropdown with spring chevron.",
    description: "Dropdown select with a floating label that springs on selection and a cursor-mapped pastel border glow. Dropdown springs in with opacity and translateY. Chevron rotates with spring physics.",
    date: "2026-03-15",
    tech: ["Spring Physics", "requestAnimationFrame", "pastelColour"],
    tags: ["select", "dropdown", "form", "floating-label", "glow", "spring", "cursor"],
    type: "component",
    category: "input",
    featured: true,
  },
  {
    slug: "glow-input",
    title: "Glow input",
    tagline: "Floating label + pastel border glow as one light system.",
    description: "Text input with a floating label that springs on focus and a cursor-mapped pastel border glow. Label and border share the same colour source — they feel like one light system.",
    date: "2026-03-10",
    tech: ["Spring Physics", "requestAnimationFrame", "pastelColour"],
    tags: ["input", "form", "floating-label", "glow", "spring", "cursor"],
    type: "component",
    category: "input",
  },
  {
    slug: "glow-textarea",
    title: "Glow textarea",
    tagline: "Multiline input sharing the glow-input light system.",
    description: "Multiline textarea with a floating label that springs on focus and a cursor-mapped pastel border glow. Same light system as glow-input — resizable, with spring physics on every interaction.",
    date: "2026-03-15",
    tech: ["Spring Physics", "requestAnimationFrame", "pastelColour"],
    tags: ["textarea", "form", "floating-label", "glow", "spring", "cursor", "multiline"],
    type: "component",
    category: "input",
  },
  {
    slug: "floating-dock",
    title: "Floating dock",
    tagline: "macOS-style dock with proximity scaling and glow.",
    description: "macOS-style dock with proximity-based scaling and spring physics. Icons lift and glow with position-mapped pastel colour as your cursor approaches.",
    date: "2026-03-10",
    tech: ["Spring Physics", "Proximity Detection", "pastelColour"],
    tags: ["dock", "navigation", "spring", "proximity", "glow"],
    type: "component",
    category: "navigation",
    featured: true,
  },
  {
    slug: "morph-tabs",
    title: "Morph tabs",
    tagline: "Active pill springs and morphs between tabs.",
    description: "Tab bar where the active indicator springs between tabs. Indicator pill morphs position and width with spring overshoot, coloured by cursor position via pastelColour.",
    date: "2026-03-15",
    tech: ["Spring Physics", "requestAnimationFrame", "pastelColour"],
    tags: ["tabs", "navigation", "spring", "indicator", "morph", "cursor"],
    type: "component",
    category: "navigation",
    featured: true,
  },
  {
    slug: "hover-reveal",
    title: "Hover reveal",
    tagline: "Disclosure that springs in on hover with pastel edge.",
    description: "Content that smoothly reveals on hover with spring physics. Revealed section springs in with opacity, height, and translateY all driven by a damped spring. Pastel border line shifts colour with cursor position.",
    date: "2026-03-15",
    tech: ["Spring Physics", "requestAnimationFrame", "pastelColour"],
    tags: ["hover", "reveal", "spring", "disclosure", "cursor"],
    type: "component",
    category: "disclosure",
  },
  {
    slug: "glow-badge",
    title: "Glow badge",
    tagline: "Pill badge with breathing pulse and pastel edge.",
    description: "Small pill badge with an organic breathing pulse and cursor-mapped pastel glow border. Variants for success, warning, and error override the colour while keeping the same physics.",
    date: "2026-03-15",
    tech: ["requestAnimationFrame", "Sine Wave", "pastelColour"],
    tags: ["badge", "pill", "pulse", "glow", "cursor", "status"],
    type: "component",
    category: "feedback",
  },
  {
    slug: "pulse-dot",
    title: "Pulse dot",
    tagline: "Notification dot with a breathing expansion ring.",
    description: "Notification dot with an organic breathing pulse ring that expands and fades on a sine wave. Colour follows cursor position unless a fixed colour is provided.",
    date: "2026-03-15",
    tech: ["requestAnimationFrame", "Sine Easing", "pastelColour"],
    tags: ["dot", "notification", "pulse", "cursor", "status"],
    type: "component",
    category: "feedback",
  },
  {
    slug: "spring-toggle",
    title: "Spring toggle",
    tagline: "Switch with spring thumb overshoot and pastel fill.",
    description: "Toggle switch with spring-physics overshoot on the thumb. Track fills with cursor-mapped pastel colour when on. Border glow reacts to cursor proximity.",
    date: "2026-03-15",
    tech: ["Spring Physics", "requestAnimationFrame", "pastelColour"],
    tags: ["toggle", "switch", "spring", "form", "cursor"],
    type: "component",
    category: "input",
  },
  {
    slug: "glow-slider",
    title: "Glow slider",
    tagline: "Range slider with spring bounce and drag bloom.",
    description: "Range slider with spring-physics thumb bounce on grab and release. Fill and border glow with cursor-mapped pastel colour. Drag intensifies the bloom. All motion via rAF springs, no CSS transitions.",
    date: "2026-03-15",
    tech: ["Spring Physics", "requestAnimationFrame", "pastelColour"],
    tags: ["slider", "range", "form", "spring", "glow", "cursor", "drag"],
    type: "component",
    category: "input",
  },
  {
    slug: "avatar",
    title: "Avatar",
    tagline: "Image or initials with proximity-aware pastel ring.",
    description: "Circular avatar with image or fallback initials. Pastel ring glow reacts to cursor proximity, shifting colour with pointer position via pastelColour. All glow via refs and rAF.",
    date: "2026-03-15",
    tech: ["requestAnimationFrame", "Proximity Detection", "pastelColour"],
    tags: ["avatar", "image", "initials", "glow", "cursor", "proximity"],
    type: "component",
    category: "media",
  },
  {
    slug: "progress-bar",
    title: "Progress bar",
    tagline: "Spring-filled bar with travelling shimmer highlight.",
    description: "Track and fill bar with spring-animated width, travelling shimmer highlight, and cursor-proximity pastel glow on the track border. Fill colour shifts with cursor position via pastelColour.",
    date: "2026-03-15",
    tech: ["Spring Physics", "requestAnimationFrame", "pastelColour"],
    tags: ["progress", "bar", "spring", "shimmer", "cursor", "loading"],
    type: "component",
    category: "feedback",
  },
  {
    slug: "skeleton",
    title: "Skeleton",
    tagline: "Loading placeholder with cursor-tinted shimmer.",
    description: "Placeholder loading shape with a cursor-tinted travelling shimmer. A bright band sweeps across on a rAF loop with a hint of pastelColour mapped to cursor position.",
    date: "2026-03-15",
    tech: ["requestAnimationFrame", "Linear Gradient", "pastelColour"],
    tags: ["skeleton", "loading", "placeholder", "shimmer", "cursor"],
    type: "component",
    category: "feedback",
  },
  {
    slug: "icon-button",
    title: "Icon button",
    tagline: "Compact icon button with a click ripple and pastel glow.",
    description: "Compact square button for icons. A pastel ripple spreads from where you click (or from the centre for Enter and Space), and the border glows with cursor-mapped colour on hover and keyboard focus. It never moves.",
    date: "2026-03-15",
    tech: ["Ripple", "requestAnimationFrame", "pastelColour"],
    tags: ["button", "icon", "ripple", "glow", "cursor"],
    type: "component",
    category: "button",
  },
  {
    slug: "tooltip",
    title: "Tooltip",
    tagline: "A tooltip that stays next to what it describes.",
    description: "Anchored tooltip that sits centred on its trigger. It appears after a short hover or straight away on keyboard focus, closes on Escape, and is linked with aria-describedby. The border takes the Prism colour of where the trigger sits on the page.",
    date: "2026-11-17",
    tech: ["aria-describedby", "Focus Visible", "pastelColour"],
    tags: ["tooltip", "hint", "label", "accessibility"],
    type: "component",
    category: "feedback",
  },
  {
    slug: "ripple-button",
    title: "Ripple button",
    tagline: "Click-origin pastel ripple tinted by cursor position.",
    description: "Click-origin pastel ripple with cursor-mapped colour and spring physics. Every tap is uniquely tinted by where the pointer lives in the viewport.",
    date: "2026-03-06",
    tech: ["Spring Physics", "requestAnimationFrame", "cursorColour"],
    tags: ["button", "ripple", "spring", "interaction", "click"],
    type: "component",
    category: "button",
    featured: true,
  },
  {
    slug: "command-palette",
    title: "Command palette",
    tagline: "⌘K launcher with fuzzy search, sub-palettes, and a morphing pill highlight.",
    description: "⌘K launcher with fuzzy search, grouped results, sub-palettes, and a morphing highlight pill. Zero external deps — rAF spring entrance, cursor-mapped pastel indicator, colourField scrim behind backdrop blur.",
    date: "2026-04-24",
    tech: ["Spring Physics", "requestAnimationFrame", "Fuzzy Match", "Portal", "pastelColour"],
    tags: ["command", "palette", "search", "launcher", "keyboard", "spring", "cursor", "a11y"],
    type: "component",
    category: "navigation",
    featured: true,
  },

  {
    slug: "lab",
    title: "Interaction lab",
    tagline: "Six interaction experiments on one page, each with its keyboard path and live evidence.",
    description: "A single long page that asks whether interfaces can become expressive without sacrificing usability. It hosts the async button, radial menu, motion compare, latency adapt, token compose and focus trail experiments inline, each with why it exists, keyboard and accessibility notes, and an evidence block read from your own browser. A page-level switch forces every experiment into its reduced-motion mode at once. Numbers say 'not measured yet' until something has run.",
    date: "2026-10-30",
    tech: ["State Machine", "Spring Physics", "aria-live", "prefers-reduced-motion"],
    tags: ["lab", "motion", "accessibility", "keyboard", "reduced-motion", "measurement"],
    type: "playground",
    category: "playground",
  },
];

export const components = registry.filter((r) => r.type === "component");
export const playground = registry.filter((r) => r.type === "playground");
export const featured = registry.filter((r) => r.featured);

/** Every distinct component category (excludes playground). */
export const componentCategories: Category[] = Array.from(
  new Set(components.map((c) => c.category))
);
