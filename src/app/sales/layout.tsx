import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nintendo eShop Sales — Current Deals | Blippd",
  description: "Browse every Nintendo Switch game on sale right now. See discounts, all-time low prices, and sale end dates. Updated every 10 minutes.",
  openGraph: {
    title: "Nintendo eShop Sales — Current Deals | Blippd",
    description: "Browse every Nintendo Switch game on sale right now. Updated every 10 minutes.",
    type: "website",
    siteName: "Blippd",
  },
};

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
