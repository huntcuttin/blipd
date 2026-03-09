import { formatPrice, formatShortDate } from "@/lib/format";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.blippd.app";

export interface BatchAlertGame {
  title: string;
  slug: string;
  newPrice: number;
  oldPrice: number;
  discount: number;
  alertType: string;
  saleEndDate?: string | null;
  nsuid?: string | null;
}

function alertBadge(type: string): { label: string; color: string; bg: string } {
  switch (type) {
    case "price_drop": return { label: "Price Drop", color: "#00ff88", bg: "rgba(0,255,136,0.15)" };
    case "all_time_low": return { label: "All Time Low", color: "#FFD700", bg: "rgba(255,215,0,0.15)" };
    case "sale_started": return { label: "Sale", color: "#ffaa00", bg: "rgba(255,170,0,0.15)" };
    case "sale_ending": return { label: "Ending Soon", color: "#ff6874", bg: "rgba(255,104,116,0.15)" };
    default: return { label: "Alert", color: "#00ff88", bg: "rgba(0,255,136,0.15)" };
  }
}

function gameRow(game: BatchAlertGame): string {
  const link = `${APP_URL}/game/${game.slug}`;
  const badge = alertBadge(game.alertType);
  const endStr = game.saleEndDate ? ` · Ends ${formatShortDate(game.saleEndDate)}` : "";

  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #222222;">
        <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;background:${badge.bg};color:${badge.color};text-transform:uppercase;letter-spacing:0.3px;">${badge.label}</span>
        <a href="${link}" style="display:block;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;margin-top:4px;">${game.title}</a>
        <div style="margin-top:4px;">
          <span style="color:#00ff88;font-size:16px;font-weight:700;">${formatPrice(game.newPrice, "")}</span>
          <span style="color:#666666;font-size:13px;text-decoration:line-through;margin-left:6px;">${formatPrice(game.oldPrice, "")}</span>
          ${game.discount ? `<span style="color:#00ff88;font-size:12px;font-weight:600;margin-left:6px;">-${game.discount}%</span>` : ""}
          ${endStr ? `<span style="color:#666666;font-size:11px;margin-left:6px;">${endStr}</span>` : ""}
        </div>
      </td>
    </tr>`;
}

export function batchedAlerts(games: BatchAlertGame[]): { subject: string; html: string } {
  const count = games.length;
  const subject = `🔔 ${count} games you follow just dropped in price`;

  const gameRows = games
    .sort((a, b) => b.discount - a.discount)
    .slice(0, 15)
    .map(gameRow)
    .join("");

  const moreText = count > 15 ? `<p style="color:#666666;font-size:13px;text-align:center;margin:12px 0 0;">+ ${count - 15} more — view all on Blippd</p>` : "";

  const html = `<!DOCTYPE html>
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
<div class="preheader">${count} games you follow just dropped in price</div>
<div style="max-width:480px;margin:0 auto;padding:24px 16px;">
  <div style="text-align:center;padding:16px 0 24px;">
    <a href="${APP_URL}" style="font-size:20px;font-weight:700;color:#ffffff;text-decoration:none;"><span style="color:#00ff88;">●</span> blippd</a>
  </div>

  <div style="background:#111111;border:1px solid #222222;border-radius:12px;padding:20px;">
    <h1 style="color:#ffffff;font-size:18px;font-weight:700;margin:0 0 4px;">${count} price drops on games you follow</h1>
    <p style="color:#888888;font-size:13px;margin:0 0 16px;">Here's everything that changed, sorted by biggest discount.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${gameRows}
    </table>
    ${moreText}
  </div>

  <div style="text-align:center;padding:20px 0;">
    <a href="${APP_URL}/alerts" style="display:inline-block;padding:10px 24px;border-radius:8px;background:#111111;border:1px solid #00ff88;color:#00ff88;font-size:14px;font-weight:600;text-decoration:none;">View all alerts</a>
  </div>

  <div style="text-align:center;padding:16px 0;">
    <a href="${APP_URL}" style="color:#666666;font-size:12px;text-decoration:none;">blippd.app</a>
  </div>
</div>
</body>
</html>`;

  return { subject, html };
}
