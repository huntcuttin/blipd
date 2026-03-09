import { formatPrice } from "@/lib/format";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.blippd.app";

interface DigestGame {
  title: string;
  slug: string;
  currentPrice: number;
  originalPrice: number;
  discount: number;
  isAllTimeLow: boolean;
  nsuid: string | null;
}

interface DigestData {
  salesCount: number;
  games: DigestGame[];
  totalFollowed: number;
}

function gameRow(game: DigestGame): string {
  const link = `${APP_URL}/game/${game.slug}`;
  const eshopLink = game.nsuid
    ? `https://www.nintendo.com/us/store/products/${game.nsuid}`
    : "https://www.nintendo.com/us/store/";
  const atlBadge = game.isAllTimeLow
    ? ' <span style="color:#FFD700;font-size:10px;font-weight:700;">ALL TIME LOW</span>'
    : "";

  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #222222;">
        <a href="${link}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">${game.title}</a>${atlBadge}
        <div style="margin-top:4px;">
          <span style="color:#00ff88;font-size:16px;font-weight:700;">${formatPrice(game.currentPrice, "")}</span>
          <span style="color:#666666;font-size:13px;text-decoration:line-through;margin-left:6px;">${formatPrice(game.originalPrice, "")}</span>
          <span style="color:#00ff88;font-size:12px;font-weight:600;margin-left:6px;">-${game.discount}%</span>
        </div>
        <div style="margin-top:6px;">
          <a href="${link}" style="color:#00ff88;font-size:12px;text-decoration:none;">View on Blippd</a>
          <span style="color:#333333;margin:0 6px;">·</span>
          <a href="${eshopLink}" style="color:#666666;font-size:12px;text-decoration:none;">eShop</a>
        </div>
      </td>
    </tr>`;
}

export function weeklyDigest(data: DigestData): { subject: string; html: string } {
  const { salesCount, games, totalFollowed } = data;

  const subject = salesCount > 0
    ? `📊 Your weekly roundup — ${salesCount} game${salesCount !== 1 ? "s" : ""} you follow ${salesCount !== 1 ? "are" : "is"} on sale`
    : `📊 Your weekly roundup from Blippd`;

  const gameRows = games.map(gameRow).join("");

  const salesSection = games.length > 0
    ? `
    <div style="background:#111111;border:1px solid #222222;border-radius:12px;padding:20px;margin-bottom:16px;">
      <h2 style="color:#ffffff;font-size:16px;font-weight:700;margin:0 0 12px;">Games you follow on sale</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${gameRows}
      </table>
    </div>`
    : `
    <div style="background:#111111;border:1px solid #222222;border-radius:12px;padding:20px;margin-bottom:16px;">
      <h2 style="color:#ffffff;font-size:16px;font-weight:700;margin:0 0 8px;">No sales this week</h2>
      <p style="color:#888888;font-size:14px;margin:0;">None of the ${totalFollowed} game${totalFollowed !== 1 ? "s" : ""} you follow ${totalFollowed !== 1 ? "are" : "is"} on sale right now. We'll alert you the moment that changes.</p>
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Blippd Weekly Digest</title>
<style>
  body { margin:0; padding:0; background:#0a0a0a; color:#ffffff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  .preheader { display:none!important; max-height:0; overflow:hidden; mso-hide:all; }
</style>
</head>
<body>
<div class="preheader">${salesCount > 0 ? `${salesCount} of your followed games are on sale` : "Your weekly update from Blippd"}</div>
<div style="max-width:480px;margin:0 auto;padding:24px 16px;">
  <div style="text-align:center;padding:16px 0 24px;">
    <a href="${APP_URL}" style="font-size:20px;font-weight:700;color:#ffffff;text-decoration:none;"><span style="color:#00ff88;">●</span> blippd</a>
    <p style="color:#666666;font-size:13px;margin:8px 0 0;">Your weekly price roundup</p>
  </div>

  ${salesSection}

  <div style="text-align:center;padding:16px 0;">
    <a href="${APP_URL}/sales" style="display:inline-block;padding:10px 24px;border-radius:8px;background:#111111;border:1px solid #00ff88;color:#00ff88;font-size:14px;font-weight:600;text-decoration:none;">Browse all sales</a>
  </div>

  <div style="text-align:center;padding:16px 0;">
    <p style="color:#444444;font-size:11px;margin:0;">
      You're receiving this because you follow ${totalFollowed} game${totalFollowed !== 1 ? "s" : ""} on Blippd.
    </p>
    <p style="color:#444444;font-size:11px;margin:4px 0 0;">
      <a href="${APP_URL}" style="color:#666666;text-decoration:none;">blippd.app</a>
    </p>
  </div>
</div>
</body>
</html>`;

  return { subject, html };
}
