# Mobile Scaffold Assessment — `mobile/` (Expo)

Assessed 2026-08-05. Read-only pass over all 17 source files + configs, `npx tsc --noEmit`, and a line-level diff of `mobile/src/lib/{queries,types,format}.ts` against the current web `src/lib/` versions plus `src/lib/notifications/dispatch.ts`.

**Scaffold snapshot:** 34 tracked files, ~2,300 LOC of app code. Built in commits `fe5fd96` / `cd43f52` (March 2026), untouched since. Screens: 4 tabs (Home w/ Discover+My Games, Sales, Upcoming, Alerts), game detail, franchise detail, login. Contexts: Auth + Follow (both direct ports of the web architecture). No settings, no profile, no onboarding, no push.

---

## TypeScript check

```
$ cd mobile && npx tsc --noEmit
EXIT: 0
```

**Zero errors.** The scaffold compiles clean under `strict: true`. (TS passing says nothing about the native build — see the dependency-matrix item below, which is the real build risk.)

---

## Item-by-item assessment

### 1. Supabase connectivity — **BLOCKED** (effort: S)
`mobile/.env` holds a **legacy JWT anon key** (`eyJ...` prefix, confirmed; value not reproduced here). Supabase disabled legacy JWT API keys for this project on 2026-08-03 (documented incident — the same event that broke the website until `sb_publishable_...` was swapped in). **The mobile app as configured cannot connect to the database at all — every query 401s.** One-line fix: put the current `sb_publishable_...` key in `.env`. Nothing works until this is done, so any hands-on evaluation of the scaffold today would misleadingly look "completely broken" for a trivial reason. (`.env` is correctly gitignored; only `.env.example` is tracked — no secret-in-repo issue.)

### 2. Dependency matrix internally inconsistent — **BLOCKED** for native builds (effort: S–M)
`package.json` pins `expo ~54.0.0` (installed: **54.0.33**) with `react-native 0.77.1` and `react 18.3.1`. But Expo 54.0.33's own `bundledNativeModules.json` (checked offline in node_modules) expects **react-native 0.81.5 and react 19.1.0**. `tsc` doesn't care; a native build (`expo run:ios` / EAS) very likely fails or misbehaves with this pairing, and `npx expo install --check` would flag it immediately. First real action on this scaffold is `npx expo install --fix` and absorbing the React 18→19 / RN 0.77→0.81 bump. The app code is small and idiomatic (no legacy-React patterns, no custom native code, only the expo-router config plugin), so the bump is mechanical, but it must happen before anything else.

### 3. Expo SDK currency (Aug 2026) — **decision-needed / unknown** (effort: S–M)
Cannot be determined offline whether SDK 54 is still current. What's knowable: SDK 54 shipped ~Sept 2025 and was the current stable as of Jan 2026; Expo ships ~2–3 SDK majors/year, so by Aug 2026 the current stable is plausibly SDK 55 or 56 — **unknown, verify online before building**. Practical read: SDK 54 is at most 1–2 versions behind, almost certainly still App Store-submittable in 2026, and this project's dependency surface is tiny (13 deps, one config plugin), so even a 2-version SDK jump is a small, mechanical `npx expo install expo@latest --fix` job — not a rewrite driver. Fold it into the same pass as item 2.

### 4. `queries.ts` staleness — **reusable-with-work** (effort: M)
Mobile's `queries.ts` is a faithful port of the ~March 2026 web version. Concrete gaps vs today's web `src/lib/queries.ts` (806 lines vs mobile's 370):

**Missing junk filters (would surface DLC/bundles the web now hides):**
- `getGamesOnSale`, `getTrendingGames`, `getUpcomingGames` all have `is_suppressed` filters but **no `product_type` filter** (`.or("product_type.is.null,product_type.not.in.(ADD_ON_CONTENT,BUNDLE)")`). Junk carries the deepest fake "discounts" ($0.99 costume piece = 90% off), so the mobile **Sales tab would literally lead with the junk the web spent Phase 0/1 of the 2026-08-03 audit eliminating**.
- `searchGames` is worse: **no `is_suppressed` filter at all, no `product_type` filter, no Algolia path** (plain ILIKE only). Search is the one surface where a user can actively *follow* junk — exactly the gap web audit items #14/#15 closed. A mobile user could follow an ADD_ON_CONTENT row today.
- (`getGamesByFranchise` / `getGamesByIds` are unfiltered on both platforms — parity, not staleness; follows are exempt by Bible rule.)

**Queries that exist on web but not mobile** (needed to reach feature parity with current UX): `getUnreadAlertCount` (mobile's tab badge instead re-runs the **full `getAlerts` query** just for a count — the exact anti-pattern web audit #4 fixed), `dismissAlerts` / `markAllAlertsRead` (bulk-dismiss UX), `getLastPriceCheckTimestamp` (the Bible-mandated "checked X min ago" stamp), `getRecentReleases` / `getUpcomingGamesSoon` / `getUnannouncedUpcomingGames` (precision-aware Upcoming with Nintendo-IP tiering), `getPopularGames`, `getGameFollowerCount`, `setTargetPrice`, owns/retro-follow queries, `setConsolePreference`, `onboardingCompleted` in `getUserProfile`.

**Missing ranking layer entirely:** no `ranking.ts` port — no `getNintendoIpTier()` / `isNintendoFirstParty()` / `getGameTier()`, so no Nintendo-first sorting anywhere. Mobile's `getTrendingGames` orders by `updated_at desc`, which after the price-poller's constant `updated_at` churn is effectively a random 100 games — the web deleted this "trending" concept in the 2026-03-22 restructure, nine days after the scaffold was written.

**Alert source labels:** mobile `getAlerts` doesn't compute `sourceLabel` (the "via {franchise}" chip; Bible: never obscure why an alert fired) and doesn't select `games.franchise`.

### 5. `types.ts` staleness — **reusable-with-work** (effort: S)
- `Game` missing: `platform`, `saleEventId`, `retroPlatform`, `hasDemo`, `genres`. (Neither web nor mobile maps `product_type` / `release_date_source` / `has_physical_release` into the client `Game` type — those are query-filter/server-side columns, so no client-type gap there.)
- `AlertType` missing `retro_game_added` (in web types) and `release_date_set` (live in `dispatch.ts getPrefColumn`; **note: web `types.ts` is also missing `release_date_set`** — a small web gap worth fixing while touching this). Mobile's `AlertCard` has a graceful unknown-type fallback config, so this degrades cosmetically, not fatally.
- `ConsolePreference` missing `"both"` (added Aug 2026 with a DB CHECK constraint migration).
- `GameAlert` missing `sourceLabel`.
- Missing interfaces: `NamedSaleEvent`, `TrailerDetection`.

### 6. `format.ts` staleness — **reusable-with-work** (effort: S)
Mobile has only the March basics (`formatPrice`, short/long date, placeholder dates). Missing everything the web added since: `getPacificDateStr()`, `getDaysUntil()` (Pacific-anchored), `getSaleEndLabel()` with urgency tiers, `isYearOnlyDate` / `isMonthOnlyDate` / `formatMonthYear` / `formatReleaseDate` (precision-aware date display — without these, mobile shows a fabricated exact date like "Dec 31, 2026" for year-only-precision IGDB dates), and `formatFreshness()`. Worse, mobile `GameCard.tsx` carries its own local `getDaysUntil` using `new Date(dateStr)` — **the exact UTC-midnight parsing bug web audit #27 fixed** (sale-end and release countdowns off by up to a day in every US timezone). Note: `formatPrice`'s `"—"` fallback glyph is the sanctioned data-glyph exception to the em-dash rule; keep it.

### 7. Copy staleness — **reusable-with-work** (effort: S)
- **Follow verb everywhere**: `FollowButton` says "Follow/Following"; empty states say "Follow games to track prices..." — the brand verb is now **Watch/Watching** (locked Spotify-era design language, Aug 2026).
- **One em dash** in user-facing copy: `login.tsx:53` — "No password needed — we'll send you a magic link". Violates the Bible's no-em-dash rule (added 2026-08-05).
- `GameCard` shows **"Free" for any $0/$0 game** — web now shows "Price TBA" for unreleased $0/$0 titles (founder fix 2026-08-05; Fortune's Weave read as free). Mobile reproduces the bug.

### 8. Design tokens / visual language — **reusable-with-work** (effort: M)
`theme.ts` colors match the base palette (bg/card/border/#00ff88), so tokens are fine. The *usage* predates two design overhauls:
- `FollowButton` "Following" state = **solid green fill + glow** — the exact pattern the founder replaced with Spotify-style outlined pills (transparent bg, hairline border, active state via border/text color + pulsing green dot, `active:scale-95`). No RadarIcon/radar identity anywhere.
- Sales sort pills use green-on-accentDim active state; tab bar active tint is green; alert unread badge is green — all superseded by the "max one solid-green element per view" rule (green reserved for prices/discounts/primary CTA).
- `AlertCard` uses emoji-prefixed type badges (🟢 PRICE DROP) — not the web's current restrained chip style; no swipe-to-dismiss, no undo toast, no "Clear all".
- No RadarSpinner, no motion language (springs, cascades), no "New for you" feed model. Home is the old Discover/My Games two-tab layout that the web **deleted on 2026-03-22** — the scaffold's information architecture is one restructure behind even the pre-Spotify web.

### 9. Auth approach — **reusable-with-work / decision-needed** (effort: M)
What's there: `signInWithOtp` (magic link) with `emailRedirectTo = Linking.createURL("auth-callback")`, manual deep-link handling that parses `#access_token`/`refresh_token` from the URL fragment and calls `setSession()`. AsyncStorage session persistence, `detectSessionInUrl: false`, `scheme: "blippd"` in app.config.ts. Assessment:
- **Internally consistent**: fragment-token parsing matches supabase-js's default implicit flow, and the RN client options are the documented correct ones. This *can* work in a standalone build.
- **Not configured server-side**: `blippd://auth-callback` (and Expo Go's `exp://.../--/auth-callback` for dev) must be in Supabase Auth's Redirect URLs allowlist — nothing in the project history suggests this was ever added. Until then the magic link redirects to the web Site URL and the app never gets the tokens.
- **Fragile against 2026 email reality**: the web project's own documented pain (PKCE/cross-context failures in Gmail/Mail in-app browsers, still an open launch-readiness item) applies *worse* on mobile, plus mail-provider link prefetching can consume one-time links. The 2026-standard Expo answer is **email OTP code entry** (`signInWithOtp` without redirect + `verifyOtp` with the 6-digit code): no deep link, no allowlist, no in-app-browser problem, works in Expo Go. The login screen has no OTP-code path — recommend adding it as the primary flow and keeping the deep link as a nice-to-have.
- Minor: no AppState-driven `startAutoRefresh()`/`stopAutoRefresh()` (the recommended RN pattern so token refresh doesn't run backgrounded).

### 10. Push notifications — **MISSING** (effort: L, and server-side too)
No `expo-notifications`, no token registration, no permission flow, nothing. Per Bible Addendum 2, **real push is the entire justification for building the iOS app at all** ("the actual hero moment — not 'our website, installed'"). This is net-new work regardless of scaffold-vs-regenerate, and more than half of it is server-side: `dispatch.ts` only knows email + web push; it would need an Expo push token table and an Expo Push API (or APNs) send path, plus dedup/logging in `notification_log` (a new `channel` value). The scaffold gives zero head start here.

### 11. Distribution scaffolding — **missing** (effort: S–M)
No `eas.json`, no EAS `projectId` in app config, no build profiles. Bundle IDs are set (`app.blippd.mobile` iOS/Android), icons/splash exist. Needs `eas init` + Apple Developer account ($99/yr — the recurring cost the retention gate exists to justify) before anything reaches a phone that isn't the founder's simulator.

### 12. What's genuinely still good — **ready**
- `AuthContext`/`FollowContext`: same architecture as web, optimistic follow toggles with rollback, singleton client (respects the documented singleton rule). Direct reuse.
- `useSupabaseQuery` hook with stale-request guard: fine.
- Screen skeletons, navigation shape (expo-router file routes, typed routes), safe-area handling, haptics on follow (matches web's `navigator.vibrate`), game/franchise detail structure, alert grouping (today/yesterday/this week/earlier): all reusable frames.
- `tsconfig` strict + `@/*` alias mirrors web conventions; `.env` correctly gitignored; `.vercelignore` already excludes `mobile/` from web builds.

---

## Verdict: **build on this scaffold — but treat it as a frame, not a feature set**

Reasoning:
1. **Regenerating buys nothing architectural.** A fresh Expo scaffold would land on the same stack (expo-router, supabase-js, AsyncStorage, the same contexts), and the existing one compiles clean under strict TS with sane patterns. The parts that are stale (queries/types/format, copy, button styling) are exactly the parts that are *cheap to re-port from web* because mobile deliberately mirrors web's `src/lib` structure file-for-file — it's a diff-and-copy job, not a redesign.
2. **The expensive work is identical either way.** Push notifications (client + server), the Spotify/Watch design skin, the "New for you" Home feed, EAS setup, and the SDK/React-19 bump are net-new whether you keep or regenerate. Scaffold choice doesn't move that cost.
3. **But do not ship any screen as-is.** Every list surface is missing the `product_type` junk filter (Sales would lead with DLC), search lets users follow junk, countdowns carry the fixed-on-web UTC date bug, the verb is wrong app-wide, and Home's IA is two restructures old. The scaffold's *content layer* is a snapshot of a codebase state the last five months of incident-driven fixes were specifically about escaping.

**Sequenced first steps if/when this activates** (it stays gated behind the retention gate per the Bible — 10+ week-2 returners or ≥25% week-2 return rate):
1. Swap `.env` to the `sb_publishable_` key (item 1) — nothing runs without it.
2. `npx expo install --fix` (+ check current stable SDK online, item 2/3) and absorb React 19/RN 0.81.
3. Re-port `queries.ts` / `types.ts` / `format.ts` wholesale from web (items 4–6) — don't patch the old ones incrementally.
4. Add OTP-code login path + Supabase redirect allowlist (item 9).
5. Then the real work: push (item 10), Watch/Spotify skin (items 7–8), Home feed, EAS (item 11).
