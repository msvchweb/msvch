import { z } from "zod";
import { shortsDb } from "./db";
import { IdSchema, ClipPatchSchema, RejectionSchema } from "./validation";
import { ShortsError } from "./generation";
export type ClipPatch = z.infer<typeof ClipPatchSchema>;
export async function reviewClip(
  id: string,
  action: "edit" | "approve" | "reject",
  version: number | null,
  patch: unknown = {},
) {
  IdSchema.parse(id);
  const { data, error } = await shortsDb().rpc("shorts_review_clip", {
    p_clip: id,
    p_action: action,
    p_version: version,
    p_patch: patch,
  });
  if (error)
    throw new ShortsError(
      "내용이 변경되었거나 현재 검수할 수 없는 클립입니다. 새로고침 후 확인하세요.",
    );
  return data;
}
export function updateClip(id: string, request: unknown) {
  const p = ClipPatchSchema.parse(request);
  return reviewClip(id, "edit", p.expectedVersion, p);
}
export function rejectClip(id: string, request: unknown) {
  const p = RejectionSchema.parse(request);
  return reviewClip(id, "reject", p.expectedVersion, p);
}
