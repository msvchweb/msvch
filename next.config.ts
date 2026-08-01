import type { NextConfig } from "next";

/**
 * DB 에 저장되는 이미지 공개 URL 의 base (`https://www.msvch.org/cdn`).
 * next/image 는 절대 URL 을 원격 이미지로 취급하므로 remotePatterns 등록이 필요하고,
 * CSP img-src 에도 명시해야 로컬 개발(localhost)에서 차단되지 않는다.
 */
const CDN_BASE_URL = process.env.NEXT_PUBLIC_CDN_BASE_URL ?? "";
const cdnUrl = CDN_BASE_URL ? new URL(CDN_BASE_URL) : null;

/**
 * R2 S3 API 엔드포인트 — 브라우저가 presigned URL 로 **직접 PUT** 하는 대상이라
 * CSP `connect-src` 에 반드시 들어가야 한다. 읽기(`/cdn/…`)는 same-origin 이라
 * img-src 로 충분하지만, 쓰기는 이 호스트로 직접 나간다.
 *
 * 계정 ID 는 presigned URL 안에 이미 노출되므로 헤더에 실어도 새로 새는 정보가 없다.
 */
const r2ApiOrigin = process.env.R2_ACCOUNT_ID
  ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  : "";

const nextConfig: NextConfig = {
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium-min"],
  outputFileTracingIncludes: {
    "/api/updates": ["./UPDATES.md"],
    "/admin": ["./UPDATES.md"],
    "/admin/updates": ["./UPDATES.md"],
    "/updates": ["./UPDATES.md"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.ytimg.com" },
      // 이전 기간 동안만 유지 — 기존 Supabase URL 이 DB 에서 모두 사라지면 제거한다.
      { protocol: "https", hostname: "*.supabase.co" },
      // DB 에는 절대 URL 이 저장되므로(모바일 앱이 그대로 소비할 수 있도록)
      // next/image 가 원격 이미지로 보고 remotePatterns 를 요구한다.
      // pathname 을 /cdn/** 로 좁혀 최적화기가 다른 경로를 프록시하지 못하게 한다.
      ...(cdnUrl
        ? [
            {
              protocol: cdnUrl.protocol.replace(":", "") as "https" | "http",
              hostname: cdnUrl.hostname,
              pathname: `${cdnUrl.pathname.replace(/\/$/, "")}/**`,
            },
          ]
        : []),
    ],
  },
  /**
   * R2 공개 읽기 프록시.
   *
   * DB 에는 `https://www.msvch.org/cdn/<key>` 만 저장되고, 실제 스토리지 origin 은
   * 이 ENV 뒤에 숨는다 → 나중에 커스텀 도메인이나 Worker 로 갈아타도 DB 재작성이 없다.
   *
   * ⚠️ Vercel 은 external rewrite 응답 캐싱을 2026-04-06 이후 생성 프로젝트만
   * 기본 활성화한다. 이 프로젝트(2026-04-05 생성)는 대시보드에서 직접 켜야 하며,
   * 켜지 않으면 모든 이미지 요청이 매번 R2 로 프록시된다.
   *
   * ENV 가 없으면 rewrite 를 아예 걸지 않는다 — `undefined/...` 로 프록시되어
   * 원인을 찾기 어려운 실패가 나느니 404 로 눈에 띄게 실패하는 편이 낫다.
   */
  async rewrites() {
    const origin = process.env.R2_PUBLIC_ORIGIN?.replace(/\/$/, "");
    if (!origin) return [];
    return [{ source: "/cdn/:path*", destination: `${origin}/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' ${cdnUrl?.origin ?? ""} https://*.ytimg.com https://*.supabase.co https://lh3.googleusercontent.com https://*.kakaocdn.net data: blob:`,
              `media-src 'self' ${cdnUrl?.origin ?? ""} https://*.supabase.co`,
              // youtube-nocookie: 모바일 주보 영상. 재생 전까지 추적 쿠키를 심지 않는다.
              "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://www.google.com",
              `connect-src 'self' ${r2ApiOrigin} https://*.supabase.co https://generativelanguage.googleapis.com https://accounts.google.com https://kauth.kakao.com https://kapi.kakao.com`,
              "font-src 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "msvch.vercel.app" }],
        destination: "https://www.msvch.org/:path*",
        permanent: true,
      },
      // 기존 유지
      { source: "/post/:slug", destination: "/notice/:slug", permanent: true },
      { source: "/home-1", destination: "/", permanent: true },
      { source: "/members", destination: "/login", permanent: true },
      { source: "/teen", destination: "/churchschool/teen", permanent: true },
      { source: "/youth", destination: "/churchschool/youth", permanent: true },
      { source: "/infant", destination: "/churchschool/infant", permanent: true },
      { source: "/elementary", destination: "/churchschool/elementary", permanent: true },

      // ministry → volunteer-center
      { source: "/ministry", destination: "/volunteer-center", permanent: true },
      { source: "/ministry/:slug", destination: "/volunteer-center/:slug", permanent: true },
      { source: "/beauty", destination: "/volunteer-center/beauty", permanent: true },
      { source: "/tabletennis", destination: "/volunteer-center/tabletennis", permanent: true },
      { source: "/sidedish", destination: "/volunteer-center/sidedish", permanent: true },
      { source: "/culture", destination: "/volunteer-center/culture", permanent: true },
      { source: "/servers", destination: "/volunteer-center", permanent: true },

      // 통합
      { source: "/intro", destination: "/greetings", permanent: true },
      { source: "/timetable", destination: "/worship", permanent: true },
      { source: "/volunteer", destination: "/volunteer-center", permanent: true },

      // 기존 그룹
      { source: "/group/gongji/discussion/:id", destination: "/notice", permanent: true },
      { source: "/group/jubo/discussion/:id", destination: "/weekly", permanent: true },
    ];
  },
};

export default nextConfig;
