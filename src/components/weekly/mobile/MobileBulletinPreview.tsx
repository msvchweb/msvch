"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { collectStoredResourceIds, collectStoredVideoIds } from "@/lib/mobile-bulletin";
import { formatLiturgyLabel } from "@/lib/liturgical/format";
import { getLiturgicalDay } from "@/lib/liturgical/season";
import { MobileServiceExperience } from "@/components/mobile-bulletin/MobileServiceExperience";
import { BulletinThemeShell } from "@/components/mobile-bulletin/BulletinThemeShell";
import { BulletinFooterLinks, NextWeekServing, OfferingAccount, PrayerTopics } from "@/components/mobile-bulletin/MobileBulletinSections";
import { ChurchNews } from "@/components/mobile-bulletin/ChurchNews";
import { loadCommunityPrayers, loadOfferingAccount } from "@/lib/bulletin-master";
import type { WeeklyContentInput } from "@/lib/validation";
import type { WorshipResource } from "@/types/mobile-bulletin";
import type { OfferingAccountValue } from "@/types/bulletin-master";

const RESOURCE_COLUMNS = "id,kind,title,reference,content,external_url,source_label,rights_note,is_active,created_at,updated_at";

export function MobileBulletinPreview({ weekly }: { weekly: WeeklyContentInput }) {
  const supabase = useMemo(() => createClient(), []);
  const [resourcesById, setResourcesById] = useState<Record<string, WorshipResource>>({});
  const [validVideoIds, setValidVideoIds] = useState<string[]>([]);
  const [communityPrayers, setCommunityPrayers] = useState<string[]>([]);
  const [offeringAccount, setOfferingAccount] = useState<OfferingAccountValue | null>(null);

  useEffect(() => {
    const resourceIds = collectStoredResourceIds(weekly.mobile_services);
    const videoIds = collectStoredVideoIds(weekly.mobile_services);
    let cancelled = false;

    async function loadRelations() {
      const [resources, videos, prayers, account] = await Promise.all([
        resourceIds.length
          ? supabase.from("worship_resources").select(RESOURCE_COLUMNS).in("id", resourceIds)
          : Promise.resolve({ data: [], error: null }),
        videoIds.length
          ? supabase.from("sermon_videos").select("video_id").in("video_id", videoIds)
          : Promise.resolve({ data: [], error: null }),
        loadCommunityPrayers(supabase),
        loadOfferingAccount(supabase),
      ]);
      if (cancelled) return;
      const byId: Record<string, WorshipResource> = {};
      for (const resource of (resources.data ?? []) as WorshipResource[]) byId[resource.id] = resource;
      setResourcesById(byId);
      setValidVideoIds((videos.data ?? []).map((video) => video.video_id));
      setCommunityPrayers(prayers);
      setOfferingAccount(account);
    }

    void loadRelations();
    return () => { cancelled = true; };
  }, [supabase, weekly.mobile_services]);

  const date = weekly.date ?? new Date().toISOString().slice(0, 10);
  const liturgicalDate = new Date(`${date}T12:00:00+09:00`);

  return (
    <div className="mx-auto max-w-[430px] overflow-hidden rounded-[2rem] border-8 border-stone-900 shadow-xl">
      <BulletinThemeShell>
        <MobileServiceExperience
          title={weekly.title || "주보 미리보기"}
          date={date}
          liturgyLabel={formatLiturgyLabel(getLiturgicalDay(liturgicalDate))}
          services={weekly.mobile_services}
          resourcesById={resourcesById}
          validVideoIds={validVideoIds}
          initialNowIso={new Date().toISOString()}
        />
        <NextWeekServing prayer={weekly.next_week_prayer} offering={weekly.offering_members} guides={weekly.guide_committee} />
        <ChurchNews news={weekly.news} />
        <PrayerTopics prayers={communityPrayers} />
        <OfferingAccount account={offeringAccount} />
        <BulletinFooterLinks />
      </BulletinThemeShell>
    </div>
  );
}
