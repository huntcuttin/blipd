import type { AlertPayload } from "./types";

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
    ? `$${(payload.oldPrice - payload.newPrice).toFixed(2)}`
    : "";

  return {
    subject: `🔔 ${payload.gameTitle} just dropped to $${payload.newPrice?.toFixed(2)}`,
    html: layout(`
  <div class="card">
    <div class="badge" style="background:rgba(0,255,136,0.15);color:#00ff88;">Price Drop${pctOff ? ` · ${pctOff} off` : ""}</div>
    <h1 class="game-title">${payload.gameTitle}</h1>
    <div class="price-row">
      <span class="price-new" style="color:#00ff88;">$${payload.newPrice?.toFixed(2)}</span>
      <span class="price-old">$${payload.oldPrice?.toFixed(2)}</span>
      ${saved ? `<span style="color:#00ff88;font-size:13px;font-weight:600;">Save ${saved}</span>` : ""}
    </div>
    <a href="${gameLink(payload)}" class="btn btn-primary">View on Blippd</a>
    <a href="${eshopLink(payload)}" class="btn btn-secondary" style="margin-left:8px;">Find on eShop</a>
  </div>`,
  `${payload.gameTitle} is now $${payload.newPrice?.toFixed(2)} — save ${saved}`),
  };
}

export function allTimeLow(payload: AlertPayload): { subject: string; html: string } {
  return {
    subject: `🔔 ${payload.gameTitle} — ALL TIME LOW $${payload.newPrice?.toFixed(2)}`,
    html: layout(`
  <div class="card">
    <div class="badge" style="background:rgba(0,255,136,0.15);color:#00ff88;">All Time Low</div>
    <h1 class="game-title">${payload.gameTitle}</h1>
    <p class="subtext">Lowest price ever recorded</p>
    <div class="price-row">
      <span class="price-new" style="color:#00ff88;">$${payload.newPrice?.toFixed(2)}</span>
    </div>
    <a href="${gameLink(payload)}" class="btn btn-primary">View on Blippd</a>
    <a href="${eshopLink(payload)}" class="btn btn-secondary" style="margin-left:8px;">Find on eShop</a>
  </div>`,
  `${payload.gameTitle} is at its lowest price ever: $${payload.newPrice?.toFixed(2)}`),
  };
}

export function saleStarted(payload: AlertPayload): { subject: string; html: string } {
  const endStr = payload.saleEndDate
    ? `Ends ${new Date(payload.saleEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : "";

  return {
    subject: `🔔 ${payload.gameTitle} is on sale — ${payload.discount}% off`,
    html: layout(`
  <div class="card">
    <div class="badge" style="background:rgba(255,170,0,0.15);color:#ffaa00;">Sale · ${payload.discount}% off</div>
    <h1 class="game-title">${payload.gameTitle}</h1>
    <div class="price-row">
      <span class="price-new" style="color:#ffaa00;">$${payload.newPrice?.toFixed(2)}</span>
      ${endStr ? `<span style="color:#666666;font-size:13px;">${endStr}</span>` : ""}
    </div>
    <a href="${gameLink(payload)}" class="btn btn-primary">View on Blippd</a>
    <a href="${eshopLink(payload)}" class="btn btn-secondary" style="margin-left:8px;">Find on eShop</a>
  </div>`,
  `${payload.gameTitle} is ${payload.discount}% off — now $${payload.newPrice?.toFixed(2)}`),
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
      <span class="price-new" style="color:#ffffff;">$${payload.newPrice?.toFixed(2)}</span>
    </div>
    <a href="${gameLink(payload)}" class="btn btn-primary">View on Blippd</a>
    <a href="${eshopLink(payload)}" class="btn btn-secondary" style="margin-left:8px;">Find on eShop</a>
  </div>`,
  `${payload.gameTitle} is available now on Nintendo eShop`),
  };
}

export function getTemplate(alertType: string): ((payload: AlertPayload) => { subject: string; html: string }) | null {
  switch (alertType) {
    case "price_drop": return priceDrop;
    case "all_time_low": return allTimeLow;
    case "sale_started": return saleStarted;
    case "release_today": return releaseToday;
    case "out_now": return releaseToday;
    default: return null;
  }
}
