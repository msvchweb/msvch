import { HeroSection } from "@/components/home/HeroSection";
import { QuickLinks } from "@/components/home/QuickLinks";
import { WorshipTimeCard } from "@/components/home/WorshipTimeCard";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { RecentNotice } from "@/components/home/RecentNotice";
import { LatestSermon } from "@/components/home/LatestSermon";
import { getHeroSlides, getNotices } from "@/lib/notices";
import { getLatestSermon } from "@/lib/sermons";
import { getUpcomingEvents } from "@/lib/events";

export const revalidate = 3600;

export default async function HomePage() {
  const [heroSlides, notices, sermon, events] = await Promise.all([
    getHeroSlides(5),
    getNotices().then((list) => list.slice(0, 5)),
    getLatestSermon(),
    getUpcomingEvents(5, 30),
  ]);

  return (
    <>
      <HeroSection slides={heroSlides} />
      <QuickLinks />
      <WorshipTimeCard />
      {events.length > 0 && <UpcomingEvents events={events} />}
      <RecentNotice notices={notices} />
      <LatestSermon sermon={sermon} />
    </>
  );
}
