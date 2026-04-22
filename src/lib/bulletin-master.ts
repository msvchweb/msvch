import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BulletinMasterData,
  ChurchSettingRow,
  CommunityPrayerRow,
  MokjangEntryRow,
  ServantRow,
  SupportSectionRow,
  TopicOfYearValue,
} from "@/types/bulletin-master";
import type { Weekly } from "@/types/notice";

function parseTopicOfYear(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const v = value as Partial<TopicOfYearValue>;
    if (typeof v.text === "string") return v.text;
  }
  return "";
}

/**
 * 현재 시점의 주보 마스터 데이터를 일괄 조회한다.
 * 5개 테이블 병렬 SELECT — 각 테이블 단위 RLS anon SELECT 허용.
 * 오류 시 해당 섹션은 빈 배열/문자열로 대체하여 주보 렌더링이 멈추지 않게 함.
 */
export async function loadBulletinMaster(
  supabase: SupabaseClient,
): Promise<BulletinMasterData> {
  const [topicRes, mokjangRes, servantsRes, supportsRes, prayersRes] = await Promise.all([
    supabase
      .from("church_settings")
      .select("key, value, updated_at")
      .eq("key", "topic_of_year")
      .maybeSingle(),
    supabase
      .from("mokjang_entries")
      .select("id, name, sub, year, active, updated_at")
      .eq("active", true)
      .order("id", { ascending: true }),
    supabase
      .from("servants")
      .select("id, seq, role, names, updated_at")
      .order("seq", { ascending: true }),
    supabase
      .from("support_sections")
      .select("id, seq, heading, lines, updated_at")
      .order("seq", { ascending: true }),
    supabase
      .from("community_prayers")
      .select("id, seq, text, updated_at")
      .order("seq", { ascending: true }),
  ]);

  const topicRow = (topicRes.data ?? null) as ChurchSettingRow | null;
  const mokjangRows = (mokjangRes.data ?? []) as MokjangEntryRow[];
  const servantsRows = (servantsRes.data ?? []) as ServantRow[];
  const supportsRows = (supportsRes.data ?? []) as SupportSectionRow[];
  const prayersRows = (prayersRes.data ?? []) as CommunityPrayerRow[];

  return {
    topicOfYear: parseTopicOfYear(topicRow?.value),
    mokjang: mokjangRows.map((m) => ({ id: m.id, name: m.name, sub: m.sub })),
    servants: servantsRows.map((s) => ({ role: s.role, names: s.names })),
    supports: supportsRows.map((s) => ({ heading: s.heading, lines: s.lines })),
    communityPrayers: prayersRows.map((p) => p.text),
  };
}

/** 주보 + 마스터를 동시에 로드 (공개 주보 페이지용) */
export async function loadWeeklyWithMaster(
  supabase: SupabaseClient,
  weeklyId: string,
): Promise<{ weekly: Weekly | null; master: BulletinMasterData }> {
  const [weeklyRes, master] = await Promise.all([
    supabase.from("weeklies").select("*").eq("id", weeklyId).maybeSingle(),
    loadBulletinMaster(supabase),
  ]);
  const weekly = (weeklyRes.data ?? null) as Weekly | null;
  return { weekly, master };
}
