import type { SupabaseClient } from "@supabase/supabase-js";

export type PosterUsageAction =
  | "build_prompt"
  | "generate_image"
  | "revise_image";

interface LogPosterUsageInput {
  supabase: SupabaseClient;
  userId: string;
  action: PosterUsageAction;
  posterTitle?: string | null;
  posterCategory?: string | null;
  posterRatio?: string | null;
}

interface ProfileSnapshot {
  name: string | null;
  email: string | null;
  role: string | null;
}

export async function logPosterUsage({
  supabase,
  userId,
  action,
  posterTitle,
  posterCategory,
  posterRatio,
}: LogPosterUsageInput): Promise<void> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, email, role")
      .eq("id", userId)
      .maybeSingle<ProfileSnapshot>();

    if (profileError) {
      console.error("poster usage profile lookup failed", profileError);
    }

    const { error } = await supabase.from("poster_usage_logs").insert({
      user_id: userId,
      user_name: profile?.name ?? null,
      user_email: profile?.email ?? null,
      user_role: profile?.role ?? null,
      action,
      poster_title: posterTitle?.trim() || null,
      poster_category: posterCategory || null,
      poster_ratio: posterRatio || null,
    });

    if (error) {
      console.error("poster usage log insert failed", error);
    }
  } catch (error) {
    console.error("poster usage log failed", error);
  }
}
