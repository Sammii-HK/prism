// Run: node --test --experimental-strip-types scripts/reorder.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  moveItem, insertIndexFromMidpoints, flipDeltas, slotTop, reorderReducer, initialState, keyAction, sameOrder,
  type Item, type ReorderState,
} from "../app/lib/reorder-core.ts";

const items: Item[] = ["a", "b", "c", "d", "e"].map((id) => ({ id, label: id.toUpperCase() }));
const ids = (s: ReorderState | Item[]) => (Array.isArray(s) ? s : s.items).map((i) => i.id).join("");

test("moveItem moves, clamps, and never mutates", () => {
  const src = [1, 2, 3, 4];
  assert.deepEqual(moveItem(src, 0, 2), [2, 3, 1, 4]);
  assert.deepEqual(moveItem(src, 3, 0), [4, 1, 2, 3]);
  assert.deepEqual(moveItem(src, 1, 99), [1, 3, 4, 2]);
  assert.deepEqual(moveItem(src, 1, -5), [2, 1, 3, 4]);
  assert.deepEqual(moveItem(src, 9, 0), [1, 2, 3, 4]);
  assert.deepEqual(src, [1, 2, 3, 4]);
});

test("moveItem always keeps the same members", () => {
  for (let from = 0; from < 5; from++)
    for (let to = 0; to < 5; to++) assert.equal(ids(moveItem(items, from, to)).split("").sort().join(""), "abcde");
});

test("insertIndexFromMidpoints counts the midpoints above the dragged one", () => {
  assert.equal(insertIndexFromMidpoints([30, 90, 150], 10), 0);
  assert.equal(insertIndexFromMidpoints([30, 90, 150], 100), 2);
  assert.equal(insertIndexFromMidpoints([30, 90, 150], 500), 3);
  assert.equal(insertIndexFromMidpoints([], 5), 0);
});

test("slotTop", () => {
  assert.equal(slotTop(0, 56, 8), 0);
  assert.equal(slotTop(3, 56, 8), 192);
});

test("flipDeltas gives the inverse shift, omits unmoved, ignores ids missing from either side", () => {
  const first = new Map([["a", { x: 0, y: 0 }], ["b", { x: 0, y: 64 }], ["c", { x: 0, y: 128 }], ["gone", { x: 0, y: 1 }]]);
  const last = new Map([["a", { x: 0, y: 64 }], ["b", { x: 0, y: 0 }], ["c", { x: 0, y: 128.2 }], ["new", { x: 0, y: 9 }]]);
  assert.deepEqual(flipDeltas(first, last), [
    { id: "a", dx: 0, dy: -64 },
    { id: "b", dx: 0, dy: 64 },
  ]);
});

test("keyboard: grab, move twice, drop", () => {
  let s = initialState(items);
  s = reorderReducer(s, { type: "grab", id: "b" });
  assert.match(s.announcement, /Picked up B, position 2 of 5/);
  s = reorderReducer(s, { type: "move", delta: 1 });
  s = reorderReducer(s, { type: "move", delta: 1 });
  assert.equal(ids(s), "acdbe");
  assert.equal(s.announcement, "Moved B to position 4 of 5.");
  s = reorderReducer(s, { type: "drop" });
  assert.equal(s.grabbed, null);
  assert.equal(s.announcement, "Dropped B, position 4 of 5.");
  assert.equal(ids(s), "acdbe");
});

test("keyboard: cancel restores the order from before the grab, however far it moved", () => {
  let s = initialState(items);
  s = reorderReducer(s, { type: "grab", id: "d" });
  s = reorderReducer(s, { type: "moveTo", index: 0 });
  s = reorderReducer(s, { type: "move", delta: 1 });
  assert.notEqual(ids(s), "abcde");
  s = reorderReducer(s, { type: "cancel" });
  assert.equal(ids(s), "abcde");
  assert.equal(s.grabbed, null);
  assert.equal(s.announcement, "Cancelled. D is back at position 4 of 5.");
});

test("keyboard: pushing against an end says so and changes nothing", () => {
  let s = reorderReducer(initialState(items), { type: "grab", id: "a" });
  s = reorderReducer(s, { type: "move", delta: -1 });
  assert.equal(ids(s), "abcde");
  assert.equal(s.announcement, "A is already first, position 1 of 5.");
  s = reorderReducer(s, { type: "moveTo", index: 999 });
  assert.equal(ids(s), "bcdea");
  s = reorderReducer(s, { type: "move", delta: 1 });
  assert.equal(s.announcement, "A is already last, position 5 of 5.");
});

test("actions that need a grabbed item do nothing without one", () => {
  const s = initialState(items);
  assert.equal(reorderReducer(s, { type: "move", delta: 1 }), s);
  assert.equal(reorderReducer(s, { type: "drop" }), s);
  assert.equal(reorderReducer(s, { type: "cancel" }), s);
});

test("pointerMove changes order without announcing", () => {
  const s = reorderReducer(initialState(items), { type: "pointerMove", id: "a", to: 3 });
  assert.equal(ids(s), "bcdae");
  assert.equal(s.announcement, "");
});

test("keyAction", () => {
  assert.deepEqual(keyAction("ArrowDown", true), { type: "move", delta: 1 });
  assert.deepEqual(keyAction("ArrowUp", true), { type: "move", delta: -1 });
  assert.deepEqual(keyAction("Escape", true), { type: "cancel" });
  assert.deepEqual(keyAction(" ", false), { type: "toggle" });
  assert.equal(keyAction("ArrowDown", false), null);
  assert.equal(keyAction("x", true), null);
});

test("sameOrder", () => {
  assert.equal(sameOrder(items, moveItem(items, 0, 0)), true);
  assert.equal(sameOrder(items, moveItem(items, 0, 1)), false);
});
