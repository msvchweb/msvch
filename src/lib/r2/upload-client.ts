"use client";

/**
 * 브라우저 → R2 업로드 헬퍼.
 *
 * 기존 `supabase.storage.from(bucket).upload(...)` 자리를 그대로 대체한다.
 * 흐름은 3단계지만 호출부에서는 이 함수 하나만 부르면 된다:
 *   ① /api/storage/upload-url 로 presigned URL 발급 (권한 검사도 여기서)
 *   ② R2 로 직접 PUT — 파일 본문이 Vercel 함수를 통과하지 않는다
 *   ③ DB 에 저장할 공개 URL 반환
 *
 * 시크릿은 서버에만 있으므로 이 파일에는 자격증명이 등장하지 않는다.
 */

// `import type` 이므로 컴파일 시 지워진다 — api-response 의 next/server 의존이
// 클라이언트 번들로 끌려오지 않는다.
import type { ApiResult } from "@/lib/api-response";
import type {
  DeleteObjectsResponse,
  StoragePrefix,
  UploadUrlResponse,
} from "@/types/storage";

export interface UploadToR2Params {
  file: Blob;
  prefix: StoragePrefix;
  /** prefix 아래 경로 세그먼트 (앨범 id 등). `^[A-Za-z0-9_-]{1,64}$` 만 허용. */
  scope?: string[];
  /**
   * 확장자 판별용 파일명. `File` 이면 생략 가능(`file.name` 사용).
   * 순수 `Blob` 이면 반드시 넘긴다.
   */
  filename?: string;
  /** 파일명 본체를 고정해야 할 때만 (예: 포스터 버전 `v001`). */
  basename?: string;
}

export interface UploadToR2Result {
  key: string;
  publicUrl: string;
}

function resolveFilename(params: UploadToR2Params): string {
  if (params.filename) return params.filename;
  const named = params.file as File;
  if (typeof named.name === "string" && named.name.length > 0) return named.name;
  throw new Error("업로드할 파일 이름을 알 수 없습니다.");
}

/** 실패 시 사용자에게 그대로 보여줄 수 있는 한국어 메시지로 throw 한다. */
export async function uploadToR2(
  params: UploadToR2Params,
): Promise<UploadToR2Result> {
  const filename = resolveFilename(params);
  const contentType = params.file.type || "application/octet-stream";

  const issueRes = await fetch("/api/storage/upload-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prefix: params.prefix,
      scope: params.scope,
      filename,
      contentType,
      size: params.file.size,
      basename: params.basename,
    }),
  });

  const issued = (await issueRes.json()) as ApiResult<UploadUrlResponse>;
  if (!issued.ok) {
    throw new Error(issued.error);
  }

  // headers 는 서명에 포함되어 있으므로 값을 바꾸면 R2 가 403 을 돌려준다.
  const putRes = await fetch(issued.data.uploadUrl, {
    method: "PUT",
    headers: issued.data.headers,
    body: params.file,
  });

  if (!putRes.ok) {
    throw new Error(`이미지 업로드에 실패했습니다. (${putRes.status})`);
  }

  return { key: issued.data.key, publicUrl: issued.data.publicUrl };
}

/** 라우트가 한 번에 받는 최대 개수 (StorageDeleteSchema 와 동기화). */
const DELETE_BATCH_SIZE = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * R2 객체 삭제. key 또는 공개 URL 로 지정한다.
 *
 * 앨범 하나에 사진이 100장 넘는 경우가 있어 50개씩 나눠 보낸다.
 * 삭제 실패가 사용자 흐름을 막으면 안 되는 자리(업로드 롤백 등)에서는
 * 호출부에서 catch 로 무시한다.
 */
export async function deleteFromR2(params: {
  keys?: string[];
  urls?: string[];
}): Promise<string[]> {
  const batches: { keys?: string[]; urls?: string[] }[] = [
    ...chunk(params.keys ?? [], DELETE_BATCH_SIZE).map((keys) => ({ keys })),
    ...chunk(params.urls ?? [], DELETE_BATCH_SIZE).map((urls) => ({ urls })),
  ];

  const deleted: string[] = [];
  for (const batch of batches) {
    const res = await fetch("/api/storage/object", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(batch),
    });

    const body = (await res.json()) as ApiResult<DeleteObjectsResponse>;
    if (!body.ok) {
      throw new Error(body.error);
    }
    deleted.push(...body.data.deleted);
  }
  return deleted;
}
