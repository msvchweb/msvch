/**
 * DELETE /api/storage/object
 *
 * R2 객체를 삭제한다. `keys` 또는 `urls` 로 최대 50개까지 한 번에 보낼 수 있다.
 *
 * key 마다 최상위 세그먼트에서 prefix 를 뽑아 **prefix 별로 권한을 검사한다.**
 * 하나라도 권한이 없으면 아무것도 지우지 않고 403 을 돌려준다 (부분 삭제 방지).
 */

import type { NextRequest } from "next/server";
import { AuthError } from "@/lib/admin-auth";
import { fail, ok } from "@/lib/api-response";
import { deleteObjects, R2Error } from "@/lib/r2/client";
import { keyFromPublicUrl, prefixFromKey } from "@/lib/r2/keys";
import { requireStorageWriteAccess } from "@/lib/r2/permissions";
import { StorageDeleteSchema } from "@/lib/validation";
import type { DeleteObjectsResponse, StoragePrefix } from "@/types/storage";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  try {
    const parsed = StorageDeleteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "잘못된 요청입니다.", 400);
    }

    const keys = new Set<string>(parsed.data.keys ?? []);
    for (const url of parsed.data.urls ?? []) {
      const key = keyFromPublicUrl(url);
      // 우리 CDN base 밖의 URL 은 조용히 무시한다 — 외부 URL 을 넘겨
      // 엉뚱한 객체를 지우게 만드는 시도를 차단하기 위함.
      if (key) keys.add(key);
    }

    if (keys.size === 0) {
      return ok<DeleteObjectsResponse>({ deleted: [] });
    }

    // prefix 별로 한 번씩만 권한을 확인한다.
    const prefixes = new Set<StoragePrefix>();
    for (const key of keys) {
      if (key.includes("..")) {
        return fail("허용되지 않은 key 입니다.", 400);
      }
      const prefix = prefixFromKey(key);
      if (!prefix) {
        return fail(`알 수 없는 경로입니다: ${key}`, 400);
      }
      prefixes.add(prefix);
    }

    for (const prefix of prefixes) {
      await requireStorageWriteAccess(request, prefix);
    }

    const list = [...keys];
    await deleteObjects(list);

    return ok<DeleteObjectsResponse>({ deleted: list });
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message, e.status);
    if (e instanceof R2Error) return fail(e.message, e.status);
    throw e;
  }
}
