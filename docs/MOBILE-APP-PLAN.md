# Blippd iOS App — Build Plan (prepared 2026-08-05)

Prepared at the founder's request ("start preparing to build a mobile app"). Full supporting detail: `docs/audit-2026-08-05/mobile-scaffold.md` (the existing Expo scaffold, assessed file-by-file) and `docs/audit-2026-08-05/mobile-gaps.md` (server/backend/App-Store gaps, with App Store guideline text verified 2026-08-05).

**Standing context:** the Bible gates the iOS app behind the retention gate (10+ week-2 returners OR ≥25% week-2 return rate). This plan is preparation ahead of that gate — the founder can activate it whenever they choose; nothing here re-litigates the gate itself. The app's pitch, per Bible Addendum 2, is **real push notifications — the actual hero moment** — not "our website, installed."

## The verdict on the existing scaffold

**Keep `mobile/` as a frame; re-port its content layer wholesale.** It compiles clean under strict TS, mirrors web's architecture file-for-file (contexts, parameterized queries, singleton client, expo-router), and regenerating would land on the identical stack. But it is a snapshot of the March codebase: every list query is missing the junk filters the web spent August building, search would let users follow DLC, countdowns carry the UTC-midnight bug fixed on web in audit #27, the verb is "Follow" app-wide, and Home's IA is two restructures old. Nothing ships as-is; everything re-ports cheaply because mobile deliberately mirrors `src/lib`.

**What the codebase already got right for mobile (the big reuse wins):**
- Every function in `src/lib/queries.ts` takes the Supabase client as a parameter — the entire 800-line query layer transplants to React Native unchanged.
- RLS covers every mobile need (verified against the migrations + the 2026-08-02 live RLS sweep). The one locked table mobile needs (`nintendo_directs`) already has a public endpoint (`/api/directs/active`).
- `NotificationChannel` already includes `"expo_push"` — the union was future-proofed; only the implementation is missing.
- Zero analytics/tracking SDKs → truthful "Data Used to Track You: none" privacy label, no ATT prompt.

## Hard blockers found (fix before any submission)

1. **No account deletion exists anywhere** (web included) — Apple guideline 5.1.1(v) hard-requires in-app account deletion. Small build: an authenticated endpoint cloning `api/push/subscribe`'s bearer-token pattern → `auth.admin.deleteUser()`. FK cascades already exist on every user table except `notification_log` (no FK — clean up in the same endpoint).
2. **`mobile/.env` holds the legacy JWT anon key** disabled 2026-08-03 — the app cannot reach the DB at all until the `sb_publishable_` key is swapped in (one line).
3. **Dependency matrix is internally inconsistent** — RN 0.77/React 18.3 pinned against Expo SDK 54, which expects RN 0.81/React 19. `npx expo install --fix` (and check current stable SDK online) before anything else; likely mechanical, no custom native code exists.

## Build phases

### Phase 0 — server-side work that helps the web product today (do pre-gate)
These came out of the audit as wins regardless of whether the app ever ships:
- **Fix the dispatch-layer criticals** (AUDIT-2026-08-05 C1/C2: quota-error breaker + attempted≠done). Reliable dispatch is the foundation push rides on — and the email product needs it today.
- **Inline dispatch after launch-burst-poll fires an out_now alert.** `insertAndDispatch` doesn't actually dispatch; delivery waits for the 10-min cron, so the "launch-minute" alert can lag ~12 min even though burst-poll detects in ~2. One small change (call `dispatchRecentAlerts()` in the same request; it's idempotent/durable by design). This is the single highest-leverage item in the whole plan — it fixes the hero moment for email now and for push later.
- **Account deletion endpoint + a Settings row on web.** App Store blocker, but also just a thing the product should have.

### Phase 1 — revive the scaffold — MOSTLY DONE 2026-08-17
Status: steps 1, 2, 3 and 5 shipped; step 4 (auth) is built and verified, and
waits only on a founder decision about the email template
(`docs/DRAFT-auth-email-otp-template.md`). Went to Expo SDK 57 rather than
fixing SDK 54's matrix, since nothing had shipped and 54 was already three
releases behind. Verified by `expo-doctor` 21/21 and a real iOS bundle.

Original plan:
1. Swap `mobile/.env` to the `sb_publishable_` key.
2. `npx expo install --fix`, absorb React 19 / RN 0.81, bump to current stable SDK if newer.
3. Re-port `queries.ts` / `types.ts` / `format.ts` wholesale from web (don't patch incrementally) — brings junk filters, ranking/IP tiers, precision-aware dates, Pacific-anchored countdowns, `sourceLabel`, `getUnreadAlertCount`, dismiss/mark-read, freshness stamp.
4. Auth: add **email OTP code entry** (`verifyOtp`) as the primary flow — no deep link, no redirect allowlist, immune to the in-app-browser/PKCE failure mode the web has documented on itself. Dashboard: add `{{ .Token }}` to the magic-link email template. Keep the deep-link path as secondary if desired (then allowlist `blippd://auth/callback`).
5. Add AppState-driven `startAutoRefresh()`/`stopAutoRefresh()` (standard RN Supabase pattern).

### Phase 2 — push, the real feature (M–L total)
1. New `device_push_tokens` table (Expo tokens don't fit `push_subscriptions`' NOT NULL web-push columns) with the same manage-own RLS shape. **Apply via the Management API and live-verify** — missing-migration drift is this repo's most-repeated bug class. Do NOT copy the subscribe route's `onConflict: "endpoint"` user_id-reassignment bug.
2. **Expo Push Service, not direct APNs** — free at this scale, no APNs credentials in Vercel env (EAS holds the .p8), SDK handles chunking/backoff. The one obligation: poll receipts ~15 min after send to catch `DeviceNotRegistered` and delete dead tokens (cheapest: top of each `dispatch-notifications` run).
3. Wire `"expo_push"` into `channels.ts` + `send.ts`'s switch (mirror the web_push case, including the only-log-when-attempted discipline). `alertToPushPayload()` reuses as-is. Individual sends then ride the existing durable dispatch machinery for free.
4. **Digest-day decision (founder call, recommended yes):** digested alerts currently send email only — a heavy user gets zero push on the biggest sale days. Recommend one summary push per digest ("6 games you watch went on sale · up to 67% off") alongside the digest email; well inside the frequency-cap research in CLAUDE.md.

### Phase 3 — design parity (M)
Watch/Watching verb + Spotify outlined-pill language + RadarIcon/pulsing-dot states, the "New for you" Home feed (the scaffold still has the deleted Discover/My Games IA), restrained alert chips + swipe-to-dismiss/undo/Clear all, "Price TBA" not "Free" for unreleased $0 titles, the one em dash in `login.tsx:53`, no-em-dash sweep.

### Phase 4 — ship (S–M, mostly forms and waiting)
`eas init` + build profiles, Apple Developer enrollment ($99/yr), App Store Connect listing, privacy nutrition labels (inventory pre-built in mobile-gaps.md §4.3), privacy-page copy refresh (push tokens + deletion), screenshots, review (expect account-deletion and privacy labels to be the two things reviewers actually test).

## Decisions the founder owns

1. **Activate now or hold for the retention gate?** This plan works either way; Phase 0 is worth doing regardless.
2. **Auth surface:** email-OTP only (exempt from guideline 4.8's Sign-in-with-Apple mandate — verified against current guideline text) vs adding Google login (then native Sign in with Apple becomes mandatory, `expo-apple-authentication` + `signInWithIdToken`). Recommendation: email-only at v1. One check before betting on it: confirm a user who signed up via Google on web resolves to the same account when they OTP with the same email (Supabase identity-linking settings).
3. **Digest summary push** (Phase 2.4). Recommendation: yes, one per digest.
4. **Franchise alerts in the in-app feed** — the open question from the overnight log now has a forcing function: if push fires for franchise alerts, tapping the push lands on a game whose alert isn't in the feed. Resolve before the app ships.
5. **Accept the recurring costs:** $99/yr Apple membership (lapse = store removal) + ~1 forced Expo-SDK/rebuild cycle per year (EAS drops old SDKs from build infra; Apple's minimum-SDK rule; annual iOS majors). Everything else is one-time or automated (EAS free tier: 30 builds/mo is ample; APNs .p8 never expires; certs auto-regenerate at build). This is the first genuinely unavoidable break of zero-touch/free-tier-forever — exactly what the Bible predicted when it gated the app.

## Rough effort picture

Phase 0: ~a day of focused work (and it pays off immediately on web). Phases 1-2: the core build, a few focused days. Phase 3: a few days (the web components are the spec — this is porting, not designing). Phase 4: form-filling plus review latency (1-3 days typical, budget a rejection round-trip). The expensive part is not code — it's the recurring operational tax in Decision 5.
