export type Experiment = {
  slug: string;
  title: string;
  description: string;
  date: string;
  tech: string[];
  tags: string[];
};

export const experiments: Experiment[] = [
  {
    slug: "colour-field",
    title: "Colour field",
    description: "Interactive gradient that shifts with your cursor. Four radial blobs drift on sine waves while colour channels respond to pointer position.",
    date: "2026-03-06",
    tech: ["Canvas", "Pointer Events", "requestAnimationFrame"],
    tags: ["colour", "cursor", "gradient"],
  },
  {
    slug: "magnetic-buttons",
    title: "Magnetic buttons",
    description: "Buttons that stretch and warp toward your cursor with spring physics. Each surface glows with position-mapped colour. Click to ripple neighbours.",
    date: "2026-03-06",
    tech: ["Spring Physics", "DOM Transforms", "Interaction Design"],
    tags: ["buttons", "spring", "magnetic", "interaction"],
  },
  {
    slug: "fluid-mesh",
    title: "Fluid mesh",
    description: "A grid of points connected by lines that deforms like fabric under your cursor. Displacement drives colour intensity. Click for shockwaves.",
    date: "2026-03-06",
    tech: ["Canvas", "Spring Physics", "Mesh Grid"],
    tags: ["mesh", "deformation", "physics"],
  },
  {
    slug: "text-dissolve",
    title: "Text dissolve",
    description: "Text rendered as particles that shatter when you hover. Fragments inherit gradient colour as they scatter, then reassemble when you move away.",
    date: "2026-03-06",
    tech: ["Canvas", "Pixel Sampling", "Particle Physics"],
    tags: ["text", "particles", "dissolve"],
  },
  {
    slug: "gravity-wells",
    title: "Gravity wells",
    description: "Click to place gravity attractors. Particles spawn from the edges and spiral into orbits. Trails coloured by velocity. Click a well to remove it.",
    date: "2026-03-06",
    tech: ["Canvas", "Newtonian Gravity", "Particle Systems"],
    tags: ["gravity", "particles", "orbits"],
  },
  {
    slug: "shader-marbling",
    title: "Shader marbling",
    description: "Real-time GLSL marble patterns where the distortion origin follows your mouse. Layered simplex noise creates organic flowing veins. Click for turbulence.",
    date: "2026-03-06",
    tech: ["WebGL", "GLSL", "Simplex Noise"],
    tags: ["shader", "marble", "noise", "webgl"],
  },
];
