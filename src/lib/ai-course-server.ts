import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { AuthError } from "@/lib/admin-auth";
import { canAccessAdminPath } from "@/lib/admin-permissions";
import { AI_COURSE_ADMIN_PATH } from "@/lib/ai-course";
import type { AiCourseSubmission, AiCourseApplicationSummary, AiCourseApplicationList, AiCourseApplicationDetail } from "@/types/ai-course";

const TABLE = "ai_course_applications";
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
export async function submitAiCourseApplication(supabase: SupabaseClient, input: AiCourseSubmission): Promise<"created" | "replayed" | "conflict"> {
  const { requestId, ...payload } = input;
  const hash = createHash("sha256").update(JSON.stringify(canonical(payload))).digest("hex");
  const { error } = await supabase.from(TABLE).insert({
    request_id: requestId, payload_hash: hash, name: input.name, phone: input.phone,
    application_context: input.applicationContext, survey_answers: input.surveyAnswers,
    survey_version: input.surveyVersion, privacy_consent: input.privacyConsent, privacy_policy_version: input.privacyPolicyVersion,
  });
  if (!error) return "created";
  if (error.code !== "23505") throw new Error("AI course storage failed");
  const { data, error: lookupError } = await supabase.from(TABLE).select("payload_hash").eq("request_id", requestId).maybeSingle();
  // Another unique violation, or an unreadable record, is not a successful replay.
  if (lookupError || !data) throw new Error("AI course replay lookup failed");
  return data.payload_hash === hash ? "replayed" : "conflict";
}
export async function requireAiCourseAdmin(request: NextRequest): Promise<{ supabase: SupabaseClient; userId: string }> {
  const supabase = await createApiClient(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AuthError("로그인이 필요합니다.", 401);
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profileError) throw new Error("AI course role lookup failed");
  if (!canAccessAdminPath(profile?.role, AI_COURSE_ADMIN_PATH)) throw new AuthError("관리자 권한이 필요합니다.", 403);
  return { supabase, userId: user.id };
}
type SummaryRow = {
  id: string; name: string; phone: string; created_at: string;
  survey_answers: Pick<AiCourseSubmission["surveyAnswers"], "learningGoals">;
};
function summary(row: SummaryRow): AiCourseApplicationSummary {
  return { id: row.id, name: row.name, phone: row.phone, createdAt: row.created_at, learningGoals: row.survey_answers.learningGoals };
}
export async function listAiCourseApplications(supabase: SupabaseClient, page: number): Promise<AiCourseApplicationList> {
  const { data, error, count } = await supabase.from(TABLE)
    .select("id,name,phone,created_at,survey_answers->learningGoals", { count: "exact" })
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range((page - 1) * 25, page * 25 - 1);
  if (error?.code === "PGRST103") {
    const totalResult = await supabase.from(TABLE).select("id", { count: "exact", head: true });
    if (totalResult.error) throw new Error("AI course count failed");
    return { items: [], total: totalResult.count ?? 0, page, pageSize: 25 };
  }
  if (error) throw new Error("AI course list failed");
  // PostgREST JSON projection returns learningGoals as a top-level property.
  const items = (data ?? []).map((row) => summary({ ...row, survey_answers: { learningGoals: row.learningGoals } } as SummaryRow));
  return { items, total: count ?? 0, page, pageSize: 25 };
}
export async function getAiCourseApplication(supabase: SupabaseClient, id: string): Promise<AiCourseApplicationDetail | null> {
  const { data, error } = await supabase.from(TABLE)
    .select("id,name,phone,created_at,application_context,survey_answers,survey_version,privacy_consented_at,privacy_policy_version")
    .eq("id", id).maybeSingle();
  if (error) throw new Error("AI course detail failed");
  if (!data) return null;
  return { ...summary(data), applicationContext: data.application_context, surveyAnswers: data.survey_answers,
    surveyVersion: data.survey_version, privacyConsentedAt: data.privacy_consented_at, privacyPolicyVersion: data.privacy_policy_version };
}
