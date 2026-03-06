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
    tech: ["CSS Gradients", "Pointer Events", "requestAnimationFrame"],
    tags: ["colour", "cursor", "gradient"],
  },
];
