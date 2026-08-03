import { formatPrice } from "@/lib/format";
import { escapeHtml, eshopUrl, renderDigestShell } from "./email-shell";

// .trim() guards against a trailing newline in the env var's stored value
// (observed live: emailed links rendered as "blippd.app\r\n/game/..." --
// most browsers silently strip the whitespace per the URL spec, but it's
// not guaranteed across every mail client, so don't rely on that leniency.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.blippd.app").trim();

/** Cap on rows rendered before the email collapses into a "+ N more" note. */
export const MAX_LAUNCH_ROWS = 15;

export interface LaunchDigestGame {
  title: string;
  slug: string;
  /** Launch price, when the poller has one. Omitted rather than shown as $0. */
  price?: number | null;
  nsuid?: string | null;
}

function launchRow(game: LaunchDigestGame): string {
  // The title links straight to the eShop product page — Nintendo supports
  // remote purchase to console, so this is the whole point of the alert.
  const link = eshopUrl(game.nsuid);
  const priceStr =
    typeof game.price === "number" && game.price > 0
      ? `<span style="color:#00ff88;font-size:16px;font-weight:700;">${formatPrice(game.price, "")}</span>`
      : "";

  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #222222;">
        <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;background:rgba(0,255,136,0.15);color:#00ff88;text-transform:uppercase;letter-spacing:0.3px;">Out Now</span>
        <a href="${link}" style="display:block;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;margin-top:4px;">${escapeHtml(game.title)}</a>
        <div style="margin-top:4px;">
          ${priceStr}
          <a href="${APP_URL}/game/${encodeURIComponent(game.slug)}" style="color:#666666;font-size:12px;text-decoration:none;margin-left:${priceStr ? "8px" : "0"};">Details</a>
        </div>
      </td>
    </tr>`;
}

/**
 * One grouped email for several games that went live in the same dispatch
 * window. Fires instead of one email per game — see ./batching.
 */
export function launchDigest(games: LaunchDigestGame[]): { subject: string; html: string } {
  const count = games.length;
  const subject = `${count} games you're waiting for are out now`;
  const preheader = `${count} games you follow just went live on the eShop`;

  const rows = games.slice(0, MAX_LAUNCH_ROWS).map(launchRow).join("");
  const hidden = count - MAX_LAUNCH_ROWS;
  const note =
    hidden > 0
      ? `<p style="color:#666666;font-size:13px;text-align:center;margin:12px 0 0;">+ ${hidden} more — view all on Blippd</p>`
      : "";

  const html = renderDigestShell({
    preheader,
    heading: `${count} games you follow are out now`,
    subheading: "They just went live on the eShop. Tap any title to open it.",
    rows,
    note,
    ctaLabel: "View all alerts",
    ctaPath: "/alerts",
  });

  return { subject, html };
}
