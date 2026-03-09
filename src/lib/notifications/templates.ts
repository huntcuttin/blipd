import type { AlertPayload } from "./types";
import { formatPrice, formatShortDate } from "@/lib/format";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.blippd.app";

function gameLink(payload: AlertPayload): string {
  return `${APP_URL}/game/${payload.gameSlug || payload.gameId}`;
}

function eshopLink(payload: AlertPayload): string {
  if (payload.nsuid) {
    return `https://www.nintendo.com/us/store/products/${payload.nsuid}`;
  }
  return "https://www.nintendo.com/us/store/";
}

function layout(body: string, preheader: string): string {
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
  .container { max-width:480px; margin:0 auto; padding:24px 16px; }
  .header { text-align:center; padding:16px 0 24px; }
  .logo { font-size:20px; font-weight:700; color:#ffffff; text-decoration:none; }
  .logo span { color:#00ff88; }
  .card { background:#111111; border:1px solid #222222; border-radius:12px; padding:20px; }
  .badge { display:inline-block; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }
  .game-title { font-size:18px; font-weight:700; margin:12px 0 4px; color:#ffffff; }
  .subtext { font-size:14px; color:#999999; margin:0 0 16px; }
  .price-row { display:flex; align-items:baseline; gap:8px; margin:12px 0 16px; }
  .price-new { font-size:24px; font-weight:700; }
  .price-old { font-size:14px; color:#666666; text-decoration:line-through; }
  .btn { display:inline-block; padding:10px 20px; border-radius:8px; font-size:14px; font-weight:600; text-decoration:none; text-align:center; }
  .btn-primary { background:#111111; border:1px solid #00ff88; color:#00ff88; }
  .btn-secondary { background:#111111; border:1px solid #333333; color:#999999; }
  .footer { text-align:center; padding:24px 0 16px; }
  .footer a { color:#666666; font-size:12px; text-decoration:none; }
  .footer p { color:#444444; font-size:11px; margin:8px 0 0; }
</style>
</head>
<body>
<div class="preheader">${preheader}</div>
<div class="container">
  <div class="header">
    <a href="${APP_URL}" class="logo"><span>●</span> blippd</a>
  </div>
  ${body}
  <div class="footer">
    <a href="${APP_URL}/alerts">View all alerts</a>
    <p>
      <a href="${APP_URL}">blippd.app</a>
    </p>
  </div>
</div>
</body>
</html>`;
}

export function priceDrop(payload: AlertPayload): { subject: string; html: string } {
  const pctOff = payload.discount ? `${payload.discount}%` : "";
  const saved = payload.oldPrice && payload.newPrice
    ? formatPrice(payload.oldPrice - payload.newPrice, "")
    : "";
  const endStr = payload.saleEndDate ? `Ends ${formatShortDate(payload.saleEndDate)}` : "";

  return {
    subject: `🔔 ${payload.gameTitle} just dropped to ${formatPrice(payload.newPrice, "")}`,
    html: layout(`
  <div class="card">
    <div class="badge" style="background:rgba(0,255,136,0.15);color:#00ff88;">Price Drop${pctOff ? ` · ${pctOff} off` : ""}</div>
    <h1 class="game-title">${payload.gameTitle}</h1>
    <div class="price-row">
      <span class="price-new" style="color:#00ff88;">${formatPrice(payload.newPrice, "")}</span>
      <span class="price-old">${formatPrice(payload.oldPrice, "")}</span>
      ${saved ? `<span style="color:#00ff88;font-size:13px;font-weight:600;">Save ${saved}</span>` : ""}
    </div>
    ${endStr ? `<p style="color:#666666;font-size:13px;margin:0 0 16px;">${endStr}</p>` : ""}
    <a href="${gameLink(payload)}" class="btn btn-primary">View on Blippd</a>
    <a href="${eshopLink(payload)}" class="btn btn-secondary" style="margin-left:8px;">Find on eShop</a>
  </div>`,
  `${payload.gameTitle} is now ${formatPrice(payload.newPrice, "")} — save ${saved}`),
  };
}

export function allTimeLow(payload: AlertPayload): { subject: string; html: string } {
  return {
    subject: `🔔 ${payload.gameTitle} — ALL TIME LOW ${formatPrice(payload.newPrice, "")}`,
    html: layout(`
  <div class="card">
    <div class="badge" style="background:rgba(0,255,136,0.15);color:#00ff88;">All Time Low</div>
    <h1 class="game-title">${payload.gameTitle}</h1>
    <p class="subtext">Lowest price ever recorded</p>
    <div class="price-row">
      <span class="price-new" style="color:#00ff88;">${formatPrice(payload.newPrice, "")}</span>
    </div>
    <a href="${gameLink(payload)}" class="btn btn-primary">View on Blippd</a>
    <a href="${eshopLink(payload)}" class="btn btn-secondary" style="margin-left:8px;">Find on eShop</a>
  </div>`,
  `${payload.gameTitle} is at its lowest price ever: ${formatPrice(payload.newPrice, "")}`),
  };
}

export function saleStarted(payload: AlertPayload): { subject: string; html: string } {
  const endStr = payload.saleEndDate
    ? `Ends ${formatShortDate(payload.saleEndDate)}`
    : "";
  const discountStr = payload.discount ? `${payload.discount}%` : "";

  return {
    subject: `🔔 ${payload.gameTitle} is on sale${discountStr ? ` — ${discountStr} off` : ""}`,
    html: layout(`
  <div class="card">
    <div class="badge" style="background:rgba(255,170,0,0.15);color:#ffaa00;">Sale${discountStr ? ` · ${discountStr} off` : ""}</div>
    <h1 class="game-title">${payload.gameTitle}</h1>
    <div class="price-row">
      <span class="price-new" style="color:#ffaa00;">${formatPrice(payload.newPrice, "")}</span>
      ${endStr ? `<span style="color:#666666;font-size:13px;">${endStr}</span>` : ""}
    </div>
    <a href="${gameLink(payload)}" class="btn btn-primary">View on Blippd</a>
    <a href="${eshopLink(payload)}" class="btn btn-secondary" style="margin-left:8px;">Find on eShop</a>
  </div>`,
  `${payload.gameTitle} is ${discountStr} off — now ${formatPrice(payload.newPrice, "")}`),
  };
}

export function releaseToday(payload: AlertPayload): { subject: string; html: string } {
  return {
    subject: `🔔 ${payload.gameTitle} is available now on eShop`,
    html: layout(`
  <div class="card">
    <div class="badge" style="background:rgba(0,170,255,0.15);color:#00aaff;">Available Now</div>
    <h1 class="game-title">${payload.gameTitle}</h1>
    <p class="subtext">Now available on Nintendo eShop</p>
    <div class="price-row">
      <span class="price-new" style="color:#ffffff;">${formatPrice(payload.newPrice, "")}</span>
    </div>
    <a href="${gameLink(payload)}" class="btn btn-primary">View on Blippd</a>
    <a href="${eshopLink(payload)}" class="btn btn-secondary" style="margin-left:8px;">Find on eShop</a>
  </div>`,
  `${payload.gameTitle} is available now on Nintendo eShop`),
  };
}

export function saleEnding(payload: AlertPayload): { subject: string; html: string } {
  const endStr = payload.saleEndDate ? formatShortDate(payload.saleEndDate) : "soon";
  const discountStr = payload.discount ? `${payload.discount}%` : "";

  return {
    subject: `⏰ ${payload.gameTitle} sale ends ${endStr}`,
    html: layout(`
  <div class="card">
    <div class="badge" style="background:rgba(255,104,116,0.15);color:#ff6874;">Sale Ending${discountStr ? ` · ${discountStr} off` : ""}</div>
    <h1 class="game-title">${payload.gameTitle}</h1>
    <div class="price-row">
      <span class="price-new" style="color:#ff6874;">${formatPrice(payload.newPrice, "")}</span>
      <span class="price-old">${formatPrice(payload.oldPrice, "")}</span>
    </div>
    <p style="color:#ff6874;font-size:13px;font-weight:600;margin:0 0 16px;">Sale ends ${endStr} — don't miss it</p>
    <a href="${gameLink(payload)}" class="btn btn-primary">View on Blippd</a>
    <a href="${eshopLink(payload)}" class="btn btn-secondary" style="margin-left:8px;">Find on eShop</a>
  </div>`,
  `${payload.gameTitle} is ${discountStr} off but the sale ends ${endStr}`),
  };
}

export function switch2Edition(payload: AlertPayload): { subject: string; html: string } {
  return {
    subject: `🔔 ${payload.gameTitle} — Switch 2 Edition announced`,
    html: layout(`
  <div class="card">
    <div class="badge" style="background:rgba(0,170,255,0.15);color:#00aaff;">Switch 2 Edition</div>
    <h1 class="game-title">${payload.gameTitle}</h1>
    <p class="subtext">A Nintendo Switch 2 version is now available</p>
    <a href="${gameLink(payload)}" class="btn btn-primary">View on Blippd</a>
    <a href="${eshopLink(payload)}" class="btn btn-secondary" style="margin-left:8px;">Find on eShop</a>
  </div>`,
  `${payload.gameTitle} now has a Nintendo Switch 2 edition`),
  };
}

export function announced(payload: AlertPayload): { subject: string; html: string } {
  return {
    subject: `🔔 ${payload.gameTitle} — New announcement`,
    html: layout(`
  <div class="card">
    <div class="badge" style="background:rgba(155,89,182,0.15);color:#9B59B6;">Announcement</div>
    <h1 class="game-title">${payload.gameTitle}</h1>
    <p class="subtext">${payload.headline}</p>
    <a href="${gameLink(payload)}" class="btn btn-primary">View on Blippd</a>
    <a href="${eshopLink(payload)}" class="btn btn-secondary" style="margin-left:8px;">Find on eShop</a>
  </div>`,
  `${payload.gameTitle} — ${payload.headline}`),
  };
}

export function getTemplate(alertType: string): ((payload: AlertPayload) => { subject: string; html: string }) | null {
  switch (alertType) {
    case "price_drop": return priceDrop;
    case "all_time_low": return allTimeLow;
    case "sale_started": return saleStarted;
    case "sale_ending": return saleEnding;
    case "release_today": return releaseToday;
    case "out_now": return releaseToday;
    case "switch2_edition_announced": return switch2Edition;
    case "announced": return announced;
    default: return null;
  }
}
