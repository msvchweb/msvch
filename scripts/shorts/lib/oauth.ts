import { createServer } from "node:http";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { z } from "zod";
export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
];
export function parseInstagramAuthorization(input: unknown) {
  // Preserve numeric IDs before JSON.parse can round values beyond Number.MAX_SAFE_INTEGER.
  const raw =
    typeof input === "string"
      ? JSON.parse(
          input.replace(/("user_id"\s*:\s*)(\d+)(?=\s*[,}])/g, '$1"$2"'),
        )
      : input;
  if (
    typeof raw === "object" &&
    raw !== null &&
    "access_token" in raw &&
    "data" in raw
  )
    throw new Error("ambiguous_instagram_token");
  const schema = z.object({
    access_token: z.string().min(1),
    user_id: z.union([z.string().min(1), z.number().int().safe().positive()]),
    permissions: z.union([z.string(), z.array(z.string())]),
  });
  const wrapped = z.object({ data: z.array(schema).length(1) });
  const token =
    typeof raw === "object" && raw !== null && "data" in raw
      ? wrapped.parse(raw).data[0]
      : schema.parse(raw);
  const scopes = Array.isArray(token.permissions)
    ? token.permissions
    : token.permissions
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
  if (INSTAGRAM_SCOPES.some((scope) => !scopes.includes(scope)))
    throw new Error("instagram_publish_permission_missing");
  return {
    accessToken: token.access_token,
    userId: String(token.user_id),
    scopes,
  };
}
export function validateOAuthCallback(
  value: string,
  redirectUri: string,
  state: string,
) {
  const url = new URL(value),
    redirect = new URL(redirectUri),
    received = url.searchParams.get("state") ?? "";
  if (
    url.origin !== redirect.origin ||
    url.pathname !== redirect.pathname ||
    received.length !== state.length ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(state))
  )
    throw new Error("oauth_state_mismatch");
  const code = url.searchParams.get("code");
  if (url.searchParams.has("error") || !code || code.length > 2048)
    throw new Error("oauth_authorization_denied");
  return code;
}
export function envRequired(name: string) {
  const value = process.env[name];
  if (!value) throw new Error("설정 누락: " + name);
  return value;
}
export async function loopbackAuthorization(
  buildUrl: (redirect: string, state: string, challenge: string) => string,
) {
  const state = randomBytes(32).toString("hex"),
    verifier = randomBytes(48).toString("base64url"),
    challenge = createHash("sha256").update(verifier).digest("base64url");
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("oauth_listener_failed");
  const redirectUri = "http://127.0.0.1:" + address.port + "/callback";
  try {
    console.log(
      "브라우저에서 다음 주소로 계정을 연결하세요:\n" +
        buildUrl(redirectUri, state, challenge),
    );
    const code = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("oauth_timeout")),
        10 * 60000,
      );
      server.on("request", (req, res) => {
        try {
          const result = validateOAuthCallback(
            new URL(req.url ?? "/", redirectUri).toString(),
            redirectUri,
            state,
          );
          res.writeHead(200, {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          });
          res.end("연결 확인 중입니다. 터미널로 돌아가세요.");
          clearTimeout(timer);
          resolve(result);
        } catch {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Invalid OAuth callback.");
        }
      });
      server.once("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
    return { code, redirectUri, verifier };
  } finally {
    server.closeAllConnections();
    server.close();
  }
}
export async function manualAuthorization(
  buildUrl: (state: string) => string,
  redirectUri: string,
) {
  const redirect = new URL(redirectUri);
  if (redirect.protocol !== "https:" || redirect.search || redirect.hash)
    throw new Error("instagram_https_redirect_required");
  const state = randomBytes(32).toString("hex");
  console.log(
    "등록한 HTTPS redirect URI와 일치하는 연결 주소를 사용하세요.\n" +
      buildUrl(state),
  );
  process.stdout.write(
    "동의 후 브라우저 주소 전체를 이 터미널에 입력하세요(입력 숨김): ",
  );
  const output = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  const rl = createInterface({
    input: process.stdin,
    output,
    terminal: !!process.stdin.isTTY,
  });
  try {
    const callback = await rl.question("", {
      signal: AbortSignal.timeout(10 * 60000),
    });
    process.stdout.write("\n");
    return validateOAuthCallback(callback.trim(), redirectUri, state);
  } finally {
    rl.close();
  }
}
