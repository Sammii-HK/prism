// Cursor-reactive radial gradient system
// Extracted from sammii.dev portfolio — this is the core visual identity

/**
 * 4-blob ambient gradient that responds to cursor position and time.
 * Returns a CSS background value with layered radial gradients.
 */
export const colourField = (xPc: number, yPc: number, t: number = 0, opacity: number = 15) => {
  const c = (n: number) => Math.min(255, Math.floor((255 / 100) * Math.max(0, Math.min(100, n))));

  // Cursor-driven base colours
  const r1 = c(xPc + Math.sin(t * 0.41) * 20);
  const g1 = c(yPc + Math.cos(t * 0.33) * 18);
  const b1 = 255 - c(xPc);

  const r2 = 255 - c(xPc + Math.cos(t * 0.37) * 18);
  const g2 = c(yPc + Math.sin(t * 0.29) * 15);
  const b2 = c(xPc);

  const r3 = c(yPc + Math.sin(t * 0.43) * 20);
  const g3 = c(xPc + Math.cos(t * 0.31) * 16);
  const b3 = 255 - c(yPc);

  const r4 = c(100 - xPc + Math.sin(t * 0.22) * 25);
  const g4 = c(100 - yPc + Math.cos(t * 0.18) * 20);
  const b4 = c(xPc + Math.sin(t * 0.27) * 20);

  // Radial positions oscillate
  const x1 = (50 + Math.sin(t * 0.31) * 16).toFixed(1);
  const y1 = (0 + Math.abs(Math.sin(t * 0.23)) * 22).toFixed(1);
  const x2 = (8 + Math.cos(t * 0.41) * 12).toFixed(1);
  const y2 = (75 + Math.sin(t * 0.29) * 10).toFixed(1);
  const x3 = (92 + Math.sin(t * 0.37) * 12).toFixed(1);
  const y3 = (75 + Math.cos(t * 0.43) * 10).toFixed(1);
  const x4 = (50 + Math.cos(t * 0.19) * 32).toFixed(1);
  const y4 = (50 + Math.sin(t * 0.27) * 28).toFixed(1);

  const op4 = Math.round(opacity * 0.73);

  return {
    background: `
      radial-gradient(ellipse at ${x1}% ${y1}%, rgb(${r1} ${g1} ${b1} / ${opacity}%), transparent 65%),
      radial-gradient(ellipse at ${x2}% ${y2}%, rgb(${r2} ${g2} ${b2} / ${opacity}%), transparent 65%),
      radial-gradient(ellipse at ${x3}% ${y3}%, rgb(${r3} ${g3} ${b3} / ${opacity}%), transparent 65%),
      radial-gradient(ellipse at ${x4}% ${y4}%, rgb(${r4} ${g4} ${b4} / ${op4}%), transparent 55%)
    `.trim(),
  };
};

/**
 * 3-circle colour blend driven by cursor position.
 * More vivid than colourField — good for hero elements.
 */
export const colourBlend = (xPc: number, yPc: number, opacity: number = 70) => {
  const c = (n: number) => {
    const colour = Math.floor((255 / 100) * n);
    return colour < 255 ? colour : 255;
  };

  const c1 = c(xPc);
  const c2 = c(yPc);
  const c3 = 255 - c(xPc);

  return {
    background: `radial-gradient(
        circle at 50% 0,
        rgb(${c1} ${c3} ${c2} / ${opacity}%),
        rgb(${c1} ${c3} ${c2} / 0%) 70.71%
      ),
      radial-gradient(
        circle at 6.7% 75%,
        rgb(${c3} ${c2} ${c1} / ${opacity}%),
        rgb(${c3} ${c2} ${c1} / 0%) 70.71%
      ),
      radial-gradient(
        circle at 93.3% 75%,
        rgb(${c2} ${c1} ${c3} / ${opacity}%),
        rgb(${c2} ${c1} ${c3} / 0%) 70.71%
      ) lavender`,
  };
};

/**
 * Compute a single RGB colour from cursor position.
 * Same formula used by the cursor follower and logo.
 */
export const cursorColour = (xPc: number, yPc: number) => {
  const c = (n: number) => Math.min(255, Math.floor((255 / 100) * n));
  return { r: c(xPc), g: c(yPc), b: 255 - c(xPc) };
};

/**
 * Pastel variant — floors each channel at 140 so colours stay light.
 * Used by the card spotlight border system.
 */
export const pastelColour = (xPc: number, yPc: number, t: number = 0) => {
  const cv = (n: number) => 140 + Math.floor((115 / 100) * Math.max(0, Math.min(100, n)));
  const rPc = Math.max(0, Math.min(100, xPc + Math.sin(t * 1.1) * 28));
  const gPc = Math.max(0, Math.min(100, yPc + Math.cos(t * 0.7) * 22));
  const bPc = 100 - rPc;
  return { r: cv(rPc), g: cv(gPc), b: cv(bPc) };
};
