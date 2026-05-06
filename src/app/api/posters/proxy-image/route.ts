import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, AuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_MIME_PREFIX = "image/";

/** SSRF 방지: 내부망/루프백 호스트 차단 */
function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0") return true;
  // IPv4
  const ipv4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
  }
  // IPv6 loopback / link-local / unique-local
  if (h === "::1") return true;
  if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  return false;
}

/**
 * GET /api/posters/proxy-image?url=<encoded https url>
 *
 * 사용 의도: ChatGPT·Midjourney 결과 이미지 URL 을 받아서 같은 origin 으로 스트림.
 * 클라이언트는 이걸 <img> 로 로드해서 Canvas 에 toBlob 하기까지 CORS taint 회피.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const url = request.nextUrl.searchParams.get("url");
    if (!url) {
      return NextResponse.json({ error: "url 파라미터가 필요합니다." }, { status: 400 });
    }

    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return NextResponse.json({ error: "올바른 URL 이 아닙니다." }, { status: 400 });
    }
    if (target.protocol !== "https:" && target.protocol !== "http:") {
      return NextResponse.json({ error: "http(s) 만 허용됩니다." }, { status: 400 });
    }
    if (isPrivateHost(target.hostname)) {
      return NextResponse.json({ error: "내부망 주소는 허용되지 않습니다." }, { status: 400 });
    }

    const upstream = await fetch(target.toString(), {
      // Vercel 환경에서 redirect 따라가기 (외부 CDN 은 종종 redirect)
      redirect: "follow",
      // User-Agent 일부 CDN 이 차단하는 경우 대비
      headers: { "user-agent": "Mozilla/5.0 (compatible; msvch-poster-proxy)" },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `원격 응답 오류: ${upstream.status}` },
        { status: 502 },
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith(ALLOWED_MIME_PREFIX)) {
      const isHtml = contentType.toLowerCase().includes("text/html");
      const hint = isHtml
        ? " — 이 URL 은 웹 페이지(HTML) 입니다. 이미지를 우클릭해 'PC 에 저장' 한 뒤 '파일 업로드' 모드로 올려주세요."
        : "";
      return NextResponse.json(
        { error: `이미지가 아닙니다 (${contentType || "unknown"}).${hint}` },
        { status: 415 },
      );
    }

    const cl = upstream.headers.get("content-length");
    if (cl && Number(cl) > MAX_BYTES) {
      return NextResponse.json(
        { error: `이미지가 너무 큽니다 (${(Number(cl) / 1_048_576).toFixed(1)} MB).` },
        { status: 413 },
      );
    }

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "이미지가 너무 큽니다." }, { status: 413 });
    }

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("posters/proxy-image error", err);
    return NextResponse.json({ error: "이미지 가져오기 실패" }, { status: 500 });
  }
}
