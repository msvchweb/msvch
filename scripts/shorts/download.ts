import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { WORK_DIR } from "./lib/paths";

export interface DownloadResult {
  videoPath: string; // WORK_DIR/<videoId>.mp4
  audioPath: string; // WORK_DIR/<videoId>.mp3  (16kHz mono)
}

export function download(videoId: string): DownloadResult {
  mkdirSync(WORK_DIR, { recursive: true });

  const videoPath = path.join(WORK_DIR, `${videoId}.mp4`);
  const audioPath = path.join(WORK_DIR, `${videoId}.mp3`);

  // 영상 다운로드 (자막 동시 수신 제거 — 자막은 transcribe 단계에서 Groq 로 생성)
  execSync(
    [
      "yt-dlp",
      '-f "bv*[height<=1080]+ba/b[height<=1080]"',
      "--merge-output-format mp4",
      `-o "${videoPath}"`,
      "--no-playlist",
      `"https://www.youtube.com/watch?v=${videoId}"`,
    ].join(" "),
    { stdio: "inherit", timeout: 300_000 },
  );

  if (!existsSync(videoPath)) {
    throw new Error("영상 다운로드 실패");
  }

  // 다운로드한 영상에서 16kHz mono 32kbps mp3 추출 (2차 네트워크 다운로드 없음)
  execSync(
    [
      "ffmpeg -y",
      `-i "${videoPath}"`,
      "-vn",
      "-ac 1",
      "-ar 16000",
      "-c:a libmp3lame",
      "-b:a 32k",
      `"${audioPath}"`,
    ].join(" "),
    { stdio: "inherit", timeout: 300_000 },
  );

  if (!existsSync(audioPath)) {
    throw new Error("오디오 추출 실패");
  }

  return {
    videoPath,
    audioPath,
  };
}
