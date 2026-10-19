// @vitest-environment node
import { expect, it, vi, afterEach } from "vitest";
import { encryptSecret, decryptSecret, loadConnection } from "./credentials";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("encrypts tokens with authenticated context and refuses tampering or another row", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const encoded = encryptSecret({ refreshToken: "secret" }, "youtube", key);
  expect(encoded).not.toContain("secret");
  expect(decryptSecret(encoded, "youtube", key)).toEqual({
    refreshToken: "secret",
  });
  expect(() => decryptSecret(encoded, "instagram", key)).toThrow();
  expect(() =>
    decryptSecret(encoded.slice(0, -3) + "abc", "youtube", key),
  ).toThrow();
  expect(() => encryptSecret({}, "youtube", "short")).toThrow();
});
it("marks an invalid refresh token for reconnection instead of returning stale credentials", async () => {
  const key = Buffer.alloc(32, 9).toString("base64");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://shorts-db.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
  vi.stubEnv("SHORTS_CREDENTIAL_ENCRYPTION_KEY", key);
  vi.stubEnv("YOUTUBE_CLIENT_ID", "client");
  vi.stubEnv("YOUTUBE_CLIENT_SECRET", "secret");
  const row = {
    platform: "youtube",
    account_id: "channel",
    credentials_encrypted: encryptSecret(
      {
        accessToken: "old",
        refreshToken: "revoked",
        scopes: ["https://www.googleapis.com/auth/youtube.force-ssl"],
        expiresAt: "2000-01-01T00:00:00Z",
      },
      "connection:youtube",
      key,
    ),
    expires_at: "2000-01-01T00:00:00Z",
    refreshed_at: "2000-01-01T00:00:00Z",
    status: "connected",
    updated_at: "2000-01-01T00:00:00Z",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://shorts-db.test/rest/v1/shorts_connections")) {
        if (init?.method === "PATCH") {
          Object.assign(row, JSON.parse(init.body as string));
          return new Response(null, { status: 204 });
        }
        return Response.json({ ...row });
      }
      if (url === "https://oauth2.googleapis.com/token")
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      throw new Error("Unexpected test request");
    }),
  );
  await expect(loadConnection("youtube")).rejects.toThrow(
    "credentials_expired",
  );
  expect(row.status).toBe("needs_attention");
});
