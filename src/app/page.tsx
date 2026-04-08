import { HeroSection } from "@/components/home/HeroSection";
import { QuickLinks } from "@/components/home/QuickLinks";
import { WorshipTimeCard } from "@/components/home/WorshipTimeCard";
import { RecentNotice } from "@/components/home/RecentNotice";
import { LatestSermon } from "@/components/home/LatestSermon";
import { getNotices } from "@/lib/notices";
import { getLatestSermon } from "@/lib/youtube";

export const revalidate = 3600;

export default async function HomePage() {
  const [notices, sermon] = await Promise.all([
    getNotices().then((list) => list.slice(0, 5)),
    getLatestSermon(),
  ]);

  return (
    <>
      <HeroSection />
      <QuickLinks />
      <WorshipTimeCard />
      <RecentNotice notices={notices} />
      <LatestSermon sermon={sermon} />
    </>
  );
}
