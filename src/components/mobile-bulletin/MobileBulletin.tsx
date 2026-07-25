import { MobileServiceExperience } from "./MobileServiceExperience";
import { BulletinThemeShell } from "./BulletinThemeShell";
import {
  BulletinFooterLinks,
  ChurchNews,
  NextWeekServing,
  OfferingAccount,
  PrayerTopics,
} from "./MobileBulletinSections";
import { loadCommunityPrayers, loadOfferingAccount } from "@/lib/bulletin-master";
import { loadMobileBulletinRelations } from "@/lib/mobile-bulletin-data";
import { formatLiturgyLabel } from "@/lib/liturgical/format";
import { getLiturgicalDay } from "@/lib/liturgical/season";
import { createClient } from "@/lib/supabase/server";
import { MobileServicesSchema } from "@/lib/validation";
import type { Weekly } from "@/types/notice";

function PreparedState() {
  return (
    <main className="mx-auto w-full max-w-[440px]">
      <BulletinThemeShell>
        <div className="bg-[var(--bt-bg)] px-5 pb-4 pt-16 text-center">
          <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[var(--bt-ink)]">
            모바일 주보가 준비 중입니다
          </h1>
          <p className="mt-3 text-base text-[var(--bt-sub)]">
            종이 주보는 기존 주보 페이지에서 확인하실 수 있습니다.
          </p>
        </div>
        <BulletinFooterLinks />
      </BulletinThemeShell>
    </main>
  );
}

export async function MobileBulletin({ weekly }: { weekly: Weekly | null }) {
  if (!weekly) return <PreparedState />;

  const parsed = MobileServicesSchema.safeParse(weekly.mobile_services);
  if (!parsed.success || parsed.data.length === 0) return <PreparedState />;

  const services = parsed.data;
  const supabase = await createClient();
  const [relations, communityPrayers, offeringAccount] = await Promise.all([
    loadMobileBulletinRelations(supabase, services),
    loadCommunityPrayers(supabase),
    loadOfferingAccount(supabase),
  ]);
  const resourcesById = Object.fromEntries(
    Object.entries(relations.resourcesById).filter(([, resource]) => resource.is_active),
  );
  const liturgicalDate = weekly.date
    ? new Date(`${weekly.date}T00:00:00+09:00`)
    : new Date();
  const day = getLiturgicalDay(liturgicalDate);

  return (
    <main
      data-season={day.season}
      className="mx-auto w-full max-w-[440px] overflow-clip rounded-[24px]"
    >
      <BulletinThemeShell snap>
        <MobileServiceExperience
          title={weekly.title}
          date={weekly.date ?? ""}
          liturgyLabel={formatLiturgyLabel(day)}
          services={services}
          resourcesById={resourcesById}
          validVideoIds={relations.validVideoIds}
          initialNowIso={new Date().toISOString()}
        />
        <NextWeekServing
          prayer={weekly.next_week_prayer}
          offering={weekly.offering_members}
          guides={weekly.guide_committee}
        />
        <ChurchNews news={weekly.news} />
        <PrayerTopics prayers={communityPrayers} />
        <OfferingAccount account={offeringAccount} />
        <BulletinFooterLinks />
      </BulletinThemeShell>
    </main>
  );
}
