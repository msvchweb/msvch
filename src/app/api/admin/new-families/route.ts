import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import type {
  NewFamilyRegistration,
  NewFamilyVisitPath,
  NewFamilyFaithStatus,
  NewFamilyGender,
  NewFamilyChurchHistory,
  NewFamilyStatus,
} from "@/types/new-family";

export const dynamic = "force-dynamic";

interface NewFamilyRow {
  id: string;
  visit_paths: NewFamilyVisitPath[];
  visit_paths_etc: string | null;
  faith_status: NewFamilyFaithStatus | null;
  name: string;
  gender: NewFamilyGender;
  birth: string | null;
  age_group: string | null;
  phone: string | null;
  instagram_id: string | null;
  region: string | null;
  church_history: NewFamilyChurchHistory | null;
  church_history_etc: string | null;
  message: string | null;
  privacy_consent: boolean;
  privacy_consented_at: string;
  status: NewFamilyStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export function toDto(row: NewFamilyRow): NewFamilyRegistration {
  return {
    id: row.id,
    visitPaths: row.visit_paths ?? [],
    visitPathsEtc: row.visit_paths_etc,
    faithStatus: row.faith_status,
    name: row.name,
    gender: row.gender,
    birth: row.birth,
    ageGroup: row.age_group,
    phone: row.phone,
    instagramId: row.instagram_id,
    region: row.region,
    churchHistory: row.church_history,
    churchHistoryEtc: row.church_history_etc,
    message: row.message,
    privacyConsent: row.privacy_consent,
    privacyConsentedAt: row.privacy_consented_at,
    status: row.status,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLS =
  "id, visit_paths, visit_paths_etc, faith_status, name, gender, birth, age_group, phone, instagram_id, region, church_history, church_history_etc, message, privacy_consent, privacy_consented_at, status, admin_note, created_at, updated_at";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const supabase = await createApiClient(request);
    const { data, error } = await supabase
      .from("new_family_registrations")
      .select(SELECT_COLS)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("new-families list error", error);
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }
    return NextResponse.json(((data ?? []) as NewFamilyRow[]).map(toDto));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
