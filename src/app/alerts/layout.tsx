import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Alerts | Blippd",
  description: "View your Nintendo eShop price alerts. See price drops, new sales, and release notifications for games you follow.",
};

export default function AlertsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
