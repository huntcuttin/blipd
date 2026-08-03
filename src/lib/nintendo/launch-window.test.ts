import { test } from "node:test";
import assert from "node:assert/strict";
import {
  predictLaunchInstant,
  isWithinBurstWindow,
  isLiveOnEshop,
  zonedTimeToUtc,
  BURST_WINDOW_MS,
} from "./launch-window";

const iso = (d: Date) => d.toISOString();

test("zonedTimeToUtc handles Pacific daylight time", () => {
  // Aug 14 2026 09:00 PDT (UTC-7) === 16:00 UTC
  assert.equal(
    iso(zonedTimeToUtc(2026, 8, 14, 9, 0, "America/Los_Angeles")),
    "2026-08-14T16:00:00.000Z"
  );
});

test("zonedTimeToUtc handles Pacific standard time", () => {
  // Jan 15 2026 09:00 PST (UTC-8) === 17:00 UTC
  assert.equal(
    iso(zonedTimeToUtc(2026, 1, 15, 9, 0, "America/Los_Angeles")),
    "2026-01-15T17:00:00.000Z"
  );
});

test("zonedTimeToUtc handles Eastern midnight across both DST states", () => {
  // Midnight EDT (UTC-4) === 04:00 UTC
  assert.equal(iso(zonedTimeToUtc(2026, 8, 14, 0, 0, "America/New_York")), "2026-08-14T04:00:00.000Z");
  // Midnight EST (UTC-5) === 05:00 UTC
  assert.equal(iso(zonedTimeToUtc(2026, 1, 15, 0, 0, "America/New_York")), "2026-01-15T05:00:00.000Z");
});

test("first-party publishers predict midnight ET on release day", () => {
  const p = predictLaunchInstant({ releaseDate: "2026-08-14", publisher: "Nintendo" });
  assert.equal(p?.rule, "midnight_et");
  assert.equal(iso(p!.at), "2026-08-14T04:00:00.000Z");
});

test("publisher matching is case-insensitive and substring-based", () => {
  for (const pub of ["CAPCOM", "Sega of America", "Nintendo of America"]) {
    assert.equal(predictLaunchInstant({ releaseDate: "2026-08-14", publisher: pub })?.rule, "midnight_et", pub);
  }
});

test("physical editions predict 9 PM PT the night before", () => {
  const p = predictLaunchInstant({
    releaseDate: "2026-08-14",
    publisher: "Indie Studio",
    hasPhysicalRelease: true,
  });
  assert.equal(p?.rule, "physical_night_before");
  // Aug 13 21:00 PDT === Aug 14 04:00 UTC
  assert.equal(iso(p!.at), "2026-08-14T04:00:00.000Z");
});

test("the night-before rule rolls back across a month boundary", () => {
  const p = predictLaunchInstant({
    releaseDate: "2026-09-01",
    publisher: "Indie Studio",
    hasPhysicalRelease: true,
  });
  // Aug 31 21:00 PDT === Sep 1 04:00 UTC
  assert.equal(iso(p!.at), "2026-09-01T04:00:00.000Z");
});

test("the night-before rule rolls back across a year boundary", () => {
  const p = predictLaunchInstant({
    releaseDate: "2027-01-01",
    publisher: "Indie Studio",
    hasPhysicalRelease: true,
  });
  // Dec 31 21:00 PST === Jan 1 05:00 UTC
  assert.equal(iso(p!.at), "2027-01-01T05:00:00.000Z");
});

test("digital-only third party predicts 9 AM PT on release day", () => {
  const p = predictLaunchInstant({ releaseDate: "2026-08-14", publisher: "Indie Studio" });
  assert.equal(p?.rule, "digital_9am_pt");
  assert.equal(iso(p!.at), "2026-08-14T16:00:00.000Z");
});

test("unknown physical status falls back to the digital default", () => {
  for (const v of [null, undefined, false]) {
    const p = predictLaunchInstant({
      releaseDate: "2026-08-14",
      publisher: "Indie Studio",
      hasPhysicalRelease: v,
    });
    assert.equal(p?.rule, "digital_9am_pt", `hasPhysicalRelease=${String(v)}`);
  }
});

test("first-party takes precedence over the physical rule", () => {
  const p = predictLaunchInstant({
    releaseDate: "2026-08-14",
    publisher: "Nintendo",
    hasPhysicalRelease: true,
  });
  assert.equal(p?.rule, "midnight_et");
});

test("a missing publisher still predicts the digital default", () => {
  assert.equal(predictLaunchInstant({ releaseDate: "2026-08-14", publisher: null })?.rule, "digital_9am_pt");
});

test("placeholder and malformed dates yield no prediction", () => {
  for (const d of ["2099-12-31", "", "not-a-date", "2026-8-14", "2026-13-01", "2026-01-32"]) {
    assert.equal(predictLaunchInstant({ releaseDate: d }), null, `date ${d} should not predict`);
  }
});

test("burst window is inclusive at both edges", () => {
  const at = new Date("2026-08-14T16:00:00.000Z");
  const before = new Date(at.getTime() - BURST_WINDOW_MS);
  const after = new Date(at.getTime() + BURST_WINDOW_MS);
  assert.equal(isWithinBurstWindow(at, at), true);
  assert.equal(isWithinBurstWindow(at, before), true);
  assert.equal(isWithinBurstWindow(at, after), true);
});

test("burst window excludes instants outside it", () => {
  const at = new Date("2026-08-14T16:00:00.000Z");
  assert.equal(isWithinBurstWindow(at, new Date(at.getTime() - BURST_WINDOW_MS - 1000)), false);
  assert.equal(isWithinBurstWindow(at, new Date(at.getTime() + BURST_WINDOW_MS + 1000)), false);
  assert.equal(isWithinBurstWindow(at, new Date("2026-08-13T16:00:00.000Z")), false);
});

test("burst window accepts a custom width", () => {
  const at = new Date("2026-08-14T16:00:00.000Z");
  const tenMinLater = new Date(at.getTime() + 10 * 60 * 1000);
  assert.equal(isWithinBurstWindow(at, tenMinLater, 5 * 60 * 1000), false);
  assert.equal(isWithinBurstWindow(at, tenMinLater, 15 * 60 * 1000), true);
});

test("only sales_status onsale counts as live", () => {
  assert.equal(isLiveOnEshop("onsale"), true);
});

test("preorder listings are not treated as live even though they carry a price", () => {
  // Verified against the live Nintendo price API: an unreleased title returns
  // sales_status "unreleased" *with* a regular_price. Treating price presence
  // as the launch signal would fire a false "out now" alert before release.
  assert.equal(isLiveOnEshop("unreleased"), false);
});

test("delisted and unknown statuses are not live", () => {
  for (const s of ["not_found", "sales_termination", "", null, undefined]) {
    assert.equal(isLiveOnEshop(s), false, `status ${String(s)} should not be live`);
  }
});
