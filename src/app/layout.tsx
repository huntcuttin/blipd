import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { AuthProvider } from "@/lib/AuthContext";
import { FollowProvider } from "@/lib/FollowContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "blippd — Never miss a Nintendo drop.",
  description: "Track Nintendo eShop prices, get alerts when they drop.",
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
              <main className="pb-24" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>{children}</main>
            </div>
            <BottomNav />
          </FollowProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
