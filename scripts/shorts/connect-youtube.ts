import { z } from "zod";
import { loopbackAuthorization, envRequired } from "./lib/oauth";
import { encryptSecret, saveConnection } from "./publish/credentials";
const scope = "https://www.googleapis.com/auth/youtube.force-ssl";
async function main() {
  const clientId = envRequired("YOUTUBE_CLIENT_ID"),
    clientSecret = envRequired("YOUTUBE_CLIENT_SECRET"),
    expected = envRequired("YOUTUBE_CHANNEL_ID");
  encryptSecret({}, "key-check");
  const auth = await loopbackAuthorization((redirect, state, challenge) => {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: "code",
      scope,
      access_type: "offline",
      prompt: "consent",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();
    return url.toString();
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: auth.code,
      redirect_uri: auth.redirectUri,
      grant_type: "authorization_code",
      code_verifier: auth.verifier,
    }),
  });
  if (!response.ok) throw new Error("OAuth 코드 교환 실패");
  const token = z
    .object({
      access_token: z.string(),
      refresh_token: z.string().min(1),
      expires_in: z.number().positive(),
      scope: z.string(),
    })
    .parse(await response.json());
  if (!token.scope.split(" ").includes(scope))
    throw new Error("YouTube 게시 권한이 부여되지 않았습니다.");
  const channel = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
    {
      headers: { Authorization: "Bearer " + token.access_token },
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!channel.ok) throw new Error("채널 확인 실패");
  const channels = z
    .object({ items: z.array(z.object({ id: z.string() })) })
    .parse(await channel.json());
  if (!channels.items.some((c) => c.id === expected))
    throw new Error("선택한 계정이 대상 교회 채널과 일치하지 않습니다.");
  await saveConnection("youtube", expected, {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    scopes: token.scope.split(" "),
    expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
  });
  console.log(
    "YouTube 계정 연결을 암호화 저장했습니다. 게시 기능은 관리자 설정에서 별도로 켭니다.",
  );
}
main().catch(() => {
  console.error(
    "YouTube 연결에 실패했습니다. 앱 설정·대상 채널·권한·DB 설정을 확인하세요. 비밀 응답은 출력하지 않았습니다.",
  );
  process.exitCode = 1;
});
