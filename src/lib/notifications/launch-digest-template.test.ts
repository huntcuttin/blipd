import { test } from "node:test";
import assert from "node:assert/strict";
import { launchDigest, MAX_LAUNCH_ROWS, type LaunchDigestGame } from "./launch-digest-template";
import { escapeHtml, eshopUrl } from "./email-shell";

const game = (over: Partial<LaunchDigestGame> = {}): LaunchDigestGame => ({
  title: "Metroid Prime 4",
  slug: "metroid-prime-4",
  price: 59.99,
  nsuid: "70010000012345",
  ...over,
});

const games = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    game({ title: `Game ${i + 1}`, slug: `game-${i + 1}`, nsuid: `7001000001234${i}` })
  );

test("escapeHtml neutralizes markup-breaking characters", () => {
  assert.equal(escapeHtml("Rock & Roll"), "Rock &amp; Roll");
  assert.equal(escapeHtml("<script>"), "&lt;script&gt;");
  assert.equal(escapeHtml(`"quoted"`), "&quot;quoted&quot;");
});

test("eshopUrl builds the product deep link from an nsuid", () => {
  assert.equal(
    eshopUrl("70010000012345"),
    "https://www.nintendo.com/us/store/products/70010000012345"
  );
});

test("eshopUrl falls back to the store home when nsuid is missing", () => {
  assert.equal(eshopUrl(null), "https://www.nintendo.com/us/store/");
  assert.equal(eshopUrl(undefined), "https://www.nintendo.com/us/store/");
});

test("subject and heading state the number of launches", () => {
  const { subject, html } = launchDigest(games(3));
  assert.match(subject, /\b3\b/);
  assert.match(html, /3 games you follow are out now/);
});

test("every game gets a row with an eShop deep link", () => {
  const list = games(4);
  const { html } = launchDigest(list);
  for (const g of list) {
    assert.ok(html.includes(g.title), `missing title ${g.title}`);
    assert.ok(
      html.includes(`https://www.nintendo.com/us/store/products/${g.nsuid}`),
      `missing eShop link for ${g.title}`
    );
  }
});

test("a game without an nsuid still renders, pointing at the store home", () => {
  const { html } = launchDigest([game({ nsuid: null })]);
  assert.ok(html.includes("https://www.nintendo.com/us/store/"));
  assert.ok(html.includes("Metroid Prime 4"));
});

test("launch price renders when known", () => {
  const { html } = launchDigest([game({ price: 59.99 })]);
  assert.ok(html.includes("$59.99"));
});

test("a missing or zero price is omitted rather than shown as $0.00", () => {
  for (const price of [null, undefined, 0]) {
    const { html } = launchDigest([game({ price })]);
    assert.ok(!html.includes("$0.00"), `price ${String(price)} rendered as $0.00`);
  }
});

test("titles are HTML-escaped so catalog punctuation can't break the markup", () => {
  const { html } = launchDigest([game({ title: "Fire & Ice <Deluxe>" })]);
  assert.ok(html.includes("Fire &amp; Ice &lt;Deluxe&gt;"));
  assert.ok(!html.includes("Fire & Ice <Deluxe>"));
});

test("slugs are URL-encoded in the details link", () => {
  const { html } = launchDigest([game({ slug: "odd slug/with?chars" })]);
  assert.ok(html.includes(encodeURIComponent("odd slug/with?chars")));
});

test("rows are capped and the remainder is summarized", () => {
  const total = MAX_LAUNCH_ROWS + 4;
  const { html } = launchDigest(games(total));
  assert.ok(html.includes(`+ 4 more`), "expected an overflow note");
  // Heading still reports the true total, not the truncated row count.
  assert.ok(html.includes(`${total} games you follow are out now`));
});

test("no overflow note when the list fits", () => {
  const { html } = launchDigest(games(MAX_LAUNCH_ROWS));
  assert.ok(!html.includes("more — view all on Blippd"));
});

test("renders a complete HTML document", () => {
  const { html } = launchDigest(games(2));
  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(html.trimEnd().endsWith("</html>"));
});
