import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium-min"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.ytimg.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    return [
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
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' https://*.ytimg.com https://*.supabase.co https://lh3.googleusercontent.com https://*.kakaocdn.net data: blob:",
              "media-src 'self' https://*.supabase.co",
              "frame-src https://www.youtube.com https://www.google.com",
              "connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com https://accounts.google.com https://kauth.kakao.com https://kapi.kakao.com",
              "font-src 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
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
