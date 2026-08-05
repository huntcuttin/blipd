# Home Layout Alternatives — Decision Doc

Status: (A) shipped 2026-08-04. (B) and (C) deferred by the founder same night —
"radar theme" felt like more novelty than product, "deals-first" felt too
sparse for the (currently: 1) user with nothing on sale. Neither was killed
outright. This doc exists so a future session can build either without
re-deriving the reasoning or the taste calls already made.

Ground truth for "what exists today" is `src/app/home/page.tsx`,
`src/components/HomeHero.tsx` (the `RadarFeed`/`buildRadarFeed` event feed),
and `src/components/RadarStatus.tsx` (the pulsing-dot freshness line). Read
those before touching any of A/B/C — this doc describes intent and structure,
not the literal current code, which will keep drifting.

Bible test for all three: "Does this make the Wednesday night moment better,
or does it add noise between Wednesday nights?"

---

## (A) Current state — reference baseline

**One-line description:** a single scrollable dashboard, no tabs. Header
(logo, search, profile) → radar status line (pulsing dot + "Watching N games
· Checked X min ago") → Nintendo Direct banner → **"New for you"** event feed
(Beepr-style, up to 6 rows: all-time-lows and deals first, then soonest
upcoming launches, borderless Spotify-style rows) → **Watching** (everything
followed that isn't already in the feed, on-sale-first, rendered as
`GameCard`s in card boxes) → **My Franchises** (followed franchises as
borderless rows with a follow button).

**Data needed:** `followedGameIds`/`followedFranchiseIds`/`ownedGameIds`
(FollowContext), the actual `Game` rows for followed ids, all franchises
filtered to followed, `getLastPriceCheckTimestamp()` for the freshness line.

**Why it's the baseline, not a variant to rebuild:** it already satisfies the
Bible's "Home answers what should I care about" test — event feed leads with
what changed, Watching is the full backstop list, nothing merchandised.
Franchises are collapsed to the bottom since they're the least
action-oriented section. Kept here only so B and C can be described as *diffs
from this*, not from scratch.

**What it deliberately does NOT do**: no ambient animation beyond the one
`home-radar-ping` dot; no signal-strength/proximity metaphor; no
collapsed/hidden sections — everything on the page is immediately visible on
load (mission: no extra taps to see your own stuff).

---

## (B) "Radar theme" — full immersion in the metaphor

**Concept:** stop using "radar" as a single decorative dot and let it
organize the whole page. Followed games become tracked contacts on a radar,
each with a signal-strength read (how close it is to an event — launch
window closing in, sale ending soon, price near target) rather than a plain
list.

### Layout order
1. **Radar status header (expanded)** — replaces today's one-line
   `RadarStatus`. Same pulsing-dot freshness signal, but bigger: a
   thin horizontal "sweep" bar animation (CSS gradient sweep, not canvas —
   keep it cheap) that visually loops behind the "Watching N · Checked Xm
   ago" text. This is the one place in the page allowed continuous motion.
2. **Contacts feed** — replaces "New for you." Same underlying data
   (`buildRadarFeed`'s ordering logic is reusable as-is — deals/ATL first,
   then soonest launches) but each row gets a **signal-strength indicator**:
   a small multi-bar or concentric-arc glyph (like a signal-bars icon) whose
   fill level encodes "how close/hot" this event is —full bars for
   all-time-low or launching today, fewer bars for a modest discount or a
   launch 3+ weeks out. This is the metaphor's actual payoff: at a glance,
   which contacts are "hot" without reading the copy.
3. **Watching (tracked blips)** — the backstop list, same membership rule as
   today (followed, not already in the feed). Each row is still a `GameCard`-
   equivalent, but the on-sale/launch-soon badge is restyled as a small
   "blip" dot (pulsing only if within a tight window — e.g. sale ends <48h
   or launch <7 days; otherwise static, to avoid every row pulsing at once).
4. **My Franchises** — unchanged from (A). The metaphor doesn't need to reach
   franchises; forcing it here (e.g. franchises as "regions" being scanned)
   was explicitly discussed and rejected as reaching too far.

### New/changed components (spec, not code)
- `RadarStatus` (extend) — add the sweep-bar animation. Single `@keyframes`
  gradient-position loop, ~3-4s duration, `prefers-reduced-motion` must
  disable it (fall back to today's static pulsing dot only).
- `SignalStrengthGlyph` (new) — pure presentational, takes a 1-4 (or 1-3)
  integer level + optional label, renders bars or arcs. Needs a pure function
  to compute level from a `Game` + event type (discount depth / all-time-low
  / days-until-launch buckets) — this scoring function is the actual design
  work, more than the glyph itself. Reuses `RadarIcon` (`src/components/
  icons.tsx`) as the header/section icon rather than inventing a new one.
- `RadarRow` (extend `HomeHero.tsx`) — add the glyph in place of (or
  alongside) today's countdown chip / discount badge.
- Blip-pulse treatment on `GameCard` or its Watching-list wrapper — needs a
  "should this pulse" boolean prop, computed from the same urgency windows
  the glyph uses, so the two sections read consistently.

### Data needed
Same as (A) — no new queries. This is a pure presentation-layer reskin: every
input (`isOnSale`, `discount`, `isAllTimeLow`, `saleEndDate`, `releaseDate`,
`releaseStatus`) is already on the `Game` type. The only new "data" is a
derived signal-strength score, computed client-side from existing fields —
does not need a DB column or a cron change.

### Risk (why this got deferred)
- **Novelty wears thin fast.** A signal-strength glyph is delightful the
  first few times, then becomes one more thing to visually parse on a page
  whose whole job is "tell me fast." If the glyph doesn't map to an action
  the user can take differently based on it, it's decoration wearing a
  function costume — worth a hard gut-check before building: does a
  4-bar vs 2-bar row change what the user does? If not, it's just skin.
- **Animation overload.** Sweep bar (continuous) + pulsing blips (per-row,
  potentially many at once during a big sale event) + the existing
  `active:scale-95` press states risk a page that feels busy/gimmicky
  rather than calm — directly at odds with "the alert is the product,"
  not the chrome around it. Mitigate by capping simultaneous pulses (e.g.
  only the single most-urgent row pulses, everything else static) and by
  treating `prefers-reduced-motion` as non-negotiable, not a nice-to-have.
- **Metaphor tax on new users.** "Watching," "blip," "signal strength" is one
  more small vocabulary a first-time user has to learn versus a plain list
  with a discount badge — plain lists have zero learning curve. This is the
  core tension: the radar branding is already locked (RadarIcon, "Watching"
  language, the pulsing dot) — the open question is how *far* to push the
  metaphor into structural UI, not whether to use it at all.
- **Build cost vs. payoff**: this is a real chunk of new component surface
  (signal-strength scoring function + glyph + two animation systems) for a
  restyle that doesn't add a single new capability — worth weighing against
  literally any item still open on the audit list before greenlighting.

---

## (C) "Deals-first" — radically narrow Home

**Concept:** Home shows exactly two things and nothing else by default:
"your stuff on sale right now" and "what's coming for you next" (soonest
upcoming launches among followed games). Everything else — the full Watching
backstop list, franchises — collapses behind one disclosure control, not
removed from the app, just not on the page by default.

### Layout order
1. Header — unchanged (logo, search, profile).
2. Radar status line — unchanged, stays as the freshness signal regardless
   of which Home variant ships.
3. Direct banner — unchanged.
4. **"On sale now"** — followed games with `isOnSale === true`, sorted
   all-time-low first then discount depth (same ordering `buildRadarFeed`
   already uses for its deals half — directly reusable). Full-width rows or
   cards, no cap on count (unlike today's 6-row feed limit) since this
   section's whole reason to exist is completeness for "your stuff on sale."
5. **"Coming for you next"** — followed upcoming games, soonest real
   (non-placeholder) release date first, small count cap (3-5) since this is
   a preview, not a full list — "see all" links to `/upcoming` or a filtered
   view, doesn't need its own full page here.
6. **Collapsed section — "Everything else" or "All watching" (disclosure,
   collapsed by default)** — contains what's left: followed games with
   neither an active sale nor a near-term date, plus franchises. One tap to
   expand. This is where most of a typical user's list actually lives most
   of the time (most followed games are neither on sale nor launching
   imminently at any given moment) — collapsing it is the whole bet of this
   variant.

### Data needed
Same underlying `Game`/`Franchise` data as (A) and (B) — this is a filter/
grouping change, not a new query. The only structural addition is the
collapsed-section disclosure state (simple client-side boolean, no
persistence needed — reasonable to default it open the *first* time a user
ever visits, collapsed on return visits, if bothering to remember state at
all; simplest version just always defaults collapsed and doesn't remember).

### Bible alignment
This is the variant most literally aligned with the Product Bible's own
words: "Home should immediately show the user THEIR games — what's on sale
in their watchlist... Discovery/browsing is secondary" and the restructure
doc's own stated goal, "Home instantly answers 'what should I care about?'"
(Session Log — 2026-03-22, Proposed Restructure). (C) is that principle taken
to its logical extreme — if "what should I care about" is truly just sales +
imminent launches, everything else is by definition lower-priority and
earns its place below a fold, not above one.

### Risk (why this got deferred)
- **Feels empty for the common case.** At any given moment most users will
  have zero followed games on sale and zero launching in the near term —
  that's not a bug, it's just how infrequently either event actually happens
  per game. For that (likely majority) moment, Home shows two empty/near-
  empty sections and a collapsed disclosure holding the actual content the
  user came to see (their list) — the opposite of "feels alive," feels
  broken or sparse instead. (A)'s "Watching" list at least always shows
  something concrete immediately.
- **One extra tap to reach your own list on the median visit** — for a user
  who follows 10 games and 1 is on sale, "see my other 9" now requires
  expanding a section rather than just scrolling, which is real friction on
  the single highest-frequency use case (checking on stuff you follow),
  traded for a cleaner initial read on the rarer high-signal case (something
  just happened).
- **The all-quiet state needs its own real design** — (A) already has a
  `QuietState` component for the feed; (C) needs the equivalent for *two*
  sections simultaneously being empty, and that empty state is going to be
  the modal (most common) state a returning user with a stable, mostly-
  released watchlist sees, not an edge case — worth designing that state
  first, before the "full" state, since it's actually more common.
- **Doesn't need the radar metaphor at all** — orthogonal to (B); could ship
  either with or without radar-flavored styling on top. Worth deciding
  those as two separate axes rather than assuming they're coupled.

---

## Cross-cutting notes for whoever builds next

- (B) and (C) are **not mutually exclusive** — (B) is a skin/interaction
  layer, (C) is a content-scoping decision. A future session could plausibly
  ship "(C)'s scoping + (A)'s current plain styling" or "(A)'s current
  scoping + (B)'s signal-strength glyphs" as hybrids neither pure variant
  above describes. Don't treat this doc as three mutually exclusive radio
  buttons.
- Whichever ships, `RadarStatus`'s freshness line ("Checked X min ago") is
  Bible-mandated (`getLastPriceCheckTimestamp`, "users should never have to
  wonder if their alerts are working") and should survive unchanged in
  every variant — it's the one element that isn't up for a taste call.
- No variant here requires a schema or cron change. Everything is
  presentation/grouping logic over data already on the `Game`/`Franchise`
  types. Treat any future version of this doc that *does* introduce a new
  DB column or query as a scope-creep flag worth double-checking against the
  Bible's "does this add noise" test before building.
