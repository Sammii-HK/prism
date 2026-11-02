// Run: node --test --experimental-strip-types scripts/token-compose.test.ts
// Uses node's built-in test runner. No dependencies.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pastelColour } from "../app/lib/primitives/gradient.ts";
import {
  PALETTE, PASTELS, INK, PALETTE_ANCHORS, SPACING_STEPS, INJECT_KINDS, OFF_TOKEN,
  compose, validateComposition, runBatch, injectOffToken, rgbString,
} from "../app/lib/token-compose-core.ts";

test("palette is exactly what pastelColour returns at the anchors, plus ink", () => {
  assert.equal(PASTELS.length, PALETTE_ANCHORS.length);
  PALETTE_ANCHORS.forEach((a, i) => assert.equal(PASTELS[i], rgbString(pastelColour(a.x, a.y, 0))));
  assert.deepEqual(PALETTE, [...PASTELS, INK]);
});

test("the same seed always gives the same composition", () => {
  assert.deepEqual(compose(42), compose(42));
  assert.notDeepEqual(compose(42), compose(43));
});

test("1000 generated compositions: the validator finds 0 values outside the system", () => {
  const batch = runBatch(1, 1000);
  assert.equal(batch.compositions.length, 1000);
  assert.equal(batch.outside, 0);
  assert.equal(batch.firstViolation, null);
  assert.equal(batch.valuesChecked, 1000 * 13);
});

test("each injected off-token value is rejected with the right path and rule", () => {
  const expectedRule = { spacing: "spacing-scale", radius: "radius-scale", type: "type-scale", colour: "palette", layout: "layout" } as const;
  for (const kind of INJECT_KINDS) {
    const result = validateComposition(injectOffToken(compose(7), kind));
    assert.equal(result.ok, false, kind);
    assert.equal(result.violations.length, 1, kind);
    assert.equal(result.violations[0].path, OFF_TOKEN[kind].path);
    assert.equal(result.violations[0].value, OFF_TOKEN[kind].value);
    assert.equal(result.violations[0].rule, expectedRule[kind]);
  }
});

test("near misses are rejected: strings, fractions, NaN, case, missing and extra properties", () => {
  const base = compose(3);
  const withPadding = (v: unknown) => ({ ...base, card: { ...base.card, padding: v } });
  for (const bad of [String(SPACING_STEPS[0]), SPACING_STEPS[0] + 0.0001, NaN, -4, null, "4px"]) {
    assert.equal(validateComposition(withPadding(bad)).ok, false, String(bad));
  }
  assert.equal(validateComposition({ ...base, card: { ...base.card, background: base.card.background.toUpperCase() } }).ok, false);
  const { chip: _chip, ...noChip } = base;
  void _chip;
  assert.ok(validateComposition(noChip).violations.some((v) => v.rule === "missing-value" && v.path === "chip.padding"));
  assert.ok(validateComposition({ ...base, boxShadow: "0 0 4px red" }).violations.some((v) => v.rule === "unknown-property"));
  assert.equal(validateComposition(null).ok, false);
  assert.equal(validateComposition("card").ok, false);
});
