"use client";
import { useRef, useEffect } from "react";
import { usePointer } from "../lib/hooks/use-pointer";
import { cursorColour } from "../lib/primitives/gradient";

/**
 * Fluid Mesh — Experiment 003
 *
 * A grid of points connected by lines that deforms like fabric under your cursor.
 * Displacement falls off with distance. Lines and nodes inherit colour from position.
 * Click to create a shockwave that ripples outward through the mesh.
 */

type Node = {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  velX: number;
  velY: number;
};

const SPACING = 40;
const INFLUENCE_RADIUS = 150;
const PUSH_STRENGTH = 50;
const SPRING = 0.04;
const DAMPING = 0.88;

export default function FluidMesh() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const colsRef = useRef(0);
  const rowsRef = useRef(0);
  const pointer = usePointer({ lerp: 0.2 });
  const pointerRef = useRef(pointer);
  useEffect(() => {
    pointerRef.current = pointer;
  }, [pointer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let w = 0;
    let h = 0;

    const buildGrid = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      w = window.innerWidth;
      h = window.innerHeight - 41;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cols = Math.ceil(w / SPACING) + 1;
      const rows = Math.ceil(h / SPACING) + 1;
      colsRef.current = cols;
      rowsRef.current = rows;

      const offsetX = (w - (cols - 1) * SPACING) / 2;
      const offsetY = (h - (rows - 1) * SPACING) / 2;

      nodesRef.current = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const bx = offsetX + c * SPACING;
          const by = offsetY + r * SPACING;
          nodesRef.current.push({
            baseX: bx, baseY: by,
            x: bx, y: by,
            velX: 0, velY: 0,
          });
        }
      }
    };

    buildGrid();
    window.addEventListener("resize", buildGrid);

    const draw = () => {
      const { clientX, clientY } = pointerRef.current;
      const mx = clientX;
      const my = clientY - 41; // offset for nav bar

      ctx.clearRect(0, 0, w, h);

      const cols = colsRef.current;
      const rows = rowsRef.current;
      const nodes = nodesRef.current;

      // Update physics
      for (const node of nodes) {
        const dx = mx - node.x;
        const dy = my - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < INFLUENCE_RADIUS && dist > 0) {
          const force = (1 - dist / INFLUENCE_RADIUS) * PUSH_STRENGTH;
          const angle = Math.atan2(dy, dx);
          node.velX -= Math.cos(angle) * force * 0.15;
          node.velY -= Math.sin(angle) * force * 0.15;
        }

        // Spring back to base
        node.velX += (node.baseX - node.x) * SPRING;
        node.velY += (node.baseY - node.y) * SPRING;
        node.velX *= DAMPING;
        node.velY *= DAMPING;
        node.x += node.velX;
        node.y += node.velY;
      }

      // Draw lines
      ctx.lineWidth = 0.5;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const node = nodes[i];
          const displacement = Math.sqrt(
            (node.x - node.baseX) ** 2 + (node.y - node.baseY) ** 2,
          );
          const intensity = Math.min(1, displacement / 30);

          const nxPc = (node.x / w) * 100;
          const nyPc = (node.y / h) * 100;
          const { r: cr, g: cg, b: cb } = cursorColour(nxPc, nyPc);
          const baseAlpha = 0.08;
          const alpha = baseAlpha + intensity * 0.35;

          // Horizontal line
          if (c < cols - 1) {
            const next = nodes[i + 1];
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(next.x, next.y);
            ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha})`;
            ctx.stroke();
          }

          // Vertical line
          if (r < rows - 1) {
            const below = nodes[i + cols];
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(below.x, below.y);
            ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha})`;
            ctx.stroke();
          }

          // Node dot
          if (intensity > 0.05) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, 1.5 + intensity * 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${intensity * 0.8})`;
            ctx.fill();
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", buildGrid);
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    const mx = e.clientX;
    const my = e.clientY - 41;

    // Shockwave: push all nodes outward from click point
    nodesRef.current = nodesRef.current.map((node) => {
      const dx = node.x - mx;
      const dy = node.y - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 300 && dist > 0) {
        const force = (1 - dist / 300) * 12;
        const angle = Math.atan2(dy, dx);
        return {
          ...node,
          velX: node.velX + Math.cos(angle) * force,
          velY: node.velY + Math.sin(angle) * force,
        };
      }
      return node;
    });
  };

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 cursor-crosshair"
      style={{ top: "41px", height: "calc(100vh - 41px)" }}
      onClick={handleClick}
    />
  );
}
