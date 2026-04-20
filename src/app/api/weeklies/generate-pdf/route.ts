import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildWeeklyHtml } from "@/lib/weekly-html-template";
import type { Weekly } from "@/types/notice";

export const maxDuration = 60;
export const runtime = "nodejs";

async function getChromiumExecutable(): Promise<string> {
  // 프로덕션(Vercel): @sparticuz/chromium-min 으로 런타임에 바이너리 다운로드
  if (process.env.NODE_ENV === "production") {
    const chromium = await import("@sparticuz/chromium-min");
    const url =
      process.env.CHROMIUM_DOWNLOAD_URL ??
      "https://github.com/Sparticuz/chromium/releases/download/v147.0.1/chromium-v147.0.1-pack.x64.tar";
    return await chromium.default.executablePath(url);
  }
  // 로컬 개발: 명시적 경로 우선
  if (process.env.CHROME_EXECUTABLE_PATH) {
    return process.env.CHROME_EXECUTABLE_PATH;
  }
  const { existsSync } = await import("fs");
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    "Chrome not found. Set CHROME_EXECUTABLE_PATH environment variable.",
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // 관리자 인증
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile as { role: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: { weeklyId: string } = await req.json();
  const { weeklyId } = body;
  if (!weeklyId || typeof weeklyId !== "string") {
    return NextResponse.json({ error: "weeklyId required" }, { status: 400 });
  }

  // 주보 데이터 조회
  const { data: weekly, error: dbErr } = await supabase
    .from("weeklies")
    .select("*")
    .eq("id", weeklyId)
    .single();

  if (dbErr || !weekly) {
    return NextResponse.json({ error: "Weekly not found" }, { status: 404 });
  }

  const html = buildWeeklyHtml(weekly as Weekly);

  let pdfBuffer: Buffer;
  try {
    const puppeteer = await import("puppeteer-core");
    const executablePath = await getChromiumExecutable();

    let args: string[] = ["--no-sandbox", "--disable-setuid-sandbox"];
    if (process.env.NODE_ENV === "production") {
      const chromium = await import("@sparticuz/chromium-min");
      args = chromium.default.args;
    }

    const browser = await puppeteer.default.launch({
      executablePath,
      args,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    // Google Fonts 등 외부 폰트가 로드될 때까지 대기 (evaluate로 Promise 해소까지 대기)
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
    });
    await browser.close();
    pdfBuffer = Buffer.from(pdf);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("PDF generation error:", err);
    return NextResponse.json(
      { error: "PDF generation failed", detail: message },
      { status: 500 },
    );
  }

  // Storage 업로드
  const storagePath = `${weeklyId}-generated.pdf`;
  await supabase.storage.from("weeklies").remove([storagePath]);

  const { error: uploadErr } = await supabase.storage
    .from("weeklies")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json(
      { error: "Upload failed: " + uploadErr.message },
      { status: 500 },
    );
  }

  const { data: urlData } = supabase.storage
    .from("weeklies")
    .getPublicUrl(storagePath);

  // pdf_url 업데이트
  await supabase
    .from("weeklies")
    .update({ pdf_url: urlData.publicUrl })
    .eq("id", weeklyId);

  return NextResponse.json({ pdfUrl: urlData.publicUrl });
}
