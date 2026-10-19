import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { shortsDb } from "../../../src/lib/shorts/db";
import type { ShortsPlatform } from "../../../src/types/shorts";
function secretKey(value = process.env.SHORTS_CREDENTIAL_ENCRYPTION_KEY ?? "") {
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("encryption_key_invalid");
  return key;
}
export function encryptSecret(value: unknown, purpose: string, key?: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", secretKey(key), iv);
  cipher.setAAD(Buffer.from(purpose));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  });
}
export function decryptSecret(
  value: string,
  purpose: string,
  key?: string,
): unknown {
  const p = z
    .object({
      v: z.literal(1),
      iv: z.string(),
      tag: z.string(),
      data: z.string(),
    })
    .parse(JSON.parse(value));
  const decipher = createDecipheriv(
    "aes-256-gcm",
    secretKey(key),
    Buffer.from(p.iv, "base64"),
  );
  decipher.setAAD(Buffer.from(purpose));
  decipher.setAuthTag(Buffer.from(p.tag, "base64"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(p.data, "base64")),
      decipher.final(),
    ]).toString("utf8"),
  );
}
export const CredentialsSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  accountType: z.string().optional(),
  scopes: z.array(z.string()),
  expiresAt: z.string(),
});
export type Credentials = z.infer<typeof CredentialsSchema>;
export function instagramBase() {
  const version = process.env.INSTAGRAM_API_VERSION;
  if (!version || !/^v\d+\.\d+$/.test(version))
    throw new Error("instagram_version_missing");
  return "https://graph.instagram.com/" + version;
}
export async function saveConnection(
  platform: ShortsPlatform,
  accountId: string,
  credentials: Credentials,
) {
  const { error } = await shortsDb()
    .from("shorts_connections")
    .upsert({
      platform,
      account_id: accountId,
      credentials_encrypted: encryptSecret(
        credentials,
        "connection:" + platform,
      ),
      expires_at: credentials.expiresAt,
      status: "connected",
      refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error("connection_save_failed");
}
export async function loadConnection(platform: ShortsPlatform) {
  const db = shortsDb();
  const { data: row, error } = await db
    .from("shorts_connections")
    .select("*")
    .eq("platform", platform)
    .single();
  if (error || !row || row.status !== "connected")
    throw new Error("credentials_missing");
  let credentials = CredentialsSchema.parse(
    decryptSecret(row.credentials_encrypted, "connection:" + platform),
  );
  const remaining = Date.parse(credentials.expiresAt) - Date.now();
  if (remaining < (platform === "youtube" ? 120000 : 7 * 86400000)) {
    try {
      let response: Response;
      if (platform === "youtube") {
        if (
          !credentials.refreshToken ||
          !process.env.YOUTUBE_CLIENT_ID ||
          !process.env.YOUTUBE_CLIENT_SECRET
        )
          throw new Error("refresh_configuration_missing");
        response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          signal: AbortSignal.timeout(30000),
          body: new URLSearchParams({
            client_id: process.env.YOUTUBE_CLIENT_ID,
            client_secret: process.env.YOUTUBE_CLIENT_SECRET,
            refresh_token: credentials.refreshToken,
            grant_type: "refresh_token",
          }),
        });
      } else {
        if (
          Date.now() - Date.parse(row.refreshed_at ?? row.updated_at) <
          86400000
        ) {
          if (remaining <= 0) throw new Error("token_expired");
          return { accountId: row.account_id as string, credentials };
        }
        const url = new URL("https://graph.instagram.com/refresh_access_token");
        url.search = new URLSearchParams({
          grant_type: "ig_refresh_token",
          access_token: credentials.accessToken,
        }).toString();
        response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      }
      if (!response.ok) throw new Error("refresh_rejected");
      const fresh = z
        .object({ access_token: z.string(), expires_in: z.number().positive() })
        .parse(await response.json());
      credentials = {
        ...credentials,
        accessToken: fresh.access_token,
        expiresAt: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
      };
      const { data: saved, error: saveError } = await db
        .from("shorts_connections")
        .update({
          credentials_encrypted: encryptSecret(
            credentials,
            "connection:" + platform,
          ),
          expires_at: credentials.expiresAt,
          refreshed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("platform", platform)
        .eq("updated_at", row.updated_at)
        .select("platform");
      if (saveError || saved?.length !== 1)
        throw new Error("connection_changed");
    } catch {
      await db
        .from("shorts_connections")
        .update({
          status: "needs_attention",
          updated_at: new Date().toISOString(),
        })
        .eq("platform", platform)
        .eq("updated_at", row.updated_at);
      throw new Error("credentials_expired");
    }
  }
  return { accountId: row.account_id as string, credentials };
}
