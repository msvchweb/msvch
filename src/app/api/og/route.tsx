import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const rawTitle =
    request.nextUrl.searchParams.get("title") ?? "명성비전교회";
  const title = rawTitle.slice(0, 100).replace(/[\x00-\x1f]/g, "");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e3a8a, #3b82f6)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.8 }}>명성비전교회</div>
        <div
          style={{ fontSize: 52, fontWeight: "bold", marginTop: 16 }}
        >
          {title}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
