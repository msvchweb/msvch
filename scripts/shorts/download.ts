import { execSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import path from "path";

const WORK_DIR = "/tmp/shorts";

export interface DownloadResult {
  videoPath: string;
  subtitlePath: string;
}

export function download(videoId: string): DownloadResult {
  execSync(`mkdir -p ${WORK_DIR}`);

  const videoPath = path.join(WORK_DIR, `${videoId}.mp4`);

  // 영상 + 한국어 자동 자막 다운로드
  execSync(
    [
      "yt-dlp",
      "--write-auto-sub",
      "--sub-lang ko",
      "--sub-format json3",
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

  // yt-dlp는 자막 파일명에 .ko 를 붙임
  const files = readdirSync(WORK_DIR);
  const subFile = files.find(
    (f) => f.startsWith(videoId) && f.endsWith(".json3"),
  );

  if (!subFile) {
    throw new Error(
      "한국어 자막을 찾을 수 없습니다. 이 영상에는 자동 자막이 없을 수 있습니다.",
    );
  }

  return {
    videoPath,
    subtitlePath: path.join(WORK_DIR, subFile),
  };
}
