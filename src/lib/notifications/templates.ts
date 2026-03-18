import type { AlertPayload } from "./types";
import { formatPrice, formatShortDate } from "@/lib/format";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.blippd.app";

function gameLink(payload: AlertPayload): string {
  return `${APP_URL}/game/${payload.gameSlug || payload.gameId}`;
}

function eshopLink(payload: AlertPayload): string {
  if (payload.nintendoUrl) return payload.nintendoUrl;
  if (payload.nsuid) return `https://www.nintendo.com/us/store/products/${payload.nsuid}`;
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
</style>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;">
  <tr><td align="center" style="padding:24px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
      <!-- Logo -->
      <tr><td align="center" style="padding:16px 0 24px;">
        <a href="${APP_URL}" style="font-size:20px;font-weight:700;color:#ffffff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <span style="color:#00ff88;">●</span> blippd
        </a>
      </td></tr>
      <!-- Body -->
      <tr><td>
        ${body}
      </td></tr>
      <!-- Footer -->
      <tr><td align="center" style="padding:24px 0 16px;">
        <a href="${APP_URL}/alerts" style="color:#666666;font-size:12px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">View all alerts</a>
        <p style="color:#444444;font-size:11px;margin:8px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <a href="${APP_URL}" style="color:#444444;text-decoration:none;">blippd.app</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
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
  <div style="background:#111111;border:1px solid #222222;border-radius:12px;padding:20px;">
    <div style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:rgba(0,255,136,0.15);color:#00ff88;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">PRICE DROP${pctOff ? ` · ${pctOff} OFF` : ""}</div>
    <h1 style="font-size:18px;font-weight:700;margin:12px 0 4px;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${payload.gameTitle}</h1>
    <div style="margin:12px 0 16px;">
      <span style="font-size:28px;font-weight:700;color:#00ff88;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${formatPrice(payload.newPrice, "")}</span>
      <span style="font-size:14px;color:#666666;text-decoration:line-through;margin-left:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${formatPrice(payload.oldPrice, "")}</span>
      ${saved ? `<span style="font-size:13px;font-weight:600;color:#00ff88;margin-left:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Save ${saved}</span>` : ""}
    </div>
    ${endStr ? `<p style="color:#666666;font-size:13px;margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${endStr}</p>` : ""}
    <a href="${gameLink(payload)}" style="display:inline-block;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;background:#111111;border:1px solid #00ff88;color:#00ff88;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">View on Blippd</a>
    <a href="${eshopLink(payload)}" style="display:inline-block;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;background:#111111;border:1px solid #333333;color:#999999;margin-left:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Find on eShop</a>
  </div>`,
  `${payload.gameTitle} is now ${formatPrice(payload.newPrice, "")} — save ${saved}`),
  };
}

export function allTimeLow(payload: AlertPayload): { subject: string; html: string } {
  return {
    subject: `🔔 ${payload.gameTitle} — ALL TIME LOW ${formatPrice(payload.newPrice, "")}`,
    html: layout(`
  <div style="background:#111111;border:1px solid #222222;border-radius:12px;padding:20px;">
    <div style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:rgba(0,255,136,0.15);color:#00ff88;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">ALL TIME LOW</div>
    <h1 style="font-size:18px;font-weight:700;margin:12px 0 4px;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${payload.gameTitle}</h1>
    <p style="font-size:14px;color:#999999;margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Lowest price ever recorded</p>
    <div style="margin:12px 0 16px;">
      <span style="font-size:28px;font-weight:700;color:#00ff88;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${formatPrice(payload.newPrice, "")}</span>
    </div>
    <a href="${gameLink(payload)}" style="display:inline-block;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;background:#111111;border:1px solid #00ff88;color:#00ff88;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">View on Blippd</a>
    <a href="${eshopLink(payload)}" style="display:inline-block;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;background:#111111;border:1px solid #333333;color:#999999;margin-left:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Find on eShop</a>
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
  <div style="background:#111111;border:1px solid #222222;border-radius:12px;padding:20px;">
    <div style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:rgba(255,170,0,0.15);color:#ffaa00;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">SALE${discountStr ? ` · ${discountStr} OFF` : ""}</div>
    <h1 style="font-size:18px;font-weight:700;margin:12px 0 4px;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${payload.gameTitle}</h1>
    <div style="margin:12px 0 16px;">
      <span style="font-size:28px;font-weight:700;color:#ffaa00;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${formatPrice(payload.newPrice, "")}</span>
      ${endStr ? `<span style="font-size:13px;color:#666666;margin-left:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${endStr}</span>` : ""}
    </div>
    <a href="${gameLink(payload)}" style="display:inline-block;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;background:#111111;border:1px solid #00ff88;color:#00ff88;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">View on Blippd</a>
    <a href="${eshopLink(payload)}" style="display:inline-block;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;background:#111111;border:1px solid #333333;color:#999999;margin-left:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Find on eShop</a>
  </div>`,
  `${payload.gameTitle} is ${discountStr} off — now ${formatPrice(payload.newPrice, "")}`),
  };
}

export function releaseToday(payload: AlertPayload): { subject: string; html: string } {
  return {
    subject: `🔔 ${payload.gameTitle} is available now on eShop`,
    html: layout(`
  <div style="background:#111111;border:1px solid #222222;border-radius:12px;padding:20px;">
    <div style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:rgba(0,170,255,0.15);color:#00aaff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">AVAILABLE NOW</div>
    <h1 style="font-size:18px;font-weight:700;margin:12px 0 4px;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${payload.gameTitle}</h1>
    <p style="font-size:14px;color:#999999;margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Now available on Nintendo eShop</p>
    <div style="margin:12px 0 16px;">
      <span style="font-size:28px;font-weight:700;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${formatPrice(payload.newPrice, "")}</span>
    </div>
    <a href="${gameLink(payload)}" style="display:inline-block;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;background:#111111;border:1px solid #00ff88;color:#00ff88;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">View on Blippd</a>
    <a href="${eshopLink(payload)}" style="display:inline-block;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;background:#111111;border:1px solid #333333;color:#999999;margin-left:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Find on eShop</a>
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
  <div style="background:#111111;border:1px solid #222222;border-radius:12px;padding:20px;">
    <div style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:rgba(255,104,116,0.15);color:#ff6874;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">SALE ENDING${discountStr ? ` · ${discountStr} OFF` : ""}</div>
    <h1 style="font-size:18px;font-weight:700;margin:12px 0 4px;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${payload.gameTitle}</h1>
    <div style="margin:12px 0 8px;">
      <span style="font-size:28px;font-weight:700;color:#ff6874;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${formatPrice(payload.newPrice, "")}</span>
      <span style="font-size:14px;color:#666666;text-decoration:line-through;margin-left:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${formatPrice(payload.oldPrice, "")}</span>
    </div>
    <p style="color:#ff6874;font-size:13px;font-weight:600;margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Sale ends ${endStr} — don't miss it</p>
    <a href="${gameLink(payload)}" style="display:inline-block;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;background:#111111;border:1px solid #00ff88;color:#00ff88;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">View on Blippd</a>
    <a href="${eshopLink(payload)}" style="display:inline-block;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;background:#111111;border:1px solid #333333;color:#999999;margin-left:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Find on eShop</a>
  </div>`,
  `${payload.gameTitle} is ${discountStr} off but the sale ends ${endStr}`),
  };
}

export function switch2Edition(payload: AlertPayload): { subject: string; html: string } {
  return {
    subject: `🔔 ${payload.gameTitle} — Switch 2 Edition announced`,
    html: layout(`
  <div style="background:#111111;border:1px solid #222222;border-radius:12px;padding:20px;">
    <div style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:rgba(0,170,255,0.15);color:#00aaff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">SWITCH 2 EDITION</div>
    <h1 style="font-size:18px;font-weight:700;margin:12px 0 4px;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${payload.gameTitle}</h1>
    <p style="font-size:14px;color:#999999;margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">A Nintendo Switch 2 version is now available</p>
    <a href="${gameLink(payload)}" style="display:inline-block;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;background:#111111;border:1px solid #00ff88;color:#00ff88;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">View on Blippd</a>
    <a href="${eshopLink(payload)}" style="display:inline-block;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;background:#111111;border:1px solid #333333;color:#999999;margin-left:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Find on eShop</a>
  </div>`,
  `${payload.gameTitle} now has a Nintendo Switch 2 edition`),
  };
}

export function announced(payload: AlertPayload): { subject: string; html: string } {
  return {
    subject: `🔔 ${payload.gameTitle} — New announcement`,
    html: layout(`
  <div style="background:#111111;border:1px solid #222222;border-radius:12px;padding:20px;">
    <div style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:rgba(155,89,182,0.15);color:#9B59B6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">ANNOUNCEMENT</div>
    <h1 style="font-size:18px;font-weight:700;margin:12px 0 4px;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${payload.gameTitle}</h1>
    <p style="font-size:14px;color:#999999;margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${payload.headline}</p>
    <a href="${gameLink(payload)}" style="display:inline-block;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;background:#111111;border:1px solid #00ff88;color:#00ff88;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">View on Blippd</a>
    <a href="${eshopLink(payload)}" style="display:inline-block;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;background:#111111;border:1px solid #333333;color:#999999;margin-left:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Find on eShop</a>
  </div>`,
  `${payload.gameTitle} — ${payload.headline}`),
  };
}

export function namedSaleEvent(
  eventName: string,
  totalGames: number,
  saleEndDate: string | null
): { subject: string; html: string } {
  const endStr = saleEndDate ? ` · Ends ${formatShortDate(saleEndDate)}` : "";
  return {
    subject: `🔔 ${eventName} — ${totalGames} games on sale now`,
    html: layout(`
  <div style="background:#111111;border:1px solid #222222;border-radius:12px;padding:20px;">
    <div style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:rgba(255,170,0,0.15);color:#ffaa00;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">SALE EVENT</div>
    <h1 style="font-size:18px;font-weight:700;margin:12px 0 4px;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${eventName} is live</h1>
    <p style="font-size:14px;color:#999999;margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${totalGames} games on sale now, including ones you're watching${endStr}</p>
    <a href="${APP_URL}/sales" style="display:inline-block;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;background:#111111;border:1px solid #00ff88;color:#00ff88;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">See all deals →</a>
  </div>`,
    `${eventName} is live — ${totalGames} games on sale on Nintendo eShop${endStr}`),
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
