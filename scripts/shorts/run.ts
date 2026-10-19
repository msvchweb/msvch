import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { shortsDb } from "../../src/lib/shorts/db";
import {
  IdSchema,
  GenerationRequestSchema,
} from "../../src/lib/shorts/validation";
import {
  claimGenerationAttempt,
  finishGenerationAttempt,
  updateAttempt,
  attemptRpc,
} from "./lib/attempts";
import { download } from "./download";
import { transcribeWithGroq } from "./transcribe";
import { selectHighlights } from "./highlight";
import { editClips } from "./edit";
import { generateMetadata } from "./metadata";
import { uploadClips } from "./upload";
import { getAttemptDir } from "./lib/paths";
import { runTool } from "./lib/process";
export function arg(name: string) {
  return process.argv
    .slice(2)
    .find((a) => a.startsWith("--" + name + "="))
    ?.slice(name.length + 3);
}
export async function runPipeline(input: {
  jobId: string;
  attemptId: string;
  videoId: string;
  count: number;
}) {
  IdSchema.parse(input.jobId);
  IdSchema.parse(input.attemptId);
  GenerationRequestSchema.parse({
    videoId: input.videoId,
    videoTitle: "runner",
    count: input.count,
  });
  const db = shortsDb(),
    runId = process.env.GITHUB_RUN_ID,
    runAttempt = Number(process.env.GITHUB_RUN_ATTEMPT);
  if (!runId || !Number.isInteger(runAttempt) || runAttempt < 1)
    throw new Error("github_run_identity_required");
  const { data: job, error } = await db
    .from("shorts_jobs")
    .select("video_id,highlight_count,active_attempt_id")
    .eq("id", input.jobId)
    .single();
  if (
    error ||
    job?.video_id !== input.videoId ||
    job.highlight_count !== input.count ||
    job.active_attempt_id !== input.attemptId
  )
    throw new Error("generation_input_mismatch");
  if (!(await claimGenerationAttempt(input.attemptId, runId, runAttempt, db))) {
    console.log("Attempt already owned or completed.");
    return;
  }
  const controller = new AbortController();
  const budget = setTimeout(
    () => controller.abort(new Error("pipeline_time_budget_exceeded")),
    55 * 60 * 1000,
  );
  let heartbeat: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (heartbeat) return;
    heartbeat = attemptRpc(
      "shorts_heartbeat_attempt",
      { p_attempt: input.attemptId, p_run: runId, p_run_attempt: runAttempt },
      db,
    )
      .then((ok) => {
        if (!ok) throw new Error("attempt_ownership_lost");
      })
      .catch(() => {
        controller.abort(new Error("attempt_heartbeat_failed"));
      })
      .finally(() => {
        heartbeat = undefined;
      });
  }, 30000);
  const stage = (name: string, source?: string) =>
    updateAttempt(input.attemptId, runId, runAttempt, name, db, source);
  const workDir = getAttemptDir(input.jobId, input.attemptId);
  try {
    mkdirSync(workDir, { recursive: true });
    await stage("downloading");
    const { videoPath, audioPath } = await download(
      input.videoId,
      workDir,
      controller.signal,
    );
    await stage("transcribing");
    let subtitlePath = path.join(workDir, input.videoId + ".json3"),
      source = "groq";
    try {
      await transcribeWithGroq(audioPath, subtitlePath, controller.signal);
    } catch {
      controller.signal.throwIfAborted();
      source = "youtube_auto";
      await runTool(
        "yt-dlp",
        [
          "--skip-download",
          "--write-auto-sub",
          "--sub-lang",
          "ko",
          "--sub-format",
          "json3",
          "-o",
          path.join(workDir, input.videoId),
          "--no-playlist",
          `https://www.youtube.com/watch?v=${input.videoId}`,
        ],
        { timeoutMs: 300000, signal: controller.signal },
      );
      const file = readdirSync(workDir).find(
        (f) => f.startsWith(input.videoId + ".ko") && f.endsWith(".json3"),
      );
      if (!file) throw new Error("transcription_unavailable");
      subtitlePath = path.join(workDir, file);
    }
    writeFileSync(
      path.join(workDir, "transcription-source.json"),
      JSON.stringify({ source, subtitlePath: path.basename(subtitlePath) }),
    );
    await stage("selecting", source);
    const highlights = await selectHighlights(
      subtitlePath,
      input.count,
      controller.signal,
    );
    const { data: settings, error: settingsError } = await db
      .from("shorts_settings")
      .select("bgm_enabled")
      .eq("id", 1)
      .single();
    if (settingsError) throw new Error("settings_read_failed");
    await stage("editing");
    const edited = await editClips(videoPath, subtitlePath, highlights, {
      workDir,
      bgmEnabled: settings?.bgm_enabled === true,
      signal: controller.signal,
    });
    const metadata = await generateMetadata(
      edited.map((e) => e.highlight),
      controller.signal,
    );
    await uploadClips(
      input.jobId,
      input.attemptId,
      runId,
      runAttempt,
      edited,
      metadata,
      controller.signal,
    );
    clearInterval(timer);
    await heartbeat;
    if (
      !(await finishGenerationAttempt(
        input.attemptId,
        runId,
        runAttempt,
        { success: true },
        db,
      ))
    )
      throw new Error("attempt_ownership_lost");
    console.log(`Completed ${edited.length} clips for review.`);
  } catch (e) {
    clearInterval(timer);
    await heartbeat;
    const raw = e instanceof Error ? e.message : "pipeline_failed";
    const code = /^[a-z0-9_]+$/.test(raw) ? raw : "pipeline_failed";
    await finishGenerationAttempt(
      input.attemptId,
      runId,
      runAttempt,
      { success: false, code, message: code },
      db,
    );
    throw new Error(code);
  } finally {
    clearInterval(timer);
    clearTimeout(budget);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runPipeline({
    videoId: arg("videoId") ?? "",
    jobId: arg("jobId") ?? "",
    attemptId: arg("attemptId") ?? "",
    count: Number(arg("count") ?? 5),
  }).catch((e) => {
    console.error(e instanceof Error ? e.message : "pipeline_failed");
    process.exitCode = 1;
  });
}
