// Pure logic for the flip-reorder experiment. No React, no DOM, so node's
// built-in test runner can load it (see scripts/reorder.test.ts).

export interface Item {
  id: string;
  label: string;
}

/** A copy of `list` with the item at `from` moved to index `to`. Out-of-range indexes are clamped. */
export const moveItem = <T,>(list: readonly T[], from: number, to: number): T[] => {
  if (list.length === 0 || from < 0 || from >= list.length) return list.slice();
  const target = Math.max(0, Math.min(list.length - 1, to));
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
};

/**
 * Where a dragged item should be inserted, given the vertical midpoints of
 * the other items (in their current order, without the dragged one) and the
 * dragged item's own midpoint. It lands after every other item whose
 * midpoint is above it.
 */
export const insertIndexFromMidpoints = (othersMid: readonly number[], draggedMid: number): number => {
  let n = 0;
  for (const m of othersMid) if (draggedMid > m) n++;
  return n;
};

export interface Rect {
  x: number;
  y: number;
}

export interface FlipDelta {
  id: string;
  dx: number;
  dy: number;
}

/**
 * FLIP's "invert" step: for each id present in both maps, how far it must be
 * shifted so that, painted at its new position, it still looks like it is at
 * its old one. Items that did not move (within `epsilon` px) are omitted.
 */
export const flipDeltas = (first: ReadonlyMap<string, Rect>, last: ReadonlyMap<string, Rect>, epsilon = 0.5): FlipDelta[] => {
  const out: FlipDelta[] = [];
  for (const [id, a] of first) {
    const b = last.get(id);
    if (!b) continue;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    if (Math.abs(dx) > epsilon || Math.abs(dy) > epsilon) out.push({ id, dx, dy });
  }
  return out;
};

/** Top edge of slot `i` when every row is `rowHeight` tall with `gap` between rows. */
export const slotTop = (i: number, rowHeight: number, gap: number): number => i * (rowHeight + gap);

/* ------------------------------------------------------------------ */
/* Keyboard session                                                     */
/* ------------------------------------------------------------------ */

export interface ReorderState {
  items: Item[];
  /** The item currently picked up, with the index it was picked up from. */
  grabbed: { id: string; origin: number } | null;
  /** What a screen reader should hear next. Changes on every action that has something to say. */
  announcement: string;
}

export type ReorderAction =
  | { type: "grab"; id: string }
  | { type: "move"; delta: number }
  | { type: "moveTo"; index: number }
  | { type: "drop" }
  | { type: "cancel" }
  | { type: "reset"; items: Item[]; announcement?: string }
  | { type: "pointerDrop"; id: string }
  /** Pointer drag finished or shifted the order: the list is replaced, the sentence is built here. */
  | { type: "pointerMove"; id: string; to: number };

export const initialState = (items: Item[]): ReorderState => ({ items, grabbed: null, announcement: "" });

const pos = (i: number, n: number) => `position ${i + 1} of ${n}`;

export const announceGrab = (label: string, index: number, n: number) =>
  `Picked up ${label}, ${pos(index, n)}. Press the up and down arrow keys to move it, Space to drop it, Escape to cancel.`;
export const announceMove = (label: string, index: number, n: number) => `Moved ${label} to ${pos(index, n)}.`;
export const announceEdge = (label: string, index: number, n: number) =>
  `${label} is already ${index === 0 ? "first" : "last"}, ${pos(index, n)}.`;
export const announceDrop = (label: string, index: number, n: number) => `Dropped ${label}, ${pos(index, n)}.`;
export const announceCancel = (label: string, index: number, n: number) =>
  `Cancelled. ${label} is back at ${pos(index, n)}.`;

export const reorderReducer = (s: ReorderState, a: ReorderAction): ReorderState => {
  const n = s.items.length;
  const indexOf = (id: string) => s.items.findIndex((i) => i.id === id);
  switch (a.type) {
    case "reset":
      return { ...initialState(a.items), announcement: a.announcement ?? "" };
    case "grab": {
      const i = indexOf(a.id);
      if (i < 0) return s;
      return { ...s, grabbed: { id: a.id, origin: i }, announcement: announceGrab(s.items[i].label, i, n) };
    }
    case "move":
    case "moveTo": {
      if (!s.grabbed) return s;
      const i = indexOf(s.grabbed.id);
      if (i < 0) return s;
      const want = a.type === "move" ? i + a.delta : a.index;
      const to = Math.max(0, Math.min(n - 1, want));
      const label = s.items[i].label;
      if (to === i) return { ...s, announcement: announceEdge(label, i, n) };
      return { ...s, items: moveItem(s.items, i, to), announcement: announceMove(label, to, n) };
    }
    case "drop": {
      if (!s.grabbed) return s;
      const i = indexOf(s.grabbed.id);
      return { ...s, grabbed: null, announcement: announceDrop(s.items[i].label, i, n) };
    }
    case "cancel": {
      if (!s.grabbed) return s;
      const i = indexOf(s.grabbed.id);
      const items = moveItem(s.items, i, s.grabbed.origin);
      return { items, grabbed: null, announcement: announceCancel(s.items[i].label, s.grabbed.origin, n) };
    }
    case "pointerDrop": {
      const i = indexOf(a.id);
      return i < 0 ? s : { ...s, announcement: announceDrop(s.items[i].label, i, n) };
    }
    case "pointerMove": {
      const i = indexOf(a.id);
      if (i < 0 || i === a.to) return s;
      return { ...s, items: moveItem(s.items, i, a.to) };
    }
  }
};

/** Map a key to what a grabbed item should do. Null for keys this pattern does not use. */
export const keyAction = (key: string, grabbed: boolean): ReorderAction | { type: "toggle" } | null => {
  if (key === " " || key === "Enter") return { type: "toggle" };
  if (!grabbed) return null;
  switch (key) {
    case "ArrowUp": return { type: "move", delta: -1 };
    case "ArrowDown": return { type: "move", delta: 1 };
    case "Home": return { type: "moveTo", index: 0 };
    case "End": return { type: "moveTo", index: Number.MAX_SAFE_INTEGER };
    case "Escape": return { type: "cancel" };
    default: return null;
  }
};

export const sameOrder = (a: readonly Item[], b: readonly Item[]): boolean =>
  a.length === b.length && a.every((x, i) => x.id === b[i].id);
