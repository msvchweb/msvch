/**
 * Node 스크립트용 R2 업로더.
 *
 * 앱(`src/lib/r2/client.ts`)과 별도로 두는 이유: 앱 쪽 모듈은 `@/` 경로 별칭과
 * Next 런타임을 전제로 하는데, 이 스크립트들은 `npx tsx` 로 단독 실행된다.
 * **서명 구현(`src/lib/r2/sign.ts`)은 공유**하므로 SigV4 로직은 한 벌뿐이다.
 */
import { signRequest, type Bytes, type SigV4Credentials } from "../../src/lib/r2/sign";

export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

interface R2Config {
  credentials: SigV4Credentials;
  endpoint: string;
  bucket: string;
  cdnBase: string;
}

let cached: R2Config | null = null;

function config(): R2Config {
  if (cached) return cached;
  const accountId = process.env.R2_ACCOUNT_ID ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
  const bucket = process.env.R2_BUCKET ?? "";
  const cdnBase = (process.env.NEXT_PUBLIC_CDN_BASE_URL ?? "").replace(/\/$/, "");

  const missing = [
    ["R2_ACCOUNT_ID", accountId],
    ["R2_ACCESS_KEY_ID", accessKeyId],
    ["R2_SECRET_ACCESS_KEY", secretAccessKey],
    ["R2_BUCKET", bucket],
    ["NEXT_PUBLIC_CDN_BASE_URL", cdnBase],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`R2 환경변수가 누락되었습니다: ${missing.join(", ")}`);
  }

  cached = {
    credentials: { accessKeyId, secretAccessKey, region: "auto", service: "s3" },
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    bucket,
    cdnBase,
  };
  return cached;
}

/** DB 에 저장할 공개 URL. 앱과 같은 규칙(`{CDN}/{key}`). */
export function publicUrlForKey(key: string): string {
  return `${config().cdnBase}/${key}`;
}

async function request(
  method: "GET" | "PUT" | "HEAD" | "DELETE",
  key: string,
  body?: Bytes,
  headers: Record<string, string> = {},
): Promise<Response> {
  const c = config();
  const url = new URL(`${c.endpoint}/${c.bucket}/${key}`);
  const signed = await signRequest({
    credentials: c.credentials,
    method,
    url,
    headers,
    body,
  });
  return fetch(url, { method, headers: signed, body });
}

export async function objectExists(key: string): Promise<boolean> {
  const res = await request("HEAD", key);
  return res.status === 200;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const res = await request("PUT", key, new Uint8Array(body), {
    "content-type": contentType,
    "cache-control": IMMUTABLE_CACHE_CONTROL,
  });
  if (!res.ok) {
    throw new Error(`R2 업로드 실패 (${res.status}): ${await res.text()}`);
  }
  return publicUrlForKey(key);
}
