"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WeeklyContentInput } from "@/lib/validation";
import type { MobileService, WorshipResource } from "@/types/mobile-bulletin";
import { MobileBulletinEditor, type SermonVideoOption } from "./MobileBulletinEditor";

const RESOURCE_COLUMNS = "id,kind,title,reference,content,external_url,source_label,rights_note,is_active,created_at,updated_at";

export function MobileBulletinEditorLoader({ value, weekly, onChange }: {
  value: MobileService[];
  weekly: WeeklyContentInput;
  onChange: (next: MobileService[]) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [resources, setResources] = useState<WorshipResource[]>([]);
  const [videos, setVideos] = useState<SermonVideoOption[]>([]);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [resourceResult, videoResult] = await Promise.all([
        supabase.from("worship_resources").select(RESOURCE_COLUMNS).order("kind").order("title"),
        supabase.from("sermon_videos").select("video_id,title,published_at,category").order("published_at", { ascending: false }).limit(100),
      ]);
      if (cancelled) return;
      const messages = [resourceResult.error?.message, videoResult.error?.message].filter(Boolean);
      if (messages.length) setWarning(`선택 목록을 불러오지 못했습니다: ${messages.join(", ")}`);
      if (!resourceResult.error) setResources((resourceResult.data ?? []) as WorshipResource[]);
      if (!videoResult.error) setVideos((videoResult.data ?? []) as SermonVideoOption[]);
    }
    void load();
    return () => { cancelled = true; };
  }, [supabase]);

  return <MobileBulletinEditor value={value} weekly={weekly} resources={resources} videos={videos} onChange={onChange} warning={warning} />;
}
