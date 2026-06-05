/**
 * POST /api/admin/weeklies/import-hwp
 *
 * .hwp(바이너리) 파일을 받아 Storage 에 업로드한 뒤 GitHub Actions workflow_dispatch 로
 * LibreOffice headless 변환 작업을 큐잉한다 (Phase 2, Q5=B).
 *
 * 비동기 흐름:
 *   1) Storage 업로드 imports/{id}.hwp + weekly_imports INSERT status='converting'
 *   2) GitHub Actions `.github/workflows/hwp-convert.yml` workflow_dispatch (GITHUB_PAT)
 *   3) Runner 가 soffice 로 .hwp → .hwpx 변환 후 imports/{id}.hwpx 업로드
 *   4) Runner 가 곧이어 POST /api/admin/weeklies/import-hwp-finalize 호출 (CRON_SECRET)
 *      → 같은 파이프라인으로 파싱 → weekly_imports.status='parsed' 갱신
 *   5) 클라이언트가 GET /api/admin/weeklies/imports/{id} 폴링으로 결과 수신
 *
 * 응답: 202 { importId, status: 'converting' }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { hasAdminAccess } from "@/lib/role-utils";

export const maxDuration = 30;

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB — .hwp 는 binary 라 .hwpx 보다 여유

interface SuccessResponse {
  importId: string;
  status: "converting";
}

interface ErrorResponse {
  error: string;
  hint?: string;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const { supabase, userId } = await requireAdmin(request);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single<{ role: string }>();
    if (!hasAdminAccess(profile?.role)) {
      return NextResponse.json<ErrorResponse>(
        { error: "admin 이상의 권한이 필요합니다." },
        { status: 403 },
      );
    }

    const fd = await request.formData();
    const fileField = fd.get("file");
    if (!fileField || typeof fileField === "string") {
      return NextResponse.json<ErrorResponse>(
        { error: "file 필드가 비어있습니다." },
        { status: 400 },
      );
    }
    const file = fileField as File;

    if (file.size === 0) {
      return NextResponse.json<ErrorResponse>(
        { error: "빈 파일입니다." },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json<ErrorResponse>(
        { error: `파일이 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB > 15MB).` },
        { status: 400 },
      );
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (ext !== "hwp") {
      return NextResponse.json<ErrorResponse>(
        {
          error: ".hwp 파일만 이 라우트로 받습니다.",
          hint: ".hwpx 는 /api/admin/weeklies/import-hwpx 로 보내 주세요.",
        },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.slice(0, 300);

    const importId = crypto.randomUUID();
    const storagePath = `imports/${importId}.hwp`;

    const { error: insertErr } = await supabase
      .from("weekly_imports")
      .insert({
        id: importId,
        uploaded_by: userId,
        file_name: fileName,
        file_path: storagePath,
        source_format: "hwp",
        status: "converting",
      });

    if (insertErr) {
      return NextResponse.json<ErrorResponse>(
        { error: `import 행 생성 실패: ${insertErr.message}` },
        { status: 500 },
      );
    }

    const { error: storageErr } = await supabase.storage
      .from("weeklies")
      .upload(storagePath, buffer, {
        contentType: "application/x-hwp",
        upsert: true,
      });
    if (storageErr) {
      await supabase
        .from("weekly_imports")
        .update({ status: "failed", error_message: `storage: ${storageErr.message}` })
        .eq("id", importId);
      return NextResponse.json<ErrorResponse>(
        { error: `Storage 업로드 실패: ${storageErr.message}` },
        { status: 500 },
      );
    }

    // ── GitHub Actions workflow_dispatch ───────────────────
    const ghToken = process.env.GITHUB_PAT;
    if (!ghToken) {
      await supabase
        .from("weekly_imports")
        .update({
          status: "failed",
          error_message: "GITHUB_PAT 환경변수가 설정되지 않았습니다.",
        })
        .eq("id", importId);
      return NextResponse.json<ErrorResponse>(
        { error: "서버 환경변수(GITHUB_PAT)가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    const dispatchRes = await fetch(
      "https://api.github.com/repos/msvchweb/msvch/actions/workflows/hwp-convert.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            importId,
            storagePath,
          },
        }),
      },
    );

    if (!dispatchRes.ok) {
      const errText = await dispatchRes.text();
      console.error("[import-hwp] dispatch failed", errText);
      await supabase
        .from("weekly_imports")
        .update({
          status: "failed",
          error_message: `GitHub Actions dispatch 실패: ${errText.slice(0, 500)}`,
        })
        .eq("id", importId);
      return NextResponse.json<ErrorResponse>(
        { error: "변환 작업 트리거에 실패했습니다." },
        { status: 502 },
      );
    }

    return NextResponse.json<SuccessResponse>(
      { importId, status: "converting" },
      { status: 202 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json<ErrorResponse>(
        { error: err.message },
        { status: err.status },
      );
    }
    console.error("[import-hwp] unexpected", err);
    return NextResponse.json<ErrorResponse>(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
