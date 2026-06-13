import { execSync } from "child_process";
import { existsSync, readdirSync, rmSync } from "fs";
import path from "path";
import { supabase } from "./lib/supabase";
import { download } from "./download";
import { transcribeWithGroq } from "./transcribe";
import { selectHighlights } from "./highlight";
import { editClips } from "./edit";
import { generateMetadata } from "./metadata";
import { uploadClips } from "./upload";
import { WORK_DIR } from "./lib/paths";

async function updateJob(
  jobId: string,
  status: string,
  error?: string,
): Promise<void> {
  await supabase
    .from("shorts_jobs")
    .update({
      status,
      error: error ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

function parseArg(args: string[], prefix: string): string | undefined {
  const match = args.find((a) => a.startsWith(prefix));
  return match?.slice(prefix.length);
}

/**
 * Groq Whisper 전사로 json3 자막을 생성한다.
 * 실패 시 YouTube 자동자막(json3) 으로 graceful fallback 하여 파이프라인이 죽지 않게 한다.
 * 폴백 자막도 없으면 throw → 호출부에서 failed 처리.
 */
async function runTranscription(
  videoId: string,
  audioPath: string,
  jobId: string,
): Promise<string> {
  const outPath = path.join(WORK_DIR, `${videoId}.json3`);
  try {
    return await transcribeWithGroq(audioPath, outPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[shorts] Groq 전사 실패 → YouTube 자동자막 폴백: ${msg}`);

    // 영상 재수신 없이 ko 자동자막만 재다운로드
    execSync(
      [
        "yt-dlp",
        "--skip-download",
        "--write-auto-sub",
        "--sub-lang ko",
        "--sub-format json3",
        `-o "${path.join(WORK_DIR, videoId)}"`,
        "--no-playlist",
        `"https://www.youtube.com/watch?v=${videoId}"`,
      ].join(" "),
      { stdio: "inherit", timeout: 300_000 },
    );

    const subFile = readdirSync(WORK_DIR).find(
      (f) => f.startsWith(videoId) && f.endsWith(".json3"),
    );
    if (!subFile) {
      throw new Error(
        "Groq 전사 실패 후 YouTube 자동자막도 찾을 수 없습니다.",
      );
    }

    // 폴백 사유를 error 컬럼에 메모 (status 는 곧 selecting 으로 덮어씀 → 파이프라인 계속)
    await updateJob(jobId, "transcribing", "groq_failed_fallback_youtube");
    return path.join(WORK_DIR, subFile);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const videoId = parseArg(args, "--videoId=");
  const jobId = parseArg(args, "--jobId=");
  const countStr = parseArg(args, "--count=");
  const count = countStr ? parseInt(countStr, 10) : 5;

  if (!videoId || !jobId) {
    console.error("Usage: --videoId=XXX --jobId=YYY");
    process.exit(1);
  }

  console.log(`[shorts] 시작: videoId=${videoId}, jobId=${jobId}, count=${count}`);

  try {
    // 0. 이전 임시 파일 정리 (C 드라이브 용량 확보)
    if (existsSync(WORK_DIR)) {
      console.log("[shorts] 0/6 임시 디렉토리 정리");
      try {
        const files = readdirSync(WORK_DIR);
        for (const file of files) {
          if (!file.includes(videoId)) {
            const p = path.join(WORK_DIR, file);
            rmSync(p, { recursive: true, force: true });
          }
        }
      } catch (e) {
        console.warn("[shorts] 임시 파일 정리 중 오류 발생 (무시):", e);
      }
    }

    // 1. 다운로드 + 오디오 추출
    console.log("[shorts] 1/6 다운로드 시작");
    await updateJob(jobId, "downloading");
    const { videoPath, audioPath } = download(videoId);

    // 2. 전사 (Groq Whisper → json3, 실패 시 자동자막 폴백)
    console.log("[shorts] 2/6 전사 시작");
    await updateJob(jobId, "transcribing");
    const subtitlePath = await runTranscription(videoId, audioPath, jobId);

    // 3. 자막 파싱 + 하이라이트 선정
    console.log("[shorts] 3/6 하이라이트 선정");
    await updateJob(jobId, "selecting");
    const highlights = await selectHighlights(subtitlePath, count);
    console.log(`[shorts] 하이라이트 ${highlights.length}개 선정 완료`);

    // 4. FFmpeg 편집
    console.log("[shorts] 4/6 영상 편집");
    await updateJob(jobId, "editing");
    const edited = editClips(videoPath, subtitlePath, highlights);
    const clipPaths = edited.map((e) => e.outputPath);
    const succeededHighlights = edited.map((e) => e.highlight);
    console.log(`[shorts] 렌더 성공 ${edited.length}/${highlights.length}개`);

    // 5. 메타데이터 생성 (성공한 클립 기준 — clipPaths 와 인덱스 정합)
    console.log("[shorts] 5/6 메타데이터 생성");
    const metadata = await generateMetadata(succeededHighlights);

    // 6. Supabase 업로드 + DB 저장
    console.log("[shorts] 6/6 업로드");
    const clips = await uploadClips(jobId, clipPaths, succeededHighlights, metadata);

    await updateJob(jobId, "ready_for_review");
    console.log(`[shorts] 완료: ${clips.length}개 클립 생성`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[shorts] 파이프라인 실패:", msg);
    await updateJob(jobId, "failed", msg);
    process.exit(1);
  }
}

main();
