import { z } from "zod";
export const VideoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
export const IdSchema = z.string().uuid();
export const GenerationRequestSchema = z.object({
  videoId: VideoIdSchema,
  videoTitle: z.string().trim().min(1).max(300),
  videoPublishedAt: z.iso.datetime({ offset: true }).optional(),
  videoThumbnail: z.url().optional(),
  count: z.union([z.literal(5), z.literal(10)]).default(5),
});
export type GenerationRequest = z.infer<typeof GenerationRequestSchema>;
export const ClipPatchSchema = z.object({
  expectedVersion: z.number().int().positive(),
  title: z.string().trim().min(1).max(100),
  titleYt: z.string().trim().min(1).max(100),
  captionYt: z.string().max(5000),
  captionIg: z.string().max(2200),
});
export const RejectionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  category: z.enum(["context", "hook", "subtitle", "framing", "sync", "other"]),
  note: z.string().max(2000).default(""),
});
export const ApprovalRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    platforms: z
      .array(z.enum(["youtube", "instagram"]))
      .min(1)
      .max(2),
    scheduledAt: z.iso.datetime({ offset: true }),
    testOnly: z.boolean().default(false),
  })
  .refine((v) => !v.testOnly || v.platforms.every((p) => p === "youtube"));
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;
export const SettingsPatchSchema = z
  .object({
    publishing_enabled: z.boolean().optional(),
    bgm_enabled: z.boolean().optional(),
    auto_generate_enabled: z.boolean().optional(),
    source_playlist_id: z
      .string()
      .regex(/^[A-Za-z0-9_-]{10,100}$/)
      .nullable()
      .optional(),
    allowed_categories: z
      .array(z.enum(["sunday", "wednesday", "friday", "dawn"]))
      .min(1)
      .optional(),
    daily_publish_limit: z.number().int().min(1).max(20).optional(),
  })
  .strict();
