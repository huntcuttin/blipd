import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Upcoming Nintendo Switch Games | Blippd",
  description: "See what Nintendo Switch games are releasing soon. Follow upcoming titles to get notified on launch day.",
  openGraph: {
    title: "Upcoming Nintendo Switch Games | Blippd",
    description: "See what Nintendo Switch games are releasing soon.",
    type: "website",
    siteName: "Blippd",
  },
};

export default function UpcomingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
