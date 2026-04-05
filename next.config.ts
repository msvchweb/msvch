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
      { source: "/post/:slug", destination: "/notice/:slug", permanent: true },
      { source: "/group/gongji/discussion/:id", destination: "/groups/gongji", permanent: true },
      { source: "/group/jubo/discussion/:id", destination: "/groups/jubo", permanent: true },
      { source: "/home-1", destination: "/", permanent: true },
      { source: "/servers", destination: "/volunteer", permanent: true },
      { source: "/beauty", destination: "/ministry/beauty", permanent: true },
      { source: "/tabletennis", destination: "/ministry/tabletennis", permanent: true },
      { source: "/sidedish", destination: "/ministry/sidedish", permanent: true },
      { source: "/culture", destination: "/ministry", permanent: true },
      { source: "/teen", destination: "/churchschool/teen", permanent: true },
      { source: "/youth", destination: "/churchschool/youth", permanent: true },
      { source: "/infant", destination: "/churchschool/infant", permanent: true },
      { source: "/elementary", destination: "/churchschool/elementary", permanent: true },
      { source: "/members", destination: "/login", permanent: true },
    ];
  },
};

export default nextConfig;
