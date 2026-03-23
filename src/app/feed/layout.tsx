import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Upcoming Nintendo Switch Games | Blippd",
  description: "See what Nintendo Switch games just released and what's coming soon. Track release dates and get notified on launch day.",
  openGraph: {
    title: "Upcoming Nintendo Switch Games | Blippd",
    description: "See what's new and coming soon on Nintendo Switch.",
    type: "website",
    siteName: "Blippd",
  },
};

export default function UpcomingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
