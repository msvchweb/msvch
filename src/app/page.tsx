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
    <div id="home-snap">
      <section className="snap-section-hero">
        <HeroSection />
      </section>
      <section className="snap-section">
        <QuickLinks />
      </section>
      <section className="snap-section">
        <WorshipTimeCard />
      </section>
      <section className="snap-section">
        <RecentNotice notices={notices} />
      </section>
      <section className="snap-section">
        <LatestSermon sermon={sermon} />
      </section>
    </div>
  );
}
