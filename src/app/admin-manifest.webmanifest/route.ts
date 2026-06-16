import { NextResponse } from "next/server";
import type { MetadataRoute } from "next";

const manifest: MetadataRoute.Manifest = {
  id: "msvch-admin",
  name: "명성비전교회(관리자)",
  short_name: "관리자",
  description: "명성비전교회 직원 전용 관리 도구",
  start_url: "/admin",
  scope: "/admin",
  display: "standalone",
  background_color: "#0f172a",
  theme_color: "#fbbf24",
  icons: [
    {
      src: "/favicon.png",
      sizes: "32x32",
      type: "image/png",
    },
    {
      src: "/icon.png",
      sizes: "48x48",
      type: "image/png",
    },
    {
      src: "/icon.png",
      sizes: "192x192",
      type: "image/png",
    },
    {
      src: "/icon.png",
      sizes: "512x512",
      type: "image/png",
    },
    {
      src: "/apple-touch-icon.png",
      sizes: "180x180",
      type: "image/png",
    },
  ],
};

export function GET() {
  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
