// Run: node --test --experimental-strip-types scripts/spring-field.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dampingRatio, dampingForRatio, regimeOf, predictedOvershoot, stepSpring, simulateRelease, falloff, fieldTarget,
  gridFor, gridPoints, fieldStats, probeMove, isAtRest,
} from "../app/lib/spring-field-core.ts";

const P = (zeta: number, k = 200, m = 1) => ({ stiffness: k, mass: m, damping: dampingForRatio(zeta, k, m) });

test("dampingRatio and dampingForRatio are inverses", () => {
  for (const z of [0.1, 0.5, 1, 2.5]) assert.ok(Math.abs(dampingRatio(P(z, 340, 1.5)) - z) < 1e-12);
});

test("regime labels", () => {
  assert.equal(regimeOf(0.3), "underdamped");
  assert.equal(regimeOf(1), "critically damped");
  assert.equal(regimeOf(1.8), "overdamped");
});

test("predictedOvershoot matches known values and is 0 at zeta >= 1", () => {
  assert.equal(predictedOvershoot(1), 0);
  assert.equal(predictedOvershoot(2), 0);
  // exp(-pi * 0.5 / sqrt(0.75)) = 0.16303...
  assert.ok(Math.abs(predictedOvershoot(0.5) - 0.16303) < 1e-4);
  assert.ok(predictedOvershoot(0.2) > predictedOvershoot(0.6));
});

test("simulated overshoot agrees with the closed form to within 1.5 percentage points", () => {
  for (const z of [0.15, 0.3, 0.5, 0.7]) {
    const sim = simulateRelease(P(z), 100, 1 / 60).overshoot;
    const want = predictedOvershoot(z);
    assert.ok(Math.abs(sim - want) < 0.015, `zeta ${z}: simulated ${sim}, predicted ${want}`);
  }
});

test("critically damped and overdamped springs do not overshoot", () => {
  for (const z of [1, 1.5, 3]) assert.ok(simulateRelease(P(z)).overshoot < 1e-3, `zeta ${z}`);
});

test("every release settles, and an underdamped spring takes longer than a critically damped one", () => {
  const under = simulateRelease(P(0.1));
  const crit = simulateRelease(P(1));
  assert.ok(under.settleSeconds !== null && crit.settleSeconds !== null);
  assert.ok(under.settleSeconds > crit.settleSeconds);
});

test("a very overdamped spring is slower than a critically damped one", () => {
  const crit = simulateRelease(P(1)).settleSeconds!;
  const over = simulateRelease(P(6)).settleSeconds!;
  assert.ok(over > crit);
});

test("stepSpring is stable for stiff springs at 60 fps and deterministic", () => {
  const p = P(0.4, 2000);
  let s = { x: 50, v: 0 };
  for (let i = 0; i < 600; i++) s = stepSpring(s, 0, p, 1 / 60);
  assert.ok(Number.isFinite(s.x) && Math.abs(s.x) < 1);
  assert.deepEqual(stepSpring({ x: 3, v: 1 }, 0, p, 1 / 60), stepSpring({ x: 3, v: 1 }, 0, p, 1 / 60));
});

test("the result does not depend much on frame rate", () => {
  const a = simulateRelease(P(0.3), 100, 1 / 60).overshoot;
  const b = simulateRelease(P(0.3), 100, 1 / 144).overshoot;
  assert.ok(Math.abs(a - b) < 0.01);
});

test("isAtRest needs both position and velocity", () => {
  assert.equal(isAtRest({ x: 0, v: 0 }, 0), true);
  assert.equal(isAtRest({ x: 0, v: 5 }, 0), false);
  assert.equal(isAtRest({ x: 5, v: 0 }, 0), false);
});

test("falloff: 1 at the pointer, 0 at the radius and beyond, monotonic", () => {
  assert.equal(falloff(0, 100), 1);
  assert.equal(falloff(100, 100), 0);
  assert.equal(falloff(150, 100), 0);
  assert.ok(falloff(20, 100) > falloff(60, 100));
});

test("fieldTarget: repel pushes away, attract pulls toward, nothing outside the radius", () => {
  const rest = { x: 100, y: 0 };
  const ptr = { x: 80, y: 0 };
  const rep = fieldTarget(rest, ptr, 100, 30, "repel");
  assert.ok(rep.x > 0 && Math.abs(rep.y) < 1e-12);
  const att = fieldTarget(rest, ptr, 100, 30, "attract");
  assert.ok(att.x < 0);
  assert.deepEqual(fieldTarget({ x: 500, y: 0 }, ptr, 100, 30, "repel"), { x: 0, y: 0 });
  assert.deepEqual(fieldTarget(rest, null, 100, 30, "repel"), { x: 0, y: 0 });
});

test("attract never carries an element past the pointer", () => {
  const rest = { x: 12, y: 0 };
  const t = fieldTarget(rest, { x: 0, y: 0 }, 100, 500, "attract");
  assert.ok(Math.abs(t.x) <= 12 + 1e-9);
});

test("grid sizing and points", () => {
  assert.deepEqual(gridFor(100, 50, 25), { cols: 4, rows: 2, gap: 25 });
  assert.deepEqual(gridFor(1, 1, 25), { cols: 1, rows: 1, gap: 25 });
  const pts = gridPoints({ cols: 3, rows: 2, gap: 10 });
  assert.equal(pts.length, 6);
  assert.deepEqual(pts[0], { x: 5, y: 5 });
  assert.deepEqual(pts[5], { x: 25, y: 15 });
});

test("fieldStats counts only elements past the threshold", () => {
  const s = fieldStats([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 0.1, y: 0 }]);
  assert.equal(s.displaced, 1);
  assert.equal(s.maxOffset, 5);
  assert.ok(Math.abs(s.meanOffset - (5 + 0.1) / 3) < 1e-12);
});

test("probeMove steps and clamps; other keys are ignored", () => {
  assert.deepEqual(probeMove({ x: 10, y: 10 }, "ArrowRight", 24, 100, 100), { x: 34, y: 10 });
  assert.deepEqual(probeMove({ x: 10, y: 10 }, "ArrowLeft", 24, 100, 100), { x: 0, y: 10 });
  assert.deepEqual(probeMove({ x: 90, y: 90 }, "ArrowDown", 24, 100, 100), { x: 90, y: 100 });
  assert.equal(probeMove({ x: 0, y: 0 }, "a", 24, 100, 100), null);
});
