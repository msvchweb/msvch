/**
 * Cloudflare R2 클라이언트 (S3 호환 API).
 *
 * 서버 전용. 시크릿을 다루므로 클라이언트 컴포넌트에서 import 하지 않는다.
 * 브라우저 업로드는 `presignPutUrl` 로 발급한 URL 을 통해서만 이뤄진다.
 */

import {
  presignUrl,
  signRequest,
  type Bytes,
  type SigV4Credentials,
} from "@/lib/r2/sign";

/** presigned 업로드 URL 만료(초). 짧게 잡아 유출 시 노출 창을 줄인다. */
export const UPLOAD_URL_TTL_SECONDS = 600;

/** 1년 + immutable. key 에 타임스탬프가 들어가 덮어쓰기가 없다는 전제. */
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/** R2 는 리전 개념이 없어 SigV4 상 `auto` 를 쓴다. */
const R2_REGION = "auto";
const R2_SERVICE = "s3";

export interface R2Config {
  credentials: SigV4Credentials;
  endpoint: string;
  bucket: string;
}

export class R2Error extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "R2Error";
    this.status = status;
  }
}

let cached: R2Config | null = null;

export function getR2Config(): R2Config {
  if (cached) return cached;

  const accountId = process.env.R2_ACCOUNT_ID ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
  const bucket = process.env.R2_BUCKET ?? "";

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new R2Error("R2 환경변수가 누락되었습니다.", 500);
  }

  cached = {
    credentials: {
      accessKeyId,
      secretAccessKey,
      region: R2_REGION,
      service: R2_SERVICE,
    },
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    bucket,
  };
  return cached;
}

function objectUrl(config: R2Config, key: string): URL {
  // key 의 각 세그먼트는 buildObjectKey 가 이미 검증했으므로 그대로 붙인다.
  return new URL(`${config.endpoint}/${config.bucket}/${key}`);
}

/**
 * 브라우저가 R2 로 직접 PUT 할 presigned URL 을 만든다.
 *
 * `headers` 는 서명에 포함되므로 클라이언트가 **동일한 값으로** 보내야 한다.
 * Cache-Control 을 여기에 넣는 이유: Vercel CDN 이 외부 rewrite 응답을 캐시할지
 * 판단할 때 이 헤더를 보기 때문에, 클라이언트 재량에 맡기면 안 된다.
 */
export async function presignPutUrl(params: {
  key: string;
  contentType: string;
  cacheControl?: string;
  expiresIn?: number;
}): Promise<{ uploadUrl: string; headers: Record<string, string> }> {
  const config = getR2Config();
  const headers: Record<string, string> = {
    "content-type": params.contentType,
    "cache-control": params.cacheControl ?? IMMUTABLE_CACHE_CONTROL,
  };

  const uploadUrl = await presignUrl({
    credentials: config.credentials,
    method: "PUT",
    url: objectUrl(config, params.key),
    expiresIn: params.expiresIn ?? UPLOAD_URL_TTL_SECONDS,
    headers,
  });

  return { uploadUrl, headers };
}

/** 서버에서 직접 업로드 (HWPX import, 회의록 이미지 추출 등). */
export async function putObject(params: {
  key: string;
  body: Bytes;
  contentType: string;
  cacheControl?: string;
}): Promise<void> {
  const config = getR2Config();
  const url = objectUrl(config, params.key);

  const headers = await signRequest({
    credentials: config.credentials,
    method: "PUT",
    url,
    headers: {
      "content-type": params.contentType,
      "cache-control": params.cacheControl ?? IMMUTABLE_CACHE_CONTROL,
    },
    body: params.body,
  });

  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: params.body,
  });

  if (!response.ok) {
    throw new R2Error(
      `R2 업로드에 실패했습니다. (${response.status})`,
      response.status,
    );
  }
}

/** 서버에서 객체 내용을 읽는다 (import-hwp-finalize 등). */
export async function getObject(key: string): Promise<Bytes> {
  const config = getR2Config();
  const url = objectUrl(config, key);

  const headers = await signRequest({
    credentials: config.credentials,
    method: "GET",
    url,
  });

  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
    throw new R2Error(
      `R2 객체를 읽지 못했습니다. (${response.status})`,
      response.status,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * 객체 삭제. R2 는 없는 키를 지워도 204 를 돌려주므로 멱등하다.
 * (DeleteObject 는 R2 무료 연산이라 호출 비용도 없다)
 */
export async function deleteObject(key: string): Promise<void> {
  const config = getR2Config();
  const url = objectUrl(config, key);

  const headers = await signRequest({
    credentials: config.credentials,
    method: "DELETE",
    url,
  });

  const response = await fetch(url, { method: "DELETE", headers });
  if (!response.ok && response.status !== 404) {
    throw new R2Error(
      `R2 객체 삭제에 실패했습니다. (${response.status})`,
      response.status,
    );
  }
}

/** 여러 객체 삭제 — 실패는 개별적으로 무시하지 않고 첫 에러를 던진다. */
export async function deleteObjects(keys: readonly string[]): Promise<void> {
  for (const key of keys) {
    await deleteObject(key);
  }
}
