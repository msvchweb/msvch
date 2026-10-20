import { z } from "zod";
import {
  manualAuthorization,
  envRequired,
  parseInstagramAuthorization,
  INSTAGRAM_SCOPES,
} from "./lib/oauth";
import {
  encryptSecret,
  instagramBase,
  saveConnection,
} from "./publish/credentials";
const scopes = INSTAGRAM_SCOPES;
async function main() {
  const appId = envRequired("INSTAGRAM_APP_ID"),
    secret = envRequired("INSTAGRAM_APP_SECRET"),
    redirect = envRequired("INSTAGRAM_REDIRECT_URI"),
    expected = envRequired("INSTAGRAM_ACCOUNT_ID"),
    base = instagramBase();
  encryptSecret({}, "key-check");
  const code = await manualAuthorization((state) => {
    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirect,
      response_type: "code",
      scope: scopes.join(","),
      state,
      enable_fb_login: "0",
      force_reauth: "true",
    }).toString();
    return url.toString();
  }, redirect);
  const form = new FormData();
  for (const [key, value] of Object.entries({
    client_id: appId,
    client_secret: secret,
    grant_type: "authorization_code",
    redirect_uri: redirect,
    code,
  }))
    form.set(key, value);
  const short = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30000),
  });
  if (!short.ok) throw new Error("instagram_code_exchange_failed");
  const token = parseInstagramAuthorization(await short.text());
  const exchange = new URL("https://graph.instagram.com/access_token");
  exchange.search = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: secret,
    access_token: token.accessToken,
  }).toString();
  const long = await fetch(exchange, { signal: AbortSignal.timeout(30000) });
  if (!long.ok) throw new Error("instagram_long_token_failed");
  const credentials = z
    .object({ access_token: z.string(), expires_in: z.number().positive() })
    .parse(await long.json());
  const headers = { Authorization: "Bearer " + credentials.access_token };
  const me = await fetch(base + "/me?fields=user_id,username,account_type", {
    headers,
    signal: AbortSignal.timeout(30000),
  });
  if (!me.ok) throw new Error("instagram_account_validation_failed");
  const account = z
    .object({
      user_id: z.string(),
      account_type: z.enum(["BUSINESS", "MEDIA_CREATOR", "CREATOR"]),
    })
    .parse(await me.json());
  if (account.user_id !== expected || token.userId !== expected)
    throw new Error("instagram_account_mismatch");
  await saveConnection("instagram", expected, {
    accessToken: credentials.access_token,
    accountType: account.account_type,
    scopes: token.scopes,
    expiresAt: new Date(
      Date.now() + credentials.expires_in * 1000,
    ).toISOString(),
  });
  console.log(
    "Instagram 계정 연결을 암호화 저장했습니다. 실제 릴스 게시 전 담당자가 대상 계정과 영상을 확인하세요.",
  );
}
main().catch(() => {
  console.error(
    "Instagram 연결에 실패했습니다. Instagram Login 앱·HTTPS redirect·API 버전·계정·게시 권한을 확인하세요. 비밀 응답은 출력하지 않았습니다.",
  );
  process.exitCode = 1;
});
