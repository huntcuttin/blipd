import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getBatchGroup,
  planUserDispatch,
  BATCH_THRESHOLDS,
  type BatchGroup,
} from "./batching";

// Minimal stand-in for a pending alert — the planner only ever reads the type.
interface Item {
  id: string;
  type: string;
}
const item = (id: string, type: string): Item => ({ id, type });
const typeOf = (i: Item) => i.type;
const ids = (items: Item[]) => items.map((i) => i.id);

const many = (type: string, n: number, prefix = type) =>
  Array.from({ length: n }, (_, i) => item(`${prefix}${i + 1}`, type));

test("getBatchGroup maps price alert types to the price group", () => {
  for (const t of ["price_drop", "all_time_low", "sale_started", "sale_ending"]) {
    assert.equal(getBatchGroup(t), "price", `${t} should be price`);
  }
});

test("getBatchGroup maps launch alert types to the launch group", () => {
  assert.equal(getBatchGroup("out_now"), "launch");
  assert.equal(getBatchGroup("release_today"), "launch");
});

test("getBatchGroup returns null for types that always send individually", () => {
  for (const t of ["announced", "switch2_edition_announced", "retro_game_added"]) {
    assert.equal(getBatchGroup(t), null, `${t} should not batch`);
  }
});

test("getBatchGroup returns null for an unknown type rather than throwing", () => {
  assert.equal(getBatchGroup("some_future_alert_type"), null);
  assert.equal(getBatchGroup(""), null);
});

test("empty input produces an empty plan", () => {
  const plan = planUserDispatch<Item>([], typeOf);
  assert.deepEqual(plan.digests, []);
  assert.deepEqual(plan.individual, []);
});

test("launch alerts below threshold send individually", () => {
  const items = many("out_now", BATCH_THRESHOLDS.launch - 1);
  const plan = planUserDispatch(items, typeOf);
  assert.deepEqual(plan.digests, []);
  assert.equal(plan.individual.length, BATCH_THRESHOLDS.launch - 1);
});

test("launch alerts at the threshold collapse into one digest", () => {
  const items = many("out_now", BATCH_THRESHOLDS.launch);
  const plan = planUserDispatch(items, typeOf);
  assert.equal(plan.digests.length, 1);
  assert.equal(plan.digests[0].group, "launch");
  assert.equal(plan.digests[0].items.length, BATCH_THRESHOLDS.launch);
  assert.deepEqual(plan.individual, []);
});

test("a multi-release day becomes exactly one launch email", () => {
  // The regression this feature exists to prevent: 20 followed games flipping
  // to released in one window used to be 20 separate emails.
  const plan = planUserDispatch(many("out_now", 20), typeOf);
  assert.equal(plan.digests.length, 1);
  assert.equal(plan.digests[0].items.length, 20);
  assert.equal(plan.individual.length, 0);
});

test("mixed launch types count toward the same launch digest", () => {
  const items = [...many("out_now", 3), ...many("release_today", 2)];
  const plan = planUserDispatch(items, typeOf);
  assert.equal(plan.digests.length, 1);
  assert.equal(plan.digests[0].group, "launch");
  assert.equal(plan.digests[0].items.length, 5);
});

test("price and launch groups never merge into one digest", () => {
  const items = [...many("sale_started", 6), ...many("out_now", 6)];
  const plan = planUserDispatch(items, typeOf);
  assert.equal(plan.digests.length, 2);
  const groups = plan.digests.map((d) => d.group).sort();
  assert.deepEqual(groups, ["launch", "price"]);
  for (const d of plan.digests) assert.equal(d.items.length, 6);
  assert.deepEqual(plan.individual, []);
});

test("a group under threshold still sends individually when another group batches", () => {
  const items = [...many("sale_started", 6), ...many("out_now", 2)];
  const plan = planUserDispatch(items, typeOf);
  assert.equal(plan.digests.length, 1);
  assert.equal(plan.digests[0].group, "price");
  assert.deepEqual(ids(plan.individual), ["out_now1", "out_now2"]);
});

test("four price plus four launch stays fully individual — no cross-group batching", () => {
  const items = [...many("price_drop", 4), ...many("out_now", 4)];
  const plan = planUserDispatch(items, typeOf);
  assert.deepEqual(plan.digests, []);
  assert.equal(plan.individual.length, 8);
});

test("non-batchable alerts are never swept into a digest", () => {
  const items = [
    ...many("out_now", 6),
    item("ann1", "announced"),
    item("retro1", "retro_game_added"),
  ];
  const plan = planUserDispatch(items, typeOf);
  assert.equal(plan.digests.length, 1);
  assert.equal(plan.digests[0].group, "launch");
  assert.deepEqual(ids(plan.individual), ["ann1", "retro1"]);
});

test("individual sends preserve arrival order across mixed groups", () => {
  const items = [
    item("a", "announced"),
    item("b", "out_now"),
    item("c", "price_drop"),
    item("d", "out_now"),
  ];
  const plan = planUserDispatch(items, typeOf);
  assert.deepEqual(plan.digests, []);
  assert.deepEqual(ids(plan.individual), ["a", "b", "c", "d"]);
});

test("digests are ordered launch-first so the hero alert lands first", () => {
  const items = [...many("price_drop", 5), ...many("out_now", 5)];
  const plan = planUserDispatch(items, typeOf);
  assert.deepEqual(plan.digests.map((d) => d.group), ["launch", "price"]);
});

test("every alert appears exactly once across the plan", () => {
  const items = [
    ...many("out_now", 7),
    ...many("sale_ending", 3),
    item("ann1", "announced"),
  ];
  const plan = planUserDispatch(items, typeOf);
  const seen = [...plan.digests.flatMap((d) => d.items), ...plan.individual];
  assert.equal(seen.length, items.length);
  assert.deepEqual(new Set(ids(seen)), new Set(ids(items)));
});

test("thresholds are injectable for tuning without touching the planner", () => {
  const custom: Record<BatchGroup, number> = { price: 5, launch: 2 };
  const plan = planUserDispatch(many("out_now", 2), typeOf, custom);
  assert.equal(plan.digests.length, 1);
  assert.equal(plan.digests[0].items.length, 2);
});

test("a threshold of 1 batches a single alert (guards against tuning surprises)", () => {
  const custom: Record<BatchGroup, number> = { price: 5, launch: 1 };
  const plan = planUserDispatch([item("x", "out_now")], typeOf, custom);
  assert.equal(plan.digests.length, 1);
  assert.deepEqual(plan.individual, []);
});

test("the planner does not mutate its input", () => {
  const items = [...many("out_now", 6), item("ann", "announced")];
  const snapshot = ids(items);
  planUserDispatch(items, typeOf);
  assert.deepEqual(ids(items), snapshot);
});
