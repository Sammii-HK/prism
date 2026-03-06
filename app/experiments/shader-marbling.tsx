"use client";
import { useRef, useEffect } from "react";
import { usePointer } from "../lib/hooks/use-pointer";

/**
 * Shader Marbling — Experiment 006
 *
 * Real-time GLSL marble patterns where the distortion origin follows your mouse.
 * Noise layers fold over each other creating organic, flowing marble veins.
 * Click to inject a turbulence burst. Colour palette from the gradient system.
 */

const VERTEX_SHADER = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  uniform vec2 resolution;
  uniform vec2 mouse;
  uniform float time;
  uniform float burst;

  // Simplex-ish noise
  vec3 mod289(vec3 x) { return x - floor(x / 289.0) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x / 289.0) * 289.0; }
  vec3 permute(vec3 x) { return mod289((x * 34.0 + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865, 0.366025403, -0.577350269, 0.024390243);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = x0.x > x0.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m * m * m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284 - 0.85373 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float marble(vec2 uv, vec2 mouse, float t) {
    float dist = length(uv - mouse);
    float influence = exp(-dist * 2.0) * 2.0;

    float n = 0.0;
    n += snoise(uv * 2.0 + t * 0.15) * 1.0;
    n += snoise(uv * 4.0 - t * 0.1 + influence) * 0.5;
    n += snoise(uv * 8.0 + t * 0.08) * 0.25;
    n += snoise(uv * 16.0 - t * 0.05 + influence * 0.5) * 0.125;

    // Marble vein pattern
    float vein = sin(uv.x * 6.0 + n * 4.0 + influence * 3.0 + burst * sin(dist * 10.0 - t * 5.0));
    return vein;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution;
    uv.x *= resolution.x / resolution.y;

    vec2 m = mouse;
    m.x *= resolution.x / resolution.y;

    float v = marble(uv, m, time);

    // Colour palette: dark base with coloured veins
    // Colours shift with mouse position (xPc/yPc mapped)
    float r1 = mouse.x;
    float g1 = mouse.y;
    float b1 = 1.0 - mouse.x;

    vec3 dark = vec3(0.02, 0.02, 0.02);
    vec3 veinColour = vec3(r1 * 0.7, g1 * 0.5, b1 * 0.8);
    vec3 highlight = vec3(r1, g1, b1) * 0.4;

    float veinMask = smoothstep(0.0, 0.1, abs(v));
    float glowMask = exp(-abs(v) * 3.0);

    vec3 colour = mix(highlight, dark, veinMask);
    colour += veinColour * glowMask * 0.5;

    // Subtle vignette
    vec2 center = gl_FragCoord.xy / resolution - 0.5;
    float vig = 1.0 - dot(center, center) * 0.5;
    colour *= vig;

    gl_FragColor = vec4(colour, 1.0);
  }
`;

export default function ShaderMarbling() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointer = usePointer({ lerp: 0.05 });
  const pointerRef = useRef(pointer);
  pointerRef.current = pointer;
  const burstRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: false, preserveDrawingBuffer: false });
    if (!gl) return;

    let raf: number;
    let w = 0;
    let h = 0;

    // Compile shader
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        return null;
      }
      return shader;
    };

    const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Full-screen quad
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const posAttr = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    const uResolution = gl.getUniformLocation(program, "resolution");
    const uMouse = gl.getUniformLocation(program, "mouse");
    const uTime = gl.getUniformLocation(program, "time");
    const uBurst = gl.getUniformLocation(program, "burst");

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      w = window.innerWidth;
      h = window.innerHeight - 41;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const { xPc, yPc, time } = pointerRef.current;

      // Decay burst
      burstRef.current *= 0.96;

      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform2f(uMouse, xPc / 100, yPc / 100);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uBurst, burstRef.current);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const handleClick = () => {
    burstRef.current = 3.0;
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
