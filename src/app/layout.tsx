import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import ProfileButton from "@/components/ProfileButton";
import { AuthProvider } from "@/lib/AuthContext";
import { FollowProvider } from "@/lib/FollowContext";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  manifest: "/manifest.json",
  title: "blippd — Never miss a Nintendo drop.",
  description: "Track Nintendo eShop prices, get alerts when they drop. Follow games, get instant price drop alerts, and never miss a sale.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "blippd — Never miss a Nintendo drop.",
    description: "Track Nintendo eShop prices, get alerts when they drop. Follow games, get instant price drop alerts, and never miss a sale.",
    url: "https://www.blippd.app",
    siteName: "blippd",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "blippd — Never miss a Nintendo drop.",
    description: "Track Nintendo eShop prices and get instant alerts when games go on sale.",
  },
  metadataBase: new URL("https://www.blippd.app"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <AuthProvider>
          <FollowProvider>
            <div className="max-w-[430px] mx-auto min-h-screen">
              <main style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>{children}</main>
            </div>
            <ProfileButton />
            <BottomNav />
            <ServiceWorkerRegistration />
          </FollowProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
