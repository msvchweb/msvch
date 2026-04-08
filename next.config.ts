import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "prod-files-secure.s3.us-west-2.amazonaws.com" },
      { protocol: "https", hostname: "*.notion.so" },
      { protocol: "https", hostname: "*.ytimg.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
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
