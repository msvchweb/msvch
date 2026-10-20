import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { runTool } from "./lib/process";
import { VideoIdSchema } from "../../src/lib/shorts/validation";
export interface DownloadResult {
  videoPath: string;
  audioPath: string;
}
export async function download(
  videoId: string,
  workDir: string,
  signal?: AbortSignal,
): Promise<DownloadResult> {
  VideoIdSchema.parse(videoId);
  mkdirSync(workDir, { recursive: true });
  const videoPath = path.join(workDir, videoId + ".mp4"),
    audioPath = path.join(workDir, videoId + ".mp3");
  await runTool(
    "yt-dlp",
    [
      "-f",
      "bv*[height<=1080]+ba/b[height<=1080]",
      "--merge-output-format",
      "mp4",
      "--fragment-retries",
      "5",
      "--retries",
      "5",
      "-o",
      videoPath,
      "--no-playlist",
      `https://www.youtube.com/watch?v=${videoId}`,
    ],
    { timeoutMs: 1200000, signal },
  );
  if (!existsSync(videoPath)) throw new Error("download_missing");
  await runTool(
    "ffmpeg",
    [
      "-y",
      "-i",
      videoPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "32k",
      audioPath,
    ],
    { timeoutMs: 300000, signal },
  );
  if (!existsSync(audioPath)) throw new Error("audio_missing");
  return { videoPath, audioPath };
}
