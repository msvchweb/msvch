import { stat } from "node:fs/promises";
import { runTool } from "./lib/process";
export interface MediaCheck {
  valid: boolean;
  duration: number;
  warnings: string[];
  errors: string[];
}
interface Probe {
  streams?: {
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    duration?: string;
    sample_rate?: string;
  }[];
  format?: { duration?: string };
}
export function inspectMedia(probe: Probe, expected?: number): MediaCheck {
  const video = probe.streams?.find((s) => s.codec_type === "video"),
    audio = probe.streams?.find((s) => s.codec_type === "audio");
  const duration = Number(probe.format?.duration),
    errors: string[] = [],
    warnings: string[] = [];
  if (
    !video ||
    video.width !== 1080 ||
    video.height !== 1920 ||
    video.codec_name !== "h264"
  )
    errors.push("invalid_video");
  if (!audio || audio.codec_name !== "aac" || audio.sample_rate !== "48000")
    errors.push("invalid_audio");
  if (!Number.isFinite(duration) || duration <= 0 || duration > 71)
    errors.push("invalid_duration");
  if (expected !== undefined && Math.abs(duration - expected) >= 0.5)
    warnings.push("duration_mismatch");
  if (
    video?.duration &&
    audio?.duration &&
    Math.abs(Number(video.duration) - Number(audio.duration)) >= 0.25
  )
    warnings.push("av_duration_mismatch");
  return {
    valid: errors.length === 0,
    duration: Number.isFinite(duration) ? duration : 0,
    warnings,
    errors,
  };
}
export async function verifyClip(
  filePath: string,
  expected?: number,
  signal?: AbortSignal,
): Promise<MediaCheck> {
  if ((await stat(filePath)).size === 0)
    return { valid: false, duration: 0, warnings: [], errors: ["empty_file"] };
  const probe = await runTool(
    "ffprobe",
    ["-v", "error", "-show_streams", "-show_format", "-of", "json", filePath],
    { timeoutMs: 30000, signal },
  );
  return inspectMedia(JSON.parse(probe.stdout), expected);
}
