# DRAFT — "Date locked" email template (release_date_set)

**Status: drafted, NOT wired in. Do not connect this to `getTemplate()` in
`src/lib/notifications/templates.ts` without founder sign-off.** Per the
locked Bible rule ("any session writing or editing notification/email
templates must still prompt the founder before shipping") and the explicit
instruction for this specific feature (`docs/AUDIT-2026-08-03.md`, Phase 4
item 2): the alert type, in-app feed, and dedup guard are fully built and
live (see `generateReleaseDateSetAlert` in `src/lib/nintendo/alerts.ts`,
`getPrefColumn` in `src/lib/notifications/dispatch.ts`, and the hook in
`src/app/api/cron/sync-release-dates/route.ts`). Email is deliberately
**not** wired — `getTemplate("release_date_set")` falls through to
`default: return null`, so `sendEmailAlert` always returns `false` for this
type without sending anything, the same structural no-op already used for
`retro_game_added`. This file is the copy to review before that changes.

## What the alert is

Fires once, the moment a **followed** game's release date resolves from a
placeholder (`2099-12-31` / `2020-01-01`) to a real, IGDB-confirmed date.
Never fires on a real-date-to-real-date change (dates can still flap as
IGDB corrects itself — that's a distinct, deliberately-deferred alert
class). This converts "we don't know when this launches yet" from a silent
gap into the anticipation beat of the hero moment — the whole point of
`launch-burst-poll` is watching followed games near a predicted window, and
this is the first time a user learns there *is* a window to watch for.

## Three copy variants (matching the "Out now" / "Price drop" pattern
already drafted in the Bible Addendum — pick one, or a mix)

### A — Excited friend
**Subject:** 🔔 {game} just got a release date!
**Body:** {game} is officially locked in for {date}. Set a reminder — we'll tell you the second it's live.

### B — Quiet concierge
**Subject:** {game} now has a release date
**Body:** {game} is scheduled to release {date}. We'll let you know the moment it's actually available.

### C — Insider's nod
**Subject:** 🔔 Mark your calendar: {game}, {date}
**Body:** The wait just got a lot more specific — {game} is locked in for {date}. We'll be watching closely as it gets close.

## Draft HTML (variant A, matching the existing `releaseToday`/`announced`
template structure and color conventions exactly — swap subject/body copy
if a different variant is chosen; the layout/badge/button markup is
reusable regardless of which variant wins)

```ts
export function releaseDateSet(payload: AlertPayload): { subject: string; html: string } {
  return {
    subject: `🔔 ${payload.gameTitle} just got a release date!`,
    html: layout(`
  <div style="background:#111111;border:1px solid #222222;border-radius:12px;padding:20px;">
    <div style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:rgba(0,170,255,0.15);color:#00aaff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">RELEASE DATE SET</div>
    <h1 style="font-size:18px;font-weight:700;margin:12px 0 4px;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${payload.gameTitle}</h1>
    <p style="font-size:14px;color:#999999;margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${payload.subtext}</p>
    <a href="${gameLink(payload)}" style="display:inline-block;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;background:#111111;border:1px solid #00ff88;color:#00ff88;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">View on Blippd</a>
  </div>`,
  `${payload.gameTitle} is now scheduled — ${payload.subtext}`),
  };
}
```

(`payload.subtext` already carries `"Releasing {formatted date}"` from
`generateReleaseDateSetAlert` — the template above reuses it rather than
recomputing the date string, matching how `announced()` reuses
`payload.headline` for its body copy.)

## To ship this

1. Founder picks a copy variant (or requests changes).
2. Add the chosen `releaseDateSet` function to `templates.ts`.
3. Add `case "release_date_set": return releaseDateSet;` to `getTemplate()`.
4. Deploy. No other code changes needed — the alert-generation, dedup, and
   follower-scoping are already live and tested.
