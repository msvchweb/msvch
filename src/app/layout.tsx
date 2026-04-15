import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { NavigationShell } from "@/components/layout/NavigationShell";
import { ChatBot } from "@/components/chat/ChatBot";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "명성비전교회",
    template: "%s | 명성비전교회",
  },
  description: "꿈이 있는 건강한 교회 명성비전교회입니다",
  metadataBase: new URL("https://msvch.vercel.app"),
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "48x48", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "명성비전교회",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <NavigationShell />
        <main className="flex-1 pb-14 lg:pb-0">{children}</main>
        <Footer />
        <ChatBot />
      </body>
    </html>
  );
}
