import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { NavigationShell } from "@/components/layout/NavigationShell";
import { NoticeBanner } from "@/components/layout/NoticeBanner";
import { ChatBot } from "@/components/chat/ChatBot";
import { RootFurniture } from "@/components/layout/RootFurniture";
import { ServiceWorkerRegister } from "@/components/layout/ServiceWorkerRegister";
import { getLiturgicalDay } from "@/lib/liturgical/season";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "명성비전교회",
    template: "%s | 명성비전교회",
  },
  description: "꿈이 있는 건강한 교회 명성비전교회입니다",
  metadataBase: new URL("https://www.msvch.org"),
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
  verification: {
    other: {
      "naver-site-verification": "f4b2e36539dce9f78e02756bea7be70f110297b7",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const day = getLiturgicalDay();
  return (
    <html
      lang="ko"
      className="h-full antialiased"
      data-season={day.season}
      data-liturgy-week={day.week ?? undefined}
    >
      <head>
        {/*
         * Pretendard 자체호스팅 — CSP 가 font-src 'self' 라 CDN 은 차단된다.
         * dynamic subset: 92개 unicode-range 청크 중 페이지가 실제로 쓰는 것만 내려받는다.
         * font-family 'Pretendard Variable' 은 globals.css 의 --font-sans 첫 항목과 일치.
         */}
        <link rel="stylesheet" href="/fonts/pretendard.css" />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <ServiceWorkerRegister />
        <RootFurniture
          navigation={<NavigationShell />}
          footer={<Footer />}
          chatbot={<ChatBot />}
          noticeBanner={<NoticeBanner />}
        >
          {children}
        </RootFurniture>
      </body>
    </html>
  );
}
