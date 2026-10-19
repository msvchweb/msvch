// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { createTestDb } from "../lib/test-db";
import { createPublishContext } from "./context";
import { encryptSecret } from "./credentials";
import { publishYoutube } from "./youtube";
import { publishInstagram } from "./instagram";
import type {
  PublicationLease,
  ShortsPlatform,
  ShortsPublication,
} from "../../../src/types/shorts";
const clip = "20000000-0000-4000-8000-000000000001";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it.each(["youtube", "instagram"] as ShortsPlatform[])(
  "protects an unresolved %s public result across retry, edit, cancellation and quota",
  async (platform) => {
    const db = await createTestDb(true);
    try {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://shorts-db.test");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
      vi.stubEnv(
        "SHORTS_CREDENTIAL_ENCRYPTION_KEY",
        Buffer.alloc(32, 4).toString("base64"),
      );
      vi.stubEnv("YOUTUBE_CHANNEL_ID", "channel");
      vi.stubEnv("INSTAGRAM_ACCOUNT_ID", "channel");
      vi.stubEnv("INSTAGRAM_API_VERSION", "v23.0");
      vi.stubEnv("NEXT_PUBLIC_CDN_BASE_URL", "https://cdn.example.com");
      await db.exec(
        "update shorts_clips set transcript_status='verified',media_check='{\"valid\":true}',video_url='https://cdn.example.com/shorts/clip.mp4'; update shorts_settings set publishing_enabled=true,daily_publish_limit=1",
      );
      await db.query(
        "insert into shorts_connections(platform,account_id,credentials_encrypted,status) values($1,'channel',$2,'connected')",
        [
          platform,
          encryptSecret(
            {
              accessToken: "token",
              scopes: [],
              accountType: "BUSINESS",
              expiresAt: "2100-01-01T00:00:00Z",
            },
            "connection:" + platform,
          ),
        ],
      );
      await db.query(
        "select shorts_approve_schedule($1,1,array[$2],now()-interval '1 hour',false)",
        [clip, platform],
      );
      const publication = (
        await db.query<{ p: ShortsPublication }>(
          "select shorts_claim_publication(now(),'worker','live') as p",
        )
      ).rows[0].p;
      const lease: PublicationLease = {
        publication,
        leaseToken: publication.lease_token!,
      };
      const initial =
        platform === "youtube"
          ? { phase: "uploaded", videoId: "video" }
          : { phase: "processing", containerId: "container" };
      await db.query("select shorts_publication_checkpoint($1,$2,$3)", [
        publication.id,
        lease.leaseToken,
        encryptSecret(initial, "checkpoint:" + publication.id),
      ]);
      let videoReads = 0;
      // Real context + Supabase client; isolated HTTP boundary routes DB calls to PostgreSQL.
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = new URL(String(input));
          if (url.origin === "https://shorts-db.test") {
            const name = url.pathname.split("/").at(-1)!;
            if (url.pathname.includes("/rpc/")) {
              const p = JSON.parse(init!.body as string);
              if (name === "shorts_guard_publication")
                return Response.json(
                  (
                    await db.query<{ ok: boolean }>(
                      "select shorts_guard_publication($1,$2) as ok",
                      [p.p_id, p.p_token],
                    )
                  ).rows[0].ok,
                );
              if (name === "shorts_publication_checkpoint") {
                const marked = Object.hasOwn(p, "p_public_request_started");
                const result = await db.query<{ ok: boolean }>(
                  marked
                    ? "select shorts_publication_checkpoint($1,$2,$3,$4) as ok"
                    : "select shorts_publication_checkpoint($1,$2,$3) as ok",
                  marked
                    ? [
                        p.p_id,
                        p.p_token,
                        p.p_checkpoint ?? null,
                        p.p_public_request_started,
                      ]
                    : [p.p_id, p.p_token, p.p_checkpoint ?? null],
                );
                return Response.json(result.rows[0].ok);
              }
            } else if (
              [
                "shorts_clips",
                "shorts_connections",
                "shorts_publish_private",
              ].includes(name)
            ) {
              const field =
                name === "shorts_clips"
                  ? "id"
                  : name === "shorts_connections"
                    ? "platform"
                    : "publication_id";
              const value = url.searchParams.get(field)!.slice(3);
              return Response.json(
                (
                  await db.query(`select * from ${name} where ${field}=$1`, [
                    value,
                  ])
                ).rows[0] ?? null,
              );
            }
            throw new Error("Unexpected isolated database request");
          }
          if (platform === "youtube") {
            if (init?.method === "PUT") return Response.json({ id: "video" });
            if (++videoReads === 1)
              return Response.json({
                items: [
                  {
                    snippet: { channelId: "channel" },
                    status: {
                      privacyStatus: "private",
                      uploadStatus: "processed",
                    },
                  },
                ],
              });
            return new Response(null, { status: 429 });
          }
          if (url.pathname.endsWith("/container"))
            return Response.json({ status_code: "FINISHED" });
          if (url.pathname.endsWith("/media_publish"))
            return Response.json({ id: "media" });
          if (url.pathname.endsWith("/media"))
            return new Response(null, { status: 429 });
          throw new Error("Unexpected provider fixture request");
        }),
      );
      const context = await createPublishContext(lease);
      const result = await (platform === "youtube"
        ? publishYoutube(lease, context)
        : publishInstagram(lease, context));
      expect(result).toMatchObject({
        status: "retry_wait",
        definiteFailure: false,
      });
      // A heartbeat must not clear the marker set before the external public request.
      await db.query("select shorts_publication_checkpoint($1,$2)", [
        publication.id,
        lease.leaseToken,
      ]);
      await db.query("select shorts_finish_publication($1,$2,$3)", [
        publication.id,
        lease.leaseToken,
        JSON.stringify(result),
      ]);
      await expect(
        db.query(
          "select shorts_review_clip($1,'edit',1,'{\"title\":\"changed\"}')",
          [clip],
        ),
      ).rejects.toThrow("publication_in_flight");
      await expect(
        db.query(
          "select shorts_review_clip($1,'reject',1,'{\"category\":\"other\"}')",
          [clip],
        ),
      ).rejects.toThrow("publication_in_flight");
      await expect(
        db.query("select shorts_change_publication($1,'cancel')", [
          publication.id,
        ]),
      ).rejects.toThrow("publication_requires_reconciliation");
      expect(
        (
          await db.query(
            "select public_request_started,quota_date is not null as reserved from shorts_publications where id=$1",
            [publication.id],
          )
        ).rows,
      ).toEqual([{ public_request_started: true, reserved: true }]);
      expect(
        (
          await db.query(
            "select content_version from shorts_clips where id=$1",
            [clip],
          )
        ).rows,
      ).toEqual([{ content_version: 1 }]);
      await context.cleanup();
    } finally {
      await db.close();
    }
  },
  30000,
);
