/**
 * AWS Signature Version 4 — Web Crypto API 직접 구현.
 *
 * `@aws-sdk/*` 를 쓰지 않는 이유:
 *   - AGENTS.md 의 외부 라이브러리 회피 원칙
 *   - S3 클라이언트 전체를 들이면 번들이 커지고 Vercel 콜드스타트에 불리하다
 *   - 실제로 필요한 건 presigned URL 생성과 서명 헤더 계산뿐이다
 *
 * 두 가지 서명 방식을 제공한다:
 *   - `presignUrl`  — 쿼리스트링 서명. 브라우저가 R2 로 직접 PUT 할 때 사용
 *   - `signRequest` — Authorization 헤더 서명. 서버가 직접 R2 를 호출할 때 사용
 *
 * 참고: S3 는 canonical URI 를 이중 인코딩하지 않는다 (다른 AWS 서비스와 다름).
 */

const ALGORITHM = "AWS4-HMAC-SHA256";
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
const encoder = new TextEncoder();

export interface SigV4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
}

/**
 * TS 5.7 부터 `Uint8Array` 가 backing buffer 종류로 제네릭화되어
 * 기본형(`Uint8Array<ArrayBufferLike>`)은 SharedArrayBuffer 가능성 때문에
 * Web Crypto 의 `BufferSource` 에 대입되지 않는다. ArrayBuffer 로 고정한다.
 */
export type Bytes = Uint8Array<ArrayBuffer>;

// ──────────────────────────────────────────────
//  저수준 해시 헬퍼
// ──────────────────────────────────────────────

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

async function hmac(key: Bytes, data: string): Promise<Bytes> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return new Uint8Array(signature);
}

export async function sha256Hex(data: string | Bytes): Promise<string> {
  const buffer = typeof data === "string" ? encoder.encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return toHex(new Uint8Array(digest));
}

// ──────────────────────────────────────────────
//  인코딩 / 정규화
// ──────────────────────────────────────────────

/** RFC3986 percent-encoding. encodeURIComponent 가 남기는 `!'()*` 까지 인코딩한다. */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** 경로 세그먼트만 인코딩하고 `/` 는 보존한다. */
function canonicalUri(pathname: string): string {
  return pathname.split("/").map(encodeRfc3986).join("/");
}

/** 키 기준 정렬 + 키·값 모두 인코딩. */
function canonicalQuery(params: URLSearchParams): string {
  const pairs: [string, string][] = [];
  params.forEach((value, key) => pairs.push([key, value]));
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1));
  return pairs
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join("&");
}

interface NormalizedHeaders {
  canonical: string;
  signed: string;
}

/** 헤더명 소문자화 + 정렬. 값은 앞뒤 공백 제거. */
function normalizeHeaders(headers: Record<string, string>): NormalizedHeaders {
  const entries = Object.entries(headers)
    .map(([name, value]) => [name.toLowerCase(), value.trim()] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));

  return {
    canonical: entries.map(([name, value]) => `${name}:${value}\n`).join(""),
    signed: entries.map(([name]) => name).join(";"),
  };
}

interface AmzDate {
  full: string;
  short: string;
}

function amzDate(date: Date): AmzDate {
  const full = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { full, short: full.slice(0, 8) };
}

// ──────────────────────────────────────────────
//  서명 계산
// ──────────────────────────────────────────────

async function signingKey(
  credentials: SigV4Credentials,
  dateStamp: string,
): Promise<Bytes> {
  const kDate = await hmac(
    encoder.encode(`AWS4${credentials.secretAccessKey}`),
    dateStamp,
  );
  const kRegion = await hmac(kDate, credentials.region);
  const kService = await hmac(kRegion, credentials.service);
  return hmac(kService, "aws4_request");
}

async function calculateSignature(params: {
  credentials: SigV4Credentials;
  method: string;
  url: URL;
  headers: Record<string, string>;
  payloadHash: string;
  date: AmzDate;
  extraQuery?: URLSearchParams;
}): Promise<{ signature: string; signedHeaders: string; scope: string }> {
  const { credentials, method, url, headers, payloadHash, date } = params;

  const query = new URLSearchParams(url.searchParams);
  if (params.extraQuery) {
    params.extraQuery.forEach((value, key) => query.set(key, value));
  }

  const { canonical, signed } = normalizeHeaders(headers);

  const canonicalRequest = [
    method,
    canonicalUri(url.pathname),
    canonicalQuery(query),
    canonical,
    signed,
    payloadHash,
  ].join("\n");

  const scope = `${date.short}/${credentials.region}/${credentials.service}/aws4_request`;

  const stringToSign = [
    ALGORITHM,
    date.full,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const key = await signingKey(credentials, date.short);
  const signature = toHex(await hmac(key, stringToSign));

  return { signature, signedHeaders: signed, scope };
}

// ──────────────────────────────────────────────
//  공개 API
// ──────────────────────────────────────────────

export interface PresignParams {
  credentials: SigV4Credentials;
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  url: URL;
  /** 만료(초). R2 최대 604800(7일). 업로드용은 짧게 잡는다. */
  expiresIn: number;
  /**
   * 서명에 포함할 헤더. `host` 는 자동 추가된다.
   * 여기 넣은 헤더는 클라이언트가 **동일한 값으로** 보내야 한다.
   */
  headers?: Record<string, string>;
  date?: Date;
}

/**
 * 쿼리스트링 서명 presigned URL 을 만든다.
 *
 * payload hash 는 UNSIGNED-PAYLOAD 로 둔다 — 서버가 업로드될 본문을 미리 알 수 없기 때문.
 * 대신 key·크기·타입은 발급 시점에 서버가 검증하므로 임의 파일 업로드로 이어지지 않는다.
 */
export async function presignUrl(params: PresignParams): Promise<string> {
  const { credentials, method, url, expiresIn } = params;
  const date = amzDate(params.date ?? new Date());

  const headers: Record<string, string> = {
    host: url.host,
    ...(params.headers ?? {}),
  };
  const { signed } = normalizeHeaders(headers);

  const query = new URLSearchParams(url.searchParams);
  query.set("X-Amz-Algorithm", ALGORITHM);
  query.set(
    "X-Amz-Credential",
    `${credentials.accessKeyId}/${date.short}/${credentials.region}/${credentials.service}/aws4_request`,
  );
  query.set("X-Amz-Date", date.full);
  query.set("X-Amz-Expires", String(expiresIn));
  query.set("X-Amz-SignedHeaders", signed);

  const signedUrl = new URL(url.toString());
  signedUrl.search = "";

  const { signature } = await calculateSignature({
    credentials,
    method,
    url: signedUrl,
    headers,
    payloadHash: UNSIGNED_PAYLOAD,
    date,
    extraQuery: query,
  });

  // URL.search 세터에 맡기지 않고 직접 조립한다.
  // URLSearchParams.toString() 은 x-www-form-urlencoded 규칙이라 `~` → `%7E`,
  // 공백 → `+` 로 서명 계산에 쓴 RFC3986 인코딩과 어긋날 수 있다.
  return [
    signedUrl.origin,
    canonicalUri(signedUrl.pathname),
    "?",
    canonicalQuery(query),
    "&X-Amz-Signature=",
    signature,
  ].join("");
}

export interface SignRequestParams {
  credentials: SigV4Credentials;
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  url: URL;
  headers?: Record<string, string>;
  /** 본문. 없으면 빈 본문 해시를 사용한다. */
  body?: Bytes;
  date?: Date;
}

/**
 * Authorization 헤더 방식으로 서명한다. 서버 → R2 직접 호출용.
 * 반환값을 fetch 의 headers 에 그대로 넘기면 된다.
 */
export async function signRequest(
  params: SignRequestParams,
): Promise<Record<string, string>> {
  const { credentials, method, url } = params;
  const date = amzDate(params.date ?? new Date());
  const payloadHash = await sha256Hex(params.body ?? "");

  const headers: Record<string, string> = {
    ...(params.headers ?? {}),
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": date.full,
  };

  const { signature, signedHeaders, scope } = await calculateSignature({
    credentials,
    method,
    url,
    headers,
    payloadHash,
    date,
  });

  // `host` 는 서명 계산에는 반드시 들어가지만 fetch 로 넘기면 안 된다.
  // undici/브라우저 모두 host 를 forbidden header 로 취급해 무시하거나 에러를 내며,
  // 어차피 URL 로부터 동일한 값이 자동으로 붙으므로 서명은 일치한다.
  const { host: _host, ...sendable } = headers;
  void _host;

  return {
    ...sendable,
    Authorization: `${ALGORITHM} Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
