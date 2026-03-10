export type ItemType = "component" | "playground";

export type RegistryItem = {
  slug: string;
  title: string;
  description: string;
  date: string;
  tech: string[];
  tags: string[];
  type: ItemType;
};

export const registry: RegistryItem[] = [
  // --- Components (reusable, importable) ---
  {
    slug: "animated-border",
    title: "Animated border",
    description: "Card with a rotating conic gradient border. Colours shift based on cursor position via pastelColour — every spot on screen produces a unique palette.",
    date: "2026-03-10",
    tech: ["Spring Physics", "Conic Gradient", "requestAnimationFrame"],
    tags: ["border", "gradient", "conic", "card", "cursor"],
    type: "component",
  },
  {
    slug: "magnetic-button",
    title: "Magnetic button",
    description: "Button that stretches toward your cursor with spring physics. Glows with position-mapped pastel colour on proximity. Click for a satisfying bounce.",
    date: "2026-03-06",
    tech: ["Spring Physics", "DOM Transforms", "Pointer Events"],
    tags: ["button", "magnetic", "spring", "interaction"],
    type: "component",
  },
  {
    slug: "spotlight-card",
    title: "Spotlight card",
    description: "Card with a cursor-reactive pastel border glow. Border colour shifts based on where the cursor sits within the card.",
    date: "2026-03-06",
    tech: ["CSS Border", "Pointer Events", "requestAnimationFrame"],
    tags: ["card", "spotlight", "border", "glow"],
    type: "component",
  },

  {
    slug: "floating-dock",
    title: "Floating dock",
    description: "macOS-style dock with proximity-based scaling and spring physics. Icons lift and glow with position-mapped pastel colour as your cursor approaches.",
    date: "2026-03-10",
    tech: ["Spring Physics", "Proximity Detection", "pastelColour"],
    tags: ["dock", "navigation", "spring", "proximity", "glow"],
    type: "component",
  },
  {
    slug: "ripple-button",
    title: "Ripple button",
    description: "Click-origin pastel ripple with cursor-mapped colour and spring physics. Every tap is uniquely tinted by where the pointer lives in the viewport.",
    date: "2026-03-06",
    tech: ["Spring Physics", "requestAnimationFrame", "cursorColour"],
    tags: ["button", "ripple", "spring", "interaction", "click"],
    type: "component",
  },

  // --- Playground (visual experiments, not reusable components) ---
  {
    slug: "colour-field",
    title: "Colour field",
    description: "Interactive gradient that shifts with your cursor. Four radial blobs drift on sine waves while colour channels respond to pointer position.",
    date: "2026-03-06",
    tech: ["Canvas", "Pointer Events", "requestAnimationFrame"],
    tags: ["colour", "cursor", "gradient"],
    type: "playground",
  },
  {
    slug: "fluid-mesh",
    title: "Fluid mesh",
    description: "A grid of points connected by lines that deforms like fabric under your cursor. Displacement drives colour intensity. Click for shockwaves.",
    date: "2026-03-06",
    tech: ["Canvas", "Spring Physics", "Mesh Grid"],
    tags: ["mesh", "deformation", "physics"],
    type: "playground",
  },
  {
    slug: "text-dissolve",
    title: "Text dissolve",
    description: "Text rendered as particles that shatter when you hover. Fragments inherit gradient colour as they scatter, then reassemble when you move away.",
    date: "2026-03-06",
    tech: ["Canvas", "Pixel Sampling", "Particle Physics"],
    tags: ["text", "particles", "dissolve"],
    type: "playground",
  },
  {
    slug: "gravity-wells",
    title: "Gravity wells",
    description: "Click to place gravity attractors. Particles spawn from the edges and spiral into orbits. Trails coloured by velocity. Click a well to remove it.",
    date: "2026-03-06",
    tech: ["Canvas", "Newtonian Gravity", "Particle Systems"],
    tags: ["gravity", "particles", "orbits"],
    type: "playground",
  },
  {
    slug: "shader-marbling",
    title: "Shader marbling",
    description: "Real-time GLSL marble patterns where the distortion origin follows your mouse. Layered simplex noise creates organic flowing veins. Click for turbulence.",
    date: "2026-03-06",
    tech: ["WebGL", "GLSL", "Simplex Noise"],
    tags: ["shader", "marble", "noise", "webgl"],
    type: "playground",
  },
];

export const components = registry.filter((r) => r.type === "component");
export const playground = registry.filter((r) => r.type === "playground");
