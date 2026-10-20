import { access, mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runTool } from "./lib/process";
async function main() {
  if (Number(process.versions.node.split(".")[0]) < 24)
    throw new Error("Node 24 이상이 필요합니다.");
  for (const [tool, args] of [
    ["yt-dlp", ["--version"]],
    ["ffmpeg", ["-version"]],
    ["ffprobe", ["-version"]],
  ] as const) {
    await runTool(tool, [...args], { timeoutMs: 15000 });
    console.log(tool + ": OK");
  }
  await access(path.join(process.cwd(), "scripts/shorts/banner.png"));
  const dir = await mkdtemp(path.join(os.tmpdir(), "shorts-preflight-"));
  try {
    const ass = path.join(dir, "font.ass");
    await writeFile(
      ass,
      "[Script Info]\nScriptType: v4.00+\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, Alignment\nStyle: Default,Noto Sans CJK KR,40,&H00FFFFFF,2\n[Events]\nFormat: Layer, Start, End, Style, Text\nDialogue: 0,0:00:00.00,0:00:01.00,Default,한글 확인\n",
    );
    const out = await runTool(
      "ffmpeg",
      [
        "-f",
        "lavfi",
        "-i",
        "color=s=320x240:d=1",
        "-vf",
        "ass=font.ass",
        "-f",
        "null",
        "-",
      ],
      { timeoutMs: 15000, cwd: dir },
    );
    if (!/fontselect:.*->.*NotoSansCJKkr/i.test(out.stderr))
      throw new Error("Noto Sans CJK KR 글꼴 설치를 확인하세요.");
    console.log("font / temp / banner: OK");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  if (!process.argv.includes("--tools-only")) {
    const names = [
      "GEMINI_API_KEY",
      "GROQ_API_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET",
      "NEXT_PUBLIC_CDN_BASE_URL",
    ];
    const missing = names.filter((name) => !process.env[name]);
    if (missing.length) throw new Error("설정 누락: " + missing.join(", "));
    console.log("credential presence: OK (values hidden)");
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "preflight_failed");
  process.exitCode = 1;
});
