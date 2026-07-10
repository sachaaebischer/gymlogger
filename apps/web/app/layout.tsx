import "./globals.css";
import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/app/components/BottomNav";

export const metadata: Metadata = {
  title: "Coach",
  description: "Gym logger",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#080808",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-fg">
        <main className="mx-auto max-w-2xl px-4 pt-10 pb-32">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
