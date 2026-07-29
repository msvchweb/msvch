/**
 * POST /api/storage/upload-url
 *
 * 브라우저가 R2 로 직접 PUT 할 presigned URL 을 발급한다.
 *
 * 파일 본문이 Vercel 함수를 통과하지 않으므로 함수 실행시간·대역폭을 쓰지 않는다.
 * 권한 판정은 `lib/r2/permissions.ts` 가 기존 Storage RLS 를 그대로 재현한다.
 *
 * 모바일(RN): `Authorization: Bearer <access_token>` 으로 호출하면 쿠키 없이도
 * 동일하게 동작한다 (`createApiClient` 가 Bearer/Cookie 를 양립 처리).
 */

import type { NextRequest } from "next/server";
import { AuthError } from "@/lib/admin-auth";
import { fail, ok } from "@/lib/api-response";
import { presignPutUrl, R2Error, UPLOAD_URL_TTL_SECONDS } from "@/lib/r2/client";
import { buildObjectKey, publicUrlForKey, StorageKeyError } from "@/lib/r2/keys";
import { requireStorageWriteAccess } from "@/lib/r2/permissions";
import { StorageUploadUrlSchema } from "@/lib/validation";
import type { UploadUrlResponse } from "@/types/storage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const parsed = StorageUploadUrlSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "잘못된 요청입니다.", 400);
    }
    const input = parsed.data;

    await requireStorageWriteAccess(request, input.prefix);

    const key = buildObjectKey(input);
    const { uploadUrl, headers } = await presignPutUrl({
      key,
      contentType: input.contentType,
    });

    return ok<UploadUrlResponse>({
      key,
      uploadUrl,
      publicUrl: publicUrlForKey(key),
      headers,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    });
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message, e.status);
    if (e instanceof StorageKeyError) return fail(e.message, 400);
    if (e instanceof R2Error) return fail(e.message, e.status);
    throw e;
  }
}
