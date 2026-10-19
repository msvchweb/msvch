import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, stat, rm } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import os from "node:os";
import path from "node:path";
import { shortsDb } from "../../../src/lib/shorts/db";
import type {
  PublicationLease,
  ShortsPublication,
  ShortsClip,
} from "../../../src/types/shorts";
import {
  decryptSecret,
  encryptSecret,
  instagramBase,
  loadConnection,
} from "./credentials";
import { guardPublication } from "./queue";
export interface Checkpoint {
  phase: string;
  sessionUri?: string;
  size?: number;
  videoId?: string;
  containerId?: string;
  mediaId?: string;
  recreated?: number;
}
export interface PublishContext {
  publication: ShortsPublication;
  clip: ShortsClip;
  checkpoint: Checkpoint | null;
  accountId: string;
  expectedAccountId: string;
  accountType?: string;
  accessToken: string;
  apiBase: string;
  request: (
    url: string,
    options?: RequestInit & { duplex?: "half" },
  ) => Promise<Response>;
  save: (value: Checkpoint) => Promise<void>;
  guard: () => Promise<boolean>;
  now: () => Date;
  media: () => Promise<{ size: number; body: (offset: number) => BodyInit }>;
  cleanup: () => Promise<void>;
}
export function allowedMediaUrl(value: string) {
  const base = new URL(process.env.NEXT_PUBLIC_CDN_BASE_URL ?? "");
  const url = new URL(value),
    prefix = base.pathname.replace(/\/$/, "") + "/shorts/";
  if (
    url.protocol !== "https:" ||
    url.origin !== base.origin ||
    !url.pathname.startsWith(prefix) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("media_url_not_allowed");
  return url.toString();
}
export async function createPublishContext(
  lease: PublicationLease,
  signal?: AbortSignal,
): Promise<PublishContext> {
  const db = shortsDb(),
    p = lease.publication;
  const [clipResult, checkpointResult, connection] = await Promise.all([
    db.from("shorts_clips").select("*").eq("id", p.clip_id).single(),
    db
      .from("shorts_publish_private")
      .select("checkpoint_encrypted")
      .eq("publication_id", p.id)
      .maybeSingle(),
    loadConnection(p.platform),
  ]);
  if (clipResult.error || checkpointResult.error || !clipResult.data)
    throw new Error("publication_context_failed");
  const expected =
    process.env[
      p.platform === "youtube" ? "YOUTUBE_CHANNEL_ID" : "INSTAGRAM_ACCOUNT_ID"
    ];
  if (!expected || connection.accountId !== expected)
    throw new Error("account_mismatch");
  const mediaUrl = allowedMediaUrl(clipResult.data.video_url);
  let dir: string | undefined,
    media: Awaited<ReturnType<PublishContext["media"]>> | undefined;
  const checkpoint = checkpointResult.data
    ? (decryptSecret(
        checkpointResult.data.checkpoint_encrypted,
        "checkpoint:" + p.id,
      ) as Checkpoint)
    : null;
  const ctx: PublishContext = {
    publication: p,
    clip: clipResult.data,
    checkpoint,
    accountId: connection.accountId,
    expectedAccountId: expected,
    accessToken: connection.credentials.accessToken,
    accountType: connection.credentials.accountType,
    apiBase:
      p.platform === "instagram"
        ? instagramBase()
        : "https://www.googleapis.com/youtube/v3",
    now: () => new Date(),
    async request(url, options = {}) {
      const target = new URL(url);
      if (
        target.protocol !== "https:" ||
        !["www.googleapis.com", "graph.instagram.com"].includes(target.hostname)
      )
        throw new Error("provider_url_not_allowed");
      return fetch(target, {
        ...options,
        headers: {
          Authorization: "Bearer " + connection.credentials.accessToken,
          ...Object.fromEntries(new Headers(options.headers)),
        },
        redirect: "error",
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(300000)])
          : AbortSignal.timeout(300000),
      });
    },
    async save(value) {
      const { data, error } = await db.rpc("shorts_publication_checkpoint", {
        p_id: p.id,
        p_token: lease.leaseToken,
        p_checkpoint: encryptSecret(value, "checkpoint:" + p.id),
      });
      if (error || data !== true) throw new Error("checkpoint_failed");
      ctx.checkpoint = value;
    },
    guard: () =>
      signal?.aborted ? Promise.resolve(false) : guardPublication(lease),
    async media() {
      if (media) return media;
      dir = await mkdtemp(path.join(os.tmpdir(), "shorts-publish-"));
      const file = path.join(dir, "clip.mp4"),
        downloadSignal = signal
          ? AbortSignal.any([signal, AbortSignal.timeout(300000)])
          : AbortSignal.timeout(300000);
      const response = await fetch(mediaUrl, {
        redirect: "error",
        signal: downloadSignal,
      });
      if (!response.ok || !response.body)
        throw new Error("media_download_failed");
      let bytes = 0;
      const cap = new Transform({
        transform(chunk, encoding, done) {
          bytes += chunk.length;
          done(
            bytes > 512 * 1024 * 1024 ? new Error("media_too_large") : null,
            chunk,
          );
        },
      });
      await pipeline(
        Readable.fromWeb(
          response.body as Parameters<typeof Readable.fromWeb>[0],
        ),
        cap,
        createWriteStream(file, { mode: 0o600 }),
        { signal: downloadSignal },
      );
      const size = (await stat(file)).size;
      if (size <= 0) throw new Error("media_empty");
      media = {
        size,
        body: (offset) =>
          Readable.toWeb(createReadStream(file, { start: offset })) as BodyInit,
      };
      return media;
    },
    async cleanup() {
      if (dir) await rm(dir, { recursive: true, force: true });
    },
  };
  return ctx;
}
export function safeFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return [
    "credentials_expired",
    "credentials_missing",
    "account_mismatch",
    "checkpoint_failed",
    "encryption_key_invalid",
    "media_url_not_allowed",
    "instagram_version_missing",
  ].includes(message)
    ? message
    : "publication_interrupted";
}
