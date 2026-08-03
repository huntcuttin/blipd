const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.blippd.app";

/**
 * Escapes text interpolated into email HTML. Game titles come from Nintendo's
 * catalog and routinely contain `&` (and occasionally angle brackets), which
 * produce invalid markup when dropped into a template raw.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The eShop product page for a game — the shortest path from "it's here" to
 * "it's mine", since Nintendo supports remote purchase to console. Falls back
 * to the US store home when a listing has no nsuid.
 */
export function eshopUrl(nsuid: string | null | undefined): string {
  return nsuid
    ? `https://www.nintendo.com/us/store/products/${nsuid}`
    : "https://www.nintendo.com/us/store/";
}

export interface ShellOptions {
  /** Hidden inbox-preview line. */
  preheader: string;
  /** Big heading inside the card. */
  heading: string;
  /** Supporting line under the heading. */
  subheading: string;
  /** Pre-rendered <tr> rows. */
  rows: string;
  /** Optional note rendered under the rows (e.g. "+ 3 more"). */
  note?: string;
  ctaLabel: string;
  ctaPath: string;
}

/**
 * Shared dark-theme wrapper for digest emails so the launch digest and the
 * price digest can't drift apart visually.
 */
export function renderDigestShell(opts: ShellOptions): string {
  const { preheader, heading, subheading, rows, note = "", ctaLabel, ctaPath } = opts;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Blippd Alert</title>
<style>
  body { margin:0; padding:0; background:#0a0a0a; color:#ffffff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  .preheader { display:none!important; max-height:0; overflow:hidden; mso-hide:all; }
</style>
</head>
<body>
<div class="preheader">${escapeHtml(preheader)}</div>
<div style="max-width:480px;margin:0 auto;padding:24px 16px;">
  <div style="text-align:center;padding:16px 0 24px;">
    <a href="${APP_URL}" style="font-size:20px;font-weight:700;color:#ffffff;text-decoration:none;"><span style="color:#00ff88;">●</span> blippd</a>
  </div>

  <div style="background:#111111;border:1px solid #222222;border-radius:12px;padding:20px;">
    <h1 style="color:#ffffff;font-size:18px;font-weight:700;margin:0 0 4px;">${escapeHtml(heading)}</h1>
    <p style="color:#888888;font-size:13px;margin:0 0 16px;">${escapeHtml(subheading)}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${rows}
    </table>
    ${note}
  </div>

  <div style="text-align:center;padding:20px 0;">
    <a href="${APP_URL}${ctaPath}" style="display:inline-block;padding:10px 24px;border-radius:8px;background:#111111;border:1px solid #00ff88;color:#00ff88;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(ctaLabel)}</a>
  </div>

  <div style="text-align:center;padding:16px 0;">
    <a href="${APP_URL}" style="color:#666666;font-size:12px;text-decoration:none;">blippd.app</a>
  </div>
</div>
</body>
</html>`;
}
