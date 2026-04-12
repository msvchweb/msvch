import { supabase } from "./lib/supabase";
import { download } from "./download";
import { selectHighlights } from "./highlight";
import { editClips } from "./edit";
import { generateMetadata } from "./metadata";
import { uploadClips } from "./upload";

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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const videoId = parseArg(args, "--videoId=");
  const jobId = parseArg(args, "--jobId=");

  if (!videoId || !jobId) {
    console.error("Usage: --videoId=XXX --jobId=YYY");
    process.exit(1);
  }

  console.log(`[shorts] 시작: videoId=${videoId}, jobId=${jobId}`);

  try {
    // 1. 다운로드 + 자막 추출
    console.log("[shorts] 1/5 다운로드 시작");
    await updateJob(jobId, "downloading");
    const { videoPath, subtitlePath } = download(videoId);

    // 2. 자막 파싱 + 하이라���트 선정
    console.log("[shorts] 2/5 하이라이트 선정");
    await updateJob(jobId, "selecting");
    const highlights = await selectHighlights(subtitlePath);
    console.log(`[shorts] 하이라이트 ${highlights.length}개 선정 완료`);

    // 3. FFmpeg 편집
    console.log("[shorts] 3/5 영상 편집");
    await updateJob(jobId, "editing");
    const clipPaths = editClips(videoPath, subtitlePath, highlights);

    // 4. 메타데이터 생성
    console.log("[shorts] 4/5 메타데이터 생성");
    const metadata = await generateMetadata(highlights);

    // 5. Supabase 업로드 + DB 저장
    console.log("[shorts] 5/5 업로드");
    const clips = await uploadClips(jobId, clipPaths, highlights, metadata);

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
